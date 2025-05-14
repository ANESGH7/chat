const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
const rooms = new Map();

wss.on('connection', (ws) => {
  let currentRoom = '';

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'create' || msg.type === 'join') {
        currentRoom = msg.roomName;
        if (!rooms.has(currentRoom)) {
          rooms.set(currentRoom, new Set());
        }
        rooms.get(currentRoom).add(ws);
      } else if (msg.type === 'message') {
        // Handle chat messages
        broadcast(currentRoom, data);
      } else if (msg instanceof ArrayBuffer) {
        // Binary data (video frame) received
        broadcast(currentRoom, msg);
      }
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });

  ws.on('close', () => {
    leaveRoom(ws);
  });
});

function broadcast(roomName, data) {
  const clients = rooms.get(roomName);
  if (!clients) return;

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data); // Send binary data to all clients
    }
  }
}

function leaveRoom(ws) {
  for (const [roomName, clients] of rooms.entries()) {
    if (clients.delete(ws)) {
      console.log(`Client left room: ${roomName}`);
      if (clients.size === 0) {
        rooms.delete(roomName);
      }
    }
  }
}
