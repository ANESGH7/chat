// server.js
const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = new Map(); // roomName => Set of clients

wss.on('connection', (ws) => {
  ws.room = null;

  ws.on('message', (data) => {
    try {
      if (typeof data === 'string') {
        const msg = JSON.parse(data);

        if (msg.type === 'create') {
          const roomName = msg.roomName;
          if (!rooms.has(roomName)) rooms.set(roomName, new Set());
          ws.room = roomName;
          rooms.get(roomName).add(ws);
        }

        if (msg.type === 'join') {
          const roomName = msg.roomName;
          if (!rooms.has(roomName)) rooms.set(roomName, new Set());
          ws.room = roomName;
          rooms.get(roomName).add(ws);
        }

        if (msg.type === 'message' && ws.room) {
          broadcast(ws.room, {
            type: 'message',
            text: msg.text
          }, ws);
        }

        if ((msg.type === 'binary-image' || msg.type === 'binary-audio') && ws.room) {
          ws._expectBinaryType = msg.type;
        }
      } else if (Buffer.isBuffer(data) && ws.room && ws._expectBinaryType) {
        broadcastBinary(ws.room, data, ws);
        ws._expectBinaryType = null;
      }

    } catch (err) {
      console.error('Error processing message:', err);
    }
  });

  ws.on('close', () => {
    if (ws.room && rooms.has(ws.room)) {
      rooms.get(ws.room).delete(ws);
      if (rooms.get(ws.room).size === 0) {
        rooms.delete(ws.room);
      }
    }
  });
});

function broadcast(roomName, data, exclude) {
  const room = rooms.get(roomName);
  if (!room) return;
  const message = JSON.stringify(data);
  for (const client of room) {
    if (client.readyState === WebSocket.OPEN && client !== exclude) {
      client.send(message);
    }
  }
}

function broadcastBinary(roomName, buffer, exclude) {
  const room = rooms.get(roomName);
  if (!room) return;
  for (const client of room) {
    if (client.readyState === WebSocket.OPEN && client !== exclude) {
      client.send(buffer);
    }
  }
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`✅ WebSocket server listening on port ${PORT}`);
});
