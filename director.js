// =============================================
// DIRECTOR DE OBRAS — JS
// =============================================

// Auth guard
const user = JSON.parse(sessionStorage.getItem('op_user') || 'null');
if (!user || user.role !== 'director') window.location.href = '../index.html';

// Render user info
const userBadge = document.getElementById('user-header-badge');
if (userBadge) userBadge.textContent = `🏛️ ${user?.nombre || user?.username}`;

function logout() {
  sessionStorage.removeItem('op_user');
  window.location.href = '../index.html';
}

// --- STORAGE ---
function getObras() { return JSON.parse(localStorage.getItem('op_obras') || '[]'); }
function saveObras(data) { localStorage.setItem('op_obras', JSON.stringify(data)); }
function getConstructoras() {
  const stored = localStorage.getItem('op_constructoras');
  if (stored) return JSON.parse(stored);
  return [
    { id: 'CONSTR001', nombre: 'H. Ayuntamiento (ejecución propia)', rfc: 'HAY000101000', tipo: 'ayuntamiento' },
    { id: 'CONSTR002', nombre: 'Constructora Vialte S.A.', rfc: 'CVA980605HJ2', tipo: 'privada' },
    { id: 'CONSTR003', nombre: 'Obras del Bosque S.C.', rfc: 'OBS011203AB4', tipo: 'privada' },
    { id: 'CONSTR004', nombre: 'Grupo Constructor Tollocan', rfc: 'GCT061210XY5', tipo: 'privada' }
  ];
}
function saveConstructoras(data) { localStorage.setItem('op_constructoras', JSON.stringify(data)); }
function getConcursos() { return JSON.parse(localStorage.getItem('op_concursos') || '[]'); }
function saveConcursos(data) { localStorage.setItem('op_concursos', JSON.stringify(data)); }

// Region map
const regionMap = {
  'REG001': 'Comunidad (Cabecera Municipal)',
  'REG002': 'Albarranes',
  'REG003': 'San Francisco',
  'REG004': 'Telpintla'
};

// --- PANEL NAVIGATION ---
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = document.getElementById(`panel-${id}`);
  if (target) target.classList.add('active');
  const navLink = document.querySelector(`[data-panel="${id}"]`);
  if (navLink) navLink.classList.add('active');

  if (id === 'obras-list') renderObrasTable();
  if (id === 'constructoras') renderConstructoras();
  if (id === 'concurso') renderConcurso();
  if (id === 'fuentes') renderFuentes();
}

// --- NUEVA OBRA ---
function submitObra(e) {
  e.preventDefault();
  const obras = getObras();
  const nuevaObra = {
    id: 'OBR' + Date.now(),
    expediente: document.getElementById('obra-expediente').value,
    nombre: document.getElementById('obra-nombre').value,
    etapa: document.getElementById('obra-etapa').value,
    constructora: document.getElementById('obra-constructora').value,
    supervisor: document.getElementById('obra-supervisor').value,
    region: document.getElementById('obra-region').value,
    barrio: document.getElementById('obra-barrio').value,
    colonia: document.getElementById('obra-colonia').value,
    fechaInicio: document.getElementById('obra-fecha-inicio').value,
    fechaFin: document.getElementById('obra-fecha-fin').value,
    presupuesto: document.getElementById('obra-presupuesto').value,
    fuentes: Array.from(document.querySelectorAll('.fuente-check:checked')).map(c => c.value),
    descripcion: document.getElementById('obra-desc').value,
    beneficiarios: document.getElementById('obra-beneficiarios').value,
    status: 'activa',
    creadoPor: user.id,
    fechaRegistro: new Date().toISOString()
  };
  obras.push(nuevaObra);
  saveObras(obras);
  updateObraCount();
  showToast(`Obra "${nuevaObra.nombre}" registrada exitosamente.`);
  e.target.reset();
  // Sync to obras list page
  localStorage.setItem('op_obras_updated', Date.now());
}

function resetObra() {
  document.getElementById('form-obra').reset();
}

function updateObraCount() {
  const el = document.getElementById('obra-count-badge');
  if (el) el.textContent = `${getObras().length} obras registradas`;
}

// --- RENDER TABLE ---
function renderObrasTable(filter = '') {
  const obras = getObras().filter(o =>
    !filter ||
    o.nombre.toLowerCase().includes(filter.toLowerCase()) ||
    o.expediente.toLowerCase().includes(filter.toLowerCase())
  );
  const tbody = document.getElementById('obras-tbody');
  if (!tbody) return;
  if (!obras.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8"><div class="empty-state"><div class="empty-icon">🏗️</div><p>No hay obras registradas.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = obras.map(o => `
    <tr>
      <td><code style="font-size:0.78rem;color:var(--text-muted)">${o.expediente}</code></td>
      <td class="obra-name">${o.nombre}</td>
      <td>${regionMap[o.region] || o.region}</td>
      <td>Etapa ${o.etapa}</td>
      <td>${formatDate(o.fechaInicio)}</td>
      <td>${formatDate(o.fechaFin)}</td>
      <td><span class="status-badge status-${o.status}">${o.status}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn-icon" title="Ver" onclick="alert('Ver obra: ${o.nombre}')">👁</button>
          <button class="btn-danger" onclick="deleteObra('${o.id}')">✕</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterObras(val) { renderObrasTable(val); }

function deleteObra(id) {
  if (!confirm('¿Eliminar esta obra del registro?')) return;
  let obras = getObras().filter(o => o.id !== id);
  saveObras(obras);
  renderObrasTable();
  updateObraCount();
  showToast('Obra eliminada del registro.');
}

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// --- CONSTRUCTORAS ---
function renderConstructoras() {
  const grid = document.getElementById('constructoras-grid');
  if (!grid) return;
  const list = getConstructoras();
  grid.innerHTML = list.map(c => `
    <div class="constructora-card">
      <div class="constructora-icon">🏢</div>
      <div class="constructora-nombre">${c.nombre}</div>
      <div class="constructora-rfc">${c.rfc}</div>
      <span class="constructora-tipo">${c.tipo}</span>
    </div>
  `).join('');
}

function openConstructoraModal() {
  document.getElementById('modal-constructora').classList.add('active');
}
function closeModalConstructora(e) {
  if (e.target === document.getElementById('modal-constructora'))
    document.getElementById('modal-constructora').classList.remove('active');
}
function saveConstructora() {
  const nombre = document.getElementById('c-nombre').value.trim();
  const rfc = document.getElementById('c-rfc').value.trim();
  const tipo = document.getElementById('c-tipo').value;
  if (!nombre || !rfc) { alert('Completa nombre y RFC.'); return; }
  const list = getConstructoras();
  list.push({ id: 'CONSTR' + Date.now(), nombre, rfc, tipo });
  saveConstructoras(list);
  document.getElementById('modal-constructora').classList.remove('active');
  renderConstructoras();
  showToast(`Constructora "${nombre}" registrada.`);
}

// --- CONCURSO ---
function renderConcurso() {
  // Populate obras select
  const sel = document.getElementById('conc-obra');
  if (sel) {
    const obras = getObras();
    sel.innerHTML = obras.length
      ? obras.map(o => `<option value="${o.id}">${o.expediente} — ${o.nombre}</option>`).join('')
      : '<option value="">No hay obras registradas</option>';
  }
  // Render list
  const list = document.getElementById('concurso-list');
  const concursos = getConcursos();
  if (!list) return;
  if (!concursos.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🏆</div><p>No hay registros de concurso.</p></div>`;
    return;
  }
  list.innerHTML = concursos.map(c => `
    <div class="concurso-item">
      <div>
        <div class="concurso-obra">Obra: ${getObraNombre(c.obraId)}</div>
        <div class="concurso-empresa">${c.constructora}</div>
        <div class="concurso-razones">${c.razones}</div>
      </div>
      <span class="status-badge ${c.resultado === 'aprobada' ? 'status-activa' : 'status-pausada'}">${c.resultado}</span>
    </div>
  `).join('');
}

function getObraNombre(id) {
  const obra = getObras().find(o => o.id === id);
  return obra ? obra.nombre : id;
}

function openConcursoModal() {
  document.getElementById('modal-concurso').classList.add('active');
  renderConcurso(); // refresh select
}
function closeModalConcurso(e) {
  if (e.target === document.getElementById('modal-concurso'))
    document.getElementById('modal-concurso').classList.remove('active');
}
function saveConcurso() {
  const obraId = document.getElementById('conc-obra').value;
  const constructora = document.getElementById('conc-constructora').value.trim();
  const resultado = document.getElementById('conc-resultado').value;
  const razones = document.getElementById('conc-razones').value.trim();
  if (!constructora || !razones) { alert('Completa todos los campos requeridos.'); return; }
  const list = getConcursos();
  list.push({ id: 'CONC' + Date.now(), obraId, constructora, resultado, razones, fecha: new Date().toISOString() });
  saveConcursos(list);
  document.getElementById('modal-concurso').classList.remove('active');
  renderConcurso();
  showToast('Propuesta de concurso registrada.');
}

// --- FUENTES ---
const fuentesCatalog = [
  { id: 'F001', nombre: 'Fondo Municipal', nivel: 'Municipal', programa: 'Presupuesto Anual de Obras', monto: 'Variable' },
  { id: 'F002', nombre: 'Gobierno del Estado de México', nivel: 'Estatal', programa: 'Obras de la Transformación', monto: 'Variable' },
  { id: 'F003', nombre: 'FISM', nivel: 'Federal', programa: 'Fondo de Infraestructura Social Municipal', monto: 'Determinado por norma' },
  { id: 'F004', nombre: 'FORTAMUN', nivel: 'Federal', programa: 'Fortalecimiento Municipal', monto: 'Determinado por norma' },
  { id: 'F005', nombre: 'PROTRAM', nivel: 'Estatal', programa: 'Programa de Transporte Metropolitano', monto: 'Variable' }
];

function renderFuentes() {
  const el = document.getElementById('fuentes-catalog');
  if (!el) return;
  el.innerHTML = fuentesCatalog.map(f => `
    <div class="fuente-card">
      <span class="fuente-card-nivel fuente-tag ${f.nivel.toLowerCase()}">${f.nivel}</span>
      <div class="fuente-card-nombre">${f.nombre}</div>
      <div class="fuente-card-programa">${f.programa}</div>
    </div>
  `).join('');
}

// --- INIT ---
updateObraCount();

// showToast override for pages
function showToast(msg) {
  let toast = document.querySelector('.success-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.innerHTML = `<span class="toast-icon">✓</span><span class="toast-msg"></span>`;
    document.body.appendChild(toast);
  }
  toast.querySelector('.toast-msg').textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}
