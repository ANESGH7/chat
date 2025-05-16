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
});             and           <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>WebSocket Chat with Live Video + Audio + GPS</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    #messageLog { border: 1px solid #ccc; padding: 10px; height: 150px; overflow-y: auto; margin-bottom: 10px; }
    canvas { max-width: 100%; border: 1px solid #ccc; }
    .section { margin-bottom: 20px; }
    #map { height: 300px; }
  </style>
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
</head>
<body>
  <h2>📡 WebSocket Chat App with Live Video, Voice & GPS</h2>

  <div class="section">
    <input type="text" id="roomName" placeholder="Room name" />
    <button onclick="createRoom()">Create</button>
    <button onclick="joinRoom()">Join</button>
  </div>

  <div class="section">
    <input type="text" id="textMessage" placeholder="Enter message" />
    <button onclick="sendMessage()">Send Message</button>
    <button onclick="clearMessages()">🧹 Clear</button>
  </div>

  <div class="section">
    <label for="videoQualitySelect"><strong>Video Quality:</strong></label>
    <select id="videoQualitySelect">
      <option value="veryLow120p">Very Low (120p)</option>
      <option value="low240p">Low (240p)</option>
      <option value="low360p">Medium-Low (360p)</option>
      <option value="low480p">Low (480p)</option>
      <option value="medium" selected>Medium (720p)</option>
      <option value="high">High (1080p)</option>
    </select><br/>
    <label for="fpsSlider">FPS:</label>
    <input type="range" id="fpsSlider" min="5" max="60" value="30" step="1">
    <span id="fpsValue">30</span> FPS<br/>
    <button id="videoButton" onclick="toggleLiveVideo()">📷 Start Live Video + Voice</button>
  </div>

  <div class="section">
    <label><strong>GPS Interval (seconds):</strong></label>
    <input type="number" id="gpsIntervalInput" min="1" value="5" />
    <button onclick="startGps()">📍 Start GPS</button>
    <button onclick="stopGps()">🛑 Stop GPS</button>
    <div id="gpsDisplay">Location: N/A</div>
  </div>

  <div class="section">
    <h3>💬 Messages</h3>
    <div id="messageLog"></div>
  </div>

  <div class="section">
    <h3>🎥 Received Live Video</h3>
    <canvas id="videoCanvas" width="320" height="240"></canvas>
  </div>

  <div class="section">
    <h3>🔊 Received Voice</h3>
    <audio id="audioPlayer" autoplay></audio>
  </div>

  <div class="section">
    <h3>🗺️ Map</h3>
    <div id="map"></div>
  </div>

  <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
  <script>
    const ws = new WebSocket("wss://chat-643f.onrender.com");
    ws.binaryType = "arraybuffer";
    let currentRoom = "";
    let sendingVideo = false;
    let videoInterval = null;
    let activeStream = null;
    let audioRecorder = null;
    let watchId = null;
    let gpsSendInterval = null;
    let latestPosition = null;
    let clientId = Math.random().toString(36).substring(2, 10);
    let markerMap = {};

    const map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    ws.onopen = () => logMessage("✅ Connected to WebSocket server");

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "message") {
            logMessage("💬 " + msg.text);
            const gpsMatch = msg.text.match(/^GPS:([\d.-]+),([\d.-]+) & (.+)$/);
            if (gpsMatch) {
              const lat = parseFloat(gpsMatch[1]);
              const lng = parseFloat(gpsMatch[2]);
              const senderId = gpsMatch[3];
              if (!markerMap[senderId]) {
                markerMap[senderId] = L.marker([lat, lng]).addTo(map).bindPopup("Client: " + senderId);
              } else {
                markerMap[senderId].setLatLng([lat, lng]);
              }
            }
          } else if (msg.type === "error") {
            logMessage("❌ " + msg.message);
          }
        } catch (e) {
          logMessage("❗ Invalid message: " + event.data);
        }
      } else {
        const dataView = new DataView(event.data);
        const typeByte = new Uint8Array(event.data.slice(0, 1))[0];
        const payload = event.data.slice(1);

        if (typeByte === 1) { // 1 = video
          const blob = new Blob([payload], { type: "image/jpeg" });
          const img = new Image();
          img.onload = () => {
            const canvas = document.getElementById("videoCanvas");
            const ctx = canvas.getContext("2d");
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
          };
          img.src = URL.createObjectURL(blob);
        } else if (typeByte === 2) { // 2 = audio
          const blob = new Blob([payload], { type: "audio/webm" });
          const audio = document.getElementById("audioPlayer");
          audio.src = URL.createObjectURL(blob);
        }
      }
    };

    function createRoom() {
      const roomName = document.getElementById("roomName").value.trim();
      if (!roomName) return;
      currentRoom = roomName;
      ws.send(JSON.stringify({ type: "create", roomName }));
      logMessage("📂 Created room: " + roomName);
    }

    function joinRoom() {
      const roomName = document.getElementById("roomName").value.trim();
      if (!roomName) return;
      currentRoom = roomName;
      ws.send(JSON.stringify({ type: "join", roomName }));
      logMessage("📥 Joined room: " + roomName);
    }

    function sendMessage() {
      const text = document.getElementById("textMessage").value.trim();
      if (!text || !currentRoom) return;
      ws.send(JSON.stringify({ type: "message", roomName: currentRoom, text }));
      document.getElementById("textMessage").value = "";
    }

    function clearMessages() {
      document.getElementById("messageLog").innerHTML = "";
    }

    async function toggleLiveVideo() {
      const button = document.getElementById("videoButton");
      if (sendingVideo) {
        clearInterval(videoInterval);
        sendingVideo = false;
        button.textContent = "📷 Start Live Video + Voice";
        if (activeStream) activeStream.getTracks().forEach(t => t.stop());
        if (audioRecorder) audioRecorder.stop();
        return;
      }

      const constraints = getVideoConstraints();
      constraints.audio = true;

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = stream;

        // Send video frames
        const video = document.createElement("video");
        video.srcObject = stream;
        await video.play();

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        sendingVideo = true;
        button.textContent = "🛑 Stop Live Video + Voice";

        const fps = parseInt(document.getElementById("fpsSlider").value);
        videoInterval = setInterval(() => {
          if (!currentRoom || video.videoWidth === 0) return;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(blob => {
            if (!blob) return;
            ws.send(JSON.stringify({ type: "binary-image", roomName: currentRoom }));
            const prefix = new Uint8Array([1]); // 1 = video
            blob.arrayBuffer().then(buf => {
              const merged = new Uint8Array(prefix.length + buf.byteLength);
              merged.set(prefix, 0);
              merged.set(new Uint8Array(buf), prefix.length);
              ws.send(merged);
            });
          }, "image/jpeg", 0.6);
        }, 1000 / fps);

        // Send audio
        audioRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        audioRecorder.ondataavailable = (e) => {
          if (!currentRoom || !e.data.size) return;
          const prefix = new Uint8Array([2]); // 2 = audio
          e.data.arrayBuffer().then(buf => {
            const merged = new Uint8Array(prefix.length + buf.byteLength);
            merged.set(prefix, 0);
            merged.set(new Uint8Array(buf), prefix.length);
            ws.send(merged);
          });
        };
        audioRecorder.start(1000); // chunk every 1s
      } catch (err) {
        logMessage("🚫 Media error: " + err.message);
      }
    }

    function getVideoConstraints() {
      switch (document.getElementById("videoQualitySelect").value) {
        case "veryLow120p": return { video: { width: 160, height: 120, frameRate: 10 }};
        case "low240p": return { video: { width: 426, height: 240, frameRate: 15 }};
        case "low360p": return { video: { width: 640, height: 360, frameRate: 15 }};
        case "low480p": return { video: { width: 854, height: 480, frameRate: 20 }};
        case "high": return { video: { width: 1920, height: 1080, frameRate: 30 }};
        case "medium":
        default: return { video: { width: 1280, height: 720, frameRate: 30 }};
      }
    }

    function startGps() {
      stopGps();
      if (!navigator.geolocation) return logMessage("🚫 Geolocation not supported.");
      if (!currentRoom) return logMessage("⚠️ Join or create a room first!");

      const intervalSec = Math.max(1, parseInt(document.getElementById("gpsIntervalInput").value));
      watchId = navigator.geolocation.watchPosition(pos => {
        latestPosition = pos;
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        document.getElementById("gpsDisplay").textContent = `Location: ${lat}, ${lng}`;
      }, err => {
        logMessage("🚫 GPS error: " + err.message);
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 });

      gpsSendInterval = setInterval(() => {
        if (!latestPosition) return;
        const lat = latestPosition.coords.latitude.toFixed(6);
        const lng = latestPosition.coords.longitude.toFixed(6);
        const text = `GPS:${lat},${lng} & ${clientId}`;
        ws.send(JSON.stringify({ type: "message", roomName: currentRoom, text }));
      }, intervalSec * 1000);

      logMessage("📍 Started GPS (every " + intervalSec + "s)");
    }

    function stopGps() {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (gpsSendInterval !== null) clearInterval(gpsSendInterval);
      latestPosition = null;
      logMessage("🛑 Stopped GPS");
      document.getElementById("gpsDisplay").textContent = "Location: N/A";
    }

    function logMessage(text) {
      const div = document.createElement("div");
      div.textContent = text;
      document.getElementById("messageLog").appendChild(div);
      document.getElementById("messageLog").scrollTop = document.getElementById("messageLog").scrollHeight;
    }

    document.getElementById("fpsSlider").addEventListener("input", (e) => {
      document.getElementById("fpsValue").textContent = e.target.value;
    });
  </script>
</body>
</html>    not work verey will fix it and give me full code
