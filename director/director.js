const userId = localStorage.getItem('user_id');
const userRole = localStorage.getItem('user_role');
const user = JSON.parse(sessionStorage.getItem("op_user") || "null");
const userName = user ? user.nombre : '';

if (!userId || userRole !== 'Director') {
    window.location.href = '../index.html';
}

const userBadge = document.getElementById('user-header-badge');
if (userBadge && userName) {
    userBadge.textContent = `🏛️ ${userName}`; 
}

function logout() {
  sessionStorage.removeItem('user_name');
  window.location.href = '../index.html';
}

// ---- ESTADO DEL WIZARD ----
const wizardState = {
  constructoraId:   null,
  constructoraNombre: null,
  regionId:         null,
  regionLabel:      null,
  currentStep:      1,
};

// ---- PANEL NAVIGATION ----
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = document.getElementById(`panel-${id}`);
  if (target) target.classList.add('active');
  const navLink = document.querySelector(`[data-panel="${id}"]`);
  if (navLink) navLink.classList.add('active');

  if (id === 'nueva-obra')    initWizard();
  if (id === 'obras-list')    renderObrasTable();
  if (id === 'constructoras') renderConstructorasList();
  if (id === 'fuentes')       renderFuentes();
}

// ================================================================
//  WIZARD
// ================================================================

// CAMBIO 1 — agrega resetFuentes() al final para limpiar la lista
// de fuentes cada vez que se inicia un nuevo registro.
function initWizard() {
  // 1. Reiniciar estado del wizard
  wizardState.constructoraId     = null;
  wizardState.constructoraNombre = null;
  wizardState.regionId           = null;
  wizardState.regionLabel        = null;
  wizardState.currentStep        = 1;

  // 2. Limpiar campos del PASO 1
  document.getElementById('c-nombre').value = '';
  document.getElementById('c-rfc').value = '';
  document.getElementById('c-tipo').selectedIndex = 0;
  document.getElementById('step1-confirm').innerHTML = '';  // ← limpiar mensaje

  // 3. Limpiar campos del PASO 2
  document.getElementById('r-comunidad').selectedIndex = 0;
  document.getElementById('r-barrio').value = '';
  document.getElementById('r-colonia').value = '';
  document.getElementById('step2-confirm').innerHTML = '';  // ← limpiar mensaje

  // 4. Limpiar campos del PASO 3 (usando tu función existente)
  limpiarCamposPaso3();   // ya definida

  // 5. Limpiar breadcrumb
  clearWizardBreadcrumb();

  // 6. Limpiar lista de fuentes
  if (typeof resetFuentes === 'function') resetFuentes();

  // 7. Renderizar paso 1 como activo
  renderWizardStep(1);
  updateStepIndicator(1);

}

function renderWizardStep(step) {
  document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`wizard-step-${step}`);
  if (target) target.classList.add('active');
  updateStepIndicator(step);
  wizardState.currentStep = step;
}

function updateStepIndicator(activeStep) {
  document.querySelectorAll('.step-pill').forEach((pill, i) => {
    const stepNum = i + 1;
    pill.classList.remove('active', 'completed');
    if (stepNum < activeStep) pill.classList.add('completed');
    else if (stepNum === activeStep) pill.classList.add('active');
  });
}

function clearWizardBreadcrumb() {
  const el = document.getElementById('wizard-breadcrumb');
  if (el) el.innerHTML = '';
}

function addBreadcrumbChip(icon, text) {
  const el = document.getElementById('wizard-breadcrumb');
  if (!el) return;
  const chip = document.createElement('div');
  chip.className = 'breadcrumb-chip';
  chip.innerHTML = `<span class="bc-icon">${icon}</span><span>${text}</span>`;
  el.appendChild(chip);
  if (el.children.length > 1) {
    const sep = document.createElement('span');
    sep.className = 'bc-sep';
    sep.textContent = '→';
    el.insertBefore(sep, chip);
  }
}

// ================================================================
//  PASO 1 — CONSTRUCTORA EJECUTORA
// ================================================================

// CAMBIO 2 — se elimina el bloque "if (res.ok)" que cortaba el flujo
// antes de guardar wizardState. El resto es idéntico al original.
async function submitConstructora() {
  const nombre = document.getElementById('c-nombre').value.trim();
  const rfc    = document.getElementById('c-rfc').value.trim();
  const tipo   = document.getElementById('c-tipo').value;

  if (!nombre || !rfc || !tipo) {
    showToast("Todos los campos son obligatorios", "error");
    return;
  }

  const btn = document.getElementById('btn-step1');
  setBtnLoading(btn, true);

  try {
    const res = await API.post('/api/constructoras', {
      nombre: nombre.trim(),
      rfc:    rfc.trim(),
      tipo:   tipo,
    });

    wizardState.constructoraId     = res.data.id;
    wizardState.constructoraNombre = nombre;

    document.getElementById('step1-confirm').innerHTML = `
      <div class="confirm-banner">
        <span class="confirm-icon">✓</span>
        <div>
          <div class="confirm-title">Constructora registrada</div>
          <div class="confirm-sub">${nombre} · <code>${res.data.id}</code></div>
        </div>
      </div>`;

    await delay(800);
    addBreadcrumbChip('🏢', nombre);
    renderWizardStep(2);
    showToast(`Constructora registrada con ID ${res.data.id}`);

  } catch (err) {
    showToast("Error al conectar con el servidor", "error");
    handleApiError(err);
  } finally {
    setBtnLoading(btn, false);
  }
}

// ================================================================
//  PASO 2 — REGIÓN / COMUNIDAD
// ================================================================

// CAMBIO 3 — se elimina la llamada a initStep3() (función que se
// borra) y se mueve aquí el resumen de pasos anteriores.
async function submitRegion() {
  const comunidad = document.getElementById('r-comunidad').value.trim();
  const barrio    = document.getElementById('r-barrio').value.trim();
  const colonia   = document.getElementById('r-colonia').value.trim() || null;

  if (!comunidad || !barrio) {
    showToast('Comunidad y barrio son campos obligatorios.', 'error');
    return;
  }

  const btn = document.getElementById('btn-step2');
  setBtnLoading(btn, true);

  try {
    const res = await API.post('/api/regiones', { comunidad, barrio, colonia });

    wizardState.regionId    = res.data.id;
    wizardState.regionLabel = `${comunidad} — ${barrio}`;

    document.getElementById('step2-confirm').innerHTML = `
      <div class="confirm-banner">
        <span class="confirm-icon">✓</span>
        <div>
          <div class="confirm-title">Región registrada</div>
          <div class="confirm-sub">${comunidad} · ${barrio} · <code>${res.data.id}</code></div>
        </div>
      </div>`;

    await delay(800);
    addBreadcrumbChip('📍', `${comunidad} / ${barrio}`);

    await loadSupervisoresSelect();

    // Poblar el resumen de pasos anteriores en el Paso 3
    const summaryEl = document.getElementById('obra-prev-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="prev-summary-row">
          <span class="prev-label">🏢 Constructora</span>
          <span class="prev-val">${wizardState.constructoraNombre} <code>${wizardState.constructoraId}</code></span>
        </div>
        <div class="prev-summary-row">
          <span class="prev-label">📍 Región</span>
          <span class="prev-val">${comunidad} — ${barrio} <code>${res.data.id}</code></span>
        </div>`;
    }

    renderWizardStep(3);
    showToast(`Región registrada con ID ${res.data.id}`);

  } catch (err) {
    handleApiError(err);
  } finally {
    setBtnLoading(btn, false);
  }
}

function goBackStep(step) {
  renderWizardStep(step);
}

// ================================================================
//  PASO 3 — DATOS DE OBRA
// ================================================================

async function loadSupervisoresSelect() {
  const sel = document.getElementById('obra-supervisor');
  if (!sel) return;
  try {
    const supervisores = await API.get('/api/supervisores');
    sel.innerHTML = '<option value="">Seleccionar supervisor…</option>' +
      (supervisores.data || []).map(s =>
        `<option value="${s.id}">${s.nombre} ${s.apellidoPaterno}</option>`
      ).join('');
  } catch {
    sel.innerHTML = '<option value="">Error al cargar supervisores</option>';
  }
}

function limpiarCamposPaso3() {
    // Limpiar campos de texto y número
    document.getElementById('obra-nombre').value = '';
    document.getElementById('obra-presupuesto').value = '';
    document.getElementById('obra-desc').value = '';
    document.getElementById('obra-beneficiarios').value = '';
    
    // Resetear selects a su valor por defecto
    document.getElementById('obra-etapa').selectedIndex = 0;
    document.getElementById('obra-supervisor').selectedIndex = 0;
    
    // Limpiar fechas
    document.getElementById('obra-fecha-inicio').value = '';
    document.getElementById('obra-fecha-fin').value = '';
    
    // Limpiar el resumen de pasos anteriores
    const summaryEl = document.getElementById('obra-prev-summary');
    if (summaryEl) summaryEl.innerHTML = '';
    
    // Limpiar el mensaje de confirmación del paso 3
    document.getElementById('step3-confirm').innerHTML = '';
}

// loadFuentesCheckboxes() — ELIMINADA (el HTML ya no tiene #fuentes-grid-step3)
// initStep3()             — ELIMINADA (absorbida por submitRegion())

async function submitObra(e) {
  e.preventDefault();

  if (!wizardState.constructoraId) {
    showToast('Debes completar el Paso 1: Constructora ejecutora.', 'error');
    renderWizardStep(1); return;
  }
  if (!wizardState.regionId) {
    showToast('Debes completar el Paso 2: Región de la obra.', 'error');
    renderWizardStep(2); return;
  }

  const nombre        = document.getElementById('obra-nombre').value.trim();
  const etapa         = document.getElementById('obra-etapa').value;
  const supervisorId  = document.getElementById('obra-supervisor').value;
  const fechaInicio   = document.getElementById('obra-fecha-inicio').value;
  const fechaFin      = document.getElementById('obra-fecha-fin').value;
  const presupuesto   = parseFloat(document.getElementById('obra-presupuesto').value || 0);
  const descripcion   = document.getElementById('obra-desc').value.trim();
  const beneficiarios = document.getElementById('obra-beneficiarios').value.trim();

  // CAMBIO 4 — ya no lee checkboxes .fuente-check:checked porque ese
  // elemento no existe. Lee el array en memoria que gestiona
  // agregarFuente() desde el <script> inline del HTML.
  const fuentes = typeof getFuentesIds === 'function' ? getFuentesIds() : [];

  if (!nombre || !supervisorId || !fechaInicio || !fechaFin || !beneficiarios) {
    showToast('Completa todos los campos obligatorios marcados con *.', 'error');
    return;
  }
  if (fechaInicio >= fechaFin) {
    showToast('La fecha de inicio debe ser anterior a la fecha de finalización.', 'error');
    return;
  }

  const btn = document.getElementById('btn-submit-obra');
  setBtnLoading(btn, true);

  try {
    const res = await API.post('/api/obras', {
      constructoraId:  wizardState.constructoraId,
      regionId:        wizardState.regionId,
      supervisorId,
      nombre,
      etapa:           parseInt(etapa),
      fechaInicio,
      fechaFin,
      descripcion:     descripcion || 'Sin descripción.',
      beneficiarios,
      presupuesto,
      fuentes,
    });

    const obraId     = res.data.id;
    const expediente = res.data.expediente;

    document.getElementById('step3-confirm').innerHTML = `
      <div class="confirm-banner success-banner">
        <span class="confirm-icon">🏗️</span>
        <div>
          <div class="confirm-title">¡Obra registrada exitosamente!</div>
          <div class="confirm-sub">
            Expediente <strong>${expediente}</strong> · ID interno <code>${obraId}</code>
          </div>
          <div class="confirm-sub" style="margin-top:4px">
            ${fuentes.length} fuente(s) de financiamiento vinculadas
          </div>
        </div>
      </div>`;

    showToast(`Obra "${nombre}" registrada · ${expediente}`);

    await delay(1200);
    limpiarCamposPaso3();
    updateObraCountBadge();
    initWizard();

  } catch (err) {
    handleApiError(err);
    document.getElementById('step3-confirm').innerHTML = '';
  } finally {
    setBtnLoading(btn, false);
  }
}

// ================================================================
//  OBRAS LIST
// ================================================================

async function renderObrasTable(filter = '') {
  const tbody = document.getElementById('obras-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" class="loading-row">
    <div class="loading-spinner"></div> Cargando obras…
  </td></tr>`;

  try {
    const params = filter ? { q: filter } : {};
    const obras  = await fetchObras(params);

    updateObraCountBadge(obras.length);

    if (!obras.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="8">
        <div class="empty-state">
          <div class="empty-icon">🏗️</div>
          <p>No hay obras registradas.</p>
          <button class="btn-primary" onclick="showPanel('nueva-obra')" style="margin-top:1rem">
            Registrar primera obra
          </button>
        </div>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = obras.map(o => `
      <tr>
        <td><code style="font-size:0.78rem;color:var(--text-muted)">${o.expediente}</code></td>
        <td class="obra-name">${o.nombre}</td>
        <td>
          <div style="font-size:0.83rem">${o.regionComunidad}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">${o.regionBarrio || ''}</div>
        </td>
        <td>
          <div style="font-size:0.83rem">${o.constructoraNombre}</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">${o.constructoraTipo}</div>
        </td>
        <td>${formatDate(o.fechaInicio)}</td>
        <td>${formatDate(o.fechaFin)}</td>
        <td><span class="status-badge status-${o.status || 'activa'}">${o.status || 'activa'}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn-danger" onclick="deleteObraConfirm('${o.id}', '${escHtml(o.nombre)}')">✕</button>
          </div>
        </td>
      </tr>`).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p style="color:#ef4444">${err.message || 'Error al conectar con el servidor.'}</p>
        <button class="btn-secondary" onclick="renderObrasTable()" style="margin-top:1rem">Reintentar</button>
      </div>
    </td></tr>`;
  }
}

async function deleteObraConfirm(id, nombre) {
  if (!confirm(`¿Eliminar la obra "${nombre}"?\n\nEsta acción eliminará también sus informes, presupuesto y permisos. No se puede deshacer.`)) return;
  try {
    await deleteObra(id);
    showToast(`Obra "${nombre}" eliminada.`);
    renderObrasTable();
  } catch (err) {
    handleApiError(err);
  }
}

function filterObras(val) { renderObrasTable(val); }

// ================================================================
//  CONSTRUCTORAS LIST
// ================================================================

async function renderConstructorasList() {
  const grid = document.getElementById('constructoras-grid');
  if (!grid) return;
  grid.innerHTML = `<div class="loading-inline">Cargando…</div>`;
  try {
    const constructoras = await fetchConstructoras();
    if (!constructoras.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🏢</div><p>No hay constructoras registradas.</p>
      </div>`;
      return;
    }
    grid.innerHTML = constructoras.map(c => `
      <div class="constructora-card">
        <div class="constructora-icon">🏢</div>
        <div class="constructora-nombre">${c.nombre}</div>
        <div class="constructora-rfc">${c.rfc}</div>
        <span class="constructora-tipo">${c.tipo}</span>
      </div>`).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">⚠️</div>
      <p style="color:#ef4444">${err.message}</p>
    </div>`;
  }
}

// ================================================================
//  FUENTES (panel consulta)
// ================================================================

async function renderFuentes() {
  const el = document.getElementById('fuentes-catalog');
  if (!el) return;
  try {
    const res = await API.get('/api/fuentes');
    const fuentes = res.data || [];
    const nivelClass = { FEDERAL: 'federal', ESTATAL: 'estatal', MUNICIPAL: 'municipal' };
    el.innerHTML = fuentes.map(f => `
      <div class="fuente-card">
        <span class="fuente-card-nivel fuente-tag ${nivelClass[f.nivel] || ''}">${f.nivel}</span>
        <div class="fuente-card-nombre">${f.programa}</div>
        <div class="fuente-card-id"><code>${f.id}</code></div>
      </div>`).join('');
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p style="color:#ef4444">${err.message}</p></div>`;
  }
}

// ================================================================
//  HELPERS GLOBALES
// ================================================================

function updateObraCountBadge(count) {
  const el = document.getElementById('obra-count-badge');
  if (!el) return;
  if (count !== undefined) {
    el.textContent = `${count} obra${count !== 1 ? 's' : ''} registrada${count !== 1 ? 's' : ''}`;
    return;
  }
  fetchObras().then(obras => {
    el.textContent = `${obras.length} obra${obras.length !== 1 ? 's' : ''} registrada${obras.length !== 1 ? 's' : ''}`;
  }).catch(() => {});
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escHtml(str) {
  return (str || '').replace(/'/g, "\\'");
}

function setBtnLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.classList.add('loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function showToast(msg, type = 'success') {
  let toast = document.querySelector('.success-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'success-toast';
    document.body.appendChild(toast);
  }
  const iconColor   = type === 'error' ? '#ef4444' : 'var(--accent-supervisor)';
  const icon        = type === 'error' ? '✕' : '✓';
  const borderColor = type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)';
  toast.innerHTML = `<span class="toast-icon" style="color:${iconColor}">${icon}</span><span class="toast-msg">${msg}</span>`;
  toast.style.borderColor = borderColor;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}



// ---- INIT ----
updateObraCountBadge();
