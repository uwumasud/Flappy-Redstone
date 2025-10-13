export class Sounds {
  constructor() {
    // Use ogg on linux/ios telegram sometimes restricted; keep both if you have.
    const ext = 'ogg';
    this.die   = new Audio(`assets/audio/die.${ext}`);
    this.hit   = new Audio(`assets/audio/hit.${ext}`);
    this.point = new Audio(`assets/audio/point.${ext}`);
    this.swoosh= new Audio(`assets/audio/swoosh.${ext}`);
    this.wing  = new Audio(`assets/audio/wing.${ext}`);
    [this.die,this.hit,this.point,this.swoosh,this.wing].forEach(a=>{a.preload='auto'; a.volume=0.7;});
  }
}
