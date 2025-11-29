const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')

const app = express()
const server = http.createServer(app)

app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST"]
}))

const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
})

// Enhanced user storage
const chatRooms = {
  general: {
    users: [],
    messages: []
  }
}

// Store private conversations
const privateConversations = new Map()

const getUserById = (userId, room = 'general') => {
  return chatRooms[room].users.find(user => user.id === userId)
}

const getUserBySocketId = (socketId) => {
  for (const roomName in chatRooms) {
    const user = chatRooms[roomName].users.find(u => u.socketId === socketId)
    if (user) return { user, room: roomName }
  }
  return null
}

const getUsersInRoom = (room = 'general') => {
  return chatRooms[room].users.map(user => ({ 
    id: user.id, 
    username: user.username,
    socketId: user.socketId
  }))
}

// Generate conversation ID for private messages
const getConversationId = (user1Id, user2Id) => {
  return [user1Id, user2Id].sort().join('_')
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  // FIXED: Accept user object directly, not nested
  socket.on('join', (user) => {
    try {
      console.log('Join event received:', user)
      
      if (!user || !user.id || !user.username) {
        console.error('Invalid user data received:', user)
        socket.emit('error', { message: 'Invalid user data' })
        return
      }
      
      const room = 'general'
      
      socket.join(room)
      
      // Check if user already exists
      const existingUserIndex = chatRooms[room].users.findIndex(u => u.id === user.id)
      if (existingUserIndex !== -1) {
        // Update socketId if user reconnects
        chatRooms[room].users[existingUserIndex].socketId = socket.id
      } else {
        // Add new user
        chatRooms[room].users.push({ 
          ...user, 
          socketId: socket.id,
          room: room
        })
      }

      // Send current users list to all clients
      const usersList = getUsersInRoom(room)
      io.to(room).emit('users', usersList)

      // Send previous messages to the new user
      const previousMessages = chatRooms[room].messages.slice(-50)
      socket.emit('previousMessages', previousMessages)

      // Notify all clients about new user
      socket.to(room).emit('userJoined', {
        user: { id: user.id, username: user.username },
        message: `${user.username} joined the chat`,
        timestamp: new Date()
      })

      console.log(`${user.username} joined room: ${room}`)
      console.log(`Total users online: ${chatRooms[room].users.length}`)
      console.log('Users list:', usersList.map(u => u.username))
    } catch (error) {
      console.error('Error in join event:', error)
      socket.emit('error', { message: 'Join failed' })
    }
  })

  // Handle public message sending
  socket.on('sendMessage', (messageData) => {
    try {
      console.log('Public message received:', messageData)
      
      if (!messageData.user || !messageData.user.id) {
        console.error('Invalid message data:', messageData)
        return
      }

      const user = getUserById(messageData.user.id)
      const room = user?.room || 'general'
      
      // Add message to room
      chatRooms[room].messages.push(messageData)
      
      // Keep only last 100 messages
      if (chatRooms[room].messages.length > 100) {
        chatRooms[room].messages = chatRooms[room].messages.slice(-100)
      }
      
      // Broadcast to all clients in the room
      io.to(room).emit('message', messageData)
      
      console.log(`Public message broadcasted from ${messageData.user.username}: ${messageData.content}`)
    } catch (error) {
      console.error('Error in sendMessage:', error)
    }
  })

  // Handle PRIVATE message sending
  socket.on('sendPrivateMessage', (data) => {
    try {
      console.log('Private message data received:', data)
      
      if (!data || !data.user || !data.user.id) {
        console.error('Invalid private message data:', data)
        socket.emit('error', { message: 'Invalid message data' })
        return
      }

      const { toUserId, message, user } = data
      
      if (!toUserId || !message) {
        console.error('Missing required fields:', { toUserId, message })
        socket.emit('error', { message: 'Missing required fields' })
        return
      }

      // Find receiver
      const allUsers = getUsersInRoom()
      const receiver = allUsers.find(u => u.id === toUserId)
      
      console.log('Looking for receiver:', toUserId)
      console.log('Available users:', allUsers)
      
      if (!receiver) {
        console.error('Receiver not found')
        socket.emit('error', { message: 'User not found or offline' })
        return
      }

      const privateMessage = {
        id: Date.now().toString(),
        from: user,
        to: { id: receiver.id, username: receiver.username },
        content: message,
        timestamp: new Date(),
        type: 'private'
      }

      // Store private message
      const conversationId = getConversationId(user.id, toUserId)
      if (!privateConversations.has(conversationId)) {
        privateConversations.set(conversationId, [])
      }
      privateConversations.get(conversationId).push(privateMessage)

      // Keep only last 50 messages per conversation
      if (privateConversations.get(conversationId).length > 50) {
        privateConversations.get(conversationId).shift()
      }

      // Send to receiver
      io.to(receiver.socketId).emit('privateMessage', privateMessage)
      
      // Also send back to sender (for their own UI)
      socket.emit('privateMessage', privateMessage)

      console.log(`Private message sent from ${user.username} to ${receiver.username}: ${message}`)
    } catch (error) {
      console.error('Error in sendPrivateMessage:', error)
      socket.emit('error', { message: 'Failed to send private message' })
    }
  })

  // Get conversation history
  socket.on('getConversationHistory', (data) => {
    try {
      console.log('Getting conversation history:', data)
      
      if (!data || !data.otherUserId || !data.currentUser) {
        console.error('Invalid conversation history request:', data)
        return
      }

      const { otherUserId, currentUser } = data
      const conversationId = getConversationId(currentUser.id, otherUserId)
      
      const history = privateConversations.get(conversationId) || []
      socket.emit('conversationHistory', {
        otherUserId,
        messages: history
      })
      
      console.log(`Sent ${history.length} messages for conversation ${conversationId}`)
    } catch (error) {
      console.error('Error in getConversationHistory:', error)
    }
  })

  socket.on('disconnect', () => {
    try {
      let disconnectedUser = null
      let userRoom = 'general'
      
      for (const roomName in chatRooms) {
        const userIndex = chatRooms[roomName].users.findIndex(user => user.socketId === socket.id)
        if (userIndex !== -1) {
          disconnectedUser = chatRooms[roomName].users[userIndex]
          chatRooms[roomName].users.splice(userIndex, 1)
          userRoom = roomName
          break
        }
      }
      
      if (disconnectedUser) {
        // Update users list for all clients
        io.to(userRoom).emit('users', getUsersInRoom(userRoom))
        
        // Notify all clients about user leaving
        socket.to(userRoom).emit('userLeft', {
          user: { id: disconnectedUser.id, username: disconnectedUser.username },
          message: `${disconnectedUser.username} left the chat`,
          timestamp: new Date()
        })
        
        console.log(`${disconnectedUser.username} left room: ${userRoom}`)
        console.log(`Remaining users: ${chatRooms[userRoom].users.length}`)
      }
      
      console.log('User disconnected:', socket.id)
    } catch (error) {
      console.error('Error in disconnect:', error)
    }
  })

  // Handle client errors
  socket.on('error', (error) => {
    console.error('Client error:', error)
  })
})

// Health check endpoint
app.get('/api/health', (req, res) => {
  const stats = {}
  
  for (const roomName in chatRooms) {
    stats[roomName] = {
      users: chatRooms[roomName].users.length,
      messages: chatRooms[roomName].messages.length
    }
  }
  
  res.json({ 
    status: 'OK', 
    rooms: stats,
    privateConversations: privateConversations.size,
    totalConnections: io.engine.clientsCount,
    timestamp: new Date().toISOString()
  })
})

// Get all connected users
app.get('/api/users', (req, res) => {
  const allUsers = getUsersInRoom('general')
  res.json(allUsers)
})

const PORT = process.env.PORT || 5000

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`)
  console.log(`👥 Users endpoint: http://localhost:${PORT}/api/users`)
})