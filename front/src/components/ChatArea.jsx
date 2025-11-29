// ChatArea.js - Remove the tabs from this component
import React from 'react';

const ChatArea = ({
  user,
  users,
  messages,
  messageInput,
  onSendMessage,
  onMessageInputChange,
  messagesEndRef,
  formatTime
}) => {
  return (
    <div className="main-content">
      {/* REMOVE THE TABS FROM HERE - they're now in App.js */}
      
      <div className="chat-header">
        <div className="chat-info">
          <h1>General Chat</h1>
          <span>{users.length} users online</span>
        </div>
      </div>

      <div className="messages-container">
        <div className="messages">
          {messages.length === 0 ? (
            <div className="no-messages">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`message ${
                  message.userId === user?.id ? 'own' : 
                  message.type === 'system' ? 'system' : 'other'
                }`}
              >
               
{message.type !== 'system' && message.userId !== user?.id && (
  <div className="message-avatar">
    {message.user?.profilePicture ? (
      <img 
        src={`http://localhost:5000/uploads/profile-pictures/${message.user.profilePicture}`} 
        alt={message.username}
      />
    ) : (
      message.username?.charAt(0).toUpperCase()
    )}
  </div>
)}
                
                <div className="message-content">
                  {message.type !== 'system' && message.userId !== user?.id && (
                    <div className="message-sender">{message.username}</div>
                  )}
                  
                  <div className="message-bubble">
                    {message.content}
                  </div>
                  
                  <div className="message-time">
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form onSubmit={onSendMessage} className="message-input-container">
        <input
          type="text"
          className="message-input"
          placeholder="Type a message..."
          value={messageInput}
          onChange={onMessageInputChange}
        />
        <button type="submit" className="send-btn">
          ↑
        </button>
      </form>
    </div>
  );
};

export default ChatArea;