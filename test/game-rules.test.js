import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyBombHit,
  applyFruitMiss,
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
