import express from "express";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { WebSocket, WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

function safeJson(raw) {
  try {
    return JSON.parse(raw.toString());
  } catch {
    return null;
  }
}

function send(socket, payload) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function roomSnapshot(roomId, room) {
  return {
    type: "room-status",
    roomId,
    gameConnected: Boolean(room?.game),
    controllerConnected: Boolean(room?.controller)
  };
}

function getLocalNetworkUrls(port) {
  const urls = [];
  const interfaces = os.networkInterfaces();

  for (const values of Object.values(interfaces)) {
    for (const details of values || []) {
      if (details.family === "IPv4" && !details.internal) {
        urls.push(`http://${details.address}:${port}`);
      }
    }
  }

  return urls;
}

export function createSaberServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });
  const rooms = new Map();

  app.set("trust proxy", true);
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/", (_req, res) => {
    res.redirect("/game");
  });

  app.get("/game", (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "game.html"));
  });

  app.get("/controller", (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "controller.html"));
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  app.get("/api/qr", async (req, res, next) => {
    const text = String(req.query.text || "");
    if (!text) {
      res.status(400).json({ error: "Missing text query parameter." });
      return;
    }

    try {
      const dataUrl = await QRCode.toDataURL(text, {
        width: 220,
        margin: 1,
        color: {
          dark: "#080a0f",
          light: "#f8fbff"
        }
      });
      res.json({ dataUrl });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/network", (req, res) => {
    const host = req.get("host") || "";
    const [, hostPort] = host.match(/:(\d+)$/) || [];
    const port = Number(hostPort || PORT);

    res.json({
      origin: `${req.protocol}://${host}`,
      localNetworkUrls: getLocalNetworkUrls(port)
    });
  });

  function ensureRoom(roomId) {
    const key = String(roomId || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{3,12}$/.test(key)) {
      return null;
    }

    if (!rooms.has(key)) {
      rooms.set(key, { game: null, controller: null });
    }

    return { roomId: key, room: rooms.get(key) };
  }

  function announceRoom(roomId) {
    const room = rooms.get(roomId);
    const status = roomSnapshot(roomId, room);
    send(room?.game, status);
    send(room?.controller, status);
  }

  function joinRoom(socket, role, roomId) {
    const result = ensureRoom(roomId);
    if (!result) {
      send(socket, { type: "error", message: "Invalid room code." });
      return;
    }

    const room = result.room;
    const previous = room[role];
    if (previous && previous !== socket) {
      send(previous, {
        type: "replaced",
        message: `Another ${role} joined this room.`
      });
      previous.close(1000, "Replaced by a newer connection.");
    }

    socket.roomId = result.roomId;
    socket.role = role;
    room[role] = socket;

    send(socket, {
      type: "joined",
      role,
      roomId: result.roomId
    });

    if (role === "controller") {
      send(room.game, { type: "controller-joined", roomId: result.roomId });
    }

    if (role === "game") {
      send(room.controller, { type: "game-joined", roomId: result.roomId });
    }

    announceRoom(result.roomId);
  }

  function leaveRoom(socket) {
    if (!socket.roomId || !socket.role) {
      return;
    }

    const room = rooms.get(socket.roomId);
    if (!room || room[socket.role] !== socket) {
      return;
    }

    room[socket.role] = null;

    if (!room.game && !room.controller) {
      rooms.delete(socket.roomId);
      return;
    }

    if (socket.role === "controller") {
      send(room.game, { type: "controller-left", roomId: socket.roomId });
    } else {
      send(room.controller, { type: "game-left", roomId: socket.roomId });
    }

    announceRoom(socket.roomId);
  }

  wss.on("connection", (socket) => {
    send(socket, { type: "hello" });

    socket.on("message", (raw) => {
      const message = safeJson(raw);
      if (!message || typeof message.type !== "string") {
        send(socket, { type: "error", message: "Invalid message." });
        return;
      }

      if (message.type === "join-game") {
        joinRoom(socket, "game", message.roomId);
        return;
      }

      if (message.type === "join-controller") {
        joinRoom(socket, "controller", message.roomId);
        return;
      }

      if (message.type === "motion") {
        const room = rooms.get(socket.roomId);
        if (socket.role !== "controller" || !room?.game) {
          return;
        }

        const payload = {
          type: "motion",
          alpha: Number(message.alpha || 0),
          beta: Number(message.beta || 0),
          gamma: Number(message.gamma || 0),
          x: Number(message.x || 0),
          y: Number(message.y || 0),
          z: Number(message.z || 0)
        };

        if (typeof message.source === "string") {
          payload.source = message.source.slice(0, 32);
        }

        if (Number.isFinite(Number(message.sequence))) {
          payload.sequence = Number(message.sequence);
        }

        send(room.game, payload);
      }
    });

    socket.on("close", () => leaveRoom(socket));
  });

  server.saberRooms = rooms;
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createSaberServer();
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`fruits.wtf running at http://localhost:${PORT}`);
    for (const url of getLocalNetworkUrls(PORT)) {
      console.log(`Same-WiFi URL: ${url}`);
    }
  });
}
