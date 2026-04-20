/**
 * js/api_client.js
 * Cliente HTTP centralizado para el backend de Obras Públicas.
 * Inyecta automáticamente los headers de autenticación
 * desde sessionStorage en cada petición.
 */

const API_BASE = window.API_BASE || "obraspublicas-production.up.railway.app";

// ── Usuario actual ───────────────────────────────────────────────
function getCurrentUser() {
  return JSON.parse(sessionStorage.getItem("op_user") || "null");
}

// ── Headers de autenticación ─────────────────────────────────────
function authHeaders() {
  const u = getCurrentUser();
  if (!u) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    "X-User-Role":     u.role,
    "X-User-Id":       u.id,
    "X-User-Nombre":   u.nombre   || "",
    "X-User-Username": u.username || "",
  };
}

// ── Fetch genérico con manejo de errores ─────────────────────────
async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
    });

    const json = await res.json().catch(() => ({
      success: false,
      message: "Respuesta inválida del servidor.",
    }));

    if (!res.ok && !json.success) {
      throw new Error(json.message || `HTTP ${res.status}`);
    }
    return json;

  } catch (err) {
    // Re-lanzar para que cada llamador maneje el error con contexto
    throw err;
  }
}

// ── Métodos de conveniencia ──────────────────────────────────────
const API = {
  get:    (path)       => apiFetch(path, { method: "GET" }),
  post:   (path, body) => apiFetch(path, { method: "POST",   body: JSON.stringify(body) }),
  put:    (path, body) => apiFetch(path, { method: "PUT",    body: JSON.stringify(body) }),
  delete: (path)       => apiFetch(path, { method: "DELETE" }),
};


// ================================================================
//  AUTH
// ================================================================

/**
 * Inicia sesión contra el backend.
 * Reemplaza la comparación con mockUsers en main.js.
 */
async function loginUser(username, password, role) {
  const json = await API.post("/api/auth/login", { username, password, role });
  if (json.success && json.data) {
    sessionStorage.setItem("op_user", JSON.stringify(json.data));
  }
  return json;
}


// ================================================================
//  OBRAS
// ================================================================

/**
 * Lista obras con filtros opcionales.
 * @param {object} params - { supervisor, status, q }
 * @returns {Array}
 */
async function fetchObras(params = {}) {
  const query = new URLSearchParams();
  if (params.supervisor) query.append("supervisor", params.supervisor);
  if (params.status)     query.append("status",     params.status);
  if (params.q)          query.append("q",          params.q);
  const qs = query.toString() ? "?" + query.toString() : "";
  const json = await API.get(`/api/obras${qs}`);
  return json.data || [];
}

/**
 * Crea una obra (Paso 3 del wizard del Director).
 */
async function createObra(obraData) {
  return await API.post("/api/obras", obraData);
}

/**
 * Elimina una obra y sus dependencias.
 */
async function deleteObra(id) {
  return await API.delete(`/api/obras/${encodeURIComponent(id.trim())}`);
}


// ================================================================
//  CONSTRUCTORAS
// ================================================================

/**
 * Lista el catálogo de constructoras.
 * @returns {Array}
 */
async function fetchConstructoras() {
  const json = await API.get("/api/constructoras");
  return json.data || [];
}

/**
 * Registra una constructora (Paso 1 del wizard).
 */
async function createConstructora(data) {
  return await API.post("/api/constructoras", data);
}


// ================================================================
//  REGIONES
// ================================================================

/**
 * Lista las regiones/comunidades registradas.
 * @returns {Array}
 */
async function fetchRegiones() {
  const json = await API.get("/api/regiones");
  return json.data || [];
}

/**
 * Registra una región (Paso 2 del wizard).
 */
async function createRegion(data) {
  return await API.post("/api/regiones", data);
}


// ================================================================
//  SUPERVISORES
// ================================================================

/**
 * Lista supervisores para el selector del Paso 3.
 * @returns {Array}
 */
async function fetchSupervisores() {
  const json = await API.get("/api/supervisores");
  return json.data || [];
}


// ================================================================
//  CONCURSOS
// ================================================================

/**
 * Lista concursos (filtro opcional por obra).
 * Disponible para Director (lectura) y Secretaría (escritura).
 */
async function fetchConcursos(obraId = null) {
  const qs = obraId ? `?obra=${encodeURIComponent(obraId)}` : "";
  const json = await API.get(`/api/concursos${qs}`);
  return json.data || [];
}

/**
 * Registra una propuesta de concurso (solo Secretaría).
 */
async function createConcurso(data) {
  return await API.post("/api/concursos", data);
}


// ================================================================
//  FUENTES
// ================================================================

/**
 * Catálogo de fuentes presupuestarias.
 * @returns {Array}
 */
async function fetchFuentes() {
  const json = await API.get("/api/fuentes");
  return json.data || [];
}


// ================================================================
//  INFORMES (SUPERVISOR)
// ================================================================

async function fetchInformes(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v))
  ).toString();
  const json = await API.get(`/api/informes${qs ? "?" + qs : ""}`);
  return json.data || [];
}

async function createInforme(data) {
  return await API.post("/api/informes", data);
}

async function deleteInforme(id) {
  return await API.delete(`/api/informes/${id}`);
}


// ================================================================
//  PRESUPUESTO (PROYECTISTA)
// ================================================================

async function fetchPresupuesto(obraId) {
  const json = await API.get(`/api/presupuestos/${encodeURIComponent(obraId)}`);
  return json.data || null;
}

async function createPresupuesto(obraId) {
  return await API.post("/api/presupuestos", { obraId });
}

async function addCosto(obraId, costoData) {
  return await API.post(`/api/presupuestos/${encodeURIComponent(obraId)}/costos`, costoData);
}

async function updateCosto(obraId, costoId, data) {
  return await API.put(`/api/presupuestos/${encodeURIComponent(obraId)}/costos/${costoId}`, data);
}

async function deleteCosto(obraId, costoId) {
  return await API.delete(`/api/presupuestos/${encodeURIComponent(obraId)}/costos/${costoId}`);
}

async function fetchResumen(obraId) {
  const json = await API.get(`/api/presupuestos/${encodeURIComponent(obraId)}/resumen`);
  return json.data || null;
}


// ================================================================
//  PERMISOS (SECRETARÍA)
// ================================================================

async function fetchPermisos(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v))
  ).toString();
  const json = await API.get(`/api/permisos${qs ? "?" + qs : ""}`);
  return json.data || [];
}

async function createPermiso(data) {
  return await API.post("/api/permisos", data);
}

async function deletePermiso(id) {
  return await API.delete(`/api/permisos/${id}`);
}


// ================================================================
//  ACTAS (SECRETARÍA)
// ================================================================

async function fetchActas(obraId = null) {
  const qs = obraId ? `?obra=${encodeURIComponent(obraId)}` : "";
  const json = await API.get(`/api/actas${qs}`);
  return json.data || [];
}

async function createActa(data) {
  return await API.post("/api/actas", data);
}

async function deleteActa(id) {
  return await API.delete(`/api/actas/${id}`);
}


// ================================================================
//  UTILIDADES DE UI
// ================================================================

/**
 * Muestra un toast de error al usuario cuando el API falla.
 * Depende de que cada módulo exporte showToast().
 */
function handleApiError(err, fallbackMsg = "Error al comunicarse con el servidor.") {
  console.error("[API ERROR]", err);
  if (typeof showToast === "function") {
    showToast(err.message || fallbackMsg, "error");
  }
}
