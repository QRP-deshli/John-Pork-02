import React from 'react';
import { Users, Menu, User, LogOut, MessageCircle } from 'lucide-react';

const Sidebar = ({ 
  user, 
  users, 
  isSidebarOpen, 
  onToggleSidebar, 
  onShowProfile, 
  onLogout, 
  onStartPrivateChat 
}) => {
  return (
    <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h2>De-lone</h2>
        <button 
          className="menu-toggle"
          onClick={onToggleSidebar}
        >
          <Menu size={20} />
        </button>
      </div>

      <div className="current-user">
        <div className="user-avatar">
          {user?.profilePicture ? (
            <img src={user.profilePicture} alt="Profile" />
          ) : (
            user?.username?.charAt(0).toUpperCase()
          )}
        </div>
        <div className="user-info">
          <span className="username">{user?.username}</span>
          <span className="status">Online</span>
        </div>
        <div className="user-actions">
          <button 
            className="profile-button"
            onClick={onShowProfile}
            title="Profile"
          >
            <User size={16} />
          </button>
          <button 
            className="logout-button"
            onClick={onLogout}
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
                {u.profilePicture ? (
                  <img src={u.profilePicture} alt={u.username} />
                ) : (
                  u.username?.charAt(0).toUpperCase()
                )}
              </div>
              <div className="user-details">
                <span className="username">{u.username}</span>
                {u.bio && <span className="user-bio-preview">{u.bio}</span>}
              </div>
              <div className="user-actions">
                <button 
                  className="private-chat-btn"
                  onClick={() => onStartPrivateChat(u)}
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
  );
};

export default Sidebar;