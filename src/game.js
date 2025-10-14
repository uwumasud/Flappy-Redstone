// Robust Flappy core: instant draw, 60Hz fixed step, restart-safe.
// No blocking on image loads; no async work in the render loop.

import { Window }   from './utils/window.js';
import { Images }   from './utils/images.js';
import { Sounds }   from './utils/sounds.js';

import { Background }         from './entities/background.js';
import { Floor }              from './entities/floor.js';
import { Pipes }              from './entities/pipe.js';
import { Player, PlayerMode } from './entities/player.js';

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
addEventListener('resize', fitHiDPI);

// ---------- Core singletons ----------
const win     = new Window(288, 512);
const images  = new Images();
const sounds  = new Sounds();
const config  = { ctx, window: win, images, sounds, screen: canvas, dt: 1 };

// ---------- State ----------
let background, floor, pipes, player;
let running = false, paused = false, rafId = null;
let last = 0, acc = 0;
const STEP_MS = 1000 / 60;
let score = 0;

// ---------- Helpers ----------
const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
const collides = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const playerRect = () => player?.hitbox || player?.rect || { x:0,y:0,w:0,h:0 };
const getUpperPipes = () => pipes?.upper || pipes?.upper_pipes || [];
const getLowerPipes = () => pipes?.lower || pipes?.lower_pipes || [];

// ---------- World ----------
function buildWorld(mode='idle'){
  background = new Background(config);
  floor      = new Floor(config);
  pipes      = new Pipes(config);
  player     = new Player(config);
  score      = 0;
  player.set_mode(mode === 'play' ? PlayerMode.NORMAL : PlayerMode.SHM);
}

function drawIdle(){
  clear();
  try { background.tick(1); } catch {}
  try { floor.tick(1); }      catch {}
  // hint (world-centered)
  ctx.save();
  ctx.font = 'bold 18px system-ui,Segoe UI,Roboto,Arial';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('Tap to Start', win.w/2, win.h*0.35);
  ctx.restore();
}

// ---------- Loop ----------
function start(){
  if (running) return;
  running = true; paused = false;
  buildWorld('play');
  last = 0; acc = 0;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function loop(t){
  if (paused || !running) { if (rafId) cancelAnimationFrame(rafId); return; }
  rafId = requestAnimationFrame(loop);

  if (!last) last = t;
  let dtMs = t - last; last = t;
  dtMs = Math.min(dtMs, 1000/20); // clamp spikes
  acc += dtMs;

  while (acc >= STEP_MS){
    config.dt = STEP_MS / (1000/60);
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
  if (player.y + player.h >= floor.y) return gameOver();

  // pipes
  const uppers = getUpperPipes();
  const lowers = getLowerPipes();
  for (let i = 0; i < uppers.length; i++){
    const up  = uppers[i];
    const low = lowers[i];

    // score as soon as we pass trailing edge of upper pipe
    if (up && !up.scored && player.x > up.x + up.w){
      up.scored = true; score++;
      try { sounds.point?.play?.(); } catch {}
    }

    const p = playerRect();
    if (up  && collides(p, {x:up.x,  y:up.y,  w:up.w,  h:up.h})) return gameOver();
    if (low && collides(p, {x:low.x, y:low.y, w:low.w, h:low.h})) return gameOver();
  }
}

function render(){
  clear();
  try { background.tick(config.dt); } catch {}
  try { pipes.tick(config.dt); }      catch {}
  try { floor.tick(config.dt); }      catch {}
  try { player.tick(config.dt); }     catch {}

  // HUD score
  ctx.save();
  ctx.font = 'bold 22px system-ui,Segoe UI,Roboto,Arial';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(String(score), win.w/2, 40);
  ctx.restore();
}

function gameOver(){
  running = false;
  try { sounds.hit?.play?.(); } catch {}
  try { render(); } catch {}

  // quick pause, then return to idle — ready to start immediately
  setTimeout(()=>{
    buildWorld('idle');
    drawIdle();
  }, 800);
}

// ---------- Init (draw immediately; load images in background) ----------
(function init(){
  buildWorld('idle');
  drawIdle();

  // kick off image load, but DO NOT await — we already render
  images.load().catch(e=>console.warn('images.load failed', e));

  const startOrFlap = () => {
    if (!running) { start(); return; }
    player?.flap?.();
  };

  // one-time listeners
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); startOrFlap(); }, { passive:false, once:false });
  addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp'){ e.preventDefault(); startOrFlap(); }
  });

  try { if (window.Telegram?.WebApp) window.Telegram.WebApp.expand(); } catch {}
})();
