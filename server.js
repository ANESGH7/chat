const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
const rooms = new Map();

wss.on('connection', function connection(ws) {
  console.log('A client connected');
  ws.on('message', function incoming(data) {
    try {
      const msg = JSON.parse(data.toString());
      handleMessage(ws, msg);
    } catch (err) {
      console.error('Invalid JSON:', data.toString());
    }
  });

  ws.on('close', () => {
    leaveRoom(ws);
  });
});

function handleMessage(ws, msg) {
  const { type, roomName } = msg;

  switch (type) {
    case 'create':
      if (!rooms.has(roomName)) rooms.set(roomName, new Set());
      rooms.get(roomName).add(ws);
      console.log(`Room created: ${roomName}`);
      break;

    case 'join':
      if (!rooms.has(roomName)) {
        ws.send(JSON.stringify({ type: 'error', message: `Room "${roomName}" doesn't exist` }));
        return;
      }
      rooms.get(roomName).add(ws);
      console.log(`Client joined: ${roomName}`);
      break;

    case 'message':
      broadcast(roomName, { type: 'message', text: msg.text });
      break;

    case 'offer':
      broadcastOthers(ws, roomName, { type: 'offer', offer: msg.offer });
      break;

    case 'answer':
      broadcastOthers(ws, roomName, { type: 'answer', answer: msg.answer });
      break;

    case 'ice':
      broadcastOthers(ws, roomName, { type: 'ice', candidate: msg.candidate });
      break;

    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}

function broadcast(roomName, message) {
  const clients = rooms.get(roomName);
  if (!clients) return;

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
}

function broadcastOthers(sender, roomName, message) {
  const clients = rooms.get(roomName);
  if (!clients) return;

  for (const client of clients) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
}

function leaveRoom(ws) {
  for (const [roomName, clients] of rooms.entries()) {
    if (clients.delete(ws)) {
      console.log(`Client left room: ${roomName}`);
      if (clients.size === 0) {
        rooms.delete(roomName);
        console.log(`Room deleted: ${roomName}`);
      }
    }
  }
}
