const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Meeting = require('./models/Meeting');
const AIService = require('./services/aiService');
const { authenticate } = require('./middleware/auth');

require('dotenv').config(); // ADD THIS

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT"]
}));
app.use(express.json());

const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Initialize services
User.init();
Meeting.init();
const aiService = new AIService(process.env.AI_API_KEY);

// Enhanced user storage for online users
const onlineUsers = new Map(); // socketId -> user data
const chatRooms = {
  general: {
    messages: []
  }
};

const privateConversations = new Map();

// Utility functions
const getOnlineUsers = () => {
  return Array.from(onlineUsers.values()).map(user => ({
    id: user.id,
    username: user.username,
    bio: user.bio,
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

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
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

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// User profile routes
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

app.put('/api/users/:id', authenticate, async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { bio, username } = req.body;

    if (bio && bio.length > 400) {
      return res.status(400).json({ error: 'Bio must be under 400 characters' });
    }

    const updates = {};
    if (bio !== undefined) updates.bio = bio;
    if (username !== undefined) updates.username = username;

    const updatedUser = await User.update(req.params.id, updates);

    // Update online user if they're connected
    const onlineUserEntry = Array.from(onlineUsers.entries())
      .find(([_, user]) => user.id === req.params.id);
    
    if (onlineUserEntry) {
      const [socketId, userData] = onlineUserEntry;
      onlineUsers.set(socketId, { ...userData, ...updates });
      
      // Notify all clients about user update
      io.emit('users', getOnlineUsers());
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/users/:id/profile-picture', async (req, res) => {
  try {
    const { profilePicture } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { profilePicture },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile picture' });
  }
});

// AI Matching Endpoint
app.post('/api/match-users', authenticate, async (req, res) => {
  try {
    const allUsers = await User.findAll();
    const otherUsers = allUsers.filter(u => u.id !== req.user.id);
    
    const matches = await aiService.analyzeProfilesAndMatch(req.user, otherUsers);
    res.json(matches.matches || matches);
  } catch (error) {
    console.error('Matching error:', error);
    res.status(500).json({ error: 'Matching failed' });
  }
});

// Auto-message Endpoint
app.post('/api/send-icebreaker', authenticate, async (req, res) => {
  try {
    const { toUserId } = req.body;
    const targetUser = await User.findById(toUserId);
    
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const icebreaker = await aiService.generateIcebreaker(req.user, targetUser);
    
    // Send the message via socket
    const receiverEntry = Array.from(onlineUsers.entries())
      .find(([_, user]) => user.id === toUserId);
    
    if (receiverEntry) {
      const [receiverSocketId, receiver] = receiverEntry;
      
      const privateMessage = {
        id: Date.now().toString(),
        from: { id: req.user.id, username: req.user.username },
        to: { id: receiver.id, username: receiver.username },
        content: icebreaker,
        timestamp: new Date(),
        type: 'private',
        isIcebreaker: true
      };

      // Store in private conversations
      const conversationId = [req.user.id, toUserId].sort().join('_');
      if (!privateConversations.has(conversationId)) {
        privateConversations.set(conversationId, []);
      }
      privateConversations.get(conversationId).push(privateMessage);

      // Send to receiver and sender
      io.to(receiverSocketId).emit('privateMessage', privateMessage);
      
      // Also send back to sender
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
      host: { id: req.user.id, username: req.user.username, bio: req.user.bio }
    });
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

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('authenticate', async (userData) => {
    try {
      const user = await User.findById(userData.id);
      if (!user) {
        socket.emit('error', { message: 'User not found' });
        return;
      }

      // Add user to online users
      onlineUsers.set(socket.id, {
        id: user.id,
        username: user.username,
        bio: user.bio,
        socketId: socket.id
      });

      socket.join('general');

      // Send current online users to all clients
      io.emit('users', getOnlineUsers());

      // Send previous messages to the new user
      const previousMessages = chatRooms.general.messages.slice(-50);
      socket.emit('previousMessages', previousMessages);

      // Notify all clients about new user
      socket.broadcast.emit('userJoined', {
        user: { id: user.id, username: user.username },
        message: `${user.username} joined the chat`,
        timestamp: new Date()
      });

      console.log(`${user.username} authenticated and joined chat`);
      console.log(`Total users online: ${onlineUsers.size}`);
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('error', { message: 'Authentication failed' });
    }
  });

  // Handle public message sending
  socket.on('sendMessage', (messageData) => {
    try {
      const user = getUserBySocketId(socket.id);
      if (!user) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const message = {
        ...messageData,
        user: {
          id: user.id,
          username: user.username
        },
        timestamp: new Date()
      };

      // Add message to room
      chatRooms.general.messages.push(message);
      
      // Keep only last 100 messages
      if (chatRooms.general.messages.length > 100) {
        chatRooms.general.messages = chatRooms.general.messages.slice(-100);
      }
      
      // Broadcast to all clients
      io.emit('message', message);
      
      console.log(`Public message from ${user.username}: ${message.content}`);
    } catch (error) {
      console.error('Error in sendMessage:', error);
    }
  });

  // Handle PRIVATE message sending
  socket.on('sendPrivateMessage', (data) => {
    try {
      const sender = getUserBySocketId(socket.id);
      if (!sender) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { toUserId, message } = data;
      
      // Find receiver
      const receiverEntry = Array.from(onlineUsers.entries())
        .find(([_, user]) => user.id === toUserId);
      
      if (!receiverEntry) {
        socket.emit('error', { message: 'User not found or offline' });
        return;
      }

      const [receiverSocketId, receiver] = receiverEntry;

      const privateMessage = {
        id: Date.now().toString(),
        from: { id: sender.id, username: sender.username },
        to: { id: receiver.id, username: receiver.username },
        content: message,
        timestamp: new Date(),
        type: 'private'
      };

      // Store private message
      const conversationId = getConversationId(sender.id, toUserId);
      if (!privateConversations.has(conversationId)) {
        privateConversations.set(conversationId, []);
      }
      privateConversations.get(conversationId).push(privateMessage);

      // Keep only last 50 messages per conversation
      if (privateConversations.get(conversationId).length > 50) {
        privateConversations.get(conversationId).shift();
      }

      // Send to receiver
      io.to(receiverSocketId).emit('privateMessage', privateMessage);
      
      // Also send back to sender
      socket.emit('privateMessage', privateMessage);

      console.log(`Private message from ${sender.username} to ${receiver.username}: ${message}`);
    } catch (error) {
      console.error('Error in sendPrivateMessage:', error);
      socket.emit('error', { message: 'Failed to send private message' });
    }
  });

  // Get conversation history
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

  // Socket Events for Meetings - MOVED INSIDE CONNECTION
  socket.on('joinMeeting', async (data) => {
    try {
      const user = getUserBySocketId(socket.id);
      if (!user) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const meeting = await Meeting.addParticipant(data.meetingId, user);
      if (meeting) {
        // Join meeting room
        socket.join(`meeting_${data.meetingId}`);
        
        // Notify others in meeting
        socket.to(`meeting_${data.meetingId}`).emit('userJoinedMeeting', {
          user,
          meeting
        });

        console.log(`${user.username} joined meeting: ${meeting.title}`);
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

      // Broadcast to all in meeting room
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
        
        // Update users list for all clients
        io.emit('users', getOnlineUsers());
        
        // Notify all clients about user leaving
        io.emit('userLeft', {
          user: { id: user.id, username: user.username },
          message: `${user.username} left the chat`,
          timestamp: new Date()
        });
        
        console.log(`${user.username} left the chat`);
        console.log(`Remaining users online: ${onlineUsers.size}`);
      }
      
      console.log('User disconnected:', socket.id);
    } catch (error) {
      console.error('Error in disconnect:', error);
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    onlineUsers: onlineUsers.size,
    privateConversations: privateConversations.size,
    timestamp: new Date().toISOString()
  });
});

// Get all users (for search)
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

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});