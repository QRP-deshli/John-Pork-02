MODERN CHAT APPLICATION

Real-time chat app built with React + Vite + Node.js + Express + Socket.io

QUICK START:
1. Backend: cd back && npm install && npm run dev (runs on :5000)
2. Frontend: cd client && npm install && npm run dev (runs on :3000)
3. Open: http://localhost:3000

MAIN FEATURES:
- User registration & login with profiles
- Real-time public chat room
- Private 1-on-1 messaging
- Online users list with status
- User profiles with bios (400 char max)
- No database required - JSON file storage
- Responsive mobile-friendly design

PROJECT STRUCTURE:
chat-app/

PROJECT STRUCTURE:

|── front/ (React + Vite frontend)

|   |── src/App.jsx, App.css, main.jsx
|   |── index.html, vite.config.js
|── back/ (Node.js + Express backend)
|   |── models/User.js (JSON file storage)
|   |── data/users.json (auto-created)
|   |── server.js (Express + Socket.io)
|   |── package.json

TECH STACK:
Frontend: React 18, Vite, Socket.io-client, Axios, Lucide React
Backend: Node.js, Express, Socket.io, bcryptjs, CORS
Storage: JSON files (no database setup needed)
