const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    hashedPassword: { type: String, required: true, select: false },
  },
  { collection: 'users', timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

module.exports = mongoose.model('User', userSchema);
