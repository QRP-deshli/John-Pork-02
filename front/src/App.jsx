  import React, { useState, useEffect, useRef } from 'react'
  import io from 'socket.io-client'
  import axios from 'axios'
  import AIMatching from './components/AIMatching';
  import Meetings from './components/Meetings';
  import { 
    Send, 
    Users, 
    Menu, 
    LogOut, 
    Smile,
    Paperclip,
    Mic,
    MessageCircle,
    X,
    User,
    Edit3,
    Save,
    XCircle
  } from 'lucide-react'
  import './App.css'


  const LoginRegister = ({ onLogin, onSwitchMode }) => {
    const [isLogin, setIsLogin] = useState(true)
    const [formData, setFormData] = useState({
      username: '',
      email: '',
      password: '',
      bio: ''
    })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
      e.preventDefault()
      setError('')
      setLoading(true)

      try {
        const endpoint = isLogin ? '/api/login' : '/api/register'
        const response = await axios.post(`http://localhost:5000${endpoint}`, formData)
        onLogin(response.data)
      } catch (error) {
        setError(error.response?.data?.error || 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    const switchMode = () => {
      setIsLogin(!isLogin)
      setError('')
      setFormData({
        username: '',
        email: '',
        password: '',
        bio: ''
      })
    }

    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>{isLogin ? 'Login' : 'Register'}</h2>
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  required
                  minLength={3}
                />
              </div>
            )}
            
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
                minLength={6}
              />
            </div>

            {!isLogin && (
              <div className="form-group">
                <label>Bio (optional, max 400 characters)</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({...formData, bio: e.target.value})}
                  maxLength={400}
                  rows={3}
                  placeholder="Tell us something about yourself..."
                />
                <div className="char-count">{formData.bio.length}/400</div>
              </div>
            )}

            <button type="submit" disabled={loading} className="auth-button">
              {loading ? 'Loading...' : (isLogin ? 'Login' : 'Register')}
            </button>
          </form>

          <div className="auth-switch">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button type="button" onClick={switchMode} className="switch-button">
              {isLogin ? 'Register' : 'Login'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const ProfileModal = ({ user, onClose, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false)
    const [formData, setFormData] = useState({
      username: user.username,
      bio: user.bio || ''
    })
    const [loading, setLoading] = useState(false)

    const handleSave = async () => {
      setLoading(true)
      try {
        const response = await axios.put(`http://localhost:5000/api/users/${user.id}`, formData)
        onUpdate(response.data)
        setIsEditing(false)
      } catch (error) {
        alert(error.response?.data?.error || 'Failed to update profile')
      } finally {
        setLoading(false)
      }
    }

    return (
      <div className="modal-overlay">
        <div className="profile-modal">
          <div className="modal-header">
            <h3>Profile</h3>
            <button onClick={onClose} className="close-button">
              <X size={20} />
            </button>
          </div>

          <div className="profile-content">
            <div className="profile-avatar">
              {user.username?.charAt(0).toUpperCase()}
            </div>

            {isEditing ? (
              <div className="edit-form">
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Bio</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({...formData, bio: e.target.value})}
                    maxLength={400}
                    rows={4}
                    placeholder="Tell us something about yourself..."
                  />
                  <div className="char-count">{formData.bio.length}/400</div>
                </div>
                <div className="modal-actions">
                  <button onClick={() => setIsEditing(false)} className="cancel-button">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={loading} className="save-button">
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="profile-info">
                <h4>{user.username}</h4>
                <p className="user-email">{user.email}</p>
                {user.bio ? (
                  <p className="user-bio">{user.bio}</p>
                ) : (
                  <p className="no-bio">No bio yet</p>
                )}
                <button 
                  onClick={() => setIsEditing(true)} 
                  className="edit-profile-button"
                >
                  <Edit3 size={16} />
                  Edit Profile
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const App = () => {
    const [socket, setSocket] = useState(null)
    const [user, setUser] = useState(null)
    const [messages, setMessages] = useState([])
    const [messageInput, setMessageInput] = useState('')
    const [users, setUsers] = useState([])
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [privateMessages, setPrivateMessages] = useState([])
    const [activePrivateChat, setActivePrivateChat] = useState(null)
    const [privateMessageInput, setPrivateMessageInput] = useState('')
    const [showProfile, setShowProfile] = useState(false)
    const [activeTab, setActiveTab] = useState('chat') // 'chat', 'ai', 'meetings'

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

    const handleLogin = (userData) => {
      setUser(userData)
      const newSocket = io('http://localhost:5000')
      setSocket(newSocket)

      // Authenticate with socket
      newSocket.emit('authenticate', userData)

      // Set up socket listeners
      newSocket.on('message', (message) => {
        setMessages(prev => [...prev, message])
      })

      newSocket.on('users', (usersList) => {
        setUsers(usersList)
      })

      newSocket.on('userJoined', (data) => {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'system',
          content: `${data.user.username} joined the chat`,
          timestamp: new Date()
        }])
      })

      newSocket.on('userLeft', (data) => {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'system',
          content: `${data.user.username} left the chat`,
          timestamp: new Date()
        }])
      })

      newSocket.on('previousMessages', (previousMessages) => {
        setMessages(prev => [...prev, ...previousMessages])
      })

      newSocket.on('privateMessage', (message) => {
        setPrivateMessages(prev => [...prev, message])
      })

      newSocket.on('conversationHistory', (data) => {
        setPrivateMessages(data.messages || [])
      })

      newSocket.on('error', (error) => {
        console.error('Socket error:', error)
        alert(`Error: ${error.message}`)
      })
    }

    const handleLogout = () => {
      if (socket) {
        socket.close()
      }
      setUser(null)
      setSocket(null)
      setMessages([])
      setUsers([])
      setPrivateMessages([])
      setActivePrivateChat(null)
    }

    const sendMessage = (e) => {
      e.preventDefault()
      if (messageInput.trim() && socket && user) {
        const messageData = {
          id: Date.now().toString(),
          content: messageInput.trim(),
          type: 'user'
        }
        
        socket.emit('sendMessage', messageData)
        setMessageInput('')
      }
    }

    const sendPrivateMessage = (e) => {
      e.preventDefault()
      if (privateMessageInput.trim() && socket && user && activePrivateChat) {
        const messageData = {
          toUserId: activePrivateChat.id,
          message: privateMessageInput.trim()
        }
        
        socket.emit('sendPrivateMessage', messageData)
        setPrivateMessageInput('')
      }
    }

    const startPrivateChat = (otherUser) => {
      setActivePrivateChat(otherUser)
      setPrivateMessages([])
      
      if (socket && user) {
        socket.emit('getConversationHistory', {
          otherUserId: otherUser.id
        })
      }
    }

    const closePrivateChat = () => {
      setActivePrivateChat(null)
      setPrivateMessages([])
    }

    const handleProfileUpdate = (updatedUser) => {
      setUser(updatedUser)
      // Update user in online users list if needed
      setUsers(prev => prev.map(u => 
        u.id === updatedUser.id ? { ...u, username: updatedUser.username, bio: updatedUser.bio } : u
      ))
    }

    const formatTime = (timestamp) => {
      return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const currentPrivateMessages = privateMessages.filter(msg => 
      (msg.from.id === user?.id && msg.to.id === activePrivateChat?.id) ||
      (msg.from.id === activePrivateChat?.id && msg.to.id === user?.id)
    )

    if (!user) {
      return <LoginRegister onLogin={handleLogin} />
    }

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
            <div className="user-actions">
              <button 
                className="profile-button"
                onClick={() => setShowProfile(true)}
                title="Profile"
              >
                <User size={16} />
              </button>
              <button 
                className="logout-button"
                onClick={handleLogout}
                title="Logout"
              >
                <LogOut size={16} />
              </button>
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
                  <div className="user-details">
                    <span className="username">{u.username}</span>
                    {u.bio && <span className="user-bio-preview">{u.bio}</span>}
                  </div>
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
            <button className="profile-header-button" onClick={() => setShowProfile(true)}>
              <User size={20} />
            </button>
          </div>

          {/* Tabs Navigation */}
          <div className="tabs">
            <button 
              className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              💬 Chat
            </button>
            <button 
              className={`tab-button ${activeTab === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              🤖 AI Matching
            </button>
            <button 
              className={`tab-button ${activeTab === 'meetings' ? 'active' : ''}`}
              onClick={() => setActiveTab('meetings')}
            >
              📅 Meetings
            </button>
          </div>

          {/* Chat Tab Content */}
          {activeTab === 'chat' && (
            <>
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

              <form className="message-input-container" onSubmit={sendMessage}>
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="message-input"
                />
                <button type="submit" className="send-btn">
                  <Send size={20} />
                </button>
              </form>
            </>
          )}

          {/* AI Matching Tab Content */}
          {activeTab === 'ai' && (
            <div className="tab-content">
              <div className="ai-container">
                <AIMatching user={user} users={users} />
              </div>
            </div>
          )}

          {/* Meetings Tab Content */}
          {activeTab === 'meetings' && (
            <div className="tab-content">
              <div className="meetings-container">
                <Meetings user={user} socket={socket} />
              </div>
            </div>
          )}
        </div>

        {/* Private Chat Window */}
        {activePrivateChat && (
          <div className="private-chat-window">
            <div className="private-chat-header">
              <div className="private-chat-user">
                <div className="user-avatar small">
                  {activePrivateChat.username?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span>{activePrivateChat.username}</span>
                  {activePrivateChat.bio && (
                    <div className="user-bio-preview">{activePrivateChat.bio}</div>
                  )}
                </div>
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

        {/* Profile Modal */}
        {showProfile && (
          <ProfileModal 
            user={user} 
            onClose={() => setShowProfile(false)}
            onUpdate={handleProfileUpdate}
          />
        )}
      </div>
    )
  }

  export default App  