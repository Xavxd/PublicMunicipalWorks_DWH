// Municipality bounding box for Temascaltepec de González, Estado de México
// Approximate bounds covering the municipality and nearby communities
const BOUNDS = {
  minLat: 18.96,
  maxLat: 19.12,
  minLng: -100.14,
  maxLng: -99.96,
};

// Center of Temascaltepec (approximate)
export const TEMASCALTEPEC_CENTER: [number, number] = [19.0333, -100.0333];

// Default zoom for municipality view
export const DEFAULT_ZOOM = 12;
export const MIN_ZOOM = 10;
export const MAX_ZOOM = 16;

/**
 * Deterministic hash function: string → [0, 1]
 * Uses a simple string hash for consistent, reproducible results
 */
function hash01(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  // Normalize to positive [0, 1]
  return (Math.abs(hash) % 1000000) / 1000000;
}

/**
 * Get a deterministic coordinate for a region (community) within the municipality bounds.
 * Each unique community name will always map to the same location.
 */
function getRegionCenter(comunidad: string): [number, number] {
  const h1 = hash01(comunidad);
  const h2 = hash01(comunidad + '_salt');
  return [
    BOUNDS.minLat + h1 * (BOUNDS.maxLat - BOUNDS.minLat),
    BOUNDS.minLng + h2 * (BOUNDS.maxLng - BOUNDS.minLng),
  ];
}

/**
 * Get deterministic coordinates for an obra.
 * The obra is placed within a small radius (~400m) of its region's center,
 * with the exact offset derived from the obra ID.
 * 
 * This ensures:
 * 1. Same obra always appears at the same position
 * 2. Projects cluster by community
 * 3. Realistic distribution within municipality bounds
 */
export function getObraCoordinates(obraId: string, comunidad: string): [number, number] {
  const [centerLat, centerLng] = getRegionCenter(comunidad);
  const h1 = hash01(obraId + '_lat');
  const h2 = hash01(obraId + '_lng');
  // ~400m offset max (approx 0.0036 degrees at this latitude)
  const offset = 0.0036;
  return [
    centerLat + (h1 - 0.5) * offset * 2,
    centerLng + (h2 - 0.5) * offset * 2,
  ];
}

/**
 * Status color mapping for map markers and UI
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'completada': return '#10b981';
    case 'retrasada': return '#ef4444';
    case 'en_progreso': return '#f59e0b';
    default: return '#3b82f6';
  }
}

/**
 * Status label mapping for display
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'completada': return 'Completada';
    case 'retrasada': return 'Retrasada';
    case 'en_progreso': return 'En Progreso';
    default: return 'Desconocido';
  }
}

/**
 * Format currency as Mexican pesos (compact)
 */
export function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$ ${(amount / 1000000).toFixed(1)} MDP`;
  }
  if (amount >= 1000) {
    return `$ ${(amount / 1000).toFixed(0)} mil`;
  }
  return `$ ${amount.toFixed(0)}`;
}

/**
 * Format date from ISO string to Mexican format
 */
export function formatDate(isoDate: string): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}
