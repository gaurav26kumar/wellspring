const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { requireAuth } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/asyncHandler');

const router = express.Router();

// Validate JWT_SECRET at module load
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// Input validation helper
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password) {
  return password && password.length >= 8;
}

router.post('/register', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  // Input validation
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  if (!validateEmail(email.toLowerCase())) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }
  
  if (!validatePassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.create({ email: email.toLowerCase(), hashedPassword });

  res.status(201).json({ 
    token: signToken(user._id), 
    user: { id: user._id, email: user.email } 
  });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  const user = await User.findOne({ email: (email || '').toLowerCase() }).select('+hashedPassword');
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password || '', user.hashedPassword);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  res.json({ 
    token: signToken(user._id), 
    user: { id: user._id, email: user.email } 
  });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user._id, email: user.email });
}));

module.exports = router;
