import { useData } from '@/context/DataContext';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getStatusColor, formatDate } from '@/utils/coordinates';
import { motion } from 'framer-motion';

export default function DashboardTab() {
  const { resumen } = useData();

  if (!resumen) return null;

  const statusData = resumen.obrasPorStatus.map(s => ({
    name: s.status === 'completada' ? 'Completada' : s.status === 'retrasada' ? 'Retrasada' : 'En Progreso',
    value: s.count,
    color: getStatusColor(s.status),
  }));

  const regionData = resumen.presupuestoPorRegion
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map(r => ({
      name: r.comunidad.length > 14 ? r.comunidad.slice(0, 14) + '…' : r.comunidad,
      total: Math.round((r.total || 0) / 1000), // in thousands
    }));

  const totalObras = statusData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-5">
      {/* Status Donut */}
      <div>
        <div className="text-[10px] tracking-[0.1em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
          Proyectos por Estado
        </div>
        <div className="flex items-center gap-4">
          <div className="w-[100px] h-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={45}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1">
            <div className="text-[24px] font-bold leading-none" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
              {totalObras}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              obras totales
            </div>
            <div className="mt-2 space-y-1">
              {statusData.map((s) => (
                <div key={s.name} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                  <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{s.name}</span>
                  <span className="text-[10px] font-semibold ml-auto" style={{ color: 'var(--text-primary)' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Budget by Region */}
      <div>
        <div className="text-[10px] tracking-[0.1em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
          Presupuesto por Comunidad (miles $)
        </div>
        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={regionData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#8b9cb5', fontSize: 10 }}
                width={90}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(14,20,26,0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#eef2f7',
                }}
                formatter={(value: number) => [`$ ${value.toLocaleString()} mil`, 'Presupuesto']}
              />
              <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Timeline */}
      <div>
        <div className="text-[10px] tracking-[0.1em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
          Obras Recientes
        </div>
        <div className="space-y-2">
          {resumen.obrasRecientes.map((obra, i) => (
            <motion.div
              key={obra.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-2 py-1.5"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: getStatusColor(obra.status) }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>
                  {obra.nombre}
                </div>
              </div>
              <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                {formatDate(obra.fechaInicio)}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
