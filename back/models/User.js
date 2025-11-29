const fs = require('fs').promises;
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const usersFilePath = path.join(dataDir, 'users.json');

class User {
  static async init() {
    try {
      // Create data directory if it doesn't exist
      await fs.mkdir(dataDir, { recursive: true });
      
      // Check if users file exists, create if it doesn't
      try {
        await fs.access(usersFilePath);
      } catch (error) {
        // Create file with empty array if it doesn't exist
        await this.safeWrite([]);
        console.log('Created users.json file');
      }
    } catch (error) {
      console.error('Error initializing user database:', error);
      throw error;
    }
  }

  // Add file locking and better error handling
  static async safeWrite(data) {
    try {
      // For now, use basic file writing since proper-lockfile might need installation
      // If you want proper locking, install: npm install proper-lockfile
      await fs.writeFile(usersFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error writing to users file:', error);
      throw error;
    }
  }

  static async safeRead() {
    try {
      const data = await fs.readFile(usersFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading users file:', error);
      return [];
    }
  }

  static async findAll() {
    return await this.safeRead();
  }

  static async findById(id) {
    const users = await this.safeRead();
    return users.find(user => user.id === id);
  }

  static async findByUsername(username) {
    const users = await this.safeRead();
    return users.find(user => user.username === username);
  }

  static async findByEmail(email) {
    const users = await this.safeRead();
    return users.find(user => user.email === email);
  }

  static async create(userData) {
    const users = await this.safeRead();
    
    // Check if user already exists
    if (users.find(u => u.username === userData.username)) {
      throw new Error('Username already exists');
    }
    if (users.find(u => u.email === userData.email)) {
      throw new Error('Email already exists');
    }

    const newUser = {
      id: Date.now().toString(),
      ...userData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    users.push(newUser);
    await this.safeWrite(users);
    
    return newUser;
  }

  static async update(id, updates) {
    const users = await this.safeRead();
    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      throw new Error('User not found');
    }

    users[userIndex] = {
      ...users[userIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.safeWrite(users);
    return users[userIndex];
  }

  static async delete(id) {
    const users = await this.safeRead();
    const filteredUsers = users.filter(u => u.id !== id);
    
    if (filteredUsers.length === users.length) {
      throw new Error('User not found');
    }

    await this.safeWrite(filteredUsers);
    return true;
  }
}

module.exports = User;