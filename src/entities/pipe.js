import { Entity } from './entity.js';
export class Pipe extends Entity {
  constructor(config, image, x, y, w, h){
    super(config, image, x, y, w, h);
    this.vel_x = -5;
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
    this.gapY = 120; // adjustable
    this.spawnInterval = 90; // frames
    this.frame = 0;
  }
  randY(){
    const minY = -this.config.images.pipe[0].height + 40;
    const maxY = -40;
    return Math.floor(Math.random()*(maxY-minY)+minY);
  }
  spawn(){
    const x = this.config.window.w + 10;
    const y = this.randY();
    const pipeW = this.config.images.pipe[0]?.width ?? 52;
    const pipeH = this.config.images.pipe[0]?.height ?? 320;
    const upImg = this.config.images.pipe[0];
    const lowImg = this.config.images.pipe[1];
    const upPipe = new Pipe(this.config, upImg, x, y, pipeW, pipeH);
    const lowPipe = new Pipe(this.config, lowImg, x, y + pipeH + this.gapY, pipeW, pipeH);
    this.upper.push(upPipe); this.lower.push(lowPipe);
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
  canSpawn(){
    const last = this.upper[this.upper.length-1];
    if (!last) return true;
    return this.config.window.w - (last.x + last.w) > last.w * 2.5;
  }
  stop(){
    [...this.upper, ...this.lower].forEach(p => p.vel_x = 0);
  }
}
