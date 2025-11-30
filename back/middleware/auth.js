const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    // Try to get user ID from Authorization header first (Bearer token)
    let userId;
    
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Extract user ID from token (format: "token-{userId}")
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

    // ALWAYS fetch fresh user data from database
    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(401).json({ error: 'User not found' });
    }

    console.log('✅ User authenticated:', user.username);
    
    // Return fresh user data (not cached)
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = { authenticate };