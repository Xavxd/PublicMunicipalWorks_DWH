import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'                      // ← Línea nueva
import '@changey/react-leaflet-markercluster/dist/styles.min.css'  // ← Línea nueva
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(<App />)
