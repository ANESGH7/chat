const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8080 });

const rooms = new Map(); // roomName => Set of WebSocket
const clientStates = new Map(); // ws => { expectBinary, type, roomName }

wss.on("connection", ws => {
  ws.on("message", msg => {
    if (typeof msg === "string") {
      let data;
      try { data = JSON.parse(msg); } catch { return; }
      const { type, roomName, text, latitude, longitude } = data;

      switch (type) {
        case "join":
          if (!rooms.has(roomName)) rooms.set(roomName, new Set());
          rooms.get(roomName).add(ws);
          break;
        case "text":
          broadcast(roomName, { type: "text", text });
          break;
        case "gps":
          broadcast(roomName, { type: "gps", latitude, longitude });
          break;
        case "binary-image":
        case "binary-video":
        case "binary-audio":
          clientStates.set(ws, { expectBinary: true, type, roomName });
          break;
      }
    } else if (msg instanceof Buffer || msg instanceof ArrayBuffer) {
      const state = clientStates.get(ws);
      if (state && state.expectBinary && rooms.has(state.roomName)) {
        for (const client of rooms.get(state.roomName)) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(msg);
          }
        }
        clientStates.delete(ws);
      }
    }
  });

  ws.on("close", () => {
    for (const clients of rooms.values()) clients.delete(ws);
    clientStates.delete(ws);
  });
});

function broadcast(roomName, obj) {
  const json = JSON.stringify(obj);
  const clients = rooms.get(roomName);
  if (clients) {
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) client.send(json);
    }
  }
}

console.log("✅ WebSocket server running on ws://localhost:8080");
