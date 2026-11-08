'use client';

import 'leaflet/dist/leaflet.css';
import { useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';

const CARACAS: [number, number] = [10.4806, -66.9036];

export interface PinPickerProps {
  initial: { lat: number; lng: number } | null;
  onConfirm: (pin: { lat: number; lng: number }) => void;
  onCancel: () => void;
}

const icon = L.divIcon({
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  html: '<div style="width:28px;height:28px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>',
});

function ClickToPlace({ onPlace }: { onPlace: (p: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: e => onPlace({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

// Client-only (imports leaflet): always load through next/dynamic with ssr:false.
export default function PinPicker({ initial, onConfirm, onCancel }: PinPickerProps) {
  const [pin, setPin] = useState<{ lat: number; lng: number }>(initial ?? { lat: CARACAS[0], lng: CARACAS[1] });
  const markerRef = useRef<L.Marker>(null);
  const handlers = useMemo(() => ({
    dragend() {
      const m = markerRef.current;
      if (m) setPin({ lat: m.getLatLng().lat, lng: m.getLatLng().lng });
    },
  }), []);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Arrastre el marcador o haga clic en el mapa para ubicar la tienda.</p>
      <div className="h-80 rounded border border-gray-200 overflow-hidden">
        <MapContainer center={[pin.lat, pin.lng]} zoom={12} className="h-full w-full" scrollWheelZoom>
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPlace onPlace={setPin} />
          <Marker position={[pin.lat, pin.lng]} draggable icon={icon} ref={markerRef} eventHandlers={handlers} />
        </MapContainer>
      </div>
      <p className="text-xs text-gray-600">Lat {pin.lat.toFixed(5)}, Lng {pin.lng.toFixed(5)}</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50">
          Cancelar
        </button>
        <button type="button" onClick={() => onConfirm(pin)} className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">
          Confirmar ubicación
        </button>
      </div>
    </div>
  );
}
