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
const ctx = canvas.getContext('2d');
const windowState = new Window(canvas.width, canvas.height);

const images = new Images();
const sounds = new Sounds();

const config = {
  ctx,
  window: windowState,
  images,
  sounds,
  screen: canvas,
  tick: () => {},
};

// UI elements
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const settingsBtn = document.getElementById('settingsBtn');
const aboutBtn = document.getElementById('aboutBtn');
const lbBtn = document.getElementById('leaderboardBtn');
const pnlSettings = document.getElementById('panelSettings');
const pnlAbout = document.getElementById('panelAbout');
const pnlLB = document.getElementById('panelLB');
const soundChk = document.getElementById('soundChk');
const difficultySel = document.getElementById('difficultySel');
const playerName = document.getElementById('playerName');
const lbList = document.getElementById('lbList');

let running=false, paused=false, animationId=null;
let background, floor, pipes, player, score, welcomeMsg, gameOverMsg;

function setSoundMuted(muted){
  [sounds.die,sounds.hit,sounds.point,sounds.swoosh,sounds.wing].forEach(a => { a.muted = muted; });
}
soundChk.addEventListener('change', ()=> setSoundMuted(!soundChk.checked));

settingsBtn.addEventListener('click', ()=>{ pnlSettings.hidden=false; paused=true; togglePauseButtons(); });
aboutBtn.addEventListener('click', ()=>{ pnlAbout.hidden=false; paused=true; togglePauseButtons(); });
document.querySelectorAll('.close').forEach(b=> b.addEventListener('click',(e)=>{
  const id = e.currentTarget.dataset.close;
  document.getElementById(id).hidden=true;
  if(running){ paused=false; loop(); togglePauseButtons(); }
}));
lbBtn.addEventListener('click', ()=>{ refreshLB(); pnlLB.hidden=false; paused=true; togglePauseButtons(); });

startBtn.addEventListener('click', start);
pauseBtn.addEventListener('click', ()=>{ paused=true; togglePauseButtons(); });
resumeBtn.addEventListener('click', ()=>{ paused=false; loop(); togglePauseButtons(); });
canvas.addEventListener('pointerdown', ()=> player?.flap());
window.addEventListener('keydown', e => { if(e.code==='Space'||e.code==='ArrowUp'){ e.preventDefault(); player?.flap(); } });

function togglePauseButtons(){
  pauseBtn.hidden = !running || paused;
  resumeBtn.hidden = !running || !paused;
}

async function init(){
  await images.load();
  background = new Background(config);
  floor = new Floor(config);
  pipes = new Pipes(config);
  player = new Player(config);
  score = new Score(config);
  welcomeMsg = new WelcomeMessage(config);
  gameOverMsg = new GameOver(config);
  drawStatic();
}
function drawStatic(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  background.tick();
  floor.tick();
  welcomeMsg.tick();
}
function start(){
  running = true; paused=false; togglePauseButtons();
  images.randomize(); // vary background/player/pipe
  background = new Background(config);
  floor = new Floor(config);
  pipes = new Pipes(config);
  player = new Player(config);
  player.set_mode(PlayerMode.NORMAL);
  score.reset();
  loop();
}

function loop(){
  if(paused || !running){ cancelAnimationFrame(animationId); return; }
  animationId = requestAnimationFrame(loop);

  // update
  ctx.clearRect(0,0,canvas.width,canvas.height);
  background.tick();
  pipes.tick();
  floor.tick();
  player.tick();
  score.tick();

  // collisions and scoring
  const groundY = floor.y;
  if (player.y + player.h >= groundY){
    return gameOver();
  }
  for (let i=0;i<pipes.upper.length;i++){
    const up = pipes.upper[i], low = pipes.lower[i];
    const gapY = up.y + up.h;
    // check pass score
    if (!up.scored && player.x > up.x + up.w){
      up.scored = true; score.add();
    }
    // rect collisions
    const r = player.rect;
    const upRect = {x:up.x, y:up.y, w:up.w, h:up.h};
    const lowRect = {x:low.x, y:low.y, w:low.w, h:low.h};
    if (collides(r, upRect) || collides(r, lowRect)){
      return gameOver();
    }
  }
}

function collides(a,b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function gameOver(){
  running=false; paused=false; togglePauseButtons();
  try{ sounds.hit.play(); }catch(e){}
  saveLB();
  refreshLB();
  pnlLB.hidden=false;
}

const LB_KEY = 'stoney_lb_v1';
function saveLB(){
  const rows = JSON.parse(localStorage.getItem(LB_KEY)||'[]');
  const name = (playerName.value||'Player').slice(0,20);
  const best = Math.max(score.score, rows.find(r=>r.name===name)?.best||0);
  const updated = rows.filter(r=>r.name!==name);
  updated.push({name, best});
  updated.sort((a,b)=>b.best-a.best);
  localStorage.setItem(LB_KEY, JSON.stringify(updated.slice(0,100)));
}
function refreshLB(){
  const rows = JSON.parse(localStorage.getItem(LB_KEY)||'[]');
  lbList.innerHTML = rows.length ? rows.map((r,i)=>`<li><span class="rank">${i+1}</span><span class="name">${escapeHtml(r.name)}</span><span class="score">${r.best}</span></li>`).join('') : '<li><span class="rank">—</span><span class="name">No scores yet</span><span class="score">0</span></li>';
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

init();
