import {
  applyBombHit,
  applyComboHit,
  applyComboTimer,
  applyFruitMiss,
  applyRoundTimer,
  calculateSliceScore,
  createRoomCode,
  createFruitHalves,
  formatLives,
  formatComboMultiplier,
  formatRoundTime,
  getInfiniteDurationMs,
  getSaberTheme,
  normalizeInfiniteDurationMinutes,
  resetCombo,
  shouldEndRound
} from "./game-rules.js";

const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");
const qrCanvas = document.querySelector("#qr-canvas");
const gameHud = document.querySelector("#game-hud");
const waitingPanel = document.querySelector("#waiting-panel");
const roomCodeEl = document.querySelector("#room-code");
const hudRoomEl = document.querySelector("#hud-room");
const statusCopy = document.querySelector("#status-copy");
const scoreEl = document.querySelector("#score");
const comboHud = document.querySelector("#combo-hud");
const comboEl = document.querySelector("#combo");
const comboBurstEl = document.querySelector("#combo-burst");
const livesEl = document.querySelector("#lives");
const timerEl = document.querySelector("#timer");
const playTimerEl = document.querySelector("#play-timer");
const connectionPill = document.querySelector("#connection-pill");
const practiceButton = document.querySelector("#practice-button");
const resetButton = document.querySelector("#reset-button");
const infiniteButton = document.querySelector("#infinite-button");
const durationPicker = document.querySelector("#duration-picker");
const durationButtons = Array.from(document.querySelectorAll("[data-duration-minutes]"));
const colorButtons = Array.from(document.querySelectorAll("[data-saber-color]"));

const themeCssVariables = {
  saber: "--saber",
  saber2: "--saber-2",
  saberRgb: "--saber-rgb",
  saber2Rgb: "--saber-2-rgb",
  saberSoft: "--saber-soft",
  saberGlow: "--saber-glow"
};

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
let comboStreak = 0;
let comboMultiplier = 1;
let comboTimerMs = 0;
let comboFlashMs = 0;
let lives = 5;
let infiniteLives = false;
let infiniteDurationMinutes = readStoredInfiniteDuration();
let timerRemainingMs = null;
let audioContext;
let saberTheme = getSaberTheme(readStoredSaberTheme());

const fruits = [];
const fruitHalves = [];
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function readStoredSaberTheme() {
  try {
    return window.localStorage.getItem("fruits-wtf-theme")
      || window.localStorage.getItem("saber-fruits-theme")
      || "mint";
  } catch {
    return "mint";
  }
}

function storeSaberTheme(themeId) {
  try {
    window.localStorage.setItem("fruits-wtf-theme", themeId);
  } catch {
    // Local storage can be disabled in private browsing; the game still works.
  }
}

function readStoredInfiniteDuration() {
  try {
    return normalizeInfiniteDurationMinutes(window.localStorage.getItem("fruits-wtf-duration"));
  } catch {
    return normalizeInfiniteDurationMinutes(5);
  }
}

function storeInfiniteDuration(minutes) {
  try {
    window.localStorage.setItem("fruits-wtf-duration", String(minutes));
  } catch {
    // Local storage can be disabled in private browsing; the default timer still works.
  }
}

function applySaberTheme(themeId, shouldStore = true) {
  saberTheme = getSaberTheme(themeId);
  document.documentElement.dataset.saberTheme = saberTheme.id;

  for (const [key, value] of Object.entries(saberTheme.css)) {
    document.documentElement.style.setProperty(themeCssVariables[key], value);
  }

  colorButtons.forEach((button) => {
    const selected = button.dataset.saberColor === saberTheme.id;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  if (shouldStore) {
    storeSaberTheme(saberTheme.id);
  }
}

function setInfiniteDuration(minutes, shouldStore = true) {
  infiniteDurationMinutes = normalizeInfiniteDurationMinutes(minutes);

  durationButtons.forEach((button) => {
    const selected = Number(button.dataset.durationMinutes) === infiniteDurationMinutes;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  if (infiniteLives && !running) {
    timerRemainingMs = getInfiniteDurationMs(infiniteDurationMinutes);
  }

  if (shouldStore) {
    storeInfiniteDuration(infiniteDurationMinutes);
  }

  syncRoundDisplays();
  updateModeButton();
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

function syncHudVisibility() {
  gameHud.classList.toggle("is-hidden", running);
  playTimerEl.classList.toggle("is-visible", running && infiniteLives);
  syncComboDisplays();
}

function currentLifeState() {
  return { lives, infiniteLives, timerRemainingMs };
}

function currentComboState() {
  return { comboStreak, comboMultiplier, comboTimerMs };
}

function setLifeState(nextState) {
  lives = nextState.lives;
  infiniteLives = nextState.infiniteLives;
  timerRemainingMs = Number.isFinite(nextState.timerRemainingMs)
    ? nextState.timerRemainingMs
    : timerRemainingMs;
  syncRoundDisplays();
}

function setComboState(nextState, flash = false) {
  comboStreak = nextState.comboStreak;
  comboMultiplier = nextState.comboMultiplier;
  comboTimerMs = nextState.comboTimerMs;
  if (comboMultiplier <= 1) {
    comboFlashMs = 0;
  } else if (flash) {
    comboFlashMs = 900;
  }
  syncComboDisplays();
}

function updateModeButton() {
  infiniteButton.setAttribute("aria-checked", String(infiniteLives));
  infiniteButton.querySelector(".switch-state").textContent = infiniteLives
    ? `${infiniteDurationMinutes} min`
    : "Off";
  durationPicker.hidden = !infiniteLives;
}

function syncRoundDisplays() {
  const timerText = infiniteLives
    ? formatRoundTime(timerRemainingMs ?? getInfiniteDurationMs(infiniteDurationMinutes))
    : "--";

  scoreEl.textContent = score;
  livesEl.textContent = formatLives(currentLifeState());
  timerEl.textContent = timerText;
  playTimerEl.textContent = timerText;
}

function syncComboDisplays() {
  const comboText = formatComboMultiplier(currentComboState());
  comboEl.textContent = comboText;
  comboHud.classList.toggle("is-hot", comboMultiplier > 1);
  comboHud.classList.toggle("is-max", comboMultiplier >= 6);
  comboBurstEl.textContent = `${comboText} combo`;
  comboBurstEl.classList.toggle("is-visible", running && comboMultiplier > 1 && comboFlashMs > 0);
  comboBurstEl.classList.toggle("is-max", comboMultiplier >= 6);
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
      syncHudVisibility();
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
    syncHudVisibility();
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
  if (lives <= 0 || (infiniteLives && timerRemainingMs <= 0)) {
    resetRound();
  }
  running = true;
  roundState = "playing";
  waitingPanel.classList.add("is-hidden");
  syncHudVisibility();
}

function endRound(message, pill = "Game over") {
  running = false;
  roundState = "gameover";
  waitingPanel.classList.remove("is-hidden");
  syncHudVisibility();
  setStatus(message, pill);
}

function resetRound() {
  fruits.length = 0;
  fruitHalves.length = 0;
  particles.length = 0;
  blade.trail.length = 0;
  running = false;
  score = 0;
  setComboState(resetCombo(currentComboState()));
  lives = 5;
  timerRemainingMs = infiniteLives ? getInfiniteDurationMs(infiniteDurationMinutes) : null;
  spawnTimer = 0;
  syncRoundDisplays();
  syncHudVisibility();
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
  const nextCombo = applyComboHit(currentComboState());
  setComboState(nextCombo, true);
  score += calculateSliceScore(10, nextCombo);
  syncRoundDisplays();
  playSliceSound();
  fruitHalves.push(...createFruitHalves(
    fruit,
    { x: blade.px, y: blade.py },
    { x: blade.x, y: blade.y }
  ));

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
  setComboState(resetCombo(currentComboState()));
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
    endRound("Bomb got you. Reset or try timed infinite lives.", controllerConnected ? "Phone linked" : "Waiting");
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

  if (running && infiniteLives) {
    setLifeState(applyRoundTimer(currentLifeState(), dt * 1000));
    if (shouldEndRound(currentLifeState())) {
      endRound("Time's up. Reset for another timed run.", "Time up");
    }
  }

  if (running && comboStreak > 0) {
    setComboState(applyComboTimer(currentComboState(), dt * 1000));
  }
  if (comboFlashMs > 0) {
    comboFlashMs = Math.max(0, comboFlashMs - dt * 1000);
    syncComboDisplays();
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

  for (let i = fruitHalves.length - 1; i >= 0; i -= 1) {
    const half = fruitHalves[i];
    half.life -= dt * 1000;
    half.x += half.vx * dt;
    half.y += half.vy * dt;
    half.vy += 520 * dt;
    half.angle += half.spin * dt;

    if (half.life <= 0 || half.y - half.radius > height + 80) {
      fruitHalves.splice(i, 1);
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
  ctx.fillStyle = saberTheme.canvas.background;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    blade.x,
    blade.y,
    0,
    blade.x,
    blade.y,
    Math.max(width, height) * 0.72
  );
  glow.addColorStop(0, saberTheme.canvas.glow);
  glow.addColorStop(1, "rgba(8, 10, 15, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = saberTheme.canvas.grid;
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

function drawFruitHalves() {
  for (const half of fruitHalves) {
    const fade = Math.max(0, Math.min(1, half.life / half.maxLife));
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(half.x, half.y);
    ctx.rotate(half.angle);

    ctx.fillStyle = half.color;
    ctx.beginPath();
    if (half.side < 0) {
      ctx.arc(0, 0, half.radius, Math.PI, Math.PI * 2, false);
    } else {
      ctx.arc(0, 0, half.radius, 0, Math.PI, false);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.beginPath();
    ctx.ellipse(half.side * half.radius * 0.22, -half.radius * 0.28, half.radius * 0.18, half.radius * 0.26, 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.86)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-half.radius * 0.96, 0);
    ctx.lineTo(half.radius * 0.96, 0);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = 1;
    for (let i = -0.48; i <= 0.48; i += 0.24) {
      ctx.beginPath();
      ctx.moveTo(half.radius * i, half.side * half.radius * 0.12);
      ctx.lineTo(half.radius * i * 0.8, half.side * half.radius * 0.58);
      ctx.stroke();
    }

    ctx.restore();
  }
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
      ctx.strokeStyle = saberTheme.blade.soft;
      ctx.lineWidth = 34;
      ctx.shadowColor = saberTheme.blade.shadow;
      ctx.shadowBlur = 28;
    } else if (pass === 1) {
      ctx.strokeStyle = saberTheme.blade.strong;
      ctx.lineWidth = 14;
      ctx.shadowColor = saberTheme.blade.shadow;
      ctx.shadowBlur = 18;
    } else {
      ctx.strokeStyle = saberTheme.blade.core;
      ctx.lineWidth = 4;
      ctx.shadowColor = saberTheme.blade.core;
      ctx.shadowBlur = 8;
    }

    ctx.stroke();
  }

  ctx.fillStyle = saberTheme.blade.core;
  ctx.shadowColor = saberTheme.blade.tipShadow;
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(blade.x, blade.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw() {
  drawBackground();
  drawItems();
  drawFruitHalves();
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
  resetRound();
  roundState = "waiting";
  motionPackets = 0;
  waitingPanel.classList.remove("is-hidden");
  syncHudVisibility();
  setStatus("Scan the QR code with your phone.", "Waiting");
});

infiniteButton.addEventListener("click", () => {
  infiniteLives = !infiniteLives;
  timerRemainingMs = infiniteLives ? getInfiniteDurationMs(infiniteDurationMinutes) : null;
  syncRoundDisplays();
  updateModeButton();
  syncHudVisibility();
});

durationButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setInfiniteDuration(button.dataset.durationMinutes);
  });
});

colorButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applySaberTheme(button.dataset.saberColor);
  });
});

window.addEventListener("resize", resize);
window.addEventListener("pointermove", handlePointerMove);
window.addEventListener("pointerdown", unlockAudio);

applySaberTheme(saberTheme.id, false);
setInfiniteDuration(infiniteDurationMinutes, false);
resize();
resetRound();
updateModeButton();
renderQr();
connectWebSocket();
requestAnimationFrame(tick);
