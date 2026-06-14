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
  return !state.infiniteLives && state.lives <= 0;
}

export function formatLives(state) {
  return state.infiniteLives ? "∞" : String(state.lives);
}
