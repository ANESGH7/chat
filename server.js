// server.js
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
console.log("✅ Server listening on ws://localhost:8080");

const rooms = new Map();

wss.on('connection', (ws) => {
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
          console.log(`🔗 ${msg.type.toUpperCase()} room: ${room}`);
        } else if (msg.type === 'message') {
          if (!ws.room || !rooms.has(ws.room)) return;
          const payload = JSON.stringify({ type: "message", text: msg.text });
          for (const client of rooms.get(ws.room)) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(payload);
            }
          }
        }
      } catch (err) {
        console.log("❌ JSON parse error:", err);
      }
    } else if (Buffer.isBuffer(data)) {
      const prefix = data[0]; // 1 = video, 2 = audio
      const payload = data.slice(1);

      if (!ws.room || !rooms.has(ws.room)) return;

      for (const client of rooms.get(ws.room)) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          const merged = Buffer.concat([Buffer.from([prefix]), payload]);
          client.send(merged);
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
    console.log("❎ Client disconnected");
  });
});
