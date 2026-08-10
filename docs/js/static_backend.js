/* ============================================================================
   static_backend.js — in-browser stand-in for the Flask reference API.

   Why this file exists
   --------------------
   The published artefact has no server. Every screen of the original prototype
   still calls `/api/...`, so this module answers those calls locally from a
   synthetic dataset held in the visitor's own tab.

   Design constraint: the demonstration credentials are printed on the landing
   page, so anybody can sign in. That is safe because there is nothing shared to
   damage:

     * State lives in `sessionStorage`, which is per-tab and per-origin. One
       visitor's edits are invisible to every other visitor.
     * Closing the tab discards everything; reopening reseeds from the constant
       below. There is no persistence, no network write, no shared database.
     * Credentials are never checked, so no credential can be wrong, leaked or
       brute-forced. Access is open by construction.

   The Flask implementation in `backend/` remains the operational reference; it
   is the one that enforces the read-only `DEMO-` account rules described in the
   README. This file is only the offline demonstration.
   ========================================================================== */
(function () {
  "use strict";

  const STORE_KEY = "op_static_db";
  const SEED_VERSION = 4;

  // ── Synthetic seed ────────────────────────────────────────────────────────
  // Illustrative records for Temascaltepec, State of Mexico. No real municipal,
  // personal or contractual data appears anywhere in this dataset.
  function seed() {
    return {
      _seed: SEED_VERSION,
      constructoras: [
        { id: "CONS-001", nombre: "Constructora Nevado de Toluca S.A. de C.V.", rfc: "CNT980412H35", tipo: "Empresa Externa" },
        { id: "CONS-002", nombre: "Ingeniería Civil Tequesquipan S.C.", rfc: "ICT050817QP2", tipo: "Cooperativa Local" },
        { id: "CONS-003", nombre: "Dirección de Obra Municipal", rfc: "TEM850101AB1", tipo: "Gobierno Municipal" },
      ],
      // Coordenadas reales de cada comunidad, resueltas con Nominatim sobre
      // OpenStreetMap. El visor las usa tal cual: los marcadores caen en la
      // comunidad que les corresponde y no en una posición derivada de un
      // hash, que es como venía el prototipo.
      regiones: [
        { id: "REG-001", comunidad: "Cabecera Municipal", barrio: "Centro", colonia: null, lat: 19.0433733, lng: -100.0414301 },
        { id: "REG-002", comunidad: "San Francisco Oxtotilpan", barrio: "Barrio de Guadalupe", colonia: null, lat: 19.1687972, lng: -99.9019799 },
        { id: "REG-003", comunidad: "San Martín Tequesquipan", barrio: "Barrio Alto", colonia: null, lat: 19.0579275, lng: -99.9466364 },
        { id: "REG-004", comunidad: "Real de Arriba", barrio: "La Mina", colonia: null, lat: 19.0404106, lng: -100.004805 },
        { id: "REG-005", comunidad: "San Mateo Almomoloa", barrio: "Barrio del Puente", colonia: null, lat: 19.1473118, lng: -99.9266991 },
      ],
      fuentes: [
        { id: "FTE-FED-001", nivel: "FEDERAL", programa: "FAIS - FONDO DE INFRAESTRUCTURA SOCIAL MUNICIPAL" },
        { id: "FTE-FED-002", nivel: "FEDERAL", programa: "PROGRAMA DE MEJORAMIENTO URBANO" },
        { id: "FTE-EST-001", nivel: "ESTATAL", programa: "FEFOM - FONDO ESTATAL DE FORTALECIMIENTO MUNICIPAL" },
        { id: "FTE-MUN-001", nivel: "MUNICIPAL", programa: "RECURSO PROPIO MUNICIPAL" },
      ],
      personal: [
        { id: "DEMO-DIR-001", nombre: "Demo", apellidoPaterno: "Director", apellidoMaterno: "ICOKG", username: "demo_director", rol: "Director" },
        { id: "DEMO-SUP-001", nombre: "Demo", apellidoPaterno: "Supervisor", apellidoMaterno: "ICOKG", username: "demo_supervisor", rol: "Supervisor", telefono: "722-000-0001" },
        { id: "DEMO-PRY-001", nombre: "Demo", apellidoPaterno: "Proyectista", apellidoMaterno: "ICOKG", username: "demo_proyectista", rol: "Proyectista", constructoraId: "CONS-001", constructoraNombre: "Constructora Nevado de Toluca S.A. de C.V." },
        { id: "DEMO-SEC-001", nombre: "Demo", apellidoPaterno: "Secretario", apellidoMaterno: "ICOKG", username: "demo_secretario", rol: "Secretario" },
        { id: "PER-005", nombre: "Supervisión", apellidoPaterno: "Zona", apellidoMaterno: "Norte", username: "sup_norte", rol: "Supervisor", telefono: "722-000-0002" },
        { id: "PER-006", nombre: "Supervisión", apellidoPaterno: "Zona", apellidoMaterno: "Sur", username: "sup_sur", rol: "Supervisor", telefono: "722-000-0003" },
      ],
      obras: [
        {
          id: "OBR-001", expediente: "TEM-2025-OBR-001",
          nombre: "Pavimentación de la calle Morelos, primera etapa",
          regionId: "REG-001", regionComunidad: "Cabecera Municipal", regionBarrio: "Centro",
          constructoraId: "CONS-001", constructoraNombre: "Constructora Nevado de Toluca S.A. de C.V.", constructoraTipo: "Empresa Externa",
          supervisorId: "DEMO-SUP-001", etapa: 1,
          fechaInicio: "2025-02-03", fechaFin: "2025-07-18",
          presupuesto: 4250000, status: "activa",
          descripcion: "Pavimentación con concreto hidráulico de 620 metros lineales y guarniciones.",
          beneficiarios: "1,840 habitantes", fuentes: ["FTE-FED-001", "FTE-MUN-001"],
        },
        {
          id: "OBR-002", expediente: "TEM-2025-OBR-002",
          nombre: "Rehabilitación de la red de agua potable, San Francisco Oxtotilpan",
          regionId: "REG-002", regionComunidad: "San Francisco Oxtotilpan", regionBarrio: "Barrio de Guadalupe",
          constructoraId: "CONS-002", constructoraNombre: "Ingeniería Civil Tequesquipan S.C.", constructoraTipo: "Cooperativa Local",
          supervisorId: "DEMO-SUP-001", etapa: 2,
          fechaInicio: "2025-03-10", fechaFin: "2025-11-28",
          presupuesto: 6800000, status: "activa",
          descripcion: "Sustitución de 3.2 km de línea de conducción y rehabilitación del tanque de regulación.",
          beneficiarios: "2,410 habitantes", fuentes: ["FTE-FED-001", "FTE-EST-001"],
        },
        {
          id: "OBR-003", expediente: "TEM-2025-OBR-003",
          nombre: "Construcción de aula didáctica, San Martín Tequesquipan",
          regionId: "REG-003", regionComunidad: "San Martín Tequesquipan", regionBarrio: "Barrio Alto",
          constructoraId: "CONS-003", constructoraNombre: "Dirección de Obra Municipal", constructoraTipo: "Gobierno Municipal",
          supervisorId: "PER-005", etapa: 1,
          fechaInicio: "2025-01-20", fechaFin: "2025-06-30",
          presupuesto: 1950000, status: "activa",
          descripcion: "Aula de 6 x 8 metros con instalación eléctrica, mobiliario y rampa de acceso.",
          beneficiarios: "320 habitantes", fuentes: ["FTE-EST-001"],
        },
        {
          id: "OBR-004", expediente: "TEM-2024-OBR-014",
          nombre: "Muro de contención sobre el camino a Real de Arriba",
          regionId: "REG-004", regionComunidad: "Real de Arriba", regionBarrio: "La Mina",
          constructoraId: "CONS-001", constructoraNombre: "Constructora Nevado de Toluca S.A. de C.V.", constructoraTipo: "Empresa Externa",
          supervisorId: "PER-006", etapa: 3,
          fechaInicio: "2024-08-05", fechaFin: "2025-01-31",
          presupuesto: 3120000, status: "inactiva",
          descripcion: "Muro de mampostería de 145 metros con drenaje pluvial y señalización.",
          beneficiarios: "760 habitantes", fuentes: ["FTE-FED-002"],
        },
        {
          id: "OBR-005", expediente: "TEM-2025-OBR-005",
          nombre: "Alumbrado público con luminarias LED, San Mateo Almomoloa",
          regionId: "REG-005", regionComunidad: "San Mateo Almomoloa", regionBarrio: "Barrio del Puente",
          constructoraId: "CONS-002", constructoraNombre: "Ingeniería Civil Tequesquipan S.C.", constructoraTipo: "Cooperativa Local",
          supervisorId: "DEMO-SUP-001", etapa: 1,
          fechaInicio: "2025-04-14", fechaFin: "2025-09-05",
          presupuesto: 2480000, status: "activa",
          descripcion: "Sustitución de 210 luminarias de vapor de sodio por tecnología LED.",
          beneficiarios: "1,120 habitantes", fuentes: ["FTE-MUN-001", "FTE-EST-001"],
        },
        {
          id: "OBR-006", expediente: "TEM-2025-OBR-006",
          nombre: "Techumbre de la plaza cívica, Cabecera Municipal",
          regionId: "REG-001", regionComunidad: "Cabecera Municipal", regionBarrio: "Centro",
          constructoraId: "CONS-003", constructoraNombre: "Dirección de Obra Municipal", constructoraTipo: "Gobierno Municipal",
          supervisorId: "PER-005", etapa: 2,
          fechaInicio: "2025-05-02", fechaFin: "2025-10-17",
          presupuesto: 5340000, status: "activa",
          descripcion: "Estructura metálica de 480 m² con cubierta translúcida y captación pluvial.",
          beneficiarios: "3,050 habitantes", fuentes: ["FTE-FED-002", "FTE-MUN-001"],
        },
      ],
      informes: [
        { id: "INF-0001", obraId: "OBR-001", anio: 2025, mes: 3, avanceFisico: 18, avanceFinanciero: 15, descripcion: "Trazo, nivelación y retiro de carpeta existente en los primeros 180 metros.", documento: "", fechaRegistro: "2025-03-31", supervisorNombre: "Demo Supervisor" },
        { id: "INF-0002", obraId: "OBR-001", anio: 2025, mes: 4, avanceFisico: 42, avanceFinanciero: 38, descripcion: "Colado de concreto hidráulico en 260 metros lineales y guarniciones norte.", documento: "", fechaRegistro: "2025-04-30", supervisorNombre: "Demo Supervisor" },
        { id: "INF-0003", obraId: "OBR-001", anio: 2025, mes: 5, avanceFisico: 67, avanceFinanciero: 61, descripcion: "Guarniciones sur concluidas; inicia banqueta poniente.", documento: "", fechaRegistro: "2025-05-31", supervisorNombre: "Demo Supervisor" },
        { id: "INF-0004", obraId: "OBR-002", anio: 2025, mes: 4, avanceFisico: 12, avanceFinanciero: 20, descripcion: "Excavación de cepa y suministro de tubería para el primer kilómetro.", documento: "", fechaRegistro: "2025-04-30", supervisorNombre: "Demo Supervisor" },
        { id: "INF-0005", obraId: "OBR-002", anio: 2025, mes: 5, avanceFisico: 29, avanceFinanciero: 33, descripcion: "Tendido e interconexión de 1.1 km de línea de conducción.", documento: "", fechaRegistro: "2025-05-31", supervisorNombre: "Demo Supervisor" },
        { id: "INF-0006", obraId: "OBR-005", anio: 2025, mes: 5, avanceFisico: 24, avanceFinanciero: 22, descripcion: "Retiro de 64 luminarias y montaje de 58 equipos LED en el circuito norte.", documento: "", fechaRegistro: "2025-05-31", supervisorNombre: "Demo Supervisor" },
        { id: "INF-0007", obraId: "OBR-004", anio: 2024, mes: 11, avanceFisico: 58, avanceFinanciero: 55, descripcion: "Cimentación y primeros 80 metros de mampostería del muro.", documento: "", fechaRegistro: "2024-11-30", supervisorNombre: "Supervisión Zona Sur" },
        { id: "INF-0008", obraId: "OBR-004", anio: 2025, mes: 1, avanceFisico: 100, avanceFinanciero: 97, descripcion: "Muro concluido, drenaje pluvial probado y señalización colocada.", documento: "", fechaRegistro: "2025-01-31", supervisorNombre: "Supervisión Zona Sur" },
        { id: "INF-0009", obraId: "OBR-003", anio: 2025, mes: 5, avanceFisico: 55, avanceFinanciero: 51, descripcion: "Muros levantados y castillos colados; pendiente la cubierta y la rampa.", documento: "", fechaRegistro: "2025-05-31", supervisorNombre: "Supervisión Zona Norte" },
      ],
      imagenes: [],
      presupuestos: {
        "OBR-001": {
          materiales: [
            { desc: "Concreto hidráulico f'c=250 kg/cm²", unit: "m3", qty: 320, price: 2450 },
            { desc: "Acero de refuerzo del No. 3", unit: "ton", qty: 12, price: 24800 },
            { desc: "Base hidráulica compactada", unit: "m3", qty: 410, price: 480 },
          ],
          mano_obra: [
            { desc: "Cuadrilla de albañilería", unit: "jornal", qty: 480, price: 720 },
            { desc: "Operador de maquinaria", unit: "jornal", qty: 90, price: 1150 },
          ],
          equipo: [
            { desc: "Retroexcavadora", unit: "hora", qty: 160, price: 890 },
            { desc: "Vibrocompactador", unit: "hora", qty: 120, price: 460 },
          ],
          indirectos: [{ desc: "Supervisión técnica y bitácora", unit: "mes", qty: 6, price: 38000 }],
          imprevistos: [{ desc: "Reserva por variación de precios", unit: "global", qty: 1, price: 128000 }],
        },
        "OBR-003": {
          materiales: [
            { desc: "Block hueco de concreto 15x20x40", unit: "pza", qty: 2600, price: 18.5 },
            { desc: "Lámina estructural galvanizada", unit: "m2", qty: 64, price: 385 },
          ],
          mano_obra: [{ desc: "Cuadrilla de construcción", unit: "jornal", qty: 180, price: 700 }],
          equipo: [],
          indirectos: [{ desc: "Dirección de obra", unit: "mes", qty: 5, price: 22000 }],
          imprevistos: [],
        },
      },
      permisos: [
        { id: "PER-0001", obraId: "OBR-001", obraNombre: "Pavimentación de la calle Morelos, primera etapa", instancia: "CONAGUA", oficio: "OF/CNA/2025/0142" },
        { id: "PER-0002", obraId: "OBR-002", obraNombre: "Rehabilitación de la red de agua potable, San Francisco Oxtotilpan", instancia: "SEMARNAT", oficio: "OF/SMN/2025/0087" },
        { id: "PER-0003", obraId: "OBR-006", obraNombre: "Techumbre de la plaza cívica, Cabecera Municipal", instancia: "INAH", oficio: "OF/INAH/2025/0031" },
      ],
      actas: [
        {
          id: "ACT-0001", obraId: "OBR-004",
          obraNombre: "Muro de contención sobre el camino a Real de Arriba",
          fecha: "2025-02-14",
          firmantes: [
            { cargo: "Director de Obras Públicas", nombre: "Demo", apellidoP: "Director", apellidoM: "ICOKG" },
            { cargo: "Supervisor de Obra", nombre: "Supervisión", apellidoP: "Zona", apellidoM: "Sur" },
            { cargo: "Representante de la comunidad", nombre: "Comité", apellidoP: "Vecinal", apellidoM: "Real de Arriba" },
          ],
        },
      ],
      concursos: [
        { id: "CNC-0001", obraId: "OBR-001", obraNombre: "Pavimentación de la calle Morelos, primera etapa", constructora: "Constructora Nevado de Toluca S.A. de C.V.", razones: "Propuesta económica más baja y experiencia acreditada en pavimentación con concreto hidráulico.", aprobado: true },
        { id: "CNC-0002", obraId: "OBR-001", obraNombre: "Pavimentación de la calle Morelos, primera etapa", constructora: "Ingeniería Civil Tequesquipan S.C.", razones: "Propuesta técnica solvente, pero el plazo de ejecución excede el programa autorizado.", aprobado: false },
      ],
      propuestas: [
        { id: 1, titulo: "Sendero escolar seguro", region: "Cabecera Municipal", descripcion_obra: "Andador peatonal iluminado de 400 metros entre la primaria y la plaza cívica.", descripcion_beneficiados: "Alrededor de 260 estudiantes y sus familias.", pros_comunidad: "Reduce el riesgo vial en el trayecto escolar y ordena el paso peatonal.", votos: 184, lat: 19.0452, lng: -100.0431 },
        { id: 2, titulo: "Mejoramiento de la cancha comunitaria", region: "San Martín Tequesquipan", descripcion_obra: "Rehabilitación de la superficie de juego, gradas y malla perimetral.", descripcion_beneficiados: "Ligas juveniles y actividades escolares del barrio.", pros_comunidad: "Recupera el único espacio deportivo techado de la comunidad.", votos: 126, lat: 19.0688, lng: -100.0207 },
        { id: 3, titulo: "Captación de agua de lluvia en la escuela", region: "San Francisco Oxtotilpan", descripcion_obra: "Sistema de captación y filtrado con cisterna de 20 m³.", descripcion_beneficiados: "180 estudiantes y personal docente.", pros_comunidad: "Asegura agua para servicios sanitarios durante el estiaje.", votos: 98, lat: 19.1024, lng: -100.0916 },
        { id: 4, titulo: "Rehabilitación del camino saca-cosechas", region: "Real de Arriba", descripcion_obra: "Revestimiento y obras de drenaje en 2.6 km de camino rural.", descripcion_beneficiados: "94 unidades de producción agrícola.", pros_comunidad: "Reduce pérdidas por traslado en temporada de lluvias.", votos: 71, lat: 19.0179, lng: -100.0644 },
        { id: 5, titulo: "Luminarias solares en el acceso norte", region: "San Mateo Almomoloa", descripcion_obra: "Instalación de 24 luminarias fotovoltaicas autónomas.", descripcion_beneficiados: "Cerca de 500 habitantes del acceso norte.", pros_comunidad: "Mejora la seguridad nocturna sin aumentar el gasto de energía.", votos: 63, lat: 19.0865, lng: -100.0512 },
      ],
      pobladores: [
        { id: 1, username: "ciudadano_demo", nombre: "Ciudadanía", apellidos: "de Demostración", nombre_completo: "Ciudadanía de Demostración", comunidad: "Cabecera Municipal", curp: "DEMO900101HMCXXX01", creditos_totales: 3, creditos_usados: 0 },
      ],
      votos: [],
      counters: { constructora: 3, region: 5, obra: 6, informe: 9, permiso: 3, acta: 1, concurso: 2, personal: 6, propuesta: 5, poblador: 1, imagen: 0 },
    };
  }

  // ── Store ─────────────────────────────────────────────────────────────────
  let memoryFallback = null;

  function readStore() {
    let raw = null;
    try {
      raw = sessionStorage.getItem(STORE_KEY);
    } catch (_) {
      // Private mode or storage disabled: keep the dataset in memory instead.
      return (memoryFallback = memoryFallback || seed());
    }
    if (!raw) return writeStore(seed());
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      return writeStore(seed());
    }
    if (!parsed || parsed._seed !== SEED_VERSION) return writeStore(seed());
    return parsed;
  }

  function writeStore(db) {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(db));
    } catch (_) {
      memoryFallback = db;
    }
    return db;
  }

  function resetStore() {
    try {
      sessionStorage.removeItem(STORE_KEY);
    } catch (_) { /* ignore */ }
    memoryFallback = null;
    return readStore();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fail(message, status) {
    const err = new Error(message);
    err.status = status || 400;
    err.payload = { success: false, message };
    return err;
  }

  function pad(n, width) {
    return String(n).padStart(width || 4, "0");
  }

  function nextId(db, key, prefix, width) {
    db.counters[key] = (db.counters[key] || 0) + 1;
    return `${prefix}${pad(db.counters[key], width)}`;
  }

  function currentUser() {
    try {
      return JSON.parse(sessionStorage.getItem("op_user") || "null");
    } catch (_) {
      return null;
    }
  }

  function obraById(db, id) {
    const key = String(id || "").trim();
    return db.obras.find((o) => o.id.trim() === key) || null;
  }

  function slugify(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 12);
  }

  function emptyBudget() {
    return { materiales: [], mano_obra: [], equipo: [], indirectos: [], imprevistos: [] };
  }

  function periodoActual() {
    const now = new Date();
    return `${now.getFullYear()}-S${now.getMonth() < 6 ? 1 : 2}`;
  }

  function haversineKm(a, b) {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // ── Route table ───────────────────────────────────────────────────────────
  // Each entry: [method, RegExp over the pathname, handler(db, params, body, query)]
  const routes = [];
  function route(method, pattern, handler) {
    routes.push({ method, pattern, handler });
  }

  // -- Auth -------------------------------------------------------------------
  // Open by construction: any username and password are accepted, and the empty
  // string is a valid input. Nothing is verified because nothing is at risk.
  route("POST", /^\/api\/auth\/login$/, (db, _p, body) => {
    const role = body.role || "Director";
    const known = db.personal.find(
      (p) => p.username === body.username && p.rol === role
    );
    const id = known ? known.id : `DEMO-${slugify(role).slice(0, 3)}-001`;
    const nombre = known
      ? `${known.nombre} ${known.apellidoPaterno}`
      : `Demostración ${role}`;
    return { id, role, nombre, username: body.username || `demo_${role.toLowerCase()}` };
  });

  // -- Obras ------------------------------------------------------------------
  route("GET", /^\/api\/obras$/, (db, _p, _b, query) => {
    let items = db.obras.slice();
    const q = (query.get("q") || "").toLowerCase().trim();
    if (q) {
      items = items.filter(
        (o) =>
          o.nombre.toLowerCase().includes(q) ||
          o.expediente.toLowerCase().includes(q)
      );
    }
    if (query.get("status")) items = items.filter((o) => o.status === query.get("status"));
    if (query.get("supervisor")) items = items.filter((o) => o.supervisorId === query.get("supervisor"));
    if (query.get("fechaDesde")) items = items.filter((o) => o.fechaInicio >= query.get("fechaDesde"));
    if (query.get("fechaHasta")) items = items.filter((o) => o.fechaInicio <= query.get("fechaHasta"));
    return items;
  });

  route("GET", /^\/api\/obras\/activas$/, (db) =>
    db.obras.filter((o) => o.status === "activa")
  );

  route("POST", /^\/api\/obras$/, (db, _p, body) => {
    if (!body.nombre) throw fail("El nombre de la obra es obligatorio.");
    const constructora = db.constructoras.find((c) => c.id === body.constructoraId);
    const region = db.regiones.find((r) => r.id === body.regionId);
    const id = nextId(db, "obra", "OBR-", 3);
    const year = (body.fechaInicio || "").slice(0, 4) || String(new Date().getFullYear());
    const obra = {
      id,
      expediente: `TEM-${year}-OBR-${pad(db.counters.obra, 3)}`,
      nombre: body.nombre,
      regionId: body.regionId,
      regionComunidad: region ? region.comunidad : "—",
      regionBarrio: region ? region.barrio : "",
      constructoraId: body.constructoraId,
      constructoraNombre: constructora ? constructora.nombre : "—",
      constructoraTipo: constructora ? constructora.tipo : "—",
      supervisorId: body.supervisorId,
      etapa: body.etapa || 1,
      fechaInicio: body.fechaInicio,
      fechaFin: body.fechaFin,
      presupuesto: Number(body.presupuesto) || 0,
      status: "activa",
      descripcion: body.descripcion || "Sin descripción.",
      beneficiarios: body.beneficiarios || "—",
      fuentes: body.fuentes || [],
    };
    db.obras.push(obra);
    return { id: obra.id, expediente: obra.expediente };
  });

  route("DELETE", /^\/api\/obras\/([^/]+)$/, (db, params) => {
    const id = decodeURIComponent(params[1]).trim();
    const index = db.obras.findIndex((o) => o.id.trim() === id);
    if (index === -1) throw fail("La obra no existe.", 404);
    db.obras.splice(index, 1);
    db.informes = db.informes.filter((i) => i.obraId.trim() !== id);
    db.permisos = db.permisos.filter((p) => p.obraId.trim() !== id);
    db.actas = db.actas.filter((a) => a.obraId.trim() !== id);
    db.concursos = db.concursos.filter((c) => c.obraId.trim() !== id);
    delete db.presupuestos[id];
    return { id };
  });

  // -- Constructoras / regiones / fuentes / personal ---------------------------
  route("GET", /^\/api\/constructoras$/, (db) => db.constructoras);

  route("POST", /^\/api\/constructoras$/, (db, _p, body) => {
    if (!body.nombre || !body.rfc) throw fail("Nombre y RFC son obligatorios.");
    const existing = db.constructoras.find(
      (c) => c.rfc.toUpperCase() === String(body.rfc).toUpperCase()
    );
    if (existing) return existing;
    const item = {
      id: nextId(db, "constructora", "CONS-", 3),
      nombre: body.nombre,
      rfc: body.rfc,
      tipo: body.tipo || "Empresa Externa",
    };
    db.constructoras.push(item);
    return item;
  });

  route("GET", /^\/api\/regiones$/, (db) => db.regiones);

  route("POST", /^\/api\/regiones$/, (db, _p, body) => {
    if (!body.comunidad || !body.barrio)
      throw fail("Comunidad y barrio son obligatorios.");
    const item = {
      id: nextId(db, "region", "REG-", 3),
      comunidad: body.comunidad,
      barrio: body.barrio,
      colonia: body.colonia || null,
    };
    db.regiones.push(item);
    return item;
  });

  route("GET", /^\/api\/supervisores$/, (db) =>
    db.personal.filter((p) => p.rol === "Supervisor")
  );

  route("GET", /^\/api\/fuentes$/, (db) => db.fuentes);

  route("POST", /^\/api\/fuentes$/, (db, _p, body) => {
    const nivel = String(body.nivel || "").toUpperCase().trim();
    const programa = String(body.programa || "").toUpperCase().trim();
    if (!nivel || !programa) throw fail("Nivel y programa son obligatorios.");
    const existing = db.fuentes.find(
      (f) => f.nivel === nivel && f.programa === programa
    );
    if (existing) return { ...existing, reused: true };
    const item = {
      id: `FTE-${nivel.slice(0, 3)}-${pad(
        db.fuentes.filter((f) => f.nivel === nivel).length + 1,
        3
      )}`,
      nivel,
      programa,
    };
    db.fuentes.push(item);
    return { ...item, reused: false };
  });

  route("GET", /^\/api\/personal$/, (db) => db.personal);

  route("POST", /^\/api\/personal$/, (db, _p, body) => {
    if (!body.nombre || !body.apellidoPaterno || !body.username || !body.rol)
      throw fail("Faltan campos obligatorios del personal.");
    if (db.personal.some((p) => p.username === body.username))
      throw fail("Ese nombre de usuario ya existe.");
    const constructora = db.constructoras.find((c) => c.id === body.constructoraId);
    const item = {
      id: nextId(db, "personal", "PER-", 3),
      nombre: body.nombre,
      apellidoPaterno: body.apellidoPaterno,
      apellidoMaterno: body.apellidoMaterno || "",
      username: body.username,
      rol: body.rol,
    };
    if (body.telefono) item.telefono = body.telefono;
    if (constructora) {
      item.constructoraId = constructora.id;
      item.constructoraNombre = constructora.nombre;
    }
    // The password never leaves this function: it is not stored anywhere.
    db.personal.push(item);
    return item;
  });

  route("DELETE", /^\/api\/personal\/([^/]+)$/, (db, params) => {
    const id = decodeURIComponent(params[1]).trim();
    const index = db.personal.findIndex((p) => p.id.trim() === id);
    if (index === -1) throw fail("El registro de personal no existe.", 404);
    db.personal.splice(index, 1);
    return { id };
  });

  // -- Informes ---------------------------------------------------------------
  function decorateInforme(db, inf) {
    const obra = obraById(db, inf.obraId);
    return {
      ...inf,
      obraNombre: obra ? obra.nombre : "Obra desconocida",
      obraExpediente: obra ? obra.expediente : "—",
    };
  }

  route("GET", /^\/api\/informes$/, (db, _p, _b, query) => {
    let items = db.informes.slice();
    const obra = query.get("obra");
    if (obra) items = items.filter((i) => i.obraId.trim() === obra.trim());
    return items.map((i) => decorateInforme(db, i));
  });

  route("GET", /^\/api\/informes\/por-obra$/, (db) => {
    const user = currentUser();
    const obras = supervisorObras(db, user);
    return obras.map((o) => {
      const informes = db.informes
        .filter((i) => i.obraId.trim() === o.id.trim())
        .sort((a, b) => (b.anio - a.anio) || (b.mes - a.mes));
      const ultimo = informes[0];
      return {
        obraId: o.id,
        obraNombre: o.nombre,
        expediente: o.expediente,
        regionComunidad: o.regionComunidad,
        regionBarrio: o.regionBarrio,
        fechaInicio: o.fechaInicio,
        fechaFin: o.fechaFin,
        totalInformes: informes.length,
        ultimoAvanceFisico: ultimo ? ultimo.avanceFisico : 0,
        ultimoAvanceFinanciero: ultimo ? ultimo.avanceFinanciero : 0,
        informes,
      };
    });
  });

  route("POST", /^\/api\/informes$/, (db, _p, body) => {
    if (!body.obraId) throw fail("Selecciona una obra.");
    const user = currentUser();
    const item = {
      id: nextId(db, "informe", "INF-", 4),
      obraId: body.obraId,
      anio: Number(body.anio) || new Date().getFullYear(),
      mes: Number(body.mes) || 1,
      avanceFisico: Number(body.avanceFisico) || 0,
      avanceFinanciero: Number(body.avanceFinanciero) || 0,
      descripcion: body.descripcion || "Sin descripción.",
      documento: body.documento || "",
      fechaRegistro: new Date().toISOString().slice(0, 10),
      supervisorNombre: (user && user.nombre) || "Demo Supervisor",
    };
    db.informes.push(item);
    return item;
  });

  route("DELETE", /^\/api\/informes\/([^/]+)$/, (db, params) => {
    const id = decodeURIComponent(params[1]).trim();
    const index = db.informes.findIndex((i) => i.id.trim() === id);
    if (index === -1) throw fail("El informe no existe.", 404);
    db.informes.splice(index, 1);
    db.imagenes = db.imagenes.filter((img) => img.informeId.trim() !== id);
    return { id };
  });

  route("GET", /^\/api\/informes\/([^/]+)\/imagenes$/, (db, params) => {
    const id = decodeURIComponent(params[1]).trim();
    return db.imagenes.filter((img) => img.informeId.trim() === id);
  });

  route("DELETE", /^\/api\/imagenes\/([^/]+)$/, (db, params) => {
    const id = decodeURIComponent(params[1]).trim();
    const index = db.imagenes.findIndex((img) => img.id.trim() === id);
    if (index === -1) throw fail("La imagen no existe.", 404);
    db.imagenes.splice(index, 1);
    return { id };
  });

  // -- Supervisor -------------------------------------------------------------
  function supervisorObras(db, user) {
    // Without a server there is no real assignment table; the demonstration
    // supervisor sees the works assigned to the seeded demo account, and any
    // other identity sees the full active portfolio rather than an empty screen.
    const id = user && user.id;
    const own = db.obras.filter((o) => o.supervisorId === id);
    return own.length ? own : db.obras.filter((o) => o.status === "activa");
  }

  route("GET", /^\/api\/supervisor\/obras$/, (db) =>
    supervisorObras(db, currentUser())
  );

  // -- Proyectista ------------------------------------------------------------
  route("GET", /^\/api\/proyectista\/projects$/, (db) =>
    db.obras.map((o) => {
      const budget = db.presupuestos[o.id];
      const hasCosts =
        !!budget &&
        Object.values(budget).some((rows) => Array.isArray(rows) && rows.length);
      return {
        id: o.id,
        expediente: o.expediente,
        nombre: o.nombre,
        regionComunidad: o.regionComunidad,
        presupuesto: o.presupuesto,
        hasCosts,
      };
    })
  );

  route("GET", /^\/api\/proyectista\/budget\/([^/]+)$/, (db, params) => {
    const id = decodeURIComponent(params[1]).trim();
    const obra = obraById(db, id);
    if (!obra) throw fail("La obra no existe.", 404);
    return {
      presupuestoAsignado: obra.presupuesto,
      categories: db.presupuestos[obra.id] || emptyBudget(),
    };
  });

  route("POST", /^\/api\/proyectista\/presupuesto\/([^/]+)$/, (db, params, body) => {
    const id = decodeURIComponent(params[1]).trim();
    const obra = obraById(db, id);
    if (!obra) throw fail("La obra no existe.", 404);
    db.presupuestos[obra.id] = body.categories || emptyBudget();
    return { obraId: obra.id };
  });

  // -- Secretaría: permisos, actas, concursos ---------------------------------
  route("GET", /^\/api\/permisos$/, (db) => db.permisos);

  route("POST", /^\/api\/permisos$/, (db, _p, body) => {
    const obra = obraById(db, body.obraId);
    if (!obra) throw fail("Selecciona una obra válida.");
    if (!body.instancia || !body.oficio)
      throw fail("Instancia y número de oficio son obligatorios.");
    const item = {
      id: nextId(db, "permiso", "PER-", 4),
      obraId: obra.id,
      obraNombre: obra.nombre,
      instancia: body.instancia,
      oficio: body.oficio,
    };
    db.permisos.push(item);
    return item;
  });

  route("DELETE", /^\/api\/permisos\/([^/]+)$/, (db, params) => {
    const id = decodeURIComponent(params[1]).trim();
    const index = db.permisos.findIndex((p) => p.id.trim() === id);
    if (index === -1) throw fail("El oficio no existe.", 404);
    db.permisos.splice(index, 1);
    return { id };
  });

  route("GET", /^\/api\/actas$/, (db) => db.actas);

  route("POST", /^\/api\/actas$/, (db, _p, body) => {
    const obra = obraById(db, body.obraId);
    if (!obra) throw fail("Selecciona una obra válida.");
    const firmantes = (body.firmantes || []).filter((f) => f.nombre && f.apellidoP);
    if (firmantes.length < 3)
      throw fail("Registra al menos 3 firmantes con nombre y apellido paterno.");
    const item = {
      id: nextId(db, "acta", "ACT-", 4),
      obraId: obra.id,
      obraNombre: obra.nombre,
      fecha: body.fecha,
      firmantes: body.firmantes || [],
    };
    db.actas.push(item);
    return item;
  });

  route("DELETE", /^\/api\/actas\/([^/]+)$/, (db, params) => {
    const id = decodeURIComponent(params[1]).trim();
    const index = db.actas.findIndex((a) => a.id.trim() === id);
    if (index === -1) throw fail("El acta no existe.", 404);
    db.actas.splice(index, 1);
    return { id };
  });

  route("GET", /^\/api\/concursos$/, (db, _p, _b, query) => {
    const obra = query.get("obra");
    return obra
      ? db.concursos.filter((c) => c.obraId.trim() === obra.trim())
      : db.concursos;
  });

  route("POST", /^\/api\/concursos$/, (db, _p, body) => {
    const obra = obraById(db, body.obraId);
    if (!obra) throw fail("Selecciona una obra válida.");
    if (!body.constructora || !body.razones)
      throw fail("Constructora y razones son obligatorias.");
    if (body.aprobado && db.concursos.some((c) => c.obraId.trim() === obra.id.trim() && c.aprobado))
      throw fail("Esa obra ya tiene una propuesta aprobada.");
    const item = {
      id: nextId(db, "concurso", "CNC-", 4),
      obraId: obra.id,
      obraNombre: obra.nombre,
      constructora: body.constructora,
      razones: body.razones,
      aprobado: !!body.aprobado,
    };
    db.concursos.push(item);
    return item;
  });

  route("DELETE", /^\/api\/concursos\/([^/]+)$/, (db, params) => {
    const id = decodeURIComponent(params[1]).trim();
    const index = db.concursos.findIndex((c) => c.id.trim() === id);
    if (index === -1) throw fail("El registro no existe.", 404);
    db.concursos.splice(index, 1);
    return { id };
  });

  // -- Presupuesto participativo ----------------------------------------------
  const PP_TOKEN_PREFIX = "pp-demo-token-";
  const TEMASCALTEPEC = { lat: 19.045, lng: -100.043 };
  const AREA_RADIUS_KM = 35;

  function pobladorFromToken() {
    const db = readStore();
    let token = null;
    try {
      token = localStorage.getItem("pp_token");
    } catch (_) { /* ignore */ }
    if (!token || token.indexOf(PP_TOKEN_PREFIX) !== 0) return null;
    const id = Number(token.slice(PP_TOKEN_PREFIX.length));
    return db.pobladores.find((p) => p.id === id) || null;
  }

  function sessionPayload(poblador) {
    return {
      token: `${PP_TOKEN_PREFIX}${poblador.id}`,
      poblador: {
        id: poblador.id,
        username: poblador.username,
        nombre: poblador.nombre,
        apellidos: poblador.apellidos,
        nombre_completo: poblador.nombre_completo,
        comunidad: poblador.comunidad,
      },
    };
  }

  route("GET", /^\/api\/propuestas\/auth\/me$/, (db) => {
    const poblador = pobladorFromToken();
    if (!poblador) throw fail("Sesión no válida.", 401);
    const live = db.pobladores.find((p) => p.id === poblador.id);
    return {
      creditos_totales: live.creditos_totales,
      creditos_usados: live.creditos_usados,
      creditos_restantes: live.creditos_totales - live.creditos_usados,
      periodo: periodoActual(),
    };
  });

  route("POST", /^\/api\/propuestas\/auth\/login$/, (db, _p, body) => {
    // Open access: the seeded citizen account answers to any password, and an
    // unknown username simply creates a fresh demonstration identity.
    const username = (body.username || "").trim();
    if (!username) throw fail("Captura un nombre de usuario.");
    let poblador = db.pobladores.find((p) => p.username === username);
    if (!poblador) {
      poblador = {
        id: ++db.counters.poblador,
        username,
        nombre: username,
        apellidos: "(demostración)",
        nombre_completo: `${username} (demostración)`,
        comunidad: "Cabecera Municipal",
        curp: null,
        creditos_totales: 3,
        creditos_usados: 0,
      };
      db.pobladores.push(poblador);
    }
    return sessionPayload(poblador);
  });

  route("POST", /^\/api\/propuestas\/auth\/register$/, (db, _p, body) => {
    const username = (body.username || "").trim();
    if (!username) throw fail("Captura un nombre de usuario.");
    if (db.pobladores.some((p) => p.username === username))
      throw fail("Ese usuario ya existe. Inicia sesión.");
    const poblador = {
      id: ++db.counters.poblador,
      username,
      nombre: body.nombre || username,
      apellidos: body.apellidos || "",
      nombre_completo: `${body.nombre || username} ${body.apellidos || ""}`.trim(),
      comunidad: body.comunidad || "Cabecera Municipal",
      curp: body.curp || null,
      creditos_totales: 3,
      creditos_usados: 0,
    };
    db.pobladores.push(poblador);
    return sessionPayload(poblador);
  });

  route("POST", /^\/api\/propuestas\/curp\/verify$/, (db, _p, body) => {
    const curp = String(body.curp || "").trim().toUpperCase();
    if (curp.length !== 18)
      return { valida: false, ya_registrada: false, motivo: "La CURP debe tener 18 caracteres." };
    if (!/^[A-Z0-9]{18}$/.test(curp))
      return { valida: false, ya_registrada: false, motivo: "La CURP sólo admite letras y dígitos." };
    const entidad = curp.slice(11, 13);
    if (entidad !== "MC")
      return {
        valida: false,
        ya_registrada: false,
        motivo: "La clave de entidad no corresponde al Estado de México (MC).",
      };
    return {
      valida: true,
      ya_registrada: db.pobladores.some((p) => p.curp === curp),
      motivo: null,
    };
  });

  route("GET", /^\/api\/propuestas$/, (db) => ({
    propuestas: db.propuestas.slice().sort((a, b) => b.votos - a.votos),
    periodo: periodoActual(),
  }));

  route("GET", /^\/api\/propuestas\/trending$/, (db) => ({
    propuestas: db.propuestas.slice().sort((a, b) => b.votos - a.votos).slice(0, 5),
    periodo: periodoActual(),
  }));

  route("POST", /^\/api\/propuestas\/cercanas$/, (db, _p, body) => {
    const point = { lat: Number(body.lat), lng: Number(body.lng) };
    if (!isFinite(point.lat) || !isFinite(point.lng))
      throw fail("Coordenadas no válidas.");
    if (haversineKm(point, TEMASCALTEPEC) > AREA_RADIUS_KM) {
      return {
        usuario_en_area: false,
        propuestas: [],
        mensaje:
          "Tu ubicación está fuera del municipio de Temascaltepec. La demostración sólo cubre esa área.",
      };
    }
    const propuestas = db.propuestas
      .map((p) => ({ ...p, distancia_km: Number(haversineKm(point, p).toFixed(2)) }))
      .sort((a, b) => a.distancia_km - b.distancia_km)
      .slice(0, 5);
    return { usuario_en_area: true, propuestas, mensaje: null };
  });

  route("GET", /^\/api\/propuestas\/(\d+)$/, (db, params) => {
    const id = Number(params[1]);
    const propuesta = db.propuestas.find((p) => p.id === id);
    if (!propuesta) throw fail("La propuesta no existe.", 404);
    return propuesta;
  });

  route("POST", /^\/api\/propuestas\/(\d+)\/votar$/, (db, params) => {
    const poblador = pobladorFromToken();
    if (!poblador) throw fail("Inicia sesión para poder votar.", 401);
    const live = db.pobladores.find((p) => p.id === poblador.id);
    const id = Number(params[1]);
    const propuesta = db.propuestas.find((p) => p.id === id);
    if (!propuesta) throw fail("La propuesta no existe.", 404);
    if (db.votos.some((v) => v.pobladorId === live.id && v.propuestaId === id))
      throw fail("Ya apoyaste esta propuesta en el periodo actual.");
    if (live.creditos_usados >= live.creditos_totales)
      throw fail("Agotaste tus votos del periodo.");
    live.creditos_usados += 1;
    propuesta.votos += 1;
    db.votos.push({ pobladorId: live.id, propuestaId: id });
    return {
      creditos_totales: live.creditos_totales,
      creditos_usados: live.creditos_usados,
      creditos_restantes: live.creditos_totales - live.creditos_usados,
      votos_propuesta: propuesta.votos,
    };
  });

  route("POST", /^\/api\/propuestas$/, (db, _p, body) => {
    const poblador = pobladorFromToken();
    if (!poblador) throw fail("Inicia sesión para registrar una propuesta.", 401);
    if (!body.titulo || !body.region)
      throw fail("El título y la región son obligatorios.");
    const propuesta = {
      id: ++db.counters.propuesta,
      titulo: body.titulo,
      region: body.region,
      descripcion_obra: body.descripcion_obra || "",
      descripcion_beneficiados: body.descripcion_beneficiados || "",
      pros_comunidad: body.pros_comunidad || "",
      votos: 0,
      lat: TEMASCALTEPEC.lat,
      lng: TEMASCALTEPEC.lng,
    };
    db.propuestas.push(propuesta);
    return propuesta;
  });

  // ── Dispatcher ────────────────────────────────────────────────────────────
  async function request(path, options) {
    const opts = options || {};
    const method = (opts.method || "GET").toUpperCase();
    const [rawPath, rawQuery] = String(path).split("?");
    const pathname = rawPath.replace(/\/+$/, "") || "/";
    const query = new URLSearchParams(rawQuery || "");

    let body = opts.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    body = body || {};

    // A short delay keeps the original loading states and spinners meaningful.
    await new Promise((resolve) => setTimeout(resolve, 90));

    const match = routes.find(
      (r) => r.method === method && r.pattern.test(pathname)
    );
    if (!match) throw fail(`Ruta no disponible en la demostración: ${method} ${pathname}`, 404);

    const db = readStore();
    const params = pathname.match(match.pattern);
    const data = match.handler(db, params, body, query);
    writeStore(db);
    return { success: true, data };
  }

  window.StaticBackend = {
    request,
    reset: resetStore,
    snapshot: readStore,
    /** Credentials printed on the landing page. Kept here so the page and the
     *  dataset can never disagree about what they are. */
    demoCredentials: [
      { role: "Director", username: "demo_director", password: "Icokg2026-Dir" },
      { role: "Supervisor", username: "demo_supervisor", password: "Icokg2026-Sup" },
      { role: "Proyectista", username: "demo_proyectista", password: "Icokg2026-Pry" },
      { role: "Secretario", username: "demo_secretario", password: "Icokg2026-Sec" },
    ],
  };
})();
