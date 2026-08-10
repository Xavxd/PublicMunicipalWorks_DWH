/* ================================================================
   SUPERVISOR — Informes de Obra
   Integración completa con backend ORM (Flask + SQLAlchemy)
   + Evidencia fotográfica vía Cloudflare R2
   ================================================================ */

// ── Autenticación ──────────────────────────────────────────────
const currentUser = getCurrentUser();

// Validación de sesión y rol (NO TOCAR — función crítica)
if (!currentUser || currentUser.role.toLowerCase() !== 'supervisor') {
  window.location.href = '../index.html';
}

const badge = document.getElementById('user-header-badge');
if (badge) {
  badge.textContent = `📋 ${currentUser?.nombre || currentUser?.username} (${currentUser?.id})`;
}

function logout() {
  sessionStorage.removeItem('op_user');
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_role');
  localStorage.removeItem('user_name');
  window.location.href = '../index.html';
}

// ── Constantes ─────────────────────────────────────────────────
const meses = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Cache de datos
let obrasAsignadas = [];
let informesCache = [];

// ── Estado del selector de imágenes (formulario "Nuevo Informe") ──
const MAX_IMG_BYTES = 10 * 1024 * 1024;       // 10 MB
const ALLOWED_IMG_MIMES = ["image/jpeg", "image/png"];
let imagenesSeleccionadas = [];                // File[] pendientes de subir


// ════════════════════════════════════════════════════════════════
//  API HELPERS ESPECÍFICOS DEL SUPERVISOR
// ════════════════════════════════════════════════════════════════

async function fetchSupervisorObras() {
  const json = await API.get('/api/supervisor/obras');
  return json.data || [];
}

/**
 * Obtiene los informes agrupados por obra del supervisor autenticado.
 * Endpoint: GET /api/informes/por-obra
 */
async function fetchInformesPorObra() {
  const json = await API.get('/api/informes/por-obra');
  return json.data || [];
}


// ════════════════════════════════════════════════════════════════
//  NAVEGACIÓN DE PANELES
// ════════════════════════════════════════════════════════════════

function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`panel-${id}`)?.classList.add('active');
  document.querySelector(`[data-panel="${id}"]`)?.classList.add('active');

  if (id === 'mis-obras')      renderObrasAsignadas();
  if (id === 'nuevo-informe')  populateObraSelect();
  if (id === 'libro-informes') { populateFiltroObra(); renderLibro(); }
}


// ════════════════════════════════════════════════════════════════
//  PANEL: OBRAS ASIGNADAS
// ════════════════════════════════════════════════════════════════

async function renderObrasAsignadas() {
  const grid = document.getElementById('obras-asignadas-grid');
  if (!grid) return;

  // Cargar desde el backend ORM
  try {
    obrasAsignadas = await fetchSupervisorObras();
  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⚠</div><p>Error al cargar obras.</p><p style="font-size:0.8rem;margin-top:0.5rem;color:var(--text-muted)">${err.message || 'Verifica tu conexión.'}</p></div>`;
    return;
  }

  if (!obrasAsignadas.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📋</div><p>No tienes obras asignadas aún.</p><p style="font-size:0.8rem;margin-top:0.5rem;color:var(--text-muted)">El director de obras debe asignarte a una obra primero.</p></div>`;
    return;
  }

  // Precargar informes para calcular avance físico
  let informes = [];
  try {
    informes = await fetchInformes();
  } catch (e) {
    informes = [];
  }

  grid.innerHTML = obrasAsignadas.map(o => {
    const obrasInformes = informes.filter(i => i.obraId === o.id);
    const lastInforme = obrasInformes[obrasInformes.length - 1];
    const fisico = lastInforme ? lastInforme.avanceFisico : 0;
    return `
    <div class="obra-asignada-card" onclick="goToInforme('${o.id}')">
      <div class="oa-expediente">${o.expediente}</div>
      <div class="oa-nombre">${o.nombre}</div>
      <div class="oa-region">📍 ${o.regionComunidad || o.region || '—'}${o.regionBarrio ? ` · ${o.regionBarrio}` : ''}</div>
      <div class="oa-meta">
        <div class="oa-meta-item">Etapa <strong>${o.etapa || 1}</strong></div>
        <div class="oa-meta-item">Inicio <strong>${formatDate(o.fechaInicio)}</strong></div>
        <div class="oa-meta-item"><strong>${obrasInformes.length}</strong> informes</div>
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


// ════════════════════════════════════════════════════════════════
//  PANEL: NUEVO INFORME
// ════════════════════════════════════════════════════════════════

async function populateObraSelect() {
  const sel = document.getElementById('inf-obra');
  if (!sel) return;

  try {
    obrasAsignadas = await fetchSupervisorObras();
  } catch (err) {
    sel.innerHTML = `<option value="">Error al cargar obras</option>`;
    return;
  }

  sel.innerHTML = obrasAsignadas.length
    ? `<option value="">Seleccionar obra…</option>` + obrasAsignadas.map(
        o => `<option value="${o.id}">${o.expediente} — ${o.nombre}</option>`
      ).join('')
    : `<option value="">Sin obras asignadas</option>`;

  // Año actual por defecto
  const yr = document.getElementById('inf-anio');
  if (yr) yr.value = new Date().getFullYear();
}

function onObraChange() {
  const obraId = document.getElementById('inf-obra').value;
  const strip = document.getElementById('obra-info-card');
  if (!obraId || !strip) { strip && (strip.style.display = 'none'); return; }

  const obra = obrasAsignadas.find(o => o.id === obraId);
  if (!obra) return;

  strip.style.display = 'flex';
  strip.innerHTML = `
    <div><span>Obra</span><br/><strong>${obra.nombre}</strong></div>
    <div><span>Región</span><br/><strong>${obra.regionComunidad || obra.region || '—'}</strong></div>
    <div><span>Período</span><br/><strong>${formatDate(obra.fechaInicio)} — ${formatDate(obra.fechaFin)}</strong></div>
    <div><span>Expediente</span><br/><strong>${obra.expediente}</strong></div>
  `;
}

// ── Sliders ────────────────────────────────────────────────────
function updateSlider(type) {
  const val = document.getElementById(`inf-avance-${type}`).value;
  document.getElementById(`${type}-val`).textContent = val + '%';
  document.getElementById(`${type}-bar`).style.width = val + '%';
}

// ── Envío del formulario ───────────────────────────────────────
async function submitInforme(e) {
  e.preventDefault();

  const obraId       = document.getElementById('inf-obra').value;
  const anio         = document.getElementById('inf-anio').value;
  const mes          = document.getElementById('inf-mes').value;
  const avanceFisico = parseInt(document.getElementById('inf-avance-fisico').value);
  const avanceFin    = parseInt(document.getElementById('inf-avance-financiero').value);
  const desc         = document.getElementById('inf-desc').value.trim();
  const documento    = document.getElementById('inf-doc').value.trim();

  if (!obraId) { showToast('Selecciona una obra.'); return; }

  // El supervisorId NO va en el body — el backend lo toma del token de auth
  const payload = {
    obraId: obraId,
    anio: parseInt(anio),
    mes: parseInt(mes),
    avanceFisico: avanceFisico,
    avanceFinanciero: avanceFin,
    descripcion: desc,
    documento: documento
  };

  // Botón "Registrar Informe" — feedback visual
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = 'Registrando...'; }

  try {
    const resp = await createInforme(payload);
    const informeId = resp?.data?.id;

    // Subir imágenes si hay seleccionadas
    if (informeId && imagenesSeleccionadas.length) {
      if (submitBtn) submitBtn.innerHTML = `Subiendo ${imagenesSeleccionadas.length} imagen(es)...`;
      try {
        await uploadInformeImagenes(informeId, imagenesSeleccionadas);
      } catch (errImg) {
        showToast(`Informe creado, pero falló la subida de imágenes: ${errImg.message}`, 'error');
        resetForm();
        return;
      }
    }

    showToast(`Informe de ${meses[parseInt(mes)]} ${anio} registrado exitosamente.`);
    resetForm();
  } catch (err) {
    showToast(err.message || 'Error al registrar el informe.', 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnHtml; }
  }
}

function resetForm() {
  document.getElementById('form-informe').reset();
  document.getElementById('fisico-val').textContent = '0%';
  document.getElementById('financiero-val').textContent = '0%';
  document.getElementById('fisico-bar').style.width = '0%';
  document.getElementById('financiero-bar').style.width = '0%';
  document.getElementById('obra-info-card').style.display = 'none';

  // Restaurar año actual
  const yr = document.getElementById('inf-anio');
  if (yr) yr.value = new Date().getFullYear();

  // Limpiar selección de imágenes
  imagenesSeleccionadas = [];
  renderImagenesPreview();
  const inp = document.getElementById('inf-imagenes');
  if (inp) inp.value = '';
}


// ════════════════════════════════════════════════════════════════
//  SELECTOR DE IMÁGENES (formulario "Nuevo Informe")
// ════════════════════════════════════════════════════════════════

function onImagenesSelected(e) {
  const incoming = Array.from(e.target.files || []);
  for (const f of incoming) {
    if (!ALLOWED_IMG_MIMES.includes(f.type)) {
      showToast(`"${f.name}": solo se aceptan JPG y PNG.`, 'error');
      continue;
    }
    if (f.size > MAX_IMG_BYTES) {
      showToast(`"${f.name}" excede los 10 MB.`, 'error');
      continue;
    }
    // Evitar duplicados (por nombre+tamaño)
    const dup = imagenesSeleccionadas.find(x => x.name === f.name && x.size === f.size);
    if (!dup) imagenesSeleccionadas.push(f);
  }
  // Permitir volver a seleccionar el mismo archivo si se quitó
  e.target.value = '';
  renderImagenesPreview();
}

function removeImagenSeleccionada(idx) {
  imagenesSeleccionadas.splice(idx, 1);
  renderImagenesPreview();
}

function renderImagenesPreview() {
  const wrap = document.getElementById('imagenes-preview');
  if (!wrap) return;

  // Revocar URLs previas para evitar leaks
  wrap.querySelectorAll('img[data-blob]').forEach(img => {
    try { URL.revokeObjectURL(img.src); } catch (_) {}
  });

  if (!imagenesSeleccionadas.length) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = imagenesSeleccionadas.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `
      <div class="imagen-thumb">
        <img src="${url}" data-blob="1" alt="${f.name}"/>
        <button type="button" class="thumb-remove" title="Quitar" onclick="removeImagenSeleccionada(${i})">×</button>
        <div class="thumb-name">${f.name}</div>
      </div>`;
  }).join('');
}


// ════════════════════════════════════════════════════════════════
//  PANEL: LIBRO DE INFORMES
// ════════════════════════════════════════════════════════════════

async function populateFiltroObra() {
  const sel = document.getElementById('filtro-obra-libro');
  if (!sel) return;

  try {
    if (!obrasAsignadas.length) {
      obrasAsignadas = await fetchSupervisorObras();
    }
  } catch (e) {
    // silent fail
  }

  sel.innerHTML = `<option value="">Todas las obras</option>` + obrasAsignadas.map(
    o => `<option value="${o.id}">${o.nombre}</option>`
  ).join('');
}

async function renderLibro() {
  const container = document.getElementById('libro-container');
  if (!container) return;

  const filtro = document.getElementById('filtro-obra-libro')?.value || '';

  try {
    // Precargar obras para mostrar nombres
    if (!obrasAsignadas.length) {
      obrasAsignadas = await fetchSupervisorObras();
    }

    // Si hay filtro de obra específica: usar endpoint tradicional con filtro
    // Si no hay filtro ("Todas las obras"): usar endpoint agrupado por obra
    if (filtro) {
      const params = { obra: filtro };
      informesCache = await fetchInformes(params);
      _renderLibroListaPlana(container, informesCache);
    } else {
      const informesPorObra = await fetchInformesPorObra();
      _renderLibroAgrupado(container, informesPorObra);
    }

    // Cargar galerías de imágenes después del render
    _cargarGaleriasLibro();
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠</div><p>Error al cargar informes.</p><p style="font-size:0.8rem;color:var(--text-muted)">${err.message || 'Intenta de nuevo.'}</p></div>`;
  }
}

/**
 * Renderiza el libro de informes en modo agrupado por obra.
 * Se usa cuando NO hay filtro de obra seleccionado ("Todas las obras").
 */
function _renderLibroAgrupado(container, obrasConInformes) {
  // Aplanar todos los informes para el cache (compatibilidad con funciones existentes)
  informesCache = [];
  obrasConInformes.forEach(obra => {
    obra.informes.forEach(inf => {
      informesCache.push({
        ...inf,
        obraId: obra.obraId,
        obraNombre: obra.obraNombre,
        obraExpediente: obra.expediente,
      });
    });
  });

  // Ordenar globalmente: más recientes primero
  informesCache.sort((a, b) => {
    if (b.anio !== a.anio) return b.anio - a.anio;
    return parseInt(b.mes) - parseInt(a.mes);
  });

  const obrasConDatos = obrasConInformes.filter(o => o.informes.length > 0);

  if (!obrasConDatos.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><p>No hay informes registrados aún.</p></div>`;
    return;
  }

  container.innerHTML = obrasConDatos.map(obra => {
    const informesHtml = obra.informes.map(inf => {
      const mesNombre = meses[parseInt(inf.mes)] || inf.mes;
      return `
      <div class="informe-card">
        <div class="informe-header">
          <div>
            <div class="informe-title">Informe de ${mesNombre} ${inf.anio}</div>
            <div class="informe-meta">ID: ${inf.id}</div>
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
        ${inf.documento ? `<div class="informe-files"><a href="${inf.documento}" target="_blank" class="file-chip" style="text-decoration:none;color:inherit">📎 Ver documento del informe</a></div>` : ''}
        <div class="informe-galeria" id="gal-${inf.id}" data-informe="${inf.id}"></div>
      </div>`;
    }).join('');

    return `
    <div class="libro-obra-grupo">
      <div class="libro-obra-header">
        <div class="libro-obra-title">${obra.obraNombre}</div>
        <div class="libro-obra-meta">
          <span class="libro-obra-exp">${obra.expediente}</span>
          <span class="libro-obra-region">📍 ${obra.regionComunidad || '—'}${obra.regionBarrio ? ` · ${obra.regionBarrio}` : ''}</span>
          <span class="libro-obra-periodo">${formatDate(obra.fechaInicio)} — ${formatDate(obra.fechaFin)}</span>
          <span class="libro-obra-count"><strong>${obra.totalInformes}</strong> informe${obra.totalInformes !== 1 ? 's' : ''}</span>
          <span class="libro-obra-avance">Último avance: <strong class="fisico">${obra.ultimoAvanceFisico}%</strong> físico / <strong class="financiero">${obra.ultimoAvanceFinanciero}%</strong> financiero</span>
        </div>
      </div>
      <div class="libro-obra-informes">
        ${informesHtml}
      </div>
    </div>`;
  }).join('');
}

/**
 * Renderiza el libro de informes en modo lista plana (filtrado por obra).
 * Se usa cuando hay un filtro de obra específico seleccionado.
 */
function _renderLibroListaPlana(container, informes) {
  // Ordenar: más recientes primero (por año desc, mes desc)
  informes.sort((a, b) => {
    if (b.anio !== a.anio) return b.anio - a.anio;
    return parseInt(b.mes) - parseInt(a.mes);
  });

  if (!informes.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><p>No hay informes registrados aún.</p></div>`;
    return;
  }

  container.innerHTML = informes.map(inf => {
    const obra = obrasAsignadas.find(o => o.id === inf.obraId);
    const mesNombre = meses[parseInt(inf.mes)] || inf.mes;
    const fechaReg = inf.fechaRegistro
      ? new Date(inf.fechaRegistro).toLocaleDateString('es-MX')
      : '—';

    return `
    <div class="informe-card">
      <div class="informe-header">
        <div>
          <div class="informe-meta" style="margin-bottom:4px">${obra ? obra.expediente : (inf.obraExpediente || '—')} · ${obra ? obra.nombre : (inf.obraNombre || 'Obra desconocida')}</div>
          <div class="informe-title">Informe de ${mesNombre} ${inf.anio}</div>
          <div class="informe-meta">Supervisor: ${inf.supervisorNombre || currentUser?.nombre || '—'}</div>
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
      ${inf.documento ? `<div class="informe-files"><a href="${inf.documento}" target="_blank" class="file-chip" style="text-decoration:none;color:inherit">📎 Ver documento del informe</a></div>` : ''}
      <div class="informe-galeria" id="gal-${inf.id}" data-informe="${inf.id}"></div>
    </div>`;
  }).join('');
}


// ════════════════════════════════════════════════════════════════
//  GALERÍAS DE IMÁGENES EN EL LIBRO DE INFORMES
// ════════════════════════════════════════════════════════════════

async function _cargarGaleriasLibro() {
  const contenedores = document.querySelectorAll('.informe-galeria[data-informe]');
  // Cargar en paralelo (con un cap pequeño no hace falta limitar)
  await Promise.all(Array.from(contenedores).map(async (el) => {
    const informeId = el.getAttribute('data-informe');
    if (!informeId) return;
    try {
      const imgs = await fetchInformeImagenes(informeId);
      _renderGaleriaInforme(el, informeId, imgs);
    } catch (e) {
      // Si falla la carga de una galería, no rompemos el libro entero
      el.innerHTML = '';
    }
  }));
}

function _renderGaleriaInforme(el, informeId, imagenes) {
  if (!imagenes.length) { el.innerHTML = ''; return; }
  el.innerHTML = imagenes.map(img => `
    <div class="gal-item" onclick="abrirLightbox('${img.url}')">
      <img src="${img.url}" alt="${img.nombreOriginal || 'Evidencia'}" loading="lazy"/>
      <button type="button" class="gal-del" title="Eliminar imagen"
              onclick="event.stopPropagation(); eliminarImagenInforme('${img.id}','${informeId}')">×</button>
    </div>
  `).join('');
}

async function eliminarImagenInforme(idImagen, informeId) {
  if (!confirm('¿Eliminar esta imagen del informe? Esta acción no se puede deshacer.')) return;
  try {
    await deleteInformeImagen(idImagen);
    showToast('Imagen eliminada.');
    // Recargar solo esa galería
    const el = document.getElementById(`gal-${informeId}`);
    if (el) {
      try {
        const imgs = await fetchInformeImagenes(informeId);
        _renderGaleriaInforme(el, informeId, imgs);
      } catch (_) { /* ignore */ }
    }
  } catch (err) {
    showToast(err.message || 'No se pudo eliminar la imagen.', 'error');
  }
}

// ── Lightbox simple ────────────────────────────────────────────
function abrirLightbox(url) {
  let lb = document.getElementById('r2-lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'r2-lightbox';
    lb.className = 'r2-lightbox';
    lb.innerHTML = `
      <button class="lb-close" type="button" onclick="cerrarLightbox()">×</button>
      <img id="r2-lightbox-img" src="" alt="Evidencia"/>
    `;
    lb.addEventListener('click', (e) => { if (e.target === lb) cerrarLightbox(); });
    document.body.appendChild(lb);
  }
  document.getElementById('r2-lightbox-img').src = url;
  lb.classList.add('show');
}
function cerrarLightbox() {
  const lb = document.getElementById('r2-lightbox');
  if (lb) lb.classList.remove('show');
}


// ════════════════════════════════════════════════════════════════
//  UTILIDADES
// ════════════════════════════════════════════════════════════════

function formatDate(d) {
  if (!d) return '—';
  // Soporta ISO (2026-03-15) y formatos locales
  const parts = d.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return d;
}

function showToast(msg, type = 'success') {
  let toast = document.querySelector('.success-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.innerHTML = `<span class="toast-icon"></span><span class="toast-msg"></span>`;
    document.body.appendChild(toast);
  }
  toast.querySelector('.toast-icon').textContent = type === 'error' ? '⚠' : '✓';
  toast.querySelector('.toast-msg').textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}


// ════════════════════════════════════════════════════════════════
//  INICIALIZACIÓN
// ════════════════════════════════════════════════════════════════

// Cargar panel inicial
showPanel('mis-obras');
