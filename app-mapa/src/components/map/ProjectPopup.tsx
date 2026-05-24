import { useMapState } from '@/context/MapContext';
import type { PublicObra } from '@/types';
import { getStatusColor, getStatusLabel, formatCurrency, formatDate } from '@/utils/coordinates';
import { motion } from 'framer-motion';
import { X, FileText, DollarSign, TrendingUp, Building2, Calendar, Users } from 'lucide-react';

interface ProjectPopupProps {
  obra: PublicObra;
}

export default function ProjectPopup({ obra }: ProjectPopupProps) {
  const { setSelectedObra } = useMapState();
  const statusColor = getStatusColor(obra.status);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
      style={{ width: 320 }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}80` }}
              />
              <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: statusColor }}>
                {getStatusLabel(obra.status)}
              </span>
            </div>
            <h3 className="text-[14px] font-bold leading-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
              {obra.nombre}
            </h3>
          </div>
          <button
            onClick={() => setSelectedObra(null)}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors mt-0.5"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <X size={14} />
          </button>
        </div>
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
          {obra.regionComunidad} {obra.regionBarrio ? `· ${obra.regionBarrio}` : ''}
        </p>
      </div>

      {/* Details */}
      <div className="px-4 py-3 space-y-2.5">
        <PopupRow icon={<FileText size={13} />} label="Expediente" value={obra.expediente} />
        <PopupRow icon={<DollarSign size={13} />} label="Presupuesto" value={formatCurrency(obra.presupuestoTotal)} />

        {/* Progress Bar */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={13} style={{ color: 'var(--text-muted)' }} />
            <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Avance Físico</span>
            <span className="text-[12px] font-semibold ml-auto" style={{ color: statusColor }}>{obra.avanceFisico}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden ml-5" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${obra.avanceFisico}%` }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full"
              style={{ background: statusColor }}
            />
          </div>
        </div>

        <PopupRow icon={<Building2 size={13} />} label="Constructora" value={obra.constructoraNombre} />
        <PopupRow icon={<Calendar size={13} />} label="Inicio" value={formatDate(obra.fechaInicio)} />
        <PopupRow icon={<Calendar size={13} />} label="Fin" value={formatDate(obra.fechaFin)} />
        <PopupRow icon={<Users size={13} />} label="Beneficiarios" value={obra.beneficiarios} />
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
      >
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {obra.totalInformes} informe{obra.totalInformes !== 1 ? 's' : ''} registrado{obra.totalInformes !== 1 ? 's' : ''}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {obra.supervisorNombre}
        </span>
      </div>
    </motion.div>
  );
}

function PopupRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <div className="text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{value}</div>
      </div>
    </div>
  );
}
