# Saber Fruits

> A motion-controlled browser game — scan a QR code on your phone, swing it like a lightsaber, and slash falling fruits on screen.

![Saber Fruits Banner](./docs/banner.png)

---

## How it works

Open the game on any screen. A QR code appears. Scan it with your phone. The game starts — tilt and swing your phone to move the lightsaber and slice everything in sight.

No app install. No accounts. Just a URL and a camera.

![Gameplay Screenshot](./docs/gameplay.png)

---

## Architecture

The system has three pieces: a phone controller, a Node.js relay server, and the game canvas running in the laptop browser. They communicate over WebSockets, paired by a 6-character room code embedded in the QR.

### System overview

```svg
<svg width="100%" viewBox="0 0 680 520" xmlns="http://www.w3.org/2000/svg" role="img">
  <title>Lightsaber fruit game — full system architecture</title>
  <desc>Three-layer architecture: phone controller, Node.js server with session management, and laptop game display</desc>
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M2 1L8 5L2 9" fill="none" stroke="#888780" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>

  <!-- PHONE -->
  <rect x="30" y="180" width="148" height="160" rx="10" fill="#EEEDFE" stroke="#534AB7" stroke-width="0.5"/>
  <text font-family="sans-serif" font-size="14" font-weight="500" fill="#3C3489" x="104" y="208" text-anchor="middle" dominant-baseline="central">Phone</text>
  <text font-family="sans-serif" font-size="12" fill="#534AB7" x="104" y="228" text-anchor="middle" dominant-baseline="central">controller page</text>
  <text font-family="sans-serif" font-size="12" fill="#534AB7" x="104" y="258" text-anchor="middle" opacity="0.7">DeviceMotion API</text>
  <text font-family="sans-serif" font-size="12" fill="#534AB7" x="104" y="276" text-anchor="middle" opacity="0.7">gyro x / y / z</text>
  <text font-family="sans-serif" font-size="12" fill="#534AB7" x="104" y="294" text-anchor="middle" opacity="0.7">accel data</text>
  <text font-family="sans-serif" font-size="12" fill="#534AB7" x="104" y="316" text-anchor="middle" opacity="0.6">scan QR to open</text>

  <!-- Arrow: phone to server -->
  <path d="M178 255 L248 255" fill="none" stroke="#7F77DD" stroke-width="1.2" marker-end="url(#arrow)"/>
  <text font-family="sans-serif" font-size="12" fill="#534AB7" x="213" y="243" text-anchor="middle">motion</text>
  <text font-family="sans-serif" font-size="12" fill="#534AB7" x="213" y="258" text-anchor="middle">events</text>
  <text font-family="sans-serif" font-size="12" fill="#888780" x="213" y="273" text-anchor="middle" opacity="0.5">WebSocket</text>

  <!-- SERVER -->
  <rect x="248" y="80" width="184" height="360" rx="12" fill="#F1EFE8" stroke="#5F5E5A" stroke-width="0.5"/>
  <text font-family="sans-serif" font-size="14" font-weight="500" fill="#2C2C2A" x="340" y="110" text-anchor="middle" dominant-baseline="central">Node.js server</text>
  <text font-family="sans-serif" font-size="12" fill="#5F5E5A" x="340" y="130" text-anchor="middle" dominant-baseline="central">Railway / Fly.io</text>

  <rect x="266" y="152" width="148" height="56" rx="8" fill="#E1F5EE" stroke="#0F6E56" stroke-width="0.5"/>
  <text font-family="sans-serif" font-size="14" font-weight="500" fill="#085041" x="340" y="176" text-anchor="middle" dominant-baseline="central">Session manager</text>
  <text font-family="sans-serif" font-size="12" fill="#0F6E56" x="340" y="196" text-anchor="middle" dominant-baseline="central">room codes, pairing</text>

  <rect x="266" y="228" width="148" height="56" rx="8" fill="#E1F5EE" stroke="#0F6E56" stroke-width="0.5"/>
  <text font-family="sans-serif" font-size="14" font-weight="500" fill="#085041" x="340" y="252" text-anchor="middle" dominant-baseline="central">WebSocket relay</text>
  <text font-family="sans-serif" font-size="12" fill="#0F6E56" x="340" y="272" text-anchor="middle" dominant-baseline="central">phone → game bridge</text>

  <rect x="266" y="304" width="148" height="56" rx="8" fill="#E1F5EE" stroke="#0F6E56" stroke-width="0.5"/>
  <text font-family="sans-serif" font-size="14" font-weight="500" fill="#085041" x="340" y="328" text-anchor="middle" dominant-baseline="central">Static server</text>
  <text font-family="sans-serif" font-size="12" fill="#0F6E56" x="340" y="348" text-anchor="middle" dominant-baseline="central">serves game + phone UI</text>

  <rect x="266" y="380" width="148" height="44" rx="8" fill="#FAEEDA" stroke="#854F0B" stroke-width="0.5"/>
  <text font-family="sans-serif" font-size="14" font-weight="500" fill="#633806" x="340" y="398" text-anchor="middle" dominant-baseline="central">QR generator</text>
  <text font-family="sans-serif" font-size="12" fill="#854F0B" x="340" y="415" text-anchor="middle" dominant-baseline="central">qrcode npm package</text>

  <!-- Arrow: server to game -->
  <path d="M432 255 L500 255" fill="none" stroke="#1D9E75" stroke-width="1.2" marker-end="url(#arrow)"/>
  <text font-family="sans-serif" font-size="12" fill="#0F6E56" x="466" y="243" text-anchor="middle">relayed</text>
  <text font-family="sans-serif" font-size="12" fill="#0F6E56" x="466" y="258" text-anchor="middle">motion</text>
  <text font-family="sans-serif" font-size="12" fill="#888780" x="466" y="273" text-anchor="middle" opacity="0.5">WebSocket</text>

  <!-- GAME -->
  <rect x="500" y="80" width="148" height="360" rx="10" fill="#FAECE7" stroke="#993C1D" stroke-width="0.5"/>
  <text font-family="sans-serif" font-size="14" font-weight="500" fill="#712B13" x="574" y="108" text-anchor="middle" dominant-baseline="central">Game display</text>
  <text font-family="sans-serif" font-size="12" fill="#993C1D" x="574" y="128" text-anchor="middle" dominant-baseline="central">laptop browser</text>
  <text font-family="sans-serif" font-size="12" fill="#993C1D" x="574" y="160" text-anchor="middle" opacity="0.7">Canvas renderer</text>
  <text font-family="sans-serif" font-size="12" fill="#993C1D" x="574" y="178" text-anchor="middle" opacity="0.7">Lightsaber trail</text>
  <text font-family="sans-serif" font-size="12" fill="#993C1D" x="574" y="196" text-anchor="middle" opacity="0.7">Fruit spawner</text>
  <text font-family="sans-serif" font-size="12" fill="#993C1D" x="574" y="214" text-anchor="middle" opacity="0.7">Slash detection</text>
  <text font-family="sans-serif" font-size="12" fill="#993C1D" x="574" y="232" text-anchor="middle" opacity="0.7">Particle effects</text>
  <text font-family="sans-serif" font-size="12" fill="#993C1D" x="574" y="250" text-anchor="middle" opacity="0.7">Score + lives</text>
  <text font-family="sans-serif" font-size="12" fill="#993C1D" x="574" y="268" text-anchor="middle" opacity="0.7">Sound effects</text>
  <text font-family="sans-serif" font-size="12" fill="#993C1D" x="574" y="300" text-anchor="middle" opacity="0.5">Shows QR code</text>
  <text font-family="sans-serif" font-size="12" fill="#993C1D" x="574" y="318" text-anchor="middle" opacity="0.5">on waiting screen</text>

  <!-- User flow -->
  <rect x="30" y="468" width="618" height="36" rx="8" fill="none" stroke="#B4B2A9" stroke-width="0.5" stroke-dasharray="4 3"/>
  <text font-family="sans-serif" font-size="12" fill="#5F5E5A" x="340" y="490" text-anchor="middle" opacity="0.65">User flow: open game → QR shown → phone scans → phone joins room → gyro streams → saber moves → slash fruits</text>
</svg>
```

### Phone → server → game data flow

```svg
<svg width="100%" viewBox="0 0 680 280" xmlns="http://www.w3.org/2000/svg" role="img">
  <title>Lightsaber game data flow</title>
  <desc>Phone sends gyroscope data via WebSocket to Node.js server which relays it to the game browser</desc>
  <defs>
    <marker id="arr2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M2 1L8 5L2 9" fill="none" stroke="#888780" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>

  <!-- PHONE -->
  <rect x="40" y="60" width="140" height="160" rx="10" fill="#EEEDFE" stroke="#534AB7" stroke-width="0.5"/>
  <text font-family="sans-serif" font-size="14" font-weight="500" fill="#3C3489" x="110" y="92" text-anchor="middle" dominant-baseline="central">Phone</text>
  <text font-family="sans-serif" font-size="12" fill="#534AB7" x="110" y="112" text-anchor="middle" dominant-baseline="central">Your controller</text>
  <rect x="58" y="130" width="104" height="70" rx="6" fill="none" stroke="#534AB7" stroke-width="0.5" opacity="0.4"/>
  <text font-family="sans-serif" font-size="12" fill="#534AB7" x="110" y="152" text-anchor="middle" opacity="0.7">Gyroscope</text>
  <text font-family="sans-serif" font-size="12" fill="#534AB7" x="110" y="170" text-anchor="middle" opacity="0.7">DeviceMotion</text>
  <text font-family="sans-serif" font-size="12" fill="#534AB7" x="110" y="188" text-anchor="middle" opacity="0.7">API</text>

  <!-- Arrow: phone to server -->
  <line x1="184" y1="155" x2="250" y2="130" stroke="#7F77DD" stroke-width="1.2" marker-end="url(#arr2)"/>
  <text font-family="sans-serif" font-size="12" fill="#534AB7" x="217" y="128" text-anchor="middle">WebSocket</text>
  <text font-family="sans-serif" font-size="12" fill="#888780" x="217" y="144" text-anchor="middle" opacity="0.6">gyro x/y/z data</text>

  <!-- SERVER -->
  <rect x="250" y="80" width="180" height="100" rx="10" fill="#F1EFE8" stroke="#5F5E5A" stroke-width="0.5"/>
  <text font-family="sans-serif" font-size="14" font-weight="500" fill="#2C2C2A" x="340" y="118" text-anchor="middle" dominant-baseline="central">Node.js server</text>
  <text font-family="sans-serif" font-size="12" fill="#5F5E5A" x="340" y="140" text-anchor="middle" dominant-baseline="central">Runs on Railway</text>
  <text font-family="sans-serif" font-size="12" fill="#5F5E5A" x="340" y="158" text-anchor="middle" dominant-baseline="central">ws library</text>

  <!-- Arrow: server to game -->
  <line x1="430" y1="130" x2="490" y2="155" stroke="#1D9E75" stroke-width="1.2" marker-end="url(#arr2)"/>
  <text font-family="sans-serif" font-size="12" fill="#0F6E56" x="460" y="128" text-anchor="middle">relay</text>

  <!-- GAME -->
  <rect x="490" y="60" width="148" height="160" rx="10" fill="#FAECE7" stroke="#993C1D" stroke-width="0.5"/>
  <text font-family="sans-serif" font-size="14" font-weight="500" fill="#712B13" x="564" y="92" text-anchor="middle" dominant-baseline="central">Game</text>
  <text font-family="sans-serif" font-size="12" fill="#993C1D" x="564" y="112" text-anchor="middle" dominant-baseline="central">Browser on laptop</text>
  <rect x="508" y="128" width="114" height="75" rx="6" fill="none" stroke="#993C1D" stroke-width="0.5" opacity="0.4"/>
  <text font-family="sans-serif" font-size="12" fill="#993C1D" x="565" y="150" text-anchor="middle" opacity="0.7">Canvas</text>
  <text font-family="sans-serif" font-size="12" fill="#993C1D" x="565" y="168" text-anchor="middle" opacity="0.7">Lightsaber trail</text>
  <text font-family="sans-serif" font-size="12" fill="#993C1D" x="565" y="186" text-anchor="middle" opacity="0.7">Slash detection</text>

  <!-- WiFi label -->
  <rect x="190" y="220" width="300" height="36" rx="8" fill="none" stroke="#B4B2A9" stroke-width="0.5" stroke-dasharray="4 3"/>
  <text font-family="sans-serif" font-size="12" fill="#5F5E5A" x="340" y="242" text-anchor="middle" opacity="0.7">Both devices need internet (same WiFi works too)</text>
</svg>
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Server | Node.js + Express + `ws` |
| QR code | `qrcode` npm package |
| Game engine | Vanilla JS, HTML5 Canvas |
| Phone input | `DeviceMotionEvent` / `DeviceOrientationEvent` |
| Deployment | Railway or Fly.io (HTTPS required for gyro) |
| Real-time | WebSockets, ~60 events/sec |

---

## Project structure

```
lightsaber-fruits/
├── server.js              # Express + WebSocket server, room management
├── package.json
└── public/
    ├── game.html          # Laptop game screen (shows QR, runs canvas)
    ├── game.js            # Canvas engine, saber trail, fruit physics
    ├── controller.html    # Phone page (opened by QR scan)
    └── controller.js      # DeviceMotion → WebSocket stream
```

---

## Getting started

### Run locally

```bash
git clone https://github.com/ungaaaabungaaa/fruit-saber.git
cd fruit-saber
npm install
node server.js
```

Open `http://localhost:3000` on your laptop. The QR code will appear. Scan it with your phone — **your phone and laptop must be on the same network**, or you must use a public deployment so your phone can reach the server over the internet.

> **iOS note:** DeviceMotion requires HTTPS. For local dev, use `ngrok http 3000` and open the ngrok URL on your laptop instead.

### Deploy to Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

Set the `PORT` environment variable if needed (Railway sets it automatically). Once deployed, both laptop and phone connect to the same public HTTPS URL — no local network required.

### Deploy to AWS EC2

If you have AWS free-tier credits/access, the simplest AWS path is a small EC2 instance running Docker. This works well for Saber Fruits because the server is a normal long-running Node.js process with WebSockets.

AWS references:

- [Get started with Amazon EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/EC2_GetStarted.html)
- [Elastic IP addresses](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html)
- [Caddy reverse proxy](https://caddyserver.com/docs/quick-starts/reverse-proxy)
- [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)

#### 1. Launch the instance

In the EC2 console:

1. Launch an Ubuntu or Amazon Linux instance.
2. Choose a Free Tier eligible instance type if your account has free-tier eligibility or credits.
3. Create/download a key pair.
4. Security group inbound rules:
   - SSH `22` from your own IP only.
   - HTTP `80` from anywhere.
   - HTTPS `443` from anywhere.
5. Do not expose port `3000` publicly. Caddy will proxy public HTTPS traffic to the app.

> AWS public IPv4 and Elastic IP pricing can change and may not be fully free. Check billing/free-tier usage before leaving instances running.

#### 2. Point your domain at EC2

iPhone motion needs HTTPS, so use a real domain.

Create an `A` record at your DNS provider:

```text
yourdomain.com -> EC2 public IPv4 address
```

Using an Elastic IP makes the address stable, but AWS may charge for public IPv4 addresses. If you skip Elastic IP, your public IP can change when the instance stops/starts.

#### 3. Install Docker on the EC2 instance

SSH into the instance, then install Docker.

Ubuntu:

```bash
sudo apt update
sudo apt install -y git docker.io
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker
```

Amazon Linux:

```bash
sudo yum update -y
sudo yum install -y git docker
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker
```

#### 4. Build and run Saber Fruits

```bash
git clone https://github.com/ungaaaabungaaa/fruit-saber.git
cd fruit-saber
docker build -t fruit-saber .
docker network create fruit-saber-net
docker run -d \
  --name fruit-saber \
  --network fruit-saber-net \
  --restart unless-stopped \
  fruit-saber
```

#### 5. Add HTTPS with Caddy

Replace `yourdomain.com` with your real domain.

```bash
mkdir -p ~/caddy/data ~/caddy/config
cat > ~/Caddyfile <<'EOF'
yourdomain.com {
  reverse_proxy fruit-saber:3000
}
EOF

docker run -d \
  --name fruit-saber-caddy \
  --network fruit-saber-net \
  --restart unless-stopped \
  -p 80:80 \
  -p 443:443 \
  -v ~/Caddyfile:/etc/caddy/Caddyfile \
  -v ~/caddy/data:/data \
  -v ~/caddy/config:/config \
  caddy:2
```

Open:

```text
https://yourdomain.com/game
```

Caddy automatically requests and renews HTTPS certificates when DNS points to the instance and ports `80`/`443` are open.

#### 6. Update after new commits

```bash
cd fruit-saber
git pull
docker build -t fruit-saber .
docker rm -f fruit-saber
docker run -d \
  --name fruit-saber \
  --network fruit-saber-net \
  --restart unless-stopped \
  fruit-saber
```

---

## How the pairing works

```
1. Laptop opens /             → server creates room "XK92PL"
2. Server renders QR          → encodes https://yoursite.com/controller?room=XK92PL
3. Phone scans QR             → opens controller page
4. Phone requests permission  → iOS prompts for motion access
5. Phone joins room           → WebSocket message: { type: "join-controller", roomId: "XK92PL" }
6. Server pairs them          → notifies game: { type: "controller-connected" }
7. Game starts                → phone streams { alpha, beta, gamma } at ~60fps
8. Server relays              → game maps beta→Y, gamma→X, moves saber
```

---

## Controls

| Motion | Action |
|---|---|
| Tilt left / right | Move saber horizontally (`gamma`) |
| Tilt forward / back | Move saber vertically (`beta`) |
| Swing fast | Longer saber trail, more dramatic slashes |

---

## Visuals

![QR pairing screen](./docs/pairing.png)
![Phone controller UI](./docs/controller.png)

---

## License

MIT
