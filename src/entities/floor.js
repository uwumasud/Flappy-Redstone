// src/entities/floor.js
import { Entity } from './entity.js';

// Keep close to |PIPE_SPEED| (see pipe.js)
const FLOOR_SCROLL_SPEED = 1.3; // very slow for easy mode

export class Floor extends Entity {
  constructor(config) {
    super(config, config.images.base || null, 0, config.window.vh);

    this.vel_x = FLOOR_SCROLL_SPEED;

    // Safe sizes before image loads
    this.w = (this.image && this.image.width)  || (config.window.w + 48);
    this.h = (this.image && this.image.height) || (config.window.h - this.y);

    this.x_extra = Math.max(1, this.w - this.config.window.w);
  }

  stop() { this.vel_x = 0; }

  draw() {
    if (this.image && (this.w !== this.image.width || this.h !== this.image.height)) {
      this.w = this.image.width  || this.w;
      this.h = this.image.height || this.h;
      this.x_extra = Math.max(1, this.w - this.config.window.w);
    }

    // Seamless scroll
    this.x = -((-this.x + this.vel_x) % this.x_extra);

    const ctx = this.config.ctx;
    if (this.image && this.image.width) {
      ctx.drawImage(this.image, this.x, this.y);
      ctx.drawImage(this.image, this.x + this.w, this.y);
    } else {
      ctx.fillStyle = '#283246';
      ctx.fillRect(0, this.y, this.config.window.w, this.config.window.h - this.y);
    }
  }
}
