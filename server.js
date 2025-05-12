// Node.js WebSocket server with support for rooms and image messages
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
const rooms = new Map();

wss.on('connection', function connection(ws) {
  console.log('A new client connected');
  ws.clientId = getClientId(ws);

  ws.on('message', function incoming(message) {
    try {
      const data = JSON.parse(message);
      handleIncomingMessage(ws, data);
    } catch (error) {
      console.error('Invalid JSON received:', message);
    }
  });

  ws.on('close', function () {
    console.log('Client disconnected');
    leaveRoom(ws);
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
    default:
      console.error('Unsupported message type:', message.type);
  }
}

function sendImage(senderWs, roomName, imageData) {
  if (roomName && rooms.has(roomName)) {
    const clients = rooms.get(roomName);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'image', data: imageData }));
      }
    });
  }
}

function createRoom(ws, roomName) {
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  rooms.get(roomName).add(ws);
  console.log(`Room "${roomName}" created`);
}

function joinRoom(ws, roomName) {
  if (rooms.has(roomName)) {
    rooms.get(roomName).add(ws);
    console.log(`Client joined room: "${roomName}"`);
  } else {
    ws.send(JSON.stringify({ type: 'error', message: `Room "${roomName}" does not exist` }));
  }
}

function sendMessage(senderWs, roomName, message) {
  if (roomName && rooms.has(roomName)) {
    const clients = rooms.get(roomName);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'message', text: `${message} & ${senderWs.clientId}` }));
      }
    });
  } else {
    senderWs.send(JSON.stringify({ type: 'error', message: `Room "${roomName}" does not exist` }));
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
