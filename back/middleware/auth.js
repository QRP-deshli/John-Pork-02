const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    // Try to get user ID from various sources
    let userId = req.headers['user-id'] || 
                 (req.body && req.body.userId) || 
                 (req.query && req.query.userId);

    // For socket authentication during file upload
    if (!userId && req.user && req.user.id) {
      userId = req.user.id;
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = { authenticate };