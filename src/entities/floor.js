import { Entity } from './entity.js';
export class Floor extends Entity {
  constructor(config){
    super(config, config.images.base, 0, config.window.vh);
    this.vel_x = 4;
    this.x_extra = this.w - config.window.w;
  }
  stop(){ this.vel_x = 0; }
  draw(){
    const ctx = this.config.ctx;
    this.x = -((-this.x + this.vel_x) % this.x_extra);
    if (this.image){
      ctx.drawImage(this.image, this.x, this.y);
      ctx.drawImage(this.image, this.x + this.w, this.y);
    } else {
      ctx.fillStyle = '#283246'; ctx.fillRect(0, this.y, this.config.window.w, this.config.window.h - this.y);
    }
  }
}
