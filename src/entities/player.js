import { Entity } from './entity.js';
import { clamp } from '../utils/misc.js';

// ------- Physics tuning (steady + classic feel) -------
const FLAP_IMPULSE = -6.2; // lift
const GRAVITY      = 0.36; // downward accel per tick (@60Hz)
const MAX_DROP     = 9.5;  // terminal fall speed

// ------- Visuals & tilt -------
const TARGET_HEIGHT   = 52;  // on-screen bird height (world pixels)
const HITBOX_PAD      = 4;   // shrink a bit for fairness

// target tilt range (degrees). We will lerp to a target angle each frame.
const TILT_UP_DEG     = -25; // when rising fast
const TILT_DOWN_DEG   = 75;  // when falling fast

// rotation smoothing: 0..1 (higher = snappier). We make it dt-aware below.
const ROT_SMOOTH_BASE = 0.22;

// idle bob (start screen only)
const IDLE_BOB_PIXELS = 4;
const IDLE_BOB_HZ     = 1.0;

export const PlayerMode = { SHM:'SHM', NORMAL:'NORMAL', CRASH:'CRASH' };

export class Player extends Entity {
  constructor(config){
    super(config, config.images.player?.[0] || null, 0, 0);

    this.images = config.images.player || [];
    this.frame  = 0;

    // physics state
    this.vel_y = 0;

    // rotation state (degrees)
    this.rot   = 0;

    // timers
    this._idleT = 0;

    // cached draw size
    this._applySize();

    // start idle mode
    this.mode = PlayerMode.SHM;
    this._placeIdle();
  }

  // ---- sizing from sprite aspect (no runtime “scaling knobs” elsewhere) ----
  _applySize(){
    const iw = this.images[0]?.naturalWidth  || this.images[0]?.width  || 34;
    const ih = this.images[0]?.naturalHeight || this.images[0]?.height || 24;
    const ratio = iw / Math.max(1, ih);
    this.h = TARGET_HEIGHT;
    this.w = Math.round(TARGET_HEIGHT * ratio);
  }

  // public rects for collisions
  get rect(){ return { x:this.x, y:this.y, w:this.w, h:this.h }; }
  get hitbox(){
    return {
      x: this.x + HITBOX_PAD,
      y: this.y + HITBOX_PAD,
      w: Math.max(2, this.w - HITBOX_PAD*2),
      h: Math.max(2, this.h - HITBOX_PAD*2)
    };
  }

  // ---- mode transitions ----
  _placeIdle(){
    this._applySize();
    this.x = this.config.window.w * 0.22;
    this.y = this.config.window.h * 0.47;
    this.vel_y = 0;
    this.rot   = 0;
    this._idleT = 0;
  }

  _placeStart(){
    this._applySize();
    this.x = this.config.window.w * 0.22;
    this.y = this.config.window.h * 0.45;
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

  // ---- safe lerp that is dt-aware and NaN-proof ----
  _lerpAngle(current, target, dt){
    if (!Number.isFinite(current)) current = 0;
    if (!Number.isFinite(target))  target  = 0;
    const k = 1 - Math.pow(1 - ROT_SMOOTH_BASE, Math.max(0.0001, dt));
    return current + (target - current) * clamp(k, 0, 1);
  }

  update(dt=1){
    // if sprite finishes loading later, adopt its aspect once
    if (this.images[0] && (this.w <= 2 || this.h <= 2)) this._applySize();

    if (this.mode === PlayerMode.SHM){
      // idle vertical bob only (no tilt in idle)
      this._idleT += dt;
      const bob = Math.sin(this._idleT * IDLE_BOB_HZ * 2 * Math.PI) * IDLE_BOB_PIXELS;
      this.y = this.config.window.h * 0.47 + bob;
      this.rot = this._lerpAngle(this.rot, 0, dt);
      return;
    }

    if (this.mode === PlayerMode.NORMAL){
      // physics integration
      this.vel_y = clamp(this.vel_y + GRAVITY * dt, -12, MAX_DROP);
      this.y += this.vel_y * dt * 1.12; // descent scale for nicer arc

      // target angle from velocity (map -6..MAX_DROP -> up..down)
      const v = clamp(this.vel_y, -6, MAX_DROP);
      const t = (v + 6) / (MAX_DROP + 6); // 0..1
      const targetDeg = TILT_UP_DEG + t * (TILT_DOWN_DEG - TILT_UP_DEG);

      // smooth toward target angle
      this.rot = this._lerpAngle(this.rot, targetDeg, dt);

      // keep inside top/bottom; ground collision handled by game
      const maxY = this.config.window.h - this.h;
      if (this.y < 0)    this.y = 0;
      if (this.y > maxY) this.y = maxY;
    }
  }

  tick(dt=1){
    // wing animation
    this.frame++;
    const idx = this.images.length ? Math.floor((this.frame/6) % this.images.length) : 0;
    this.image = this.images[idx] || this.image;

    // draw
    const ctx = this.config.ctx;
    ctx.save();
    const cx = this.x + this.w/2;
    const cy = this.y + this.h/2;
    ctx.translate(cx, cy);
    ctx.rotate((this.rot * Math.PI) / 180);

    if (this.image && this.image.width){
      ctx.drawImage(this.image, -this.w/2, -this.h/2, this.w, this.h);
    } else {
      // safe placeholder (never blocks)
      ctx.fillStyle = '#f33';
      ctx.beginPath();
      ctx.arc(0, 0, this.h/2, 0, Math.PI*2);
      ctx.fill();
    }

    ctx.restore();
  }
}
