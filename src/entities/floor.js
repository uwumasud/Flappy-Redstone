import { Entity } from './entity.js';

export class Floor extends Entity {
  constructor(config) {
    // y = viewport height (79% of canvas), fill remaining area
    super(config, config.images.base || null, 0, config.window.vh);
    this.vel_x = 4;

    // Safe initial sizes even if image has not loaded yet
    this.w = (this.image && this.image.width) || (config.window.w + 48);
    this.h = (this.image && this.image.height) || (config.window.h - this.y);

    // avoid division/modulo by 0/negative
    this.x_extra = Math.max(1, this.w - config.window.w);
  }

  stop() { this.vel_x = 0; }

  draw() {
    // If the image loads later, reconcile sizes once
    if (this.image && (this.w !== this.image.width || this.h !== this.image.height)) {
      this.w = this.image.width || this.w;
      this.h = this.image.height || this.h;
      this.x_extra = Math.max(1, this.w - this.config.window.w);
    }

    // Scroll the base seamlessly
    this.x = -((-this.x + this.vel_x) % this.x_extra);

    const ctx = this.config.ctx;
    if (this.image && this.image.width) {
      ctx.drawImage(this.image, this.x, this.y);
      ctx.drawImage(this.image, this.x + this.w, this.y);
    } else {
      // Fallback draw if base.png not yet ready
      ctx.fillStyle = '#283246';
      ctx.fillRect(0, this.y, this.config.window.w, this.config.window.h - this.y);
    }
  }
}
