// src/ui/HUDCanvas.js
// Single overlay canvas for classic HUD + minimap
export class HUDCanvas {
  constructor(options = {}) {
    // create overlay canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'hud-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = '0';
    this.canvas.style.top = '0';
    this.canvas.style.pointerEvents = 'none'; // let clicks through to the canvas below
    this.canvas.style.zIndex = 999;
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * devicePixelRatio;
    this.canvas.height = this.height * devicePixelRatio;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.scale(devicePixelRatio, devicePixelRatio);

    window.addEventListener('resize', () => this.resize());

    // HUD state
    this.health = 100;
    this.lives = 3;
    this.keys = 0;
    this.coins = 0;

    // mini-map config
    this.minimapSize = 180; // px square
    this.minimapScale = 8; // pixels per cell placeholder

    // preload icons (paths from your asset list)
    this.icons = {};
    this._loadIcon('health', '/assets/sprites/items/Pickup-Health.png');
    this._loadIcon('key', '/assets/sprites/items/Pickup-Key.png');
    this._loadIcon('shield', '/assets/sprites/items/Pickup-Shield.png');
    this._loadIcon('coin', '/assets/sprites/items/Pickup-GoldCoin.png');
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * devicePixelRatio;
    this.canvas.height = this.height * devicePixelRatio;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  _loadIcon(name, url) {
    const img = new Image();
    img.src = url;
    img.onload = () => (this.icons[name] = img);
  }

  setState({ health, lives, keys, coins }) {
    if (health !== undefined) this.health = health;
    if (lives !== undefined) this.lives = lives;
    if (keys !== undefined) this.keys = keys;
    if (coins !== undefined) this.coins = coins;
  }

  // minimap: accept a small grid (2D array) or simple placeholder
  setMinimapData(minimapFn) {
    // minimapFn: a function that when called returns {width, height, cells[][]}
    this.minimapFn = minimapFn;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  draw() {
    const ctx = this.ctx;
    this.clear();

    this._drawMiniMap(ctx);
    this._drawStatusBar(ctx);
    this._drawCrosshair(ctx);
  }

  _drawCrosshair(ctx) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,200,200,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy);
    ctx.lineTo(cx - 4, cy);
    ctx.moveTo(cx + 12, cy);
    ctx.lineTo(cx + 4, cy);
    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx, cy - 4);
    ctx.moveTo(cx, cy + 12);
    ctx.lineTo(cx, cy + 4);
    ctx.stroke();
    ctx.restore();
  }

  _drawStatusBar(ctx) {
    const barH = 72;
    const padding = 12;
    const y = this.height - barH - padding;
    ctx.save();
    // background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, y, this.width, barH);

    // border
    ctx.strokeStyle = '#b30000';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, y + 4, this.width - 8, barH - 8);

    // health bar label & icon
    const iconSize = 48;
    const leftX = padding * 1.5;
    if (this.icons.health) ctx.drawImage(this.icons.health, leftX, y + 12, iconSize, iconSize);

    ctx.fillStyle = '#fff';
    ctx.font = '20px Orbitron, sans-serif';
    ctx.fillText(`Health`, leftX + iconSize + 12, y + 30);

    // numeric health + bar
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Orbitron, sans-serif';
    ctx.fillText(`${this.health}%`, leftX + iconSize + 12, y + 58);

    // Lives
    const livesX = leftX + 220;
    ctx.fillStyle = '#fff';
    ctx.font = '20px Orbitron, sans-serif';
    ctx.fillText(`Lives: ${this.lives}`, livesX, y + 44);

    // Keys & coins icons
    const rightStart = this.width - 220;
    if (this.icons.key) ctx.drawImage(this.icons.key, rightStart, y + 12, 36, 36);
    ctx.fillText(`x ${this.keys}`, rightStart + 44, y + 38);
    if (this.icons.coin) ctx.drawImage(this.icons.coin, rightStart + 120, y + 12, 36, 36);
    ctx.fillText(`x ${this.coins}`, rightStart + 164, y + 38);

    ctx.restore();
  }

  _drawMiniMap(ctx) {
    const size = this.minimapSize;
    const margin = 12;
    const x = this.width - size - margin;
    const y = margin;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = '#666';
    ctx.strokeRect(x, y, size, size);

    // simple placeholder grid or use minimapFn if provided
    if (this.minimapFn) {
      const map = this.minimapFn();
      // map: {w, h, cells, playerX, playerZ}
      const w = map.w;
      const h = map.h;
      const cellSize = size / Math.max(w, h);
      for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
          const cx = x + j * cellSize;
          const cy = y + i * cellSize;
          const val = map.cells?.[i]?.[j] ?? 0;
          if (val === 1) ctx.fillStyle = 'rgba(140,140,140,0.95)'; // wall
          else if (val === 2) ctx.fillStyle = 'rgba(200,180,0,0.9)'; // item
          else ctx.fillStyle = 'rgba(20,20,20,0.2)'; // empty
          ctx.fillRect(cx, cy, cellSize, cellSize);
        }
      }
      // player dot
      const px = x + (map.playerX / map.w) * size;
      const pz = y + (map.playerZ / map.h) * size;
      ctx.fillStyle = 'rgba(255,60,60,1)';
      ctx.beginPath();
      ctx.arc(px, pz, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // placeholder grid
      ctx.fillStyle = 'rgba(40,40,40,0.6)';
      ctx.fillRect(x, y, size, size);
      ctx.strokeStyle = 'rgba(80,80,80,0.6)';
      for (let i = 0; i <= 6; i++) {
        ctx.beginPath();
        ctx.moveTo(x + (i * size) / 6, y);
        ctx.lineTo(x + (i * size) / 6, y + size);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
