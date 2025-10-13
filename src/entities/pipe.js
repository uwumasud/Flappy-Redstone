import { Entity } from './entity.js';

// ultra easy pace
const PIPE_SPEED   = -1.8;                // world scroll
const GAP_MIN      = 180, GAP_MAX = 220;  // gap varies a bit each spawn
const SPAWN_MIN    = 90,  SPAWN_MAX = 130;// frames between spawns (1.5–2.1s @60fps)
const MIN_DIST_W   = 2.6;                 // min distance in multiples of pipe width

export class Pipe extends Entity {
  constructor(config, image, x, y, w, h){
    super(config, image, x, y, w, h);
    this.vel_x = PIPE_SPEED;
  }
  draw(){ this.x += this.vel_x * (this.config.dt||1); super.draw(); }
}

export class Pipes {
  constructor(config){
    this.config = config;
    this.upper = [];
    this.lower = [];
    this.frame = 0;
    this.nextSpawnIn = this.randSpawn();
    this.prevTopY = null;
  }

  randGap(){ return Math.floor(Math.random()*(GAP_MAX - GAP_MIN) + GAP_MIN); }
  randSpawn(){ return Math.floor(Math.random()*(SPAWN_MAX - SPAWN_MIN) + SPAWN_MIN); }

  smoothY(rawY){
    if (this.prevTopY == null) { this.prevTopY = rawY; return rawY; }
    const ALPHA = 0.65; // ease into new height (less jumpy)
    const y = Math.floor(ALPHA * this.prevTopY + (1-ALPHA) * rawY);
    this.prevTopY = y;
    return y;
  }

  randTopY(){
    const img = this.config.images.pipe[0];
    const ph  = (img && img.height) || 320;
    const minY = -ph + 40;
    const maxY = -60;
    return Math.floor(Math.random()*(maxY - minY) + minY);
  }

  canSpawn(){
    const last = this.upper[this.upper.length-1];
    if (!last) return true;
    // ensure a minimum horizontal distance between last and new pipe
    return (this.config.window.w - (last.x + last.w)) > (last.w * MIN_DIST_W);
  }

  spawn(){
    const x = this.config.window.w + 10;
    const upImg  = this.config.images.pipe[0];
    const lowImg = this.config.images.pipe[1];

    const pipeW = (upImg?.width)  || 52;
    const pipeH = (upImg?.height) || 320;

    const rawY = this.randTopY();
    const y    = this.smoothY(rawY);
    const gapY = this.randGap();

    const up  = new Pipe(this.config, upImg,  x, y,                pipeW, pipeH);
    const low = new Pipe(this.config, lowImg, x, y + pipeH + gapY, pipeW, pipeH);

    this.upper.push(up);
    this.lower.push(low);
  }

  update(dt=1){
    this.frame += 1;
    if (this.frame >= this.nextSpawnIn && this.canSpawn()){
      this.spawn();
      this.frame = 0;
      this.nextSpawnIn = this.randSpawn();
    }
    // move & cleanup
    const all = [...this.upper, ...this.lower];
    for (const p of all){ p.x += p.vel_x * dt; }
    this.upper = this.upper.filter(p => p.x + p.w > -5);
    this.lower = this.lower.filter(p => p.x + p.w > -5);
  }

  tick(){ // draw only
    const all = [...this.upper, ...this.lower];
    for (const p of all){ p.draw(); }
  }

  stop(){ [...this.upper, ...this.lower].forEach(p => p.vel_x = 0); }
}
