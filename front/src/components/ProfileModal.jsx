import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ProfileModal = ({ user, onClose, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: user.username || '',
    bio: user.bio || '',
    email: user.email || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setFormData({
      username: user.username || '',
      bio: user.bio || '',
      email: user.email || ''
    });
  }, [user]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.put(
        'http://localhost:5000/api/profile',
        formData,
        { headers: getAuthHeaders() }
      );

      console.log('Profile update response:', response.data);
      
      // Update with the user object from response
      onUpdate(response.data.user);
      setIsEditing(false);
      
      // Update localStorage
      localStorage.setItem('user', JSON.stringify(response.data.user));
    } catch (error) {
      console.error('Profile update error:', error);
      setError(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file) => {
    setUploading(true);
    setError('');

    try {
      console.log('Uploading file:', file.name);
      
      const formData = new FormData();
      formData.append('profilePicture', file);
      
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        'http://localhost:5000/api/upload-profile-picture', 
        formData, 
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      console.log('Upload successful:', response.data);
      
      // Update user with new profile picture
      onUpdate(response.data.user);
      
      // Update localStorage
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      return response.data;
    } catch (error) {
      console.error('Upload error:', error);
      throw new Error(error.response?.data?.error || 'Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  const handlePictureChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    try {
      await handleFileUpload(file);
    } catch (error) {
      setError(error.message);
    }
  };

  const handleRemovePicture = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.delete(
        'http://localhost:5000/api/profile-picture',
        { headers: getAuthHeaders() }
      );

      onUpdate(response.data.user);
      
      // Update localStorage
      localStorage.setItem('user', JSON.stringify(response.data.user));
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to remove profile picture');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      username: user.username || '',
      bio: user.bio || '',
      email: user.email || ''
    });
    setIsEditing(false);
    setError('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Profile</h3>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="profile-content">
          {error && <div className="error-message">{error}</div>}

          {/* Profile Picture Section */}
          <div className="profile-avatar-container" style={{ position: 'relative' }}>
            <div className="profile-avatar editable">
              {user.profilePicture ? (
                <img 
                  src={`http://localhost:5000/uploads/profile-pictures/${user.profilePicture}`} 
                  alt="Profile" 
                  className="profile-picture"
                />
              ) : (
                <div>{user.username?.charAt(0).toUpperCase()}</div>
              )}
              <div className="avatar-edit-overlay">
                <span>Change</span>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handlePictureChange}
                disabled={uploading}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: uploading ? 'not-allowed' : 'pointer'
                }}
              />
            </div>

            {uploading && (
              <div className="upload-overlay">
                <div className="upload-spinner">Uploading...</div>
              </div>
            )}
          </div>

          <div className="picture-options">
            <h4>Profile Picture</h4>
            <div className="picture-buttons">
              <button 
                type="button" 
                className="upload-button"
                onClick={() => document.querySelector('input[type="file"]').click()}
                disabled={uploading}
              >
                📁 Upload New
              </button>
              {user.profilePicture && (
                <button 
                  type="button" 
                  className="remove-button"
                  onClick={handleRemovePicture}
                  disabled={loading || uploading}
                >
                  🗑️ Remove
                </button>
              )}
            </div>
            <p className="picture-hint">Supported formats: JPG, PNG, GIF. Max size: 5MB</p>
          </div>

          {isEditing ? (
            <form onSubmit={handleSave} className="edit-form">
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  required
                  minLength={3}
                  maxLength={30}
                />
              </div>

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
                <label>Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({...formData, bio: e.target.value})}
                  placeholder="Tell us something about yourself..."
                  maxLength={400}
                  rows={4}
                />
                <div className="char-count">{formData.bio.length}/400</div>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="save-button"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-info">
              <h4>{user.username}</h4>
              <div className="user-email">{user.email}</div>
              
              {user.bio ? (
                <div className="user-bio">{user.bio}</div>
              ) : (
                <div className="no-bio">No bio yet</div>
              )}

              <button 
                className="edit-profile-button"
                onClick={() => setIsEditing(true)}
              >
                ✏️ Edit Profile
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;