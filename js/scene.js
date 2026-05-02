/**
 * OBRAS PÚBLICAS — Escena Cinemática v2
 * Canvas 2D + GSAP · H. Ayuntamiento Temascaltepec
 *
 * Arquitectura: Canvas procedural, completamente aislado de main.js
 * No toca login, sesión, ni routing.
 */
(function () {
  'use strict';

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    r = Math.min(r, w/2, h/2);
    this.moveTo(x+r, y);
    this.arcTo(x+w, y, x+w, y+h, r);
    this.arcTo(x+w, y+h, x, y+h, r);
    this.arcTo(x, y+h, x, y, r);
    this.arcTo(x, y, x+w, y, r);
    this.closePath();
    return this;
  };
}
  
  if (typeof gsap === 'undefined') return;

  /* ─────────────────────────────────────────
     0. REPLACE STATS WITH CANVAS CONTAINER
  ───────────────────────────────────────── */
  const statsEl = document.querySelector('.hero-cinematic');
  if (!statsEl) return;

  const wrapper = document.createElement('div');
  wrapper.id = 'op-scene-wrapper';
  wrapper.innerHTML = `
    <canvas id="op-canvas"></canvas>
    <div id="op-hud">
      <div class="hud-item">
        <span class="hud-val" id="hval-obras">0</span>
        <span class="hud-label">Obras registradas</span>
      </div>
      <div class="hud-sep"></div>
      <div class="hud-item">
        <span class="hud-val" id="hval-roles">0</span>
        <span class="hud-label">Roles activos</span>
      </div>
      <div class="hud-sep"></div>
      <div class="hud-item">
        <span class="hud-val" id="hval-transp">0<small>%</small></span>
        <span class="hud-label">Transparencia</span>
      </div>
    </div>
    <div id="op-phase-bar">
      <div id="op-phase-fill"></div>
      <div id="op-phase-label">Iniciando sistema…</div>
    </div>
  `;
  statsEl.replaceWith(wrapper);

  /* styles */
  const style = document.createElement('style');
  style.textContent = `
    #op-scene-wrapper{width:100%;max-width:860px;margin:0 auto;display:flex;flex-direction:column;animation:fade-up .8s .5s ease both}
    #op-canvas{width:100%;border-radius:20px 20px 0 0;border:1px solid rgba(59,130,246,.13);border-bottom:none;display:block;background:#050810;box-shadow:0 0 80px rgba(59,130,246,.06) inset,0 40px 80px rgba(0,0,0,.55)}
    #op-hud{display:flex;align-items:center;justify-content:center;background:rgba(8,12,15,.95);border:1px solid rgba(59,130,246,.1);border-top:1px solid rgba(59,130,246,.2);padding:1.1rem 2rem;opacity:0}
    .hud-item{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1}
    .hud-val{font-family:'Syne',sans-serif;font-size:clamp(1.6rem,3vw,2.4rem);font-weight:800;color:#eef2f7;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
    .hud-val small{font-size:.5em;opacity:.65}
    .hud-label{font-size:.64rem;text-transform:uppercase;letter-spacing:.12em;color:#445566}
    .hud-sep{width:1px;height:36px;background:rgba(255,255,255,.07);flex-shrink:0}
    #op-phase-bar{background:rgba(6,10,14,.97);border:1px solid rgba(59,130,246,.07);border-top:none;border-radius:0 0 20px 20px;padding:.6rem 1.4rem;display:flex;align-items:center;gap:1rem;opacity:0}
    #op-phase-fill{height:2px;width:0%;background:linear-gradient(90deg,#3b82f6,#10b981,#f59e0b);border-radius:2px;flex:1;min-width:0;transition:width .4s ease;box-shadow:0 0 8px rgba(59,130,246,.5)}
    #op-phase-label{font-family:'Syne',sans-serif;font-size:.6rem;color:#445566;text-transform:uppercase;letter-spacing:.1em;white-space:nowrap;flex-shrink:0;transition:opacity .3s}
    @media(max-width:500px){.hud-label{display:none}#op-phase-label{display:none}}
  `;
  document.head.appendChild(style);

  /* ─────────────────────────────────────────
     1. CANVAS SETUP
  ───────────────────────────────────────── */
  const canvas = document.getElementById('op-canvas');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const W = 860, H = 380;
  canvas.width  = W * DPR;
  canvas.height = H * DPR;
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  /* ─────────────────────────────────────────
     2. SCENE STATE
  ───────────────────────────────────────── */
  const S = {
    starAlpha: 0, moonAlpha: 0, moonX: 700, moonY: 52,
    riseL: 0, riseC: 0, riseR: 0,
    winAlpha: 0,
    craneAlpha: 0, trolleyX: 0, hookY: 0,
    eagleDraw: 0, eagleAlpha: 0,
    dustAlpha: 0,
    progress: 0,
    t: 0,
  };

  /* ─────────────────────────────────────────
     3. PARTICLE SYSTEM
  ───────────────────────────────────────── */
  const particles = [];
  function spawnDust(x, y, n = 5) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - .5) * 1.6,
        vy: -(Math.random() * 1.4 + .3),
        life: 1,
        decay: Math.random() * .02 + .008,
        r: Math.random() * 3 + .8,
        gold: Math.random() > .6,
      });
    }
  }
  function tickParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += .045; p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  function drawParticles() {
    if (!S.dustAlpha) return;
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.life * S.dustAlpha * .55;
      ctx.fillStyle = p.gold ? '#f59e0b' : '#60a5fa';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ─────────────────────────────────────────
     4. DRAW HELPERS
  ───────────────────────────────────────── */
  const GY = H - 78; // ground y

  function drawStars() {
    if (S.starAlpha <= 0) return;
    const starData = [
      [55,28],[128,52],[205,18],[290,40],[368,16],[455,32],[540,20],
      [625,44],[708,14],[790,36],[840,55],[42,75],[170,88],[310,68],
      [430,80],[545,62],[665,75],[748,60],[820,78],[100,108],
    ];
    const t = S.t;
    ctx.save();
    for (const [sx, sy] of starData) {
      const twinkle = (Math.sin(t * .7 + sx * .05) * .35 + .65);
      ctx.globalAlpha = S.starAlpha * twinkle * .85;
      const r = .5 + Math.random() * .3; // stable size
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMoon() {
    if (S.moonAlpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = S.moonAlpha;
    const grd = ctx.createRadialGradient(S.moonX, S.moonY, 0, S.moonX, S.moonY, 50);
    grd.addColorStop(0, 'rgba(180,210,255,.07)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd; ctx.beginPath();
    ctx.arc(S.moonX, S.moonY, 50, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(208,222,255,.88)';
    ctx.beginPath(); ctx.arc(S.moonX, S.moonY, 19, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#050810';
    ctx.beginPath(); ctx.arc(S.moonX + 8, S.moonY - 4, 15, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawGround() {
    const grd = ctx.createLinearGradient(0, GY - 10, 0, H);
    grd.addColorStop(0, 'rgba(59,130,246,.06)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, GY, W, H - GY);
    ctx.save();
    ctx.strokeStyle = 'rgba(59,130,246,.2)';
    ctx.lineWidth = 1; ctx.setLineDash([5, 9]);
    ctx.beginPath(); ctx.moveTo(30, GY); ctx.lineTo(W - 30, GY); ctx.stroke();
    ctx.restore();
  }

  /* ── Generic building block ── */
  function drawBuilding({ cx, w, h, depth = 10, colors, accent, rise, winAlpha = 0, doors = [] }) {
    const rh = h * Math.max(0, rise);
    if (rh < 1) return;
    const top = GY - rh, left = cx - w / 2, right = cx + w / 2;

    // facade
    const fg = ctx.createLinearGradient(left, top, left, GY);
    fg.addColorStop(0, colors[0]); fg.addColorStop(.55, colors[1]); fg.addColorStop(1, colors[2]);
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.roundRect(left, top, w, rh, [3, 3, 0, 0]); ctx.fill();

    // right side face
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.moveTo(right, top);
    ctx.lineTo(right + depth, top + depth * .5);
    ctx.lineTo(right + depth, GY + depth * .5);
    ctx.lineTo(right, GY);
    ctx.closePath(); ctx.fill();

    // top face
    ctx.fillStyle = 'rgba(255,255,255,.04)';
    ctx.beginPath();
    ctx.moveTo(left, top); ctx.lineTo(right, top);
    ctx.lineTo(right + depth, top + depth * .5);
    ctx.lineTo(left + depth, top + depth * .5);
    ctx.closePath(); ctx.fill();

    // edge glow lines
    ctx.save();
    ctx.strokeStyle = accent; ctx.lineWidth = 1; ctx.globalAlpha = .45;
    ctx.beginPath();
    ctx.moveTo(left, top); ctx.lineTo(left, GY);
    ctx.moveTo(right, top); ctx.lineTo(right, GY);
    ctx.stroke();
    ctx.restore();

    // windows
    if (winAlpha > 0 && rh > 28) {
      const cols = Math.max(1, Math.floor(w / 17));
      const rowH = 17, wW = 9, wH = 9;
      const padX = (w - cols * 15) / 2;
      const rows = Math.floor((rh - 18) / rowH);
      ctx.save();
      ctx.beginPath(); ctx.rect(left, top, w, rh); ctx.clip();
      const t = S.t;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const flk = Math.sin(t * 1.2 + c * 2.3 + r * 3.1);
          const alpha = flk > .88 ? .06 : (flk < -.88 ? .52 : .26);
          ctx.globalAlpha = winAlpha * alpha;
          ctx.fillStyle = (r + c) % 8 === 0 ? '#f59e0b' : '#3b82f6';
          ctx.beginPath();
          ctx.roundRect(left + padX + c * 15, top + 12 + r * rowH, wW, wH, 1);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // doors
    if (rise > .85 && doors.length) {
      for (const dx of doors) {
        const dw = 13, dh = 20, dl = cx + dx - dw / 2;
        ctx.save();
        ctx.globalAlpha = winAlpha * .5;
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.moveTo(dl, GY); ctx.lineTo(dl, GY - dh + dw / 2);
        ctx.arc(dl + dw / 2, GY - dh + dw / 2, dw / 2, Math.PI, 0);
        ctx.lineTo(dl + dw, GY); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }

  /* ── Stepped civic hall (center) ── */
  function drawCivicHall(rise, winAlpha) {
    if (rise <= 0) return;
    const cx = W / 2;
    const totalH = 248;
    // levels from base to top
    const levels = [
      { w: 162, frac: .42 },
      { w: 118, frac: .26 },
      { w:  76, frac: .18 },
      { w:  42, frac: .14 },
    ];
    const shades = [
      ['#1c3050', '#102038', '#081428'],
      ['#1a2c4c', '#0e1c34', '#071020'],
      ['#182848', '#0c1a30', '#060e1c'],
      ['#162444', '#0a162c', '#050c18'],
    ];
    // Calculate cumulative heights from top
    let cumFrac = 0;
    const levelData = levels.map((lv, i) => {
      const from = cumFrac;
      cumFrac += lv.frac;
      return { ...lv, from, to: cumFrac, idx: i };
    });

    let baseY = GY;
    for (let i = levels.length - 1; i >= 0; i--) {
      const lv = levelData[i];
      const lh = totalH * lv.frac;
      // rise progress for this level
      const needed = 1 - lv.from; // how much total rise to start this level
      const lvRise = Math.max(0, Math.min(1, (rise - (1 - lv.to)) / lv.frac));
      const rh = lh * lvRise;
      if (rh < 1) { baseY -= lh; continue; }

      const top = baseY - rh;
      const L = cx - lv.w / 2, R = cx + lv.w / 2;
      const depth = 14 - i * 2;
      const shade = shades[i];

      const fg = ctx.createLinearGradient(L, top, L, baseY);
      fg.addColorStop(0, shade[0]); fg.addColorStop(.5, shade[1]); fg.addColorStop(1, shade[2]);
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.rect(L, top, lv.w, rh); ctx.fill();

      // side
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.beginPath();
      ctx.moveTo(R, top); ctx.lineTo(R + depth, top + depth * .5);
      ctx.lineTo(R + depth, baseY + depth * .5); ctx.lineTo(R, baseY);
      ctx.closePath(); ctx.fill();

      // top face
      ctx.fillStyle = 'rgba(59,130,246,.05)';
      ctx.beginPath();
      ctx.moveTo(L, top); ctx.lineTo(R, top);
      ctx.lineTo(R + depth, top + depth * .5); ctx.lineTo(L + depth, top + depth * .5);
      ctx.closePath(); ctx.fill();

      // edge accent
      ctx.save();
      ctx.strokeStyle = 'rgba(59,130,246,.35)'; ctx.lineWidth = .9;
      ctx.beginPath();
      ctx.moveTo(L, top); ctx.lineTo(L, baseY);
      ctx.moveTo(R, top); ctx.lineTo(R, baseY);
      ctx.stroke();
      // step accent line (horizontal)
      if (i < levels.length - 1) {
        ctx.strokeStyle = 'rgba(59,130,246,.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(L, baseY); ctx.lineTo(R, baseY); ctx.stroke();
      }
      ctx.restore();

      // windows on bottom 2 levels
      if (i >= 2 && winAlpha > 0 && rh > 20) {
        const cols = Math.max(1, Math.floor(lv.w / 17));
        const rowH = 16, wW = 9, wH = 8;
        const padX = (lv.w - cols * 15) / 2;
        const rows = Math.floor((rh - 12) / rowH);
        ctx.save();
        ctx.beginPath(); ctx.rect(L, top, lv.w, rh); ctx.clip();
        const t = S.t;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const flk = Math.sin(t * 1.1 + c * 1.8 + r * 2.9 + i * 1.1);
            const alpha = flk > .9 ? .06 : (flk < -.9 ? .55 : .29);
            const isGold = (r * cols + c) % 11 === 0;
            ctx.globalAlpha = winAlpha * alpha;
            ctx.fillStyle = isGold ? '#f59e0b' : '#60a5fa';
            ctx.beginPath();
            ctx.roundRect(L + padX + c * 15, top + 10 + r * rowH, wW, wH, 1);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      baseY -= rh;
    }

    // ── Arched entrance ──
    if (rise > .88 && winAlpha > .2) {
      const archW = 20, archH = 30;
      for (const dx of [-14, 14]) {
        const al = cx + dx - archW / 2;
        ctx.save();
        ctx.globalAlpha = winAlpha * .45;
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.moveTo(al, GY); ctx.lineTo(al, GY - archH + archW / 2);
        ctx.arc(al + archW / 2, GY - archH + archW / 2, archW / 2, Math.PI, 0);
        ctx.lineTo(al + archW, GY); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }

    // ── Flagpole ──
    if (rise > .9) {
      const pAlpha = Math.min(1, (rise - .9) / .1);
      const pBase = GY - totalH * Math.min(1, rise) + 3;
      const pTop  = pBase - 42;
      ctx.save();
      ctx.globalAlpha = pAlpha;
      ctx.strokeStyle = 'rgba(180,205,230,.65)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(W / 2, pBase); ctx.lineTo(W / 2, pTop); ctx.stroke();

      // waving flag
      const t = S.t;
      const fW = 28, fH = 16, seg = 7;
      for (let s = 0; s < seg; s++) {
        const x0 = W / 2 + (s / seg) * fW;
        const x1 = W / 2 + ((s + 1) / seg) * fW;
        const wave = (n) => Math.sin(t * 3.2 + n * .5) * 2.8;
        const colors = ['#006847', '#f0f0f0', '#ce1126'];
        for (let ci = 0; ci < 3; ci++) {
          ctx.fillStyle = colors[ci];
          ctx.beginPath();
          const bandTop = pTop + (fH / 3) * ci;
          ctx.moveTo(x0, bandTop + wave(s));
          ctx.lineTo(x1, bandTop + wave(s + 1));
          ctx.lineTo(x1, bandTop + fH / 3 + wave(s + 1));
          ctx.lineTo(x0, bandTop + fH / 3 + wave(s));
          ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    }

    // ── Roof beacon light ──
    if (rise > .95) {
      const beaconAlpha = Math.min(1, (rise - .95) / .05);
      const bt = S.t;
      const blink = (Math.sin(bt * 4) + 1) / 2;
      const bx = W / 2, by = GY - totalH * Math.min(1, rise) - 44;
      ctx.save();
      ctx.globalAlpha = beaconAlpha * blink * .8;
      const glw = ctx.createRadialGradient(bx, by, 0, bx, by, 12);
      glw.addColorStop(0, 'rgba(245,158,11,.9)');
      glw.addColorStop(1, 'rgba(245,158,11,0)');
      ctx.fillStyle = glw;
      ctx.beginPath(); ctx.arc(bx, by, 12, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = beaconAlpha * blink;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(bx, by, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  /* ── Crane ── */
  function drawCrane(cx, flipJib, color) {
    if (S.craneAlpha <= 0) return;
    const mastH = 155, jibLen = flipJib ? -115 : 115;
    ctx.save();
    ctx.globalAlpha = S.craneAlpha;

    // mast
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(cx, GY); ctx.lineTo(cx, GY - mastH); ctx.stroke();

    // braces
    ctx.strokeStyle = 'rgba(59,130,246,.22)'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = GY - 38 - i * 28;
      ctx.beginPath(); ctx.moveTo(cx - 4, y); ctx.lineTo(cx + 4, y - 14); ctx.stroke();
    }

    // jib
    ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx + jibLen, GY - mastH + 5);
    ctx.lineTo(cx + Math.abs(jibLen) * .2 * (flipJib ? 1 : -1), GY - mastH + 5);
    ctx.stroke();

    // counter jib
    ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(59,130,246,.45)';
    ctx.beginPath();
    ctx.moveTo(cx, GY - mastH + 5);
    ctx.lineTo(cx + 32 * (flipJib ? 1 : -1), GY - mastH + 5);
    ctx.stroke();

    // counter weight
    const cwx = cx + 26 * (flipJib ? 1 : -1);
    ctx.fillStyle = '#0c1824'; ctx.strokeStyle = 'rgba(59,130,246,.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(cwx - 7, GY - mastH + 3, 14, 9, 2); ctx.fill(); ctx.stroke();

    // trolley
    const tJibEnd = cx + jibLen;
    const tJibStart = cx + Math.abs(jibLen) * .2 * (flipJib ? 1 : -1);
    const trolleyX = tJibStart + (tJibEnd - tJibStart) * S.trolleyX;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(trolleyX - 5, GY - mastH - 1, 10, 7, 2); ctx.fill();

    // cable
    const hookDrop = S.hookY * 50 + 8;
    ctx.strokeStyle = color; ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.globalAlpha = S.craneAlpha * .5;
    ctx.beginPath();
    ctx.moveTo(trolleyX, GY - mastH + 6);
    ctx.lineTo(trolleyX, GY - mastH + 6 + hookDrop);
    ctx.stroke();
    ctx.setLineDash([]);

    // hook arc
    ctx.globalAlpha = S.craneAlpha;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(trolleyX, GY - mastH + 6 + hookDrop + 5, 5, Math.PI, 0, true);
    ctx.stroke();

    // warning light blink
    const blink = Math.sin(S.t * 4.5) > 0;
    if (blink) {
      const lx = cx + jibLen;
      ctx.globalAlpha = S.craneAlpha * .85;
      const glw = ctx.createRadialGradient(lx, GY - mastH + 3, 0, lx, GY - mastH + 3, 10);
      glw.addColorStop(0, 'rgba(245,158,11,.7)');
      glw.addColorStop(1, 'rgba(245,158,11,0)');
      ctx.fillStyle = glw;
      ctx.beginPath(); ctx.arc(lx, GY - mastH + 3, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(lx, GY - mastH + 3, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }

  /* ── Águila Nacional — path-by-path reveal ── */
  function drawEagle(progress, alpha) {
    if (alpha <= 0 || progress <= 0) return;
    const cx = W / 2, cy = GY - 148;

    ctx.save();
    ctx.globalAlpha = alpha;

    // ambient halo
    if (progress > .4) {
      const t = S.t;
      const pulse = Math.sin(t * 1.6) * .5 + .5;
      const glw = ctx.createRadialGradient(cx, cy, 0, cx, cy, 82);
      glw.addColorStop(0, `rgba(245,158,11,${.07 * alpha * pulse})`);
      glw.addColorStop(.6, `rgba(245,158,11,${.03 * alpha * pulse})`);
      glw.addColorStop(1,  'rgba(245,158,11,0)');
      ctx.fillStyle = glw;
      ctx.beginPath(); ctx.arc(cx, cy, 82, 0, Math.PI * 2); ctx.fill();
    }

    // Helper: fade a segment based on draw progress
    const seg = (start, end, fn) => {
      if (progress < start) return;
      const p = Math.min(1, (progress - start) / Math.max(.001, end - start));
      ctx.save(); ctx.globalAlpha = alpha * p; fn(p); ctx.restore();
    };

    // Body
    seg(0, .12, () => {
      ctx.strokeStyle = 'rgba(245,158,11,.7)'; ctx.lineWidth = 1.2; ctx.setLineDash([]);
      ctx.beginPath(); ctx.ellipse(cx, cy, 22, 17, 0, 0, Math.PI * 2); ctx.stroke();
    });

    // Left wing fill
    seg(.09, .28, (p) => {
      ctx.fillStyle = `rgba(245,158,11,${.12 * p})`;
      ctx.strokeStyle = `rgba(245,158,11,${.6 * p})`; ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.bezierCurveTo(cx - 22, cy - 22, cx - 50, cy - 24, cx - 68, cy - 14);
      ctx.bezierCurveTo(cx - 50, cy - 10, cx - 28, cy - 8, cx, cy - 6);
      ctx.fill(); ctx.stroke();
    });

    // Right wing fill
    seg(.09, .28, (p) => {
      ctx.fillStyle = `rgba(245,158,11,${.12 * p})`;
      ctx.strokeStyle = `rgba(245,158,11,${.6 * p})`; ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.bezierCurveTo(cx + 22, cy - 22, cx + 50, cy - 24, cx + 68, cy - 14);
      ctx.bezierCurveTo(cx + 50, cy - 10, cx + 28, cy - 8, cx, cy - 6);
      ctx.fill(); ctx.stroke();
    });

    // Wing feather lines — left
    seg(.26, .44, () => {
      ctx.strokeStyle = 'rgba(245,158,11,.42)'; ctx.lineWidth = .9;
      [[-40,-17,-50,-24],[-55,-19,-63,-27],[-65,-14,-72,-20]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(cx+x1, cy+y1); ctx.lineTo(cx+x2, cy+y2); ctx.stroke();
      });
    });

    // Wing feather lines — right
    seg(.26, .44, () => {
      ctx.strokeStyle = 'rgba(245,158,11,.42)'; ctx.lineWidth = .9;
      [[40,-17,50,-24],[55,-19,63,-27],[65,-14,72,-20]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(cx+x1, cy+y1); ctx.lineTo(cx+x2, cy+y2); ctx.stroke();
      });
    });

    // Head
    seg(.40, .55, () => {
      ctx.strokeStyle = 'rgba(245,158,11,.75)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, cy - 23, 10, 0, Math.PI * 2); ctx.stroke();
    });

    // Beak
    seg(.53, .61, () => {
      ctx.fillStyle = 'rgba(245,158,11,.9)';
      ctx.beginPath();
      ctx.moveTo(cx + 7, cy - 21); ctx.lineTo(cx + 14, cy - 18); ctx.lineTo(cx + 8, cy - 16);
      ctx.closePath(); ctx.fill();
    });

    // Eye
    seg(.60, .66, () => {
      ctx.fillStyle = 'rgba(245,158,11,.9)';
      ctx.beginPath(); ctx.arc(cx - 1, cy - 24, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#060a0f';
      ctx.beginPath(); ctx.arc(cx - .5, cy - 24, 1, 0, Math.PI * 2); ctx.fill();
    });

    // Serpent
    seg(.64, .80, () => {
      ctx.strokeStyle = 'rgba(16,185,129,.75)'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 5);
      ctx.bezierCurveTo(cx - 2, cy + 11, cx + 4, cy + 8, cx + 6, cy + 14);
      ctx.bezierCurveTo(cx + 9, cy + 20, cx + 2, cy + 25, cx - 3, cy + 20);
      ctx.stroke();
      // snake head
      ctx.fillStyle = 'rgba(16,185,129,.8)';
      ctx.beginPath(); ctx.arc(cx - 8, cy + 5, 2, 0, Math.PI * 2); ctx.fill();
    });

    // Nopal
    seg(.78, .90, () => {
      ctx.strokeStyle = 'rgba(16,185,129,.58)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + 6); ctx.lineTo(cx - 6, cy + 29);
      ctx.moveTo(cx - 15, cy + 15); ctx.lineTo(cx - 6, cy + 12);
      ctx.moveTo(cx + 3, cy + 19); ctx.lineTo(cx - 6, cy + 17);
      ctx.stroke();
      // nopal pads
      ctx.strokeStyle = 'rgba(16,185,129,.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx - 11, cy + 17, 5, 3.5, -.4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx - 1, cy + 22, 4, 3, .3, 0, Math.PI * 2); ctx.stroke();
    });

    // Tail feathers
    seg(.88, 1, () => {
      ctx.strokeStyle = 'rgba(245,158,11,.48)'; ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(cx - 13, cy + 14);
      ctx.bezierCurveTo(cx - 22, cy + 28, cx - 17, cy + 36, cx - 8, cy + 31);
      ctx.bezierCurveTo(cx - 4, cy + 35, cx + 4, cy + 35, cx + 8, cy + 31);
      ctx.bezierCurveTo(cx + 17, cy + 36, cx + 22, cy + 28, cx + 13, cy + 14);
      ctx.stroke();
      // center tail line
      ctx.strokeStyle = 'rgba(245,158,11,.3)'; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(cx, cy + 14); ctx.lineTo(cx, cy + 34); ctx.stroke();
    });

    ctx.restore();
  }

  /* ─────────────────────────────────────────
     5. RENDER LOOP
  ───────────────────────────────────────── */
  let rafId;
  let lastDust = 0;

  function render(ts) {
    S.t = ts / 1000;
    ctx.clearRect(0, 0, W, H);

    // sky
    const skG = ctx.createLinearGradient(0, 0, 0, H);
    skG.addColorStop(0,  '#04060c');
    skG.addColorStop(.65,'#060c14');
    skG.addColorStop(1,  '#091018');
    ctx.fillStyle = skG; ctx.fillRect(0, 0, W, H);

    drawStars();
    drawMoon();

    // dust emission
    if (S.dustAlpha > 0 && ts - lastDust > 130) {
      if (S.riseL > .08 && S.riseL < .98) spawnDust(W*.22, GY - 200*S.riseL, 3);
      if (S.riseC > .08 && S.riseC < .98) spawnDust(W*.5,  GY - 248*S.riseC, 5);
      if (S.riseR > .08 && S.riseR < .98) spawnDust(W*.78, GY - 180*S.riseR, 3);
      lastDust = ts;
    }
    tickParticles();

    drawGround();

    // bg silhouette buildings
    if (S.riseL > .05) {
      const ba = Math.min(1, S.riseL * 2.5) * .35;
      ctx.globalAlpha = ba;
      [{cx:92, w:38, h:105}, {cx:162, w:28, h:75}, {cx:W-90, w:40, h:100}, {cx:W-155, w:26, h:68}].forEach((b, i) => {
        const r = i < 2 ? S.riseL : S.riseR;
        drawBuilding({ ...b, depth:6, colors:['#0c1828','#070f1c','#030810'], accent:'rgba(59,130,246,.15)', rise:Math.min(1,r*1.5) });
      });
      ctx.globalAlpha = 1;
    }

    // main buildings
    drawBuilding({
      cx: W*.22, w: 84, h: 205, depth: 13,
      colors: ['#1c2e48','#102030','#081524'],
      accent: 'rgba(59,130,246,.52)',
      rise: S.riseL, winAlpha: S.winAlpha, doors: [-13, 13],
    });

    drawBuilding({
      cx: W*.78, w: 78, h: 185, depth: 12,
      colors: ['#182a42','#0d1c2e','#071220'],
      accent: 'rgba(59,130,246,.48)',
      rise: S.riseR, winAlpha: S.winAlpha, doors: [-11, 11],
    });

    drawCivicHall(S.riseC, S.winAlpha);

    // cranes
    drawCrane(W * .365, false, 'rgba(59,130,246,.68)');
    drawCrane(W * .635, true,  'rgba(16,185,129,.62)');

    // eagle
    drawEagle(S.eagleDraw, S.eagleAlpha);

    drawParticles();

    // vignette
    const vig = ctx.createRadialGradient(W/2, H/2, H*.28, W/2, H/2, H*.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,.5)');
    ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

    rafId = requestAnimationFrame(render);
  }
  rafId = requestAnimationFrame(render);

  /* ─────────────────────────────────────────
     6. GSAP MASTER TIMELINE
  ───────────────────────────────────────── */
  function setPhase(txt, pct) {
    const fill  = document.getElementById('op-phase-fill');
    const label = document.getElementById('op-phase-label');
    if (fill)  fill.style.width = pct + '%';
    if (label) {
      label.style.opacity = '0';
      setTimeout(() => { if(label) { label.textContent = txt; label.style.opacity = '1'; } }, 220);
    }
  }

  function countUp(id, target, suffix = '') {
    const el = document.getElementById(id);
    if (!el) return;
    gsap.to({ v: 0 }, {
      v: target, duration: 1.8, ease: 'power2.out',
      onUpdate() { el.innerHTML = Math.round(this.targets()[0].v) + suffix; }
    });
  }

  const tl = gsap.timeline({ delay: .9, defaults: { ease: 'power3.out' } });

  tl
    // atmosphere
    .to(S,          { starAlpha: .92, moonAlpha: 1, duration: 1.6, ease: 'power1.inOut' }, 0)
    .to('#op-phase-bar', { opacity: 1, duration: .5 }, .2)
    .add(() => setPhase('Trazando planos de obra…', 6), .4)

    // LEFT tower
    .to(S, { riseL: 1, dustAlpha: .85, duration: 1.9, ease: 'power2.inOut',
      onStart() { setPhase('Elevando torres laterales…', 22); }
    }, .65)

    // RIGHT tower (slight delay)
    .to(S, { riseR: 1, duration: 1.7, ease: 'power2.inOut' }, 1.1)

    // CENTER civic hall (majestic, slower)
    .to(S, { riseC: 1, duration: 2.4, ease: 'power2.inOut',
      onStart() { setPhase('Construyendo Palacio Municipal…', 44); }
    }, 1.85)

    // windows illuminate
    .to(S, { winAlpha: 1, duration: 1.1, ease: 'power1.inOut',
      onStart() { setPhase('Iluminando fachadas…', 62); }
    }, 3.1)

    // cranes deploy
    .to(S, { craneAlpha: 1, duration: .85, ease: 'back.out(1.8)',
      onStart() { setPhase('Desplegando grúas de construcción…', 70); }
    }, 3.7)

    // crane motion (infinite loop via repeat)
    .to(S, { trolleyX: 1, duration: 1.9, ease: 'sine.inOut', repeat: -1, yoyo: true }, 4.2)
    .to(S, { hookY:    1, duration: 2.3, ease: 'sine.inOut', repeat: -1, yoyo: true, repeatDelay: .4 }, 4.4)

    // eagle draw-on
    .to(S, { eagleDraw: 1, eagleAlpha: 1, dustAlpha: 0, duration: 2.6, ease: 'power1.inOut',
      onStart() { setPhase('Renderizando Escudo Nacional…', 82); }
    }, 5.1)

    // moon drift idle
    .to(S, { moonX: 678, moonY: 46, duration: 22, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 6.0)

    // HUD appears with counters
    .to('#op-hud', { opacity: 1, duration: .7, ease: 'power2.out',
      onStart() {
        setPhase('Sistema listo — Transparencia total', 100);
        countUp('hval-obras', 12);
        countUp('hval-roles', 4);
        countUp('hval-transp', 100, '<small>%</small>');
      }
    }, 7.2);

  /* ─────────────────────────────────────────
     7. CLEANUP
  ───────────────────────────────────────── */
  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(rafId);
    tl.kill();
  });

})();
