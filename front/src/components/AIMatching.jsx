import React, { useState } from 'react';
import axios from 'axios';

const AIMatching = ({ user, users }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  const findMatches = async () => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/api/match-users', {}, {
        headers: { 'user-id': user.id }
      });
      setMatches(response.data);
    } catch (error) {
      console.error('Matching failed:', error);
      alert('Failed to find matches');
    } finally {
      setLoading(false);
    }
  };

  const sendIcebreaker = async (toUserId) => {
    try {
      await axios.post('http://localhost:5000/api/send-icebreaker', 
        { toUserId },
        { headers: { 'user-id': user.id } }
      );
      alert('Icebreaker sent!');
    } catch (error) {
      alert('Failed to send icebreaker');
    }
  };

  return (
    <div className="ai-matching">
      <h3>🤖 AI Profile Matching</h3>
      <button 
        onClick={findMatches} 
        disabled={loading}
        className="match-button"
      >
        {loading ? 'Finding Matches...' : 'Find AI Matches'}
      </button>

      {matches.length > 0 && (
        <div className="matches-list">
          <h4>Your Top Matches:</h4>
          {matches.map((match, index) => (
            <div key={index} className="match-card">
              <strong>{match.username}</strong>
              <p>Score: {match.score}/10</p>
              <p>Reason: {match.reasoning}</p>
              <button 
                onClick={() => sendIcebreaker(match.userId)}
                className="icebreaker-button"
              >
                Send AI Icebreaker
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AIMatching;