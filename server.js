const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid'); // Using UUID for unique client IDs

const wss = new WebSocket.Server({ port: 8080 });
const rooms = new Map();

wss.on('connection', function connection(ws) {
  console.log('A new client connected');

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
    console.log(`Room "${roomName}" created`);
  }
  joinRoom(ws, roomName);
}

function joinRoom(ws, roomName) {
  if (rooms.has(roomName)) {
    const clients = rooms.get(roomName);
    clients.add(ws);
    
    // Generate a unique ID for the new client
    const newClientId = uuidv4();
    ws.id = newClientId;

    // Send the new client their ID
    ws.send(JSON.stringify({ type: 'clientId', id: newClientId }));

    // Notify all other clients in the room about the new client
    clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'newClient', id: newClientId }));
      }
    });

    console.log(`Client joined room: "${roomName}" with ID: ${newClientId}`);
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
      if (clients.size === 0) {
        rooms.delete(roomName);
        console.log(`Room "${roomName}" deleted`);
      } else {
        // Notify remaining clients about the client leaving
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'clientLeft', id: ws.id }));
          }
        });
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
