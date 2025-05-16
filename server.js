const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });

const rooms = new Map(); // roomName -> Set of clients
const clientStates = new Map(); // ws -> { roomName, streamType }

function broadcastText(roomName, message, sender) {
  const clients = rooms.get(roomName);
  if (!clients) return;

  for (const client of clients) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'message', text: message }));
    }
  }
}

function broadcastBinary(roomName, data, sender) {
  const clients = rooms.get(roomName);
  if (!clients) return;

  for (const client of clients) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: true });
    }
  }
}

wss.on('connection', (ws) => {
  ws.on('message', (message, isBinary) => {
    if (isBinary) {
      // Binary frame - forward to all clients in the room
      const state = clientStates.get(ws);
      if (!state || !state.roomName) return;
      broadcastBinary(state.roomName, message, ws);
      return;
    }

    // Text (JSON) message
    let msg;
    try {
      msg = JSON.parse(message.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    const { type, roomName, text, streamType } = msg;

    switch (type) {
      case 'join':
        if (!roomName) {
          ws.send(JSON.stringify({ type: 'error', message: 'roomName required' }));
          return;
        }
        if (!rooms.has(roomName)) rooms.set(roomName, new Set());
        rooms.get(roomName).add(ws);
        clientStates.set(ws, { roomName, streamType: null });
        ws.send(JSON.stringify({ type: 'joined', roomName }));
        break;

      case 'setStreamType':
        if (!streamType) {
          ws.send(JSON.stringify({ type: 'error', message: 'streamType required' }));
          return;
        }
        if (!clientStates.has(ws)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Join a room first' }));
          return;
        }
        const state = clientStates.get(ws);
        clientStates.set(ws, { ...state, streamType });
        break;

      case 'message':
        if (!roomName || typeof text !== 'string') {
          ws.send(JSON.stringify({ type: 'error', message: 'roomName and text required' }));
          return;
        }
        broadcastText(roomName, text, ws);
        break;

      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  });

  ws.on('close', () => {
    // Remove client from all rooms and states
    for (const [roomName, clients] of rooms.entries()) {
      if (clients.delete(ws) && clients.size === 0) {
        rooms.delete(roomName);
      }
    }
    clientStates.delete(ws);
  });
});

console.log('✅ WebSocket server running on port 3000');
