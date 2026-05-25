import { useMemo, type ReactNode } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { PublicObra } from '@/types';
import { getObraCoordinates, getStatusColor } from '@/utils/coordinates';

interface ProjectMarkerProps {
  obra: PublicObra;
  isSelected: boolean;
  onSelect: () => void;
  children?: ReactNode;
}

export default function ProjectMarker({ obra, isSelected, onSelect, children }: ProjectMarkerProps) {
  const position = useMemo(
    () => getObraCoordinates(obra.id, obra.regionComunidad),
    [obra.id, obra.regionComunidad]
  );

  const icon = useMemo(() => {
    const color = getStatusColor(obra.status);
    const size = isSelected ? 28 : 20;
    return L.divIcon({
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid white;
          box-shadow: 0 0 ${isSelected ? '16px' : '8px'} ${color}80, 0 0 ${isSelected ? '32px' : '16px'} ${color}40;
          cursor: pointer;
          transition: all 0.2s ease;
        "></div>
      `,
    });
  }, [obra.status, isSelected]);

  return (
    <Marker
      position={position}
      icon={icon}
      eventHandlers={{ click: onSelect }}
    >
      <Tooltip
        direction="top"
        offset={[0, -12]}
        opacity={1}
        className="custom-tooltip"
      >
        <span style={{
          background: 'rgba(14,20,26,0.9)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          color: '#eef2f7',
          fontSize: '11px',
          padding: '4px 8px',
          fontFamily: 'var(--font-body)',
          backdropFilter: 'blur(8px)',
        }}>
          {obra.nombre}
        </span>
      </Tooltip>
      {children}
    </Marker>
  );
}
