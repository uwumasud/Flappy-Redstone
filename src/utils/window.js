export class Window {
  constructor(width, height){
    this.width = width; this.height = height;
    this.ratio = width/height;
    this.w = width; this.h = height; this.r = this.ratio;
    this.viewport_width = width; this.viewport_height = height*0.79;
    this.vw = this.viewport_width; this.vh = this.viewport_height;
    this.viewport_ratio = this.vw/this.vh; this.vr = this.viewport_ratio;
  }
}
