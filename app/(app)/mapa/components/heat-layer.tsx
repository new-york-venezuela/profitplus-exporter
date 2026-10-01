'use client';

import 'leaflet.heat';
import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

// Weights are normalised to 0..1 against the max so the gradient always
// spans the data. An empty/zero set adds nothing (and so cannot throw).
export function HeatLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const max = Math.max(...points.map(p => p[2]));
    if (!(max > 0)) return;
    const layer = L.heatLayer(points.map(([lat, lng, w]) => [lat, lng, w / max] as [number, number, number]), {
      radius: 35, blur: 25, minOpacity: 0.3,
    }).addTo(map);
    return () => { layer.remove(); };
  }, [points, map]);
  return null;
}
