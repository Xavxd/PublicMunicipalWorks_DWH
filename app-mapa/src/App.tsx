import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Popup, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';
import { motion, AnimatePresence } from 'framer-motion';
import { MapProvider } from '@/context/MapContext';
import type { PublicObra } from '@/types';
import {
  TEMASCALTEPEC_CENTER,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  getObraCoordinates,
  getStatusColor,
  getStatusLabel,
  formatCurrency,
  formatDate,
} from '@/utils/coordinates';
import {
  X,
  FileText,
  DollarSign,
  TrendingUp,
  Building2,
  Calendar,
  Users,
  MapPin,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@changey/react-leaflet-markercluster/dist/styles.min.css';

// ===================================================================
// API CLIENT (usa variable de entorno si esta disponible)
// ===================================================================
const API_BASE = (import.meta as any).env?.VITE_API_URL || 'https://backend-obraspublicas.onrender.com';

async function fetchObrasPublic(): Promise<PublicObra[]> {
  const res = await fetch(`${API_BASE}/api/public/obras`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'API error');
  return json.data;
}

async function fetchResumenPublic() {
  const res = await fetch(`${API_BASE}/api/public/resumen`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'API error');
  return json.data;
}

// ===================================================================
// PROJECT MARKER COMPONENT
// ===================================================================
function ProjectMarker({
  obra,
  isSelected,
  onSelect,
  children,
}: {
  obra: PublicObra;
  isSelected: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  const color = getStatusColor(obra.status);
  const position = getObraCoordinates(obra.id, obra.regionComunidad);

  const customIcon = L.divIcon({
    className: '',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    html: `
      <div style="
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: ${color};
        border: 2px solid rgba(255,255,255,0.8);
        box-shadow: 0 0 10px ${color}80, 0 0 20px ${color}40;
        cursor: pointer;
        transition: transform 0.2s;
      " onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">
      </div>
    `,
  });

  return (
    <>{/* @ts-ignore - react-leaflet marker typing */}
      <L.Marker
        position={position}
        icon={customIcon}
        eventHandlers={{ click: onSelect }}
      >
        {children}
      </L.Marker>
    </>
  );
}

// ===================================================================
// POPUP CONTENT
// ===================================================================
function PopupContent({ obra }: { obra: PublicObra }) {
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
        </div>
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
          {obra.regionComunidad} {obra.regionBarrio ? `· ${obra.regionBarrio}` : ''}
        </p>
      </div>

      {/* Details */}
      <div className="py-2 space-y-2">
        <PopupRow icon={<FileText size={12} />} label="Expediente" value={obra.expediente} />
        <PopupRow icon={<DollarSign size={12} />} label="Presupuesto" value={formatCurrency(obra.presupuestoTotal)} />

        {/* Progress Bar */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={12} style={{ color: 'var(--text-muted)' }} />
            <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Avance Fisico</span>
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

// ===================================================================
// MAP EVENT HANDLER
// ===================================================================
function MapEventHandler({ onDeselect }: { onDeselect: () => void }) {
  useMapEvents({
    click(e) {
      const target = e.originalEvent.target as HTMLElement;
      if (!target.closest('.leaflet-marker-icon') && !target.closest('.leaflet-popup')) {
        onDeselect();
      }
    },
  });
  return null;
}

// ===================================================================
// HUD COMPONENTS
// ===================================================================
function HeaderBar() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-[1000] pointer-events-none">
      <div className="glass-panel mx-3 mt-3 px-5 py-3 flex items-center justify-between pointer-events-auto" style={{ borderRadius: 16 }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)' }}>
            <MapPin size={16} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <h1 className="text-[13px] font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
              Mapa Inteligente — Obras Publicas
            </h1>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Temascaltepec de Gonzalez, Edo. Mex.
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12px] font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            {time.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {time.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
      </div>
    </div>
  );
}

function HudCorners() {
  const cornerStyle: React.CSSProperties = {
    position: 'fixed',
    width: 24,
    height: 24,
    borderColor: 'rgba(59,130,246,0.25)',
    zIndex: 999,
    pointerEvents: 'none',
  };
  return (
    <>
      <div style={{ ...cornerStyle, top: 12, left: 12, borderTop: '2px solid', borderLeft: '2px solid' }} />
      <div style={{ ...cornerStyle, top: 12, right: 12, borderTop: '2px solid', borderRight: '2px solid' }} />
      <div style={{ ...cornerStyle, bottom: 12, left: 12, borderBottom: '2px solid', borderLeft: '2px solid' }} />
      <div style={{ ...cornerStyle, bottom: 12, right: 12, borderBottom: '2px solid', borderRight: '2px solid' }} />
    </>
  );
}

function ScanLine() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-[998]"
      style={{
        background: 'linear-gradient(to bottom, transparent 50%, rgba(59,130,246,0.015) 50%)',
        backgroundSize: '100% 4px',
      }}
    />
  );
}

function KpiPanel({ obras, resumen }: { obras: PublicObra[]; resumen: any }) {
  const total = obras.length;
  const completadas = obras.filter(o => o.status === 'completada').length;
  const enProgreso = obras.filter(o => o.status === 'en_progreso').length;
  const retrasadas = obras.filter(o => o.status === 'retrasada').length;
  const inversion = obras.reduce((sum, o) => sum + (o.presupuestoTotal || 0), 0);

  const kpis = [
    { label: 'Obras Activas', value: total, color: '#3b82f6' },
    { label: 'Completadas', value: completadas, color: '#10b981' },
    { label: 'En Progreso', value: enProgreso, color: '#f59e0b' },
    { label: 'Retrasadas', value: retrasadas, color: '#ef4444' },
    { label: 'Inversion Total', value: inversion >= 1000000 ? `$${(inversion/1000000).toFixed(1)}M` : `$${(inversion/1000).toFixed(0)}K`, color: '#8b5cf6', isText: true },
  ];

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex gap-2">
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.4 }}
          className="glass-panel px-4 py-2.5 flex flex-col items-center"
          style={{ borderRadius: 12, minWidth: 80 }}
        >
          <span className="text-[15px] font-bold" style={{ fontFamily: 'var(--font-display)', color: kpi.color }}>
            {kpi.isText ? kpi.value : kpi.value.toLocaleString('es-MX')}
          </span>
          <span className="text-[8px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {kpi.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

// ===================================================================
// SMART MAP
// ===================================================================
function SmartMap({ obras }: { obras: PublicObra[] }) {
  const [selectedObra, setSelectedObra] = useState<PublicObra | null>(null);

  const createClusterCustomIcon = useCallback((cluster: any) => {
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

        <MapEventHandler onDeselect={() => setSelectedObra(null)} />

        <MarkerClusterGroup
          showCoverageOnHover={false}
          spiderLegPolylineOptions={{ opacity: 0 }}
          iconCreateFunction={createClusterCustomIcon}
          maxClusterRadius={60}
          animate={true}
        >
          {obras.map((obra) => {
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

// ===================================================================
// LOADING SCREEN
// ===================================================================
function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center" style={{ background: '#080c0f' }}>
      <Loader2 size={32} className="animate-spin mb-4" style={{ color: '#3b82f6' }} />
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Cargando mapa inteligente...</p>
      <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Conectando con el servidor</p>
    </div>
  );
}

// ===================================================================
// ERROR SCREEN
// ===================================================================
function ErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center px-6" style={{ background: '#080c0f' }}>
      <AlertTriangle size={40} className="mb-4" style={{ color: '#ef4444' }} />
      <h2 className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
        Error de conexion
      </h2>
      <p className="text-sm text-center mb-6" style={{ color: 'var(--text-secondary)' }}>
        No se pudo cargar la informacion del mapa. Verifica tu conexion a internet.
      </p>
      <p className="text-[10px] mb-6 text-center" style={{ color: 'var(--text-muted)' }}>
        {error}
      </p>
      <button
        onClick={onRetry}
        className="px-6 py-2.5 rounded-lg text-sm font-medium transition-all"
        style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}
      >
        Reintentar
      </button>
    </div>
  );
}

// ===================================================================
// MAIN APP
// ===================================================================
export default function App() {
  const [obras, setObras] = useState<PublicObra[]>([]);
  const [resumen, setResumen] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [obrasData, resumenData] = await Promise.all([
        fetchObrasPublic(),
        fetchResumenPublic().catch(() => null),
      ]);
      setObras(obrasData);
      setResumen(resumenData);
    } catch (err: any) {
      console.error('Error cargando datos:', err);
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} onRetry={loadData} />;

  return (
    <MapProvider obras={obras}>
      <div className="relative w-screen h-screen overflow-hidden" style={{ background: '#080c0f' }}>
        <SmartMap obras={obras} />
        <HeaderBar />
        <HudCorners />
        <ScanLine />
        <KpiPanel obras={obras} resumen={resumen} />
      </div>
    </MapProvider>
  );
}
