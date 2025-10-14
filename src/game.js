// src/game.js — minimal, robust, one-tap start → flap.
// Fixed-step physics, HiDPI canvas, world-space centering,
// and a fade-in Game Over overlay using assets/sprites/gameover.png.

import { Window }   from './utils/window.js';
import { Images }   from './utils/images.js';
import { Sounds }   from './utils/sounds.js';

import { Background }         from './entities/background.js';
import { Floor }              from './entities/floor.js';
import { Pipes }              from './entities/pipe.js';
import { Player, PlayerMode } from './entities/player.js';

// ---------- Game Over banner preload ----------
const GO_SRC = 'assets/sprites/gameover.png';
const gameOverImg = new Image();
let gameOverReady = false;
gameOverImg.onload = () => { gameOverReady = true; };
gameOverImg.src = GO_SRC;

// ---------- Canvas / Context ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

// HiDPI fit (draw in 288x512 world units)
function fitHiDPI() {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  canvas.width  = Math.round(288 * dpr);
  canvas.height = Math.round(512 * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
fitHiDPI();
window.addEventListener('resize', fitHiDPI);

// ---------- Core singletons ----------
const win     = new Window(288, 512); // world space stays constant
const images  = new Images();
const sounds  = new Sounds();
const config  = { ctx, window: win, images, sounds, screen: canvas, dt: 1 };

// ---------- State ----------
let background, floor, pipes, player;
let running = false, paused = false, rafId = null;
let last = 0, acc = 0;
const STEP_MS = 1000 / 60; // fixed timestep
let score = 0;

// ---------- Helpers ----------
const collides = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const playerRect = () => player?.hitbox || player?.rect || { x:0, y:0, w:0, h:0 };
const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);

// Support both Pipes shapes (upper/lower vs upper_pipes/lower_pipes)
const getUpperPipes = () => pipes?.upper || pipes?.upper_pipes || [];
const getLowerPipes = () => pipes?.lower || pipes?.lower_pipes || [];

// --- Game Over overlay (world-centered, fade-in) ---
function drawGameOverOverlay(alpha = 1) {
  const a = Math.max(0, Math.min(1, alpha));
  const W = win.w, H = win.h;

  ctx.save();

  // Dim frame
  ctx.globalAlpha = Math.min(0.6 * a, 0.6);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Banner
  ctx.globalAlpha = a;
  const rawW = gameOverImg.naturalWidth  || 192;
  const rawH = gameOverImg.naturalHeight || 42;

  const scale = Math.min(1, (W * 0.75) / rawW);
  const bw = Math.round(rawW * scale);
  const bh = Math.round(rawH * scale);
  const bx = Math.round((W - bw) / 2);
  const by = Math.round(H * 0.32 - bh / 2);

  if (gameOverReady) {
    ctx.drawImage(gameOverImg, bx, by, bw, bh);
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px system-ui,Segoe UI,Roboto,Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', W / 2, H * 0.35);
  }

  // Score text
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px system-ui,Segoe UI,Roboto,Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`Score: ${score}`, W / 2, by + bh + 32);

  ctx.restore();
}

// ---------- World build ----------
function buildWorld(mode = 'idle') {
  images.randomize?.();
  background = new Background(config);
  floor      = new Floor(config);
  pipes      = new Pipes(config);
  player     = new Player(config);
  score      = 0;
  player.set_mode(mode === 'play' ? PlayerMode.NORMAL : PlayerMode.SHM);
}

// ---------- Init ----------
(async function init() {
  try { await images.load(); } catch (e) { console.warn('images.load failed', e); }
  buildWorld('idle');
  drawIdle();

  // First tap/space starts; thereafter it flaps
  const startOrFlap = () => {
    if (!running) { start(); return; }
    player?.flap?.();
  };
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); startOrFlap(); }, { passive:false });
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); startOrFlap(); }
  });

  try { if (window.Telegram?.WebApp) window.Telegram.WebApp.expand(); } catch {}
})();

function drawIdle() {
  clear();
  try { background.tick(1); } catch {}
  try { floor.tick(1); }      catch {}

  const W = win.w, H = win.h;
  ctx.save();
  ctx.font = 'bold 18px system-ui,Segoe UI,Roboto,Arial';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('Tap to Start', W / 2, H * 0.35);
  ctx.restore();
}

// ---------- Start / Loop / Game over ----------
function start() {
  if (running) return;
  running = true; paused = false;
  buildWorld('play');
  last = 0; acc = 0;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function loop(t) {
  if (paused || !running) { if (rafId) cancelAnimationFrame(rafId); return; }
  rafId = requestAnimationFrame(loop);

  if (!last) last = t;
  let dtMs = t - last;
  last = t;

  dtMs = Math.min(dtMs, 1000 / 20); // clamp big spikes
  acc += dtMs;

  while (acc >= STEP_MS) {
    config.dt = STEP_MS / (1000 / 60);
    update(config.dt);
    acc -= STEP_MS;
  }

  render();
}

function update(dt) {
  pipes.update?.(dt);
  floor.update?.(dt);
  player.update?.(dt);

  // ground
  if (player && (player.y + player.h >= floor.y)) {
    gameOver();
    return;
  }

  // pipes
  const uppers = getUpperPipes();
  const lowers = getLowerPipes();

  for (let i = 0; i < uppers.length; i++) {
    const up  = uppers[i];
    const low = lowers[i];

    if (up && !up.scored && player.x > up.x + up.w) {
      up.scored = true;
      score++;
      try { sounds.point?.play?.(); } catch {}
    }

    const p = playerRect();
    if (up  && collides(p, { x: up.x,  y: up.y,  w: up.w,  h: up.h })) { gameOver(); return; }
    if (low && collides(p, { x: low.x, y: low.y, w: low.w, h: low.h })) { gameOver(); return; }
  }
}

function render() {
  clear();
  try { background.tick(config.dt); } catch {}
  try { pipes.tick(config.dt); }      catch {}
  try { floor.tick(config.dt); }      catch {}
  try { player.tick(config.dt); }     catch {}

  // score
  ctx.save();
  ctx.font = 'bold 22px system-ui,Segoe UI,Roboto,Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(String(score), win.w / 2, 40);
  ctx.restore();
}

function gameOver() {
  running = false;
  try { sounds.hit?.play?.(); } catch {}
  try { render(); } catch {}

  // Fade-in overlay
  const START = performance.now();
  const DURATION = 350;
  function step(t) {
    const p = Math.min(1, (t - START) / DURATION);
    drawGameOverOverlay(p);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  // Return to idle after short pause
  setTimeout(() => {
    buildWorld('idle');
    drawIdle();
  }, 1500);
}

window._start = start; // optional console helper
