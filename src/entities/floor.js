// src/entities/floor.js
import { Entity } from './entity.js';

// Make the ground scroll nice and slow to match your easy pacing.
// Tip: keep this close to the absolute value of PIPE_SPEED in pipe.js.
const FLOOR_SCROLL_SPEED = 1.9; // was 4.0 (slower = easier)

export class Floor extends Entity {
  constructor(config) {
    // y sits at the start of the ground (viewport height); fills remaining canvas height.
    super(config, config.images.base || null, 0, config.window.vh);

    // horizontal scroll speed
    this.vel_x = FLOOR_SCROLL_SPEED;

    // Provide safe initial sizes even if base.png hasn't finished loading (width/height=0 at first)
    this.w = (this.image && this.image.width)  || (config.window.w + 48);
    this.h = (this.image && this.image.height) || (config.window.h - this.y);

    // Avoid modulo by 0/negative if image width == canvas width or not ready yet
    this.x_extra = Math.max(1, this.w - this.config.window.w);
  }

  stop() { this.vel_x = 0; }

  draw() {
    // If the image finishes loading later, adopt its real size once
    if (this.image && (this.w !== this.image.width || this.h !== this.image.height)) {
      this.w = this.image.width  || this.w;
      this.h = this.image.height || this.h;
      this.x_extra = Math.max(1, this.w - this.config.window.w);
    }

    // Seamless horizontal scroll
    this.x = -((-this.x + this.vel_x) % this.x_extra);

    const ctx = this.config.ctx;
    if (this.image && this.image.width) {
      // Tile the base twice to cover the canvas as it scrolls
      ctx.drawImage(this.image, this.x, this.y);
      ctx.drawImage(this.image, this.x + this.w, this.y);
    } else {
      // Fallback ground while image is still loading
      ctx.fillStyle = '#283246';
      ctx.fillRect(0, this.y, this.config.window.w, this.config.window.h - this.y);
    }
  }
}
