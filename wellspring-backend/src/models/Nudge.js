const mongoose = require('mongoose');

const nudgeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    triggerReason: { type: String, required: true }, // e.g. "theme:sleep x4 in 6 entries"
    message: { type: String, required: true },
    status: { type: String, enum: ['pending', 'sent', 'dismissed'], default: 'pending' },
  },
  { collection: 'nudges', timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

module.exports = mongoose.model('Nudge', nudgeSchema);
