/* ============================================================================
   api_client.js — published (static) edition.

   Same function surface as the operational client in `js/api_client.js`, so the
   role pages copied from the original prototype run unmodified. The difference
   is the transport: every call is answered by `static_backend.js` inside the
   visitor's own tab instead of by the Flask API. There is no `fetch`, no base
   URL and no credential in this file.
   ========================================================================== */

function getCurrentUser() {
  return JSON.parse(sessionStorage.getItem("op_user") || "null");
}

async function apiFetch(path, options = {}) {
  if (!window.StaticBackend) {
    throw new Error("El módulo de demostración no se cargó. Recarga la página.");
  }
  return window.StaticBackend.request(path, options);
}

const API = {
  get:    (path)       => apiFetch(path, { method: "GET" }),
  post:   (path, body) => apiFetch(path, { method: "POST",   body }),
  put:    (path, body) => apiFetch(path, { method: "PUT",    body }),
  delete: (path)       => apiFetch(path, { method: "DELETE" }),
};


// ================================================================
//  AUTH
// ================================================================

/**
 * Opens a demonstration session. No credential is verified: the published
 * artefact holds no private data and writes nothing outside this tab, so the
 * published username and password cannot unlock anything they should not.
 */
async function loginUser(username, password, role) {
  const json = await API.post("/api/auth/login", { username, password, role });
  if (json.success && json.data) {
    sessionStorage.setItem("op_user", JSON.stringify(json.data));
    // The role pages copied from the prototype read these three keys directly.
    localStorage.setItem("user_id", json.data.id);
    localStorage.setItem("user_role", json.data.role);
    localStorage.setItem("user_name", json.data.nombre);
  }
  return json;
}


// ================================================================
//  OBRAS
// ================================================================

async function fetchObras(params = {}) {
  const query = new URLSearchParams();
  if (params.supervisor) query.append("supervisor", params.supervisor);
  if (params.status)     query.append("status",     params.status);
  if (params.q)          query.append("q",          params.q);
  if (params.fechaDesde) query.append("fechaDesde", params.fechaDesde);
  if (params.fechaHasta) query.append("fechaHasta", params.fechaHasta);
  const qs = query.toString() ? "?" + query.toString() : "";
  const json = await API.get(`/api/obras${qs}`);
  return json.data || [];
}

async function createObra(obraData) {
  return await API.post("/api/obras", obraData);
}

async function deleteObra(id) {
  return await API.delete(`/api/obras/${encodeURIComponent(id.trim())}`);
}


// ================================================================
//  CONSTRUCTORAS
// ================================================================

async function fetchConstructoras() {
  const json = await API.get("/api/constructoras");
  return json.data || [];
}

async function createConstructora(data) {
  return await API.post("/api/constructoras", data);
}


// ================================================================
//  REGIONES
// ================================================================

async function fetchRegiones() {
  const json = await API.get("/api/regiones");
  return json.data || [];
}

async function createRegion(data) {
  return await API.post("/api/regiones", data);
}


// ================================================================
//  SUPERVISORES · CONCURSOS · FUENTES
// ================================================================

async function fetchSupervisores() {
  const json = await API.get("/api/supervisores");
  return json.data || [];
}

async function fetchConcursos(obraId = null) {
  const qs = obraId ? `?obra=${encodeURIComponent(obraId)}` : "";
  const json = await API.get(`/api/concursos${qs}`);
  return json.data || [];
}

async function createConcurso(data) {
  return await API.post("/api/concursos", data);
}

async function fetchFuentes() {
  const json = await API.get("/api/fuentes");
  return json.data || [];
}


// ================================================================
//  INFORMES
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
//  IMÁGENES DE INFORME
// ================================================================
//  The operational build stores evidence in Cloudflare R2. Here the selected
//  files never leave the browser: they are held as object URLs for the current
//  tab and disappear when it closes.

async function uploadInformeImagenes(informeId, files) {
  if (!files || !files.length) return { success: true, data: [] };
  const stored = JSON.parse(sessionStorage.getItem("op_static_blobs") || "{}");
  const data = Array.from(files).map((file, i) => {
    const id = `IMG-${Date.now()}-${i}`;
    return { id, informeId, url: URL.createObjectURL(file), nombreOriginal: file.name };
  });
  stored[informeId] = (stored[informeId] || []).concat(data);
  sessionStorage.setItem("op_static_blobs", JSON.stringify(stored));
  return { success: true, data };
}

async function fetchInformeImagenes(informeId) {
  const stored = JSON.parse(sessionStorage.getItem("op_static_blobs") || "{}");
  return stored[informeId] || [];
}

async function deleteInformeImagen(idImagen) {
  const stored = JSON.parse(sessionStorage.getItem("op_static_blobs") || "{}");
  Object.keys(stored).forEach((key) => {
    stored[key] = stored[key].filter((img) => img.id !== idImagen);
  });
  sessionStorage.setItem("op_static_blobs", JSON.stringify(stored));
  return { success: true, data: { id: idImagen } };
}


// ================================================================
//  PRESUPUESTO (PROYECTISTA)
// ================================================================

async function fetchPresupuesto(obraId) {
  const json = await API.get(`/api/proyectista/budget/${encodeURIComponent(obraId)}`);
  return json.data || null;
}

async function fetchResumen(obraId) {
  return await fetchPresupuesto(obraId);
}


// ================================================================
//  PERMISOS · ACTAS (SECRETARÍA)
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


function handleApiError(err, fallbackMsg = "No se pudo completar la operación en la demostración.") {
  console.error("[STATIC API]", err);
  if (typeof showToast === "function") {
    showToast(err.message || fallbackMsg, "error");
  }
}
