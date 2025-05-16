const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

const rooms = new Map();       // Map<string, Set<WebSocket>>
const clientStates = new Map(); // Map<WebSocket, { type: string, roomName: string }>

wss.on('connection', function connection(ws) {
  console.log('A new client connected');
  ws.clientId = getClientId(ws);

  ws.on('message', function incoming(data, isBinary) {
    if (isBinary) {
      const meta = clientStates.get(ws);
      if (meta?.type === 'binary-image') {
        sendImageBinary(ws, meta.roomName, data);
        clientStates.delete(ws);
      } else {
        console.warn('Received unexpected binary data');
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
    case 'binary-image':
      clientStates.set(ws, { type: 'binary-image', roomName: message.roomName });
      break;
    default:
      console.error('Unsupported message type:', message.type);
  }
}

function sendImageBinary(ws, roomName, binaryData) {
  if (roomName && rooms.has(roomName)) {
    const clients = rooms.get(roomName);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(binaryData, { binary: true });
      }
    }
  }
}

function createRoom(ws, roomName) {
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
    console.log(`Room "${roomName}" created`);
  }
  rooms.get(roomName).add(ws);
}

function joinRoom(ws, roomName) {
  if (!rooms.has(roomName)) {
    ws.send(JSON.stringify({ type: 'error', message: `Room "${roomName}" does not exist` }));
    return;
  }
  leaveRoom(ws);
  rooms.get(roomName).add(ws);
  console.log(`Client joined room: "${roomName}"`);
}

function sendMessage(ws, roomName, text) {
  if (roomName && rooms.has(roomName)) {
    const clients = rooms.get(roomName);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'message', text: `${text} & ${ws.clientId}` }));
      }
    }
  } else {
    ws.send(JSON.stringify({ type: 'error', message: `Room "${roomName}" does not exist` }));
  }
}

function leaveRoom(ws) {
  rooms.forEach((clients, roomName) => {
    if (clients.has(ws)) {
      clients.delete(ws);
      if (clients.size === 0) {
        rooms.delete(roomName);
        console.log(`Room "${roomName}" deleted`);
      }
    }
  });
}

function getClientId(ws) {
  return `${ws._socket.remoteAddress}:${ws._socket.remotePort}`;
}
