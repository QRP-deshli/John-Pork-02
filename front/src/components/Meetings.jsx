import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Meetings = ({ user, socket }) => {
  const [meetings, setMeetings] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newMeeting, setNewMeeting] = useState({ title: '', description: '' });

  useEffect(() => {
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/meetings');
      setMeetings(response.data);
    } catch (error) {
      console.error('Failed to load meetings');
    }
  };

  const createMeeting = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/meetings', newMeeting, {
        headers: { 'user-id': user.id }
      });
      setNewMeeting({ title: '', description: '' });
      setShowCreate(false);
      loadMeetings();
    } catch (error) {
      alert('Failed to create meeting');
    }
  };

  const joinMeeting = (meetingId) => {
    socket.emit('joinMeeting', { meetingId });
    alert(`Joined meeting! Check browser console for meeting room messages.`);
  };

  return (
    <div className="meetings">
      <div className="meetings-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h3>📅 Virtual Meetings</h3>
        <button onClick={() => setShowCreate(!showCreate)} style={{
          background: '#667eea',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '6px',
          cursor: 'pointer'
        }}>
          Create Meeting
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createMeeting} className="create-meeting" style={{
          background: '#f7fafc',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <input
            type="text"
            placeholder="Meeting Title"
            value={newMeeting.title}
            onChange={(e) => setNewMeeting({...newMeeting, title: e.target.value})}
            required
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '12px',
              border: '1px solid #e2e8f0',
              borderRadius: '4px'
            }}
          />
          <textarea
            placeholder="Description"
            value={newMeeting.description}
            onChange={(e) => setNewMeeting({...newMeeting, description: e.target.value})}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '12px',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              minHeight: '80px'
            }}
          />
          <button type="submit" style={{
            background: '#48bb78',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            Create
          </button>
        </form>
      )}

      <div className="meetings-list">
        {meetings.map(meeting => (
          <div key={meeting.id} className="meeting-card" style={{
            background: 'white',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '1px solid #e2e8f0'
          }}>
            <h4>{meeting.title}</h4>
            <p>{meeting.description}</p>
            <p>Host: {meeting.host?.username}</p>
            <p>Participants: {meeting.participants?.length || 0}</p>
            <button onClick={() => joinMeeting(meeting.id)} style={{
              background: '#667eea',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '8px'
            }}>
              Join Meeting
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Meetings;