import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyBombHit,
  applyFruitMiss,
  createFruitHalves,
  formatLives,
  shouldEndRound
} from "../public/game-rules.js";

test("missed fruit does not reduce lives", () => {
  const state = applyFruitMiss({ lives: 2, infiniteLives: false });

  assert.deepEqual(state, { lives: 2, infiniteLives: false });
});

test("bomb hit reduces lives in normal mode", () => {
  const state = applyBombHit({ lives: 2, infiniteLives: false });

  assert.deepEqual(state, { lives: 1, infiniteLives: false });
});

test("bomb hit does not reduce lives in infinite mode", () => {
  const state = applyBombHit({ lives: 2, infiniteLives: true });

  assert.deepEqual(state, { lives: 2, infiniteLives: true });
});

test("only normal mode at zero lives ends the round", () => {
  assert.equal(shouldEndRound({ lives: 0, infiniteLives: false }), true);
  assert.equal(shouldEndRound({ lives: 0, infiniteLives: true }), false);
  assert.equal(shouldEndRound({ lives: 1, infiniteLives: false }), false);
});

test("infinite lives displays as an infinity symbol", () => {
  assert.equal(formatLives({ lives: 3, infiniteLives: true }), "∞");
  assert.equal(formatLives({ lives: 3, infiniteLives: false }), "3");
});

test("fruit slice creates two halves that move apart", () => {
  const halves = createFruitHalves(
    {
      x: 100,
      y: 120,
      vx: 10,
      vy: 20,
      radius: 30,
      color: "#ffbd4a",
      angle: 0.4
    },
    { x: 50, y: 120 },
    { x: 150, y: 120 }
  );

  assert.equal(halves.length, 2);
  assert.equal(halves[0].side, -1);
  assert.equal(halves[1].side, 1);
  assert.equal(halves[0].color, "#ffbd4a");
  assert.equal(halves[1].color, "#ffbd4a");
  assert.equal(halves[0].vx, 10);
  assert.equal(halves[1].vx, 10);
  assert.ok(halves[0].vy < 20);
  assert.ok(halves[1].vy > 20);
});
