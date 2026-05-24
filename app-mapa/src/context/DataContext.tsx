import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { PublicObra, Region, ResumenData } from '@/types';
import { fetchObrasPublic, fetchRegionesPublic, fetchResumenPublic } from '@/api/publicClient';

interface DataContextValue {
  obras: PublicObra[];
  regiones: Region[];
  resumen: ResumenData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [obras, setObras] = useState<PublicObra[]>([]);
  const [regiones, setRegiones] = useState<Region[]>([]);
  const [resumen, setResumen] = useState<ResumenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [obrasData, regionesData, resumenData] = await Promise.all([
        fetchObrasPublic(),
        fetchRegionesPublic(),
        fetchResumenPublic(),
      ]);
      setObras(obrasData);
      setRegiones(regionesData);
      setResumen(resumenData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <DataContext.Provider value={{ obras, regiones, resumen, loading, error, refetch: loadData }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
