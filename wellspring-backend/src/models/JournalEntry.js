const mongoose = require('mongoose');

const journalEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, required: true },
    moodScore: { type: Number, min: 1, max: 5 }, // optional — matches the Still..Sparkling 1-5 scale in the UI
    // Hidden by default (select:false) — this array is large and most queries
    // (listing entries, rendering the journal screen) never need it.
    // Retrieval explicitly re-selects it via .select('+embedding').
    embedding: { type: [Number], select: false },
  },
  { collection: 'journal_entries', timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

journalEntrySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('JournalEntry', journalEntrySchema);
