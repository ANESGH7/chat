const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
const rooms = new Map();
const clientStates = new Map(); // Tracks metadata for each client

wss.on('connection', function connection(ws) {
  console.log('A new client connected');
  ws.clientId = `${ws._socket.remoteAddress}:${ws._socket.remotePort}`;

  ws.on('message', function incoming(data, isBinary) {
    if (isBinary) {
      const meta = clientStates.get(ws);
      if (meta?.type === 'binary-image') {
        sendImageBinary(ws, meta.roomName, data);
        clientStates.delete(ws);
      } else {
        console.warn('Unexpected binary data');
      }
      return;
    }

    try {
      const message = JSON.parse(data.toString());
      handleIncomingMessage(ws, message);
    } catch (error) {
      console.error('Invalid JSON received:', data.toString());
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    leaveRoom(ws);
    clientStates.delete(ws);
  });
});

function handleIncomingMessage(ws, message) {
  switch (message.type) {
    case 'create':
      createRoom(ws, message.roomName);
      break;
    case 'join':
      joinRoom(ws, message.roomName);
      break;
    case 'message':
      sendMessage(ws, message.roomName, message.text);
      break;
    case 'image':
      sendImage(ws, message.roomName, message.data);
      break;
    case 'binary-image':
      clientStates.set(ws, { type: 'binary-image', roomName: message.roomName });
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}

function sendMessage(ws, roomName, text) {
  if (!rooms.has(roomName)) {
    ws.send(JSON.stringify({ type: 'error', message: `Room "${roomName}" does not exist` }));
    return;
  }

  const clients = rooms.get(roomName);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'message', text: `${text} & ${ws.clientId}` }));
    }
  }
}

function sendImage(ws, roomName, base64Data) {
  const clients = rooms.get(roomName);
  if (!clients) return;

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'image', data: base64Data }));
    }
  }
}

function sendImageBinary(ws, roomName, binaryData) {
  const clients = rooms.get(roomName);
  if (!clients) return;

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(binaryData, { binary: true });
    }
  }
}

function createRoom(ws, roomName) {
  if (!rooms.has(roomName)) rooms.set(roomName, new Set());
  rooms.get(roomName).add(ws);
  console.log(`Room "${roomName}" created`);
}

function joinRoom(ws, roomName) {
  if (!rooms.has(roomName)) {
    ws.send(JSON.stringify({ type: 'error', message: `Room "${roomName}" does not exist` }));
    return;
  }
  rooms.get(roomName).add(ws);
  console.log(`Client joined room: "${roomName}"`);
}

function leaveRoom(ws) {
  for (const [roomName, clients] of rooms.entries()) {
    if (clients.delete(ws) && clients.size === 0) {
      rooms.delete(roomName);
      console.log(`Room "${roomName}" deleted`);
    }
  }
}
