// src/game.js — stable loop + global leaderboard overlay (Cloudflare backend).
import { Window }   from './utils/window.js';
import { Images }   from './utils/images.js';
import { Sounds }   from './utils/sounds.js';
import { Background }         from './entities/background.js';
import { Floor }              from './entities/floor.js';
import { Pipes }              from './entities/pipe.js';
import { Player, PlayerMode } from './entities/player.js';

import { setApiBase, submitScore, getTop } from './leaderboard.js';

// ====== SET THIS after you deploy the worker ======
// setApiBase('https://<your-worker-subdomain>.workers.dev');

// ---------- Canvas ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

function fitHiDPI(){
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  canvas.width = Math.round(288*dpr); canvas.height = Math.round(512*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
fitHiDPI();
addEventListener('resize', fitHiDPI);

// ---------- Core ----------
const win    = new Window(288, 512);
const images = new Images();
const sounds = new Sounds();
const config = { ctx, window: win, images, sounds, screen: canvas, dt:1, groundY: win.h - 112 };

// ---------- State ----------
let background, floor, pipes, player;
let state = 'idle'; // 'idle' | 'play' | 'lb'
let last=0, acc=0; const STEP_MS = 1000/60;
let score=0;
let lbOpen=false, lbCache=[], lbLoading=false, lbNeedsRefresh=false;

// ---------- Helpers ----------
const clear = () => ctx.clearRect(0,0,canvas.width,canvas.height);
const collides = (a,b)=> a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;
const playerRect = ()=> player?.hitbox || player?.rect || {x:0,y:0,w:0,h:0};
const uppers = ()=> pipes?.upper || pipes?.upper_pipes || [];
const lowers  = ()=> pipes?.lower || pipes?.lower_pipes || [];

// ---------- Leaderboard overlay ----------
const lbBtn = document.getElementById('lbBtn');
lbBtn?.addEventListener('click', () => toggleLB());

function toggleLB(force){
  lbOpen = typeof force==='boolean' ? force : !lbOpen;
  state = lbOpen ? 'lb' : (state==='idle'?'idle':'play');
  if (lbOpen){ fetchLB(); }
}

async function fetchLB(){
  if (lbLoading) return;
  lbLoading = true;
  try{ lbCache = await getTop(20); }
  catch{ lbCache = []; }
  lbLoading = false;
}

function drawLeaderboard(){
  const W = win.w, H = win.h;
  ctx.save();
  // dim
  ctx.fillStyle = 'rgba(0,0,0,.65)';
  ctx.fillRect(0,0,W,H);

  // panel
  const pw = Math.floor(W*0.82), ph = Math.floor(H*0.7);
  const px = Math.floor((W-pw)/2), py = Math.floor((H-ph)/2);
  ctx.fillStyle = '#0d1117'; ctx.fillRect(px,py,pw,ph);
  ctx.strokeStyle = '#2a3340'; ctx.strokeRect(px,py,pw,ph);

  ctx.fillStyle = '#e6edf3';
  ctx.font = 'bold 18px system-ui,Segoe UI,Roboto,Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Global Leaderboard', W/2, py+24);

  ctx.font = 'bold 12px system-ui,Segoe UI,Roboto,Arial';
  ctx.textAlign = 'left';

  const list = lbCache || [];
  const startY = py + 46;
  const rowH = 18;
  if (lbLoading){
    ctx.fillText('Loading…', px+16, startY);
  } else if (!list.length){
    ctx.fillText('No scores yet.', px+16, startY);
  } else {
    list.slice(0,20).forEach((r,i)=>{
      const y = startY + i*rowH;
      ctx.fillStyle = i===0?'#ffd33d':'#e6edf3';
      const name = (r.username || r.name || 'Player').toString().slice(0,18);
      ctx.fillText(`${i+1}. ${name}`, px+16, y);
      ctx.textAlign = 'right';
      ctx.fillText(String(r.score|0), px+pw-16, y);
      ctx.textAlign = 'left';
    });
  }

  // close hint
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9da7b3';
  ctx.fillText('Tap anywhere to close', W/2, py+ph-12);
  ctx.restore();
}

// close LB on canvas tap
canvas.addEventListener('pointerdown', e => {
  if (lbOpen){ e.preventDefault(); toggleLB(false); }
}, { passive:false });

// ---------- World ----------
function buildWorld(mode='idle'){
  background = new Background(config);
  floor      = new Floor(config);
  pipes      = new Pipes(config);
  player     = new Player(config);
  score = 0;
  player.set_mode(mode==='play'? PlayerMode.NORMAL : PlayerMode.SHM);
  state = (mode==='play')? 'play' : 'idle';
}

function drawIdleHint(){
  ctx.save();
  ctx.font = 'bold 18px system-ui,Segoe UI,Roboto,Arial';
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.fillText('Tap to Start', win.w/2, win.h*0.35);
  ctx.restore();
}

// ---------- Loop ----------
function startPlay(){
  if (state==='play') return;
  buildWorld('play');
}

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
  background.update?.(dt);
  floor.update?.(dt);

  if (state === 'lb'){
    // keep background animating behind overlay
    return;
  }

  if (state === 'idle'){
    player.update?.(dt);
    return;
  }

  // play
  pipes.update?.(dt);
  player.update?.(dt);

  const groundY = config.groundY ?? (win.h - 112);
  if (player.y + player.h >= groundY){
    onGameOver();
    return;
  }

  const ups = uppers(), lows = lowers();
  for (let i=0;i<ups.length;i++){
    const up = ups[i], low = lows[i];
    if (up && !up.scored && player.x > up.x + up.w){
      up.scored = true; score++;
      try { sounds.point?.play?.(); } catch {}
    }
    const p = playerRect();
    if (up && collides(p,{x:up.x,y:up.y,w:up.w,h:up.h})) return onGameOver();
    if (low&&collides(p,{x:low.x,y:low.y,w:low.w,h:low.h})) return onGameOver();
  }
}

function render(){
  clear();
  background.tick?.(config.dt);
  pipes?.tick?.(config.dt);
  floor.tick?.(config.dt);
  player.tick?.(config.dt);

  if (state==='play'){
    ctx.save();
    ctx.font='bold 22px system-ui,Segoe UI,Roboto,Arial';
    ctx.fillStyle='#fff'; ctx.textAlign='center';
    ctx.fillText(String(score), win.w/2, 40);
    ctx.restore();
  } else if (state==='idle'){
    drawIdleHint();
  }

  if (lbOpen) drawLeaderboard();
}

function onGameOver(){
  try{ sounds.hit?.play?.(); }catch{}
  // submit asynchronously; don't block restart
  submitScore(score).then(()=>{ lbNeedsRefresh = true; }).catch(()=>{});
  // go idle immediately; allow instant restart
  buildWorld('idle');
}

// ---------- Init ----------
(function init(){
  buildWorld('idle');
  images.load().catch(e=>console.warn('images.load failed', e));

  const tap = () => {
    if (lbOpen) return; // ignore taps when overlay open (tap closes it via handler)
    if (state!=='play'){ startPlay(); return; }
    player?.flap?.();
  };
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); tap(); }, { passive:false });
  addEventListener('keydown', e=>{
    if (e.code==='Space'||e.code==='ArrowUp'){ e.preventDefault(); tap(); }
  });

  try { if (window.Telegram?.WebApp) window.Telegram.WebApp.expand(); } catch {}
  requestAnimationFrame(loop);

  // refresh LB after score submit
  setInterval(()=>{ if (lbNeedsRefresh && !lbOpen){ lbNeedsRefresh=false; fetchLB(); } }, 2000);
})();
