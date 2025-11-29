const User = require('../models/User');

// Store active sessions to prevent conflicts
const activeSessions = new Map();

const authenticate = async (req, res, next) => {
  try {
    let userId;
    let token;
    
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      userId = token.replace('token-', '');
    }
    
    // Fallback to user-id header for backward compatibility
    if (!userId) {
      userId = req.headers['user-id'] || 
               (req.body && req.body.userId) || 
               (req.query && req.query.userId);
    }

    // For socket authentication during file upload
    if (!userId && req.user && req.user.id) {
      userId = req.user.id;
    }

    if (!userId) {
      console.log('❌ No user ID found in request');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(401).json({ error: 'User not found' });
    }

    console.log('✅ User authenticated:', user.username);
    req.user = user;
    
    // Track session
    if (token) {
      activeSessions.set(token, userId);
    }
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Add session cleanup
const cleanupSession = (token) => {
  activeSessions.delete(token);
};

module.exports = { authenticate, cleanupSession, activeSessions };