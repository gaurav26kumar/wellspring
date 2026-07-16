const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession', required: true, index: true },
    // Denormalized from the session on write. $vectorSearch filters can only
    // see fields on the document being searched — no $lookup-then-filter —
    // so this needs to live here even though it's also on ChatSession.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    embedding: { type: [Number], select: false },
  },
  { collection: 'chat_messages', timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

chatMessageSchema.index({ sessionId: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
