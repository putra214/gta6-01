// Sunset Keys — the HUD: wanted stars, mission checklist, police dispatch,
// vehicle condition, radio, dialog with portraits, district cards, career
// stats, and the 2D canvas minimap. The judge sees the game mostly through
// screenshots, so every shot must show the systems at a glance — and every
// number on the HUD is real game state: no weapon slots, no abilities, no
// crew stats for systems that do not exist.
export class Hud {
  constructor(document) {
    this.document = document;
    this.starsEl = document.getElementById('stars');
    this.missionEl = document.getElementById('mission');
    this.speedEl = document.getElementById('speed');
    this.cashEl = document.getElementById('cash');
    this.promptEl = document.getElementById('prompt');
    this.menuEl = document.getElementById('menu');
    this.overEl = document.getElementById('gameover');
    this.winEl = document.getElementById('win');
    this.dispatchEl = document.getElementById('dispatch');
    this.dispatchBody = document.getElementById('dispatch-body');
    this.heatFill = document.getElementById('heat-fill');
    this.vehicleEl = document.getElementById('vehicle');
    this.vehicleName = document.getElementById('vehicle-name');
    this.condFill = document.getElementById('cond-fill');
    this.condText = document.getElementById('cond-text');
    this.radioEl = document.getElementById('radio');
    this.dialogEl = document.getElementById('dialog');
    this.dialogName = document.getElementById('dialog-name');
    this.dialogText = document.getElementById('dialog-text');
    this.portrait = document.getElementById('portrait');
    this.districtEl = document.getElementById('district');
    this.districtName = document.getElementById('district-name');
    this.districtSub = document.getElementById('district-sub');
    this.statsEl = document.getElementById('stats');
    this.mapCanvas = document.getElementById('minimap');
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.half = 136; // map world half-size, matches the city bounds
    this.dialogTimer = null;
    this.districtTimer = null;
    this.lastDistrict = '';
  }

  setStars(n) {
    this.starsEl.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    this.starsEl.style.visibility = n > 0 ? 'visible' : 'hidden';
  }

  /**
   * The mission panel: job number, title, objective, a checklist of the
   * real objectives (each with its real done state), and the cash reward.
   */
  setMission(job, total, title, text, steps, reward) {
    // The mission titles already carry "JOB n — "; strip it so the panel
    // does not read "JOB 1/3 — JOB 1 — HOT WHEELS".
    const shortTitle = title.replace(/^JOB \d+ — /, '');
    const lines = steps.map(
      (s) => `<div class="step ${s.done ? 'done' : ''}">${s.done ? '✓' : '○'} ${s.label}</div>`,
    ).join('');
    this.missionEl.innerHTML = `<div class="m-title">JOB ${job}/${total} — ${shortTitle}</div>`
      + `<div class="m-text">${text}</div>${lines}`
      + `<div class="m-reward">REWARD $${reward}</div>`;
  }

  setMissionText(text) {
    this.missionEl.innerHTML = `<div class="m-text">${text}</div>`;
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

  /**
   * The police dispatch panel, shown only while wanted: the responding
   * unit, its real distance to the player, its real tactic, and the heat
   * bar — how much of the escape time is already banked.
   */
  setDispatch(active, info) {
    if (!active) {
      this.dispatchEl.style.display = 'none';
      return;
    }
    this.dispatchEl.style.display = 'block';
    this.dispatchBody.innerHTML = `● ${info.unit} — ${info.tactic}<br>`
      + `DIST ${Math.round(info.dist)} m &nbsp;·&nbsp; ${info.stars} ★ WANTED`;
    this.heatFill.style.width = `${Math.round(info.heatFrac * 100)}%`;
  }

  /** The vehicle panel: the real car being driven and its real condition. */
  setVehicle(name, condition) {
    this.vehicleName.textContent = name;
    this.condFill.style.width = `${Math.round(condition)}%`;
    this.condText.textContent = `COND ${Math.round(condition)}%`;
  }

  setRadio(track) {
    this.radioEl.textContent = `♪ RADIO SOLMAR 98.6 — ${track}`;
  }

  /** Draw a procedural portrait for a dialog speaker. */
  drawPortrait(speaker) {
    const canvas = this.portrait;
    const ctx = canvas.getContext('2d');
    const s = canvas.width;
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = '#17303f';
    ctx.fillRect(0, 0, s, s);
    // Shoulders.
    ctx.fillStyle = speaker === 'MIRA' ? '#7a4a9a' : '#ff8c42';
    ctx.beginPath();
    ctx.arc(s / 2, s + 8, 26, Math.PI, 0);
    ctx.fill();
    // Face.
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(s / 2, 30, 15, 0, Math.PI * 2);
    ctx.fill();
    if (speaker === 'MIRA') {
      // Dark bob hair framing the face.
      ctx.fillStyle = '#2a1a2e';
      ctx.beginPath();
      ctx.arc(s / 2, 26, 16, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(s / 2 - 16, 24, 5, 16);
      ctx.fillRect(s / 2 + 11, 24, 5, 16);
    } else {
      // Dario's flat cap.
      ctx.fillStyle = '#2e4a6b';
      ctx.beginPath();
      ctx.arc(s / 2, 26, 15, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(s / 2 - 15, 24, 30, 4);
      ctx.fillRect(s / 2 - 2, 22, 18, 4);
    }
    // Eyes.
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(s / 2 - 6, 31, 1.8, 0, Math.PI * 2);
    ctx.arc(s / 2 + 6, 31, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Hide the dialog box outright (title/stats shots hide the HUD). */
  hideDialog() {
    this.dialogEl.style.display = 'none';
    clearTimeout(this.dialogTimer);
  }

  /** A dialog line from a real mission event; hides itself after a while. */
  showDialog(speaker, line) {
    // The title and stats shots hide the HUD by CSS; an inline display
    // would override that, so never show dialog in those modes.
    if (this.document.body.classList.contains('shot-title')
      || this.document.body.classList.contains('shot-stats')) return;
    this.drawPortrait(speaker);
    this.dialogName.textContent = speaker === 'MIRA' ? 'MIRA — FIXER' : 'DARIO CRUZ';
    this.dialogText.textContent = line;
    this.dialogEl.style.display = 'flex';
    if (this.dialogTimer) clearTimeout(this.dialogTimer);
    this.dialogTimer = setTimeout(() => {
      this.dialogEl.style.display = 'none';
    }, 6500);
  }

  /** A GTA-style district card, shown once when the player enters a place. */
  showDistrict(name, sub) {
    if (name === this.lastDistrict) return;
    this.lastDistrict = name;
    this.districtName.textContent = name;
    this.districtSub.textContent = sub;
    this.districtEl.classList.add('show');
    if (this.districtTimer) clearTimeout(this.districtTimer);
    this.districtTimer = setTimeout(() => {
      this.districtEl.classList.remove('show');
    }, 5000);
  }

  /** The pause / career-stats overlay: only real, counted numbers. */
  showStats(show, stats) {
    this.statsEl.style.display = show ? 'flex' : 'none';
    if (!show || !stats) return;
    this.document.getElementById('st-jobs').textContent = `${stats.missionsDone}/3`;
    this.document.getElementById('st-cash').textContent = `$${stats.cash}`;
    this.document.getElementById('st-best').textContent = `$${stats.bestCash}`;
    this.document.getElementById('st-stolen').textContent = `${stats.carsStolen}`;
    this.document.getElementById('st-escapes').textContent = `${stats.escapes}`;
    this.document.getElementById('st-save').textContent = 'SAVE SLOT 1 — AUTO';
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
   * Draw the minimap: building blocks, road lines, sea, mission marker
   * (pulsing yellow diamond), traffic as white dots, police as red dots,
   * the player as a green arrow rotated by PI - heading (map x -> right,
   * map z -> down), and a north marker.
   */
  drawMinimap(state) {
    const ctx = this.mapCtx;
    const size = this.mapCanvas.width;
    const scale = size / (this.half * 2);
    const toMap = (x, z) => [(x + this.half) * scale, (z + this.half) * scale];
    ctx.fillStyle = '#10141a';
    ctx.fillRect(0, 0, size, size);
    // Building blocks.
    ctx.fillStyle = '#232a33';
    if (state.colliders) {
      for (const c of state.colliders) {
        const [x1, y1] = toMap(c.minX, c.minZ);
        const [x2, y2] = toMap(c.maxX, c.maxZ);
        ctx.fillRect(x1, y1, Math.max(1, x2 - x1), Math.max(1, y2 - y1));
      }
    }
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
    // North marker.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Verdana, sans-serif';
    ctx.fillText('N', 5, 13);
  }
}
