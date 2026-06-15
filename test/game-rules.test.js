import assert from "node:assert/strict";
import { test } from "node:test";

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

test("timed infinite lives counts down and ends at zero", () => {
  const active = applyRoundTimer(
    { lives: 0, infiniteLives: true, timerRemainingMs: 120_000 },
    30_000
  );
  const expired = applyRoundTimer(active, 120_000);

  assert.equal(normalizeInfiniteDurationMinutes(15), 15);
  assert.equal(normalizeInfiniteDurationMinutes(999), 5);
  assert.equal(getInfiniteDurationMs(20), 1_200_000);
  assert.equal(formatRoundTime(65_000), "1:05");
  assert.deepEqual(active, { lives: 0, infiniteLives: true, timerRemainingMs: 90_000 });
  assert.equal(shouldEndRound(active), false);
  assert.equal(expired.timerRemainingMs, 0);
  assert.equal(shouldEndRound(expired), true);
});

test("fruit hits build x2 x4 x6 combo and bombs reset it", () => {
  let combo = resetCombo({});
  for (let i = 0; i < 3; i += 1) combo = applyComboHit(combo);
  assert.equal(combo.comboMultiplier, 2);
  assert.equal(formatComboMultiplier(combo), "x2");
  assert.equal(calculateSliceScore(10, combo), 20);

  for (let i = 3; i < 7; i += 1) combo = applyComboHit(combo);
  assert.equal(combo.comboMultiplier, 4);
  assert.equal(calculateSliceScore(10, combo), 40);

  for (let i = 7; i < 12; i += 1) combo = applyComboHit(combo);
  assert.equal(combo.comboMultiplier, 6);
  assert.equal(calculateSliceScore(10, combo), 60);

  assert.deepEqual(resetCombo(combo), {
    comboStreak: 0,
    comboMultiplier: 1,
    comboTimerMs: 0
  });
});

test("combo expires when slicing pauses", () => {
  const active = applyComboHit(applyComboHit(applyComboHit(resetCombo({}))));
  const ticking = applyComboTimer(active, 700);
  const expired = applyComboTimer(active, 2500);

  assert.equal(ticking.comboMultiplier, 2);
  assert.ok(ticking.comboTimerMs > 0);
  assert.equal(expired.comboStreak, 0);
  assert.equal(expired.comboMultiplier, 1);
});

test("saber themes provide UI and blade colors with mint fallback", () => {
  const blue = getSaberTheme("blue");
  const fallback = getSaberTheme("unknown");

  assert.equal(blue.id, "blue");
  assert.equal(blue.label, "Blue");
  assert.equal(blue.css.saber, "#63a7ff");
  assert.equal(blue.blade.core, "#ffffff");
  assert.match(blue.blade.soft, /^rgba\(/);
  assert.equal(fallback.id, "mint");
});

test("generated room codes avoid vowels for public display", () => {
  const code = createRoomCode(6, () => 0.99);

  assert.equal(code.length, 6);
  assert.match(code, /^[BCDFGHJKLMNPQRSTVWXYZ23456789]+$/);
  assert.doesNotMatch(code, /[AEIOU]/);
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
