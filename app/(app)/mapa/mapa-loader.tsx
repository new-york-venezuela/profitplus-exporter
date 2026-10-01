'use client';

import dynamic from 'next/dynamic';

// Leaflet touches `window` at import time, so the whole map tree is a
// client-only leaf; the page itself stays a Server Component (session +
// module check). The fixed-height placeholder prevents layout shift.
const MapaClient = dynamic(() => import('./mapa-client'), {
  ssr: false,
  loading: () => (
    <div role="status" className="h-full min-h-[50vh] flex items-center justify-center text-sm text-gray-500">
      Cargando mapa…
    </div>
  ),
});

export default function MapaLoader() {
  return <MapaClient />;
}
