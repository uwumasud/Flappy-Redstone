import { Entity } from './entity.js';
import { clamp } from '../utils/misc.js';

// very floaty
const FLAP_IMPULSE = -6.0;
const GRAVITY      = 0.38;
const W_FALLBACK   = 34;
const H_FALLBACK   = 24;
const HITBOX_PAD   = 4;   // shrink collision box to feel fair

export const PlayerMode = { SHM:'SHM', NORMAL:'NORMAL', CRASH:'CRASH' };

export class Player extends Entity {
  constructor(config){
    super(config, config.images.player?.[0] || null, 0, 0);
    this.images = config.images.player || [];
    this.mode = PlayerMode.SHM;
    this.frame = 0;
    this.reset_vals_shm();
  }

  _safeW(){ return (this.images[0]?.width)  || W_FALLBACK; }
  _safeH(){ return (this.images[0]?.height) || H_FALLBACK; }

  reset_vals_shm(){
    this.w = this._safeW(); this.h = this._safeH();
    this.x = this.config.window.w * 0.2;
    this.y = this.config.window.h * 0.45;
    this.shm_dir = 1; this.vel_y = 0;
  }

  reset_vals_normal(){
    this.w = this._safeW(); this.h = this._safeH();
    this.x = this.config.window.w * 0.2;
    this.y = this.config.window.h * 0.45;
    this.vel_y = FLAP_IMPULSE;
    this.rot = 0; this.acc_y = GRAVITY; this.flapped = false;
  }

  set_mode(m){
    this.mode = m;
    if (m === PlayerMode.NORMAL){ this.reset_vals_normal(); this.config.sounds.wing?.play?.().catch(()=>{}); }
    else if (m === PlayerMode.SHM){ this.reset_vals_shm(); }
    else if (m === PlayerMode.CRASH){ this.vel_y = 0; this.config.sounds.hit?.play?.().catch(()=>{}); }
  }

  flap(){ if (this.mode === PlayerMode.NORMAL){ this.vel_y = FLAP_IMPULSE; this.flapped = true; this.config.sounds.wing?.play?.().catch(()=>{}); } }

  get rect(){ return { x:this.x, y:this.y, w:this.w, h:this.h }; }
  get hitbox(){ return { x:this.x + HITBOX_PAD, y:this.y + HITBOX_PAD, w:this.w - HITBOX_PAD*2, h:this.h - HITBOX_PAD*2 }; }

  update(dt=1){
    if (this.mode === PlayerMode.SHM){
      this.y += this.shm_dir * 0.35 * dt;
      if (this.y < this.config.window.h*0.43) this.shm_dir = 1;
      if (this.y > this.config.window.h*0.49) this.shm_dir = -1;
    } else if (this.mode === PlayerMode.NORMAL){
      this.vel_y += this.acc_y * dt;
      this.y     += this.vel_y * dt;
    }
    // clamp inside viewport (ground handled in game loop)
    this.y = clamp(this.y, 0, this.config.window.vh - this.h);
  }

  tick(dt=1){
    this.frame++;
    // adopt real size once sprite is ready
    if (this.images[0] && (this.w === W_FALLBACK || this.h === H_FALLBACK)){
      if (this.images[0].width && this.images[0].height){ this.w = this.images[0].width; this.h = this.images[0].height; }
    }
    const idx = this.images.length ? Math.floor((this.frame/6) % this.images.length) : 0;
    this.image = this.images[idx] || this.image;

    // fallback bird if image not loaded yet
    if (!this.image || !this.image.width){
      const ctx = this.config.ctx;
      ctx.save(); ctx.fillStyle = '#f5d90a';
      ctx.beginPath(); ctx.arc(this.x + this.w/2, this.y + this.h/2, Math.max(10,this.h/2), 0, Math.PI*2); ctx.fill(); ctx.restore();
    }
    super.tick();
  }
}
