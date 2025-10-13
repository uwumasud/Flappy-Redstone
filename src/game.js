// src/game.js — minimal, robust, one-tap start, then flap.
// Fixed-step physics, HiDPI canvas, and strong guards against missing pieces.

import { Window }   from './utils/window.js';
import { Images }   from './utils/images.js';
import { Sounds }   from './utils/sounds.js';

import { Background }        from './entities/background.js';
import { Floor }             from './entities/floor.js';
import { Pipes }             from './entities/pipe.js';
import { Player, PlayerMode }from './entities/player.js';

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

// Scale drawing to devicePixelRatio for crisp sprites but keep world = 288x512
function fitHiDPI() {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  canvas.width  = Math.round(288 * dpr);
  canvas.height = Math.round(512 * dpr);
  // Draw in 288x512 world units
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

// Support both our Pipes implementation (upper/lower) and older ones (upper_pipes/lower_pipes)
function getUpperPipes() { return pipes?.upper || pipes?.upper_pipes || []; }
function getLowerPipes() { return pipes?.lower || pipes?.lower_pipes || []; }

// --- Game Over overlay (fade-in) ---
function drawGameOverOverlay(alpha = 1) {
  const a = Math.max(0, Math.min(1, alpha));

  ctx.save();

  // Dim the whole frame
  ctx.globalAlpha = Math.min(0.6 * a, 0.6);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Banner
  ctx.globalAlpha = a;
  const rawW = gameOverImg.naturalWidth  || 192;
  const rawH = gameOverImg.naturalHeight || 42;

  // Scale banner to fit nicely (max 75% of canvas width)
  const scale = Math.min(1, (canvas.width * 0.75) / rawW);
  const bw = Math.round(rawW * scale);
  const bh = Math.round(rawH * scale);
  const bx = (canvas.width - bw) / 2;
  const by = Math.round(canvas.height * 0.32 - bh / 2);

  if (gameOverReady) {
    ctx.drawImage(gameOverImg, bx, by, bw, bh);
  } else {
    // Text fallback if image not ready yet
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px system-ui,Segoe UI,Roboto,Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height * 0.35);
  }

  // Score under the banner
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px system-ui,Segoe UI,Roboto,Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`Score: ${score}`, canvas.width / 2, by + bh + 32);

  ctx.restore();
}

// ---------- World build ----------
function buildWorld(mode = 'idle') {
  images.randomize?.(); // harmless if not implemented
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

  // Telegram webview expand (no-op in browsers)
  try { if (window.Telegram?.WebApp) window.Telegram.WebApp.expand(); } catch {}
})();

function drawIdle() {
  clear();
  try { background.tick(1); } catch {}
  try { floor.tick(1); }      catch {}

  // hint
  ctx.save();
  ctx.font = 'bold 18px system-ui,Segoe UI,Roboto,Arial';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('Tap to Start', canvas.width / 2, canvas.height * 0.35);
  ctx.restore();
}

// ---------- Start / Loop / Game over ----------
function start() {
  if (running) return; // guard double start
  running = true; paused = false;
  buildWorld('play');
  last = 0; acc = 0;
  rafId && cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function loop(t) {
  if (paused || !running) { rafId && cancelAnimationFrame(rafId); return; }
  rafId = requestAnimationFrame(loop);

  if (!last) last = t;
  let dtMs = t - last;
  last = t;

  // Clamp huge spikes (tab switches) to avoid tunneling through pipes
  dtMs = Math.min(dtMs, 1000 / 20); // max ~50ms
  acc += dtMs;

  while (acc >= STEP_MS) {
    config.dt = STEP_MS / (1000 / 60); // ≈ 1.0 per 60fps step
    update(config.dt);
    acc -= STEP_MS;
  }

  render();
}

function update(dt) {
  pipes.update?.(dt);
  floor.update?.(dt);
  player.update?.(dt);

  // Floor must exist (defensive)
  if (!floor) return;

  // Ground collision
  if (player && (player.y + player.h >= floor.y)) {
    gameOver();
    return;
  }

  // Pipes (support both property schemes)
  const uppers = getUpperPipes();
  const lowers = getLowerPipes();

  for (let i = 0; i < uppers.length; i++) {
    const up  = uppers[i];
    const low = lowers[i];

    // Score once when player fully passes the upper pipe's trailing edge
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

  // Simple score text (works even if you removed a Score entity)
  ctx.save();
  ctx.font = 'bold 22px system-ui,Segoe UI,Roboto,Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(String(score), canvas.width / 2, 40);
  ctx.restore();
}

function gameOver() {
  running = false;
  try { sounds.hit?.play?.(); } catch {}

  // Draw one last gameplay frame
  try { render(); } catch {}

  // Fade-in the game-over overlay
  const START = performance.now();
  const DURATION = 350; // ms
  function step(t) {
    const p = Math.min(1, (t - START) / DURATION);
    drawGameOverOverlay(p);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  // After a short pause, reset to idle ("Tap to Start")
  setTimeout(() => {
    buildWorld('idle');
    drawIdle();
  }, 1500);
}

// Expose for quick manual start in console (optional)
window._start = start;
