import { Entity } from './entity.js';
export class WelcomeMessage extends Entity {
  constructor(config){
    const image = config.images.welcome_message;
    const x = (config.window.width - (image?.width||184))>>1;
    const y = Math.floor(config.window.height*0.12);
    super(config, image, x, y);
    this.w = image?.width||184; this.h = image?.height||50;
  }
}
