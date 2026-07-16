const mongoose = require('mongoose');

const insightSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    summaryText: { type: String, required: true },
    // e.g. [{ theme: 'sleep', count: 4 }, { theme: 'work', count: 2 }]
    themes: { type: [{ theme: String, count: Number }], default: [] },
  },
  { collection: 'insights', timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

module.exports = mongoose.model('Insight', insightSchema);
