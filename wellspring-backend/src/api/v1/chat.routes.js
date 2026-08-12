const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const ChatSession = require('../../models/ChatSession');
const ChatMessage = require('../../models/ChatMessage');
const { checkSafety, logSafetyFlag, getFixedSafetyResponse } = require('../../services/agents/safetyAgent');
const { retrieveRelevantMemories } = require('../../services/retrieval');
const { runReflectionAgent } = require('../../services/agents/reflectionAgent');
const { queueEmbedding } = require('../../workers/taskEmbeddings');

const router = express.Router();

router.post('/sessions', requireAuth, async (req, res) => {
  const session = await ChatSession.create({ userId: req.user.id, title: req.body.title || 'New chat' });
  res.status(201).json(session);
});

router.get('/sessions/:id', requireAuth, async (req, res) => {
  const session = await ChatSession.findOne({ _id: req.params.id, userId: req.user.id });
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const messages = await ChatMessage.find({ sessionId: session._id }).sort({ createdAt: 1 });
  res.json({ session, messages });
});

router.post('/sessions/:id/message', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const sessionId = req.params.id;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const session = await ChatSession.findOne({ _id: sessionId, userId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // ---- 1. Safety Agent — runs first, always. ----
    const safety = await checkSafety({ text: message, userId });

    if (safety.flagged) {
      const userMsg = await ChatMessage.create({
        sessionId,
        userId,
        role: 'user',
        content: message,
      });

      await logSafetyFlag({
        userId,
        messageId: userMsg._id,
        severity: safety.severity,
        reason: safety.reason,
      });

      const fixedReply = getFixedSafetyResponse();

      await ChatMessage.create({
        sessionId,
        userId,
        role: 'assistant',
        content: fixedReply,
      });

      return res.json({ role: 'assistant', content: fixedReply, safety: true });
    }

    // ---- 2. Retrieval — fail-soft if Gemini/Atlas is temporarily unavailable. ----
    const memories = await retrieveRelevantMemories({
      userId,
      queryText: message,
    });

    // ---- 3. Save user message before starting the stream. ----
    const userMsg = await ChatMessage.create({
      sessionId,
      userId,
      role: 'user',
      content: message,
    });

    // ---- 4. Reflection Agent — build prompt, call Groq, stream reply. ----
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let fullReply = '';

    try {
      await runReflectionAgent({ message, memories, sessionId }, (chunk) => {
        fullReply += chunk;
        res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
      });
    } catch (err) {
      console.error('[chat.routes] reflection agent failed', err.message);
      res.write(
        `data: ${JSON.stringify({
          error: 'Something went wrong generating a reply.',
        })}\n\n`
      );
      return res.end();
    }

    res.write('data: [DONE]\n\n');
    res.end();

    // ---- 5. Persist + embed in the background. ----
    try {
      const assistantMsg = await ChatMessage.create({
        sessionId,
        userId,
        role: 'assistant',
        content: fullReply,
      });

      queueEmbedding('ChatMessage', userMsg._id);
      queueEmbedding('ChatMessage', assistantMsg._id);
    } catch (err) {
      console.error(
        '[chat.routes] failed to persist assistant message',
        err.message
      );
    }
  } catch (err) {
    console.error('[chat.routes] request failed', err);

    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Unable to process chat message',
      });
    }

    res.end();
  }
});

module.exports = router;
