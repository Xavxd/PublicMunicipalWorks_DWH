import type { PublicObra, Region, ResumenData } from '@/types';

// Usa variable de entorno si esta disponible, o fallback a Render
const API_BASE = (import.meta as any).env?.VITE_API_URL || 'https://backend-obraspublicas.onrender.com';

export async function fetchObrasPublic(): Promise<PublicObra[]> {
  const res = await fetch(`${API_BASE}/api/public/obras`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'API error');
  return json.data;
}

export async function fetchResumenPublic(): Promise<ResumenData> {
  const res = await fetch(`${API_BASE}/api/public/resumen`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'API error');
  return json.data;
}

export async function fetchRegionesPublic(): Promise<Region[]> {
  const res = await fetch(`${API_BASE}/api/public/regiones`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'API error');
  return json.data;
}
