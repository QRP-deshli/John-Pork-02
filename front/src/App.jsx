import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import LoginRegister from './components/LoginRegister';
import ProfileModal from './components/ProfileModal';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import PrivateChat from './components/PrivateChat';
import AIMatching from './components/AIMatching';
import Meetings from './components/Meetings';
import './App.css';

const App = () => {
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [users, setUsers] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [activePrivateChat, setActivePrivateChat] = useState(null);
  const [privateMessageInput, setPrivateMessageInput] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const messagesEndRef = useRef(null);
  const privateMessagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollPrivateToBottom = () => {
    privateMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    scrollPrivateToBottom();
  }, [privateMessages]);

  // Add this function to refresh user data
  const refreshUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await axios.get('http://localhost:5000/api/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const updatedUser = response.data;
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      console.log('✅ User data refreshed');
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  // Check for existing token on app load
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        initializeSocketAndAuthenticate(parsedUser, token);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Add auto-refresh on window focus
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        refreshUserData();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);

const initializeSocketAndAuthenticate = (userData, token) => {
  setIsAuthenticating(true);
  
  // FIX: Check if socket already exists and disconnect it
  if (socket) {
    socket.disconnect();
    setSocket(null);
  }

  const newSocket = io('http://localhost:5000', {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  setSocket(newSocket);

  // FIX: Use once() instead of on() for connect event to prevent multiple listeners
  newSocket.once('connect', () => {
    console.log('✅ Socket connected, authenticating...');
    
    // Refresh user data before authenticating
    refreshUserData().then(() => {
      const currentUser = JSON.parse(localStorage.getItem('user'));
      newSocket.emit('authenticate', { 
        user: currentUser || userData, 
        token: token 
      });
    });
  });

  // FIX: Remove any existing message listeners before adding new ones
  newSocket.off('message');
  newSocket.off('users');
  newSocket.off('userJoined');
  newSocket.off('userLeft');
  newSocket.off('previousMessages');
  newSocket.off('privateMessage');
  newSocket.off('conversationHistory');
  newSocket.off('error');
  newSocket.off('connect_error');

  // Set up socket listeners - ONLY ONCE
  newSocket.on('message', (message) => {
    console.log('📨 Received message:', message.content);
    setMessages(prev => {
      // FIX: Check if message already exists to prevent duplicates
      const messageExists = prev.some(msg => msg.id === message.id);
      if (messageExists) {
        console.log('🔄 Skipping duplicate message');
        return prev;
      }
      return [...prev, message];
    });
  });

  newSocket.on('users', (usersList) => {
    setUsers(usersList);
    setIsAuthenticating(false);
  });

  newSocket.on('userJoined', (data) => {
    setMessages(prev => {
      const newMessage = {
        id: `system-join-${Date.now()}-${Math.random()}`,
        type: 'system',
        content: `${data.user.username} joined the chat`,
        timestamp: new Date()
      };
      
      const messageExists = prev.some(msg => msg.id === newMessage.id);
      return messageExists ? prev : [...prev, newMessage];
    });
  });

  newSocket.on('userLeft', (data) => {
    setMessages(prev => {
      const newMessage = {
        id: `system-left-${Date.now()}-${Math.random()}`,
        type: 'system',
        content: `${data.user.username} left the chat`,
        timestamp: new Date()
      };
      
      const messageExists = prev.some(msg => msg.id === newMessage.id);
      return messageExists ? prev : [...prev, newMessage];
    });
  });

  newSocket.on('previousMessages', (previousMessages) => {
    setMessages(prev => {
      // Filter out duplicates when adding previous messages
      const newMessages = previousMessages.filter(newMsg => 
        !prev.some(existingMsg => existingMsg.id === newMsg.id)
      );
      return [...prev, ...newMessages];
    });
  });

  newSocket.on('privateMessage', (message) => {
    setPrivateMessages(prev => {
      const messageExists = prev.some(msg => msg.id === message.id);
      return messageExists ? prev : [...prev, message];
    });
  });

  newSocket.on('conversationHistory', (data) => {
    setPrivateMessages(data.messages || []);
  });

  newSocket.on('error', (error) => {
    console.error('Socket error:', error);
    setIsAuthenticating(false);
    
    if (error.message.includes('Authentication failed') || error.message.includes('User not found')) {
      console.warn('Authentication issue:', error.message);
      // Try to refresh user data and reauthenticate
      refreshUserData().then(() => {
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');
        
        if (storedUser && storedToken) {
          setTimeout(() => {
            newSocket.emit('authenticate', { 
              user: JSON.parse(storedUser), 
              token: storedToken 
            });
          }, 2000);
        }
      });
    } else {
      alert(`Error: ${error.message}`);
    }
  });

  newSocket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    setIsAuthenticating(false);
  });
};

  // FIXED: Handle the response structure properly
const handleLogin = async (responseData) => {
  console.log('Login response:', responseData);
  
  let userData;
  let token;
  
  if (responseData.user && responseData.token) {
    userData = responseData.user;
    token = responseData.token;
  } else {
    userData = responseData;
    token = responseData.token;
  }
  
  if (!userData || !userData.id) {
    console.error('Invalid user data received:', responseData);
    alert('Login failed: Invalid user data received');
    return;
  }

  setUser(userData);
  
  // Store user data and token in localStorage
  if (token) {
    localStorage.setItem('token', token);
  }
  localStorage.setItem('user', JSON.stringify(userData));
  
  // Initialize socket and authenticate
  initializeSocketAndAuthenticate(userData, token);
};

  const handleLogout = () => {
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    if (socket) {
      socket.disconnect();
    }
    setSocket(null);
    setUser(null);
    setMessages([]);
    setUsers([]);
    setPrivateMessages([]);
    setActivePrivateChat(null);
    setIsAuthenticating(false);
  };

const sendMessage = (e) => {
  e.preventDefault();
  if (messageInput.trim() && socket && user) {
    const messageData = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9), // Ensure unique ID
      content: messageInput.trim(),
      type: 'user'
    };
    
    console.log('📤 Sending message:', messageData.content);
    socket.emit('sendMessage', messageData);
    setMessageInput('');
  }
};

  const sendPrivateMessage = (e) => {
    e.preventDefault();
    if (privateMessageInput.trim() && socket && user && activePrivateChat) {
      const messageData = {
        toUserId: activePrivateChat.id,
        message: privateMessageInput.trim()
      };
      
      socket.emit('sendPrivateMessage', messageData);
      setPrivateMessageInput('');
    }
  };

  const startPrivateChat = (otherUser) => {
    setActivePrivateChat(otherUser);
    setPrivateMessages([]);
    
    if (socket && user) {
      socket.emit('getConversationHistory', {
        otherUserId: otherUser.id
      });
    }
  };

  const closePrivateChat = () => {
    setActivePrivateChat(null);
    setPrivateMessages([]);
  };

  const handleProfileUpdate = (updatedUser) => {
    setUser(updatedUser);
    // Update localStorage with new user data
    localStorage.setItem('user', JSON.stringify(updatedUser));
    
    // Update user in online users list if needed
    setUsers(prev => prev.map(u => 
      u.id === updatedUser.id ? { ...u, username: updatedUser.username, bio: updatedUser.bio } : u
    ));
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Add manual refresh function
  const handleManualRefresh = () => {
    refreshUserData();
    if (socket) {
      const token = localStorage.getItem('token');
      const userData = JSON.parse(localStorage.getItem('user'));
      if (token && userData) {
        socket.emit('authenticate', { 
          user: userData, 
          token: token 
        });
      }
    }
  };

  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <ChatArea
            user={user}
            users={users}
            messages={messages}
            messageInput={messageInput}
            onSendMessage={sendMessage}
            onMessageInputChange={(e) => setMessageInput(e.target.value)}
            messagesEndRef={messagesEndRef}
            formatTime={formatTime}
          />
        );
      case 'ai':
        return (
          <div className="ai-container">
            <AIMatching user={user} users={users} />
          </div>
        );
      case 'meetings':
        return (
          <div className="meetings-container">
            <Meetings user={user} socket={socket} />
          </div>
        );
      default:
        return (
          <ChatArea
            user={user}
            users={users}
            messages={messages}
            messageInput={messageInput}
            onSendMessage={sendMessage}
            onMessageInputChange={(e) => setMessageInput(e.target.value)}
            messagesEndRef={messagesEndRef}
            formatTime={formatTime}
          />
        );
    }
  };

  // Show loading while authenticating
  if (isAuthenticating) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>Connecting...</h2>
          <p>Please wait while we connect you to the chat.</p>
          <button 
            onClick={handleManualRefresh}
            style={{
              background: '#667eea',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            Refresh Connection
          </button>
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <div className="loading-spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginRegister onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <Sidebar
        user={user}
        users={users}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onShowProfile={() => setShowProfile(true)}
        onLogout={handleLogout}
        onStartPrivateChat={startPrivateChat}
        onManualRefresh={handleManualRefresh} // Pass refresh function to sidebar
      />

      <div className="main-content">
        {/* Tab Navigation - Always Visible */}
        <div className="tabs">
          <button 
            className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button 
            className={`tab-button ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            AI Matching
          </button>
          <button 
            className={`tab-button ${activeTab === 'meetings' ? 'active' : ''}`}
            onClick={() => setActiveTab('meetings')}
          >
            Meetings
          </button>
          <button 
            className="refresh-button"
            onClick={handleManualRefresh}
            title="Refresh Connection"
            style={{
              marginLeft: 'auto',
              background: '#48bb78',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Refresh
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {renderTabContent()}
        </div>
      </div>

      {activePrivateChat && (
        <PrivateChat
          activePrivateChat={activePrivateChat}
          privateMessages={privateMessages}
          privateMessageInput={privateMessageInput}
          onClosePrivateChat={closePrivateChat}
          onSendPrivateMessage={sendPrivateMessage}
          onPrivateMessageInputChange={(e) => setPrivateMessageInput(e.target.value)}
          privateMessagesEndRef={privateMessagesEndRef}
          formatTime={formatTime}
          user={user}
        />
      )}

      {showProfile && (
        <ProfileModal 
          user={user} 
          onClose={() => setShowProfile(false)}
          onUpdate={handleProfileUpdate}
        />
      )}
    </div>
  );
};

export default App;