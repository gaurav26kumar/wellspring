const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing or malformed Authorization header' });

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }
    
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub };
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' 
      ? 'Token has expired' 
      : err.name === 'JsonWebTokenError'
      ? 'Invalid token'
      : 'Authentication failed';
    
    return res.status(401).json({ error: message });
  }
}

module.exports = { requireAuth };
