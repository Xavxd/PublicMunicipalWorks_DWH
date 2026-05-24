import { DataProvider } from '@/context/DataContext';
import { MapProvider } from '@/context/MapContext';
import HeaderBar from '@/components/HeaderBar';
import KpiPanel from '@/components/KpiPanel';
import AnalysisPanel from '@/components/AnalysisPanel';
import BottomFilterBar from '@/components/BottomFilterBar';
import MapLegend from '@/components/MapLegend';
import SmartMap from '@/components/map/SmartMap';
import ScanLine from '@/components/ScanLine';
import HudCorners from '@/components/HudCorners';

export default function App() {
  return (
    <DataProvider>
      <MapProvider>
        <div className="relative w-screen h-screen overflow-hidden" style={{ background: 'var(--bg-void)' }}>
          {/* Map Layer */}
          <SmartMap />

          {/* HUD Overlay Effects */}
          <ScanLine />
          <HudCorners />

          {/* UI Overlays */}
          <HeaderBar />
          <KpiPanel />
          <AnalysisPanel />
          <MapLegend />
          <BottomFilterBar />
        </div>
      </MapProvider>
    </DataProvider>
  );
}
