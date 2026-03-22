const API_BASE = window.API_BASE || "https://backend-obraspublicas.onrender.com";

// ── Leer usuario de sessionStorage ──────────────────────────────
function getCurrentUser() {
  return JSON.parse(sessionStorage.getItem("op_user") || "null");
}

// ── Headers de autenticación ────────────────────────────────────
// Estos headers van en TODAS las peticiones al backend.
// El middleware auth.py los lee para validar el rol y el id.
function authHeaders() {
  const u = getCurrentUser();
  if (!u) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    "X-User-Role": u.role, // Debe ser 'director'
    "X-User-Id":   u.id    // Debe ser 'D001'
  };
}

// ── Fetch helper genérico ────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const json = await res.json().catch(() => ({ success: false, message: "Respuesta inválida del servidor." }));
  if (!res.ok && !json.success) {
    throw new Error(json.message || `HTTP ${res.status}`);
  }
  return json;
}

// ── Métodos de conveniencia ──────────────────────────────────────
const API = {
  get:    (path)         => apiFetch(path, { method: "GET" }),
  post:   (path, body)   => apiFetch(path, { method: "POST",   body: JSON.stringify(body) }),
  put:    (path, body)   => apiFetch(path, { method: "PUT",    body: JSON.stringify(body) }),
  delete: (path)         => apiFetch(path, { method: "DELETE" }),
};


// ── AUTH ─────────────────────────────────────────────────────────
/**
 * Reemplaza: handleLogin() en main.js
 * Llama al backend en lugar de comparar mockUsers.
 */
async function loginUser(username, password, role) {
  const json = await API.post("/api/auth/login", { username, password, role });
  if (json.success) {
    sessionStorage.setItem("op_user", JSON.stringify(json.data));
  }
  return json;
}

// ── OBRAS ─────────────────────────────────────────────────────────
/**
 * Reemplaza: getObras() en director.js / supervisor.js / proyectista.js
 * @param {object} params - filtros opcionales { supervisor, status, q }
 */
async function fetchObras(params = {}) {
  const query = new URLSearchParams();
  if (params.supervisor) query.append("supervisor", params.supervisor);
  if (params.status)     query.append("status", params.status);
  if (params.q)          query.append("q", params.q);

  const json = await API.get(`/api/obras${query.toString() ? "?" + query.toString() : ""}`);
  return json.data || [];
}

/**
 * Reemplaza: submitObra(e) en director.js
 * @param {object} obraData - todos los campos del formulario
 */
async function createObra(obraData) {
  return await API.post("/api/obras", obraData);
}

/**
 * Reemplaza: deleteObra(id) en director.js
 */
async function deleteObra(id) {
  return await API.delete(`/api/obras/${id}`);
}

// ── CONSTRUCTORAS ────────────────────────────────────────────────
/**
 * Reemplaza: getConstructoras() en director.js
 */
async function fetchConstructoras() {
  const json = await API.get("/api/constructoras");
  return json.data || [];
}

/**
 * Reemplaza: saveConstructora() en director.js
 */
async function createConstructora(data) {
  return await API.post("/api/constructoras", data);
}

// ── CONCURSOS ────────────────────────────────────────────────────
/**
 * Reemplaza: getConcursos() en director.js
 */
async function fetchConcursos(obraId = null) {
  const qs = obraId ? `?obra=${obraId}` : "";
  const json = await API.get(`/api/concursos${qs}`);
  return json.data || [];
}

/**
 * Reemplaza: saveConcurso() en director.js
 */
async function createConcurso(data) {
  return await API.post("/api/concursos", data);
}

// ── FUENTES ──────────────────────────────────────────────────────
/**
 * Reemplaza: fuentesCatalog (array hardcodeado) en director.js
 */
async function fetchFuentes() {
  const json = await API.get("/api/fuentes");
  return json.data || [];
}

// ── INFORMES (SUPERVISOR) ────────────────────────────────────────
/**
 * Reemplaza: getInformes() + filtro por supervisorId en supervisor.js
 * El backend ya filtra por supervisor automáticamente desde el header.
 */
async function fetchInformes(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([_, v]) => v))
  ).toString();
  const json = await API.get(`/api/informes${qs ? "?" + qs : ""}`);
  return json.data || [];
}

/**
 * Reemplaza: submitInforme(e) en supervisor.js
 */
async function createInforme(data) {
  return await API.post("/api/informes", data);
}

/**
 * Reemplaza: botón eliminar en el libro de informes
 */
async function deleteInforme(id) {
  return await API.delete(`/api/informes/${id}`);
}

// ── PRESUPUESTO (PROYECTISTA) ────────────────────────────────────
/**
 * Reemplaza: getPresupuestos()[obraId] en proyectista.js
 * Devuelve el presupuesto completo con todos los costos agrupados.
 */
async function fetchPresupuesto(obraId) {
  const json = await API.get(`/api/presupuestos/${obraId}`);
  return json.data || null;
}

/**
 * Reemplaza: savePresupuesto() — crea la cabecera si no existe
 */
async function createPresupuesto(obraId) {
  return await API.post("/api/presupuestos", { obraId });
}

/**
 * Reemplaza: addCostoRow() en proyectista.js
 */
async function addCosto(obraId, costoData) {
  return await API.post(`/api/presupuestos/${obraId}/costos`, costoData);
}

/**
 * Reemplaza: updateRow(index, field, value) en proyectista.js
 */
async function updateCosto(obraId, costoId, data) {
  return await API.put(`/api/presupuestos/${obraId}/costos/${costoId}`, data);
}

/**
 * Reemplaza: deleteRow(index) en proyectista.js
 */
async function deleteCosto(obraId, costoId) {
  return await API.delete(`/api/presupuestos/${obraId}/costos/${costoId}`);
}

/**
 * Reemplaza: renderResumen() en proyectista.js — obtiene totales del servidor
 */
async function fetchResumen(obraId) {
  const json = await API.get(`/api/presupuestos/${obraId}/resumen`);
  return json.data || null;
}

// ── PERMISOS (SECRETARÍA) ────────────────────────────────────────
/**
 * Reemplaza: getData('op_permisos') en secretaria.js
 */
async function fetchPermisos(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([_, v]) => v))
  ).toString();
  const json = await API.get(`/api/permisos${qs ? "?" + qs : ""}`);
  return json.data || [];
}

/**
 * Reemplaza: submitPermiso() en secretaria.js
 */
async function createPermiso(data) {
  return await API.post("/api/permisos", data);
}

/**
 * Reemplaza: deletePermiso(id) en secretaria.js
 */
async function deletePermiso(id) {
  return await API.delete(`/api/permisos/${id}`);
}

// ── ACTAS (SECRETARÍA) ───────────────────────────────────────────
/**
 * Reemplaza: getData('op_actas') en secretaria.js
 */
async function fetchActas(obraId = null) {
  const qs = obraId ? `?obra=${obraId}` : "";
  const json = await API.get(`/api/actas${qs}`);
  return json.data || [];
}

/**
 * Reemplaza: submitActa() en secretaria.js
 */
async function createActa(data) {
  return await API.post("/api/actas", data);
}

/**
 * Reemplaza: deleteActa(id) en secretaria.js
 */
async function deleteActa(id) {
  return await API.delete(`/api/actas/${id}`);
}

// ── Utilidad de error UI ─────────────────────────────────────────
/**
 * Muestra un toast de error al usuario cuando el API falla.
 * Llama al showToast() que ya existe en cada módulo JS.
 */
function handleApiError(err, fallbackMsg = "Error al comunicarse con el servidor.") {
  console.error("[API]", err);
  if (typeof showToast === "function") {
    showToast(err.message || fallbackMsg, "error");
  }
}
