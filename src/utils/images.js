import { BACKGROUNDS, PIPES, PLAYERS } from './constants.js';

function load(src){return new Promise((res)=>{const i=new Image(); i.onload=()=>res(i); i.onerror=()=>res(null); i.src=src;});}

export class Images {
  constructor(){ this.numbers=[]; }
  async load(){
    // digits 0..9
    for (let d=0; d<=9; d++){
      this.numbers[d] = await load(`assets/sprites/${d}.png`);
    }
    this.game_over = await load('assets/sprites/gameover.png');
    this.welcome_message = await load('assets/sprites/message.png');
    this.base = await load('assets/sprites/base.png');
    this.randomize();
  }
  async randomize(){
    const bgi = Math.floor(Math.random()*BACKGROUNDS.length);
    const pli = Math.floor(Math.random()*PLAYERS.length);
    const ppi = Math.floor(Math.random()*PIPES.length);
    this.background = await load(BACKGROUNDS[bgi]);
    const [u,m,d] = PLAYERS[pli];
    this.player = [await load(u), await load(m), await load(d)];
    const pipe = await load(PIPES[ppi]);
    // top pipe is flipped vertically using canvas save/scale in draw
    this.pipe = [pipe, pipe];
  }
}
