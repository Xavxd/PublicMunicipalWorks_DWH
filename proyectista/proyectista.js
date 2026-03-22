// =============================================
// PROYECTISTA — JS
// =============================================
const user = JSON.parse(sessionStorage.getItem('op_user') || 'null');
if (!user || user.role !== 'proyectista') window.location.href = '../index.html';
const badge = document.getElementById('user-header-badge');
if (badge) badge.textContent = `📐 ${user?.nombre || user?.username} (${user?.id})`;
function logout() { sessionStorage.removeItem('op_user'); window.location.href = '../index.html'; }

function getObras() { return JSON.parse(localStorage.getItem('op_obras') || '[]'); }
function getPresupuestos() { return JSON.parse(localStorage.getItem('op_presupuestos') || '{}'); }
function savePresupuestos(d) { localStorage.setItem('op_presupuestos', JSON.stringify(d)); }

const regionMap = { 'REG001': 'Comunidad', 'REG002': 'Albarranes', 'REG003': 'San Francisco', 'REG004': 'Telpintla' };
const catNames = { materiales: '🧱 Materiales', mano_obra: '👷 Mano de Obra', equipo: '🚜 Equipo', indirectos: '📋 Costos Indirectos', imprevistos: '⚠️ Imprevistos' };

let currentObraId = null;
let currentCat = 'materiales';

// In-memory presupuesto state for current session
let presupuestoData = {};

// ---- PANELS ----
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`panel-${id}`)?.classList.add('active');
  document.querySelector(`[data-panel="${id}"]`)?.classList.add('active');
  if (id === 'seleccionar-obra') renderObraSelect();
  if (id === 'editor-presupuesto') renderEditor();
  if (id === 'resumen') renderResumen();
}

// ---- OBRAS SELECT ----
function renderObraSelect() {
  const grid = document.getElementById('obras-select-grid');
  if (!grid) return;
  const obras = getObras();
  if (!obras.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📐</div><p>No hay obras registradas por el Director.</p></div>`;
    return;
  }
  const presupuestos = getPresupuestos();
  grid.innerHTML = obras.map(o => `
    <div class="obra-select-card ${currentObraId === o.id ? 'selected' : ''}">
      <div class="osc-tag">${o.expediente}</div>
      <div class="osc-nombre">${o.nombre}</div>
      <div class="osc-region">📍 ${regionMap[o.region] || o.region}</div>
      <div class="osc-presupuesto">$${Number(o.presupuesto||0).toLocaleString('es-MX')} asignados</div>
      ${presupuestos[o.id] ? `<div style="margin-top:0.5rem"><span class="has-presupuesto-badge">✓ Presupuesto elaborado</span></div>` : ''}
      <div class="osc-actions" style="margin-top:1rem;display:flex;gap:8px">
        <button class="btn-primary" style="background:var(--accent-proyectista);font-size:0.82rem;padding:8px 14px" onclick="selectObra('${o.id}')">Elaborar Presupuesto</button>
        ${presupuestos[o.id] ? `<button class="btn-secondary" style="font-size:0.82rem;padding:8px 14px" onclick="selectObra('${o.id}');showPanel('resumen')">Ver Resumen</button>` : ''}
      </div>
    </div>
  `).join('');
}

function selectObra(id) {
  currentObraId = id;
  const obra = getObras().find(o => o.id === id);
  if (!obra) return;
  // Load existing presupuesto
  const presupuestos = getPresupuestos();
  presupuestoData = presupuestos[id] || { materiales: [], mano_obra: [], equipo: [], indirectos: [], imprevistos: [] };
  // Update sidebar
  const card = document.getElementById('sidebar-obra-card');
  if (card) {
    card.style.display = 'block';
    document.getElementById('sidebar-obra-nombre').textContent = obra.nombre;
    document.getElementById('sidebar-obra-presupuesto').textContent = `$${Number(obra.presupuesto||0).toLocaleString('es-MX')}`;
  }
  showPanel('editor-presupuesto');
}

// ---- EDITOR ----
function renderEditor() {
  if (!currentObraId) return;
  const obra = getObras().find(o => o.id === currentObraId);
  const titleEl = document.getElementById('editor-obra-title');
  if (titleEl && obra) titleEl.textContent = `Elaborando presupuesto para: ${obra.nombre}`;
  switchCat(currentCat);
  updateTotal();
}

function switchCat(cat) {
  currentCat = cat;
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
  renderCostoRows();
}

function renderCostoRows() {
  const tbody = document.getElementById('costos-tbody');
  if (!tbody) return;
  const rows = presupuestoData[currentCat] || [];
  if (!rows.length) {
    tbody.innerHTML = `<tr class="empty-table-row"><td colspan="7">Sin conceptos en esta categoría. Agrégalos abajo.</td></tr>`;
    updateSubtotal(0);
    return;
  }
  tbody.innerHTML = rows.map((row, i) => `
    <tr data-index="${i}">
      <td class="row-num">${i+1}</td>
      <td><input class="inline-edit" value="${row.desc}" onchange="updateRow(${i}, 'desc', this.value)"/></td>
      <td><input class="inline-edit" value="${row.unit}" onchange="updateRow(${i}, 'unit', this.value)" style="width:80px"/></td>
      <td><input class="inline-edit inline-num" type="number" value="${row.qty}" onchange="updateRow(${i}, 'qty', this.value)" style="width:70px"/></td>
      <td><input class="inline-edit inline-num" type="number" value="${row.price}" onchange="updateRow(${i}, 'price', this.value)" style="width:100px"/></td>
      <td class="importe-cell">$${(row.qty * row.price).toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
      <td><button class="btn-danger" style="padding:5px 8px;font-size:0.78rem" onclick="deleteRow(${i})">✕</button></td>
    </tr>
  `).join('');
  const subtotal = rows.reduce((acc, r) => acc + (r.qty * r.price), 0);
  updateSubtotal(subtotal);
  updateTotal();
}

function updateRow(index, field, value) {
  if (!presupuestoData[currentCat]) return;
  presupuestoData[currentCat][index][field] = field === 'desc' || field === 'unit' ? value : parseFloat(value) || 0;
  renderCostoRows();
}

function deleteRow(index) {
  presupuestoData[currentCat].splice(index, 1);
  renderCostoRows();
}

function addCostoRow() {
  const desc = document.getElementById('new-desc').value.trim();
  const unit = document.getElementById('new-unit').value.trim();
  const qty = parseFloat(document.getElementById('new-qty').value) || 0;
  const price = parseFloat(document.getElementById('new-price').value) || 0;
  if (!desc) { showToast('Ingresa una descripción para el concepto.'); return; }
  if (!presupuestoData[currentCat]) presupuestoData[currentCat] = [];
  presupuestoData[currentCat].push({ desc, unit: unit || 'pza', qty, price });
  document.getElementById('new-desc').value = '';
  document.getElementById('new-unit').value = '';
  document.getElementById('new-qty').value = '';
  document.getElementById('new-price').value = '';
  document.getElementById('add-preview').textContent = '$0.00';
  renderCostoRows();
}

function previewImporte() {
  const qty = parseFloat(document.getElementById('new-qty').value) || 0;
  const price = parseFloat(document.getElementById('new-price').value) || 0;
  document.getElementById('add-preview').textContent = `$${(qty * price).toLocaleString('es-MX', {minimumFractionDigits:2})}`;
}

function updateSubtotal(val) {
  const el = document.getElementById('subtotal-cat');
  if (el) el.textContent = `$${val.toLocaleString('es-MX', {minimumFractionDigits:2})}`;
}

function updateTotal() {
  let total = 0;
  Object.values(presupuestoData).forEach(cat => {
    if (Array.isArray(cat)) cat.forEach(r => total += (r.qty || 0) * (r.price || 0));
  });
  const el = document.getElementById('total-display');
  if (el) el.textContent = `$${total.toLocaleString('es-MX', {minimumFractionDigits:2})}`;
}

function clearCategory() {
  if (!confirm(`¿Limpiar todos los conceptos de ${catNames[currentCat]}?`)) return;
  presupuestoData[currentCat] = [];
  renderCostoRows();
}

function savePresupuesto() {
  if (!currentObraId) { showToast('Selecciona una obra primero.'); return; }
  const presupuestos = getPresupuestos();
  presupuestos[currentObraId] = presupuestoData;
  savePresupuestos(presupuestos);
  showToast('Presupuesto guardado exitosamente.');
}

// ---- RESUMEN ----
function renderResumen() {
  const container = document.getElementById('resumen-container');
  if (!container) return;
  if (!currentObraId) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>Selecciona una obra para ver su resumen.</p></div>`;
    return;
  }
  const obra = getObras().find(o => o.id === currentObraId);
  const presupuestos = getPresupuestos();
  const data = presupuestos[currentObraId] || presupuestoData;
  let grandTotal = 0;
  Object.values(data).forEach(cat => { if (Array.isArray(cat)) cat.forEach(r => grandTotal += (r.qty||0)*(r.price||0)); });

  let html = `
    <div class="resumen-obra-header">
      <div class="resumen-obra-name">${obra ? obra.nombre : '—'}</div>
      <div class="resumen-total">Total del presupuesto elaborado: <strong>$${grandTotal.toLocaleString('es-MX', {minimumFractionDigits:2})}</strong></div>
      ${obra ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">Presupuesto asignado: $${Number(obra.presupuesto||0).toLocaleString('es-MX')}</div>` : ''}
    </div>`;

  Object.entries(catNames).forEach(([key, name]) => {
    const rows = data[key] || [];
    const subtotal = rows.reduce((a, r) => a + (r.qty||0)*(r.price||0), 0);
    const pct = grandTotal ? ((subtotal / grandTotal) * 100).toFixed(1) : 0;
    if (!rows.length) return;
    html += `
    <div class="resumen-cat-card">
      <div class="resumen-cat-header" onclick="toggleResumenCat(this)">
        <span class="resumen-cat-name">${name}</span>
        <div style="display:flex;align-items:center;gap:1rem">
          <span style="font-size:0.78rem;color:var(--text-muted)">${pct}%</span>
          <span class="resumen-cat-total">$${subtotal.toLocaleString('es-MX', {minimumFractionDigits:2})}</span>
          <span style="color:var(--text-muted)">▾</span>
        </div>
      </div>
      <div class="resumen-bar"><div class="resumen-bar-fill" style="width:${pct}%"></div></div>
      <div class="resumen-cat-rows">
        ${rows.map(r => `
          <div class="resumen-row">
            <span class="resumen-row-desc">${r.desc} <span style="color:var(--text-muted)">(${r.qty} ${r.unit})</span></span>
            <span class="resumen-row-importe">$${((r.qty||0)*(r.price||0)).toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
          </div>
        `).join('')}
      </div>
    </div>`;
  });

  container.innerHTML = html;
}

function toggleResumenCat(el) {
  const rows = el.parentElement.querySelector('.resumen-cat-rows');
  if (rows) rows.style.display = rows.style.display === 'none' ? 'block' : 'none';
}

function showToast(msg) {
  let toast = document.querySelector('.success-toast');
  if (!toast) { toast = document.createElement('div'); toast.className = 'success-toast'; toast.innerHTML = `<span class="toast-icon">✓</span><span class="toast-msg"></span>`; document.body.appendChild(toast); }
  toast.querySelector('.toast-msg').textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// Init
showPanel('seleccionar-obra');
