
// --- CUSTOM CURSOR ---
const API_BASE = window.API_BASE || "https://backend-obraspublicas.onrender.com";
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

// --- DATE ---
const dateEl = document.getElementById('current-date');
if (dateEl) {
  const d = new Date();
  dateEl.textContent = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

// --- COUNTER ANIMATION ---
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

// --- LOGIN MODAL ---
const roleConfig = {
  director: {
    icon: '🏛️',
    tag: 'Nivel Directivo',
    name: 'Director de Obras',
    color: '#3b82f6',
    redirect: 'director/director.html'
  },
  supervisor: {
    icon: '📋',
    tag: 'Nivel Operativo',
    name: 'Supervisor de Obra',
    color: '#10b981',
    redirect: 'supervisor/supervisor.html'
  },
  proyectista: {
    icon: '📐',
    tag: 'Nivel Técnico',
    name: 'Proyectista',
    color: '#f59e0b',
    redirect: 'proyectista/proyectista.html'
  },
  secretaria: {
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

  // Simulated auth — replace with real API call
  await delay(900);

  const mockUsers = {
    director: [{ user: 'dir_obras', pass: 'admin123', id: 'D001', nombre: 'Ing. Director' }],
    supervisor: [{ user: 'sup_001', pass: 'super123', id: 'S001', nombre: 'Uriel González' }],
    proyectista: [{ user: 'pro_001', pass: 'proy123', id: 'P001', nombre: 'Arq. Proyectista' }],
    secretaria: [{ user: 'sec_001', pass: 'sec123', id: 'SEC001', nombre: 'Secretaría Admin' }]
  };

  const validUser = (mockUsers[currentRole] || []).find(u => u.user === user && u.pass === pass);

  btn.classList.remove('loading');

  if (validUser) {
    sessionStorage.setItem('op_user', JSON.stringify({
  role: currentRole,
  id: validUser.id,
  nombre: validUser.nombre,
  username: validUser.user
}));
window.location.href = roleConfig[currentRole].redirect;
  } else {
    errEl.textContent = 'Usuario o contraseña incorrectos.';
    shake(btn);
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function shake(el) {
  el.style.animation = 'shake 0.4s ease';
  setTimeout(() => el.style.animation = '', 400);
}

// Add shake keyframe
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

// --- UTILITY: Show Toast ---
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
