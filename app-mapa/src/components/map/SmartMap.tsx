import { useCallback } from 'react';
import { MapContainer, TileLayer, Popup, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { useMapState } from '@/context/MapContext';
import { TEMASCALTEPEC_CENTER, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from '@/utils/coordinates';
import ProjectMarker from './ProjectMarker';
import {
  getObraCoordinates,
  getStatusColor,
  getStatusLabel,
  formatCurrency,
  formatDate,
} from '@/utils/coordinates';
import { X, FileText, DollarSign, TrendingUp, Building2, Calendar, Users } from 'lucide-react';

// ─── Map click handler ────────────────────────────────────────────────────────

function MapEventHandler() {
  const { setSelectedObra } = useMapState();

  useMapEvents({
    click(e) {
      const target = e.originalEvent.target as HTMLElement;
      if (!target.closest('.leaflet-marker-icon') && !target.closest('.leaflet-popup')) {
        setSelectedObra(null);
      }
    },
  });

  return null;
}

// ─── Popup content ────────────────────────────────────────────────────────────

function PopupContent({ obra }: { obra: import('@/types').PublicObra }) {
  const { setSelectedObra } = useMapState();
  const statusColor = getStatusColor(obra.status);

  return (
    <div className="relative text-left" style={{ width: 300, color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="px-1 pt-1 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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
            <h3 className="text-[13px] font-bold leading-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
              {obra.nombre}
            </h3>
          </div>
          <button
            onClick={() => setSelectedObra(null)}
            className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}
          >
            <X size={12} />
          </button>
        </div>
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
          {obra.regionComunidad} {obra.regionBarrio ? `· ${obra.regionBarrio}` : ''}
        </p>
      </div>

      {/* Details */}
      <div className="py-2 space-y-2">
        <PopupRow icon={<FileText size={12} />} label="Expediente" value={obra.expediente} />
        <PopupRow icon={<DollarSign size={12} />} label="Presupuesto" value={formatCurrency(obra.presupuestoTotal)} />

        {/* Progress bar */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={12} style={{ color: 'var(--text-muted)' }} />
            <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Avance Físico</span>
            <span className="text-[11px] font-semibold ml-auto" style={{ color: statusColor }}>{obra.avanceFisico}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden ml-4" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${obra.avanceFisico}%`, background: statusColor }}
            />
          </div>
        </div>

        <PopupRow icon={<Building2 size={12} />} label="Constructora" value={obra.constructoraNombre} />
        <div className="flex gap-4">
          <PopupRow icon={<Calendar size={12} />} label="Inicio" value={formatDate(obra.fechaInicio)} />
          <PopupRow icon={<Calendar size={12} />} label="Fin" value={formatDate(obra.fechaFin)} />
        </div>
        <PopupRow icon={<Users size={12} />} label="Beneficiarios" value={obra.beneficiarios} />
      </div>

      {/* Footer */}
      <div className="pt-2 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
          {obra.totalInformes} informe{obra.totalInformes !== 1 ? 's' : ''}
        </span>
        <span className="text-[9px] truncate max-w-[120px]" style={{ color: 'var(--text-muted)' }}>
          {obra.supervisorNombre}
        </span>
      </div>
    </div>
  );
}

function PopupRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <div className="text-[11px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{value}</div>
      </div>
    </div>
  );
}

// ─── Main map component ───────────────────────────────────────────────────────

export default function SmartMap() {
  const { filteredObras, selectedObra, setSelectedObra } = useMapState();

  const createClusterCustomIcon = useCallback((cluster: L.MarkerCluster) => {
    const count = cluster.getChildCount();
    const size = Math.min(Math.max(30, count * 4), 56);
    return L.divIcon({
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.18);
          border: 2px solid rgba(59, 130, 246, 0.45);
          box-shadow: 0 0 16px rgba(59, 130, 246, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: ${Math.max(11, size * 0.3)}px;
        ">${count}</div>
      `,
    });
  }, []);

  return (
    <div className="absolute inset-0 z-0">
      <MapContainer
        center={TEMASCALTEPEC_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        style={{ width: '100%', height: '100%', background: '#080c0f' }}
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />

        <MapEventHandler />

        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createClusterCustomIcon}
          maxClusterRadius={60}
          showCoverageOnHover={false}
          spiderLegPolylineOptions={{ opacity: 0 }}
        >
          {filteredObras.map((obra) => {
            const position = getObraCoordinates(obra.id, obra.regionComunidad);
            return (
              <ProjectMarker
                key={obra.id}
                obra={obra}
                isSelected={selectedObra?.id === obra.id}
                onSelect={() => setSelectedObra(selectedObra?.id === obra.id ? null : obra)}
              >
                {selectedObra?.id === obra.id && (
                  <Popup
                    position={position}
                    closeButton={false}
                    autoPan={true}
                    autoPanPadding={[20, 20]}
                    eventHandlers={{ remove: () => setSelectedObra(null) }}
                    className="dark-popup"
                  >
                    <PopupContent obra={obra} />
                  </Popup>
                )}
              </ProjectMarker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
