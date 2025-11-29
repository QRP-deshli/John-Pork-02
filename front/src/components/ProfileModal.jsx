import React, { useState, useRef } from 'react';
import axios from 'axios';
import { X, Edit3, Paperclip, XCircle } from 'lucide-react';

const ProfileModal = ({ user, onClose, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: user.username,
    bio: user.bio || '',
    profilePicture: user.profilePicture || ''
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await axios.put(`http://localhost:5000/api/users/${user.id}`, {
        username: formData.username,
        bio: formData.bio
      });
      onUpdate(response.data);
      setIsEditing(false);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePictureUpdate = async (pictureData) => {
    setUploading(true);
    try {
      const response = await axios.put(`http://localhost:5000/api/users/${user.id}/profile-picture`, {
        profilePicture: pictureData
      });
      onUpdate(response.data);
      setFormData(prev => ({ ...prev, profilePicture: pictureData }));
    } catch (error) {
      alert('Failed to update profile picture');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      handleProfilePictureUpdate(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarClick = () => {
    if (isEditing) {
      fileInputRef.current?.click();
    }
  };

  const getAvatarContent = () => {
    if (user.profilePicture) {
      return (
        <img 
          src={user.profilePicture} 
          alt="Profile" 
          className="profile-picture"
        />
      );
    }
    return user.username?.charAt(0).toUpperCase();
  };

  const getAvatarPreview = () => {
    if (formData.profilePicture) {
      return (
        <img 
          src={formData.profilePicture} 
          alt="Profile Preview" 
          className="profile-picture"
        />
      );
    }
    return formData.username?.charAt(0).toUpperCase();
  };

  const removeProfilePicture = () => {
    handleProfilePictureUpdate('');
  };

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
          {uploading && (
            <div className="upload-overlay">
              <div className="upload-spinner">Uploading...</div>
            </div>
          )}

          <div 
            className={`profile-avatar ${isEditing ? 'editable' : ''}`}
            onClick={handleAvatarClick}
            title={isEditing ? "Click to change profile picture" : ""}
          >
            {isEditing ? getAvatarPreview() : getAvatarContent()}
            {isEditing && (
              <div className="avatar-edit-overlay">
                <Edit3 size={20} />
              </div>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            style={{ display: 'none' }}
          />

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
              
              <div className="picture-options">
                <h4>Profile Picture</h4>
                <div className="picture-buttons">
                  <button 
                    type="button" 
                    className="upload-button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip size={16} />
                    Upload Photo
                  </button>
                  {(user.profilePicture || formData.profilePicture) && (
                    <button 
                      type="button" 
                      className="remove-button"
                      onClick={removeProfilePicture}
                    >
                      <XCircle size={16} />
                      Remove Photo
                    </button>
                  )}
                </div>
                <p className="picture-hint">
                  Click on your profile picture or use the upload button to change it
                </p>
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
  );
};

export default ProfileModal;