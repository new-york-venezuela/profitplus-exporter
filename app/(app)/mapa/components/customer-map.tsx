'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import type { MapCustomer, RouteDto } from '@/lib/geo/types';
import { pinIcon, editIcon } from './pin-icon';
import { CustomerPopup } from './customer-popup';

const VENEZUELA_CENTER: [number, number] = [8.0, -66.0];

export interface CustomerMapProps {
  customers: MapCustomer[];
  routes: RouteDto[];
  selectedCoCli: string | null;
  onSelect: (coCli: string | null) => void;
  onEditLocation: (coCli: string) => void;
  fitKey: number;
  editing: { lat: number | null; lng: number | null } | null;
  onPlace: (lat: number, lng: number) => void;
  children?: React.ReactNode;
}

// Always snaps (animate: false): no animated pans/zooms, so
// prefers-reduced-motion is respected without a media-query check.
function FitBounds({ points, fitKey }: { points: [number, number][]; fitKey: number }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15, animate: false });
    // Refit only when asked (fitKey changes), not on every filter tweak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

function ClickToPlace({ active, onPlace }: { active: boolean; onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { if (active) onPlace(e.latlng.lat, e.latlng.lng); } });
  return null;
}

export default function CustomerMap({
  customers, routes, selectedCoCli, onSelect, onEditLocation, fitKey, editing, onPlace, children,
}: CustomerMapProps) {
  const located = useMemo(() => customers.filter(c => c.lat !== null && c.lng !== null), [customers]);
  const points = useMemo(() => located.map(c => [c.lat!, c.lng!] as [number, number]), [located]);

  return (
    <div className="relative z-0 isolate h-full w-full" data-testid="customer-map">
      <MapContainer center={VENEZUELA_CENTER} zoom={6} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} fitKey={fitKey} />
        <ClickToPlace active={editing !== null} onPlace={onPlace} />
        {located.map(c => (
          <Marker
            key={c.coCli}
            position={[c.lat!, c.lng!]}
            icon={pinIcon(c.pareto, c.coCli === selectedCoCli)}
            title={c.name}
            alt={`${c.name}, segmento ${c.pareto ?? 'sin ventas'}`}
            eventHandlers={{ click: () => onSelect(c.coCli), popupclose: () => onSelect(null) }}
          >
            <Popup>
              <CustomerPopup customer={c} routes={routes} onEditLocation={onEditLocation} />
            </Popup>
          </Marker>
        ))}
        {editing && editing.lat !== null && editing.lng !== null && (
          <Marker
            position={[editing.lat, editing.lng]}
            icon={editIcon()}
            draggable
            title="Ubicación nueva (arrastre para ajustar)"
            eventHandlers={{ dragend: e => { const p = (e.target as L.Marker).getLatLng(); onPlace(p.lat, p.lng); } }}
          />
        )}
        {children}
      </MapContainer>
    </div>
  );
}
