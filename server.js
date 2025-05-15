const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

const rooms = new Map(); // Map<roomName, Set<client>>
const clientInfo = new Map(); // Map<ws, { id, roomName }>

wss.on('connection', (ws) => {
  const clientId = uuidv4();
  clientInfo.set(ws, { id: clientId, roomName: null });

  ws.on('message', async (data) => {
    try {
      if (typeof data === 'string') {
        const msg = JSON.parse(data);
        const info = clientInfo.get(ws);

        if (!msg.type) return;

        switch (msg.type) {
          case 'create':
            createRoom(msg.roomName, ws);
            break;

          case 'join':
            joinRoom(msg.roomName, ws);
            break;

          case 'message':
            if (info.roomName && msg.text) {
              broadcast(info.roomName, {
                type: 'message',
                text: `[${info.id.slice(0, 5)}] ${msg.text}`,
              });
            }
            break;

          case 'gps':
            if (info.roomName && msg.lat && msg.lng) {
              broadcast(info.roomName, {
                type: 'gps',
                lat: msg.lat,
                lng: msg.lng,
                senderId: info.id,
              });
            }
            break;

          case 'binary-image':
            // placeholder: next message is the actual binary image
            ws.expectingBinaryFor = msg.roomName;
            break;

          default:
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown type' }));
        }

      } else if (data instanceof Buffer && ws.expectingBinaryFor) {
        const roomName = ws.expectingBinaryFor;
        ws.expectingBinaryFor = null;

        if (rooms.has(roomName)) {
          for (const client of rooms.get(roomName)) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(data);
            }
          }
        }
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Server error: ' + err.message }));
    }
  });

  ws.on('close', () => {
    const info = clientInfo.get(ws);
    if (info?.roomName) {
      rooms.get(info.roomName)?.delete(ws);
    }
    clientInfo.delete(ws);
  });
});

function createRoom(roomName, ws) {
  if (!roomName) return;
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  rooms.get(roomName).add(ws);
  clientInfo.get(ws).roomName = roomName;
  ws.send(JSON.stringify({ type: 'message', text: `✅ Created room "${roomName}"` }));
}

function joinRoom(roomName, ws) {
  if (!roomName) return;
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  rooms.get(roomName).add(ws);
  clientInfo.get(ws).roomName = roomName;
  ws.send(JSON.stringify({ type: 'message', text: `✅ Joined room "${roomName}"` }));
}

function broadcast(roomName, msg) {
  if (!rooms.has(roomName)) return;
  const data = JSON.stringify(msg);
  for (const client of rooms.get(roomName)) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

console.log("✅ WebSocket server is running on port " + (process.env.PORT || 8080));
