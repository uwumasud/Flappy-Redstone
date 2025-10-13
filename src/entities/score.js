export class Score {
  constructor(config){ this.config = config; this.y = this.config.window.height*0.1; this.score=0; }
  reset(){ this.score = 0; }
  add(){ this.score++; try{ this.config.sounds.point.play(); }catch(e){} }
  get rect(){
    const ctx = this.config.ctx;
    ctx.save();
    const text = String(this.score);
    ctx.font = 'bold 32px system-ui,Arial';
    const w = ctx.measureText(text).width;
    const h = 36;
    const x = (this.config.window.width - w)/2;
    ctx.restore();
    return { x, y:this.y, w, h };
  }
  draw(){
    const ctx = this.config.ctx;
    ctx.save();
    ctx.fillStyle='#fff';
    ctx.font='bold 32px system-ui,Arial';
    ctx.textAlign='center';
    ctx.fillText(String(this.score), this.config.window.width/2, this.y+28);
    ctx.restore();
  }
  tick(){ this.draw(); }
}
