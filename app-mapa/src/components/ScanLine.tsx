export default function ScanLine() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[850] animate-scan-sweep"
      style={{
        height: 2,
        background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.7), rgba(6,182,212,0.5), transparent)',
        boxShadow: '0 0 24px rgba(59,130,246,0.35), 0 0 60px rgba(59,130,246,0.15)',
      }}
    />
  );
}
