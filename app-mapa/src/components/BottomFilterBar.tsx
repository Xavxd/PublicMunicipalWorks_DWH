import { useState } from 'react';
import { useMapState } from '@/context/MapContext';
import { motion } from 'framer-motion';
import { Search, ChevronDown } from 'lucide-react';

const statusFilters = [
  { id: 'todas' as const, label: 'Todas', color: '#3b82f6' },
  { id: 'en_progreso' as const, label: 'En Progreso', color: '#f59e0b' },
  { id: 'completada' as const, label: 'Completadas', color: '#10b981' },
  { id: 'retrasada' as const, label: 'Retrasadas', color: '#ef4444' },
];

export default function BottomFilterBar() {
  const { filters, setFilters, counts, filteredObras } = useMapState();
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);

  const uniqueRegions = ['todas', ...Array.from(new Set(filteredObras.map(o => o.regionComunidad)))];

  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="glass-card fixed bottom-4 left-1/2 -translate-x-1/2 z-[900] px-4 py-2.5 flex items-center gap-3"
      style={{ borderRadius: 'var(--radius-xl)' }}
    >
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Buscar obra..."
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          className="glass-input py-2 pl-8 pr-3 text-[12px] w-[160px] focus:w-[200px] transition-all"
        />
      </div>

      <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.08)' }} />

      {/* Status filters */}
      <div className="flex items-center gap-1.5">
        {statusFilters.map((sf) => {
          const isActive = filters.status === sf.id;
          const count = counts[sf.id === 'todas' ? 'todas' : sf.id as keyof typeof counts];
          return (
            <button
              key={sf.id}
              onClick={() => setFilters(prev => ({ ...prev, status: isActive && sf.id !== 'todas' ? 'todas' : sf.id }))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200"
              style={{
                background: isActive ? `${sf.color}18` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isActive ? `${sf.color}40` : 'rgba(255,255,255,0.08)'}`,
                color: isActive ? sf.color : 'var(--text-secondary)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: isActive ? sf.color : 'var(--text-muted)' }}
              />
              {sf.label}
              <span
                className="text-[10px] px-1 py-0.5 rounded-full"
                style={{
                  background: isActive ? `${sf.color}20` : 'rgba(255,255,255,0.04)',
                  color: isActive ? sf.color : 'var(--text-muted)',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.08)' }} />

      {/* Region dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowRegionDropdown(!showRegionDropdown)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200"
          style={{
            background: filters.region !== 'todas' ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${filters.region !== 'todas' ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
            color: filters.region !== 'todas' ? '#8b5cf6' : 'var(--text-secondary)',
          }}
        >
          {filters.region === 'todas' ? 'Todas las comunidades' : filters.region}
          <ChevronDown size={12} />
        </button>

        {showRegionDropdown && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowRegionDropdown(false)} />
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-full mb-2 right-0 z-20 rounded-xl overflow-hidden py-1 min-w-[200px]"
              style={{
                background: 'rgba(14,20,26,0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
            >
              {uniqueRegions.map((region) => (
                <button
                  key={region}
                  className="w-full text-left px-3 py-2 text-[11px] transition-colors hover:bg-white/[0.04]"
                  style={{
                    color: filters.region === region ? '#8b5cf6' : 'var(--text-secondary)',
                  }}
                  onClick={() => {
                    setFilters(prev => ({ ...prev, region }));
                    setShowRegionDropdown(false);
                  }}
                >
                  {region === 'todas' ? 'Todas las comunidades' : region}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}
