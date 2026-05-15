const cursor = document.getElementById('cursor');
const follower = document.getElementById('cursor-follower');
let mouseX = 0, mouseY = 0;
let followerX = 0, followerY = 0;

if (cursor && follower) {
  cursor.style.pointerEvents = 'none';
  follower.style.pointerEvents = 'none';
  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursor.style.left = mouseX + 'px';
    cursor.style.top = mouseY + 'px';
  });
  const animateFollower = () => {
    followerX += (mouseX - followerX) * 0.12;
    followerY += (mouseY - followerY) * 0.12;
    follower.style.left = followerX + 'px';
    follower.style.top = followerY + 'px';
    requestAnimationFrame(animateFollower);
  };
  animateFollower();
  document.querySelectorAll('button, a, .role-card').forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor.style.transform = 'translate(-50%,-50%) scale(2)';
      follower.style.transform = 'translate(-50%,-50%) scale(1.5)';
      follower.style.opacity = '0.5';
    });
    el.addEventListener('mouseleave', () => {
      cursor.style.transform = 'translate(-50%,-50%) scale(1)';
      follower.style.transform = 'translate(-50%,-50%) scale(1)';
      follower.style.opacity = '1';
    });
  });
}

const dateEl = document.getElementById('current-date');
if (dateEl) {
  const d = new Date();
  dateEl.textContent = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

const countEls = document.querySelectorAll('.stat-num[data-target]');
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = parseInt(el.dataset.target);
    let current = 0;
    const step = target / 40;
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = Math.floor(current);
      if (current >= target) clearInterval(timer);
    }, 30);
    observer.unobserve(el);
  });
}, { threshold: 0.5 });
countEls.forEach(el => observer.observe(el));

const roleConfig = {
  Director: {
    icon: '🏛️',
    tag: 'Nivel Directivo',
    name: 'Director de Obras',
    color: '#3b82f6',
    redirect: 'director/director.html'
  },
  Supervisor: {
    icon: '📋',
    tag: 'Nivel Operativo',
    name: 'Supervisor de Obra',
    color: '#10b981',
    redirect: 'supervisor/supervisor.html'
  },
  Proyectista: {
    icon: '📐',
    tag: 'Nivel Técnico',
    name: 'Proyectista',
    color: '#f59e0b',
    redirect: 'proyectista/proyectista.html'
  },
  Secretario: {
    icon: '📄',
    tag: 'Nivel Administrativo',
    name: 'Secretaría',
    color: '#8b5cf6',
    redirect: 'secretaria/secretaria.html'
  }
};

let currentRole = null;

function openLogin(role) {
  currentRole = role;
  const config = roleConfig[role];
  document.getElementById('modal-role-icon').textContent = config.icon;
  document.getElementById('modal-role-tag').textContent = config.tag;
  document.getElementById('modal-role-name').textContent = config.name;
  document.getElementById('login-submit').style.background = config.color;
  document.getElementById('login-error').textContent = '';
  document.getElementById('modal-login-user').value = '';
  document.getElementById('modal-login-pass').value = '';
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.add('active');
    setTimeout(() => document.getElementById('modal-login-user').focus(), 300);
  }
}

function closeLogin(event) {
  if (event && event.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.remove('active');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLogin({ target: document.getElementById('modal-overlay') });
  if (e.key === 'Enter' && document.getElementById('modal-overlay').classList.contains('active')) handleLogin();
});

function togglePass() {
  const input = document.getElementById('modal-login-pass');
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function handleLogin() {
  if (document.getElementById('login-submit').classList.contains('loading')) return;
  
  const user = document.getElementById('modal-login-user').value.trim();
  const pass = document.getElementById('modal-login-pass').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-submit');

  if (!user || !pass) {
    errEl.textContent = 'Por favor completa todos los campos.';
    shake(btn);
    return;
  }

  btn.classList.add('loading');
  errEl.textContent = '';

  try {
    const response = await loginUser(user, pass, currentRole);

    btn.classList.remove('loading');

    if (response.success && response.data) {
      showToast(`Bienvenido, ${response.data.nombre}`);
      
      setTimeout(() => {
        window.location.href = roleConfig[currentRole].redirect;
      }, 800);
    } 
  } catch (err) {
    btn.classList.remove('loading');
    
    errEl.textContent = err.message || 'Error de conexión con el servidor.';
    shake(btn);
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function shake(el) {
  el.style.animation = 'shake 0.4s ease';
  setTimeout(() => el.style.animation = '', 400);
}

const style = document.createElement('style');
style.textContent = `
  .noise-overlay, #cursor, #cursor-follower { pointer-events: none !important; }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
`;
document.head.appendChild(style);

function showToast(message) {
  let toast = document.querySelector('.success-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.innerHTML = `<span class="toast-icon">✓</span><span class="toast-msg"></span>`;
    document.body.appendChild(toast);
  }
  toast.querySelector('.toast-msg').textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

async function loginUser(username, password, role) {
  
  const response = await fetch('https://backend-obraspublicas.onrender.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role })
  });
  
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Error de acceso');

  sessionStorage.setItem('op_user', JSON.stringify({
    id: result.data.id,
    role: role,
    nombre: result.data.nombre,
    username: result.data.username
  }));

  localStorage.setItem('user_id', result.data.id);
  localStorage.setItem('user_role', role);
  localStorage.setItem('user_name', result.data.nombre);
  
  return result;
}

/* ═══════════════════════════════════════════════
   NEW: SCROLL BLUR + CONSTRUCTION ANIMATIONS
   ═══════════════════════════════════════════════ */

/* ── 1. SCROLL-DRIVEN HERO BLUR ── */
function initScrollBlur() {
  const hero = document.querySelector('.hero');
  const heroContent = document.querySelector('.hero-content');
  const cableBg = document.getElementById('hero-cable-bg');
  if (!hero || !heroContent) return;

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const heroHeight = hero.offsetHeight;
    const progress = Math.min(scrollY / (heroHeight * 0.5), 1);

    const blur = progress * 10;
    const opacity = 1 - progress * 0.65;
    const translate = progress * 40;

    heroContent.style.filter = `blur(${blur}px)`;
    heroContent.style.opacity = opacity;
    heroContent.style.transform = `translateY(${translate}px)`;

    if (cableBg) {
      cableBg.style.opacity = 1 - progress;
      cableBg.style.filter = `blur(${progress * 4}px)`;
    }
  }, { passive: true });
}

function initTitleAnimation() {
  const lines = document.querySelectorAll('.title-line');
  lines.forEach(line => {
    const text = line.textContent;
    line.innerHTML = '';
    text.split('').forEach(char => {
      const span = document.createElement('span');
      span.className = 'char';
      span.textContent = char === ' ' ? '\u00A0' : char;
      // ← AÑADE ESTO: visible por defecto, GSAP lo overridea si está disponible
      span.style.opacity = '1';
      span.style.transform = 'none';
      line.appendChild(span);
    });
  });

  if (typeof gsap !== 'undefined') {
    gsap.from('.title-line .char', {
      y: () => gsap.utils.random(-180, -80),
      x: () => gsap.utils.random(-60, 60),
      rotation: () => gsap.utils.random(-60, 60),
      opacity: 0,
      duration: 1.6,
      ease: "power4.out",
      stagger: { amount: 1, from: "random" },
      delay: 0.3
    });
  }
}

/* ── 3. CONSTRUCTION SCROLL REVEALS (GSAP) ── */
function initConstructionReveals() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  // Role cards: assemble into place like steel modules
  gsap.from('.role-card', {
    scrollTrigger: {
      trigger: '.roles-grid',
      start: 'top 85%',
    },
    y: 120,
    opacity: 0,
    rotationX: 25,
    scale: 0.85,
    transformOrigin: "center bottom",
    duration: 1.2,
    stagger: 0.12,
    ease: "power3.out"
  });

  // Section header
  gsap.from('.section-header > *', {
    scrollTrigger: { trigger: '.section-header', start: 'top 80%' },
    y: 50,
    opacity: 0,
    filter: 'blur(10px)',
    stagger: 0.1,
    duration: 1,
    ease: "power2.out"
  });

  // Arch strip items
  gsap.from('.arch-item', {
    scrollTrigger: { trigger: '.arch-strip', start: 'top 90%' },
    y: 30,
    opacity: 0,
    stagger: 0.08,
    duration: 0.8,
    ease: "power2.out"
  });
}

/* ── 4. 3D TILT ON ROLE CARDS ── */
function initCardTilt() {
  document.querySelectorAll('.role-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      card.style.transform = `perspective(1000px) rotateY(${dx * 10}deg) rotateX(${-dy * 10}deg) translateZ(12px) scale(1.02)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

/* ── 5. FLOATING PARTICLES ── */
function initParticles() {
  const container = document.getElementById('hero-particles');
  if (!container) return;
  for (let i = 0; i < 24; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 3 + 1;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = Math.random() * 100 + '%';
    p.style.top = Math.random() * 100 + '%';
    p.style.animationDelay = Math.random() * 15 + 's';
    p.style.animationDuration = (12 + Math.random() * 12) + 's';
    if (Math.random() > 0.7) {
      p.style.background = 'rgba(6,182,212,0.4)';
    }
    container.appendChild(p);
  }
}

/* ── INIT ALL ── */
document.addEventListener('DOMContentLoaded', () => {
  initScrollBlur();
  initTitleAnimation();
  initConstructionReveals();
  initCardTilt();
  initParticles();
});
