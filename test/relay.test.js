import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import WebSocket from "ws";

import { createSaberServer } from "../server.js";

function openClient(port, roomId, clientType) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  return new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.once("open", () => {
      socket.send(JSON.stringify({ type: clientType, roomId }));
      resolve(socket);
    });
  });
}

async function listenFor(socket, type) {
  return new Promise((resolve, reject) => {
    const handleMessage = (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === type) {
        socket.off("message", handleMessage);
        socket.off("error", reject);
        resolve(message);
      }
    };

    socket.on("message", handleMessage);
    socket.once("error", reject);
  });
}

test("relays controller motion to the paired game in the same room", async (t) => {
  const app = createSaberServer();
  const server = app.listen(0, "127.0.0.1");
  t.after(() => server.close());

  await once(server, "listening");
  const { port } = server.address();

  const game = await openClient(port, "ABC123", "join-game");
  const controllerJoined = listenFor(game, "controller-joined");
  const controller = await openClient(port, "ABC123", "join-controller");
  t.after(() => {
    game.close();
    controller.close();
  });

  await controllerJoined;

  const motion = {
    type: "motion",
    alpha: 12,
    beta: -21,
    gamma: 36,
    x: 0.1,
    y: -0.2,
    z: 0.3,
    source: "orientation",
    sequence: 7
  };

  const relayed = listenFor(game, "motion");
  controller.send(JSON.stringify(motion));

  assert.deepEqual(await relayed, motion);
});
