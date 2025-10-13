// src/entities/player.js
import { Entity } from './entity.js';
import { clamp } from '../utils/misc.js';

// ---- Slow & easy preset ----
const FLAP_IMPULSE = -6.0;  // gentle upward kick (smaller magnitude = slower climb)
const GRAVITY      = 0.38;  // soft gravity (lower = floatier)
const W_FALLBACK   = 34;    // used until sprite image loads
const H_FALLBACK   = 24;
// ----------------------------

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

  _safeW() { return (this.images[0] && this.images[0].width)  || W_FALLBACK; }
  _safeH() { return (this.images[0] && this.images[0].height) || H_FALLBACK; }

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
    this.vel_y = FLAP_IMPULSE;
    this.rot = 0;
    this.acc_y = GRAVITY;
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
    this.vel_y = FLAP_IMPULSE;
    this.flapped = true;
    this.config.sounds.wing?.play?.().catch(() => {});
  }

  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  collidesWith(r2) {
    const r1 = this.rect;
    return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
           r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
  }

  tick() {
    this.frame++;

    // Adopt real sprite size once it loads
    if (this.images[0] && (this.w === W_FALLBACK || this.h === H_FALLBACK)) {
      if (this.images[0].width && this.images[0].height) {
        this.w = this.images[0].width;
        this.h = this.images[0].height;
      }
    }

    if (this.mode === PlayerMode.SHM) {
      this.y += this.shm_dir * 0.35;
      if (this.y < this.config.window.h * 0.43) this.shm_dir = 1;
      if (this.y > this.config.window.h * 0.49) this.shm_dir = -1;
    } else if (this.mode === PlayerMode.NORMAL) {
      this.vel_y += this.acc_y;
      this.y += this.vel_y;
    }

    // Keep inside the play area (ground handled in game loop)
    const topBound = 0;
    const bottomBound = this.config.window.vh - this.h;
    this.y = clamp(this.y, topBound, bottomBound);

    // Wing animation
    const idx = this.images.length ? Math.floor((this.frame / 6) % this.images.length) : 0;
    this.image = this.images[idx] || this.image;

    // Fallback bird if image not ready
    if (!this.image || !this.image.width) {
      const ctx = this.config.ctx;
      ctx.save();
      ctx.fillStyle = '#f5d90a';
      ctx.beginPath();
      ctx.arc(this.x + this.w/2, this.y + this.h/2, Math.max(10, this.h/2), 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    super.tick();
  }
}
