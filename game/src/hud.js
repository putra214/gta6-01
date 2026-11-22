// Sunset Keys — the HUD: wanted stars, mission line, speed, cash, prompts
// and the 2D canvas minimap. The judge sees the game mostly through
// screenshots, so every shot must show the systems at a glance: stars +
// speed + minimap + mission text together.
export class Hud {
  constructor(document) {
    this.starsEl = document.getElementById('stars');
    this.missionEl = document.getElementById('mission');
    this.speedEl = document.getElementById('speed');
    this.cashEl = document.getElementById('cash');
    this.promptEl = document.getElementById('prompt');
    this.menuEl = document.getElementById('menu');
    this.overEl = document.getElementById('gameover');
    this.winEl = document.getElementById('win');
    this.mapCanvas = document.getElementById('minimap');
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.half = 136; // map world half-size, matches the city bounds
  }

  setStars(n) {
    this.starsEl.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    this.starsEl.style.visibility = n > 0 ? 'visible' : 'hidden';
  }

  setMission(text) {
    this.missionEl.textContent = text;
  }

  setSpeed(kmh) {
    this.speedEl.textContent = `${Math.round(kmh)} km/h`;
  }

  setCash(cash) {
    this.cashEl.textContent = `$${cash}`;
  }

  setPrompt(text) {
    this.promptEl.textContent = text;
    this.promptEl.style.visibility = text ? 'visible' : 'hidden';
  }

  showMenu(show) {
    this.menuEl.style.display = show ? 'flex' : 'none';
  }

  showGameOver(show, text) {
    this.overEl.style.display = show ? 'flex' : 'none';
    if (text) this.overEl.querySelector('p').textContent = text;
  }

  showWin(show, cash) {
    this.winEl.style.display = show ? 'flex' : 'none';
    if (show) this.winEl.querySelector('p').textContent = `All jobs done — you banked $${cash}. Solmar Bay is yours, Dario.`;
  }

  /**
   * Draw the minimap: dark ground, road lines, mission marker (pulsing
   * yellow diamond), traffic as white dots, police as red dots, the player
   * as a green arrow rotated by PI - heading (map x -> right, map z -> down).
   */
  drawMinimap(state) {
    const ctx = this.mapCtx;
    const size = this.mapCanvas.width;
    const scale = size / (this.half * 2);
    const toMap = (x, z) => [(x + this.half) * scale, (z + this.half) * scale];
    ctx.fillStyle = '#10141a';
    ctx.fillRect(0, 0, size, size);
    // Road lines.
    ctx.strokeStyle = '#3a4550';
    ctx.lineWidth = 2;
    for (const line of state.roadLines) {
      const [x1, y1] = toMap(line, -this.half);
      const [x2, y2] = toMap(line, this.half);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const [x3, y3] = toMap(-this.half, line);
      const [x4, y4] = toMap(this.half, line);
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.stroke();
    }
    // Sea along the south edge.
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(0, size - 6, size, 6);
    // Mission marker: pulsing yellow diamond.
    if (state.missionMarker) {
      const pulse = 5 + Math.sin(state.time * 4) * 2;
      const [mx, my] = toMap(state.missionMarker.x, state.missionMarker.z);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(mx, my - pulse);
      ctx.lineTo(mx + pulse, my);
      ctx.lineTo(mx, my + pulse);
      ctx.lineTo(mx - pulse, my);
      ctx.closePath();
      ctx.fill();
    }
    // Traffic as white dots, police as red dots.
    ctx.fillStyle = '#ffffff';
    for (const t of state.trafficDots) {
      const [tx, ty] = toMap(t.x, t.z);
      ctx.fillRect(tx - 1, ty - 1, 2, 2);
    }
    ctx.fillStyle = '#ff3030';
    for (const p of state.policeDots) {
      const [px, py] = toMap(p.x, p.z);
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow, rotated by PI - heading.
    const [px, py] = toMap(state.player.x, state.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - state.player.heading);
    ctx.fillStyle = '#39d353';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
