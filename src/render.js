import { sampleTerrain } from './physics.js';

function drawBackground(ctx, width, height) {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#1d2a52');
  g.addColorStop(1, '#090d1d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 80; i += 1) {
    const x = (i * 173) % width;
    const y = (i * 97) % (height * 0.6);
    ctx.fillStyle = '#d8e2ff';
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
}

export function emitPedalParticles(state, count = 3) {
  const riderPoint = sampleTerrain(state.terrain, state.rider.pos);
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x: riderPoint.x - 16 + Math.random() * 8,
      y: riderPoint.y + 10 + Math.random() * 6,
      vx: -30 - Math.random() * 20,
      vy: -18 + Math.random() * 8,
      life: 0.4 + Math.random() * 0.4,
      ttl: 0.4 + Math.random() * 0.4,
      color: '#a5d7ff',
    });
  }
}

export function emitConfetti(state, count = 80) {
  const colors = ['#ffd166', '#ef476f', '#06d6a0', '#73c2fb', '#c77dff'];
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x: Math.random() * state.viewport.width + state.cameraX,
      y: Math.random() * state.viewport.height * 0.4,
      vx: (Math.random() - 0.5) * 90,
      vy: 15 + Math.random() * 90,
      life: 1.8 + Math.random() * 1.4,
      ttl: 1.8 + Math.random() * 1.4,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

function drawTerrain(ctx, state) {
  const { terrain, cameraX } = state;
  ctx.save();
  ctx.translate(-cameraX, 0);

  ctx.lineWidth = 18;
  ctx.strokeStyle = '#2e3f70';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(terrain[0].x, terrain[0].y);
  for (let i = 1; i < terrain.length; i += 1) ctx.lineTo(terrain[i].x, terrain[i].y);
  ctx.stroke();

  ctx.lineWidth = 5;
  ctx.strokeStyle = '#7ea4ff';
  ctx.beginPath();
  ctx.moveTo(terrain[0].x, terrain[0].y);
  for (let i = 1; i < terrain.length; i += 1) ctx.lineTo(terrain[i].x, terrain[i].y);
  ctx.stroke();

  ctx.restore();
}

function drawRider(ctx, state) {
  const riderPoint = sampleTerrain(state.terrain, state.rider.pos);
  const ahead = sampleTerrain(state.terrain, state.rider.pos + 1.5);
  const angle = Math.atan2(ahead.y - riderPoint.y, ahead.x - riderPoint.x);

  const x = riderPoint.x - state.cameraX;
  const y = riderPoint.y - 16;

  const strain = Math.max(0, state.rider.grade) * 35;
  const shake = strain > 0 ? (Math.random() - 0.5) * Math.min(2.5, strain) : 0;

  ctx.save();
  ctx.translate(x, y + shake);
  ctx.rotate(angle);

  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;

  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(-14, 10, 10, 0, Math.PI * 2);
  ctx.arc(14, 10, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#4dc0ff';
  ctx.beginPath();
  ctx.moveTo(-14, 10);
  ctx.lineTo(0, -2);
  ctx.lineTo(14, 10);
  ctx.lineTo(-4, 10);
  ctx.lineTo(0, -2);
  ctx.stroke();

  ctx.strokeStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(2, -18);
  ctx.lineTo(10, -28);
  ctx.moveTo(2, -18);
  ctx.lineTo(-8, -10);
  ctx.moveTo(2, -18);
  ctx.lineTo(12, -10);
  ctx.stroke();

  ctx.fillStyle = '#ffd9a1';
  ctx.beginPath();
  ctx.arc(10, -34, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawParticles(ctx, state, dt) {
  const { particles, cameraX } = state;
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 70 * dt;

    ctx.globalAlpha = Math.max(0, p.life / p.ttl);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - cameraX, p.y, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function drawHUD(ctx, state) {
  const { rider, viewport, runtimeMs, sourceUsed } = state;
  const progressPct = Math.round(rider.progress * 100);
  const slopePct = Math.round(-rider.grade * 100);

  ctx.fillStyle = 'rgba(7, 12, 27, 0.72)';
  ctx.fillRect(16, 16, 340, 116);
  ctx.strokeStyle = '#4f6db4';
  ctx.strokeRect(16, 16, 340, 116);

  ctx.fillStyle = '#d9e4ff';
  ctx.font = '16px sans-serif';
  ctx.fillText(`Progress: ${progressPct}%`, 26, 42);
  ctx.fillText(`Grade: ${slopePct >= 0 ? '+' : ''}${slopePct}%`, 26, 66);
  ctx.fillText(`Speed: ${rider.vel.toFixed(1)}`, 170, 66);
  ctx.fillText(`Power: ${rider.power.toFixed(1)}`, 26, 90);
  ctx.fillText(`Source: ${sourceUsed}`, 170, 90);
  ctx.fillText(`Time: ${(runtimeMs / 1000).toFixed(2)}s`, 26, 114);

  const barX = 26;
  const barY = 146;
  const barW = viewport.width - 52;
  const barH = 12;
  ctx.fillStyle = 'rgba(180, 190, 220, 0.25)';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = '#48d597';
  ctx.fillRect(barX, barY, barW * rider.progress, barH);
  ctx.strokeStyle = '#6f88ca';
  ctx.strokeRect(barX, barY, barW, barH);
}

export function renderFrame(ctx, state, dt) {
  drawBackground(ctx, state.viewport.width, state.viewport.height);
  drawTerrain(ctx, state);
  drawParticles(ctx, state, dt);
  drawRider(ctx, state);
  drawHUD(ctx, state);
}
