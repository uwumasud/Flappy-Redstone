import { Entity } from './entity.js';
export class GameOver extends Entity {
  constructor(config){
    const image = config.images.game_over;
    const x = (config.window.width - (image?.width||192))>>1;
    const y = Math.floor(config.window.height*0.18);
    super(config, image, x, y);
    this.w = image?.width||192; this.h = image?.height||42;
    this.visible = false;
  }
}
