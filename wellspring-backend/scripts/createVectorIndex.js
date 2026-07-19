/**
 * Creates the Atlas Vector Search indexes that services/retrieval.js queries
 * against. This is the Mongo equivalent of `CREATE INDEX ... USING ivfflat`
 * in the original pgvector plan — but vector search indexes on Atlas are
 * "Search" indexes, not regular Mongo indexes, so they're created through
 * this API (or the Atlas UI / `atlas` CLI) rather than mongoose's
 * `schema.index()`.
 *
 * Requires an Atlas cluster (Vector Search is available even on the free
 * M0 tier) — this will not work against a self-hosted/local mongod.
 *
 * Run once: node scripts/createVectorIndex.js
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

const DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS || 768);

const INDEXES = [
  {
    collection: 'journal_entries',
    name: 'journal_entries_vector_index',
  },
  {
    collection: 'chat_messages',
    name: 'chat_messages_vector_index',
  },
];

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set — check your .env');

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  for (const { collection, name } of INDEXES) {
    try {
      // Vector Search indexes can only attach to a collection that already
      // physically exists. On a brand-new database, Mongoose hasn't created
      // journal_entries/chat_messages yet — nothing's been written to them —
      // so create them explicitly first. Harmless no-op if they already exist.
      const existing = await db.listCollections({ name: collection }).toArray();
      if (existing.length === 0) {
        await db.createCollection(collection);
        console.log(`  (created empty collection: ${collection})`);
      }

      const definition = {
        fields: [
          { type: 'vector', path: 'embedding', numDimensions: DIMENSIONS, similarity: 'cosine' },
          { type: 'filter', path: 'userId' },
        ],
      };

      try {
        await db.collection(collection).createSearchIndex({ name, type: 'vectorSearch', definition });
        console.log(`✓ created ${name} on ${collection}`);
      } catch (err) {
        // Switching embedding providers (different dimension count) after
        // already running this once used to just fail here with "already
        // defined" — update the existing index in place instead of
        // requiring a manual delete in the Atlas UI first.
        if (/already defined|already exists/i.test(err.message)) {
          await db.collection(collection).updateSearchIndex(name, definition);
          console.log(`✓ updated existing ${name} on ${collection} (new definition — e.g. dimension count changed)`);
        } else {
          throw err;
        }
      }
    } catch (err) {
      console.error(`✗ failed to create ${name} on ${collection}:`, err.message);
    }
  }

  console.log('\nIndexes build (or rebuild, if updated) in the background on Atlas — check status ' +
    'in the Atlas UI (Search tab) before running queries against them; they are not immediately queryable.');

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
