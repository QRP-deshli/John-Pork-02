// services/dailyMatchScheduler.js
const User = require('../models/User');
const AIService = require('./aiService');

class DailyMatchScheduler {
  constructor(aiService, io, onlineUsers, privateConversations) {
    this.aiService = aiService;
    this.io = io;
    this.onlineUsers = onlineUsers;
    this.privateConversations = privateConversations;
    this.scheduledTime = '09:00'; // 9 AM daily
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️ Daily match scheduler already running');
      return;
    }

    console.log('🚀 Starting daily match scheduler...');
    this.isRunning = true;

    // Check every hour if it's time to send messages
    this.interval = setInterval(() => {
      this.checkAndSendDailyMatches();
    }, 60 * 60 * 1000); // Check every hour

    // Also check immediately on start
    this.checkAndSendDailyMatches();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.isRunning = false;
      console.log('🛑 Daily match scheduler stopped');
    }
  }

  async checkAndSendDailyMatches() {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Only run at the scheduled time (within the same hour)
    if (currentTime.startsWith(this.scheduledTime.split(':')[0])) {
      console.log('⏰ Time to send daily match messages!');
      await this.sendDailyMatchMessages();
    }
  }

  async sendDailyMatchMessages() {
    try {
      const allUsers = await User.findAll();
      
      // Process each user
      for (const user of allUsers) {
        try {
          await this.processUserMatches(user, allUsers);
        } catch (error) {
          console.error(`Error processing matches for ${user.username}:`, error);
        }
      }
      
      console.log('✅ Daily match messages sent successfully');
    } catch (error) {
      console.error('❌ Error in sendDailyMatchMessages:', error);
    }
  }

  async processUserMatches(user, allUsers) {
    // Get other users (exclude current user)
    const otherUsers = allUsers.filter(u => u.id !== user.id);
    
    if (otherUsers.length === 0) {
      console.log(`No matches available for ${user.username}`);
      return;
    }

    // Find matches using AI
    const matchResult = await this.aiService.analyzeProfilesAndMatch(user, otherUsers);
    const matches = matchResult.matches || matchResult;
    
    if (!matches || matches.length === 0) {
      console.log(`No AI matches found for ${user.username}`);
      return;
    }

    // Get the best match (highest score)
    const bestMatch = matches.reduce((best, current) => {
      return (current.score > best.score) ? current : best;
    }, matches[0]);

    console.log(`📧 Best match for ${user.username}: ${bestMatch.username} (score: ${bestMatch.score})`);

    // Get the target user
    const targetUser = otherUsers.find(u => u.id === bestMatch.userId);
    if (!targetUser) {
      console.log(`Target user not found: ${bestMatch.userId}`);
      return;
    }

    // Generate personalized icebreaker
    const icebreaker = await this.aiService.generateIcebreaker(user, targetUser);
    
    // Send the message
    await this.sendMatchMessage(user, targetUser, icebreaker, bestMatch.score);
  }

  async sendMatchMessage(fromUser, toUser, message, matchScore) {
    // Check if receiver is online
    const receiverEntry = Array.from(this.onlineUsers.entries())
      .find(([_, user]) => user.id === toUser.id);
    
    const privateMessage = {
      id: Date.now().toString() + '-' + Math.random(),
      from: { 
        id: fromUser.id, 
        username: fromUser.username,
        profilePicture: fromUser.profilePicture
      },
      to: { 
        id: toUser.id, 
        username: toUser.username,
        profilePicture: toUser.profilePicture
      },
      content: `🌟 Daily Match (Score: ${matchScore}/10)\n\n${message}`,
      timestamp: new Date(),
      type: 'private',
      isDailyMatch: true,
      matchScore: matchScore
    };

    // Store in conversation history
    const conversationId = this.getConversationId(fromUser.id, toUser.id);
    if (!this.privateConversations.has(conversationId)) {
      this.privateConversations.set(conversationId, []);
    }
    this.privateConversations.get(conversationId).push(privateMessage);

    // Keep only last 50 messages
    if (this.privateConversations.get(conversationId).length > 50) {
      this.privateConversations.get(conversationId).shift();
    }

    // Send via socket if user is online
    if (receiverEntry) {
      const [receiverSocketId] = receiverEntry;
      this.io.to(receiverSocketId).emit('privateMessage', privateMessage);
      console.log(`✉️ Sent daily match message to ${toUser.username} (online)`);
    } else {
      console.log(`💌 Stored daily match message for ${toUser.username} (offline)`);
    }

    // Also notify the sender if they're online
    const senderEntry = Array.from(this.onlineUsers.entries())
      .find(([_, user]) => user.id === fromUser.id);
    
    if (senderEntry) {
      const [senderSocketId] = senderEntry;
      this.io.to(senderSocketId).emit('privateMessage', privateMessage);
    }
  }

  getConversationId(user1Id, user2Id) {
    return [user1Id, user2Id].sort().join('_');
  }

  // Allow manual triggering for testing
  async triggerNow() {
    console.log('🎯 Manually triggering daily match messages...');
    await this.sendDailyMatchMessages();
  }

  // Update scheduled time
  setScheduledTime(time) {
    this.scheduledTime = time;
    console.log(`⏰ Updated scheduled time to ${time}`);
  }
}

module.exports = DailyMatchScheduler;