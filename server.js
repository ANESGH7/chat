// server.js
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const wss = new WebSocket.Server({ port: 8080 });

console.log("Server listening on ws://localhost:8080");

let videoCounter = 0;
let audioCounter = 0;

wss.on('connection', (ws) => {
  console.log("Client connected.");

  ws.on('message', (data) => {
    if (typeof data === 'string') {
      // Optional: parse text commands (like room, type info)
      try {
        const msg = JSON.parse(data);
        console.log('Text message:', msg);
      } catch (e) {
        console.log('Invalid JSON:', data);
      }
    } else if (Buffer.isBuffer(data)) {
      // Binary data received (image or audio blob)
      const magicBytes = data.slice(0, 4).toString('hex');

      if (magicBytes.startsWith('ffd8')) {
        // JPEG image frame (video)
        const filePath = path.join(__dirname, 'video_frame_' + (videoCounter++) + '.jpg');
        fs.writeFileSync(filePath, data);
        console.log(`Saved video frame: ${filePath}`);
      } else if (magicBytes === '52494646') {
        // WAV file header ('RIFF') - audio blob
        const filePath = path.join(__dirname, 'audio_' + (audioCounter++) + '.wav');
        fs.writeFileSync(filePath, data);
        console.log(`Saved audio chunk: ${filePath}`);
      } else {
        // Unknown binary
        const filePath = path.join(__dirname, 'unknown_' + Date.now());
        fs.writeFileSync(filePath, data);
        console.log(`Saved unknown binary: ${filePath}`);
      }
    }
  });

  ws.on('close', () => {
    console.log("Client disconnected.");
  });
});
