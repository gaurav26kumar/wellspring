const mongoose = require('mongoose');
const JournalEntry = require('../models/JournalEntry');
const ChatMessage = require('../models/ChatMessage');
const { embedText } = require('./embeddings');

/**
 * Equivalent of the pgvector similarity search in the original plan, using
 * MongoDB Atlas Vector Search ($vectorSearch) instead. Requires the indexes
 * created by scripts/createVectorIndex.js to already exist.
 *
 * The `filter` on userId is not optional — it's what keeps retrieval scoped
 * to one person's own data. Never drop it, even for a "just testing" query.
 */
async function retrieveRelevantMemories({ userId, queryText, limit = 5 }) {
  const queryVector = await embedText(queryText);
  const uid = new mongoose.Types.ObjectId(userId);

  const [journalHits, messageHits] = await Promise.all([
    JournalEntry.aggregate([
      {
        $vectorSearch: {
          index: 'journal_entries_vector_index',
          path: 'embedding',
          queryVector,
          numCandidates: 100,
          limit,
          filter: { userId: uid },
        },
      },
      {
        $project: {
          _id: 1,
          content: 1,
          moodScore: 1,
          createdAt: 1,
          source: { $literal: 'journal' },
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]),
    ChatMessage.aggregate([
      {
        $vectorSearch: {
          index: 'chat_messages_vector_index',
          path: 'embedding',
          queryVector,
          numCandidates: 100,
          limit,
          filter: { userId: uid },
        },
      },
      {
        $project: {
          _id: 1,
          content: 1,
          createdAt: 1,
          source: { $literal: 'chat' },
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]),
  ]);

  return [...journalHits, ...messageHits]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { retrieveRelevantMemories };
