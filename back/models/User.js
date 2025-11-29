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

  static async safeWrite(data) {
    try {
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

  static async findByIdAndUpdate(id, updates) {
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

  static async findByUsername(username) {
    const users = await this.safeRead();
    return users.find(user => user.username === username);
  }

  static async findByEmail(email) {
    const users = await this.safeRead();
    // Case-insensitive email search
    return users.find(user => user.email.toLowerCase() === email.toLowerCase());
  }

  static async create(userData) {
    const users = await this.safeRead();
    
    // FIXED: Case-insensitive checks to prevent duplicates
    const existingUsername = users.find(u => 
      u.username.toLowerCase() === userData.username.toLowerCase()
    );
    
    const existingEmail = users.find(u => 
      u.email.toLowerCase() === userData.email.toLowerCase()
    );
    
    if (existingUsername) {
      throw new Error('Username already exists');
    }
    
    if (existingEmail) {
      throw new Error('Email already exists');
    }

    const newUser = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
      ...userData,
      profilePicture: userData.profilePicture || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    users.push(newUser);
    await this.safeWrite(users);
    
    console.log('✅ User created:', newUser.username, 'ID:', newUser.id);
    
    return newUser;
  }

  static async update(id, updates) {
    const users = await this.safeRead();
    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      throw new Error('User not found');
    }

    // If updating username or email, check for duplicates
    if (updates.username) {
      const existingUsername = users.find(u => 
        u.id !== id && u.username.toLowerCase() === updates.username.toLowerCase()
      );
      if (existingUsername) {
        throw new Error('Username already exists');
      }
    }

    if (updates.email) {
      const existingEmail = users.find(u => 
        u.id !== id && u.email.toLowerCase() === updates.email.toLowerCase()
      );
      if (existingEmail) {
        throw new Error('Email already exists');
      }
    }

    users[userIndex] = {
      ...users[userIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.safeWrite(users);
    
    console.log('✅ User updated:', users[userIndex].username);
    
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

  // NEW: Clean up duplicate users (run this once to fix existing duplicates)
  static async removeDuplicates() {
    const users = await this.safeRead();
    const uniqueUsers = [];
    const seenEmails = new Set();
    const seenUsernames = new Set();

    for (const user of users) {
      const emailLower = user.email.toLowerCase();
      const usernameLower = user.username.toLowerCase();

      if (!seenEmails.has(emailLower) && !seenUsernames.has(usernameLower)) {
        uniqueUsers.push(user);
        seenEmails.add(emailLower);
        seenUsernames.add(usernameLower);
      } else {
        console.log('🗑️ Removing duplicate user:', user.username, user.email);
      }
    }

    if (uniqueUsers.length < users.length) {
      await this.safeWrite(uniqueUsers);
      console.log(`✅ Removed ${users.length - uniqueUsers.length} duplicate users`);
      return {
        removed: users.length - uniqueUsers.length,
        remaining: uniqueUsers.length
      };
    }

    return { removed: 0, remaining: users.length };
  }
}

module.exports = User;