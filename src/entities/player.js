import { Entity } from './entity.js';
import { clamp } from '../utils/misc.js';

// --- Physics tuning ---
const FLAP_IMPULSE = -6.5;  // slightly stronger lift
const GRAVITY      = 0.35;  // gentle downward pull
const MAX_DROP     = 10;    // terminal velocity
const ROT_UP_DEG   = -25;
const ROT_DOWN_DEG = 80;

// --- Visuals ---
const TARGET_HEIGHT   = 50;  // moderate visible size
const HITBOX_PAD      = 4;
const IDLE_BOB_PIXELS = 4;
const IDLE_BOB_HZ     = 1.0;

export const PlayerMode = { SHM:'SHM', NORMAL:'NORMAL', CRASH:'CRASH' };

export class Player extends Entity {
  constructor(config) {
    super(config, config.images.player?.[0] || null, 0, 0);
    this.images = config.images.player || [];
    this.frame  = 0;
    this.mode   = PlayerMode.SHM;

    this.vel_y = 0;
    this.rot   = 0;
    this._idleT = 0;
    this._applySize();
    this.resetIdle();
  }

  _applySize() {
    const iw = this.images[0]?.naturalWidth || 34;
    const ih = this.images[0]?.naturalHeight || 24;
    const ratio = iw / ih;
    this.h = TARGET_HEIGHT;
    this.w = Math.round(TARGET_HEIGHT * ratio);
  }

  get rect() { return { x:this.x, y:this.y, w:this.w, h:this.h }; }
  get hitbox(){ return { x:this.x+HITBOX_PAD, y:this.y+HITBOX_PAD,
                         w:this.w-2*HITBOX_PAD, h:this.h-2*HITBOX_PAD }; }

  resetIdle() {
    this._applySize();
    this.x = this.config.window.w * 0.22;
    this.y = this.config.window.h * 0.47;
    this.vel_y = 0;
    this.rot = 0;
    this._idleT = 0;
  }

  startPlay() {
    this._applySize();
    this.x = this.config.window.w * 0.22;
    this.y = this.config.window.h * 0.45;
    this.vel_y = FLAP_IMPULSE;
    this.rot   = 0;
  }

  set_mode(m) {
    this.mode = m;
    if (m === PlayerMode.NORMAL) {
      this.startPlay();
      this.config.sounds.wing?.play?.();
    } else if (m === PlayerMode.SHM) {
      this.resetIdle();
    } else if (m === PlayerMode.CRASH) {
      this.vel_y = 0;
      this.config.sounds.hit?.play?.();
    }
  }

  flap() {
    if (this.mode !== PlayerMode.NORMAL) return;
    this.vel_y = FLAP_IMPULSE;
    this.config.sounds.wing?.play?.();
  }

  update(dt = 1) {
    if (this.mode === PlayerMode.SHM) {
      this._idleT += dt;
      const bob = Math.sin(this._idleT * IDLE_BOB_HZ * 2 * Math.PI) * IDLE_BOB_PIXELS;
      this.y = this.config.window.h * 0.47 + bob;
      this.rot = 0;
      return;
    }

    if (this.mode === PlayerMode.NORMAL) {
      // --- Apply physics ---
      this.vel_y = clamp(this.vel_y + GRAVITY * dt, -12, MAX_DROP);
      this.y += this.vel_y * dt * 1.2;  // smooth descent speed

      // --- Tilt ---
      if (this.vel_y < 0) {
        this.rot = ROT_UP_DEG;
      } else {
        const t = clamp(this.vel_y / MAX_DROP, 0, 1);
        this.rot = ROT_UP_DEG + t * (ROT_DOWN_DEG - ROT_UP_DEG);
      }

      // --- Keep inside screen ---
      const maxY = this.config.window.h - this.h;
      if (this.y < 0) this.y = 0;
      if (this.y > maxY) this.y = maxY;
    }
  }

  tick(dt = 1) {
    this.frame++;
    const idx = this.images.length ? Math.floor((this.frame / 6) % this.images.length) : 0;
    this.image = this.images[idx] || this.image;

    const ctx = this.config.ctx;
    ctx.save();
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((this.rot * Math.PI) / 180);

    if (this.image && this.image.width) {
      ctx.drawImage(this.image, -this.w / 2, -this.h / 2, this.w, this.h);
    } else {
      ctx.fillStyle = '#f33';
      ctx.beginPath();
      ctx.arc(0, 0, this.h / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
