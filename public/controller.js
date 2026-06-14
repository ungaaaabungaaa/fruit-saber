const roomEl = document.querySelector("#controller-room");
const statusEl = document.querySelector("#controller-status");
const enableButton = document.querySelector("#enable-motion");
const calibrateButton = document.querySelector("#calibrate-motion");
const tiltDot = document.querySelector("#tilt-dot");
const alphaValue = document.querySelector("#alpha-value");
const betaValue = document.querySelector("#beta-value");
const gammaValue = document.querySelector("#gamma-value");

const params = new URLSearchParams(window.location.search);
const roomId = params.get("room")?.toUpperCase();
let ws;
let motionEnabled = false;
let orientationSamples = 0;
let motionSamples = 0;
let packetsSent = 0;
let lastSend = 0;
const neutral = {
  beta: 0,
  gamma: 0,
  accelX: 0,
  accelY: 0,
  hasOrientation: false,
  hasMotion: false
};
const latest = {
  alpha: 0,
  beta: 0,
  gamma: 0,
  accelX: 0,
  accelY: 0,
  accelZ: 0
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wsUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

function setStatus(copy) {
  statusEl.textContent = copy;
}

function connect() {
  if (!roomId) {
    setStatus("Missing room code.");
    enableButton.disabled = true;
    return;
  }

  ws = new WebSocket(wsUrl());

  ws.addEventListener("open", () => {
    ws.send(JSON.stringify({ type: "join-controller", roomId }));
    setStatus("Connected. Tap Enable motion.");
  });

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "game-left") {
      setStatus("Game display disconnected.");
    }
    if (message.type === "game-joined" || message.type === "room-status") {
      setStatus(motionEnabled ? sensorStatusCopy() : "Connected. Tap Enable motion.");
    }
  });

  ws.addEventListener("close", () => {
    setStatus("Reconnecting...");
    window.setTimeout(connect, 900);
  });
}

async function requestMotionAccess() {
  const permissionAPIs = [
    window.DeviceMotionEvent,
    window.DeviceOrientationEvent
  ].filter(Boolean);

  for (const api of permissionAPIs) {
    if (typeof api.requestPermission === "function") {
      const result = await api.requestPermission();
      if (result !== "granted") {
        throw new Error("Motion permission was not granted.");
      }
    }
  }
}

function setNeutral() {
  neutral.beta = latest.beta;
  neutral.gamma = latest.gamma;
  neutral.accelX = latest.accelX;
  neutral.accelY = latest.accelY;
  neutral.hasOrientation = orientationSamples > 0;
  neutral.hasMotion = motionSamples > 0;
}

function normalizedTilt() {
  if (orientationSamples > 0) {
    if (!neutral.hasOrientation) {
      neutral.beta = latest.beta;
      neutral.gamma = latest.gamma;
      neutral.hasOrientation = true;
    }

    return {
      x: clamp((latest.gamma - neutral.gamma) / 38, -1, 1),
      y: clamp((latest.beta - neutral.beta) / 42, -1, 1),
      source: "orientation"
    };
  }

  if (motionSamples > 0) {
    if (!neutral.hasMotion) {
      neutral.accelX = latest.accelX;
      neutral.accelY = latest.accelY;
      neutral.hasMotion = true;
    }

    return {
      x: clamp((latest.accelX - neutral.accelX) / 6, -1, 1),
      y: clamp((latest.accelY - neutral.accelY) / 6, -1, 1),
      source: "acceleration"
    };
  }

  return { x: 0, y: 0, source: "waiting" };
}

function sensorStatusCopy() {
  if (!motionEnabled) {
    return "Connected. Tap Enable motion.";
  }

  const tilt = normalizedTilt();
  if (tilt.source === "waiting") {
    return window.isSecureContext
      ? "Waiting for sensor samples..."
      : "Waiting for sensors. iPhone needs HTTPS.";
  }

  return `Streaming ${tilt.source}. Packets ${packetsSent}.`;
}

function updateReadout() {
  const { x, y } = normalizedTilt();
  alphaValue.textContent = latest.alpha.toFixed(1);
  betaValue.textContent = latest.beta.toFixed(1);
  gammaValue.textContent = latest.gamma.toFixed(1);
  tiltDot.style.left = `${(x + 1) * 50}%`;
  tiltDot.style.top = `${(y + 1) * 50}%`;
}

function sendMotion(now) {
  if (!motionEnabled || !ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  if (now - lastSend < 28) {
    return;
  }

  lastSend = now;
  const tilt = normalizedTilt();
  if (tilt.source === "waiting") {
    setStatus(sensorStatusCopy());
    return;
  }

  packetsSent += 1;
  ws.send(JSON.stringify({
    type: "motion",
    alpha: latest.alpha,
    beta: latest.beta,
    gamma: latest.gamma,
    x: tilt.x,
    y: tilt.y,
    z: latest.accelZ,
    source: tilt.source,
    sequence: packetsSent
  }));

  if (packetsSent === 1 || packetsSent % 30 === 0) {
    setStatus(sensorStatusCopy());
  }
}

function animationLoop(now) {
  updateReadout();
  sendMotion(now);
  requestAnimationFrame(animationLoop);
}

function handleOrientation(event) {
  latest.alpha = Number(event.alpha || 0);
  latest.beta = Number(event.beta || 0);
  latest.gamma = Number(event.gamma || 0);
  orientationSamples += 1;

  if (!neutral.hasOrientation) {
    neutral.beta = latest.beta;
    neutral.gamma = latest.gamma;
    neutral.hasOrientation = true;
  }
}

function handleMotion(event) {
  const acceleration = event.accelerationIncludingGravity || event.acceleration || {};
  latest.accelX = Number(acceleration.x || 0);
  latest.accelY = Number(acceleration.y || 0);
  latest.accelZ = Number(acceleration.z || 0);
  motionSamples += 1;

  if (!neutral.hasMotion) {
    neutral.accelX = latest.accelX;
    neutral.accelY = latest.accelY;
    neutral.hasMotion = true;
  }
}

async function enableMotion() {
  try {
    enableButton.disabled = true;
    setStatus("Requesting motion...");
    await requestMotionAccess();
    window.addEventListener("deviceorientation", handleOrientation);
    window.addEventListener("devicemotion", handleMotion);
    motionEnabled = true;
    calibrateButton.disabled = false;
    setNeutral();
    setStatus(window.isSecureContext ? "Move the phone to start." : "Move the phone. iPhone needs HTTPS.");
  } catch (error) {
    enableButton.disabled = false;
    setStatus(error.message);
  }
}

roomEl.textContent = roomId || "------";
enableButton.addEventListener("click", enableMotion);
calibrateButton.addEventListener("click", () => {
  setNeutral();
  setStatus("Calibrated. Move the phone.");
});

connect();
requestAnimationFrame(animationLoop);
