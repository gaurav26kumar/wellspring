const mongoose = require('mongoose');

/**
 * safety_flags — logged whenever the Safety Agent intercepts a message.
 *
 * Treat this collection as sensitive. It is evidence of someone's worst
 * moments, not ordinary telemetry. Two things to decide deliberately,
 * on purpose, before this ever touches real users — not by default:
 *
 *   1. ACCESS — who can query this collection. It should not be readable
 *      by general application code paths, only by a narrow admin/review
 *      surface with its own auth check (see middleware/auth.js — this
 *      model is intentionally not exposed by any CRUD route in api/v1).
 *
 *   2. RETENTION — how long a flag is kept once resolved. A commented-out
 *      TTL index is below as a starting point, not a default. Pick a
 *      retention window on purpose, with legal/clinical input if this
 *      goes anywhere near real users, then uncomment and set it.
 */
const safetyFlagSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage', default: null },
    severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
    reason: { type: String }, // 'keyword_pattern' | 'model_classification'
    resolved: { type: Boolean, default: false },
  },
  { collection: 'safety_flags', timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// Example only — uncomment once a retention period has been deliberately chosen.
// safetyFlagSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });

module.exports = mongoose.model('SafetyFlag', safetyFlagSchema);
