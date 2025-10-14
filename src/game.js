// Always-on loop (idle + play). Clean restarts, instant input, floor-based collisions.

import { Window }   from './utils/window.js';
import { Images }   from './utils/images.js';
import { Sounds }   from './utils/sounds.js';

import { Background }         from './entities/background.js';
import { Floor }              from './entities/floor.js';
import { Pipes }              from './entities/pipe.js';
import { Player, PlayerMode } from './entities/player.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

function fitHiDPI() {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  canvas.width  = Math.round(288 * dpr);
  canvas.height = Math.round(512 * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
fitHiDPI();
addEventListener('resize', fitHiDPI);

// core singletons
const win     = new Window(288, 512);
const images  = new Images();
const sounds  = new Sounds();
const config  = { ctx, window: win, images, sounds, screen: canvas, dt: 1, groundY: win.h - 112 };

// state
let background, floor, pipes, player;
let state = 'idle'; // 'idle' | 'play'
let last = 0, acc = 0;
const STEP_MS = 1000 / 60;
let score = 0;

// helpers
const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
const collides = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const playerRect = () => player?.hitbox || player?.rect || { x:0,y:0,w:0,h:0 };
const getUpperPipes = () => pipes?.upper || pipes?.upper_pipes || [];
const getLowerPipes = () => pipes?.lower || pipes?.lower_pipes || [];

// world
function buildWorld(mode='idle'){
  background = new Background(config);
  floor      = new Floor(config);
  pipes      = new Pipes(config);
  player     = new Player(config);
  score      = 0;
  player.set_mode(mode === 'play' ? PlayerMode.NORMAL : PlayerMode.SHM);
  state = (mode === 'play') ? 'play' : 'idle';
}

function drawIdleHint(){
  ctx.save();
  ctx.font = 'bold 18px system-ui,Segoe UI,Roboto,Arial';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('Tap to Start', win.w/2, win.h*0.35);
  ctx.restore();
}

// start play
function startPlay(){
  if (state === 'play') return;
  buildWorld('play');
}

// loop (always running)
function loop(t){
  requestAnimationFrame(loop);

  if (!last) last = t;
  let dtMs = t - last; last = t;
  dtMs = Math.min(dtMs, 1000/20);
  acc += dtMs;

  while (acc >= STEP_MS){
    config.dt = STEP_MS / (1000/60);
    update(config.dt);
    acc -= STEP_MS;
  }

  render();
}

function update(dt){
  // always animate world so nothing looks frozen
  background.update?.(dt);
  floor.update?.(dt);

  if (state === 'idle'){
    player.update?.(dt); // idling bob
    return; // no pipes in idle
  }

  // play
  pipes.update?.(dt);
  player.update?.(dt);

  // floor collision uses real floor
  const groundY = config.groundY ?? (win.h - 112);
  if (player.y + player.h >= groundY) {
    // soft game over: go back to idle immediately and let the always-on loop continue
    buildWorld('idle');
    return;
  }

  // pipes + scoring
  const uppers = getUpperPipes();
  const lowers = getLowerPipes();
  for (let i = 0; i < uppers.length; i++){
    const up  = uppers[i];
    const low = lowers[i];

    if (up && !up.scored && player.x > up.x + up.w){
      up.scored = true; score++;
      try { sounds.point?.play?.(); } catch {}
    }

    const p = playerRect();
    if (up  && collides(p, {x:up.x,  y:up.y,  w:up.w,  h:up.h})) { buildWorld('idle'); return; }
    if (low && collides(p, {x:low.x, y:low.y, w:low.w, h:low.h})) { buildWorld('idle'); return; }
  }
}

function render(){
  clear();
  try { background.tick(config.dt); } catch {}
  try { pipes?.tick?.(config.dt); }  catch {}
  try { floor.tick(config.dt); }     catch {}
  try { player.tick(config.dt); }    catch {}

  // score when playing
  if (state === 'play'){
    ctx.save();
    ctx.font = 'bold 22px system-ui,Segoe UI,Roboto,Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(String(score), win.w/2, 40);
    ctx.restore();
  } else {
    // idle hint
    drawIdleHint();
  }
}

// init: draw immediately; load assets in background; run loop forever
(function init(){
  buildWorld('idle');
  // don’t await images — we already draw
  images.load().catch(e=>console.warn('images.load failed', e));

  // input
  const tap = () => {
    if (state !== 'play') { startPlay(); return; }
    player?.flap?.();
  };
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); tap(); }, { passive:false });
  addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp'){ e.preventDefault(); tap(); }
  });

  try { if (window.Telegram?.WebApp) window.Telegram.WebApp.expand(); } catch {}

  requestAnimationFrame(loop);
})();
