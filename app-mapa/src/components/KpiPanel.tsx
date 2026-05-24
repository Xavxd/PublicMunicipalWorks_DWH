import { useData } from '@/context/DataContext';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { Activity, CheckCircle2, AlertTriangle, DollarSign, TrendingUp, MapPin } from 'lucide-react';
import { formatCurrency } from '@/utils/coordinates';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.3 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

function SkeletonKpi() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="rounded-2xl p-4 animate-skeleton"
          style={{ background: 'rgba(255,255,255,0.03)', height: 72 }}
        />
      ))}
    </div>
  );
}

interface KpiItemProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  isCurrency?: boolean;
  isPercent?: boolean;
  progress?: number;
  delay: number;
}

function KpiItem({ icon, label, value, color, isCurrency, isPercent, progress }: KpiItemProps) {
  const displayValue = typeof value === 'string' ? value : isCurrency ? formatCurrency(value) : isPercent ? `${value}%` : value;

  return (
    <motion.div
      variants={itemVariants}
      className="rounded-2xl p-4 transition-all duration-300 group cursor-default"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.04)',
      }}
      whileHover={{
        borderColor: 'rgba(59,130,246,0.15)',
        boxShadow: '0 0 20px rgba(59,130,246,0.08)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color }}>{icon}</span>
        <span
          className="text-[10px] tracking-[0.12em] uppercase font-semibold"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        {typeof value === 'number' && !isCurrency ? (
          <CountUp
            end={value}
            duration={2}
            separator=","
            className="text-[26px] font-bold leading-none"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          />
        ) : (
          <span
            className="text-[22px] font-bold leading-none"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            {displayValue}
          </span>
        )}
      </div>
      {progress !== undefined && (
        <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.5, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="h-full rounded-full"
            style={{ background: color }}
          />
        </div>
      )}
    </motion.div>
  );
}

export default function KpiPanel() {
  const { resumen, loading } = useData();

  if (loading || !resumen) {
    return (
      <aside className="glass-card fixed left-4 top-20 bottom-20 w-[260px] z-[900] p-4 overflow-y-auto custom-scrollbar hidden lg:block">
        <div className="text-[11px] tracking-[0.1em] uppercase font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>
          Panel de Control
        </div>
        <div className="h-px mb-4" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <SkeletonKpi />
      </aside>
    );
  }

  const kpis: KpiItemProps[] = [
    {
      icon: <Activity size={16} />, label: 'Obras Activas', value: resumen.obrasActivas,
      color: '#3b82f6', delay: 0,
    },
    {
      icon: <CheckCircle2 size={16} />, label: 'Completadas', value: resumen.obrasCompletadas,
      color: '#10b981', delay: 0.08,
    },
    {
      icon: <AlertTriangle size={16} />, label: 'Retrasadas', value: resumen.obrasRetrasadas,
      color: '#ef4444', delay: 0.16,
    },
    {
      icon: <DollarSign size={16} />, label: 'Inversión Total', value: resumen.inversionTotal,
      color: '#f59e0b', isCurrency: true, delay: 0.24,
    },
    {
      icon: <TrendingUp size={16} />, label: 'Avance Promedio', value: resumen.avancePromedio,
      color: '#3b82f6', isPercent: true, progress: resumen.avancePromedio, delay: 0.32,
    },
    {
      icon: <MapPin size={16} />, label: 'Comunidades', value: resumen.comunidadesImpactadas,
      color: '#8b5cf6', delay: 0.40,
    },
  ];

  return (
    <motion.aside
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="glass-card fixed left-4 top-20 bottom-20 w-[260px] z-[900] p-4 overflow-y-auto custom-scrollbar hidden lg:block"
    >
      <div
        className="text-[11px] tracking-[0.1em] uppercase font-semibold mb-3"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}
      >
        Panel de Control
      </div>
      <div className="h-px mb-3" style={{ background: 'rgba(255,255,255,0.05)' }} />

      <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-3">
        {kpis.map((kpi, i) => (
          <KpiItem key={i} {...kpi} />
        ))}
      </motion.div>
    </motion.aside>
  );
}
