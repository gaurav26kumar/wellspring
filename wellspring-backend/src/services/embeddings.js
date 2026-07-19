const OpenAI = require('openai');

/**
 * Groq's API is OpenAI-SDK-compatible — same client as chat, just a
 * different base URL. nomic-embed-text-v1_5 (note the underscore — that's
 * Groq's exact model ID, different from Nomic's own hosted API which uses
 * a period) outputs 768-dimensional vectors natively. EMBEDDING_DIMENSIONS
 * in .env and scripts/createVectorIndex.js must both say 768 to match.
 */
const groq = process.env.GROQ_API_KEY
  ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
  : null;
const MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text-v1_5';

async function embedText(text) {
  if (!groq) throw new Error('GROQ_API_KEY not configured for embeddings');
  const res = await groq.embeddings.create({ model: MODEL, input: text });
  return res.data[0].embedding;
}

module.exports = { embedText };
