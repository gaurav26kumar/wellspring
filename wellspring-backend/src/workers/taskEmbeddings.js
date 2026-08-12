const JournalEntry = require('../models/JournalEntry');
const ChatMessage = require('../models/ChatMessage');
const { embedDocument } = require('../services/embeddings');

const MODELS = { JournalEntry, ChatMessage };

/**
 * Fire-and-forget embedding generation for persisted documents.
 *
 * Documents use Gemini's RETRIEVAL_DOCUMENT task type because these vectors
 * will later be searched by RETRIEVAL_QUERY vectors.
 */
function queueEmbedding(modelName, docId) {
  setImmediate(async () => {
    try {
      const Model = MODELS[modelName];
      const doc = await Model.findById(docId);
      if (!doc) return;

      const embedding = await embedDocument(doc.content);
      await Model.updateOne({ _id: docId }, { $set: { embedding } });
    } catch (err) {
      console.error(
        `[taskEmbeddings] failed for ${modelName} ${docId}`,
        err.message
      );
    }
  });
}

module.exports = { queueEmbedding };
