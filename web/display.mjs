// SPDX-License-Identifier: GPL-2.0-or-later
export function warriorColor(i) {
  return ['#54d8df', '#f9a567', '#b4a0ff', '#91d97e', '#ff8bb8', '#f0db75'][i] ||
    'hsl(' + ((i * 137.508) % 360) + ' 70% 70%)';
}
export class CoreDisplay {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', {alpha: false});
    this.columns = Math.ceil(Math.sqrt(8000 * 2.5));
    this.size = 8000;
    this.pcs = [];
    this.cells = new Uint16Array(this.size);
    this.observer = new ResizeObserver(() => this.redraw());
    this.observer.observe(canvas);
    this.redraw();
  }
  configure(size) {
    this.size = size;
    this.pcs = [];
    this.columns = Math.ceil(Math.sqrt(size * 2.5));
    this.cells = new Uint16Array(size);
    this.redraw();
  }
  redraw() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(320, this.canvas.clientWidth);
    this.cellSize = width / this.columns;
    const height = Math.ceil(this.size / this.columns) * this.cellSize;
    this.canvas.style.height = height + 'px';
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.context.fillStyle = '#101d29';
    this.context.fillRect(0, 0, width, height);
    for (let i = 0; i < this.size; ++i) if (this.cells[i]) this.draw(i);
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
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
      } else if (kind === 8) {
        if (this.pcs[owner] >= 0) dirty.add(this.pcs[owner]);
        this.pcs[owner] = -1;
      } else if (kind >= 1 && kind <= 6) {
        if (kind === 2) {
          if (this.pcs[owner] >= 0) dirty.add(this.pcs[owner]);
          this.pcs[owner] = address;
        }
        this.cells[address] = ((owner + 1) << 8) | kind;
        dirty.add(address);
      }
    }
    for (const address of dirty) this.draw(address);
  }
  draw(address) {
    const value = this.cells[address], kind = value & 255;
    const x = (address % this.columns) * this.cellSize;
    const y = Math.floor(address / this.columns) * this.cellSize;
    const c = this.context;
    c.fillStyle = '#101d29';
    c.fillRect(x, y, this.cellSize, this.cellSize);
    c.globalAlpha = kind === 3 ? 0.45 : kind === 1 ? 0.65 : 1;
    c.fillStyle = value ? warriorColor((value >>> 8) - 1) : '#101d29';
    const pad = Math.min(1, this.cellSize / 6);
    c.fillRect(x + pad, y + pad, this.cellSize - 2 * pad, this.cellSize - 2 * pad);
    c.globalAlpha = 1;
    if (this.pcs.includes(address)) {
      c.fillStyle = '#ffffff';
      c.fillRect(x + this.cellSize / 3, y + this.cellSize / 3,
        this.cellSize / 3, this.cellSize / 3);
    }
  }
  addressAt(event) {
    const rect = this.canvas.getBoundingClientRect();
    return Math.min(this.size - 1, Math.max(0,
      Math.floor((event.clientY - rect.top) / this.cellSize) * this.columns +
      Math.floor((event.clientX - rect.left) / this.cellSize)));
  }
}
