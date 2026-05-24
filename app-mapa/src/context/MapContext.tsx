import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import type { PublicObra, Filters } from '@/types';
import { useData } from './DataContext';

interface MapContextValue {
  filters: Filters;
  setFilters: (f: Filters | ((prev: Filters) => Filters)) => void;
  filteredObras: PublicObra[];
  selectedObra: PublicObra | null;
  setSelectedObra: (obra: PublicObra | null) => void;
  counts: { todas: number; completada: number; en_progreso: number; retrasada: number };
}

const MapContext = createContext<MapContextValue | null>(null);

export function MapProvider({ children }: { children: ReactNode }) {
  const { obras } = useData();
  const [filters, setFilters] = useState<Filters>({ status: 'todas', region: 'todas', search: '' });
  const [selectedObra, setSelectedObra] = useState<PublicObra | null>(null);

  const filteredObras = useMemo(() => {
    return obras.filter((obra) => {
      if (filters.status !== 'todas' && obra.status !== filters.status) return false;
      if (filters.region !== 'todas' && obra.regionComunidad !== filters.region) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchName = obra.nombre.toLowerCase().includes(q);
        const matchExp = obra.expediente.toLowerCase().includes(q);
        const matchRegion = obra.regionComunidad.toLowerCase().includes(q);
        if (!matchName && !matchExp && !matchRegion) return false;
      }
      return true;
    });
  }, [obras, filters]);

  const counts = useMemo(() => ({
    todas: obras.length,
    completada: obras.filter(o => o.status === 'completada').length,
    en_progreso: obras.filter(o => o.status === 'en_progreso').length,
    retrasada: obras.filter(o => o.status === 'retrasada').length,
  }), [obras]);

  return (
    <MapContext.Provider value={{ filters, setFilters, filteredObras, selectedObra, setSelectedObra, counts }}>
      {children}
    </MapContext.Provider>
  );
}

export function useMapState() {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error('useMapState must be used within MapProvider');
  return ctx;
}
