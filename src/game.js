// src/game.js
// Main game orchestrator (delta-time, inputs, collisions, states)

import { Window } from './utils/window.js';
import { Images } from './utils/images.js';
import { Sounds } from './utils/sounds.js';

import { Background } from './entities/background.js';
import { Floor } from './entities/floor.js';
import { Pipes } from './entities/pipe.js';
import { Player, PlayerMode } from './entities/player.js';
import { Score } from './entities/score.js';
import { WelcomeMessage } from './entities/welcome_message.js'; // optional
import { GameOver } from './entities/game_over.js';              // optional

// ---------- canvas / ctx ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

// ---------- core singletons ----------
const win = new Window(canvas.width, canvas.height);
const images = new Images();
const sounds = new Sounds();

// Shared config object passed to entities
const config = {
  ctx,
  window: win,
  images,
  sounds,
  screen: canvas,
  tick: () => {},
  dt: 1,             // scaled to 60fps steps
};

// ---------- state ----------
let running = false;
let paused  = false;
let rafId   = null;

let background, floor, pipes, player, score;
let welcomeMsg, gameOverMsg;     // optional, drawn if present
let scoreValue = 0;              // fallback if Score entity doesn’t implement add/reset

// ---------- helpers ----------
function collides(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function playerRect() {
  // Prefer the smaller hitbox from our Player rewrite; fallback to full rect
  return player?.hitbox || player?.rect || { x:0, y:0, w:0, h:0 };
}
function clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

// ---------- init ----------
async function init() {
  await images.load();           // preload sprites
  background = new Background(config);
  floor      = new Floor(config);
  pipes      = new Pipes(config);
  player     = new Player(config);            // starts in SHM (idle)
  score      = new Score?.(config) || null;   // Score may not exist; guard safely
  welcomeMsg = new WelcomeMessage?.(config) || null;
  gameOverMsg= new GameOver?.(config) || null;

  // first paint (idle)
  clear();
  background.tick(config.dt);
  floor.tick(config.dt);
  welcomeMsg?.tick?.(config.dt);

  wireInputs();
}
init();

// ---------- inputs ----------
function wireInputs() {
  // Tap/click anywhere on canvas to flap
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    player?.flap?.();
  }, { passive: false });

  // Keyboard fallback
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      player?.flap?.();
    }
    if (e.code === 'Enter') toggleStart();
  });

  // Hooks from index.html (splash/controller)
  document.addEventListener('startGame', () => start());
  document.addEventListener('flap',      () => player?.flap?.());
  document.addEventListener('toggleStart', toggleStart);
}

function toggleStart() {
  if (!running) { start(); return; }
  paused = !paused;
  if (!paused) loop(performance.now());
}

// ---------- world (re)build ----------
function buildWorld() {
  images.randomize?.();            // pick random skins if your Images supports it
  background = new Background(config);
  floor      = new Floor(config);
  pipes      = new Pipes(config);
  player     = new Player(config);
  player.set_mode(PlayerMode.NORMAL);  // IMPORTANT: enable physics
  scoreValue = 0;
  score?.reset?.();
}

// ---------- start / game over ----------
function start() {
  running = true;
  paused  = false;
  buildWorld();
  last = 0; acc = 0;               // reset the fixed-step clock
  loop(performance.now());
}

function gameOver() {
  running = false;
  paused  = false;
  try { sounds.hit?.play?.(); } catch(_) {}
  // Draw a simple overlay if you have a GameOver entity
  if (gameOverMsg) {
    gameOverMsg.tick?.(config.dt);
  }
}

// ---------- main loop (fixed timestep + render) ----------
const STEP_MS = 1000 / 60; // 16.67ms
let last = 0;
let acc  = 0;

function loop(t) {
  if (paused || !running) { cancelAnimationFrame(rafId); return; }
  rafId = requestAnimationFrame(loop);

  if (!last) last = t;
  let dtMs = t - last;
  last = t;

  // clamp huge tab-switch spikes (prevents tunneling through pipes)
  dtMs = Math.min(dtMs, 1000/20);  // max ~50ms
  acc += dtMs;

  while (acc >= STEP_MS) {
    // Scale dt so entity update() can be frame-rate independent.
    config.dt = STEP_MS / (1000/60); // ≈ 1.0 per 60fps step
    update(config.dt);
    acc -= STEP_MS;
  }

  render();
}

// ---------- update (pure logic/physics) ----------
function update(dt) {
  // Some entities implement update(dt); if not, their tick() will still draw.
  pipes.update?.(dt);
  floor.update?.(dt);
  player.update?.(dt);

  // Ground collision -> end game
  if (player && (player.y + player.h >= floor.y)) {
    gameOver();
    return;
  }

  // Pipe collisions & scoring
  for (let i = 0; i < pipes.upper.length; i++) {
    const up  = pipes.upper[i];
    const low = pipes.lower[i];

    // Score when player passes trailing edge of the upper pipe
    if (!up.scored && player.x > up.x + up.w) {
      up.scored = true;
      score?.add?.();
      scoreValue++;
      try { sounds.point?.play?.(); } catch(_) {}
    }

    // Rect collision against smaller hitbox (prevents "sticking")
    const p = playerRect();
    if (collides(p, { x: up.x,  y: up.y,  w: up.w,  h: up.h }) ||
        collides(p, { x: low.x, y: low.y, w: low.w, h: low.h })) {
      gameOver();
      return;
    }
  }
}

// ---------- render (draw only) ----------
function render() {
  clear();
  background.tick(config.dt);
  pipes.tick(config.dt);     // draws both upper & lower arrays
  floor.tick(config.dt);
  player.tick(config.dt);

  // Draw a very small score as text if your Score entity doesn't render on its own
  if (!score?.tick) {
    ctx.save();
    ctx.font = 'bold 22px system-ui,Segoe UI,Roboto,Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(String(scoreValue), canvas.width / 2, 40);
    ctx.restore();
  } else {
    score.tick(config.dt);
  }
}

// ---------- OPTIONAL: expose start() for debugging in console ----------
window._stoney_start = start;
