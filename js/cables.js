/**
 * OBRAS PÚBLICAS — Cable Light Animation
 * Efecto: luz que recorre cables/circuitos (adaptado de efectoazul.html)
 * Paleta: azul marino #3b82f6, #0ea5e9, destellos teal
 * Completamente aislado de main.js — no modifica login ni routing.
 */
(function () {
  'use strict';

  /* ── Canvas setup ── */
  const container = document.getElementById('hero-cable-bg');
  if (!container) return;

  const canvas = document.getElementById('cable-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    const w = container.offsetWidth;
    const h = container.offsetHeight;
    canvas.width  = w * DPR;
    canvas.height = h * DPR;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(DPR, DPR);
    buildNetwork();
  }

  let W = 0, H = 0;

  /* ─────────────────────────────────
     NETWORK DEFINITION
     Nodes + directed edges (cables)
  ───────────────────────────────── */
  let nodes = [];
  let edges = [];
  let pulses = [];

  function buildNetwork() {
    W = container.offsetWidth;
    H = container.offsetHeight;

    // Generate nodes that feel like circuit board points
    const cols = 9, rows = 7;
    nodes = [];

    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        // Add slight organic offset so it doesn't look like a rigid grid
        const jx = (Math.random() - 0.5) * (W / cols) * 0.4;
        const jy = (Math.random() - 0.5) * (H / rows) * 0.4;
        nodes.push({
          x: (c / cols) * W + jx,
          y: (r / rows) * H + jy,
          active: false,
          pulseTime: 0,
        });
      }
    }

    // Connect edges — only horizontal and vertical (circuit board aesthetic)
    edges = [];
    const stride = cols + 1;

    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const idx = r * stride + c;
        // right
        if (c < cols && Math.random() > 0.25) {
          edges.push({ from: idx, to: idx + 1, len: dist(nodes[idx], nodes[idx + 1]) });
        }
        // down
        if (r < rows && Math.random() > 0.25) {
          edges.push({ from: idx, to: idx + stride, len: dist(nodes[idx], nodes[idx + stride]) });
        }
        // diagonal (sparse — adds circuit complexity)
        if (c < cols && r < rows && Math.random() > 0.82) {
          edges.push({ from: idx, to: idx + stride + 1, len: dist(nodes[idx], nodes[idx + stride + 1]) });
        }
      }
    }

    pulses = [];
  }

  function dist(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  /* ─────────────────────────────────
     PULSE SYSTEM
  ───────────────────────────────── */
  const PULSE_SPEED  = 140; // px/sec
  const SPAWN_INTERVAL = 280; // ms between new pulses
  let lastSpawn = 0;

  // Color palette — azul marino adapted
  const PULSE_COLORS = [
    { r: 59,  g: 130, b: 246 }, // blue #3b82f6
    { r: 14,  g: 165, b: 233 }, // sky #0ea5e9
    { r: 96,  g: 165, b: 250 }, // blue-400
    { r: 6,   g: 182, b: 212 }, // cyan #06b6d4
    { r: 16,  g: 185, b: 129 }, // emerald (accent)
  ];

  function spawnPulse() {
    // Pick a random edge to start from
    if (edges.length === 0) return;
    const edge = edges[Math.floor(Math.random() * edges.length)];
    const color = PULSE_COLORS[Math.floor(Math.random() * PULSE_COLORS.length)];

    pulses.push({
      edgeIdx: edges.indexOf(edge),
      t: 0,           // 0 → 1 along the edge
      speed: PULSE_SPEED,
      color,
      alpha: 1,
      trail: [],      // past positions for tail effect
      size: Math.random() * 2 + 1.5,
    });
  }

  /* ─────────────────────────────────
     RENDER
  ───────────────────────────────── */
  function drawBase() {
    // Background — transparent (lets hero orbs/gradient show)
    ctx.clearRect(0, 0, W, H);

    // ── Draw edges (inactive wire state) ──
    ctx.save();
    for (const e of edges) {
      const a = nodes[e.from];
      const b = nodes[e.to];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = 'rgba(30, 58, 100, 0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();

    // ── Draw nodes (junction points) ──
    ctx.save();
    for (const n of nodes) {
      if (n.active) {
        // glowing node
        const t = Date.now() / 1000;
        const pulse = Math.sin(t * 4 + n.x * 0.02) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.5 + pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59, 130, 246, ${0.3 + pulse * 0.4})`;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(30, 58, 100, 0.5)';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawPulses(dt) {
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      const e = edges[p.edgeIdx];
      if (!e) { pulses.splice(i, 1); continue; }

      const a = nodes[e.from];
      const b = nodes[e.to];

      // Advance
      p.t += (p.speed / e.len) * dt;

      // Current position
      const px = a.x + (b.x - a.x) * Math.min(p.t, 1);
      const py = a.y + (b.y - a.y) * Math.min(p.t, 1);

      // Trail
      p.trail.push({ x: px, y: py, alpha: p.alpha });
      if (p.trail.length > 22) p.trail.shift();

      // Draw trail (luminous tail)
      ctx.save();
      for (let ti = 0; ti < p.trail.length; ti++) {
        const tp = p.trail[ti];
        const progress = ti / p.trail.length;
        const trailAlpha = progress * p.alpha * 0.6;
        const r = p.size * progress * 0.7;
        if (r < 0.1) continue;

        // Glow
        const grd = ctx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, r * 4);
        grd.addColorStop(0, `rgba(${p.color.r},${p.color.g},${p.color.b},${trailAlpha * 0.7})`);
        grd.addColorStop(1, `rgba(${p.color.r},${p.color.g},${p.color.b},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, r * 4, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.fillStyle = `rgba(${p.color.r},${p.color.g},${p.color.b},${trailAlpha * 1.6})`;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw head (bright)
      const headGrd = ctx.createRadialGradient(px, py, 0, px, py, p.size * 7);
      headGrd.addColorStop(0, `rgba(${p.color.r},${p.color.g},${p.color.b},${p.alpha * 0.9})`);
      headGrd.addColorStop(0.3, `rgba(${p.color.r},${p.color.g},${p.color.b},${p.alpha * 0.4})`);
      headGrd.addColorStop(1, `rgba(${p.color.r},${p.color.g},${p.color.b},0)`);
      ctx.fillStyle = headGrd;
      ctx.beginPath();
      ctx.arc(px, py, p.size * 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(200, 230, 255, ${p.alpha * 0.95})`;
      ctx.beginPath();
      ctx.arc(px, py, p.size * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Activate destination node when pulse arrives
      if (p.t >= 1) {
        nodes[e.to].active = true;
        nodes[e.to].pulseTime = Date.now();

        // Spawn 0-2 child pulses from destination node
        const children = Math.floor(Math.random() * 2);
        for (let ci = 0; ci < children; ci++) {
          // Find outgoing edges from destination
          const outgoing = edges.filter((oe, oi) => oe.from === e.to);
          if (outgoing.length) {
            const next = outgoing[Math.floor(Math.random() * outgoing.length)];
            pulses.push({
              edgeIdx: edges.indexOf(next),
              t: 0,
              speed: p.speed * (0.85 + Math.random() * 0.3),
              color: PULSE_COLORS[Math.floor(Math.random() * PULSE_COLORS.length)],
              alpha: p.alpha * 0.75,
              trail: [],
              size: p.size * 0.9,
            });
          }
        }

        pulses.splice(i, 1);
      }
    }

    // Deactivate nodes over time
    const now = Date.now();
    for (const n of nodes) {
      if (n.active && now - n.pulseTime > 2800) {
        n.active = false;
      }
    }
  }

  // Ray-shift background (from efectoazul.html — sweeping light bands)
  let rayT = 0;
  function drawRayShift(dt) {
    rayT += dt * 0.06;
    const shift = Math.sin(rayT) * 0.3;

    ctx.save();
    ctx.globalAlpha = 0.04;

    // Primary ray band (blue)
    const rayGrd = ctx.createLinearGradient(
      W * (0.5 + shift), 0,
      W * (0.5 + shift + 0.12), H
    );
    rayGrd.addColorStop(0, 'rgba(0,0,0,0)');
    rayGrd.addColorStop(0.45, 'rgba(30,58,138,0)');
    rayGrd.addColorStop(0.48, 'rgba(59,130,246,0.6)');
    rayGrd.addColorStop(0.5,  'rgba(96,165,250,1)');
    rayGrd.addColorStop(0.52, 'rgba(59,130,246,0.6)');
    rayGrd.addColorStop(0.55, 'rgba(30,58,138,0)');
    rayGrd.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = rayGrd;
    ctx.fillRect(0, 0, W, H);

    // Secondary ray band (cyan)
    const ray2 = Math.sin(rayT * 0.7 + 1.5) * 0.25;
    const rayGrd2 = ctx.createLinearGradient(
      W * (0.3 + ray2), 0,
      W * (0.3 + ray2 + 0.08), H
    );
    rayGrd2.addColorStop(0, 'rgba(0,0,0,0)');
    rayGrd2.addColorStop(0.46, 'rgba(6,182,212,0)');
    rayGrd2.addColorStop(0.5,  'rgba(6,182,212,0.4)');
    rayGrd2.addColorStop(0.54, 'rgba(6,182,212,0)');
    rayGrd2.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = rayGrd2;
    ctx.fillRect(0, 0, W, H);

    ctx.restore();
  }

  /* ─────────────────────────────────
     MAIN LOOP
  ───────────────────────────────── */
  let lastTime = 0;
  let rafId;

  function loop(ts) {
    const dt = Math.min((ts - lastTime) / 1000, 0.05); // cap at 50ms
    lastTime = ts;

    // Respawn check
    if (ts - lastSpawn > SPAWN_INTERVAL) {
      const count = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < count; i++) spawnPulse();
      lastSpawn = ts;
    }

    drawBase();
    drawRayShift(dt);
    drawPulses(dt);

    rafId = requestAnimationFrame(loop);
  }

  /* ─────────────────────────────────
     SCROLL REVEAL SYSTEM
  ───────────────────────────────── */
  function initScrollReveal() {
    // Add scroll-reveal to role cards and section headers
    document.querySelectorAll('.role-card').forEach(el => {
      el.classList.add('scroll-reveal');
    });
    document.querySelectorAll('.section-header').forEach(el => {
      el.classList.add('scroll-reveal');
    });
    document.querySelectorAll('.arch-item').forEach((el, i) => {
      el.style.transitionDelay = (i * 0.07) + 's';
      el.classList.add('scroll-reveal');
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          // Section headers use their own class
          if (entry.target.classList.contains('section-header')) {
            entry.target.classList.add('is-visible');
          }
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px',
    });

    document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
  }

  /* ─────────────────────────────────
     INIT
  ───────────────────────────────── */
  window.addEventListener('resize', () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    resize();
  });

  resize();
  requestAnimationFrame(ts => {
    lastTime = ts;
    rafId = requestAnimationFrame(loop);
  });

  // Init scroll reveal after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollReveal);
  } else {
    initScrollReveal();
  }

  // Cleanup
  window.addEventListener('beforeunload', () => cancelAnimationFrame(rafId));

})();
