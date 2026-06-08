/* ============================================================
   propuestas.js  v2
   Sistema de Presupuesto Participativo · Temascaltepec
   ------------------------------------------------------------
   CAMBIOS v2:
   - fetchAndRenderNearby(): maneja el nuevo campo usuario_en_area
     de la API. Si el servidor retorna usuario_en_area=false, muestra
     mensaje explicativo en lugar de lista vacía silenciosa.
   ============================================================ */
(function () {
  "use strict";

  const PP_API_BASE = (typeof window !== "undefined" && window.PP_API_BASE)
    || "https://backend-obraspublicas.onrender.com";
  const TOKEN_KEY = "pp_token";
  const USER_KEY = "pp_user";
  const FRAGMENT_URL = "propuestas/propuestas.html";

  const state = {
    mounted: false,
    visible: false,
    fragmentLoaded: false,
    propuestas: [],
    period: null,
    creditsTotal: 3,
    creditsUsed: 0,
    user: null,
    curpVerified: false,
    geoCoords: null,
  };

  function $(id) { return document.getElementById(id); }

  function authHeaders(extra = {}) {
    const headers = { Accept: "application/json", ...extra };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  async function ppFetch(path, options = {}) {
    const opts = {
      method: options.method || "GET",
      headers: authHeaders(options.headers || {}),
    };
    if (options.body !== undefined) {
      if (options.body instanceof FormData) {
        opts.body = options.body;
      } else {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(options.body);
      }
    }
    const res = await fetch(`${PP_API_BASE}${path}`, opts);
    let json;
    try { json = await res.json(); }
    catch (_) { json = { success: false, message: `HTTP ${res.status}` }; }
    if (!res.ok && !json.success) {
      const err = new Error(json.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.payload = json;
      throw err;
    }
    return json;
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showToast(message, variant = "") {
    const toast = $("pp-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("is-error", "is-success");
    if (variant) toast.classList.add(`is-${variant}`);
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 3400);
  }

  // ── Sesión persistida ───────────────────────────────────────
  function loadStoredSession() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) state.user = JSON.parse(raw);
    } catch (_) { state.user = null; }
  }

  function storeSession(token, poblador) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (poblador) {
      localStorage.setItem(USER_KEY, JSON.stringify(poblador));
      state.user = poblador;
    }
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    state.user = null;
    state.creditsUsed = 0;
  }

  // ── Botón de entrada ────────────────────────────────────────
  function ensureLauncherButton() {
    let btn = document.getElementById("pp-launcher-btn");
    if (!btn) {
      const hero = document.querySelector(".hero-content");
      if (!hero) return;
      btn = document.createElement("button");
      btn.id = "pp-launcher-btn";
      btn.type = "button";
      btn.className = "pp-launcher";
      btn.innerHTML = '<span class="pp-launcher__spark" aria-hidden="true"></span>'
        + 'Propuestas de la Comunidad';
      const wrap = document.createElement("div");
      wrap.className = "hero-cta-row";
      wrap.appendChild(btn);
      hero.appendChild(wrap);
    }
    if (btn.dataset.ppBound === "1") return;
    btn.dataset.ppBound = "1";
    btn.addEventListener("click", openModule);
  }

  async function openModule() {
    if (state.visible) return;
    await ensureFragmentLoaded();
    const hero = document.querySelector(".hero");
    const roles = document.querySelector(".roles-section");
    const arch = document.querySelector(".arch-strip");
    const footer = document.querySelector(".site-footer");
    [hero, roles, arch, footer].forEach((el) => el && el.classList.add("pp-hide-original"));
    const root = $("pp-root");
    if (!root) return;
    root.hidden = false;
    document.body.style.overflowY = "auto";
    requestAnimationFrame(() => root.classList.add("is-visible"));
    state.visible = true;
    setTimeout(() => {
      [hero, roles, arch, footer].forEach((el) => el && (el.style.display = "none"));
    }, 600);
    refreshAll();
  }

  function closeModule() {
    if (!state.visible) return;
    const hero = document.querySelector(".hero");
    const roles = document.querySelector(".roles-section");
    const arch = document.querySelector(".arch-strip");
    const footer = document.querySelector(".site-footer");
    [hero, roles, arch, footer].forEach((el) => {
      if (!el) return;
      el.style.display = "";
      requestAnimationFrame(() => el.classList.remove("pp-hide-original"));
    });
    const root = $("pp-root");
    if (!root) return;
    root.classList.remove("is-visible");
    state.visible = false;
    setTimeout(() => { root.hidden = true; }, 700);
  }

  // ── Carga diferida del fragmento HTML ───────────────────────
  async function ensureFragmentLoaded() {
    if (state.fragmentLoaded) return;
    let root = $("pp-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "pp-root";
      root.className = "pp-root";
      root.hidden = true;
      document.body.appendChild(root);
    }
    const res = await fetch(FRAGMENT_URL, { credentials: "same-origin" });
    if (!res.ok) {
      showToast("No se pudo cargar el módulo. Recarga e intenta de nuevo.", "error");
      throw new Error(`Fragmento HTTP ${res.status}`);
    }
    root.innerHTML = await res.text();
    state.fragmentLoaded = true;
    bindModuleEvents();
    renderSession();
  }

  // ── Bind de eventos ─────────────────────────────────────────
  function bindModuleEvents() {
    $("pp-back")?.addEventListener("click", closeModule);
    $("pp-cta-login")?.addEventListener("click", openAuthModal);
    $("pp-logout")?.addEventListener("click", () => {
      clearSession();
      renderSession();
      showToast("Sesión cerrada.");
    });
    $("pp-gps-btn")?.addEventListener("click", requestGeolocation);
    $("pp-fab-new")?.addEventListener("click", openNuevaModal);

    document.querySelectorAll("[data-close-modal]").forEach((el) => {
      el.addEventListener("click", (e) => {
        const modal = e.currentTarget.closest(".pp-modal");
        if (modal) modal.hidden = true;
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      document.querySelectorAll(".pp-modal:not([hidden])").forEach((m) => (m.hidden = true));
    });

    document.querySelectorAll(".pp-tab").forEach((tab) => {
      tab.addEventListener("click", () => switchAuthTab(tab.dataset.tab));
    });

    $("pp-form-login")?.addEventListener("submit", handleLogin);
    $("pp-form-register")?.addEventListener("submit", handleRegister);
    $("pp-form-nueva")?.addEventListener("submit", handleNewPropuesta);
    $("pp-curp-input")?.addEventListener("input", handleCurpInput);
    $("pp-curp-input")?.addEventListener("blur", handleCurpBlur);
    $("pp-detail-vote")?.addEventListener("click", handleDetailVote);
  }

  // ── Render sesión ────────────────────────────────────────────
  function renderSession() {
    const cta = $("pp-cta-login");
    const userBox = $("pp-user");
    const fab = $("pp-fab-new");
    if (state.user) {
      cta && (cta.hidden = true);
      userBox && (userBox.hidden = false);
      const nombre = state.user.nombre_completo
        || `${state.user.nombre || ""} ${state.user.apellidos || ""}`.trim();
      $("pp-user-name").textContent = nombre;
      $("pp-user-avatar").textContent = (nombre || "?").trim().charAt(0).toUpperCase();
      $("pp-user-creds").textContent =
        `${state.creditsTotal - state.creditsUsed} / ${state.creditsTotal} votos`;
      if (fab) fab.hidden = false;
      refreshSession().catch(() => {});
    } else {
      cta && (cta.hidden = false);
      userBox && (userBox.hidden = true);
      if (fab) fab.hidden = true;
    }
  }

  async function refreshSession() {
    if (!state.user) return;
    try {
      const json = await ppFetch("/api/propuestas/auth/me");
      state.creditsTotal = json.data.creditos_totales || 3;
      state.creditsUsed = json.data.creditos_usados || 0;
      state.period = json.data.periodo;
      $("pp-user-creds").textContent =
        `${json.data.creditos_restantes} / ${state.creditsTotal} votos`;
      if (state.period) $("pp-period-pill").textContent = `Periodo ${state.period}`;
    } catch (err) {
      if (err.status === 401) { clearSession(); renderSession(); }
    }
  }

  // ── Refresh general ─────────────────────────────────────────
  async function refreshAll() {
    renderSession();
    await Promise.allSettled([
      fetchAndRenderTrending(),
      fetchAndRenderAll(),
    ]);
  }

  // ── TRENDING ─────────────────────────────────────────────────
  async function fetchAndRenderTrending() {
    const container = $("pp-trending");
    if (!container) return;
    try {
      const json = await ppFetch("/api/propuestas/trending");
      const propuestas = json.data?.propuestas || [];
      state.period = json.data?.periodo || state.period;
      if (state.period) $("pp-period-pill").textContent = `Periodo ${state.period}`;
      if (!propuestas.length) {
        container.innerHTML = `<div class="pp-empty">Aún no hay propuestas en
          el periodo actual. Sé el primero en proponer una obra.</div>`;
        return;
      }
      container.innerHTML = propuestas
        .map((p, idx) => renderCard(p, { rank: idx + 1, variant: "trend" }))
        .join("");
      attachCardEvents(container);
    } catch (err) {
      console.error("[propuestas] trending", err);
      container.innerHTML = `<div class="pp-empty">No pudimos cargar el
        carrusel de trending.</div>`;
    }
  }

  // ── CERCANAS ─────────────────────────────────────────────────
  function requestGeolocation() {
    const hint = $("pp-nearby-hint");
    if (!navigator.geolocation) {
      hint.textContent = "Tu navegador no soporta geolocalización.";
      return;
    }
    hint.textContent = "Solicitando ubicación…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.geoCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        hint.textContent = "Ubicación recibida. Buscando propuestas cercanas…";
        fetchAndRenderNearby();
      },
      (err) => {
        hint.textContent = err && err.code === 1
          ? "Permiso de ubicación negado. Puedes activarlo desde la barra del navegador."
          : "No pudimos obtener tu ubicación. Intenta de nuevo.";
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  async function fetchAndRenderNearby() {
    const container = $("pp-nearby");
    const hint = $("pp-nearby-hint");
    if (!container || !state.geoCoords) return;

    container.innerHTML = `<div class="pp-skeleton-row">
      <div class="pp-skeleton"></div>
      <div class="pp-skeleton"></div>
      <div class="pp-skeleton"></div>
    </div>`;

    try {
      const json = await ppFetch("/api/propuestas/cercanas", {
        method: "POST",
        body: state.geoCoords,
      });

      const data = json.data || {};
      const propuestas = data.propuestas || [];

      // Caso: usuario fuera del municipio
      if (data.usuario_en_area === false) {
        const msg = data.mensaje || "Tu ubicación está fuera del municipio de Temascaltepec.";
        hint.textContent = msg;
        container.innerHTML = `
          <div class="pp-empty">
            📍 ${escapeHtml(msg)}
          </div>`;
        return;
      }

      // Caso: usuario en el municipio pero sin propuestas registradas
      if (!propuestas.length) {
        const msg = data.mensaje || "No hay propuestas registradas cerca de tu comunidad.";
        container.innerHTML = `<div class="pp-empty">${escapeHtml(msg)}</div>`;
        hint.textContent = "Sin coincidencias en tu micro-región.";
        return;
      }

      // Caso exitoso
      hint.textContent = `Mostrando hasta 5 propuestas más cercanas a tu micro-región.`;
      container.innerHTML = propuestas
        .map((p) => renderCard(p, { variant: "nearby" }))
        .join("");
      attachCardEvents(container);

    } catch (err) {
      console.error("[propuestas] cercanas", err);
      container.innerHTML = `<div class="pp-empty">No pudimos cargar las
        propuestas cercanas. Intenta más tarde.</div>`;
    }
  }

  // ── TODAS ────────────────────────────────────────────────────
  async function fetchAndRenderAll() {
    const container = $("pp-all");
    const counter = $("pp-all-count");
    if (!container) return;
    try {
      const json = await ppFetch("/api/propuestas");
      const propuestas = json.data?.propuestas || [];
      state.propuestas = propuestas;
      counter && (counter.textContent = `${propuestas.length} propuestas`);
      if (!propuestas.length) {
        container.innerHTML = `<div class="pp-empty" style="grid-column: span 12;">
          Todavía no hay propuestas publicadas. Cuando alguien registre una,
          aparecerá aquí.</div>`;
        return;
      }
      container.innerHTML = propuestas
        .map((p) => renderCard(p, { variant: "all" }))
        .join("");
      attachCardEvents(container);
    } catch (err) {
      console.error("[propuestas] todas", err);
      container.innerHTML = `<div class="pp-empty" style="grid-column: span 12;">
        No pudimos cargar el listado. Intenta más tarde.</div>`;
    }
  }

  // ── Renderizado de tarjetas ──────────────────────────────────
  function renderCard(p, opts = {}) {
    const rank = opts.rank
      ? `<span class="pp-card__rank">#${opts.rank}</span>` : "";
    const variantClass = opts.variant === "trend" ? "pp-card pp-card--trend" : "pp-card";
    const desc = p.descripcion_obra || "";
    return `
      <article class="${variantClass}" role="listitem" data-id="${p.id}">
        ${rank}
        <span class="pp-card__region">${escapeHtml(p.region)}</span>
        <h4 class="pp-card__title">${escapeHtml(p.titulo)}</h4>
        <p class="pp-card__desc">${escapeHtml(desc)}</p>
        <div class="pp-card__row">
          <span class="pp-card__votes">${p.votos || 0} votos</span>
          <div class="pp-card__actions">
            <button type="button" class="pp-card__btn" data-action="detalle">Ver detalles</button>
            <button type="button" class="pp-card__btn pp-card__btn--vote" data-action="votar">Votar</button>
          </div>
        </div>
      </article>
    `;
  }

  function attachCardEvents(container) {
    container.querySelectorAll(".pp-card").forEach((card) => {
      const id = Number(card.dataset.id);
      card.querySelector('[data-action="detalle"]')?.addEventListener("click", () => {
        openDetailModal(id);
      });
      card.querySelector('[data-action="votar"]')?.addEventListener("click", () => {
        triggerVote(id);
      });
    });
  }

  function findPropuesta(id) {
    return state.propuestas.find((p) => p.id === id) || null;
  }

  // ── Modal detalle ────────────────────────────────────────────
  async function openDetailModal(id) {
    let propuesta = findPropuesta(id);
    if (!propuesta) {
      try {
        const json = await ppFetch(`/api/propuestas/${id}`);
        propuesta = json.data;
      } catch (err) {
        showToast("No pudimos abrir el detalle.", "error");
        return;
      }
    }
    $("pp-detail-region").textContent = propuesta.region || "—";
    $("pp-detail-title").textContent = propuesta.titulo || "Propuesta";
    $("pp-detail-obra").textContent = propuesta.descripcion_obra || "";
    $("pp-detail-benef").textContent = propuesta.descripcion_beneficiados || "";
    $("pp-detail-pros").textContent = propuesta.pros_comunidad || "";
    $("pp-detail-votos").textContent = propuesta.votos || 0;
    $("pp-detail-vote").dataset.id = propuesta.id;
    $("pp-modal-detalle").hidden = false;
  }

  function handleDetailVote(e) {
    const id = Number(e.currentTarget.dataset.id);
    triggerVote(id);
  }

  // ── Votar ────────────────────────────────────────────────────
  async function triggerVote(id) {
    if (!state.user) {
      openAuthModal();
      showToast("Inicia sesión para poder votar.");
      return;
    }
    try {
      const json = await ppFetch(`/api/propuestas/${id}/votar`, { method: "POST" });
      const data = json.data || {};
      state.creditsTotal = data.creditos_totales || state.creditsTotal;
      state.creditsUsed = data.creditos_usados ?? state.creditsUsed + 1;
      showToast("Voto registrado correctamente.", "success");
      $("pp-user-creds").textContent =
        `${data.creditos_restantes ?? Math.max(0, state.creditsTotal - state.creditsUsed)} / ${state.creditsTotal} votos`;
      await refreshAll();
      if (!$("pp-modal-detalle").hidden) {
        $("pp-detail-votos").textContent = data.votos_propuesta || 0;
      }
    } catch (err) {
      showToast(err.message || "No pudimos registrar el voto.", "error");
    }
  }

  // ── Modal AUTH ───────────────────────────────────────────────
  function openAuthModal() {
    const modal = $("pp-modal-auth");
    if (!modal) return;
    switchAuthTab("login");
    modal.hidden = false;
  }

  function switchAuthTab(tab) {
    document.querySelectorAll(".pp-tab").forEach((t) => {
      const active = t.dataset.tab === tab;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll(".pp-form[data-pane]").forEach((form) => {
      form.hidden = form.dataset.pane !== tab;
    });
  }

  async function handleLogin(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const username = form.username.value.trim();
    const password = form.password.value;
    $("pp-login-error").textContent = "";
    if (!username || !password) {
      $("pp-login-error").textContent = "Captura usuario y contraseña.";
      return;
    }
    try {
      const json = await ppFetch("/api/propuestas/auth/login", {
        method: "POST",
        body: { username, password },
      });
      storeSession(json.data.token, json.data.poblador);
      $("pp-modal-auth").hidden = true;
      renderSession();
      await refreshAll();
      showToast(`Bienvenido, ${json.data.poblador.nombre_completo || username}.`, "success");
    } catch (err) {
      $("pp-login-error").textContent = err.message || "Credenciales incorrectas.";
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const curp = (form.curp?.value || "").trim().toUpperCase();

    $("pp-register-error").textContent = "";

    if (curp.length !== 18) {
      $("pp-register-error").textContent = "Ingresa tu CURP de 18 caracteres.";
      return;
    }

    if (!state.curpVerified) {
      // Verificar en el backend antes de registrar
      const ok = await verifyCurp(curp);
      if (!ok) return;
    }

    const body = {
      nombre:    form.nombre.value.trim(),
      apellidos: form.apellidos.value.trim(),
      comunidad: form.comunidad.value.trim(),
      username:  form.username.value.trim(),
      password:  form.password.value,
      curp,
    };

    try {
      const json = await ppFetch("/api/propuestas/auth/register", {
        method: "POST",
        body,
      });
      storeSession(json.data.token, json.data.poblador);
      $("pp-modal-auth").hidden = true;
      renderSession();
      await refreshAll();
      showToast(`Cuenta creada. Bienvenido, ${json.data.poblador.nombre_completo}.`, "success");
    } catch (err) {
      $("pp-register-error").textContent = err.message || "No pudimos crear la cuenta.";
    }
  }

  // ── Verificación CURP ────────────────────────────────────────
  function setCurpStatus(type, html) {
    const el = $("pp-curp-message");
    if (!el) return;
    el.innerHTML = html;
    const status = $("pp-curp-status");
    if (status) {
      status.classList.remove("is-success", "is-error", "is-loading");
      if (type) status.classList.add(`is-${type}`);
    }
  }

  // Formatear a mayúsculas mientras escribe
  function handleCurpInput(e) {
    const input = e.currentTarget;
    const pos = input.selectionStart;
    input.value = input.value.toUpperCase();
    input.setSelectionRange(pos, pos);
    // Limpiar estado si el usuario modifica la CURP después de verificarla
    state.curpVerified = false;
    setCurpStatus("", "");
  }

  // Verificar contra el backend al salir del campo
  async function handleCurpBlur(e) {
    const curp = e.currentTarget.value.trim().toUpperCase();
    if (curp.length === 0) return;
    if (curp.length !== 18) {
      setCurpStatus("error", "❌ La CURP debe tener exactamente 18 caracteres.");
      state.curpVerified = false;
      return;
    }
    await verifyCurp(curp);
  }

  async function verifyCurp(curp) {
    setCurpStatus("loading", "⏳ Verificando CURP…");
    state.curpVerified = false;
    try {
      const json = await ppFetch("/api/propuestas/curp/verify", {
        method: "POST",
        body: { curp },
      });
      const data = json.data || {};
      if (data.valida) {
        if (data.ya_registrada) {
          setCurpStatus("error", "❌ Esta CURP ya tiene una cuenta. Inicia sesión.");
          state.curpVerified = false;
          return false;
        }
        setCurpStatus("success", "✅ CURP válida — Estado de México confirmado.");
        state.curpVerified = true;
        return true;
      } else {
        setCurpStatus("error", `❌ ${escapeHtml(data.motivo || "CURP no válida.")}`);
        state.curpVerified = false;
        return false;
      }
    } catch (err) {
      setCurpStatus("error", `❌ ${escapeHtml(err.message || "Error al verificar la CURP.")}`);
      state.curpVerified = false;
      return false;
    }
  }

  // ── Modal nueva propuesta ────────────────────────────────────
  function openNuevaModal() {
    if (!state.user) { openAuthModal(); return; }
    $("pp-modal-nueva").hidden = false;
  }

  async function handleNewPropuesta(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = {
      titulo: form.titulo.value.trim(),
      region: form.region.value.trim(),
      descripcion_obra: form.descripcion_obra.value.trim(),
      descripcion_beneficiados: form.descripcion_beneficiados.value.trim(),
      pros_comunidad: form.pros_comunidad.value.trim(),
    };
    $("pp-nueva-error").textContent = "";
    try {
      await ppFetch("/api/propuestas", { method: "POST", body });
      $("pp-modal-nueva").hidden = true;
      form.reset();
      showToast("Tu propuesta fue publicada.", "success");
      await refreshAll();
    } catch (err) {
      $("pp-nueva-error").textContent = err.message || "No pudimos registrar la propuesta.";
    }
  }

  // ── Boot ─────────────────────────────────────────────────────
  function boot() {
    loadStoredSession();
    ensureLauncherButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.PresupuestoParticipativo = { open: openModule, close: closeModule, state };
})();
