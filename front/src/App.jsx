import React, { useState, useEffect, useRef } from 'react'
import io from 'socket.io-client'
import { 
  Send, 
  Users, 
  Menu, 
  LogOut, 
  Smile,
  Paperclip,
  Mic,
  MessageCircle,
  X
} from 'lucide-react'
import './App.css'

const App = () => {
  const [socket, setSocket] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [user, setUser] = useState(null)
  const [users, setUsers] = useState([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  
  // Private messaging states
  const [privateMessages, setPrivateMessages] = useState([])
  const [activePrivateChat, setActivePrivateChat] = useState(null)
  const [privateMessageInput, setPrivateMessageInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [typingUser, setTypingUser] = useState(null)

  const messagesEndRef = useRef(null)
  const privateMessagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const scrollPrivateToBottom = () => {
    privateMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    scrollPrivateToBottom()
  }, [privateMessages])

  useEffect(() => {
    const username = prompt('Enter your username:') || `User${Math.floor(Math.random() * 1000)}`
    const newUser = { 
      id: Date.now().toString(), 
      username: username 
    }
    setUser(newUser)

    const newSocket = io('http://localhost:5000')
    setSocket(newSocket)

    // Join with user object directly (not nested)
    newSocket.emit('join', newUser)

    // Public message listeners
    newSocket.on('message', (message) => {
      console.log('New message received:', message)
      setMessages(prev => [...prev, message])
    })

    newSocket.on('users', (usersList) => {
      console.log('Users list updated:', usersList)
      setUsers(usersList)
    })

    newSocket.on('userJoined', (data) => {
      console.log('User joined:', data)
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'system',
        content: `${data.user.username} joined the chat`,
        timestamp: new Date()
      }])
    })

    newSocket.on('userLeft', (data) => {
      console.log('User left:', data)
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'system',
        content: `${data.user.username} left the chat`,
        timestamp: new Date()
      }])
    })

    newSocket.on('previousMessages', (previousMessages) => {
      console.log('Previous messages loaded:', previousMessages)
      setMessages(prev => [...prev, ...previousMessages])
    })

    // Private message listeners
    newSocket.on('privateMessage', (message) => {
      console.log('Private message received:', message)
      setPrivateMessages(prev => [...prev, message])
    })

    newSocket.on('conversationHistory', (data) => {
      console.log('Conversation history received:', data)
      setPrivateMessages(data.messages || [])
    })

    newSocket.on('error', (error) => {
      console.error('Socket error:', error)
      alert(`Error: ${error.message}`)
    })

    return () => {
      newSocket.close()
    }
  }, [])

  const sendMessage = (e) => {
    e.preventDefault()
    if (messageInput.trim() && socket && user) {
      const messageData = {
        id: Date.now().toString(),
        user: user,
        content: messageInput.trim(),
        timestamp: new Date(),
        type: 'user'
      }
      
      console.log('Sending public message:', messageData)
      socket.emit('sendMessage', messageData)
      setMessageInput('')
    }
  }

  const sendPrivateMessage = (e) => {
    e.preventDefault()
    if (privateMessageInput.trim() && socket && user && activePrivateChat) {
      const messageData = {
        toUserId: activePrivateChat.id,
        message: privateMessageInput.trim(),
        user: user
      }
      
      console.log('Sending private message:', messageData)
      socket.emit('sendPrivateMessage', messageData)
      setPrivateMessageInput('')
    }
  }

  const startPrivateChat = (otherUser) => {
    console.log('Starting private chat with:', otherUser)
    setActivePrivateChat(otherUser)
    setPrivateMessages([])
    
    // Load conversation history
    if (socket && user) {
      const requestData = {
        otherUserId: otherUser.id,
        currentUser: user
      }
      console.log('Requesting conversation history:', requestData)
      socket.emit('getConversationHistory', requestData)
    }
  }

  const closePrivateChat = () => {
    setActivePrivateChat(null)
    setPrivateMessages([])
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Filter private messages for active chat
  const currentPrivateMessages = privateMessages.filter(msg => 
    (msg.from.id === user?.id && msg.to.id === activePrivateChat?.id) ||
    (msg.from.id === activePrivateChat?.id && msg.to.id === user?.id)
  )

  return (
    <div className="app">
      {/* Sidebar */}
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Chat App</h2>
          <button 
            className="menu-toggle"
            onClick={() => setIsSidebarOpen(false)}
          >
            <Menu size={20} />
          </button>
        </div>

        <div className="current-user">
          <div className="user-avatar">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <span className="username">{user?.username}</span>
            <span className="status">Online</span>
          </div>
        </div>

        <div className="online-users">
          <div className="section-title">
            <Users size={18} />
            <span>Online Users ({users.length})</span>
          </div>
          <div className="users-list">
            {users
              .filter(u => u.id !== user?.id)
              .map(u => (
              <div key={u.id} className="user-item">
                <div className="user-avatar small">
                  {u.username?.charAt(0).toUpperCase()}
                </div>
                <span>{u.username}</span>
                <div className="user-actions">
                  <button 
                    className="private-chat-btn"
                    onClick={() => startPrivateChat(u)}
                    title="Start private chat"
                  >
                    <MessageCircle size={16} />
                  </button>
                  <div className="online-indicator"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="main-content">
        {/* Header */}
        <div className="chat-header">
          <button 
            className="menu-toggle"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="chat-info">
            <h1>General Chat</h1>
            <span>{users.length} users online</span>
          </div>
          <button className="logout-btn">
            <LogOut size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="messages-container">
          <div className="messages">
            {messages.length === 0 ? (
              <div className="no-messages">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`message ${message.type === 'system' ? 'system' : 
                    message.user?.id === user?.id ? 'own' : 'other'}`}
                >
                  {message.type === 'user' && message.user?.id !== user?.id && (
                    <div className="message-avatar">
                      {message.user?.username?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  
                  <div className="message-content">
                    {message.type === 'user' && message.user?.id !== user?.id && (
                      <div className="message-sender">
                        {message.user?.username}
                      </div>
                    )}
                    <div className="message-bubble">
                      {message.content}
                    </div>
                    <div className="message-time">
                      {formatTime(message.timestamp)}
                    </div>
                  </div>

                  {message.type === 'user' && message.user?.id === user?.id && (
                    <div className="message-avatar own">
                      {message.user?.username?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input */}
        <form className="message-input-container" onSubmit={sendMessage}>
          <div className="input-actions">
            <button type="button" className="action-btn">
              <Paperclip size={20} />
            </button>
            <button type="button" className="action-btn">
              <Smile size={20} />
            </button>
          </div>
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type a message..."
            className="message-input"
          />
          <div className="send-actions">
            <button type="button" className="action-btn">
              <Mic size={20} />
            </button>
            <button type="submit" className="send-btn">
              <Send size={20} />
            </button>
          </div>
        </form>
      </div>

      {/* Private Chat Window */}
      {activePrivateChat && (
        <div className="private-chat-window">
          <div className="private-chat-header">
            <div className="private-chat-user">
              <div className="user-avatar small">
                {activePrivateChat.username?.charAt(0).toUpperCase()}
              </div>
              <span>{activePrivateChat.username}</span>
              {isTyping && (
                <div className="typing-indicator">
                  <span>typing...</span>
                </div>
              )}
            </div>
            <button className="close-chat-btn" onClick={closePrivateChat}>
              <X size={18} />
            </button>
          </div>

          <div className="private-messages">
            {currentPrivateMessages.length === 0 ? (
              <div className="no-messages">
                <p>No messages yet. Start a private conversation!</p>
              </div>
            ) : (
              currentPrivateMessages.map((message) => (
                <div
                  key={message.id}
                  className={`private-message ${
                    message.from.id === user?.id ? 'own' : 'other'
                  }`}
                >
                  <div className="private-message-bubble">
                    {message.content}
                  </div>
                  <div className="private-message-time">
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              ))
            )}
            <div ref={privateMessagesEndRef} />
          </div>

          <form className="private-input-container" onSubmit={sendPrivateMessage}>
            <input
              type="text"
              value={privateMessageInput}
              onChange={(e) => setPrivateMessageInput(e.target.value)}
              placeholder={`Message ${activePrivateChat.username}...`}
              className="private-message-input"
            />
            <button type="submit" className="private-send-btn">
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default App