const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
const rooms = new Map();
let nextClientId = 1; // Counter for assigning client IDs

wss.on('connection', function connection(ws) {
  ws.clientId = nextClientId++; // Assign a unique client ID
  console.log(`Client ${ws.clientId} connected`);

  ws.on('message', function incoming(message) {
    try {
      const data = JSON.parse(message);
      handleIncomingMessage(ws, data);
    } catch (error) {
      console.error('Invalid JSON received:', message);
    }
  });

  ws.on('close', function () {
    console.log(`Client ${ws.clientId} disconnected`);
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
    console.log(`Client ${ws.clientId} joined room "${roomName}"`);

    // Send a welcome message with client ID to the newly joined client
    ws.send(JSON.stringify({ type: 'info', message: 'hi i am new', clientId: ws.clientId }));

    // Notify other clients in the room about the new client
    sendMessageToRoom(roomName, {
      type: 'info',
      message: `Client ${ws.clientId} has joined the room`
    });
  } else {
    console.error(`Room "${roomName}" does not exist`);
    ws.send(JSON.stringify({ type: 'error', message: `Room "${roomName}" does not exist` }));
  }
}

function leaveRoom(ws) {
  rooms.forEach((clients, roomName) => {
    if (clients.has(ws)) {
      clients.delete(ws);
      console.log(`Client ${ws.clientId} left room`);
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
        client.send(JSON.stringify({ type: 'message', text: message }));
      }
    });
  } else {
    console.error(`Room "${roomName}" does not exist`);
    senderWs.send(JSON.stringify({ type: 'error', message: `Room "${roomName}" does not exist` }));
  }
}

function sendMessageToRoom(roomName, messageObj) {
  if (rooms.has(roomName)) {
    const clients = rooms.get(roomName);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(messageObj));
      }
    });
  } else {
    console.error(`Room "${roomName}" does not exist`);
  }
}
