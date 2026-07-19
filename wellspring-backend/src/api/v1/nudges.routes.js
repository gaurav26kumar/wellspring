const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const Nudge = require('../../models/Nudge');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const nudges = await Nudge.find({ userId: req.user.id, status: { $in: ['pending', 'sent'] } }).sort({ createdAt: -1 });
  res.json(nudges);
});

router.patch('/:id', requireAuth, async (req, res) => {
  const { status } = req.body; // 'sent' | 'dismissed'
  if (!['sent', 'dismissed'].includes(status)) return res.status(400).json({ error: 'invalid status' });

  const nudge = await Nudge.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { status },
    { new: true }
  );
  if (!nudge) return res.status(404).json({ error: 'Nudge not found' });
  res.json(nudge);
});

module.exports = router;
