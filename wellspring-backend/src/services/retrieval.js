const mongoose = require('mongoose');
const JournalEntry = require('../models/JournalEntry');
const ChatMessage = require('../models/ChatMessage');
const { embedQuery } = require('./embeddings');

/**
 * Retrieve semantically relevant memories from the user's own journal
 * entries and chat messages.
 *
 * Retrieval is deliberately fail-soft: if Gemini embeddings or MongoDB
 * Vector Search is temporarily unavailable, the caller gets an empty
 * memory set instead of the entire chat request crashing.
 */
async function retrieveRelevantMemories({ userId, queryText, limit = 5 }) {
  try {
    const queryVector = await embedQuery(queryText);
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
  } catch (err) {
    console.error('[retrieval] memory retrieval failed:', err.message);

    // RAG failure should not kill the conversation. The reflection agent can
    // still answer using the current message and conversation context.
    return [];
  }
}

module.exports = { retrieveRelevantMemories };
