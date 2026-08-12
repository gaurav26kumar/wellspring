/**
 * Gemini embeddings for Wellspring RAG.
 *
 * Chat / reasoning stays on Groq. Embeddings are generated through the
 * Gemini Embedding API so the project does not depend on OpenAI for vectors.
 *
 * We use gemini-embedding-001 with 768 dimensions to match the existing
 * MongoDB Atlas Vector Search indexes.
 *
 * IMPORTANT: retrieval queries and stored documents use different Gemini
 * task types for better semantic retrieval quality:
 *   - RETRIEVAL_QUERY for user search/chat queries
 *   - RETRIEVAL_DOCUMENT for journal/chat documents being indexed
 */

const MODEL = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
const DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS || 768);
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent`;

const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured for embeddings');
  }
  return apiKey;
}

function validateConfig() {
  if (!Number.isInteger(DIMENSIONS) || DIMENSIONS <= 0) {
    throw new Error(
      `Invalid EMBEDDING_DIMENSIONS: ${process.env.EMBEDDING_DIMENSIONS}`
    );
  }
}

async function embedText(text, taskType = 'RETRIEVAL_QUERY') {
  validateConfig();

  if (!text || !text.trim()) {
    throw new Error('Cannot generate embedding for empty text');
  }

  const apiKey = getApiKey();

  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          content: {
            parts: [{ text }],
          },
          taskType,
          outputDimensionality: DIMENSIONS,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          payload?.error?.message ||
          `Gemini embedding request failed with HTTP ${response.status}`;

        const error = new Error(message);
        error.status = response.status;
        error.code = payload?.error?.status || payload?.error?.code;

        // Retry transient quota/server failures. Do not retry 400/401/403/404.
        if (
          (response.status === 429 || response.status >= 500) &&
          attempt < MAX_RETRIES
        ) {
          lastError = error;
          await sleep(500 * 2 ** (attempt - 1));
          continue;
        }

        throw error;
      }

      const embedding = payload?.embedding?.values;

      if (!Array.isArray(embedding)) {
        throw new Error('Gemini embedding response contained no vector');
      }

      if (embedding.length !== DIMENSIONS) {
        throw new Error(
          `Embedding dimension mismatch: expected ${DIMENSIONS}, received ${embedding.length}`
        );
      }

      return embedding;
    } catch (err) {
      lastError = err;

      // Network errors are retryable.
      if (attempt < MAX_RETRIES && !err.status) {
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error('Gemini embedding request failed');
}

async function embedQuery(text) {
  return embedText(text, 'RETRIEVAL_QUERY');
}

async function embedDocument(text) {
  return embedText(text, 'RETRIEVAL_DOCUMENT');
}

module.exports = {
  embedText,
  embedQuery,
  embedDocument,
};
