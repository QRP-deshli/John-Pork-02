# De-lone: Modern Chat Application

An intelligent chat platform that actively helps users combat loneliness through AI-powered connections and automated icebreakers.

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation & Running

1. Backend Setup
   cd back
   npm install
   npm run dev
   Runs on http://localhost:5000

2. Frontend Setup
   cd front
   npm install
   npm run dev
   Runs on http://localhost:3000

3. Open Application
   Navigate to http://localhost:3000 in your browser

## Main Features

### AI-Powered Features
- Smart Matching: AI analyzes profiles to find compatible connections
- Auto-Icebreakers: AI writes and sends personalized opening messages
- Daily Matches: Receive new connection suggestions every morning at 9 AM
- Compatibility Scores: See match ratings (1-10) with detailed reasoning

### Chat Features
- Real-time Public Chat: Instant messaging in general chat rooms
- Private Messaging: 1-on-1 conversations with other users
- Online Users List: See who's currently online with status indicators
- User Profiles: Custom profiles with bios (400 char max) and profile pictures

### Technical Features
- No Database Required: JSON file storage for easy setup
- Mobile-Friendly: Responsive design works on all devices
- File Uploads: Profile picture support with image validation

## Project Structure

chat-app/
├── front/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── ChatArea.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── PrivateChat.jsx
│   │   │   ├── ProfileModal.jsx
│   │   │   ├── AIMatching.jsx
│   │   │   ├── Meetings.jsx
│   │   │   └── LoginRegister.jsx
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js
├── back/                  # Node.js + Express backend
│   ├── models/
│   │   ├── User.js        # User model with JSON storage
│   │   └── Meeting.js     # Meeting model
│   ├── middleware/
│   │   └── auth.js        # Authentication middleware
│   ├── services/
│   │   ├── aiService.js           # AI matching service
│   │   └── dailyMatchScheduler.js # Automated match scheduler
│   ├── data/              # Auto-created JSON files
│   ├── uploads/           # Profile picture storage
│   └── server.js          # Express + Socket.io server

## Tech Stack

### Frontend
- React 18 - UI framework
- Vite - Build tool and dev server
- Socket.io-client - Real-time communication
- Axios - HTTP requests
- Lucide React - Icon library

### Backend
- Node.js - Runtime environment
- Express.js - Web framework
- Socket.io - Real-time bidirectional communication
- bcryptjs - Password hashing
- CORS - Cross-origin resource sharing
- Multer - File upload handling

### AI & Storage
- OpenAI GPT API - Profile matching and icebreaker generation
- JSON files - No database setup required

## Testing with Multiple Users

To test the chat functionality between different users:

1. Open multiple browser tabs to http://localhost:3000
2. Register different user accounts in each tab
3. Start chatting between the different accounts
4. Use AI matching to discover and connect with other users

## Environment Setup

Create a .env file in the backend directory:

AI_API_KEY=your_openai_api_key_here
PORT=5000

## How It Works

1. User Registration: Users create profiles with bios and interests
2. AI Analysis: System analyzes profiles for compatibility
3. Automated Connections: AI sends icebreakers between matched users
4. Real-time Chat: Users can continue conversations in public or private chats
5. Daily Updates: New match suggestions delivered automatically

## Philosophy

De-lone bridges the gap between loneliness and connection by making the first move for you. We believe that sometimes the most helpful technology doesn't just provide tools, but actively uses them on behalf of users who struggle with social initiation.

Built to combat modern loneliness
