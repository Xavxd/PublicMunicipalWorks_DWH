const user = JSON.parse(sessionStorage.getItem('op_user') || 'null');
if (!user || user.role !== 'secretaria') {
  window.location.href = '../index.html';
}
document.querySelectorAll('.user-name').forEach(el =>
  el.textContent = user?.nombre || user?.username || 'Secretaría'
);
document.documentElement.style.setProperty('--accent', '#8b5cf6');

const SEC_API_BASE = (() => {
  const h = window.location.hostname;
  return (h === 'localhost' || h === '127.0.0.1')
    ? 'http://localhost:5000'
    : 'https://obraspublicas-backend-production.up.railway.app';
})();
   
const http = {
  async _req(method, path, body = null) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role':     user?.role     || 'secretaria',
        'X-User-Id':       user?.id       || 'SEC_DEV',
        'X-User-Nombre':   user?.nombre   || '',
        'X-User-Username': user?.username || '',
      },
    };
    if (body) opts.body = JSON.stringify(body);
    let res;
    try {
      res = await fetch(`${SEC_API_BASE}${path}`, opts);
    } catch {
      throw new Error('No se pudo conectar con el servidor.');
    }
    let data;
    try { data = await res.json(); } catch {
      throw new Error(`Respuesta inválida (HTTP ${res.status}).`);
    }
    console.log(`[HTTP] ${method} ${path} → ${res.status}`, data);
    if (!res.ok || data.success === false)
      throw new Error(data.message || `Error HTTP ${res.status}`);
    return data;
  },
  get:    path       => http._req('GET',    path),
  post:   (path, b)  => http._req('POST',   path, b),
  delete: path       => http._req('DELETE', path),
};

// ── ESTADO GLOBAL ────────────────────────────────────────────
let OBRAS      = [];   // cargadas desde la BD
let PERMISOS   = [];
let ACTAS      = [];
let CONCURSOS  = [];

// ══════════════════════════════════════════════════════════════
//  INIT — carga inicial de todo
// ══════════════════════════════════════════════════════════════
async function init() {
  await loadObras();           // primero obras — las demás dependen de esto
  await Promise.all([
    loadPermisos(),
    loadActas(),
    loadConcursos(),
  ]);
  buildPermisosForm();
  buildFirmantesForm();
  buildConcursoFilterSelect();
  updateStats();
}

// ══════════════════════════════════════════════════════════════
//  OBRAS — cargadas desde la BD
// ══════════════════════════════════════════════════════════════
async function loadObras() {
  try {
    const res = await http.get('/api/obras');
    OBRAS = (res.data || []).map(o => ({
      id:     o.id,
      nombre: o.nombre || o.nombre_obra || '(sin nombre)',
    }));
  } catch (err) {
    console.error('[loadObras]', err);
    OBRAS = [];
    showToast('No se pudieron cargar las obras desde el servidor.', 'error');
  }
  populateAllObraSelects();
}

function populateAllObraSelects() {
  // IDs de todos los selects de obras en la página
  ['perm-obra', 'acta-obra', 'conc-obra'].forEach(selId => {
    const sel     = document.getElementById(selId);
    const loading = document.getElementById(`${selId}-loading`);
    if (!sel) return;

    sel.innerHTML = '<option value="">— Seleccionar obra —</option>' +
      OBRAS.map(o =>
        `<option value="${o.id}">${o.id.trim()} · ${o.nombre}</option>`
      ).join('');

    // Ocultar spinner, mostrar select
    if (loading) loading.style.display = 'none';
    sel.style.display = 'block';
  });
}

// ══════════════════════════════════════════════════════════════
//  TABS
// ══════════════════════════════════════════════════════════════
function switchTab(tabId) {
  document.querySelectorAll('.doc-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  document.getElementById(tabId).classList.add('active');
}
document.querySelectorAll('.doc-tab').forEach(btn =>
  btn.addEventListener('click', () => switchTab(btn.dataset.tab))
);

// ══════════════════════════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════════════════════════
function updateStats() {
  document.getElementById('stat-permisos').textContent  = PERMISOS.length;
  document.getElementById('stat-actas').textContent     = ACTAS.length;
  document.getElementById('stat-concursos').textContent = CONCURSOS.length;
}

// ══════════════════════════════════════════════════════════════
//  PERMISOS
// ══════════════════════════════════════════════════════════════
const INSTANCIAS_KNOWN = ['CFE','CONAGUA','SCT','SEMARNAT','INAH','IMSS','Municipio','Otra'];
const INST_ICONS = {
  CFE:'⚡', CONAGUA:'💧', SCT:'🛤️', SEMARNAT:'🌿',
  INAH:'🏛️', IMSS:'🏥', Municipio:'🏢', Otra:'📋',
};

function buildPermisosForm() {
  const grid = document.getElementById('instancia-grid');
  if (!grid) return;
  grid.innerHTML = INSTANCIAS_KNOWN.map((inst, i) => `
    <div class="instancia-chip">
      <input type="radio" name="instancia_chip" id="ic_${i}" value="${inst}" />
      <label for="ic_${i}">
        <span class="chip-icon">${INST_ICONS[inst] || '📋'}</span>
        ${inst}
      </label>
    </div>`).join('');

  grid.querySelectorAll('input[type=radio]').forEach(r =>
    r.addEventListener('change', () => {
      const w = document.getElementById('otra-instancia-wrap');
      if (w) w.style.display = r.value === 'Otra' ? 'block' : 'none';
    })
  );
}

async function loadPermisos() {
  try {
    const res = await http.get('/api/permisos');
    PERMISOS = res.data || [];
  } catch {
    PERMISOS = [];
  }
  renderPermisosList();
}

async function submitPermiso() {
  const obraId   = document.getElementById('perm-obra').value;
  const checked  = document.querySelector('input[name="instancia_chip"]:checked');
  const instancia = checked
    ? (checked.value === 'Otra'
        ? document.getElementById('otra-instancia')?.value?.trim()
        : checked.value)
    : '';
  const oficio = document.getElementById('perm-oficio').value.trim();
  const desc   = document.getElementById('perm-desc').value.trim();
  const fecha  = document.getElementById('perm-fecha').value;

  if (!obraId || !instancia || !oficio) {
    showToast('Completa los campos obligatorios: Obra, Instancia y Oficio.', 'error');
    return;
  }

  const btn = document.getElementById('form-permisos')
    .querySelector('.btn-primary');
  setBtnLoading(btn, true);

  try {
    await http.post('/api/permisos', { obraId, instancia, oficio, desc, fecha });
    document.getElementById('form-permisos').reset();
    document.querySelectorAll('.instancia-chip input').forEach(r => r.checked = false);
    const w = document.getElementById('otra-instancia-wrap');
    if (w) w.style.display = 'none';
    await loadPermisos();
    updateStats();
    showToast('Permiso registrado correctamente.');
  } catch (err) {
    showToast(err.message || 'Error al registrar el permiso.', 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

function renderPermisosList(filter = '') {
  const list = document.getElementById('permisos-list');
  if (!list) return;
  const q = filter.toLowerCase();
  const items = PERMISOS.filter(p =>
    !q || p.oficio?.toLowerCase().includes(q) ||
    p.instancia?.toLowerCase().includes(q) ||
    p.obraNombre?.toLowerCase().includes(q)
  );
  if (!items.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">📄</div>
      <div class="empty-state-text">Aún no hay oficios registrados</div>
    </div>`;
    return;
  }
  list.innerHTML = items.slice().reverse().map((p, i) => `
    <div class="doc-card" style="animation-delay:${i * 0.04}s">
      <div class="doc-card-icon">${INST_ICONS[p.instancia] || '📋'}</div>
      <div class="doc-card-body">
        <div class="doc-card-num">${p.id} · ${p.fecha || '—'}</div>
        <div class="doc-card-title">${p.oficio}</div>
        <div class="doc-card-meta">
          <span>🏢 ${p.instancia}</span>
          <span>📍 ${p.obraNombre || p.obraId}</span>
        </div>
        ${p.desc ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:5px">${p.desc}</div>` : ''}
      </div>
      <div class="doc-card-actions">
        <span class="badge-status badge-active">Registrado</span>
        <button class="btn-icon-sm" onclick="deletePermisoItem('${p.id}')" title="Eliminar">
          <svg viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>`).join('');
}

async function deletePermisoItem(id) {
  if (!confirm('¿Eliminar este oficio de permiso?')) return;
  try {
    await http.delete(`/api/permisos/${id}`);
    await loadPermisos();
    updateStats();
    showToast('Oficio eliminado.');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('search-permisos')?.addEventListener('input', e =>
  renderPermisosList(e.target.value.trim())
);

// ══════════════════════════════════════════════════════════════
//  ACTAS DE ENTREGA
// ══════════════════════════════════════════════════════════════
const FIRMANTE_ROLES = [
  { key: 'delegado',     cargo: 'Delegado / Rep. de Beneficiarios' },
  { key: 'constructora', cargo: 'Representante de la Constructora'  },
  { key: 'presidente',   cargo: 'Presidente Municipal'              },
  { key: 'director',     cargo: 'Director de Obras Públicas'        },
  { key: 'contralor',    cargo: 'Contralor'                         },
];

function buildFirmantesForm() {
  const container = document.getElementById('firmantes-container');
  if (!container) return;
  container.innerHTML = FIRMANTE_ROLES.map(fr => `
    <div class="firmante-row">
      <span class="firmante-cargo">${fr.cargo}</span>
      <div class="firmante-inputs">
        <input type="text" class="form-input firmante-input"
               id="f-nombre-${fr.key}" placeholder="Nombre(s)" />
        <input type="text" class="form-input firmante-input"
               id="f-apellido-p-${fr.key}" placeholder="Apellido Paterno" />
        <input type="text" class="form-input firmante-input"
               id="f-apellido-m-${fr.key}" placeholder="Apellido Materno" />
      </div>
    </div>`).join('');
}

async function loadActas() {
  try {
    const res = await http.get('/api/actas');
    ACTAS = res.data || [];
  } catch {
    ACTAS = [];
  }
  renderActasList();
}

async function submitActa() {
  const obraId  = document.getElementById('acta-obra').value;
  const fecha   = document.getElementById('acta-fecha').value;
  const numActa = document.getElementById('acta-numero').value.trim();
  const obs     = document.getElementById('acta-obs').value.trim();

  if (!obraId || !fecha) {
    showToast('Selecciona la obra y la fecha de expedición.', 'error');
    return;
  }

  const firmantes = FIRMANTE_ROLES.map(fr => ({
    cargo:     fr.cargo,
    nombre:    document.getElementById(`f-nombre-${fr.key}`)?.value?.trim()     || '',
    apellidoP: document.getElementById(`f-apellido-p-${fr.key}`)?.value?.trim() || '',
    apellidoM: document.getElementById(`f-apellido-m-${fr.key}`)?.value?.trim() || '',
  }));

  const completos = firmantes.filter(f => f.nombre && f.apellidoP);
  if (completos.length < 3) {
    showToast('Registra al menos 3 firmantes con nombre y apellido paterno.', 'error');
    return;
  }

  const btn = document.getElementById('form-acta').querySelector('.btn-primary');
  setBtnLoading(btn, true);

  try {
    await http.post('/api/actas', { obraId, numeroActa: numActa, fecha, obs, firmantes });
    document.getElementById('form-acta').reset();
    buildFirmantesForm();
    await loadActas();
    updateStats();
    showToast('Acta de entrega registrada correctamente.');
  } catch (err) {
    showToast(err.message || 'Error al registrar el acta.', 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

function renderActasList(filter = '') {
  const list = document.getElementById('actas-list');
  if (!list) return;
  const q = filter.toLowerCase();
  const items = ACTAS.filter(a =>
    !q || a.id?.toLowerCase().includes(q) ||
    a.obraNombre?.toLowerCase().includes(q)
  );
  if (!items.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">📜</div>
      <div class="empty-state-text">Aún no hay actas registradas</div>
    </div>`;
    return;
  }
  list.innerHTML = items.slice().reverse().map((a, i) => `
    <div class="doc-card" style="animation-delay:${i * 0.04}s">
      <div class="doc-card-icon">📜</div>
      <div class="doc-card-body">
        <div class="doc-card-num">${a.id} · ${a.fecha}</div>
        <div class="doc-card-title">${a.obraNombre || a.obraId}</div>
        <div class="doc-card-meta">
          <span>✍️ ${(a.firmantes || []).filter(f => f.nombre).length} firmantes</span>
          ${a.obs ? `<span>📝 ${a.obs.slice(0, 40)}…</span>` : ''}
        </div>
        <div class="acta-preview">
          <div class="acta-preview-title">Firmantes registrados</div>
          <div class="acta-firmantes-preview">
            ${(a.firmantes || []).filter(f => f.nombre).map(f => `
              <div class="firmante-preview-row">
                <span class="firmante-preview-cargo">${f.cargo}</span>
                <span class="firmante-preview-name">
                  ${f.nombre} ${f.apellidoP} ${f.apellidoM || ''}
                </span>
              </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="doc-card-actions">
        <span class="badge-status badge-closed">Cerrada</span>
        <button class="btn-icon-sm" onclick="deleteActaItem('${a.id}')" title="Eliminar">
          <svg viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>`).join('');
}

async function deleteActaItem(id) {
  if (!confirm('¿Eliminar esta acta de entrega?')) return;
  try {
    await http.delete(`/api/actas/${id}`);
    await loadActas();
    updateStats();
    showToast('Acta eliminada.');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('search-actas')?.addEventListener('input', e =>
  renderActasList(e.target.value.trim())
);

// ══════════════════════════════════════════════════════════════
//  CONCURSO DE SELECCIÓN
// ══════════════════════════════════════════════════════════════

// Mostrar/ocultar hint cuando marcan "Aprobada"
document.querySelectorAll('input[name="conc_resultado"]').forEach(r =>
  r.addEventListener('change', () => {
    const hint = document.getElementById('conc-aprobada-hint');
    if (hint) hint.style.display = r.value === 'true' ? 'flex' : 'none';
  })
);

// Cuando cambia la obra seleccionada: verificar si ya hay un aprobado
async function onConcursoObraChange() {
  const obraId = document.getElementById('conc-obra')?.value;
  const aviso  = document.getElementById('conc-obra-aviso');
  if (!obraId || !aviso) return;

  // Buscar en los concursos ya cargados si hay uno aprobado para esa obra
  const tieneGanador = CONCURSOS.some(
    c => c.obraId?.trim() === obraId.trim() && c.aprobado === true
  );
  if (tieneGanador) {
    aviso.style.display = 'flex';
    aviso.innerHTML = `
      <svg viewBox="0 0 20 20" fill="none" style="width:14px;height:14px;flex-shrink:0;color:#f59e0b">
        <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/>
        <path d="M10 7v4M10 13h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      Esta obra ya tiene una constructora aprobada. Solo puedes registrar participantes no aprobados.`;
    // Forzar "No aprobada" y deshabilitar "Aprobada"
    const radios = document.querySelectorAll('input[name="conc_resultado"]');
    radios.forEach(r => {
      if (r.value === 'true') { r.disabled = true; r.checked = false; }
      if (r.value === 'false') { r.checked = true; }
    });
  } else {
    aviso.style.display = 'none';
    document.querySelectorAll('input[name="conc_resultado"]').forEach(r => {
      r.disabled = false;
    });
  }
}

function buildConcursoFilterSelect() {
  const sel = document.getElementById('conc-filter-obra');
  if (!sel) return;
  // Mantener opción "Todas"
  sel.innerHTML = '<option value="">Todas las obras</option>' +
    OBRAS.map(o =>
      `<option value="${o.id}">${o.id.trim()} · ${o.nombre}</option>`
    ).join('');
}

async function loadConcursos() {
  try {
    const res = await http.get('/api/concursos');
    CONCURSOS = res.data || [];
  } catch {
    CONCURSOS = [];
  }
  renderConcursosList();
}

async function submitConcurso() {
  const obraId      = document.getElementById('conc-obra')?.value?.trim();
  const constructora = document.getElementById('conc-constructora')?.value?.trim();
  const rfc         = document.getElementById('conc-rfc')?.value?.trim() || null;
  const monto       = parseFloat(document.getElementById('conc-monto')?.value || 0) || null;
  const aprobado    = document.querySelector('input[name="conc_resultado"]:checked')?.value === 'true';
  const razones     = document.getElementById('conc-razones')?.value?.trim();

  if (!obraId || !constructora || !razones) {
    showToast('Completa los campos obligatorios: Obra, Constructora y Razones.', 'error');
    return;
  }

  const btn = document.getElementById('btn-submit-concurso');
  setBtnLoading(btn, true);

  try {
    await http.post('/api/concursos', {
      obraId,
      constructora,
      rfc,
      monto,
      aprobado,
      razones,
    });

    document.getElementById('form-concurso').reset();
    // Re-habilitar radio aprobada por si estaba bloqueado
    document.querySelectorAll('input[name="conc_resultado"]').forEach(r => {
      r.disabled = false;
    });
    document.getElementById('conc-obra-aviso').style.display = 'none';

    await loadConcursos();
    buildConcursoFilterSelect();
    updateStats();
    showToast(`Participante "${constructora}" registrado correctamente.`);

  } catch (err) {
    showToast(err.message || 'Error al registrar el participante.', 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

function renderConcursosList() {
  const list       = document.getElementById('concursos-list');
  const filterObra = document.getElementById('conc-filter-obra')?.value?.trim();
  const searchQ    = (document.getElementById('search-concursos')?.value || '').toLowerCase().trim();
  if (!list) return;

  let items = CONCURSOS;
  if (filterObra) items = items.filter(c => c.obraId?.trim() === filterObra);
  if (searchQ)    items = items.filter(c =>
    c.constructora?.toLowerCase().includes(searchQ) ||
    c.obraNombre?.toLowerCase().includes(searchQ)
  );

  if (!items.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🏆</div>
      <div class="empty-state-text">Sin participantes registrados</div>
    </div>`;
    return;
  }

  list.innerHTML = items.slice().reverse().map((c, i) => `
    <div class="doc-card ${c.aprobado ? 'doc-card-ganador' : ''}"
         style="animation-delay:${i * 0.04}s">
      <div class="doc-card-icon">${c.aprobado ? '🏆' : '🏢'}</div>
      <div class="doc-card-body">
        <div class="doc-card-num">${c.id} · ${c.obraNombre || c.obraId}</div>
        <div class="doc-card-title">${c.constructora}</div>
        <div class="doc-card-meta">
          ${c.rfc ? `<span>🪪 ${c.rfc}</span>` : ''}
          ${c.monto ? `<span>💰 $${Number(c.monto).toLocaleString('es-MX')}</span>` : ''}
        </div>
        ${c.razones ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:5px">${c.razones.slice(0,80)}${c.razones.length > 80 ? '…' : ''}</div>` : ''}
      </div>
      <div class="doc-card-actions">
        <span class="badge-status ${c.aprobado ? 'badge-ganador' : 'badge-no-aprobado'}">
          ${c.aprobado ? '✓ Aprobada' : 'No aprobada'}
        </span>
        <button class="btn-icon-sm" onclick="deleteConcursoItem('${c.id}')" title="Eliminar">
          <svg viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>`).join('');
}

async function deleteConcursoItem(id) {
  if (!confirm('¿Eliminar este registro de participante?')) return;
  try {
    await http.delete(`/api/concursos/${id}`);
    await loadConcursos();
    updateStats();
    showToast('Participante eliminado.');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('search-concursos')?.addEventListener('input',
  () => renderConcursosList()
);

// ══════════════════════════════════════════════════════════════
//  HELPERS UI
// ══════════════════════════════════════════════════════════════
function setBtnLoading(btn, loading) {
  if (!btn) return;
  if (loading) { btn.classList.add('loading');  btn.disabled = true;  }
  else         { btn.classList.remove('loading'); btn.disabled = false; }
}

function showToast(msg, type = 'success') {
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.className = 'success-toast';
    document.body.appendChild(toast);
  }
  const isErr  = type === 'error';
  toast.innerHTML = `
    <span class="toast-icon" style="color:${isErr ? '#ef4444' : '#10b981'}">
      ${isErr ? '✕' : '✓'}
    </span>
    <span>${msg}</span>`;
  toast.style.borderColor = isErr ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3800);
}

// ── Cursor personalizado ─────────────────────────────────────
const cursor   = document.getElementById('cursor');
const follower = document.getElementById('cursor-follower');
if (cursor && follower) {
  let mx = 0, my = 0, fx = 0, fy = 0;
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    cursor.style.left = mx + 'px'; cursor.style.top = my + 'px';
  });
  const loop = () => {
    fx += (mx - fx) * 0.12; fy += (my - fy) * 0.12;
    follower.style.left = fx + 'px'; follower.style.top = fy + 'px';
    requestAnimationFrame(loop);
  };
  loop();
}

// ── ARRANQUE ─────────────────────────────────────────────────
init();
