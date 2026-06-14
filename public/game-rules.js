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
