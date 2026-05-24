export default function HudCorners() {
  const cornerStyle = (delay: number): React.CSSProperties => ({
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: 'rgba(59,130,246,0.2)',
    pointerEvents: 'none',
    animation: `hud-pulse 4s ease-in-out infinite ${delay}s`,
  });

  return (
    <div className="fixed inset-[20px] z-[850] pointer-events-none">
      {/* Top Left */}
      <div style={{ ...cornerStyle(0), top: 0, left: 0, borderTop: '2px solid', borderLeft: '2px solid' }} />
      {/* Top Right */}
      <div style={{ ...cornerStyle(1), top: 0, right: 0, borderTop: '2px solid', borderRight: '2px solid' }} />
      {/* Bottom Left */}
      <div style={{ ...cornerStyle(2), bottom: 0, left: 0, borderBottom: '2px solid', borderLeft: '2px solid' }} />
      {/* Bottom Right */}
      <div style={{ ...cornerStyle(3), bottom: 0, right: 0, borderBottom: '2px solid', borderRight: '2px solid' }} />
    </div>
  );
}
