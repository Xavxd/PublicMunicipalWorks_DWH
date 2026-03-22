
const user = JSON.parse(sessionStorage.getItem('op_user') || 'null');
document.getElementById('user-header-badge').textContent = `📋 ${user.nombre || 'Supervisor'}`;
if (!user || user.role !== 'supervisor') window.location.href = '../index.html';

const badge = document.getElementById('user-header-badge');
if (badge) badge.textContent = `📋 ${user?.nombre || user?.username} (${user?.id})`;

function logout() { sessionStorage.removeItem('op_user'); window.location.href = '../index.html'; }

function getObras() { return JSON.parse(localStorage.getItem('op_obras') || '[]'); }
function getInformes() { return JSON.parse(localStorage.getItem('op_informes') || '[]'); }
function saveInformes(d) { localStorage.setItem('op_informes', JSON.stringify(d)); }

const regionMap = { 'REG001': 'Comunidad', 'REG002': 'Albarranes', 'REG003': 'San Francisco', 'REG004': 'Telpintla' };
const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Get obras assigned to this supervisor
function getObrasAsignadas() {
  return getObras().filter(o => o.supervisor === user.id);
}

// ---- PANEL NAV ----
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`panel-${id}`)?.classList.add('active');
  document.querySelector(`[data-panel="${id}"]`)?.classList.add('active');
  if (id === 'mis-obras') renderObrasAsignadas();
  if (id === 'nuevo-informe') populateObraSelect();
  if (id === 'libro-informes') { populateFiltroObra(); renderLibro(); }
}

// ---- OBRAS ASIGNADAS ----
function renderObrasAsignadas() {
  const grid = document.getElementById('obras-asignadas-grid');
  if (!grid) return;
  const obras = getObrasAsignadas();
  if (!obras.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📋</div><p>No tienes obras asignadas aún.</p><p style="font-size:0.8rem;margin-top:0.5rem;color:var(--text-muted)">El director de obras debe asignarte a una obra primero.</p></div>`;
    return;
  }
  grid.innerHTML = obras.map(o => {
    const informes = getInformes().filter(i => i.obraId === o.id);
    const lastInforme = informes[informes.length - 1];
    const fisico = lastInforme ? lastInforme.avanceFisico : 0;
    return `
    <div class="obra-asignada-card" onclick="goToInforme('${o.id}')">
      <div class="oa-expediente">${o.expediente}</div>
      <div class="oa-nombre">${o.nombre}</div>
      <div class="oa-region">📍 ${regionMap[o.region] || o.region}${o.barrio ? ` · ${o.barrio}` : ''}</div>
      <div class="oa-meta">
        <div class="oa-meta-item">Etapa <strong>${o.etapa}</strong></div>
        <div class="oa-meta-item">Inicio <strong>${formatDate(o.fechaInicio)}</strong></div>
        <div class="oa-meta-item"><strong>${informes.length}</strong> informes</div>
      </div>
      <div class="oa-progress">
        <div class="progress-label"><span>Avance físico</span><span>${fisico}%</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${fisico}%"></div></div>
      </div>
    </div>`;
  }).join('');
}

function goToInforme(obraId) {
  showPanel('nuevo-informe');
  setTimeout(() => {
    const sel = document.getElementById('inf-obra');
    if (sel) { sel.value = obraId; onObraChange(); }
  }, 100);
}

// ---- POPULATE OBRA SELECT ----
function populateObraSelect() {
  const sel = document.getElementById('inf-obra');
  if (!sel) return;
  const obras = getObrasAsignadas();
  sel.innerHTML = obras.length
    ? `<option value="">Seleccionar obra…</option>` + obras.map(o => `<option value="${o.id}">${o.expediente} — ${o.nombre}</option>`).join('')
    : `<option value="">Sin obras asignadas</option>`;

  // Set current year
  const yr = document.getElementById('inf-anio');
  if (yr) yr.value = new Date().getFullYear();
}

function onObraChange() {
  const obraId = document.getElementById('inf-obra').value;
  const strip = document.getElementById('obra-info-card');
  if (!obraId || !strip) { strip && (strip.style.display = 'none'); return; }
  const obra = getObras().find(o => o.id === obraId);
  if (!obra) return;
  strip.style.display = 'flex';
  strip.innerHTML = `
    <div><span>Obra</span><br/><strong>${obra.nombre}</strong></div>
    <div><span>Región</span><br/><strong>${regionMap[obra.region] || obra.region}</strong></div>
    <div><span>Período</span><br/><strong>${formatDate(obra.fechaInicio)} — ${formatDate(obra.fechaFin)}</strong></div>
    <div><span>Presupuesto</span><br/><strong>$${Number(obra.presupuesto || 0).toLocaleString('es-MX')}</strong></div>
  `;
}

// ---- SLIDERS ----
function updateSlider(type) {
  const val = document.getElementById(`inf-avance-${type}`).value;
  document.getElementById(`${type}-val`).textContent = val + '%';
  document.getElementById(`${type}-bar`).style.width = val + '%';
}

// ---- FILE HANDLING ----
let attachedFiles = [];
function handleFiles(files) {
  attachedFiles = [...attachedFiles, ...Array.from(files)];
  renderFileList();
}
function renderFileList() {
  const container = document.getElementById('file-list');
  if (!container) return;
  container.innerHTML = attachedFiles.map((f, i) => `
    <div class="file-chip">
      <span>${f.name.length > 22 ? f.name.slice(0,20)+'…' : f.name}</span>
      <button onclick="removeFile(${i})">✕</button>
    </div>
  `).join('');
}
function removeFile(i) { attachedFiles.splice(i, 1); renderFileList(); }
function clearFiles() { attachedFiles = []; renderFileList(); }

// ---- SUBMIT INFORME ----
function submitInforme(e) {
  e.preventDefault();
  const obraId = document.getElementById('inf-obra').value;
  const anio = document.getElementById('inf-anio').value;
  const mes = document.getElementById('inf-mes').value;
  const avanceFisico = parseInt(document.getElementById('inf-avance-fisico').value);
  const avanceFinanciero = parseInt(document.getElementById('inf-avance-financiero').value);
  const desc = document.getElementById('inf-desc').value.trim();

  const informe = {
    id: 'INF' + Date.now(),
    obraId,
    supervisorId: user.id,
    supervisorNombre: user.nombre,
    anio: parseInt(anio),
    mes: parseInt(mes),
    avanceFisico,
    avanceFinanciero,
    descripcion: desc,
    archivos: attachedFiles.map(f => f.name),
    fechaRegistro: new Date().toISOString()
  };

  const informes = getInformes();
  informes.push(informe);
  saveInformes(informes);

  showToast(`Informe ${meses[parseInt(mes)]} ${anio} registrado exitosamente.`);
  e.target.reset();
  clearFiles();
  document.getElementById('fisico-val').textContent = '0%';
  document.getElementById('financiero-val').textContent = '0%';
  document.getElementById('fisico-bar').style.width = '0%';
  document.getElementById('financiero-bar').style.width = '0%';
  document.getElementById('obra-info-card').style.display = 'none';
}

// ---- LIBRO DE INFORMES ----
function populateFiltroObra() {
  const sel = document.getElementById('filtro-obra-libro');
  if (!sel) return;
  const obras = getObrasAsignadas();
  sel.innerHTML = `<option value="">Todas las obras</option>` + obras.map(o => `<option value="${o.id}">${o.nombre}</option>`).join('');
}

function renderLibro() {
  const container = document.getElementById('libro-container');
  if (!container) return;
  const filtro = document.getElementById('filtro-obra-libro')?.value || '';
  let informes = getInformes().filter(i => i.supervisorId === user.id);
  if (filtro) informes = informes.filter(i => i.obraId === filtro);
  informes.sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro));

  if (!informes.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><p>No hay informes registrados aún.</p></div>`;
    return;
  }

  container.innerHTML = informes.map(inf => {
    const obra = getObras().find(o => o.id === inf.obraId);
    return `
    <div class="informe-card">
      <div class="informe-header">
        <div>
          <div class="informe-meta" style="margin-bottom:4px">${obra ? obra.expediente : '—'} · ${obra ? obra.nombre : 'Obra desconocida'}</div>
          <div class="informe-title">Informe de ${meses[inf.mes]} ${inf.anio}</div>
          <div class="informe-meta">Registrado el ${new Date(inf.fechaRegistro).toLocaleDateString('es-MX')} · ${inf.supervisorNombre}</div>
        </div>
        <div class="informe-stats">
          <div class="informe-stat">
            <div class="informe-stat-val fisico">${inf.avanceFisico}%</div>
            <div class="informe-stat-label">Físico</div>
          </div>
          <div class="informe-stat">
            <div class="informe-stat-val financiero">${inf.avanceFinanciero}%</div>
            <div class="informe-stat-label">Financiero</div>
          </div>
        </div>
      </div>
      <div class="informe-body">${inf.descripcion}</div>
      ${inf.archivos?.length ? `<div class="informe-files">${inf.archivos.map(f => `<div class="file-chip">📎 ${f}</div>`).join('')}</div>` : ''}
    </div>`;
  }).join('');
}

// ---- UTILS ----
function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
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

// Init
showPanel('mis-obras');
