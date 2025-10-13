// src/entities/player.js
import { Entity } from './entity.js';
import { clamp } from '../utils/misc.js';

// ---- Tunables (adjust to taste) ----
const FLAP_IMPULSE = -8;   // upward kick (was -9)
const GRAVITY      = 0.55; // per tick accel (was 1.0, now softer)
const W_FALLBACK   = 34;   // used until sprite image finishes loading
const H_FALLBACK   = 24;
// ------------------------------------

export const PlayerMode = { SHM: 'SHM', NORMAL: 'NORMAL', CRASH: 'CRASH' };

export class Player extends Entity {
  constructor(config) {
    // Use first frame as initial image; may be null until loaded
    super(config, config.images.player?.[0] || null, 0, 0);
    this.images = config.images.player || [];
    this.mode = PlayerMode.SHM;
    this.frame = 0;
    this.crashed = false;

    this.reset_vals_shm();
  }

  // Safe size helpers in case images aren't loaded yet (width/height = 0)
  _safeW() { return (this.images[0] && this.images[0].width)  || W_FALLBACK; }
  _safeH() { return (this.images[0] && this.images[0].height) || H_FALLBACK; }

  reset_vals_shm() {
    this.w = this._safeW();
    this.h = this._safeH();
    this.x = this.config.window.w * 0.2;
    this.y = this.config.window.h * 0.45;
    this.shm_dir = 1;   // idle bobbing direction
    this.vel_y = 0;
  }

  reset_vals_normal() {
    this.w = this._safeW();
    this.h = this._safeH();
    this.x = this.config.window.w * 0.2;
    this.y = this.config.window.h * 0.45;
    this.vel_y = FLAP_IMPULSE; // initial pop
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

  collidesWith(rect) {
    const r1 = this.rect, r2 = rect;
    return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
           r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
  }

  tick() {
    this.frame++;

    // If the sprite finishes loading later, adopt the real size once
    if (this.images[0] && (this.w === W_FALLBACK || this.h === H_FALLBACK)) {
      if (this.images[0].width && this.images[0].height) {
        this.w = this.images[0].width;
        this.h = this.images[0].height;
      }
    }

    // Modes
    if (this.mode === PlayerMode.SHM) {
      // idle bobbing on welcome screen
      this.y += this.shm_dir * 0.4;
      if (this.y < this.config.window.h * 0.42) this.shm_dir = 1;
      if (this.y > this.config.window.h * 0.48) this.shm_dir = -1;
    } else if (this.mode === PlayerMode.NORMAL) {
      this.vel_y += this.acc_y;
      this.y += this.vel_y;
    }

    // Keep bird within top and above ground viewport; floor collision is handled in game loop
    const topBound = 0;
    const bottomBound = this.config.window.vh - this.h; // ground starts at vh
    this.y = clamp(this.y, topBound, bottomBound);

    // Animate wings (cycle through frames every ~5 ticks)
    const idx = this.images.length ? Math.floor((this.frame / 5) % this.images.length) : 0;
    this.image = this.images[idx] || this.image;

    // Fallback draw if sprite not ready yet
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
