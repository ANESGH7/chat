const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const wss = new WebSocket.Server({ port: 8080 });
console.log("✅ Server listening on ws://localhost:8080");

let videoCounter = 0;
let audioCounter = 0;
const rooms = new Map();

wss.on('connection', (ws) => {
  console.log("🔌 Client connected.");
  ws.room = null;

  ws.on('message', (data) => {
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);

        if (msg.type === 'create' || msg.type === 'join') {
          const room = msg.roomName;
          if (!rooms.has(room)) rooms.set(room, new Set());
          rooms.get(room).add(ws);
          ws.room = room;
          console.log(`🏠 ${msg.type.toUpperCase()} room: ${room}`);
        } else if (msg.type === 'message') {
          if (!ws.room || !rooms.has(ws.room)) return;
          const payload = JSON.stringify({ type: 'message', text: msg.text });
          for (const client of rooms.get(ws.room)) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(payload);
            }
          }
        }
      } catch (err) {
        console.log("❌ Invalid JSON:", err);
      }
    } else if (Buffer.isBuffer(data)) {
      const magicBytes = data.slice(0, 4).toString('hex');

      if (!ws.room || !rooms.has(ws.room)) return;

      // Save media (optional)
      if (magicBytes.startsWith('ffd8')) {
        const filePath = path.join(__dirname, `video_frame_${videoCounter++}.jpg`);
        fs.writeFileSync(filePath, data);
        console.log(`📸 Saved video frame: ${filePath}`);
      } else if (magicBytes === '52494646') {
        const filePath = path.join(__dirname, `audio_${audioCounter++}.wav`);
        fs.writeFileSync(filePath, data);
        console.log(`🎙️ Saved audio chunk: ${filePath}`);
      } else {
        const filePath = path.join(__dirname, `unknown_${Date.now()}`);
        fs.writeFileSync(filePath, data);
        console.log(`📦 Saved unknown binary: ${filePath}`);
      }

      // Broadcast to other clients in the same room
      for (const client of rooms.get(ws.room)) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      }
    }
  });

  ws.on('close', () => {
    if (ws.room && rooms.has(ws.room)) {
      rooms.get(ws.room).delete(ws);
      if (rooms.get(ws.room).size === 0) {
        rooms.delete(ws.room);
      }
    }
    console.log("❎ Client disconnected.");
  });
});
