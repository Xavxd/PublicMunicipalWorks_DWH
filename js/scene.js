/**
 * OBRAS PÚBLICAS — Cinematic Construction Scene
 * GSAP Animation Engine
 * H. Ayuntamiento Temascaltepec · Estado de México
 *
 * NOTE: This script is purely additive. It does NOT
 * modify any logic in main.js (login, routing, session, etc.)
 */

(function () {
  'use strict';

  /* ── Guard: Only run if GSAP is available ── */
  if (typeof gsap === 'undefined') return;

  /* ── Phase text messages ── */
  const phases = [
    { pct: 0,   text: 'Iniciando construcción...' },
    { pct: 12,  text: 'Trazando cimentación...' },
    { pct: 25,  text: 'Izando estructura principal...' },
    { pct: 42,  text: 'Montando andamios...' },
    { pct: 58,  text: 'Elevando grúas de obra...' },
    { pct: 72,  text: 'Instalando ventanería...' },
    { pct: 86,  text: 'Terminado de fachadas...' },
    { pct: 96,  text: 'Obra entregada — transparencia total' },
  ];

  let phaseIdx = 0;

  function setPhase(pct) {
    const fill = document.getElementById('cine-progress');
    const pctEl = document.getElementById('phase-pct');
    const phaseEl = document.getElementById('phase-text');

    if (fill) fill.style.width = pct + '%';
    if (pctEl) pctEl.textContent = Math.round(pct) + '%';

    // Update phase text
    for (let i = phases.length - 1; i >= 0; i--) {
      if (pct >= phases[i].pct && i > phaseIdx) {
        phaseIdx = i;
        if (phaseEl) {
          phaseEl.style.opacity = '0';
          setTimeout(() => {
            phaseEl.textContent = phases[i].text;
            phaseEl.style.opacity = '1';
          }, 200);
        }
        break;
      }
    }
  }

  /* ── Main timeline ── */
  function buildScene() {
    const tl = gsap.timeline({
      delay: 0.6,
      defaults: { ease: 'power3.out' },
    });

    /* 0% — Ground line */
    tl.to('#ground-line', { opacity: 1, duration: 0.4 }, 0)
      .to({}, { duration: 0.1, onUpdate() { setPhase(2); } }, 0.1);

    /* Stars & moon fade in */
    tl.to('#stars', { opacity: 1, duration: 1.2, ease: 'power1.inOut' }, 0.2)
      .to('#moon', { opacity: 1, duration: 1.5, ease: 'power1.inOut' }, 0.4);

    /* 12% — Background buildings rise */
    tl.to('#bg-buildings', { opacity: 1, duration: 0.8 }, 0.5)
      .to({}, { duration: 0.05, onUpdate() { setPhase(12); } }, 0.5);

    /* 25% — Left building rises from ground */
    tl.to('#bm1', {
      attr: { y: 38, height: 282 },
      duration: 1.6,
      ease: 'power2.inOut',
      onUpdate() { setPhase(25); },
    }, 0.9);

    /* 38% — Right building rises */
    tl.to('#bm3', {
      attr: { y: 65, height: 255 },
      duration: 1.4,
      ease: 'power2.inOut',
    }, 1.6);

    /* 42% — Center building rises (slower, taller) */
    tl.to('#bm2', {
      attr: { y: -10, height: 330 },
      duration: 2.0,
      ease: 'power2.inOut',
      onUpdate() { setPhase(42); },
    }, 1.9);

    /* 50% — Ground glow appears */
    tl.to('#ground-glow', { opacity: 1, duration: 1, ease: 'power1.inOut' }, 2.2);

    /* 58% — Scaffolding appears */
    tl.to('#scaffolding', {
      opacity: 1,
      duration: 0.8,
      ease: 'power1.out',
      onStart() { setPhase(58); },
    }, 2.6);

    /* 60% — Left crane swings in from left */
    tl.fromTo('#crane-left',
      { opacity: 0, x: -40 },
      { opacity: 1, x: 0, duration: 0.9, ease: 'back.out(1.4)', onStart() { setPhase(60); } },
      2.9
    );

    /* 65% — Right crane swings in from right */
    tl.fromTo('#crane-right',
      { opacity: 0, x: 40 },
      { opacity: 1, x: 0, duration: 0.9, ease: 'back.out(1.4)' },
      3.2
    );

    /* Roof lights pop on */
    tl.to('#light-left', { opacity: 1, duration: 0.3 }, 3.6)
      .to('#light-right', { opacity: 1, duration: 0.3 }, 3.7)
      .to('#light-top', { opacity: 1, duration: 0.5 }, 3.8);

    /* 72% — Crane trolleys slide */
    tl.to('#crane-trolley-l', {
      attr: { x: 240 },
      duration: 2.0,
      ease: 'power1.inOut',
      onUpdate() { setPhase(72); },
      repeat: -1,
      yoyo: true,
      repeatDelay: 1.5,
    }, 4.0);

    tl.to('#crane-trolley-r', {
      attr: { x: 550 },
      duration: 1.8,
      ease: 'power1.inOut',
      repeat: -1,
      yoyo: true,
      repeatDelay: 2,
    }, 4.3);

    /* 86% — Eagle emblem rises */
    tl.fromTo('#eagle-emblem',
      { opacity: 0, scaleY: 0.3, transformOrigin: '450px 295px' },
      {
        opacity: 0.85,
        scaleY: 1,
        duration: 1.4,
        ease: 'elastic.out(1, 0.6)',
        onStart() { setPhase(86); },
        onComplete() {
          const el = document.getElementById('eagle-emblem');
          if (el) el.classList.add('glowing');
        },
      },
      5.2
    );

    /* Labels fade in staggered */
    tl.to('#label-1', { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 5.4)
      .to('#label-2', { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 5.6)
      .to('#label-3', { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 5.8);

    /* 96% — Final phase */
    tl.to({}, {
      duration: 0.1,
      onStart() { setPhase(96); },
    }, 6.0);

    /* Completion: 100% */
    tl.to({}, {
      duration: 0.1,
      onStart() { setPhase(100); },
    }, 6.8);

    /* ── Idle loop: subtle building breathing + flag wave ── */
    tl.add(() => {
      /* Building subtle parallax float */
      gsap.to('#bld-center', {
        y: -4,
        duration: 6,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });

      gsap.to('#bld-left', {
        y: -2.5,
        duration: 7,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: 1,
      });

      gsap.to('#bld-right', {
        y: -3,
        duration: 5.5,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: 2,
      });

      /* Flag wave */
      gsap.to('#flag-green, #flag-white, #flag-red', {
        skewX: 8,
        transformOrigin: 'left center',
        duration: 1.2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        stagger: 0.05,
      });

      /* Eagle gentle pulse (opacity) */
      gsap.to('#eagle-emblem', {
        opacity: 0.6,
        duration: 3.5,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });

      /* Moon slow drift */
      gsap.to('#moon', {
        x: 5,
        y: -3,
        duration: 12,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });

      /* Stars twinkle */
      gsap.to('#stars circle', {
        opacity: 0.05,
        duration: 2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        stagger: { each: 0.4, from: 'random' },
      });
    }, 6.9);
  }

  /* ── Run when DOM is ready ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildScene);
  } else {
    buildScene();
  }

})();
