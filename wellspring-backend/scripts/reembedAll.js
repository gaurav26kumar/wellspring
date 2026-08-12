require('dotenv').config();

const mongoose = require('mongoose');
const JournalEntry = require('../src/models/JournalEntry');
const ChatMessage = require('../src/models/ChatMessage');
const { embedDocument } = require('../src/services/embeddings');

const BATCH_DELAY_MS = Number(process.env.REEMBED_DELAY_MS || 150);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reembedModel(Model, name) {
  const docs = await Model.find({}).select('_id content');

  console.log(`[reembed] ${name}: ${docs.length} documents`);

  let success = 0;
  let failed = 0;

  for (const doc of docs) {
    try {
      const embedding = await embedDocument(doc.content);

      await Model.updateOne(
        { _id: doc._id },
        { $set: { embedding } }
      );

      success += 1;
      console.log(`[reembed] ${name} ${doc._id} ✓`);
    } catch (err) {
      failed += 1;
      console.error(
        `[reembed] ${name} ${doc._id} ✗ ${err.message}`
      );
    }

    if (BATCH_DELAY_MS > 0) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(
    `[reembed] ${name}: ${success} succeeded, ${failed} failed`
  );
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[reembed] connected to MongoDB');

  await reembedModel(JournalEntry, 'JournalEntry');
  await reembedModel(ChatMessage, 'ChatMessage');

  await mongoose.disconnect();
  console.log('[reembed] complete');
}

main().catch((err) => {
  console.error('[reembed] failed:', err);
  process.exit(1);
});
