import { useClock } from '@/hooks/useClock';

export default function HeaderBar() {
  const clock = useClock();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-[1000] h-16 flex items-center px-6"
      style={{
        background: 'rgba(8, 12, 15, 0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 text-[#3b82f6]">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <polygon points="24,4 44,14 44,34 24,44 4,34 4,14" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <polygon points="24,10 38,17 38,31 24,38 10,31 10,17" stroke="currentColor" strokeWidth="0.75" fill="none" opacity="0.4"/>
            <circle cx="24" cy="24" r="4" fill="currentColor"/>
            <line x1="24" y1="10" x2="24" y2="17" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="24" y1="31" x2="24" y2="38" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="10" y1="17" x2="16" y2="20.5" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="32" y1="27.5" x2="38" y2="31" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="38" y1="17" x2="32" y2="20.5" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="16" y1="27.5" x2="10" y2="31" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] font-bold tracking-[0.05em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            Obras Públicas
          </span>
          <span className="text-[10px] tracking-[0.04em]" style={{ color: 'var(--text-muted)' }}>
            H. Ayuntamiento de Temascaltepec
          </span>
        </div>
      </div>

      {/* Center Title */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2">
        <span
          className="text-[13px] tracking-[0.1em] uppercase"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}
        >
          Mapa Inteligente de Obras Públicas
        </span>
      </div>

      {/* Right: Clock + Status */}
      <div className="ml-auto flex items-center gap-4">
        <span className="text-[11px] tabular-nums hidden sm:block" style={{ color: 'var(--text-muted)' }}>
          {clock}
        </span>
        <div className="flex items-center gap-[7px] text-[11px]" style={{ color: '#10b981' }}>
          <span className="w-[7px] h-[7px] rounded-full bg-[#10b981] animate-pulse-dot" />
          Sistema en línea
        </div>
      </div>
    </header>
  );
}
