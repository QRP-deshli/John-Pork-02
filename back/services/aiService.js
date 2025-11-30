const axios = require('axios');

class AIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.openai.com/v1/chat/completions';
  }

  async analyzeProfilesAndMatch(currentUser, allUsers) {
    const prompt = `
      Analyze these user profiles and find the best 3 matches for ${currentUser.username}.
      Current User Bio: "${currentUser.bio || 'No bio provided'}"
      
      Other Users:
      ${allUsers.map(user => `- ${user.username}: "${user.bio || 'No bio'}"`).join('\n')}
      
      Return JSON: {matches: [{username: "name", userId: "id", score: 8, reasoning: "why they match (with key words why they match)"}]}
    `;

    try {
      const response = await axios.post(this.baseURL, {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500
      }, {
        headers: { 
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const content = response.data.choices[0].message.content;
      return JSON.parse(content);
    } catch (error) {
      console.error('AI API Error:', error.response?.data || error.message);
      // Return mock data if API fails
      return {
        matches: allUsers.slice(0, 3).map(user => ({
          username: user.username,
          userId: user.id,
          score: Math.floor(Math.random() * 5) + 6,
          reasoning: "Based on profile compatibility"
        }))
      };
    }
  }

  async generateIcebreaker(userA, userB) {
    const prompt = `
      Create a friendly icebreaker message from ${userA.username} to ${userB.username}.
      ${userA.username}'s bio: "${userA.bio || 'No bio'}"
      ${userB.username}'s bio: "${userB.bio || 'No bio'}"
      Make it natural and engaging (max 100 chars).
    `;

    try {
      const response = await axios.post(this.baseURL, {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50
      }, {
        headers: { 
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      return `Hey ${userB.username}! I noticed your profile and thought we should connect!`;
    }
  }
}

module.exports = AIService;