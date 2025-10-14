// src/entities/pipe.js — fixed: movement only in update(), draw is side-effect free

import { Entity } from './entity.js';

// ultra easy pace (same feel you had)
const PIPE_SPEED   = -1.8;                // world scroll speed
const GAP_MIN      = 180, GAP_MAX = 220;  // vertical gap range
const SPAWN_MIN    = 90,  SPAWN_MAX = 130;// frames between spawns (1.5–2.1s @60fps)
const MIN_DIST_W   = 2.6;                 // min spacing in multiples of pipe width

export class Pipe extends Entity {
  constructor(config, image, x, y, w, h){
    super(config, image, x, y, w, h);
    this.vel_x = PIPE_SPEED;
  }
  // IMPORTANT: draw must NOT mutate state
  draw(){
    const ctx = this.config.ctx;
    if (this.image) ctx.drawImage(this.image, this.x, this.y, this.w, this.h);
  }
}

export class Pipes {
  constructor(config){
    this.config = config;
    this.upper = [];
    this.lower = [];
    this.frame = 0;
    this.nextSpawnIn = this._randSpawn();
    this.prevTopY = null;
  }

  _randGap(){   return Math.floor(Math.random()*(GAP_MAX - GAP_MIN) + GAP_MIN); }
  _randSpawn(){ return Math.floor(Math.random()*(SPAWN_MAX - SPAWN_MIN) + SPAWN_MIN); }

  _smoothY(rawY){
    if (this.prevTopY == null) { this.prevTopY = rawY; return rawY; }
    const ALPHA = 0.65; // ease between heights to avoid sudden jumps
    const y = Math.floor(ALPHA * this.prevTopY + (1-ALPHA) * rawY);
    this.prevTopY = y;
    return y;
  }

  _randTopY(){
    const img = this.config.images.pipe[0];
    const ph  = (img && img.height) || 320;
    const minY = -ph + 40;
    const maxY = -60;
    return Math.floor(Math.random()*(maxY - minY) + minY);
  }

  _canSpawn(){
    const last = this.upper[this.upper.length-1];
    if (!last) return true;
    // ensure a minimum horizontal distance from previous pipe
    return (this.config.window.w - (last.x + last.w)) > (last.w * MIN_DIST_W);
  }

  _spawn(){
    const x = this.config.window.w + 10;
    const upImg  = this.config.images.pipe[0];
    const lowImg = this.config.images.pipe[1];

    const pipeW = (upImg?.width)  || 52;
    const pipeH = (upImg?.height) || 320;

    const rawY = this._randTopY();
    const y    = this._smoothY(rawY);
    const gapY = this._randGap();

    const up  = new Pipe(this.config, upImg,  x, y,                pipeW, pipeH);
    const low = new Pipe(this.config, lowImg, x, y + pipeH + gapY, pipeW, pipeH);

    this.upper.push(up);
    this.lower.push(low);
  }

  update(dt=1){
    // spawn logic
    this.frame += 1;
    if (this.frame >= this.nextSpawnIn && this._canSpawn()){
      this._spawn();
      this.frame = 0;
      this.nextSpawnIn = this._randSpawn();
    }

    // movement (ONLY here)
    for (const p of this.upper) p.x += p.vel_x * dt;
    for (const p of this.lower) p.x += p.vel_x * dt;

    // cleanup off-screen
    this.upper = this.upper.filter(p => p.x + p.w > -5);
    this.lower = this.lower.filter(p => p.x + p.w > -5);
  }

  tick(){ // draw only — no movement here
    for (const p of this.upper) p.draw();
    for (const p of this.lower) p.draw();
  }

  stop(){
    for (const p of this.upper) p.vel_x = 0;
    for (const p of this.lower) p.vel_x = 0;
  }
}
