const ChatMessage = require('../../models/ChatMessage');
const { generate } = require('../llmProvider');

const SYSTEM_PROMPT = `You are the reflective companion inside Wellspring, a journaling and \
mental wellness app. Your tone is warm, direct, and unhurried — closer to a thoughtful \
friend with some CBT training than a therapist's intake form.

Ground your replies in what the person actually wrote, and in the memories provided below \
when they're relevant — don't force a connection that isn't there. Ask at most one question \
per reply. Never diagnose. Never give medical or clinical advice. If a memory is referenced, \
say so plainly ("you mentioned this a few days ago") rather than pretending to just know it.

You are never the first or only line of support for acute risk — that path is handled before \
a message ever reaches you.`;

function formatMemories(memories) {
  if (!memories.length) return 'No relevant past entries or messages were retrieved for this message.';
  return memories
    .map((m) => `- [${m.source}, ${new Date(m.createdAt).toLocaleDateString()}] ${m.content}`)
    .join('\n');
}

async function getRecentTurns(sessionId, limit = 8) {
  const turns = await ChatMessage.find({ sessionId }).sort({ createdAt: -1 }).limit(limit).lean();
  return turns.reverse().map((t) => ({ role: t.role, content: t.content }));
}

/**
 * Builds the full prompt (persona + memories + recent turns + new message),
 * calls the LLM provider layer, and streams tokens via onChunk. Returns the
 * full assistant reply once streaming completes so the caller can persist it.
 */
async function runReflectionAgent({ message, memories, sessionId }, onChunk) {
  const recentTurns = await getRecentTurns(sessionId);
  const system = `${SYSTEM_PROMPT}\n\nRelevant memories:\n${formatMemories(memories)}`;
  const messages = [...recentTurns, { role: 'user', content: message }];

  return generate({ system, messages, stream: true, onChunk });
}

module.exports = { runReflectionAgent };
