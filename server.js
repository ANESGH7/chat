const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });

const rooms = new Map(); // roomName -> Set of WebSocket clients
const clientStates = new Map(); // WebSocket -> { type: 'binary-video' | 'binary-audio', roomName }

function broadcastText(roomName, message, sender) {
  const clients = rooms.get(roomName);
  if (!clients) return;

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN && client !== sender) {
      client.send(JSON.stringify({ type: 'message', text: message }));
    }
  }
}

function broadcastBinary(sender, roomName, data) {
  const clients = rooms.get(roomName);
  if (!clients) return;

  const state = clientStates.get(sender);
  if (!state) return;

  const headerMsg = JSON.stringify({ type: state.type, roomName });

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN && client !== sender) {
      client.send(headerMsg);  // Send JSON header before binary data
      client.send(data);       // Send binary data after header
    }
  }
}

wss.on('connection', (ws) => {
  ws.on('message', (message, isBinary) => {
    if (isBinary) {
      const state = clientStates.get(ws);
      if (!state || !state.type || !state.roomName) return;
      broadcastBinary(ws, state.roomName, message);
      clientStates.delete(ws); // treat each binary message separately (reset state)
      return;
    }

    let msg;
    try {
      msg = JSON.parse(message.toString());
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    const { type, roomName, text } = msg;

    switch (type) {
      case 'create':
      case 'join':
        if (!roomName) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room name required' }));
          return;
        }
        if (!rooms.has(roomName)) {
          rooms.set(roomName, new Set());
        }
        rooms.get(roomName).add(ws);
        break;

      case 'message':
        if (!roomName || typeof text !== 'string') {
          ws.send(JSON.stringify({ type: 'error', message: 'Room name and message text required' }));
          return;
        }
        broadcastText(roomName, text, ws);
        break;

      case 'binary-video':
      case 'binary-audio':
        if (!roomName) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room name required for binary data' }));
          return;
        }
        clientStates.set(ws, { type, roomName });
        break;

      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  });

  ws.on('close', () => {
    for (const [roomName, clients] of rooms.entries()) {
      clients.delete(ws);
      if (clients.size === 0) {
        rooms.delete(roomName);
      }
    }
    clientStates.delete(ws);
  });
});

console.log("✅ WebSocket server running on port 3000");
