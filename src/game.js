// src/game.js — minimal, robust, no UI. Tap/Space: start, then flap.
// Works even if some images are still loading or optional files are missing.

import { Window } from './utils/window.js';
import { Images } from './utils/images.js';
import { Sounds } from './utils/sounds.js';

import { Background } from './entities/background.js';
import { Floor } from './entities/floor.js';
import { Pipes } from './entities/pipe.js';
import { Player, PlayerMode } from './entities/player.js';

// --------- canvas/context ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

// --------- core singletons ----------
const win = new Window(canvas.width, canvas.height);
const images = new Images();
const sounds = new Sounds();
const config = { ctx, window: win, images, sounds, screen: canvas, dt: 1 };

// --------- state ----------
let background, floor, pipes, player;
let running = false, paused = false, rafId = null;
let last = 0, acc = 0;
const STEP_MS = 1000 / 60; // fixed timestep
let score = 0;

// --------- helpers ----------
const collides = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const playerRect = () => player?.hitbox || player?.rect || { x:0,y:0,w:0,h:0 };
const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);

// --------- world build ----------
function buildWorld(mode = 'idle') {
  images.randomize?.();
  background = new Background(config);
  floor      = new Floor(config);
  pipes      = new Pipes(config);
  player     = new Player(config);
  score      = 0;
  player.set_mode(mode === 'play' ? PlayerMode.NORMAL : PlayerMode.SHM);
}

// --------- init ----------
(async function init() {
  try { await images.load(); } catch(e) { console.warn('images.load failed', e); }
  buildWorld('idle');
  drawIdle();

  const startOrFlap = () => {
    if (!running) { start(); return; }
    player?.flap?.();
  };
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); startOrFlap(); }, { passive:false });
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); startOrFlap(); }
  });

  // In Telegram expand viewport (safe no-op in browser)
  if (window.Telegram?.WebApp) window.Telegram.WebApp.expand();
})();

function drawIdle() {
  clear();
  // safe draws even if images not ready
  try { background.tick(1); } catch {}
  try { floor.tick(1); } catch {}
  // draw a tiny hint
  ctx.save();
  ctx.font = 'bold 18px system-ui,Segoe UI,Roboto,Arial';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('Tap to Start', canvas.width/2, canvas.height*0.35);
  ctx.restore();
}

// --------- start / loop / game over ----------
function start() {
  running = true; paused = false;
  buildWorld('play');
  last = 0; acc = 0;
  loop(performance.now());
}

function loop(t) {
  if (paused || !running) { cancelAnimationFrame(rafId); return; }
  rafId = requestAnimationFrame(loop);

  if (!last) last = t;
  let dtMs = Math.min(t - last, 1000/20); // clamp big jumps
  last = t; acc += dtMs;

  while (acc >= STEP_MS) {
    config.dt = STEP_MS / (1000/60); // ≈1.0 @60fps
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
  if (player.y + player.h >= floor.y) return gameOver();

  // pipes
  for (let i = 0; i < pipes.upper.length; i++) {
    const up = pipes.upper[i], low = pipes.lower[i];

    // score when passing trailing edge of the upper pipe
    if (!up.scored && player.x > up.x + up.w) {
      up.scored = true; score++;
      try { sounds.point?.play?.(); } catch {}
    }
    const p = playerRect();
    if (collides(p, {x:up.x,y:up.y,w:up.w,h:up.h}) ||
        collides(p, {x:low.x,y:low.y,w:low.w,h:low.h})) {
      return gameOver();
    }
  }
}

function render() {
  clear();
  // draw background / pipes / floor / player
  try { background.tick(config.dt); } catch {}
  try { pipes.tick(config.dt); } catch {}
  try { floor.tick(config.dt); } catch {}
  try { player.tick(config.dt); } catch {}

  // simple score (in case your Score entity is removed)
  ctx.save();
  ctx.font = 'bold 22px system-ui,Segoe UI,Roboto,Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(String(score), canvas.width/2, 40);
  ctx.restore();
}

function gameOver() {
  running = false;
  try { sounds.hit?.play?.(); } catch {}
  // Draw last frame, then reset to idle so next tap restarts
  render();
  buildWorld('idle');
  drawIdle();
}

// expose for console if needed
window._start = start;
