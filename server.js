const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {}; // { roomName: Set of clients }

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    // Handle binary data (e.g., video frames)
    if (typeof message !== 'string') {
      if (ws.roomName) {
        rooms[ws.roomName].forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      }
      return;
    }

    // Handle text messages
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    const { type, roomName, text } = data;

    switch (type) {
      case 'create':
        ws.roomName = roomName;
        rooms[roomName] = rooms[roomName] || new Set();
        rooms[roomName].add(ws);
        ws.send(JSON.stringify({ type: 'info', message: `Room '${roomName}' created.` }));
        break;
      case 'join':
        if (rooms[roomName]) {
          ws.roomName = roomName;
          rooms[roomName].add(ws);
          ws.send(JSON.stringify({ type: 'info', message: `Joined room '${roomName}'.` }));
        } else {
          ws.send(JSON.stringify({ type: 'error', message: `Room '${roomName}' does not exist.` }));
        }
        break;
      case 'message':
        if (ws.roomName && rooms[ws.roomName]) {
          rooms[ws.roomName].forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'message', text }));
            }
          });
        }
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type.' }));
    }
  });

  ws.on('close', () => {
    if (ws.roomName && rooms[ws.roomName]) {
      rooms[ws.roomName].delete(ws);
      if (rooms[ws.roomName].size === 0) {
        delete rooms[ws.roomName];
      }
    }
  });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
