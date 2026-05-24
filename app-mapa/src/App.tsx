import { DataProvider, useData } from '@/context/DataContext';
import { MapProvider } from '@/context/MapContext';
import HeaderBar from '@/components/HeaderBar';
import KpiPanel from '@/components/KpiPanel';
import AnalysisPanel from '@/components/AnalysisPanel';
import BottomFilterBar from '@/components/BottomFilterBar';
import MapLegend from '@/components/MapLegend';
import SmartMap from '@/components/map/SmartMap';
import ScanLine from '@/components/ScanLine';
import HudCorners from '@/components/HudCorners';

// Componente intermedio que consume useData()
function AppContent() {
  const { obras, loading, error } = useData();

  if (loading) {
    return <div className="text-white p-4">Cargando mapa...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">Error: {error}</div>;
  }

  return (
    <MapProvider obras={obras}>
      <div className="relative w-screen h-screen overflow-hidden" style={{ background: 'var(--bg-void)' }}>
        <SmartMap />
        <ScanLine />
        <HudCorners />
        <HeaderBar />
        <KpiPanel />
        <AnalysisPanel />
        <MapLegend />
        <BottomFilterBar />
      </div>
    </MapProvider>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
