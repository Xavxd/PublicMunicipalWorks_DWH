/**
 * generar_snapshot_mapa.mjs
 * ============================================================================
 * Freezes the three read-only endpoints that the Smart Map (`Urigc/mapa`)
 * consumes, so the published copy of the map works with no server:
 *
 *     GET /api/public/obras     GET /api/public/regiones     GET /api/public/resumen
 *
 * Why a snapshot instead of a second dataset
 * ------------------------------------------
 * The map must show the same works the rest of the demonstration shows. So the
 * source here is not a new fixture: this script loads `docs/js/static_backend.js`
 * — the very module the four role workspaces run against — reads its seed, and
 * projects it into the shapes that `backend/routes/public.py` returns. One
 * dataset, two consumers.
 *
 * Observation date
 * ----------------
 * `public.py` derives a work's status by comparing its end date against *today*.
 * A frozen snapshot cannot do that: run it in 2027 and every synthetic work is
 * "delayed", which would say something false about the portfolio. The snapshot
 * therefore fixes an observation date — the point in the synthetic timeline the
 * dataset is meant to depict — and applies the identical rule against it. The
 * date is printed in the output and documented in the README.
 *
 * Usage
 * -----
 *     node scripts/generar_snapshot_mapa.mjs
 *
 * Writes docs/mapa/api/public/{obras,regiones,resumen}. The files have no
 * extension because that is the path the map requests; `Response.json()` parses
 * them regardless of the content type the host serves them with.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Date the synthetic portfolio depicts. See the note above. */
const FECHA_OBSERVACION = '2025-08-31';

// ---------------------------------------------------------------------------
//  Load the seed from the module the demonstration itself uses.
//  static_backend.js is a browser IIFE, so it gets the minimum globals it
//  touches at load time: a window to publish itself on, and a storage stub.
// ---------------------------------------------------------------------------
function cargarSemilla() {
  const almacen = new Map();
  const storage = {
    getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
    setItem: (k, v) => almacen.set(k, String(v)),
    removeItem: (k) => almacen.delete(k),
  };
  const sandbox = { window: {}, sessionStorage: storage, localStorage: storage, setTimeout, console };
  sandbox.window.sessionStorage = storage;
  vm.createContext(sandbox);
  vm.runInContext(
    readFileSync(resolve(RAIZ, 'docs/js/static_backend.js'), 'utf8'),
    sandbox,
    { filename: 'static_backend.js' },
  );
  if (!sandbox.window.StaticBackend) throw new Error('static_backend.js did not publish window.StaticBackend');
  return sandbox.window.StaticBackend.snapshot();
}

// ---------------------------------------------------------------------------
//  Projections — mirror backend/routes/public.py exactly.
// ---------------------------------------------------------------------------

/** Latest report for a work, newest first by year then month. */
function ultimoInforme(db, obraId) {
  const propios = db.informes
    .filter((i) => i.obraId.trim() === obraId.trim())
    .sort((a, b) => (b.anio - a.anio) || (b.mes - a.mes));
  const ultimo = propios[0];
  return {
    avanceFisico: ultimo ? ultimo.avanceFisico : 0,
    avanceFinanciero: ultimo ? ultimo.avanceFinanciero : 0,
    totalInformes: propios.length,
    ultimoInformeFecha: ultimo
      ? `${ultimo.anio}-${String(ultimo.mes).padStart(2, '0')}-01`
      : null,
  };
}

/** Same three branches as `_derive_obra_status`. */
function derivarStatus(obra, avanceFisico) {
  if (avanceFisico >= 95) return 'completada';
  if (obra.fechaFin && obra.fechaFin < FECHA_OBSERVACION) {
    return avanceFisico >= 90 ? 'completada' : 'retrasada';
  }
  return 'en_progreso';
}

function proyectarObras(db) {
  return db.obras.map((o) => {
    const inf = ultimoInforme(db, o.id);
    const supervisor = db.personal.find((p) => p.id === o.supervisorId);
    const region = db.regiones.find((r) => r.id === o.regionId);
    return {
      id: o.id,
      expediente: o.expediente,
      nombre: o.nombre,
      descripcion: o.descripcion,
      beneficiarios: o.beneficiarios,
      fechaInicio: o.fechaInicio,
      fechaFin: o.fechaFin,
      status: derivarStatus(o, inf.avanceFisico),
      avanceFisico: inf.avanceFisico,
      avanceFinanciero: inf.avanceFinanciero,
      presupuestoTotal: o.presupuesto,
      regionId: o.regionId,
      regionComunidad: o.regionComunidad,
      regionBarrio: o.regionBarrio,
      constructoraNombre: o.constructoraNombre,
      constructoraTipo: o.constructoraTipo,
      supervisorNombre: supervisor
        ? `${supervisor.nombre} ${supervisor.apellidoPaterno}`.trim()
        : '',
      // Coordenada real de la comunidad, para que el visor no tenga que
      // derivarla de un hash. Véase la nota en docs/js/static_backend.js.
      lat: region ? region.lat : null,
      lng: region ? region.lng : null,
      imagenes: Array.isArray(o.imagenes) ? o.imagenes : [],
      totalInformes: inf.totalInformes,
      ultimoInformeFecha: inf.ultimoInformeFecha,
    };
  });
}

function proyectarRegiones(db) {
  return db.regiones
    .map((r) => ({ id: r.id, comunidad: r.comunidad, barrio: r.barrio,
                   colonia: r.colonia ?? null, lat: r.lat, lng: r.lng }))
    .sort((a, b) => a.comunidad.localeCompare(b.comunidad) || a.barrio.localeCompare(b.barrio));
}

function proyectarResumen(obras) {
  const conteos = { completada: 0, en_progreso: 0, retrasada: 0 };
  const porRegion = new Map();
  const porConstructora = new Map();
  const comunidades = new Set();
  let inversion = 0;
  let avance = 0;
  let duracion = 0;

  for (const o of obras) {
    conteos[o.status] = (conteos[o.status] || 0) + 1;
    inversion += o.presupuestoTotal;
    avance += o.avanceFisico;
    comunidades.add(o.regionComunidad);

    if (o.regionComunidad) {
      const clave = o.regionId || o.regionComunidad;
      const fila = porRegion.get(clave)
        || { region: clave, comunidad: o.regionComunidad, total: 0 };
      fila.total += o.presupuestoTotal;
      porRegion.set(clave, fila);
    }
    if (o.constructoraNombre) {
      porConstructora.set(o.constructoraNombre, (porConstructora.get(o.constructoraNombre) || 0) + 1);
    }
    if (o.fechaInicio && o.fechaFin) {
      const dias = Math.round((new Date(o.fechaFin) - new Date(o.fechaInicio)) / 86400000);
      if (dias > 0) duracion += dias;
    }
  }

  const recientes = [...obras]
    .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''))
    .slice(0, 8)
    .map((o) => ({
      id: o.id,
      nombre: o.nombre,
      fechaInicio: o.fechaInicio,
      status: o.status,
      avanceFisico: o.avanceFisico,
    }));

  return {
    obrasActivas: obras.length,
    obrasCompletadas: conteos.completada,
    obrasRetrasadas: conteos.retrasada,
    inversionTotal: inversion,
    avancePromedio: obras.length ? Math.round(avance / obras.length) : 0,
    comunidadesImpactadas: comunidades.size,
    presupuestoPorRegion: [...porRegion.values()],
    obrasPorStatus: Object.entries(conteos)
      .filter(([, n]) => n > 0)
      .map(([status, count]) => ({ status, count })),
    obrasRecientes: recientes,
    promedioDuracionDias: obras.length ? Math.round(duracion / obras.length) : 0,
    topConstructoras: [...porConstructora.entries()]
      .map(([nombre, obrasCount]) => ({ nombre, obrasCount }))
      .sort((a, b) => b.obrasCount - a.obrasCount)
      .slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
//  Write
// ---------------------------------------------------------------------------
const db = cargarSemilla();
const obras = proyectarObras(db);
const salida = resolve(RAIZ, 'docs/mapa/api/public');
mkdirSync(salida, { recursive: true });

const envoltura = (data) => JSON.stringify({ success: true, data, message: '' }, null, 1);
writeFileSync(resolve(salida, 'obras'), envoltura(obras));
writeFileSync(resolve(salida, 'regiones'), envoltura(proyectarRegiones(db)));
writeFileSync(resolve(salida, 'resumen'), envoltura(proyectarResumen(obras)));

const porStatus = obras.reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] || 0) + 1 }), {});
console.log(`Snapshot written to docs/mapa/api/public/ (observation date ${FECHA_OBSERVACION})`);
console.log(`  ${obras.length} works — ${JSON.stringify(porStatus)}`);
console.log(`  ${db.regiones.length} regions, ${db.informes.length} reports in the seed`);
