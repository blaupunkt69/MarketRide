export const DIFFICULTY = {
  easy: {
    impulse: 20,
    powerDecayPerSecond: 0.58,
    maxPower: 120,
    thrustScale: 1.1,
    gravityScale: 650,
    friction: 16,
    minSpeed: 10,
    stallSeconds: 3.5,
    failMargin: 30,
    amp: 1.05,
  },
  normal: {
    impulse: 17,
    powerDecayPerSecond: 0.5,
    maxPower: 110,
    thrustScale: 0.95,
    gravityScale: 820,
    friction: 20,
    minSpeed: 12,
    stallSeconds: 2.7,
    failMargin: 40,
    amp: 1.18,
  },
  hard: {
    impulse: 14,
    powerDecayPerSecond: 0.42,
    maxPower: 100,
    thrustScale: 0.82,
    gravityScale: 980,
    friction: 24,
    minSpeed: 14,
    stallSeconds: 2.2,
    failMargin: 52,
    amp: 1.33,
  },
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function sampleTerrain(terrain, pos) {
  const maxIndex = terrain.length - 1;
  const i = clamp(Math.floor(pos), 0, maxIndex - 1);
  const t = clamp(pos - i, 0, 1);
  const a = terrain[i];
  const b = terrain[i + 1];
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

export function terrainGrade(terrain, pos) {
  const maxIndex = terrain.length - 1;
  const i = clamp(Math.floor(pos), 1, maxIndex - 1);
  const p0 = terrain[i - 1];
  const p1 = terrain[i + 1];
  return (p1.y - p0.y) / (p1.x - p0.x);
}

export function applyPedal(state) {
  const cfg = state.difficulty;
  state.rider.power = clamp(state.rider.power + cfg.impulse, 0, cfg.maxPower);
  state.rider.lastPedalAt = state.time;
  state.rider.pedalEvents.push(state.time);
}

export function updateRider(dt, state) {
  const { rider, terrain, difficulty: cfg } = state;

  rider.power *= Math.pow(cfg.powerDecayPerSecond, dt);
  const grade = terrainGrade(terrain, rider.pos);
  rider.grade = grade;

  const thrust = (rider.power / cfg.maxPower) * cfg.thrustScale * 120;
  const gravity = -grade * cfg.gravityScale;
  const friction = cfg.friction;

  const accel = thrust + gravity - friction;
  rider.vel += accel * dt;

  if (rider.vel < 0) {
    rider.vel -= Math.abs(grade) * 60 * dt;
  }

  rider.vel = clamp(rider.vel, -140, 260);
  rider.pos += rider.vel * dt;

  if (rider.pos < 0) {
    rider.pos = 0;
    rider.vel = 0;
  }

  const finishPos = terrain.length - 1;
  const progress = clamp(rider.pos / finishPos, 0, 1);
  rider.progress = progress;

  if (rider.vel < cfg.minSpeed) {
    rider.stallTimer += dt;
  } else {
    rider.stallTimer = Math.max(0, rider.stallTimer - dt * 0.8);
  }

  const backwardFromBest = rider.bestPos - rider.pos;
  if (rider.pos > rider.bestPos) {
    rider.bestPos = rider.pos;
  }

  const tooStalled = rider.stallTimer > cfg.stallSeconds;
  const rolledBack = backwardFromBest > cfg.failMargin;
  const drained = rider.power <= 0.2 && rider.vel < cfg.minSpeed * 0.6 && rider.stallTimer > cfg.stallSeconds * 0.7;

  if (progress >= 1) {
    return 'WIN';
  }

  if (tooStalled || rolledBack || drained) {
    return 'LOSE';
  }

  return 'PLAYING';
}
