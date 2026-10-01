'use client';

import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { ringFromLatLngs, ringToLatLngs, type Ring } from '@/lib/geo/geometry';

export interface AreaDrawingProps {
  mode: 'idle' | 'draw' | 'edit';
  editRing: Ring | null;
  onDrawn: (ring: Ring) => void;
  onEdited: (ring: Ring) => void;
  onCancel: () => void;
}

// Callbacks live in a ref so the effects depend ONLY on `mode`: a parent
// re-render with fresh closures must never tear down an in-progress drawing.
export function AreaDrawing({ mode, editRing, onDrawn, onEdited, onCancel }: AreaDrawingProps) {
  const map = useMap();
  const cb = useRef({ onDrawn, onEdited, onCancel });
  useEffect(() => { cb.current = { onDrawn, onEdited, onCancel }; });

  // Draw a new polygon: click to add points, click the first point to close, Esc cancels.
  useEffect(() => {
    if (mode !== 'draw') return;
    map.pm.enableDraw('Polygon', {
      allowSelfIntersection: false,
      snappable: false,
      templineStyle: { color: '#2563eb' },
      hintlineStyle: { color: '#2563eb', dashArray: [5, 5] },
      pathOptions: { color: '#2563eb' },
    });
    const onCreate = (e: { layer: L.Layer }) => {
      const layer = e.layer as L.Polygon;
      const ring = ringFromLatLngs(layer.getLatLngs() as L.LatLng[][]);
      layer.remove();                       // the saved area is rendered from state, not from this layer
      cb.current.onDrawn(ring);
    };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') cb.current.onCancel(); };
    map.on('pm:create', onCreate as L.LeafletEventHandlerFn);
    document.addEventListener('keydown', onKey);
    return () => {
      map.off('pm:create', onCreate as L.LeafletEventHandlerFn);
      document.removeEventListener('keydown', onKey);
      map.pm.disableDraw();
    };
  }, [mode, map]);

  // Edit an existing/just-drawn shape: drag vertices, add points on edges.
  useEffect(() => {
    if (mode !== 'edit' || !editRing) return;
    const layer = L.polygon(ringToLatLngs(editRing), { color: '#2563eb', weight: 3, fillOpacity: 0.1 }).addTo(map);
    layer.pm.enable({ allowSelfIntersection: false });
    const emit = () => cb.current.onEdited(ringFromLatLngs(layer.getLatLngs() as L.LatLng[][]));
    for (const ev of ['pm:edit', 'pm:vertexadded', 'pm:markerdragend', 'pm:vertexremoved']) layer.on(ev, emit);
    return () => { layer.pm.disable(); layer.remove(); };
    // editRing seeds the layer once per entry into 'edit' mode; later ring updates come FROM this layer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, map]);

  return null;
}
