import type { PublicObra, Region, ResumenData } from '@/types';

const API_BASE = 'https://backend-obraspublicas.onrender.com'; // URL fija, sin variable de entorno

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.message || 'API error');
  }
  return json.data;
}

export async function fetchObrasPublic(): Promise<PublicObra[]> {
  return apiFetch<PublicObra[]>('/api/public/obras');
}

export async function fetchResumenPublic(): Promise<ResumenData> {
  return apiFetch<ResumenData>('/api/public/resumen');
}

export async function fetchRegionesPublic(): Promise<Region[]> {
  return apiFetch<Region[]>('/api/public/regiones');
}

// Elimina todas las funciones de demo (getDemoObras, etc.) o déjalas comentadas.
// No las uses en estas funciones.
