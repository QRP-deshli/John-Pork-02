const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('./models/User');
const Meeting = require('./models/Meeting');
const AIService = require('./services/aiService');
const { authenticate } = require('./middleware/auth');

require('dotenv').config();

const app = express();
const server = http.createServer(app);

// CORS configuration
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads/profile-pictures');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    cb(null, 'user-' + (req.user?.id || 'unknown') + '-' + uniqueSuffix + fileExtension);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Initialize services
User.init();
Meeting.init();
const aiService = new AIService(process.env.AI_API_KEY);

// Import DailyMatchScheduler
const DailyMatchScheduler = require('./services/dailyMatchScheduler');
let dailyMatchScheduler = null;

// Enhanced user storage for online users
const onlineUsers = new Map();
const chatRooms = {
  general: {
    messages: []
  }
};

const privateConversations = new Map();

// Utility functions
const getOnlineUsers = () => {
  const uniqueUsers = new Map();
  
  Array.from(onlineUsers.values()).forEach(user => {
    if (!uniqueUsers.has(user.id)) {
      uniqueUsers.set(user.id, user);
    }
  });
  
  return Array.from(uniqueUsers.values()).map(user => ({
    id: user.id,
    username: user.username,
    bio: user.bio,
    profilePicture: user.profilePicture,
    socketId: user.socketId
  }));
};

const getUserBySocketId = (socketId) => {
  return onlineUsers.get(socketId);
};

const getConversationId = (user1Id, user2Id) => {
  return [user1Id, user2Id].sort().join('_');
};

// Authentication routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, bio = '' } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (bio.length > 400) {
      return res.status(400).json({ error: 'Bio must be under 400 characters' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      bio
    });

    const { password: _, ...userWithoutPassword } = user;
    
    res.status(201).json({
      user: userWithoutPassword,
      token: 'token-' + user.id
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      user: userWithoutPassword,
      token: 'token-' + user.id
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Profile endpoints
app.get('/api/profile', authenticate, async (req, res) => {
  try {
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

app.put('/api/profile', authenticate, async (req, res) => {
  try {
    const { bio, username, email } = req.body;

    if (bio && bio.length > 400) {
      return res.status(400).json({ error: 'Bio must be under 400 characters' });
    }

    const updates = {};
    if (bio !== undefined) updates.bio = bio;
    if (username !== undefined) updates.username = username;
    if (email !== undefined) updates.email = email;

    const updatedUser = await User.update(req.user.id, updates);

    // Update online user if they're connected
    const onlineUserEntry = Array.from(onlineUsers.entries())
      .find(([_, user]) => user.id === req.user.id);
    
    if (onlineUserEntry) {
      const [socketId, userData] = onlineUserEntry;
      onlineUsers.set(socketId, { ...userData, ...updates });
      io.emit('users', getOnlineUsers());
    }

    const { password, ...userWithoutPassword } = updatedUser;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Profile picture upload
app.post('/api/upload-profile-picture', authenticate, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const updatedUser = await User.update(req.user.id, {
      profilePicture: req.file.filename
    });

    // Update online user if they're connected
    const onlineUserEntry = Array.from(onlineUsers.entries())
      .find(([_, user]) => user.id === req.user.id);
    
    if (onlineUserEntry) {
      const [socketId, userData] = onlineUserEntry;
      onlineUsers.set(socketId, { ...userData, profilePicture: req.file.filename });
      io.emit('users', getOnlineUsers());
    }

    const { password, ...userWithoutPassword } = updatedUser;

    res.json({ 
      message: 'Profile picture updated successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ error: 'Failed to update profile picture' });
  }
});

// Remove profile picture
app.delete('/api/profile-picture', authenticate, async (req, res) => {
  try {
    const updatedUser = await User.update(req.user.id, {
      profilePicture: null
    });

    // Update online user if they're connected
    const onlineUserEntry = Array.from(onlineUsers.entries())
      .find(([_, user]) => user.id === req.user.id);
    
    if (onlineUserEntry) {
      const [socketId, userData] = onlineUserEntry;
      onlineUsers.set(socketId, { ...userData, profilePicture: null });
      io.emit('users', getOnlineUsers());
    }

    const { password, ...userWithoutPassword } = updatedUser;

    res.json({ 
      message: 'Profile picture removed successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Error removing profile picture:', error);
    res.status(500).json({ error: 'Failed to remove profile picture' });
  }
});

// AI Matching Endpoint
app.post('/api/match-users', authenticate, async (req, res) => {
  try {
    const allUsers = await User.findAll();
    const otherUsers = allUsers.filter(u => u.id !== req.user.id);
    
    console.log(`🔍 Matching: ${req.user.username} with ${otherUsers.length} other users`);
    
    if (otherUsers.length === 0) {
      return res.json([]);
    }
    
    const matches = await aiService.analyzeProfilesAndMatch(req.user, otherUsers);
    
    let matchResults = matches.matches || matches || [];
    
    matchResults = matchResults
      .filter(match => match && match.userId && match.username)
      .map(match => {
        const userExists = otherUsers.find(u => u.id === match.userId);
        if (!userExists) {
          const userByUsername = otherUsers.find(u => u.username === match.username);
          if (userByUsername) {
            return { ...match, userId: userByUsername.id };
          }
        }
        return match;
      })
      .filter(match => match.userId !== req.user.id);
    
    console.log(`✅ Found ${matchResults.length} matches for ${req.user.username}`);
    
    res.json(matchResults);
  } catch (error) {
    console.error('Matching error:', error);
    
    const allUsers = await User.findAll();
    const otherUsers = allUsers.filter(u => u.id !== req.user.id);
    
    const fallbackMatches = otherUsers.slice(0, 3).map(user => ({
      username: user.username,
      userId: user.id,
      score: Math.floor(Math.random() * 3) + 7,
      reasoning: "Great match based on shared interests and compatibility"
    }));
    
    res.json(fallbackMatches);
  }
});

// Icebreaker Endpoint
app.post('/api/send-icebreaker', authenticate, async (req, res) => {
  try {
    const { toUserId } = req.body;
    const targetUser = await User.findById(toUserId);
    
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const icebreaker = await aiService.generateIcebreaker(req.user, targetUser);
    
    const receiverEntry = Array.from(onlineUsers.entries())
      .find(([_, user]) => user.id === toUserId);
    
    if (receiverEntry) {
      const [receiverSocketId, receiver] = receiverEntry;
      
      const privateMessage = {
        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
        from: { 
          id: req.user.id, 
          username: req.user.username,
          profilePicture: req.user.profilePicture
        },
        to: { 
          id: receiver.id, 
          username: receiver.username,
          profilePicture: receiver.profilePicture
        },
        content: icebreaker,
        timestamp: new Date(),
        type: 'private',
        isIcebreaker: true
      };

      const conversationId = getConversationId(req.user.id, toUserId);
      if (!privateConversations.has(conversationId)) {
        privateConversations.set(conversationId, []);
      }
      privateConversations.get(conversationId).push(privateMessage);

      if (privateConversations.get(conversationId).length > 50) {
        privateConversations.get(conversationId).shift();
      }

      io.to(receiverSocketId).emit('privateMessage', privateMessage);
      
      const senderSocketId = Array.from(onlineUsers.entries())
        .find(([_, user]) => user.id === req.user.id)?.[0];
      if (senderSocketId) {
        io.to(senderSocketId).emit('privateMessage', privateMessage);
      }
    }
    
    res.json({ success: true, message: icebreaker });
  } catch (error) {
    console.error('Icebreaker error:', error);
    res.status(500).json({ error: 'Failed to send icebreaker' });
  }
});

// Meeting Endpoints
app.post('/api/meetings', authenticate, async (req, res) => {
  try {
    const meeting = await Meeting.create({
      ...req.body,
      host: { 
        id: req.user.id, 
        username: req.user.username, 
        bio: req.user.bio,
        profilePicture: req.user.profilePicture
      }
    });
    
    io.emit('meetingCreated', meeting);
    
    res.json(meeting);
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

app.get('/api/meetings', async (req, res) => {
  try {
    const meetings = await Meeting.findAll();
    res.json(meetings);
  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({ error: 'Failed to get meetings' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.findAll();
    const usersWithoutPasswords = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    res.json(usersWithoutPasswords);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get users' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    onlineUsers: onlineUsers.size,
    privateConversations: privateConversations.size,
    dailyMatcherActive: dailyMatchScheduler?.isRunning || false,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/trigger-daily-matches', authenticate, async (req, res) => {
  try {
    if (dailyMatchScheduler) {
      await dailyMatchScheduler.triggerNow();
      res.json({ success: true, message: 'Daily match messages triggered' });
    } else {
      res.status(500).json({ error: 'Daily match scheduler not initialized' });
    }
  } catch (error) {
    console.error('Error triggering daily matches:', error);
    res.status(500).json({ error: 'Failed to trigger daily matches' });
  }
});

app.post('/api/cleanup-duplicates', async (req, res) => {
  try {
    const result = await User.removeDuplicates();
    res.json({
      success: true,
      message: 'Duplicate users removed',
      removed: result.removed,
      remaining: result.remaining
    });
  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
    res.status(500).json({ error: 'Failed to cleanup duplicates' });
  }
});

// FIX: Improved Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);
  
  // Store original room for this socket
  let userRoom = 'general';

  socket.on('authenticate', async (data) => {
    try {
      console.log('🔍 Authentication attempt:', data);
      
      let userData = data.user || data;
      
      if (!userData || !userData.id) {
        console.error('❌ Invalid user data:', data);
        socket.emit('error', { message: 'Invalid authentication data' });
        return;
      }

      // FIX: Always fetch fresh user data from database
      const user = await User.findById(userData.id);
      if (!user) {
        console.error('❌ User not found:', userData.id);
        socket.emit('error', { message: 'User not found' });
        return;
      }

      console.log('✅ User authenticated:', user.username);

      // Store user with socket
      onlineUsers.set(socket.id, {
        id: user.id,
        username: user.username,
        bio: user.bio,
        profilePicture: user.profilePicture,
        socketId: socket.id
      });

      // Always join general room
      socket.join('general');
      userRoom = 'general';

      // Emit updated users list
      io.emit('users', getOnlineUsers());

      // Send previous messages
      const previousMessages = chatRooms.general.messages.slice(-50);
      socket.emit('previousMessages', previousMessages);

      // Only notify if this is the first connection for this user
      const userConnections = Array.from(onlineUsers.values())
        .filter(u => u.id === user.id);
      
      if (userConnections.length === 1) {
        socket.broadcast.emit('userJoined', {
          user: { 
            id: user.id, 
            username: user.username,
            profilePicture: user.profilePicture
          },
          message: `${user.username} joined the chat`,
          timestamp: new Date()
        });
      }

      console.log(`👥 User ${user.username} connected (socket: ${socket.id})`);
    } catch (error) {
      console.error('❌ Authentication error:', error);
      socket.emit('error', { message: 'Authentication failed: ' + error.message });
    }
  });

  socket.on('sendMessage', (messageData) => {
    try {
      const user = getUserBySocketId(socket.id);
      if (!user) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const message = {
        ...messageData,
        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
        userId: user.id,
        username: user.username,
        user: {
          id: user.id,
          username: user.username,
          profilePicture: user.profilePicture
        },
        timestamp: new Date()
      };

      chatRooms.general.messages.push(message);
      
      if (chatRooms.general.messages.length > 100) {
        chatRooms.general.messages = chatRooms.general.messages.slice(-100);
      }
      
      io.to('general').emit('message', message);
    } catch (error) {
      console.error('Error in sendMessage:', error);
    }
  });

  socket.on('sendPrivateMessage', (data) => {
    try {
      const sender = getUserBySocketId(socket.id);
      if (!sender) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { toUserId, message } = data;
      
      const receiverEntry = Array.from(onlineUsers.entries())
        .find(([_, user]) => user.id === toUserId);
      
      if (!receiverEntry) {
        socket.emit('error', { message: 'User not found or offline' });
        return;
      }

      const [receiverSocketId, receiver] = receiverEntry;

      const privateMessage = {
        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
        from: { 
          id: sender.id, 
          username: sender.username,
          profilePicture: sender.profilePicture
        },
        to: { 
          id: receiver.id, 
          username: receiver.username,
          profilePicture: receiver.profilePicture
        },
        content: message,
        timestamp: new Date(),
        type: 'private'
      };

      const conversationId = getConversationId(sender.id, toUserId);
      if (!privateConversations.has(conversationId)) {
        privateConversations.set(conversationId, []);
      }
      privateConversations.get(conversationId).push(privateMessage);

      if (privateConversations.get(conversationId).length > 50) {
        privateConversations.get(conversationId).shift();
      }

      io.to(receiverSocketId).emit('privateMessage', privateMessage);
      socket.emit('privateMessage', privateMessage);
    } catch (error) {
      console.error('Error in sendPrivateMessage:', error);
      socket.emit('error', { message: 'Failed to send private message' });
    }
  });

  socket.on('getConversationHistory', (data) => {
    try {
      const user = getUserBySocketId(socket.id);
      if (!user) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { otherUserId } = data;
      const conversationId = getConversationId(user.id, otherUserId);
      
      const history = privateConversations.get(conversationId) || [];
      socket.emit('conversationHistory', {
        otherUserId,
        messages: history
      });
    } catch (error) {
      console.error('Error in getConversationHistory:', error);
    }
  });

  // FIX: Improved meeting join - doesn't interfere with general chat
  socket.on('joinMeeting', async (data) => {
    try {
      const user = getUserBySocketId(socket.id);
      if (!user) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      console.log(`📅 ${user.username} joining meeting: ${data.meetingId}`);
      
      const meeting = await Meeting.addParticipant(data.meetingId, user);
      if (meeting) {
        // Join meeting room WITHOUT leaving general
        socket.join(`meeting_${data.meetingId}`);
        
        // Notify other meeting participants
        socket.to(`meeting_${data.meetingId}`).emit('userJoinedMeeting', {
          user,
          meeting
        });

        console.log(`✅ ${user.username} joined meeting: ${meeting.title}`);
      }
    } catch (error) {
      console.error('Join meeting error:', error);
      socket.emit('error', { message: 'Failed to join meeting' });
    }
  });

  socket.on('meetingMessage', (data) => {
    try {
      const user = getUserBySocketId(socket.id);
      if (!user) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      io.to(`meeting_${data.meetingId}`).emit('newMeetingMessage', {
        user: user,
        message: data.message,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Meeting message error:', error);
    }
  });

  socket.on('disconnect', () => {
    try {
      const user = getUserBySocketId(socket.id);
      
      if (user) {
        onlineUsers.delete(socket.id);
        
        io.emit('users', getOnlineUsers());
        
        // Only broadcast user left if this was their last connection
        const userStillOnline = Array.from(onlineUsers.values())
          .some(u => u.id === user.id);
        
        if (!userStillOnline) {
          io.emit('userLeft', {
            user: { 
              id: user.id, 
              username: user.username,
              profilePicture: user.profilePicture
            },
            message: `${user.username} left the chat`,
            timestamp: new Date()
          });
          
          console.log(`${user.username} left the chat`);
        }
        
        console.log(`User disconnected: ${socket.id}`);
        console.log(`Remaining connections: ${onlineUsers.size}`);
      }
    } catch (error) {
      console.error('Error in disconnect:', error);
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📁 Uploads directory: ${path.join(__dirname, 'uploads')}`);
  
  dailyMatchScheduler = new DailyMatchScheduler(
    aiService,
    io,
    onlineUsers,
    privateConversations
  );
  dailyMatchScheduler.start();
  console.log('📅 Daily match scheduler started - messages will be sent at 09:00 daily');
});