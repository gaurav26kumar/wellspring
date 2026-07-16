const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/asyncHandler');
const ChatSession = require('../../models/ChatSession');
const ChatMessage = require('../../models/ChatMessage');
const { checkSafety, logSafetyFlag, getFixedSafetyResponse } = require('../../services/agents/safetyAgent');
const { retrieveRelevantMemories } = require('../../services/retrieval');
const { runReflectionAgent } = require('../../services/agents/reflectionAgent');
const { queueEmbedding } = require('../../workers/taskEmbeddings');

const router = express.Router();

router.post('/sessions', requireAuth, asyncHandler(async (req, res) => {
  const session = await ChatSession.create({ userId: req.user.id, title: req.body.title || 'New chat' });
  res.status(201).json(session);
}));

router.get('/sessions/:id', requireAuth, asyncHandler(async (req, res) => {
  const session = await ChatSession.findOne({ _id: req.params.id, userId: req.user.id });
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const messages = await ChatMessage.find({ sessionId: session._id }).sort({ createdAt: 1 });
  res.json({ session, messages });
}));

router.post('/sessions/:id/message', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const sessionId = req.params.id;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  const session = await ChatSession.findOne({ _id: sessionId, userId });
  if (!session) return res.status(404).json({ error: 'Session not found' });

  // ---- 1. Safety Agent — runs first, always. Nothing below this line runs
  // until it has cleared the message. ----
  const safety = await checkSafety({ text: message, userId });

  if (safety.flagged) {
    const userMsg = await ChatMessage.create({ sessionId, userId, role: 'user', content: message });
    await logSafetyFlag({ userId, messageId: userMsg._id, severity: safety.severity, reason: safety.reason });

    // The general-purpose LLM never sees this path — the reply is fixed.
    const fixedReply = getFixedSafetyResponse();
    await ChatMessage.create({ sessionId, userId, role: 'assistant', content: fixedReply });

    return res.json({ role: 'assistant', content: fixedReply, safety: true });
  }

  // ---- 2. Retrieval — pgvector-equivalent similarity search, scoped to this
  // user only. This depends on Atlas Vector Search indexes existing (see
  // scripts/createVectorIndex.js) and on GEMINI_API_KEY for embeddings. If
  // either isn't set up this throws — caught here so a broken retrieval
  // step degrades the reply instead of hanging the whole request forever. ----
  let memories = [];
  try {
    memories = await retrieveRelevantMemories({ userId, queryText: message });
  } catch (err) {
    console.error('[chat.routes] retrieval failed, continuing without memories —', err.message);
  }

  // ---- 3. Reflection Agent — builds the prompt, calls the LLM, streams the reply ----
  const userMsg = await ChatMessage.create({ sessionId, userId, role: 'user', content: message });

  let fullReply = '';
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    await runReflectionAgent({ message, memories, sessionId }, (chunk) => {
      fullReply += chunk;
      res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
    });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[chat.routes] reflection agent failed —', err.message);
    if (!res.headersSent) {
      return res.status(502).json({ error: 'Something went wrong generating a reply.' });
    }
    res.write(`data: ${JSON.stringify({ error: 'Something went wrong generating a reply.' })}\n\n`);
    return res.end();
  }

  // ---- 4. Persist + embed in the background — response is already sent,
  // this should never hold up the user, and a failure here must not crash
  // the process (previously unhandled — a rejection here could crash the
  // whole Node process on some setups). ----
  ChatMessage.create({ sessionId, userId, role: 'assistant', content: fullReply })
    .then((assistantMsg) => {
      queueEmbedding('ChatMessage', userMsg._id);
      queueEmbedding('ChatMessage', assistantMsg._id);
    })
    .catch((err) => console.error('[chat.routes] failed to persist/embed assistant reply —', err.message));
}));

module.exports = router;
