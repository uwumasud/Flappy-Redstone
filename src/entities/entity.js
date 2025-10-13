export class Entity {
  constructor(config, image=null, x=0, y=0, w=null, h=null){
    this.config = config;
    this.image = image;
    this.x = x; this.y = y;
    this.w = w ?? (image ? image.width : 0);
    this.h = h ?? (image ? image.height : 0);
    this.vel_x = 0; this.vel_y = 0;
    this.visible = true;
  }
  get rect(){ return { x:this.x, y:this.y, w:this.w, h:this.h }; }
  tick(){ this.draw(); }
  draw(){
    if (!this.visible) return;
    const ctx = this.config.ctx;
    if (this.image){
      ctx.drawImage(this.image, this.x, this.y, this.w, this.h);
    }
  }
}
