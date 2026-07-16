const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/asyncHandler');
const JournalEntry = require('../../models/JournalEntry');
const { queueEmbedding } = require('../../workers/taskEmbeddings');

const router = express.Router();

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { content, moodScore } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'content is required' });
  if (moodScore !== undefined && (moodScore < 1 || moodScore > 5)) {
    return res.status(400).json({ error: 'moodScore must be between 1 and 5' });
  }

  const entry = await JournalEntry.create({ userId: req.user.id, content, moodScore });

  // Entries are immutable once saved by product decision (see the journal
  // screen design) — embedding generation happens after the response is
  // sent so saving never waits on it.
  queueEmbedding('JournalEntry', entry._id);

  res.status(201).json(entry);}));

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const entries = await JournalEntry.find({ userId: req.user.id }).sort({ createdAt: -1 });
  res.json(entries);}));

module.exports = router;
