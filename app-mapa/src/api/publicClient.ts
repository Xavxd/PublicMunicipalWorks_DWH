import type { ApiResponse, PublicObra, Region, ResumenData } from '@/types';

// Use the same backend as the existing platform
const API_BASE = import.meta.env.VITE_API_BASE || 'https://backend-obraspublicas.onrender.com';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const json = (await res.json()) as ApiResponse<T>;

  if (!json.success) {
    throw new Error(json.message || 'API request failed');
  }

  return json.data;
}

// Try the real public API first, fallback to enriched data from existing endpoints
export async function fetchObrasPublic(): Promise<PublicObra[]> {
  try {
    // Try the new public endpoint first
    return await apiFetch<PublicObra[]>('/api/public/obras');
  } catch {
    // Fallback: fetch from existing endpoint (requires auth, but may work if backend supports it)
    try {
      return await apiFetch<PublicObra[]>('/api/obras');
    } catch {
      // Final fallback: return demo data
      return getDemoObras();
    }
  }
}

export async function fetchResumenPublic(): Promise<ResumenData> {
  try {
    return await apiFetch<ResumenData>('/api/public/resumen');
  } catch {
    // Derive from obra data
    try {
      const obras = await fetchObrasPublic();
      return deriveResumenFromObras(obras);
    } catch {
      return deriveResumenFromObras(getDemoObras());
    }
  }
}

export async function fetchRegionesPublic(): Promise<Region[]> {
  try {
    return await apiFetch<Region[]>('/api/public/regiones');
  } catch {
    try {
      return await apiFetch<Region[]>('/api/regiones');
    } catch {
      return getDemoRegions();
    }
  }
}

function deriveResumenFromObras(obras: PublicObra[]): ResumenData {
  const obrasActivas = obras.length;
  const obrasCompletadas = obras.filter(o => o.status === 'completada').length;
  const obrasRetrasadas = obras.filter(o => o.status === 'retrasada').length;
  const inversionTotal = obras.reduce((sum, o) => sum + (o.presupuestoTotal || 0), 0);
  const avancePromedio = obras.length > 0
    ? Math.round(obras.reduce((sum, o) => sum + o.avanceFisico, 0) / obras.length)
    : 0;
  const comunidadesImpactadas = new Set(obras.map(o => o.regionComunidad).filter(Boolean)).size;

  // Budget by region
  const regionMap = new Map<string, { region: string; comunidad: string; total: number }>();
  obras.forEach(o => {
    const key = o.regionId || o.regionComunidad;
    const existing = regionMap.get(key);
    if (existing) {
      existing.total += o.presupuestoTotal || 0;
    } else {
      regionMap.set(key, { region: key, comunidad: o.regionComunidad || key, total: o.presupuestoTotal || 0 });
    }
  });

  // Status distribution
  const statusMap = new Map<string, number>();
  obras.forEach(o => {
    statusMap.set(o.status, (statusMap.get(o.status) || 0) + 1);
  });

  // Recent obras
  const obrasRecientes = [...obras]
    .sort((a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime())
    .slice(0, 8)
    .map(o => ({
      id: o.id,
      nombre: o.nombre,
      fechaInicio: o.fechaInicio,
      status: o.status,
      avanceFisico: o.avanceFisico,
    }));

  // Avg duration
  const promedioDuracionDias = obras.length > 0
    ? Math.round(obras.reduce((sum, o) => {
        const start = new Date(o.fechaInicio).getTime();
        const end = new Date(o.fechaFin).getTime();
        return sum + Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
      }, 0) / obras.length)
    : 0;

  // Top constructoras
  const constMap = new Map<string, number>();
  obras.forEach(o => {
    if (o.constructoraNombre) {
      constMap.set(o.constructoraNombre, (constMap.get(o.constructoraNombre) || 0) + 1);
    }
  });
  const topConstructoras = Array.from(constMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nombre, obrasCount]) => ({ nombre, obrasCount }));

  return {
    obrasActivas,
    obrasCompletadas,
    obrasRetrasadas,
    inversionTotal,
    avancePromedio,
    comunidadesImpactadas,
    presupuestoPorRegion: Array.from(regionMap.values()),
    obrasPorStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
    obrasRecientes,
    promedioDuracionDias,
    topConstructoras,
  };
}

// Demo data for Temascaltepec — realistic public works
function getDemoObras(): PublicObra[] {
  const obras: PublicObra[] = [
    {
      id: 'OBRA000000000000001', expediente: 'EXP-2025-001', nombre: 'Pavimento Hidráulico Calle Principal', descripcion: 'Pavimentación con concreto hidráulico de la calle principal de la comunidad', beneficiarios: '450 habitantes', fechaInicio: '2025-01-15', fechaFin: '2025-06-30', status: 'completada', avanceFisico: 100, avanceFinanciero: 98, presupuestoTotal: 1850000, regionId: 'R001', regionComunidad: 'Temascaltepec de González', regionBarrio: 'Centro', constructoraNombre: 'Constructoras Vías del Sur S.A. de C.V.', constructoraTipo: 'Empresa Externa', supervisorNombre: 'Juan Pérez García', totalInformes: 6,
    },
    {
      id: 'OBRA000000000000002', expediente: 'EXP-2025-002', nombre: 'Rehabilitación de la Escuela Primaria Benito Juárez', descripcion: 'Remodelación de aulas, sanitarios y patio cívico de la escuela primaria', beneficiarios: '280 alumnos', fechaInicio: '2025-02-01', fechaFin: '2025-08-15', status: 'completada', avanceFisico: 100, avanceFinanciero: 100, presupuestoTotal: 2400000, regionId: 'R001', regionComunidad: 'Temascaltepec de González', regionBarrio: 'Centro', constructoraNombre: 'Grupo Constructor del Valle', constructoraTipo: 'Empresa Externa', supervisorNombre: 'María Sánchez López', totalInformes: 7,
    },
    {
      id: 'OBRA000000000000003', expediente: 'EXP-2025-003', nombre: 'Alumbrado Público LED Av. de la Constitución', descripcion: 'Instalación de luminarias LED en la avenida principal del municipio', beneficiarios: '1200 habitantes', fechaInicio: '2025-03-01', fechaFin: '2025-09-30', status: 'completada', avanceFisico: 100, avanceFinanciero: 95, presupuestoTotal: 980000, regionId: 'R001', regionComunidad: 'Temascaltepec de González', regionBarrio: 'Centro', constructoraNombre: 'Electro Instalaciones del Centro', constructoraTipo: 'Empresa Externa', supervisorNombre: 'Carlos Ramírez Torres', totalInformes: 5,
    },
    {
      id: 'OBRA000000000000004', expediente: 'EXP-2025-004', nombre: 'Construcción del Centro de Salud Regional', descripcion: 'Edificación del centro de salud con consultorios, farmacia y área de urgencias', beneficiarios: '3500 habitantes', fechaInicio: '2025-01-10', fechaFin: '2025-12-20', status: 'en_progreso', avanceFisico: 72, avanceFinanciero: 68, presupuestoTotal: 6500000, regionId: 'R001', regionComunidad: 'Temascaltepec de González', regionBarrio: 'Centro', constructoraNombre: 'Constructora Progreso S.A. de C.V.', constructoraTipo: 'Empresa Externa', supervisorNombre: 'Ana Martínez Ruiz', totalInformes: 8,
    },
    {
      id: 'OBRA000000000000005', expediente: 'EXP-2025-005', nombre: 'Pavimentación Camino a San Mateo', descripcion: 'Pavimentación con carpeta asfáltica del camino rural a la comunidad de San Mateo', beneficiarios: '180 habitantes', fechaInicio: '2025-04-01', fechaFin: '2025-10-31', status: 'en_progreso', avanceFisico: 45, avanceFinanciero: 42, presupuestoTotal: 3200000, regionId: 'R002', regionComunidad: 'San Mateo', regionBarrio: 'Barrio San Juan', constructoraNombre: 'Pavimentos y Obbras del Sur', constructoraTipo: 'Empresa Externa', supervisorNombre: 'Pedro Gómez Hernández', totalInformes: 4,
    },
    {
      id: 'OBRA000000000000006', expediente: 'EXP-2025-006', nombre: 'Rehabilitación del Pozo de Agua Potable', descripcion: 'Modernización del sistema de bombeo y rehabilitación de la red de distribución de agua potable', beneficiarios: '800 habitantes', fechaInicio: '2025-02-15', fechaFin: '2025-07-30', status: 'completada', avanceFisico: 100, avanceFinanciero: 100, presupuestoTotal: 1450000, regionId: 'R003', regionComunidad: 'La Finca', regionBarrio: 'Centro', constructoraNombre: 'Ingeniería Hidráulica de México', constructoraTipo: 'Empresa Externa', supervisorNombre: 'Luis Torres Mendoza', totalInformes: 5,
    },
    {
      id: 'OBRA000000000000007', expediente: 'EXP-2025-007', nombre: 'Construcción de Puente Vehicular Río Temascaltepec', descripcion: 'Puente de concreto armado sobre el río Temascaltepec para comunicación intercomunitaria', beneficiarios: '2000 habitantes', fechaInicio: '2025-01-20', fechaFin: '2026-03-31', status: 'en_progreso', avanceFisico: 58, avanceFinanciero: 55, presupuestoTotal: 8900000, regionId: 'R001', regionComunidad: 'Temascaltepec de González', regionBarrio: 'Centro', constructoraNombre: 'Constructora del Pacífico S.A.', constructoraTipo: 'Empresa Externa', supervisorNombre: 'Roberto Díaz Castillo', totalInformes: 6,
    },
    {
      id: 'OBRA000000000000008', expediente: 'EXP-2025-008', nombre: 'Cancha Deportiva Multipropósito El Tejocote', descripcion: 'Construcción de cancha de usos múltiples con gradas y alumbrado en la comunidad', beneficiarios: '320 habitantes', fechaInicio: '2025-05-01', fechaFin: '2025-11-15', status: 'en_progreso', avanceFisico: 35, avanceFinanciero: 30, presupuestoTotal: 780000, regionId: 'R004', regionComunidad: 'El Tejocote', regionBarrio: 'Centro', constructoraNombre: 'Constructora Vías del Sur S.A. de C.V.', constructoraTipo: 'Empresa Externa', supervisorNombre: 'Juan Pérez García', totalInformes: 3,
    },
    {
      id: 'OBRA000000000000009', expediente: 'EXP-2025-009', nombre: 'Drenaje Sanitario Colonia Las Flores', descripcion: 'Construcción de red de drenaje sanitario para la colonia Las Flores', beneficiarios: '600 habitantes', fechaInicio: '2025-03-15', fechaFin: '2025-09-15', status: 'retrasada', avanceFisico: 55, avanceFinanciero: 60, presupuestoTotal: 2100000, regionId: 'R001', regionComunidad: 'Temascaltepec de González', regionBarrio: 'Colonia Las Flores', constructoraNombre: 'Obras Hidráulicas del Centro', constructoraTipo: 'Empresa Externa', supervisorNombre: 'Marta Flores Reyes', totalInformes: 5,
    },
    {
      id: 'OBRA000000000000010', expediente: 'EXP-2025-010', nombre: 'Mercado Municipal Rehabilitación', descripcion: 'Remodelación completa del mercado municipal con locales, área de comida y estacionamiento', beneficiarios: '500 habitantes', fechaInicio: '2025-06-01', fechaFin: '2026-02-28', status: 'en_progreso', avanceFisico: 25, avanceFinanciero: 28, presupuestoTotal: 4200000, regionId: 'R001', regionComunidad: 'Temascaltepec de González', regionBarrio: 'Centro', constructoraNombre: 'Grupo Constructor del Valle', constructoraTipo: 'Empresa Externa', supervisorNombre: 'Miguel Ángel Cruz Soto', totalInformes: 2,
    },
    {
      id: 'OBRA000000000000011', expediente: 'EXP-2025-011', nombre: 'Pavimento Hidráulico Callejón de la Cruz', descripcion: 'Pavimentación con concreto hidráulico del callejón de la Cruz en San Francisco', beneficiarios: '150 habitantes', fechaInicio: '2025-04-15', fechaFin: '2025-10-15', status: 'en_progreso', avanceFisico: 40, avanceFinanciero: 38, presupuestoTotal: 890000, regionId: 'R005', regionComunidad: 'San Francisco', regionBarrio: 'Centro', constructoraNombre: 'Constructora Progreso S.A. de C.V.', constructoraTipo: 'Empresa Externa', supervisorNombre: 'Ana Martínez Ruiz', totalInformes: 3,
    },
    {
      id: 'OBRA000000000000012', expediente: 'EXP-2025-012', nombre: 'Casa de la Cultura y Biblioteca Pública', descripcion: 'Construcción de espacio cultural con biblioteca, sala de computo y área de exposiciones', beneficiarios: '2500 habitantes', fechaInicio: '2025-07-01', fechaFin: '2026-04-30', status: 'en_progreso', avanceFisico: 15, avanceFinanciero: 18, presupuestoTotal: 3800000, regionId: 'R001', regionComunidad: 'Temascaltepec de González', regionBarrio: 'Centro', constructoraNombre: 'Arquitectura y Construcción MX', constructoraTipo: 'Empresa Externa', supervisorNombre: 'Sofía Herrera Luna', totalInformes: 1,
    },
    {
      id: 'OBRA000000000000013', expediente: 'EXP-2025-013', nombre: 'Red Eléctrica Comunidad La Comunidad', descripcion: 'Ampliación de la red de energía eléctrica para nuevas viviendas en la comunidad', beneficiarios: '200 habitantes', fechaInicio: '2025-05-15', fechaFin: '2025-11-30', status: 'en_progreso', avanceFisico: 60, avanceFinanciero: 58, presupuestoTotal: 650000, regionId: 'R006', regionComunidad: 'La Comunidad', regionBarrio: 'Centro', constructoraNombre: 'Electro Instalaciones del Centro', constructoraTipo: 'Empresa Externa', supervisorNombre: 'Carlos Ramírez Torres', totalInformes: 4,
    },
    {
      id: 'OBRA000000000000014', expediente: 'EXP-2025-014', nombre: 'Rehabilitación Carretera Temascaltepec-San Mateo', descripcion: 'Bacheo y recarpeteo de 8km de carretera entre Temascaltepec y San Mateo', beneficiarios: '2500 habitantes', fechaInicio: '2025-08-01', fechaFin: '2026-01-31', status: 'en_progreso', avanceFisico: 20, avanceFinanciero: 22, presupuestoTotal: 5600000, regionId: 'R001', regionComunidad: 'Temascaltepec de González', regionBarrio: 'Carretera Federal', constructoraNombre: 'Pavimentos y Obbras del Sur', constructoraTipo: 'Empresa Externa', supervisorNombre: 'Pedro Gómez Hernández', totalInformes: 2,
    },
    {
      id: 'OBRA000000000000015', expediente: 'EXP-2025-015', nombre: 'Parque Recreativo Infantil Los Pinos', descripcion: 'Construcción de parque infantil con juegos, área verde y kiosco en la colonia Los Pinos', beneficiarios: '900 habitantes', fechaInicio: '2025-06-15', fechaFin: '2025-12-15', status: 'en_progreso', avanceFisico: 50, avanceFinanciero: 48, presupuestoTotal: 1200000, regionId: 'R001', regionComunidad: 'Temascaltepec de González', regionBarrio: 'Colonia Los Pinos', constructoraNombre: 'Constructora Vías del Sur S.A. de C.V.', constructoraTipo: 'Empresa Externa', supervisorNombre: 'Laura Vázquez Morales', totalInformes: 3,
    },
  ];
  return obras;
}

function getDemoRegions(): Region[] {
  return [
    { id: 'R001', comunidad: 'Temascaltepec de González', barrio: 'Centro', colonia: null },
    { id: 'R002', comunidad: 'San Mateo', barrio: 'Barrio San Juan', colonia: null },
    { id: 'R003', comunidad: 'La Finca', barrio: 'Centro', colonia: null },
    { id: 'R004', comunidad: 'El Tejocote', barrio: 'Centro', colonia: null },
    { id: 'R005', comunidad: 'San Francisco', barrio: 'Centro', colonia: null },
    { id: 'R006', comunidad: 'La Comunidad', barrio: 'Centro', colonia: null },
  ];
}
