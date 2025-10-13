import { Entity } from './entity.js';
export class Background extends Entity {
  constructor(config){ super(config, config.images.background, 0, 0, config.window.width, config.window.height); }
}
