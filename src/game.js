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

// ===== Canvas / State
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const win = new Window(canvas.width, canvas.height);

const images = new Images();
const sounds = new Sounds();
const config = { ctx, window: win, images, sounds, screen: canvas, tick: () => {} };

// HUD elements (if you have them)
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const lbBtn = document.getElementById('leaderboardBtn'); // optional

let running = false, paused = false, rafId = null;
let background, floor, pipes, player, score, welcomeMsg, gameOverMsg;

// ===== Helpers
function togglePauseButtons() {
  if (!pauseBtn || !resumeBtn) return;
  pauseBtn.hidden = !running || paused;
  resumeBtn.hidden = !running || !paused;
}

function collides(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ===== Init + Start
async function init() {
  await images.load(); // loads backgrounds / player frames / pipes / base / ui
  background = new Background(config);
  floor = new Floor(config);
  pipes = new Pipes(config);
  player = new Player(config); // starts in SHM
  score = new Score(config);
  welcomeMsg = new WelcomeMessage(config);
  gameOverMsg = new GameOver(config);

  // First paint (idle screen)
  drawStatic();

  // Wire inputs
  canvas.addEventListener('pointerdown', () => player?.flap());
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      player?.flap();
    }
  });

  startBtn?.addEventListener('click', start);
  pauseBtn?.addEventListener('click', () => { paused = true; togglePauseButtons(); });
  resumeBtn?.addEventListener('click', () => { paused = false; loop(); togglePauseButtons(); });
  lbBtn?.addEventListener('click', () => { /* open your LB panel if you have one */ });
}

function drawStatic() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  background.tick();
  floor.tick();
  welcomeMsg.tick();
}

function start() {
  running = true; paused = false; togglePauseButtons();

  // Re-roll random skin set and rebuild entities for a fresh run
  images.randomize();
  background = new Background(config);
  floor = new Floor(config);
  pipes = new Pipes(config);
  player = new Player(config);
  player.set_mode(PlayerMode.NORMAL);          // << critical: activates gravity/flap
  score.reset?.();

  loop();
}

// ===== Main loop
function loop() {
  if (paused || !running) { cancelAnimationFrame(rafId); return; }
  rafId = requestAnimationFrame(loop);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  background.tick();
  pipes.tick();
  floor.tick();
  player.tick();
  score.tick?.();

  // Ground collision
  const groundY = floor.y;
  if (player.y + player.h >= groundY) return gameOver();

  // Pipe collisions & scoring
  for (let i = 0; i < pipes.upper.length; i++) {
    const up = pipes.upper[i], low = pipes.lower[i];

    // score once when player passes the upper pipe's trailing edge
    if (!up.scored && player.x > up.x + up.w) {
      up.scored = true;
      score.add?.();
    }

    // rect collisions
    if (collides(player.rect, { x: up.x,  y: up.y,  w: up.w,  h: up.h }) ||
        collides(player.rect, { x: low.x, y: low.y, w: low.w, h: low.h })) {
      return gameOver();
    }
  }
}

function gameOver() {
  running = false; paused = false; togglePauseButtons();
  try { sounds.hit.play(); } catch (_) {}
  // You can open a "Game Over / Leaderboard" panel here.
}

// ===== Boot
init();
