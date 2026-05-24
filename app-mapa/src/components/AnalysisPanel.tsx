import { useState } from 'react';
import { useData } from '@/context/DataContext';
import { useMapState } from '@/context/MapContext';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, MapPinned, BarChart3, ChevronDown } from 'lucide-react';
import { getStatusColor } from '@/utils/coordinates';
import DashboardTab from './DashboardTab';
import { formatCurrency } from '@/utils/coordinates';

const tabs = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: <LayoutDashboard size={14} /> },
  { id: 'regiones' as const, label: 'Regiones', icon: <MapPinned size={14} /> },
  { id: 'estadisticas' as const, label: 'Estadísticas', icon: <BarChart3 size={14} /> },
];

type TabId = typeof tabs[number]['id'];

function RegionesTab() {
  const { obras } = useData();
  const { setFilters, setSelectedObra } = useMapState();
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);

  // Group obras by comunidad
  const regionMap = new Map<string, { comunidad: string; obras: typeof obras; totalBudget: number }>();
  obras.forEach(obra => {
    const existing = regionMap.get(obra.regionComunidad);
    if (existing) {
      existing.obras.push(obra);
      existing.totalBudget += obra.presupuestoTotal || 0;
    } else {
      regionMap.set(obra.regionComunidad, { comunidad: obra.regionComunidad, obras: [obra], totalBudget: obra.presupuestoTotal || 0 });
    }
  });

  const regions = Array.from(regionMap.values()).sort((a, b) => b.totalBudget - a.totalBudget);

  return (
    <div className="space-y-2">
      {regions.map((region) => (
        <div
          key={region.comunidad}
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.02)' }}
        >
          <button
            className="w-full flex items-center justify-between p-3 text-left transition-colors hover:bg-white/[0.02]"
            onClick={() => setExpandedRegion(expandedRegion === region.comunidad ? null : region.comunidad)}
          >
            <div>
              <div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
                {region.comunidad}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {region.obras.length} obra{region.obras.length !== 1 ? 's' : ''} · {formatCurrency(region.totalBudget)}
              </div>
            </div>
            <motion.div
              animate={{ rotate: expandedRegion === region.comunidad ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            </motion.div>
          </button>
          <AnimatePresence>
            {expandedRegion === region.comunidad && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-2 space-y-1">
                  {region.obras.map((obra) => (
                    <button
                      key={obra.id}
                      className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors hover:bg-white/[0.04]"
                      onClick={() => {
                        setFilters(prev => ({ ...prev, region: obra.regionComunidad }));
                        setSelectedObra(obra);
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: getStatusColor(obra.status) }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>
                          {obra.nombre}
                        </div>
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {obra.avanceFisico}% · {formatCurrency(obra.presupuestoTotal)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

function EstadisticasTab() {
  const { resumen } = useData();

  if (!resumen) return null;

  return (
    <div className="space-y-4">
      {/* Avg Duration */}
      <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="text-[10px] tracking-[0.1em] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
          Duración Promedio de Obra
        </div>
        <div className="text-[20px] font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
          {resumen.promedioDuracionDias}
          <span className="text-[12px] font-normal ml-1" style={{ color: 'var(--text-secondary)' }}>días</span>
        </div>
      </div>

      {/* Top Constructoras */}
      <div>
        <div className="text-[10px] tracking-[0.1em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
          Top Constructoras
        </div>
        <div className="space-y-2">
          {resumen.topConstructoras.map((c, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] w-5 h-5 rounded-full flex items-center justify-center font-bold" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
                  {i + 1}
                </span>
                <span className="text-[11px] truncate max-w-[140px]" style={{ color: 'var(--text-secondary)' }}>
                  {c.nombre}
                </span>
              </div>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                {c.obrasCount}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Status Distribution */}
      <div>
        <div className="text-[10px] tracking-[0.1em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
          Distribución por Estado
        </div>
        <div className="space-y-1.5">
          {resumen.obrasPorStatus.map((s) => (
            <div key={s.status} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: getStatusColor(s.status) }} />
                <span className="text-[11px] capitalize" style={{ color: 'var(--text-secondary)' }}>
                  {s.status === 'completada' ? 'Completada' : s.status === 'retrasada' ? 'Retrasada' : 'En Progreso'}
                </span>
              </div>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AnalysisPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  return (
    <motion.aside
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      className="glass-card fixed right-4 top-20 bottom-20 w-[300px] z-[900] p-4 overflow-y-auto custom-scrollbar hidden lg:block"
    >
      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[10px] font-medium tracking-wide uppercase transition-all duration-200"
            style={{
              background: activeTab === tab.id ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: activeTab === tab.id ? '#3b82f6' : 'var(--text-muted)',
              border: activeTab === tab.id ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
            }}
          >
            {tab.icon}
            <span className="hidden xl:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'regiones' && <RegionesTab />}
          {activeTab === 'estadisticas' && <EstadisticasTab />}
        </motion.div>
      </AnimatePresence>
    </motion.aside>
  );
}
