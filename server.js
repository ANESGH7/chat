const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

const clients = new Map(); // Maps client IDs to WebSocket connections
const rooms = new Map();   // Maps room names to Sets of client IDs

wss.on('connection', (ws) => {
  const clientId = uuidv4();
  clients.set(clientId, ws);
  ws.clientId = clientId;
  ws.roomName = null;

  ws.on('message', (data) => {
    // Handle binary data (e.g., video frames)
    if (Buffer.isBuffer(data)) {
      if (ws.roomName) {
        broadcastBinary(ws.roomName, data, ws.clientId);
      }
      return;
    }

    // Handle text messages
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    const { type, roomName, text, latitude, longitude } = msg;

    switch (type) {
      case 'create':
        if (!roomName) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room name required' }));
          return;
        }
        ws.roomName = roomName;
        if (!rooms.has(roomName)) {
          rooms.set(roomName, new Set());
        }
        rooms.get(roomName).add(clientId);
        ws.send(JSON.stringify({ type: 'info', message: `Room '${roomName}' created` }));
        break;

      case 'join':
        if (!roomName) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room name required' }));
          return;
        }
        ws.roomName = roomName;
        if (!rooms.has(roomName)) {
          rooms.set(roomName, new Set());
        }
        rooms.get(roomName).add(clientId);
        ws.send(JSON.stringify({ type: 'info', message: `Joined room '${roomName}'` }));
        break;

      case 'message':
        if (!ws.roomName) {
          ws.send(JSON.stringify({ type: 'error', message: 'Join a room first' }));
          return;
        }
        broadcast(ws.roomName, {
          type: 'message',
          text: text,
        });
        break;

      case 'gps':
        if (!ws.roomName) {
          ws.send(JSON.stringify({ type: 'error', message: 'Join a room first' }));
          return;
        }
        broadcast(ws.roomName, {
          type: 'gps',
          clientId: clientId,
          latitude: latitude,
          longitude: longitude,
        });
        break;

      case 'binary-image':
        // Placeholder for handling binary image initiation if needed
        break;

      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    if (ws.roomName && rooms.has(ws.roomName)) {
      rooms.get(ws.roomName).delete(clientId);
      if (rooms.get(ws.roomName).size === 0) {
        rooms.delete(ws.roomName);
      }
    }
  });
});

function broadcast(roomName, message) {
  const room = rooms.get(roomName);
  if (!room) return;
  const msgString = JSON.stringify(message);
  room.forEach((clientId) => {
    const client = clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(msgString);
    }
  });
}

function broadcastBinary(roomName, data, senderId) {
  const room = rooms.get(roomName);
  if (!room) return;
  room.forEach((clientId) => {
    if (clientId === senderId) return; // Skip sender
    const client = clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

console.log(`WebSocket server is running on port ${PORT}`);
