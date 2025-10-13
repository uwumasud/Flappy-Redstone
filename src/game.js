// src/game.js — plain fullscreen game, tap/space to start + flap.
// Fixed-step update for consistent speed across phones/desktops.

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
ctx.imageSmoothingEnabled = false;

// Core singletons
const win = new Window(canvas.width, canvas.height);
const images = new Images();
const sounds = new Sounds();
const config = { ctx, window: win, images, sounds, screen: canvas, dt: 1 };

let background, floor, pipes, player, score, welcomeMsg, gameOverMsg;
let running = false, paused = false, rafId = null;
let last = 0, acc = 0;
const STEP_MS = 1000/60; // 16.67 ms

// ---------- helpers ----------
function collides(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function playerRect() { return player?.hitbox || player?.rect || {x:0,y:0,w:0,h:0}; }
function clear() { ctx.clearRect(0,0,canvas.width,canvas.height); }

// ---------- world build ----------
function buildWorld(mode = 'idle') {
  images.randomize?.();
  background = new Background(config);
  floor = new Floor(config);
  pipes = new Pipes(config);
  player = new Player(config);
  score = new Score?.(config) || null;
  welcomeMsg = new WelcomeMessage?.(config) || null;
  gameOverMsg = new GameOver?.(config) || null;

  if (mode === 'play') player.set_mode(PlayerMode.NORMAL);
  else player.set_mode(PlayerMode.SHM);
}

// ---------- init ----------
(async function init(){
  await images.load();

  // initial idle screen
  buildWorld('idle');
  drawIdle();

  // inputs: first tap/space starts game, afterward it flaps
  const startOrFlap = () => {
    if (!running) { start(); return; }
    player?.flap?.();
  };
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); startOrFlap(); }, {passive:false});
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); startOrFlap(); }
  });
})();

function drawIdle(){
  clear();
  background.tick(1);
  floor.tick(1);
  welcomeMsg?.tick?.(1);
}

// ---------- start / loop / game over ----------
function start(){
  running = true; paused = false;
  buildWorld('play');
  last = 0; acc = 0;
  loop(performance.now());
}

function loop(t){
  if (paused || !running) { cancelAnimationFrame(rafId); return; }
  rafId = requestAnimationFrame(loop);

  if (!last) last = t;
  let dtMs = Math.min(t - last, 1000/20); // clamp to avoid huge steps
  last = t; acc += dtMs;

  while (acc >= STEP_MS){
    config.dt = STEP_MS / (1000/60); // ≈1.0 at 60fps
    update(config.dt);
    acc -= STEP_MS;
  }
  render();
}

function update(dt){
  pipes.update?.(dt);
  floor.update?.(dt);
  player.update?.(dt);

  // ground
  if (player.y + player.h >= floor.y) { return gameOver(); }

  // pipes
  for (let i = 0; i < pipes.upper.length; i++){
    const up = pipes.upper[i], low = pipes.lower[i];
    if (!up.scored && player.x > up.x + up.w) { up.scored = true; score?.add?.(); try{ sounds.point?.play?.(); }catch(_){} }
    const p = playerRect();
    if (collides(p, {x:up.x,y:up.y,w:up.w,h:up.h}) || collides(p,{x:low.x,y:low.y,w:low.w,h:low.h})) {
      return gameOver();
    }
  }
}

function render(){
  clear();
  background.tick(config.dt);
  pipes.tick(config.dt);
  floor.tick(config.dt);
  player.tick(config.dt);
  score?.tick?.(config.dt);
}

function gameOver(){
  running = false; paused = false;
  try{ sounds.hit?.play?.(); }catch(_){}
  // draw one last frame + optional gameover layer
  render();
  gameOverMsg?.tick?.(1);
  // return to idle state; next tap will start a fresh run
  buildWorld('idle');
  drawIdle();
}

// Expose for console debugging if needed
window._stoney_start = start;
