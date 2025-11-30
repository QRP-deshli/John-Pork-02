import React, { useState } from 'react';
import axios from 'axios';

const AIMatching = ({ user, users }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  const findMatches = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/match-users', {}, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'user-id': user.id 
        }
      });
      
      // FIX: Filter out the current user from matches and ensure we have valid matches
      const filteredMatches = (response.data || [])
        .filter(match => match.userId !== user.id) // Remove self from matches
        .filter(match => match.username && match.userId); // Only valid matches
      
      setMatches(filteredMatches);
      
      if (filteredMatches.length === 0) {
        alert('No matches found. Try again or there might be no other users registered.');
      }
    } catch (error) {
      console.error('Matching failed:', error);
      alert('Failed to find matches. Make sure there are other users registered.');
    } finally {
      setLoading(false);
    }
  };

  const sendIcebreaker = async (toUserId) => {
    if (toUserId === user.id) {
      alert("You can't send an icebreaker to yourself!");
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/send-icebreaker', 
        { toUserId },
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'user-id': user.id 
          } 
        }
      );
      alert('Icebreaker sent! Check your private messages.');
    } catch (error) {
      console.error('Icebreaker error:', error);
      alert('Failed to send icebreaker. User might be offline.');
    }
  };

  return (
    <div className="ai-matching">
      <h3>🤖 AI Profile Matching</h3>
      <p className="ai-description">Find compatible users based on profile analysis</p>
      
      <button 
        onClick={findMatches} 
        disabled={loading}
        className="match-button"
      >
        {loading ? 'Finding Matches...' : 'Find AI Matches'}
      </button>

      {matches.length > 0 ? (
        <div className="matches-list">
          <h4>Your Top Matches:</h4>
          {matches.map((match, index) => (
            <div key={match.userId || `match-${index}-${Date.now()}`} className="match-card">
              <div className="match-header">
                <strong>{match.username}</strong><br />
                <span className="match-score">Score: {match.score}/10</span>
              </div>
              <p className="match-reason">{match.reasoning}</p>
              <button 
                onClick={() => sendIcebreaker(match.userId)}
                className="icebreaker-button"
              >
                Send AI Icebreaker
              </button>
            </div>
          ))}
        </div>
      ) : (
        !loading && (
          <div className="no-matches">
            <p>No matches found yet. Click the button above to find compatible users!</p>
            <div className="match-tips">
              <h5>Tips for better matches:</h5>
              <ul>
                <li>Make sure other users have registered</li>
                <li>Add detailed bios to your profiles</li>
                <li>Try the matching feature multiple times</li>
              </ul>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default AIMatching;