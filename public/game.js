import {
  applyBombHit,
  applyFruitMiss,
  formatLives,
  shouldEndRound
} from "./game-rules.js";

const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");
const qrCanvas = document.querySelector("#qr-canvas");
const waitingPanel = document.querySelector("#waiting-panel");
const roomCodeEl = document.querySelector("#room-code");
const hudRoomEl = document.querySelector("#hud-room");
const statusCopy = document.querySelector("#status-copy");
const controllerLink = document.querySelector("#controller-link");
const scoreEl = document.querySelector("#score");
const livesEl = document.querySelector("#lives");
const connectionPill = document.querySelector("#connection-pill");
const practiceButton = document.querySelector("#practice-button");
const resetButton = document.querySelector("#reset-button");
const infiniteButton = document.querySelector("#infinite-button");

const params = new URLSearchParams(window.location.search);
let roomId = params.get("room")?.toUpperCase() || createRoomCode();
let width = 0;
let height = 0;
let dpr = 1;
let ws;
let running = false;
let controllerConnected = false;
let practiceMode = false;
let roundState = "waiting";
let motionPackets = 0;
let lastTime = performance.now();
let spawnTimer = 0;
let score = 0;
let lives = 5;
let infiniteLives = false;
let audioContext;

const fruits = [];
const particles = [];
const blade = {
  x: 0,
  y: 0,
  px: 0,
  py: 0,
  targetX: 0,
  targetY: 0,
  trail: []
};

function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (!blade.x && !blade.y) {
    blade.x = width / 2;
    blade.y = height / 2;
    blade.px = blade.x;
    blade.py = blade.y;
    blade.targetX = blade.x;
    blade.targetY = blade.y;
  }
}

function wsUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

async function chooseControllerOrigin() {
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!localHosts.has(window.location.hostname)) {
    return window.location.origin;
  }

  try {
    const response = await fetch("/api/network");
    const data = await response.json();
    return data.localNetworkUrls?.[0] || window.location.origin;
  } catch {
    return window.location.origin;
  }
}

async function renderQr() {
  const origin = await chooseControllerOrigin();
  const url = `${origin}/controller?room=${encodeURIComponent(roomId)}`;

  roomCodeEl.textContent = roomId;
  hudRoomEl.textContent = roomId;
  controllerLink.href = url;
  controllerLink.textContent = url;

  const response = await fetch(`/api/qr?text=${encodeURIComponent(url)}`);
  const { dataUrl } = await response.json();
  const qrImage = new Image();
  await new Promise((resolve, reject) => {
    qrImage.addEventListener("load", resolve, { once: true });
    qrImage.addEventListener("error", reject, { once: true });
    qrImage.src = dataUrl;
  });

  const qrContext = qrCanvas.getContext("2d");
  qrContext.clearRect(0, 0, qrCanvas.width, qrCanvas.height);
  qrContext.drawImage(qrImage, 0, 0, qrCanvas.width, qrCanvas.height);
}

function setStatus(copy, pill = copy) {
  statusCopy.textContent = copy;
  connectionPill.textContent = pill;
}

function currentLifeState() {
  return { lives, infiniteLives };
}

function setLifeState(nextState) {
  lives = nextState.lives;
  infiniteLives = nextState.infiniteLives;
  livesEl.textContent = formatLives(currentLifeState());
}

function updateModeButton() {
  infiniteButton.setAttribute("aria-pressed", String(infiniteLives));
  infiniteButton.querySelector("span").textContent = infiniteLives
    ? "Infinite lives on"
    : "Infinite lives off";
}

function connectWebSocket() {
  ws = new WebSocket(wsUrl());

  ws.addEventListener("open", () => {
    ws.send(JSON.stringify({ type: "join-game", roomId }));
    setStatus("Scan the QR code with your phone.", "Waiting");
  });

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);

    if (message.type === "controller-joined") {
      controllerConnected = true;
      practiceMode = false;
      motionPackets = 0;
      roundState = "waiting";
      resetRound();
      waitingPanel.classList.remove("is-hidden");
      setStatus("Phone connected. Tap Enable motion on your phone.", "Phone linked");
    }

    if (message.type === "controller-left") {
      controllerConnected = false;
      practiceMode = false;
      running = false;
      roundState = "waiting";
      waitingPanel.classList.remove("is-hidden");
      setStatus("Controller disconnected.", "Waiting");
    }

    if (message.type === "motion") {
      handleMotion(message);
    }
  });

  ws.addEventListener("close", () => {
    controllerConnected = false;
    running = false;
    roundState = "waiting";
    waitingPanel.classList.remove("is-hidden");
    setStatus("Reconnecting...", "Offline");
    window.setTimeout(connectWebSocket, 900);
  });
}

function handleMotion(message) {
  const normalizedX = Number.isFinite(message.x)
    ? clamp(message.x, -1, 1)
    : clamp(Number(message.gamma || 0) / 45, -1, 1);
  const normalizedY = Number.isFinite(message.y)
    ? clamp(message.y, -1, 1)
    : clamp(Number(message.beta || 0) / 45, -1, 1);

  blade.targetX = (normalizedX + 1) * 0.5 * width;
  blade.targetY = (normalizedY + 1) * 0.5 * height;

  motionPackets += 1;
  if (roundState === "waiting") {
    startGame();
  }

  if (motionPackets === 1 || motionPackets % 60 === 0) {
    const source = message.source ? ` (${message.source})` : "";
    setStatus(`Motion streaming${source}.`, "Motion");
  }
}

function startGame() {
  unlockAudio();
  if (lives <= 0) {
    resetRound();
  }
  running = true;
  roundState = "playing";
  waitingPanel.classList.add("is-hidden");
}

function resetRound() {
  fruits.length = 0;
  particles.length = 0;
  blade.trail.length = 0;
  running = false;
  score = 0;
  lives = 5;
  spawnTimer = 0;
  scoreEl.textContent = score;
  livesEl.textContent = formatLives(currentLifeState());
}

function spawnItem() {
  const radius = 24 + Math.random() * 22;
  const palette = ["#ffbd4a", "#ff5a7a", "#8f7cff", "#48d17a", "#f9f871"];
  const kind = Math.random() < 0.18 ? "bomb" : "fruit";
  fruits.push({
    kind,
    x: radius + Math.random() * (width - radius * 2),
    y: -radius,
    vx: -70 + Math.random() * 140,
    vy: 150 + Math.random() * 120,
    spin: -3 + Math.random() * 6,
    angle: Math.random() * Math.PI * 2,
    radius,
    color: kind === "bomb" ? "#111827" : palette[Math.floor(Math.random() * palette.length)],
    sliced: false
  });
}

function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

function sliceFruit(fruit) {
  fruit.sliced = true;
  score += 10;
  scoreEl.textContent = score;
  playSliceSound();

  for (let i = 0; i < 24; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 90 + Math.random() * 260;
    particles.push({
      x: fruit.x,
      y: fruit.y,
      vx: Math.cos(angle) * speed + fruit.vx * 0.2,
      vy: Math.sin(angle) * speed + fruit.vy * 0.2,
      size: 3 + Math.random() * 7,
      life: 420 + Math.random() * 360,
      maxLife: 780,
      color: Math.random() > 0.22 ? fruit.color : "#ffffff"
    });
  }
}

function hitBomb(bomb) {
  bomb.sliced = true;
  setLifeState(applyBombHit(currentLifeState()));
  playBombSound();

  for (let i = 0; i < 34; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 120 + Math.random() * 330;
    particles.push({
      x: bomb.x,
      y: bomb.y,
      vx: Math.cos(angle) * speed + bomb.vx * 0.2,
      vy: Math.sin(angle) * speed + bomb.vy * 0.2,
      size: 3 + Math.random() * 9,
      life: 360 + Math.random() * 420,
      maxLife: 780,
      color: Math.random() > 0.35 ? "#ff5a7a" : "#f9f871"
    });
  }

  if (shouldEndRound(currentLifeState())) {
    running = false;
    roundState = "gameover";
    waitingPanel.classList.remove("is-hidden");
    setStatus("Bomb got you. Reset or try infinite lives.", controllerConnected ? "Phone linked" : "Waiting");
  }
}

function update(dt) {
  blade.px = blade.x;
  blade.py = blade.y;
  blade.x += (blade.targetX - blade.x) * Math.min(1, dt * 14);
  blade.y += (blade.targetY - blade.y) * Math.min(1, dt * 14);
  blade.trail.push({ x: blade.x, y: blade.y, age: 0 });

  for (const point of blade.trail) {
    point.age += dt * 1000;
  }
  while (blade.trail.length && blade.trail[0].age > 190) {
    blade.trail.shift();
  }

  if (running) {
    spawnTimer -= dt * 1000;
    if (spawnTimer <= 0) {
      spawnItem();
      spawnTimer = Math.max(310, 820 - score * 2) + Math.random() * 280;
    }
  }

  for (const fruit of fruits) {
    fruit.x += fruit.vx * dt;
    fruit.y += fruit.vy * dt;
    fruit.vy += 42 * dt;
    fruit.angle += fruit.spin * dt;

    if (!fruit.sliced && running) {
      const distance = segmentDistance(fruit.x, fruit.y, blade.px, blade.py, blade.x, blade.y);
      if (distance <= fruit.radius + 10) {
        if (fruit.kind === "bomb") {
          hitBomb(fruit);
        } else {
          sliceFruit(fruit);
        }
      }
    }
  }

  for (let i = fruits.length - 1; i >= 0; i -= 1) {
    const fruit = fruits[i];
    if (fruit.sliced) {
      fruits.splice(i, 1);
      continue;
    }

    if (fruit.y - fruit.radius > height) {
      fruits.splice(i, 1);
      if (running && fruit.kind !== "bomb") {
        setLifeState(applyFruitMiss(currentLifeState()));
      }
    }
  }

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.life -= dt * 1000;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 420 * dt;
    if (particle.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function drawBackground() {
  ctx.fillStyle = "#080a0f";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "#253044";
  ctx.lineWidth = 1;
  const gap = 72;
  for (let x = -gap; x < width + gap; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + width * 0.18, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gap) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y + height * 0.08);
    ctx.stroke();
  }
  ctx.restore();
}

function drawItems() {
  for (const fruit of fruits) {
    if (fruit.kind === "bomb") {
      drawBomb(fruit);
      continue;
    }

    ctx.save();
    ctx.translate(fruit.x, fruit.y);
    ctx.rotate(fruit.angle);

    ctx.fillStyle = fruit.color;
    ctx.beginPath();
    ctx.arc(0, 0, fruit.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
    ctx.beginPath();
    ctx.arc(-fruit.radius * 0.32, -fruit.radius * 0.36, fruit.radius * 0.24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2f9b63";
    ctx.beginPath();
    ctx.ellipse(fruit.radius * 0.18, -fruit.radius * 0.92, fruit.radius * 0.18, fruit.radius * 0.34, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBomb(bomb) {
  ctx.save();
  ctx.translate(bomb.x, bomb.y);
  ctx.rotate(bomb.angle * 0.35);

  ctx.fillStyle = "#10131b";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, bomb.radius * 0.92, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#2b3442";
  ctx.fillRect(-bomb.radius * 0.26, -bomb.radius * 1.1, bomb.radius * 0.52, bomb.radius * 0.32);

  ctx.strokeStyle = "#f9f871";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -bomb.radius * 1.12);
  ctx.quadraticCurveTo(bomb.radius * 0.38, -bomb.radius * 1.44, bomb.radius * 0.7, -bomb.radius * 1.18);
  ctx.stroke();

  ctx.fillStyle = "#ff5a7a";
  ctx.beginPath();
  ctx.arc(bomb.radius * 0.8, -bomb.radius * 1.1, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.beginPath();
  ctx.arc(-bomb.radius * 0.28, -bomb.radius * 0.32, bomb.radius * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBlade() {
  if (blade.trail.length < 2) {
    return;
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let pass = 0; pass < 3; pass += 1) {
    ctx.beginPath();
    blade.trail.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });

    if (pass === 0) {
      ctx.strokeStyle = "rgba(98, 247, 213, 0.18)";
      ctx.lineWidth = 34;
      ctx.shadowColor = "rgba(98, 247, 213, 0.8)";
      ctx.shadowBlur = 28;
    } else if (pass === 1) {
      ctx.strokeStyle = "rgba(98, 247, 213, 0.72)";
      ctx.lineWidth = 14;
      ctx.shadowBlur = 18;
    } else {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.shadowBlur = 8;
    }

    ctx.stroke();
  }

  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(249, 248, 113, 0.85)";
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(blade.x, blade.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw() {
  drawBackground();
  drawItems();
  drawParticles();
  drawBlade();
}

function tick(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(tick);
}

function unlockAudio() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playTone(frequency, duration, gainValue) {
  if (!audioContext || audioContext.state !== "running") {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = frequency;
  oscillator.type = "sawtooth";
  gain.gain.setValueAtTime(gainValue, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function playSliceSound() {
  playTone(520 + Math.random() * 160, 0.08, 0.045);
}

function playMissSound() {
  playTone(150, 0.12, 0.035);
}

function playBombSound() {
  playTone(90, 0.18, 0.06);
}

function handlePointerMove(event) {
  if (!practiceMode) {
    return;
  }

  blade.targetX = event.clientX;
  blade.targetY = event.clientY;
}

practiceButton.addEventListener("click", () => {
  practiceMode = true;
  controllerConnected = false;
  setStatus("Practice mode.", "Practice");
  resetRound();
  startGame();
});

resetButton.addEventListener("click", async () => {
  roomId = createRoomCode();
  params.set("room", roomId);
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "join-game", roomId }));
  }
  await renderQr();
  roundState = "waiting";
  motionPackets = 0;
  waitingPanel.classList.remove("is-hidden");
  setStatus("Scan the QR code with your phone.", "Waiting");
});

infiniteButton.addEventListener("click", () => {
  infiniteLives = !infiniteLives;
  livesEl.textContent = formatLives(currentLifeState());
  updateModeButton();
});

window.addEventListener("resize", resize);
window.addEventListener("pointermove", handlePointerMove);
window.addEventListener("pointerdown", unlockAudio);

resize();
resetRound();
updateModeButton();
renderQr();
connectWebSocket();
requestAnimationFrame(tick);
