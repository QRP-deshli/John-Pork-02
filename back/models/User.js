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
        await fs.writeFile(usersFilePath, JSON.stringify([]));
        console.log('Created users.json file');
      }
    } catch (error) {
      console.error('Error initializing user database:', error);
      throw error;
    }
  }

  static async findAll() {
    try {
      const data = await fs.readFile(usersFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  static async findById(id) {
    const users = await this.findAll();
    return users.find(user => user.id === id);
  }

  static async findByUsername(username) {
    const users = await this.findAll();
    return users.find(user => user.username === username);
  }

  static async findByEmail(email) {
    const users = await this.findAll();
    return users.find(user => user.email === email);
  }

  static async create(userData) {
    const users = await this.findAll();
    
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
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2));
    
    return newUser;
  }

  static async update(id, updates) {
    const users = await this.findAll();
    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      throw new Error('User not found');
    }

    users[userIndex] = {
      ...users[userIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2));
    return users[userIndex];
  }

  static async delete(id) {
    const users = await this.findAll();
    const filteredUsers = users.filter(u => u.id !== id);
    
    if (filteredUsers.length === users.length) {
      throw new Error('User not found');
    }

    await fs.writeFile(usersFilePath, JSON.stringify(filteredUsers, null, 2));
    return true;
  }
}

module.exports = User;