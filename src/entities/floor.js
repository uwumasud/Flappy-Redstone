import { Entity } from './entity.js';

export class Floor extends Entity {
  constructor(config){
    super(config, config.images.base, 0, 0);

    this.vel_x = 2.4;

    // before image loads, use sane defaults
    this._imgW = this.image?.width  || config.window.w;
    this.h     = this.image?.height || 112;
    this.y     = config.window.h - this.h;

    this._tileW = this._imgW || config.window.w;
    this.x = 0;

    // share ground to everyone (player clamp, collisions, etc.)
    this.config.groundY = this.y;
  }

  _syncDimsIfReady(){
    if (this.image && this.image.width && this.image.height){
      if (this.h !== this.image.height){
        this.h = this.image.height;
        this.y = this.config.window.h - this.h;
      }
      this._imgW  = this.image.width;
      this._tileW = this._imgW;
    }
  }

  update(dt=1){
    this._syncDimsIfReady();
    // keep groundY up-to-date every frame
    this.config.groundY = this.y;

    this.x = (this.x - this.vel_x * dt) % this._tileW;
  }

  tick(dt=1){
    this.update(dt);
    const ctx = this.config.ctx;

    if (this.image && this.image.width){
      let drawX = this.x;
      while (drawX > 0) drawX -= this._tileW;
      for (; drawX < this.config.window.w; drawX += this._tileW){
        ctx.drawImage(this.image, drawX, this.y);
      }
    } else {
      // fallback ground so there’s never a blank
      ctx.fillStyle = '#E9DF9A';
      ctx.fillRect(0, this.y, this.config.window.w, this.h);
      ctx.fillStyle = '#D36A67';
      ctx.fillRect(0, this.y - 6, this.config.window.w, 6);
    }
  }
}
