// SPDX-License-Identifier: GPL-2.0-or-later
const palettes = {
 modern:['#54d8df','#f9a567','#b4a0ff','#91d97e','#ff8bb8','#f0db75'],
 classic:['#00ff00','#ff0000','#00ffff','#ffff00','#ff00ff','#0000ff'],
 accessible:['#0072b2','#e69f00','#f0e442','#cc79a7','#d55e00','#56b4e9','#009e73']
};
let theme='modern';
export function setTheme(value){theme=palettes[value]?value:'modern';document.body.dataset.theme=theme;}
export function warriorColor(i) {
 return palettes[theme][i % palettes[theme].length];
}
export class CoreDisplay {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', {alpha: false});
    this.columns = Math.ceil(Math.sqrt(8000 * 2.5));
    this.size = 8000;
    this.preferredCellSize = 8;
    this.pcs = [];
    this.cells = new Uint8Array(this.size*4);
    this.observer = new ResizeObserver(() => this.redraw());
    this.observer.observe(canvas.parentElement || canvas);
    this.redraw();
  }
  configure(size) {
    this.size = size;
    this.pcs = [];
    this.columns = Math.ceil(Math.sqrt(size * 2.5));
    this.cells = new Uint8Array(size*4);
    this.redraw();
  }
  setCellSize(size) {
    if (![0,4,6,8,12,16,24].includes(size)) return;
    this.preferredCellSize = size;
    this.redraw();
  }
  redraw() {
    const ratio = window.devicePixelRatio || 1;
    const available = Math.max(1, (this.canvas.parentElement || this.canvas).clientWidth);
    const width = this.preferredCellSize ? this.columns * this.preferredCellSize : available;
    this.canvas.style.width = width + 'px';
    this.cellSize = width / this.columns;
    const height = Math.ceil(this.size / this.columns) * this.cellSize;
    this.canvas.style.height = height + 'px';
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.context.fillStyle = '#101d29';
    this.context.fillRect(0, 0, width, height);
    for (let i = 0; i < this.size; ++i) this.draw(i);
  }
  apply(events) {
    const dirty = new Set();
    for (let i = 0; i < events.length; i += 4) {
      const [kind, address, owner] = events.subarray(i, i + 3);
      if (kind === 0) {
        this.cells.fill(0);
        this.pcs = [];
        dirty.clear();
        this.context.fillStyle = '#101d29';
        this.redraw();
      } else if (kind === 8) {
        if (this.pcs[owner] >= 0) dirty.add(this.pcs[owner]);
        this.pcs[owner] = -1;
      } else if (kind >= 1 && kind <= 6) {
        if (kind === 2) {
          if (this.pcs[owner] >= 0) dirty.add(this.pcs[owner]);
          this.pcs[owner] = address;
        }
        const mask=[0,15,15,1,6,3,5][kind];
        for(let q=0;q<4;q++) if(mask & (1<<q)) this.cells[address*4+q]=owner+1;
        dirty.add(address);
      }
    }
    for (const address of dirty) this.draw(address);
  }
  draw(address) {
    const x=(address%this.columns)*this.cellSize,y=Math.floor(address/this.columns)*this.cellSize;
    const classic=this.preferredCellSize===4 || this.preferredCellSize===6;
    const c=this.context,pad=classic?1:0,half=(this.cellSize-2*pad)/2;
    c.fillStyle='#101d29';c.fillRect(x,y,this.cellSize,this.cellSize);
    c.fillStyle='#192b39';c.fillRect(x+pad,y+pad,this.cellSize-2*pad,this.cellSize-2*pad);
    for(let q=0;q<4;q++){
      const owner=this.cells[address*4+q];
      if(!owner)continue;
      c.fillStyle=warriorColor(owner-1);
      c.fillRect(x+pad+(q%2)*half,y+pad+Math.floor(q/2)*half,half,half);
    }
    if(!classic){
    c.strokeStyle='#101d29';c.lineWidth=Math.min(1,this.cellSize/8);
    const border=c.lineWidth/2;
    c.strokeRect(x+border,y+border,this.cellSize-2*border,this.cellSize-2*border);
    }
    if(this.pcs.includes(address)){
      c.strokeStyle='#ffffff';c.lineWidth=Math.max(0.4,this.cellSize/12);
      const inset=c.lineWidth/2;
      c.strokeRect(x+inset,y+inset,this.cellSize-2*inset,this.cellSize-2*inset);
    }
  }
  addressAt(event) {
    const rect = this.canvas.getBoundingClientRect();
    const row=Math.floor((event.clientY-rect.top)/this.cellSize);
    const col=Math.floor((event.clientX-rect.left)/this.cellSize);
    const address=row*this.columns+col;
    return row>=0 && col>=0 && col<this.columns && address<this.size ? address : null;
  }
}
