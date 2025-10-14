import { Entity } from './entity.js';
import { clamp } from '../utils/misc.js';

// Physics
const FLAP_IMPULSE = -6.0;
const GRAVITY      = 0.38;
const ROT_UP_DEG   = -25;
const ROT_DOWN_DEG = 70;

// Visual size (no global scaling in game.js)
const TARGET_HEIGHT   = 55;   // tweak 50–60 if you want
const HITBOX_PAD      = 4;
const IDLE_BOB_PIXELS = 4;
const IDLE_BOB_HZ     = 1.0;  // cycles/sec

// Fallback before images report real size
const W_FALLBACK = 34, H_FALLBACK = 24;

export const PlayerMode = { SHM:'SHM', NORMAL:'NORMAL', CRASH:'CRASH' };

export class Player extends Entity {
  constructor(config){
    super(config, config.images.player?.[0] || null, 0, 0);
    this.images = config.images.player || [];
    this.frame  = 0;
    this.mode   = PlayerMode.SHM;

    this.vel_y  = 0;
    this.acc_y  = GRAVITY;
    this.rot    = 0;

    this._idleT = 0; // dt-based timer

    this._applySizeFromImage();
    this.reset_vals_shm();
  }

  _applySizeFromImage(){
    const iw = this.images[0]?.naturalWidth  || this.images[0]?.width  || W_FALLBACK;
    const ih = this.images[0]?.naturalHeight || this.images[0]?.height || H_FALLBACK;
    const ratio = iw / ih || (W_FALLBACK / H_FALLBACK);
    this.h = TARGET_HEIGHT;
    this.w = Math.round(TARGET_HEIGHT * ratio);
  }

  get rect(){ return { x:this.x, y:this.y, w:this.w, h:this.h }; }
  get hitbox(){ return { x:this.x+HITBOX_PAD, y:this.y+HITBOX_PAD,
                         w:this.w-2*HITBOX_PAD, h:this.h-2*HITBOX_PAD }; }

  reset_vals_shm(){
    this._applySizeFromImage();
    this.x = this.config.window.w * 0.22;
    this.y = this.config.window.h * 0.47;
    this.vel_y = 0;
    this.rot   = 0;
    this._idleT = 0;
  }

  reset_vals_normal(){
    this._applySizeFromImage();
    this.x = this.config.window.w * 0.22;
    this.y = this.config.window.h * 0.45;
    this.vel_y = FLAP_IMPULSE;
    this.rot   = 0;
  }

  set_mode(m){
    this.mode = m;
    if (m === PlayerMode.NORMAL){
      this.reset_vals_normal();
      this.config.sounds.wing?.play?.().catch(()=>{});
    } else if (m === PlayerMode.SHM){
      this.reset_vals_shm();
    } else if (m === PlayerMode.CRASH){
      this.vel_y = 0;
      this.config.sounds.hit?.play?.().catch(()=>{});
    }
  }

  flap(){
    if (this.mode !== PlayerMode.NORMAL) return;
    this.vel_y = FLAP_IMPULSE;
    this.config.sounds.wing?.play?.().catch(()=>{});
  }

  update(dt=1){
    // adopt real size once image is ready
    if (this.images[0] && (this.w === W_FALLBACK || this.h === H_FALLBACK)) {
      if (this.images[0].width && this.images[0].height) this._applySizeFromImage();
    }

    if (this.mode === PlayerMode.SHM){
      // smooth idle bob (dt-based)
      this._idleT += dt;
      const bob = Math.sin(this._idleT * IDLE_BOB_HZ * 2 * Math.PI) * IDLE_BOB_PIXELS;
      this.y = this.config.window.h * 0.47 + bob;
      this.rot = 0;
      return;
    }

    if (this.mode === PlayerMode.NORMAL){
      this.vel_y += this.acc_y * dt;
      this.y     += this.vel_y * dt;

      // velocity -> tilt
      const t = clamp((this.vel_y + 6) / (8 + 6), 0, 1);
      this.rot = (1 - t) * ROT_UP_DEG + t * ROT_DOWN_DEG;

      // clamp inside screen (ground handled by game loop)
      const maxY = this.config.window.h - this.h; // ✅ use window.h
      if (this.y < 0)    this.y = 0;
      if (this.y > maxY) this.y = maxY;
    }
  }

  tick(dt=1){
    this.frame++;
    const idx = this.images.length ? Math.floor((this.frame/6) % this.images.length) : 0;
    this.image = this.images[idx] || this.image;

    const ctx = this.config.ctx;
    ctx.save();
    const cx = this.x + this.w/2;
    const cy = this.y + this.h/2;
    ctx.translate(cx, cy);
    ctx.rotate((this.rot * Math.PI) / 180);

    if (this.image && this.image.width){
      ctx.drawImage(this.image, -this.w/2, -this.h/2, this.w, this.h);
    } else {
      // safe fallback
      ctx.fillStyle = '#f5d90a';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(10, this.h/2), 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }
}
