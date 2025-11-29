const fs = require('fs').promises;
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const meetingsFilePath = path.join(dataDir, 'meetings.json');

class Meeting {
  static async init() {
    await fs.mkdir(dataDir, { recursive: true });
    try {
      await fs.access(meetingsFilePath);
    } catch {
      await this.safeWrite([]);
    }
  }

  static async safeWrite(data) {
    try {
      await fs.writeFile(meetingsFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error writing to meetings file:', error);
      throw error;
    }
  }

  static async safeRead() {
    try {
      const data = await fs.readFile(meetingsFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading meetings file:', error);
      return [];
    }
  }

  static async findAll() {
    return await this.safeRead();
  }

  static async create(meetingData) {
    const meetings = await this.safeRead();
    const newMeeting = {
      id: Date.now().toString(),
      ...meetingData,
      participants: [],
      createdAt: new Date().toISOString()
    };
    
    meetings.push(newMeeting);
    await this.safeWrite(meetings);
    return newMeeting;
  }

  static async addParticipant(meetingId, user) {
    const meetings = await this.safeRead();
    const meetingIndex = meetings.findIndex(m => m.id === meetingId);
    
    if (meetingIndex !== -1) {
      const meeting = meetings[meetingIndex];
      if (!meeting.participants.find(p => p.id === user.id)) {
        meeting.participants.push({
          id: user.id,
          username: user.username,
          bio: user.bio
        });
        await this.safeWrite(meetings);
      }
      return meeting;
    }
    return null;
  }
}

module.exports = Meeting;