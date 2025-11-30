import React from 'react';
import { X, Send } from 'lucide-react';

const PrivateChat = ({ 
  activePrivateChat, 
  privateMessages, 
  privateMessageInput, 
  onClosePrivateChat, 
  onSendPrivateMessage, 
  onPrivateMessageInputChange,
  privateMessagesEndRef,
  formatTime,
  user 
}) => {
  const currentPrivateMessages = privateMessages.filter(msg => 
    (msg.from.id === user?.id && msg.to.id === activePrivateChat?.id) ||
    (msg.from.id === activePrivateChat?.id && msg.to.id === user?.id)
  );

  return (
    <div className="private-chat-window">
      <div className="private-chat-header">
        <div className="private-chat-user">
          <div className="user-avatar small">
            {activePrivateChat.profilePicture ? (
              <img 
                src={`http://localhost:5000/uploads/profile-pictures/${activePrivateChat.profilePicture}`} 
                alt={activePrivateChat.username}
              />
            ) : (
              activePrivateChat.username?.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <span>{activePrivateChat.username}</span>
            {activePrivateChat.bio && (
              <div className="user-bio-preview">{activePrivateChat.bio}</div>
            )}
          </div>
        </div>
        <button className="close-chat-btn" onClick={onClosePrivateChat}>
          <X size={18} />
        </button>
      </div>

      <div className="private-messages">
        {currentPrivateMessages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet. Start a private conversation!</p>
          </div>
        ) : (
          currentPrivateMessages.map((message) => {
            const isOwnMessage = message.from.id === user?.id;
            
            return (
              <div
                key={message.id}
                className={`private-message ${isOwnMessage ? 'own' : 'other'}`}
              >
                {/* Avatar for received messages (other person) */}
                {!isOwnMessage && (
                  <div className="message-avatar small">
                    {message.from.profilePicture ? (
                      <img 
                        src={`http://localhost:5000/uploads/profile-pictures/${message.from.profilePicture}`} 
                        alt={message.from.username}
                      />
                    ) : (
                      message.from.username?.charAt(0).toUpperCase()
                    )}
                  </div>
                )}
                
                {/* Message content */}
                <div className="private-message-content">
                  <div className="private-message-bubble">
                    {message.content}
                  </div>
                  <div className="private-message-time">
                    {formatTime(message.timestamp)}
                  </div>
                </div>

                {/* Avatar for sent messages (current user) */}
                {isOwnMessage && (
                  <div className="message-avatar small">
                    {user.profilePicture ? (
                      <img 
                        src={`http://localhost:5000/uploads/profile-pictures/${user.profilePicture}`} 
                        alt={user.username}
                      />
                    ) : (
                      user.username?.charAt(0).toUpperCase()
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={privateMessagesEndRef} />
      </div>

      <form className="private-input-container" onSubmit={onSendPrivateMessage}>
        <input
          type="text"
          value={privateMessageInput}
          onChange={onPrivateMessageInputChange}
          placeholder={`Message ${activePrivateChat.username}...`}
          className="private-message-input"
        />
        <button type="submit" className="private-send-btn">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default PrivateChat;