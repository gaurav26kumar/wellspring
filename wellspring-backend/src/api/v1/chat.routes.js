const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/asyncHandler');
const ChatSession = require('../../models/ChatSession');
const ChatMessage = require('../../models/ChatMessage');
const { checkSafety, logSafetyFlag, getFixedSafetyResponse, notifyAdminOfHighRiskFlag } = require('../../services/agents/safetyAgent');
const { retrieveRelevantMemories } = require('../../services/retrieval');
const { runReflectionAgent } = require('../../services/agents/reflectionAgent');
const { queueEmbedding } = require('../../workers/taskEmbeddings');

const router = express.Router();

// Configuration
const MAX_MESSAGE_LENGTH = 5000;
const RETRIEVAL_TIMEOUT = 5000; // 5 seconds timeout for retrieval

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

/**
 * Helper: Create a timeout promise
 */
function createTimeout(ms) {
  return new Promise((_, reject) => 
    setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
  );
}

/**
 * Helper: Persist message with retry logic
 */
async function persistMessageWithRetry(data, maxRetries = 3) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ChatMessage.create(data);
    } catch (err) {
      lastError = err;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // exponential backoff
      }
    }
  }
  throw lastError;
}

router.post('/sessions/:id/message', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const sessionId = req.params.id;
  const { message } = req.body;

  // ---- Input validation ----
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ 
      error: `Message must be under ${MAX_MESSAGE_LENGTH} characters (received ${message.length})` 
    });
  }

  const session = await ChatSession.findOne({ _id: sessionId, userId });
  if (!session) return res.status(404).json({ error: 'Session not found' });

  // ---- 1. Safety Agent — runs first, always. Nothing below this line runs
  // until it has cleared the message. ----
  const safety = await checkSafety({ text: message, userId });

  if (safety.flagged) {
    try {
      const userMsg = await ChatMessage.create({ sessionId, userId, role: 'user', content: message });
      const flagRecord = await logSafetyFlag({ userId, messageId: userMsg._id, severity: safety.severity, reason: safety.reason });
      
      // Notify admin if high-risk flag
      if (safety.severity === 'high') {
        notifyAdminOfHighRiskFlag({ userId, messageId: userMsg._id, flagRecord }).catch(err => 
          console.error('[chat.routes] failed to notify admin of high-risk flag', err.message)
        );
      }

      // The general-purpose LLM never sees this path — the reply is fixed.
      const fixedReply = getFixedSafetyResponse();
      await ChatMessage.create({ sessionId, userId, role: 'assistant', content: fixedReply });

      return res.json({ role: 'assistant', content: fixedReply, safety: true });
    } catch (err) {
      console.error('[chat.routes] safety flag logging failed', err.message);
      return res.status(500).json({ error: 'Failed to process message' });
    }
  }

  // ---- 2. Retrieval — pgvector-equivalent similarity search, scoped to this
  // user only. This depends on Atlas Vector Search indexes existing (see
  // scripts/createVectorIndex.js) and on GEMINI_API_KEY for embeddings. If
  // either isn't set up this throws — caught here so a broken retrieval
  // step degrades the reply instead of hanging the whole request forever. ----
  let memories = [];
  let retrievalFailed = false;
  try {
    memories = await Promise.race([
      retrieveRelevantMemories({ userId, queryText: message }),
      createTimeout(RETRIEVAL_TIMEOUT)
    ]);
  } catch (err) {
    retrievalFailed = true;
    console.error('[chat.routes] retrieval failed, continuing without memories —', err.message);
  }

  // ---- 3. Reflection Agent — builds the prompt, calls the LLM, streams the reply ----
  let userMsg;
  try {
    userMsg = await persistMessageWithRetry({ sessionId, userId, role: 'user', content: message });
  } catch (err) {
    console.error('[chat.routes] failed to persist user message', err.message);
    return res.status(500).json({ error: 'Failed to save your message' });
  }

  let fullReply = '';
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    await runReflectionAgent({ message, memories, sessionId, retrievalFailed }, (chunk) => {
      fullReply += chunk;
      res.write(`data: ${JSON.stringify({ delta: chunk })}

`);
    });
  res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error('[chat.routes] reflection agent failed —', err.message);
    if (!res.headersSent) {
      return res.status(502).json({ error: 'Something went wrong generating a reply.' });
    }
    res.write(`data: ${JSON.stringify({ error: 'Something went wrong generating a reply.' })}

`);
    return res.end();
  }

  // ---- 4. Persist + embed in the background — response is already sent,
  // this should never hold up the user. Implement retry logic and track failures. ----
  persistMessageWithRetry({ sessionId, userId, role: 'assistant', content: fullReply })
    .then((assistantMsg) => {
      // Queue embeddings for both user and assistant messages
      queueEmbedding('ChatMessage', userMsg._id)
        .catch(err => console.error('[chat.routes] failed to queue user message embedding', err.message));
      
      queueEmbedding('ChatMessage', assistantMsg._id)
        .catch(err => console.error('[chat.routes] failed to queue assistant message embedding', err.message));
    })
    .catch((err) => {
      console.error('[chat.routes] failed to persist assistant reply after 3 retries —', err.message);
      // Log to monitoring/alerting system here if available
    });
}));

module.exports = router;
