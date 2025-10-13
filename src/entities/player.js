import { Entity } from './entity.js';
import { clamp } from '../utils/misc.js';

export const PlayerMode = { SHM:'SHM', NORMAL:'NORMAL', CRASH:'CRASH' };

export class Player extends Entity {
  constructor(config){
    super(config, config.images.player[0], 0, 0);
    this.images = config.images.player;
    this.reset_vals_shm();
    this.mode = PlayerMode.SHM;
    this.frame = 0;
    this.crashed = false;
  }

  reset_vals_shm(){
    this.w = this.images[0]?.width ?? 34;
    this.h = this.images[0]?.height ?? 24;
    this.x = this.config.window.w * 0.2;
    this.y = this.config.window.h * 0.45;
    this.shm_dir = 1;
    this.vel_y = 0;
  }

  reset_vals_normal(){
    this.w = this.images[0]?.width ?? 34;
    this.h = this.images[0]?.height ?? 24;
    this.x = this.config.window.w * 0.2;
    this.y = this.config.window.h * 0.45;
    this.vel_y = -9;
    this.rot = 0;
    this.acc_y = 1.0;
    this.flapped = false;
  }

  set_mode(mode){
    this.mode = mode;
    if (mode === PlayerMode.NORMAL){
      this.reset_vals_normal();
      this.config.sounds.wing.play().catch(()=>{});
    } else if (mode === PlayerMode.SHM){
      this.reset_vals_shm();
    } else if (mode === PlayerMode.CRASH){
      this.vel_y = 0;
      this.config.sounds.hit.play().catch(()=>{});
    }
  }

  flap(){
    if (this.mode !== PlayerMode.NORMAL) return;
    this.vel_y = -9;
    this.flapped = true;
    this.config.sounds.wing.play().catch(()=>{});
  }

  get rect(){ return { x:this.x, y:this.y, w:this.w, h:this.h }; }

  collidesWith(rect){
    const r1 = this.rect, r2 = rect;
    return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
  }

  tick(){
    this.frame++;
    if (this.mode === PlayerMode.SHM){
      // simple harmonic bobbing
      this.y += this.shm_dir * 0.4;
      if (this.y < this.config.window.h*0.42) this.shm_dir = 1;
      if (this.y > this.config.window.h*0.48) this.shm_dir = -1;
    } else if (this.mode === PlayerMode.NORMAL){
      this.vel_y += this.acc_y;
      this.y += this.vel_y;
      // floor clamp will be handled by game
    }
    // animate wings
    const idx = Math.floor((this.frame/5) % this.images.length);
    this.image = this.images[idx] || this.image;
    super.tick();
  }
}
