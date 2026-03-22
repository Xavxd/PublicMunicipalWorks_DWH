// =============================================
// SECRETARÍA — Gestión Documental
// Oficios de Permisos + Actas de Entrega
// =============================================

// Auth guard
const user = JSON.parse(sessionStorage.getItem('op_user') || 'null');
if (!user || user.role !== 'secretaria') {
  window.location.href = '../index.html';
}

// User badge
document.querySelectorAll('.user-name').forEach(el => el.textContent = user?.nombre || user?.username);
document.querySelectorAll('.user-id').forEach(el => el.textContent = user?.id || '');

// Patch accent color to secretaria purple
document.documentElement.style.setProperty('--accent', '#8b5cf6');

// ---- DATA LAYER ----
const getData = key => JSON.parse(localStorage.getItem(key) || '[]');
const setData = (key, val) => localStorage.setItem(key, JSON.stringify(val));

// Mock obras for selects
const mockObras = [
  { id: 'OBR-001', nombre: 'Puente Peatonal — Cabecera Municipal' },
  { id: 'OBR-002', nombre: 'Pavimento Hidráulico — Albarranes' },
  { id: 'OBR-003', nombre: 'Red de Agua Potable — San Francisco' },
  { id: 'OBR-004', nombre: 'Adoquinamiento — Telpintla' },
  ...getData('op_obras').map(o => ({ id: o.id, nombre: o.nombre }))
];

// Deduplicate
const obraMap = new Map();
mockObras.forEach(o => obraMap.set(o.id, o));
const OBRAS = Array.from(obraMap.values());

// ---- TABS ----
function switchTab(tabId) {
  document.querySelectorAll('.doc-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  document.getElementById(tabId).classList.add('active');
}
document.querySelectorAll('.doc-tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ---- POPULATE OBRA SELECTS ----
function populateObraSelects() {
  document.querySelectorAll('.obra-select').forEach(sel => {
    const current = sel.value;
    sel.innerHTML = '<option value="">— Seleccionar obra —</option>';
    OBRAS.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = `${o.id} · ${o.nombre}`;
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  });
}
populateObraSelects();

// ---- STATS ----
function updateStats() {
  const permisos = getData('op_permisos');
  const actas = getData('op_actas');
  document.getElementById('stat-permisos').textContent = permisos.length;
  document.getElementById('stat-actas').textContent = actas.length;
}
updateStats();

// ============================================
// PERMISOS
// ============================================

const INSTANCIAS_KNOWN = ['CFE','CONAGUA','SCT','SEMARNAT','INAH','IMSS','Municipio','Otra'];

function buildPermisosForm() {
  const instanciaGrid = document.getElementById('instancia-grid');
  if (!instanciaGrid) return;
  instanciaGrid.innerHTML = INSTANCIAS_KNOWN.map((inst, i) => `
    <div class="instancia-chip">
      <input type="radio" name="instancia_chip" id="ic_${i}" value="${inst}" />
      <label for="ic_${i}">
        <span class="chip-icon">${instanciaIcon(inst)}</span>
        ${inst}
      </label>
    </div>
  `).join('');

  instanciaGrid.querySelectorAll('input[type=radio]').forEach(radio => {
    radio.addEventListener('change', () => {
      const otraWrap = document.getElementById('otra-instancia-wrap');
      if (otraWrap) otraWrap.style.display = radio.value === 'Otra' ? 'block' : 'none';
    });
  });
}
buildPermisosForm();

function instanciaIcon(inst) {
  const map = { CFE:'⚡', CONAGUA:'💧', SCT:'🛤️', SEMARNAT:'🌿', INAH:'🏛️', IMSS:'🏥', Municipio:'🏢', Otra:'📋' };
  return map[inst] || '📋';
}

function submitPermiso() {
  const obraId = document.getElementById('perm-obra').value;
  const checked = document.querySelector('input[name="instancia_chip"]:checked');
  const instancia = checked ? (checked.value === 'Otra'
    ? document.getElementById('otra-instancia')?.value?.trim()
    : checked.value) : '';
  const oficio = document.getElementById('perm-oficio').value.trim();
  const desc = document.getElementById('perm-desc').value.trim();
  const fecha = document.getElementById('perm-fecha').value;

  if (!obraId || !instancia || !oficio) {
    showToast('Completa los campos obligatorios: Obra, Instancia y Oficio.', 'error');
    return;
  }

  const permisos = getData('op_permisos');
  const id = `PRM-${String(permisos.length + 1).padStart(3,'0')}`;
  const obra = OBRAS.find(o => o.id === obraId);
  permisos.push({
    id, obraId,
    obraNombre: obra?.nombre || obraId,
    instancia, oficio, desc, fecha,
    creadoEn: new Date().toISOString(),
    creadoPor: user.id
  });
  setData('op_permisos', permisos);

  // Reset
  document.getElementById('form-permisos').reset();
  document.querySelectorAll('.instancia-chip input').forEach(r => r.checked = false);
  const otraWrap = document.getElementById('otra-instancia-wrap');
  if (otraWrap) otraWrap.style.display = 'none';

  renderPermisosList();
  updateStats();
  showToast(`✓ Permiso ${id} registrado correctamente.`);
}

function renderPermisosList(filter = '') {
  const list = document.getElementById('permisos-list');
  if (!list) return;
  const permisos = getData('op_permisos').filter(p =>
    !filter || p.oficio.toLowerCase().includes(filter) ||
    p.instancia.toLowerCase().includes(filter) ||
    p.obraNombre.toLowerCase().includes(filter)
  );
  if (!permisos.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">📄</div>
      <div class="empty-state-text">Aún no hay oficios registrados</div>
    </div>`;
    return;
  }
  list.innerHTML = permisos.slice().reverse().map((p, i) => `
    <div class="doc-card" style="animation-delay:${i*0.04}s">
      <div class="doc-card-icon">${instanciaIcon(p.instancia)}</div>
      <div class="doc-card-body">
        <div class="doc-card-num">${p.id} · ${p.fecha || '—'}</div>
        <div class="doc-card-title">${p.oficio}</div>
        <div class="doc-card-meta">
          <span>🏢 ${p.instancia}</span>
          <span>📍 ${p.obraNombre}</span>
        </div>
        ${p.desc ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:5px;">${p.desc}</div>` : ''}
      </div>
      <div class="doc-card-actions">
        <span class="badge-status badge-active">Registrado</span>
        <button class="btn-icon-sm" onclick="deletePermiso('${p.id}')" title="Eliminar">
          <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}
renderPermisosList();

function deletePermiso(id) {
  if (!confirm('¿Eliminar este oficio de permiso?')) return;
  setData('op_permisos', getData('op_permisos').filter(p => p.id !== id));
  renderPermisosList();
  updateStats();
  showToast('Oficio eliminado.');
}

document.getElementById('search-permisos')?.addEventListener('input', e => {
  renderPermisosList(e.target.value.toLowerCase().trim());
});

// ============================================
// ACTAS DE ENTREGA
// ============================================

const FIRMANTE_ROLES = [
  { key: 'delegado', cargo: 'Delegado / Rep. de Beneficiarios' },
  { key: 'constructora', cargo: 'Representante de la Constructora' },
  { key: 'presidente', cargo: 'Presidente Municipal' },
  { key: 'director', cargo: 'Director de Obras Públicas' },
  { key: 'contralor', cargo: 'Contralor' },
];

function buildFirmantesForm() {
  const container = document.getElementById('firmantes-container');
  if (!container) return;
  container.innerHTML = FIRMANTE_ROLES.map(fr => `
    <div class="firmante-row" id="firmante-${fr.key}">
      <span class="firmante-cargo">${fr.cargo}</span>
      <input type="text" id="f-nombre-${fr.key}" placeholder="Nombre(s)" />
      <input type="text" id="f-apellido-p-${fr.key}" placeholder="Apellido Paterno" />
      <input type="text" id="f-apellido-m-${fr.key}" placeholder="Apellido Materno" />
    </div>
  `).join('');
}
buildFirmantesForm();

function submitActa() {
  const obraId = document.getElementById('acta-obra').value;
  const fecha = document.getElementById('acta-fecha').value;
  const numActa = document.getElementById('acta-numero').value.trim();
  const obs = document.getElementById('acta-obs').value.trim();

  if (!obraId || !fecha) {
    showToast('Selecciona la obra y la fecha de expedición.', 'error');
    return;
  }

  // Collect firmantes
  const firmantes = FIRMANTE_ROLES.map(fr => ({
    cargo: fr.cargo,
    nombre: document.getElementById(`f-nombre-${fr.key}`)?.value?.trim() || '',
    apellidoP: document.getElementById(`f-apellido-p-${fr.key}`)?.value?.trim() || '',
    apellidoM: document.getElementById(`f-apellido-m-${fr.key}`)?.value?.trim() || '',
  }));

  // Validate at least 3 firmantes complete
  const completeFirmantes = firmantes.filter(f => f.nombre && f.apellidoP);
  if (completeFirmantes.length < 3) {
    showToast('Registra al menos 3 firmantes (nombre y apellido paterno).', 'error');
    return;
  }

  const actas = getData('op_actas');
  const id = numActa || `ACT-${String(actas.length + 1).padStart(3,'0')}`;
  const obra = OBRAS.find(o => o.id === obraId);
  actas.push({
    id, obraId,
    obraNombre: obra?.nombre || obraId,
    fecha, obs, firmantes,
    creadoEn: new Date().toISOString(),
    creadoPor: user.id
  });
  setData('op_actas', actas);

  document.getElementById('form-acta').reset();
  buildFirmantesForm();
  renderActasList();
  updateStats();
  showToast(`✓ Acta de Entrega ${id} registrada correctamente.`);
}

function renderActasList(filter = '') {
  const list = document.getElementById('actas-list');
  if (!list) return;
  const actas = getData('op_actas').filter(a =>
    !filter || a.id.toLowerCase().includes(filter) ||
    a.obraNombre.toLowerCase().includes(filter)
  );
  if (!actas.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">📜</div>
      <div class="empty-state-text">Aún no hay actas de entrega registradas</div>
    </div>`;
    return;
  }
  list.innerHTML = actas.slice().reverse().map((a, i) => `
    <div class="doc-card" style="animation-delay:${i*0.04}s">
      <div class="doc-card-icon">📜</div>
      <div class="doc-card-body">
        <div class="doc-card-num">${a.id} · ${a.fecha}</div>
        <div class="doc-card-title">${a.obraNombre}</div>
        <div class="doc-card-meta">
          <span>✍️ ${a.firmantes.filter(f => f.nombre).length} firmantes</span>
          ${a.obs ? `<span>📝 ${a.obs.slice(0,40)}…</span>` : ''}
        </div>
        <div class="acta-preview" style="margin-top:8px;padding:8px 10px;">
          <div class="acta-preview-title">Firmantes registrados</div>
          <div class="acta-firmantes-preview">
            ${a.firmantes.filter(f => f.nombre).map(f => `
              <div class="firmante-preview-row">
                <span class="firmante-preview-cargo">${f.cargo}</span>
                <span class="firmante-preview-name">${f.nombre} ${f.apellidoP} ${f.apellidoM}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="doc-card-actions">
        <span class="badge-status badge-closed">Cerrada</span>
        <button class="btn-icon-sm" onclick="deleteActa('${a.id}')" title="Eliminar">
          <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}
renderActasList();

function deleteActa(id) {
  if (!confirm('¿Eliminar esta acta de entrega?')) return;
  setData('op_actas', getData('op_actas').filter(a => a.id !== id));
  renderActasList();
  updateStats();
  showToast('Acta eliminada.');
}

document.getElementById('search-actas')?.addEventListener('input', e => {
  renderActasList(e.target.value.toLowerCase().trim());
});

// ---- CUSTOM CURSOR ----
const cursor = document.getElementById('cursor');
const follower = document.getElementById('cursor-follower');
if (cursor && follower) {
  let mx=0,my=0,fx=0,fy=0;
  document.addEventListener('mousemove', e => { mx=e.clientX; my=e.clientY; cursor.style.left=mx+'px'; cursor.style.top=my+'px'; });
  const loop = () => { fx+=(mx-fx)*0.12; fy+=(my-fy)*0.12; follower.style.left=fx+'px'; follower.style.top=fy+'px'; requestAnimationFrame(loop); };
  loop();
}

// ---- TOAST ----
function showToast(msg, type='success') {
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.className = 'success-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span class="toast-icon" style="color:${type==='error'?'#ef4444':'#10b981'}">${type==='error'?'✕':'✓'}</span><span>${msg}</span>`;
  toast.style.borderColor = type==='error' ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}
