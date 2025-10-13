import { Entity } from './entity.js';

// ---- Tunables (try these first) ----
const PIPE_SPEED   = -2.6; // was -5  (less negative = slower)
const PIPE_GAP_Y   = 160;  // was 120  (bigger gap = easier)
const SPAWN_EVERY  = 120;  // was 90   (more frames between spawns ~ 2s at 60fps)
// ------------------------------------

export class Pipe extends Entity {
  constructor(config, image, x, y, w, h){
    super(config, image, x, y, w, h);
    this.vel_x = PIPE_SPEED;
  }
  draw(){
    this.x += this.vel_x;
    super.draw();
  }
}

export class Pipes {
  constructor(config){
    this.config = config;
    this.upper = [];
    this.lower = [];
    this.gapY = PIPE_GAP_Y;
    this.spawnInterval = SPAWN_EVERY;
    this.frame = 0;
  }
  randY(){
    const img = this.config.images.pipe[0];
    const ph = (img && img.height) || 320;
    const minY = -ph + 40;
    const maxY = -40;
    return Math.floor(Math.random()*(maxY-minY)+minY);
  }
  spawn(){
    const x = this.config.window.w + 10;
    const img = this.config.images.pipe[0];
    const pipeW = (img && img.width)  || 52;
    const pipeH = (img && img.height) || 320;

    const upImg = this.config.images.pipe[0];
    const lowImg = this.config.images.pipe[1];

    const y = this.randY();
    const upPipe = new Pipe(this.config, upImg, x, y, pipeW, pipeH);
    const lowPipe = new Pipe(this.config, lowImg, x, y + pipeH + this.gapY, pipeW, pipeH);

    this.upper.push(upPipe);
    this.lower.push(lowPipe);
  }
  canSpawn(){
    const last = this.upper[this.upper.length-1];
    if (!last) return true;
    // wait until last pipe is well left before spawning next
    return this.config.window.w - (last.x + last.w) > last.w * 3.0;
  }
  tick(){
    this.frame++;
    if (this.frame % this.spawnInterval === 0 || (!this.upper.length)){
      if (this.canSpawn()) this.spawn();
    }
    const all = [...this.upper, ...this.lower];
    for (let p of all){ p.tick(); }
    // cleanup offscreen
    this.upper = this.upper.filter(p => p.x + p.w > -5);
    this.lower = this.lower.filter(p => p.x + p.w > -5);
  }
  stop(){
    [...this.upper, ...this.lower].forEach(p => p.vel_x = 0);
  }
}
