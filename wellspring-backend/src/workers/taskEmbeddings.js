const JournalEntry = require('../models/JournalEntry');
const ChatMessage = require('../models/ChatMessage');
const { embedText } = require('../services/embeddings');

const MODELS = { JournalEntry, ChatMessage };

/**
 * Fire-and-forget from request handlers. This is intentionally simple —
 * a plain async call, not a real queue. Swap this for a proper job queue
 * (Agenda, BullMQ) before this sees production traffic; the important
 * thing to preserve is that request handlers never `await` this.
 */
function queueEmbedding(modelName, docId) {
  setImmediate(async () => {
    try {
      const Model = MODELS[modelName];
      const doc = await Model.findById(docId);
      if (!doc) return;
      const embedding = await embedText(doc.content);
      await Model.updateOne({ _id: docId }, { $set: { embedding } });
    } catch (err) {
      console.error(`[taskEmbeddings] failed for ${modelName} ${docId}`, err.message);
    }
  });
}

module.exports = { queueEmbedding };
