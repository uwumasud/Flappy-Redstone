import { Window } from './utils/window.js';
import { Images } from './utils/images.js';
import { Sounds } from './utils/sounds.js';

import { Background } from './entities/background.js';
import { Floor } from './entities/floor.js';
import { Pipes } from './entities/pipe.js';
import { Player, PlayerMode } from './entities/player.js';
import { Score } from './entities/score.js';
import { WelcomeMessage } from './entities/welcome_message.js';
import { GameOver } from './entities/game_over.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false; // crisper on phones

const win = new Window(canvas.width, canvas.height);
const images = new Images();
const sounds = new Sounds();
const config = { ctx, window: win, images, sounds, screen: canvas, tick: () => {}, dt: 1 };

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const lbBtn = document.getElementById('leaderboardBtn');

let running = false, paused = false, rafId = null;
let background, floor, pipes, player, score, welcomeMsg;

function togglePauseButtons() {
  if (!pauseBtn || !resumeBtn) return;
  pauseBtn.hidden = !running || paused;
  resumeBtn.hidden = !running || !paused;
}

function collides(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

async function init() {
  await images.load();
  background  = new Background(config);
  floor       = new Floor(config);
  pipes       = new Pipes(config);
  player      = new Player(config); // idle mode initially
  score       = new Score(config);
  welcomeMsg  = new WelcomeMessage(config);

  drawStatic();

  canvas.addEventListener('pointerdown', () => player?.flap());
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); player?.flap(); }
  });

  startBtn?.addEventListener('click', start);
  pauseBtn?.addEventListener('click', () => { paused = true; togglePauseButtons(); });
  resumeBtn?.addEventListener('click', () => { paused = false; loop(performance.now()); togglePauseButtons(); });
  lbBtn?.addEventListener('click', () => { /* open local LB panel if you added one */ });
}

function drawStatic() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  background.tick(config.dt);
  floor.tick(config.dt);
  welcomeMsg.tick(config.dt);
}

function start() {
  running = true; paused = false; togglePauseButtons();

  images.randomize();
  background  = new Background(config);
  floor       = new Floor(config);
  pipes       = new Pipes(config);   // fresh pipe queue
  player      = new Player(config);
  player.set_mode(PlayerMode.NORMAL); // << enable physics
  score.reset?.();

  loop(performance.now());
}

// ---------- main loop (delta-time) ----------
const FIXED = 1000/60;          // 16.67ms baseline
let last = 0, acc = 0;
function loop(t) {
  if (paused || !running) { cancelAnimationFrame(rafId); return; }
  rafId = requestAnimationFrame(loop);

  if (!last) last = t;
  let dtMs = t - last;          // elapsed
  last = t;

  // clamp (avoid giant jumps on tab switches)
  dtMs = Math.min(dtMs, 1000/20);  // max step ~50ms
  acc += dtMs;

  while (acc >= FIXED) {
    config.dt = FIXED / (1000/60); // ~1.0 per 60fps step
    update();                      // physics update in fixed steps
    acc -= FIXED;
  }

  render();                        // draw once per RAF
}

function update() {
  pipes.update(config.dt);   // now time-scaled
  floor.update?.(config.dt);
  player.update?.(config.dt);
}

function render() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  background.tick(config.dt);
  pipes.tick(config.dt);
  floor.tick(config.dt);
  player.tick(config.dt);
  score.tick?.(config.dt);

  // ground collision
  if (player.y + player.h >= floor.y) return gameOver();

  // pipe collisions + scoring
  for (let i = 0; i < pipes.upper.length; i++) {
    const up = pipes.upper[i], low = pipes.lower[i];

    if (!up.scored && player.x > up.x + up.w) { up.scored = true; score.add?.(); }

    if (collides(player.hitbox, { x: up.x, y: up.y, w: up.w, h: up.h }) ||
        collides(player.hitbox, { x: low.x, y: low.y, w: low.w, h: low.h })) {
      return gameOver();
    }
  }
}

function gameOver() {
  running = false; paused = false; togglePauseButtons();
  try { sounds.hit.play(); } catch(_) {}
}

init();
