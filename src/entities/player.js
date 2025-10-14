import { Entity } from './entity.js';
import { clamp } from '../utils/misc.js';

// Physics
const FLAP_IMPULSE = -6.2;
const GRAVITY      = 0.36;
const MAX_DROP     = 9.5;

// Tilt (degrees)
const TILT_UP_DEG   = -25;
const TILT_DOWN_DEG = 75;
const ROT_SMOOTH    = 0.22;    // 0..1 smoothing factor (dt-aware below)

// Visuals
const TARGET_HEIGHT   = 52;     // on-screen size (world px)
const HITBOX_PAD      = 4;
const IDLE_BOB_PIXELS = 4;
const IDLE_BOB_HZ     = 1.0;

export const PlayerMode = { SHM:'SHM', NORMAL:'NORMAL', CRASH:'CRASH' };

export class Player extends Entity {
  constructor(config){
    super(config, config.images.player?.[0] || null, 0, 0);
    this.images = config.images.player || [];
    this.frame  = 0;
    this.mode   = PlayerMode.SHM;

    this.vel_y  = 0;
    this.rot    = 0;
    this._idleT = 0;

    this._applySize();
    this._placeIdle();
  }

  _applySize(){
    const iw = this.images[0]?.naturalWidth  || this.images[0]?.width  || 34;
    const ih = this.images[0]?.naturalHeight || this.images[0]?.height || 24;
    const ratio = iw / Math.max(1, ih);
    this.h = TARGET_HEIGHT;
    this.w = Math.round(TARGET_HEIGHT * ratio);
  }

  get rect(){ return { x:this.x, y:this.y, w:this.w, h:this.h }; }
  get hitbox(){
    return {
      x: this.x + HITBOX_PAD,
      y: this.y + HITBOX_PAD,
      w: Math.max(2, this.w - 2*HITBOX_PAD),
      h: Math.max(2, this.h - 2*HITBOX_PAD)
    };
  }

  _placeIdle(){
    this._applySize();
    this.x = this.config.window.w * 0.22;
    this.y = (this.config.groundY ?? this.config.window.h) * 0.47; // use ground if known
    this.vel_y = 0;
    this.rot   = 0;
    this._idleT = 0;
  }

  _placeStart(){
    this._applySize();
    this.x = this.config.window.w * 0.22;
    this.y = (this.config.groundY ?? this.config.window.h) * 0.45;
    this.vel_y = FLAP_IMPULSE;
    this.rot   = 0;
  }

  set_mode(m){
    this.mode = m;
    if (m === PlayerMode.NORMAL){
      this._placeStart();
      this.config.sounds.wing?.play?.().catch(()=>{});
    } else if (m === PlayerMode.SHM){
      this._placeIdle();
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

  _lerp(a,b,dt){
    if (!Number.isFinite(a)) a = 0;
    if (!Number.isFinite(b)) b = 0;
    const k = 1 - Math.pow(1 - ROT_SMOOTH, Math.max(0.0001, dt));
    return a + (b - a) * clamp(k, 0, 1);
  }

  update(dt=1){
    // adopt real sprite dimensions if they appear late
    if (this.images[0] && (this.w <= 2 || this.h <= 2)) this._applySize();

    const ground = this.config.groundY ?? (this.config.window.h - 112);

    if (this.mode === PlayerMode.SHM){
      this._idleT += dt;
      const bob = Math.sin(this._idleT * IDLE_BOB_HZ * 2 * Math.PI) * IDLE_BOB_PIXELS;
      this.y = ground * 0.47 + bob;
      this.rot = this._lerp(this.rot, 0, dt);
      return;
    }

    if (this.mode === PlayerMode.NORMAL){
      // physics
      this.vel_y = clamp(this.vel_y + GRAVITY * dt, -12, MAX_DROP);
      this.y    += this.vel_y * dt * 1.12;

      // tilt target from velocity
      const v = clamp(this.vel_y, -6, MAX_DROP);
      const t = (v + 6) / (MAX_DROP + 6);
      const targetDeg = TILT_UP_DEG + t * (TILT_DOWN_DEG - TILT_UP_DEG);
      this.rot = this._lerp(this.rot, targetDeg, dt);

      // clamp against actual floor, not full screen
      const maxY = ground - this.h;
      if (this.y < 0)     this.y = 0;
      if (this.y > maxY)  this.y = maxY;
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
      ctx.fillStyle = '#f33';
      ctx.beginPath();
      ctx.arc(0, 0, this.h/2, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }
}
