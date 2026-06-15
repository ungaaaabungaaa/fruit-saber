const SABER_THEMES = [
  {
    id: "mint",
    label: "Mint",
    css: {
      saber: "#62f7d5",
      saber2: "#f9f871",
      saberRgb: "98, 247, 213",
      saber2Rgb: "249, 248, 113",
      saberSoft: "rgba(98, 247, 213, 0.14)",
      saberGlow: "rgba(98, 247, 213, 0.72)"
    },
    blade: {
      soft: "rgba(98, 247, 213, 0.18)",
      strong: "rgba(98, 247, 213, 0.72)",
      shadow: "rgba(98, 247, 213, 0.8)",
      core: "#ffffff",
      tipShadow: "rgba(249, 248, 113, 0.85)"
    },
    canvas: {
      background: "#080a0f",
      grid: "rgba(98, 247, 213, 0.16)",
      glow: "rgba(98, 247, 213, 0.08)"
    }
  },
  {
    id: "blue",
    label: "Blue",
    css: {
      saber: "#63a7ff",
      saber2: "#7cf7ff",
      saberRgb: "99, 167, 255",
      saber2Rgb: "124, 247, 255",
      saberSoft: "rgba(99, 167, 255, 0.14)",
      saberGlow: "rgba(99, 167, 255, 0.72)"
    },
    blade: {
      soft: "rgba(99, 167, 255, 0.18)",
      strong: "rgba(99, 167, 255, 0.74)",
      shadow: "rgba(99, 167, 255, 0.82)",
      core: "#ffffff",
      tipShadow: "rgba(124, 247, 255, 0.78)"
    },
    canvas: {
      background: "#070b14",
      grid: "rgba(99, 167, 255, 0.16)",
      glow: "rgba(99, 167, 255, 0.08)"
    }
  },
  {
    id: "violet",
    label: "Violet",
    css: {
      saber: "#b58cff",
      saber2: "#ff8cf3",
      saberRgb: "181, 140, 255",
      saber2Rgb: "255, 140, 243",
      saberSoft: "rgba(181, 140, 255, 0.14)",
      saberGlow: "rgba(181, 140, 255, 0.72)"
    },
    blade: {
      soft: "rgba(181, 140, 255, 0.18)",
      strong: "rgba(181, 140, 255, 0.74)",
      shadow: "rgba(181, 140, 255, 0.82)",
      core: "#ffffff",
      tipShadow: "rgba(255, 140, 243, 0.74)"
    },
    canvas: {
      background: "#0a0812",
      grid: "rgba(181, 140, 255, 0.15)",
      glow: "rgba(181, 140, 255, 0.08)"
    }
  },
  {
    id: "pink",
    label: "Pink",
    css: {
      saber: "#ff6fb1",
      saber2: "#ffd166",
      saberRgb: "255, 111, 177",
      saber2Rgb: "255, 209, 102",
      saberSoft: "rgba(255, 111, 177, 0.14)",
      saberGlow: "rgba(255, 111, 177, 0.7)"
    },
    blade: {
      soft: "rgba(255, 111, 177, 0.18)",
      strong: "rgba(255, 111, 177, 0.72)",
      shadow: "rgba(255, 111, 177, 0.78)",
      core: "#ffffff",
      tipShadow: "rgba(255, 209, 102, 0.78)"
    },
    canvas: {
      background: "#100811",
      grid: "rgba(255, 111, 177, 0.15)",
      glow: "rgba(255, 111, 177, 0.075)"
    }
  },
  {
    id: "gold",
    label: "Gold",
    css: {
      saber: "#ffd166",
      saber2: "#ff8a3d",
      saberRgb: "255, 209, 102",
      saber2Rgb: "255, 138, 61",
      saberSoft: "rgba(255, 209, 102, 0.14)",
      saberGlow: "rgba(255, 209, 102, 0.7)"
    },
    blade: {
      soft: "rgba(255, 209, 102, 0.18)",
      strong: "rgba(255, 209, 102, 0.72)",
      shadow: "rgba(255, 209, 102, 0.78)",
      core: "#ffffff",
      tipShadow: "rgba(255, 138, 61, 0.78)"
    },
    canvas: {
      background: "#0f0b06",
      grid: "rgba(255, 209, 102, 0.15)",
      glow: "rgba(255, 209, 102, 0.075)"
    }
  },
  {
    id: "white",
    label: "White",
    css: {
      saber: "#f7fbff",
      saber2: "#9ba7b8",
      saberRgb: "247, 251, 255",
      saber2Rgb: "155, 167, 184",
      saberSoft: "rgba(247, 251, 255, 0.12)",
      saberGlow: "rgba(247, 251, 255, 0.58)"
    },
    blade: {
      soft: "rgba(247, 251, 255, 0.16)",
      strong: "rgba(247, 251, 255, 0.68)",
      shadow: "rgba(247, 251, 255, 0.72)",
      core: "#ffffff",
      tipShadow: "rgba(155, 167, 184, 0.8)"
    },
    canvas: {
      background: "#07090d",
      grid: "rgba(247, 251, 255, 0.12)",
      glow: "rgba(247, 251, 255, 0.055)"
    }
  }
];

const ROOM_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXYZ23456789";
export const INFINITE_LIFE_DURATION_MINUTES = [5, 10, 15, 20];
export const COMBO_WINDOW_MS = 2800;

export function createRoomCode(length = 6, random = Math.random) {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function getSaberTheme(themeId) {
  return SABER_THEMES.find((theme) => theme.id === themeId) || SABER_THEMES[0];
}

export function normalizeInfiniteDurationMinutes(minutes) {
  const numericMinutes = Number(minutes);
  return INFINITE_LIFE_DURATION_MINUTES.includes(numericMinutes)
    ? numericMinutes
    : INFINITE_LIFE_DURATION_MINUTES[0];
}

export function getInfiniteDurationMs(minutes) {
  return normalizeInfiniteDurationMinutes(minutes) * 60 * 1000;
}

export function applyRoundTimer(state, elapsedMs) {
  if (!state.infiniteLives || !Number.isFinite(state.timerRemainingMs)) {
    return { ...state };
  }

  return {
    ...state,
    timerRemainingMs: Math.max(0, state.timerRemainingMs - Math.max(0, elapsedMs))
  };
}

export function getComboMultiplier(streak) {
  if (streak >= 12) return 6;
  if (streak >= 7) return 4;
  if (streak >= 3) return 2;
  return 1;
}

export function resetCombo(state) {
  return {
    ...state,
    comboStreak: 0,
    comboMultiplier: 1,
    comboTimerMs: 0
  };
}

export function applyComboHit(state) {
  const comboStreak = (state.comboStreak || 0) + 1;
  return {
    ...state,
    comboStreak,
    comboMultiplier: getComboMultiplier(comboStreak),
    comboTimerMs: COMBO_WINDOW_MS
  };
}

export function applyComboTimer(state, elapsedMs) {
  if (!state.comboStreak || !Number.isFinite(state.comboTimerMs)) {
    return resetCombo(state);
  }

  const comboTimerMs = Math.max(0, state.comboTimerMs - Math.max(0, elapsedMs));
  if (comboTimerMs <= 0) {
    return resetCombo(state);
  }

  return {
    ...state,
    comboTimerMs,
    comboMultiplier: getComboMultiplier(state.comboStreak)
  };
}

export function calculateSliceScore(basePoints, state) {
  return basePoints * (state.comboMultiplier || getComboMultiplier(state.comboStreak || 0));
}

export function formatComboMultiplier(state) {
  return `x${state.comboMultiplier || getComboMultiplier(state.comboStreak || 0)}`;
}

export function applyFruitMiss(state) {
  return { ...state };
}

export function applyBombHit(state) {
  if (state.infiniteLives) {
    return { ...state };
  }

  return {
    ...state,
    lives: Math.max(0, state.lives - 1)
  };
}

export function shouldEndRound(state) {
  if (state.infiniteLives && Number.isFinite(state.timerRemainingMs)) {
    return state.timerRemainingMs <= 0;
  }

  return !state.infiniteLives && state.lives <= 0;
}

export function formatLives(state) {
  return state.infiniteLives ? "∞" : String(state.lives);
}

export function formatRoundTime(milliseconds) {
  if (!Number.isFinite(milliseconds)) {
    return "--";
  }

  const totalSeconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function createFruitHalves(fruit, startPoint, endPoint) {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;
  const baseSpeed = Math.max(120, fruit.radius * 5);

  return [-1, 1].map((side) => ({
    side,
    x: fruit.x + normalX * side * fruit.radius * 0.18,
    y: fruit.y + normalY * side * fruit.radius * 0.18,
    vx: fruit.vx + normalX * side * baseSpeed,
    vy: fruit.vy + normalY * side * baseSpeed,
    radius: fruit.radius,
    color: fruit.color,
    angle: Math.atan2(dy, dx),
    spin: fruit.spin + side * 5,
    cutAngle: Math.atan2(dy, dx),
    life: 1400,
    maxLife: 1400
  }));
}
