// server.js
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
    default:
      console.error('Unsupported message type:', message.type);
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

    // Notify all clients in the room about the new client
    const clients = rooms.get(roomName);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'message', text: `${ws.clientId}` }));
      }
    });

    console.log(`Client joined room: "${roomName}"`);
  } else {
    console.error(`Room "${roomName}" does not exist`);
    ws.send(JSON.stringify({ type: 'error', message: `Room "${roomName}" does not exist` }));
  }
}

function leaveRoom(ws) {
  rooms.forEach((clients, roomName) => {
    if (clients.has(ws)) {
      clients.delete(ws);
      console.log('Client left room');

      // Notify remaining clients in the room
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'message', text: `${ws.clientId} left the room` }));
        }
      });

      // If room is empty, delete it
      if (clients.size === 0) {
        rooms.delete(roomName);
        console.log(`Room "${roomName}" deleted`);
      }
    }
  });
}

function sendMessage(senderWs, roomName, message) {
  if (roomName && rooms.has(roomName)) {
    const clients = rooms.get(roomName);
    clients.forEach(client => {
      if (client !== senderWs && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'message', text: message +`/${ws.clientId}`}));
      }
    });
  } else {
    console.error(`Room "${roomName}" does not exist`);
    senderWs.send(JSON.stringify({ type: 'error', message: `Room "${roomName}" does not exist` }));
  }
}

function getClientId(ws) {
  // Generate a unique identifier for the client
  return `${ws._socket.remoteAddress}:${ws._socket.remotePort}`;
}
