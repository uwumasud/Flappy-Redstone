import { Entity } from './entity.js';
import { clamp } from '../utils/misc.js';

export const PlayerMode = { SHM: 'SHM', NORMAL: 'NORMAL', CRASH: 'CRASH' };

export class Player extends Entity {
  constructor(config) {
    super(config, config.images.player?.[0] || null, 0, 0);
    this.images = config.images.player || [];
    this.mode = PlayerMode.SHM;
    this.frame = 0;
    this.crashed = false;
    this.reset_vals_shm();
  }

  // Safe size helpers (images can be 0×0 until they finish loading)
  _safeW() { return (this.images[0] && this.images[0].width) || 34; }
  _safeH() { return (this.images[0] && this.images[0].height) || 24; }

  reset_vals_shm() {
    this.w = this._safeW();
    this.h = this._safeH();
    this.x = this.config.window.w * 0.2;
    this.y = this.config.window.h * 0.45;
    this.shm_dir = 1;
    this.vel_y = 0;
  }

  reset_vals_normal() {
    this.w = this._safeW();
    this.h = this._safeH();
    this.x = this.config.window.w * 0.2;
    this.y = this.config.window.h * 0.45;
    this.vel_y = -9;        // flap impulse
    this.rot = 0;
    this.acc_y = 1.0;       // gravity per tick
    this.flapped = false;
  }

  set_mode(mode) {
    this.mode = mode;
    if (mode === PlayerMode.NORMAL) {
      this.reset_vals_normal();
      this.config.sounds.wing?.play?.().catch(() => {});
    } else if (mode === PlayerMode.SHM) {
      this.reset_vals_shm();
    } else if (mode === PlayerMode.CRASH) {
      this.vel_y = 0;
      this.config.sounds.hit?.play?.().catch(() => {});
    }
  }

  flap() {
    if (this.mode !== PlayerMode.NORMAL) return;
    this.vel_y = -9;
    this.flapped = true;
    this.config.sounds.wing?.play?.().catch(() => {});
  }

  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  collidesWith(rect) {
    const r1 = this.rect, r2 = rect;
    return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
  }

  tick() {
    this.frame++;
    // If images finished loading later, refresh our size once
    if (this.images[0] && (this.w === 34 || this.h === 24)) {
      if (this.images[0].width && this.images[0].height) {
        this.w = this.images[0].width;
        this.h = this.images[0].height;
      }
    }

    if (this.mode === PlayerMode.SHM) {
      // idle bobbing
      this.y += this.shm_dir * 0.4;
      if (this.y < this.config.window.h * 0.42) this.shm_dir = 1;
      if (this.y > this.config.window.h * 0.48) this.shm_dir = -1;
    } else if (this.mode === PlayerMode.NORMAL) {
      this.vel_y += this.acc_y;
      this.y += this.vel_y;
    }

    // animate wings
    const idx = Math.floor((this.frame / 5) % this.images.length);
    this.image = this.images[idx] || this.image;

    // Fallback draw if sprite not yet ready
    if (!this.image || !this.image.width) {
      const ctx = this.config.ctx;
      ctx.save();
      ctx.fillStyle = '#f5d90a';
      ctx.beginPath();
      ctx.arc(this.x + this.w / 2, this.y + this.h / 2, Math.max(10, this.h / 2), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    super.tick();
  }
}
