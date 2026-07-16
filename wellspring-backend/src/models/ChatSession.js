const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'New chat' },
    startedAt: { type: Date, default: Date.now },
  },
  { collection: 'chat_sessions' }
);

module.exports = mongoose.model('ChatSession', chatSessionSchema);
