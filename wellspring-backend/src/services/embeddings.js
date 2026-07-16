const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const MODEL = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';

/**
 * Returns a plain number[] embedding, via Gemini.
 *
 * Switched from OpenAI: Gemini has a genuine free tier for this model (no
 * credit card required — see ai.google.dev/gemini-api/docs/pricing).
 * xAI/Grok does NOT expose a public embeddings endpoint as of this writing
 * (confirmed via their own SDK integration docs), so it isn't an option
 * here even though it is for chat generation in llmProvider.js.
 *
 * gemini-embedding-001 returns 3072-dimensional vectors by default. Make
 * sure EMBEDDING_DIMENSIONS in .env and the vector index definition in
 * scripts/createVectorIndex.js both say 3072 — a mismatch there won't
 * throw an obvious error, queries will just silently return nothing.
 */
async function embedText(text) {
  if (!genAI) throw new Error('GEMINI_API_KEY not configured for embeddings');
  const model = genAI.getGenerativeModel({ model: MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

module.exports = { embedText };
