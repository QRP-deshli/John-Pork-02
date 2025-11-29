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

  const handleLogin = (userData) => {
    setUser(userData);
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    // Authenticate with socket
    newSocket.emit('authenticate', userData);

    // Set up socket listeners
    newSocket.on('message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('users', (usersList) => {
      setUsers(usersList);
    });

    newSocket.on('userJoined', (data) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'system',
        content: `${data.user.username} joined the chat`,
        timestamp: new Date()
      }]);
    });

    newSocket.on('userLeft', (data) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'system',
        content: `${data.user.username} left the chat`,
        timestamp: new Date()
      }]);
    });

    newSocket.on('previousMessages', (previousMessages) => {
      setMessages(prev => [...prev, ...previousMessages]);
    });

    newSocket.on('privateMessage', (message) => {
      setPrivateMessages(prev => [...prev, message]);
    });

    newSocket.on('conversationHistory', (data) => {
      setPrivateMessages(data.messages || []);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      alert(`Error: ${error.message}`);
    });
  };

  const handleLogout = () => {
    if (socket) {
      socket.close();
    }
    setUser(null);
    setSocket(null);
    setMessages([]);
    setUsers([]);
    setPrivateMessages([]);
    setActivePrivateChat(null);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim() && socket && user) {
      const messageData = {
        id: Date.now().toString(),
        content: messageInput.trim(),
        type: 'user'
      };
      
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