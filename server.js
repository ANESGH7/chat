const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
const rooms = new Map(); // Map<roomName, Set<ws>>
const clientStates = new Map(); // Map<ws, { type, roomName, userId, location? }>
const locations = new Map(); // Map<roomName, Map<userId, {latitude, longitude}>>

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
    removeLocation(ws);
  });
});

function handleIncomingMessage(ws, message) {
  switch (message.type) {
    case 'create':
      createRoom(ws, message.roomName);
      break;
    case 'join':
      joinRoom(ws, message.roomName, message.userId);
      break;
    case 'message':
      sendMessage(ws, message.roomName, message.text);
      break;
    case 'binary-image':
      clientStates.set(ws, { type: 'binary-image', roomName: message.roomName });
      break;
    case 'location': // NEW: handle GPS location updates
      if (message.roomName && message.userId && typeof message.latitude === 'number' && typeof message.longitude === 'number') {
        updateLocation(ws, message.roomName, message.userId, message.latitude, message.longitude);
      } else {
        console.warn('Invalid location message', message);
      }
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
    locations.set(roomName, new Map());
    console.log(`Room "${roomName}" created`);
  }
  rooms.get(roomName).add(ws);
  clientStates.set(ws, { roomName, userId: ws.clientId });
}

function joinRoom(ws, roomName, userId) {
  if (!rooms.has(roomName)) {
    ws.send(JSON.stringify({ type: 'error', message: `Room "${roomName}" does not exist` }));
    return;
  }
  leaveRoom(ws);
  rooms.get(roomName).add(ws);
  clientStates.set(ws, { roomName, userId: userId || ws.clientId });
  console.log(`Client joined room: "${roomName}" with userId: ${userId || ws.clientId}`);
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
      clientStates.delete(ws);
      removeLocation(ws, roomName);
      if (clients.size === 0) {
        rooms.delete(roomName);
        locations.delete(roomName);
        console.log(`Room "${roomName}" deleted`);
      }
    }
  });
}

function getClientId(ws) {
  return `${ws._socket.remoteAddress}:${ws._socket.remotePort}`;
}

// === New GPS location support ===

function updateLocation(ws, roomName, userId, latitude, longitude) {
  if (!rooms.has(roomName)) return;

  if (!locations.has(roomName)) {
    locations.set(roomName, new Map());
  }
  const roomLocations = locations.get(roomName);

  roomLocations.set(userId, { latitude, longitude });

  broadcastLocations(roomName);
}

function removeLocation(ws, roomName) {
  // If roomName provided, remove location only there; else remove from all rooms
  if (roomName) {
    const state = clientStates.get(ws);
    const uid = state?.userId || ws.clientId;
    const locMap = locations.get(roomName);
    if (locMap) {
      locMap.delete(uid);
      broadcastLocations(roomName);
    }
  } else {
    locations.forEach((locMap, room) => {
      const state = clientStates.get(ws);
      const uid = state?.userId || ws.clientId;
      if (locMap.has(uid)) {
        locMap.delete(uid);
        broadcastLocations(room);
      }
    });
  }
}

function broadcastLocations(roomName) {
  if (!rooms.has(roomName)) return;

  const clients = rooms.get(roomName);
  const locMap = locations.get(roomName);
  if (!locMap) return;

  const allLocations = [];
  for (const [userId, coords] of locMap.entries()) {
    if (coords) {
      allLocations.push({ userId, latitude: coords.latitude, longitude: coords.longitude });
    }
  }

  const message = JSON.stringify({ type: 'locations', locations: allLocations });

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}
