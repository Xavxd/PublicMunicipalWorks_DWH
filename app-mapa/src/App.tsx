import { useEffect, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';
import 'leaflet/dist/leaflet.css';
import '@changey/react-leaflet-markercluster/dist/styles.min.css';
import { getObraCoordinates } from '@/utils/coordinates';
import L from 'leaflet';

export default function App() {
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://backend-obraspublicas.onrender.com/api/public/obras')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setObras(data.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div style={{ color: 'white', padding: '20px' }}>Cargando mapa...</div>;
  }

  return (
    <MapContainer
      center={[19.05, -100.05]}
      zoom={12}
      style={{ height: '100vh', width: '100%', background: '#080c0f' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
      />
      <MarkerClusterGroup>
        {obras.map((obra) => {
          const [lat, lng] = getObraCoordinates(obra.id, obra.regionComunidad);
          const color = obra.status === 'completada' ? '#10b981' : obra.status === 'en_progreso' ? '#3b82f6' : '#f59e0b';
          return (
            <MarkerClusterGroup key={obra.id}>
              <L.Marker
                position={[lat, lng]}
                icon={L.divIcon({
                  html: `<div style="background: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px ${color};"></div>`,
                  className: '',
                  iconSize: [12, 12]
                })}
              >
                <L.Popup>
                  <div style={{ color: 'white', background: '#0a1628', padding: '8px', borderRadius: '8px' }}>
                    <strong>{obra.nombre}</strong><br />
                    {obra.regionComunidad}<br />
                    Avance: {obra.avanceFisico}%
                  </div>
                </L.Popup>
              </L.Marker>
            </MarkerClusterGroup>
          );
        })}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
