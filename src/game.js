import { getPriceSeries, pricesToTerrain } from './data.js';
import { DIFFICULTY, applyPedal, updateRider } from './physics.js';
import { createUI } from './ui.js';
import { emitConfetti, emitPedalParticles, renderFrame } from './render.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ui = createUI();

const state = {
  gameState: 'MENU',
  terrain: [],
  rider: null,
  difficulty: DIFFICULTY.normal,
  viewport: { width: canvas.width, height: canvas.height },
  particles: [],
  cameraX: 0,
  runtimeMs: 0,
  runStartMs: 0,
  lastTs: performance.now(),
  config: null,
  sourceUsed: 'demo',
  time: 0,
  paused: false,
};

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(960, window.innerWidth);
  const height = Math.max(540, window.innerHeight);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.viewport.width = width;
  state.viewport.height = height;
}

function bestKey({ symbol, timeframe, difficulty }) {
  return `marketrider:best:${symbol}:${timeframe}:${difficulty}`;
}

function saveBest(config, runtimeMs) {
  const key = bestKey(config);
  const prev = Number(localStorage.getItem(key));
  if (!prev || runtimeMs < prev) {
    localStorage.setItem(key, String(runtimeMs));
  }
}

function readBest(config) {
  const val = Number(localStorage.getItem(bestKey(config)));
  return Number.isFinite(val) && val > 0 ? val : null;
}

function setGameState(next) {
  state.gameState = next;
  if (next === 'MENU') ui.showMenu();
  if (next === 'LOADING') ui.showLoading();
  if (next === 'PLAYING') ui.hideOverlays();
}

async function startRun(config) {
  state.config = {
    symbol: (config.symbol || 'AAPL').toUpperCase().trim(),
    timeframe: config.timeframe,
    difficulty: config.difficulty,
    source: config.source,
  };

  setGameState('LOADING');

  const difficulty = DIFFICULTY[config.difficulty] ?? DIFFICULTY.normal;
  const worldWidth = state.viewport.width * 4.5;

  const { prices, sourceUsed } = await getPriceSeries({
    symbol: state.config.symbol,
    timeframe: state.config.timeframe,
    source: state.config.source,
  });
  state.sourceUsed = sourceUsed;

  state.terrain = pricesToTerrain(prices, {
    width: worldWidth,
    height: state.viewport.height,
    difficultyMultiplier: difficulty.amp,
  });

  state.rider = {
    pos: 0,
    bestPos: 0,
    vel: 35,
    power: difficulty.impulse * 1.4,
    grade: 0,
    progress: 0,
    stallTimer: 0,
    lastPedalAt: -99,
    pedalEvents: [],
  };

  state.particles.length = 0;
  state.cameraX = 0;
  state.runtimeMs = 0;
  state.runStartMs = performance.now();
  state.difficulty = difficulty;
  state.time = 0;
  state.paused = false;
  ui.setPaused(false);

  setGameState('PLAYING');
}

function finishRun(result) {
  state.gameState = result;
  if (result === 'WIN') {
    emitConfetti(state);
    saveBest(state.config, state.runtimeMs);
  }

  const best = readBest(state.config);
  const bestStr = best ? `${(best / 1000).toFixed(2)}s` : '--';
  const stats = `Run: ${(state.runtimeMs / 1000).toFixed(2)}s | Best: ${bestStr} | ${state.config.symbol} ${state.config.timeframe} ${state.config.difficulty}`;
  ui.showResult({
    title: result === 'WIN' ? 'You beat the market hills! 🚴' : 'You wiped out! 💥',
    stats,
  });
}

function handlePedal() {
  if (state.gameState !== 'PLAYING' || state.paused) return;
  applyPedal(state);
  emitPedalParticles(state, 4);
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape' && state.gameState === 'PLAYING') {
    state.paused = !state.paused;
    ui.setPaused(state.paused);
    return;
  }

  if (event.code === 'Space') {
    if (!event.repeat) handlePedal();
    event.preventDefault();
  }

  if (event.code === 'Enter' && (state.gameState === 'WIN' || state.gameState === 'LOSE')) {
    ui.showMenu();
    state.gameState = 'MENU';
  }
});

canvas.addEventListener('pointerdown', () => handlePedal());

ui.onStart((config) => {
  startRun(config);
});

ui.onRestart(() => {
  ui.showMenu();
  state.gameState = 'MENU';
});

function tick(ts) {
  const rawDt = Math.min(0.05, (ts - state.lastTs) / 1000);
  state.lastTs = ts;

  if (state.gameState === 'PLAYING' && !state.paused) {
    state.time += rawDt;
    state.runtimeMs = ts - state.runStartMs;

    const next = updateRider(rawDt, state);

    const riderWorldX = state.terrain[Math.max(0, Math.floor(state.rider.pos))]?.x ?? 0;
    const targetCam = riderWorldX - state.viewport.width * 0.3;
    state.cameraX += (targetCam - state.cameraX) * Math.min(1, rawDt * 5.5);
    state.cameraX = Math.max(0, state.cameraX);

    if (next !== 'PLAYING') {
      finishRun(next);
    }
  }

  renderFrame(ctx, state, rawDt);
  requestAnimationFrame(tick);
}

window.addEventListener('resize', resize);
resize();
setGameState('MENU');
requestAnimationFrame(tick);
