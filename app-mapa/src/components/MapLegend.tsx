const legendItems = [
  { color: '#10b981', label: 'Completada' },
  { color: '#f59e0b', label: 'En Progreso' },
  { color: '#ef4444', label: 'Retrasada' },
];

export default function MapLegend() {
  return (
    <div
      className="glass-card fixed bottom-20 left-4 z-[900] p-3"
      style={{ borderRadius: 'var(--radius-md)', width: 150 }}
    >
      <div
        className="text-[10px] tracking-[0.12em] uppercase font-semibold mb-2"
        style={{ color: 'var(--text-muted)' }}
      >
        Leyenda
      </div>
      <div className="space-y-2">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-marker-pulse"
              style={{
                background: item.color,
                color: item.color, // for the pulse shadow
                boxShadow: `0 0 6px ${item.color}60`,
              }}
            />
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
