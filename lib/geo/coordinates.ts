// lib/geo/coordinates.ts
//
// The ERP stores a customer's location as free text in saCliente.campo1.
// This module is the ONLY place that knows that syntax: the app always
// produces it via formatCoordinates() and always reads it via
// parseCoordinates(). Order is LATITUDE first, as people paste from
// Google Maps / OSM ("10.48, -66.90").

export interface LatLng { lat: number; lng: number }

export const VENEZUELA_BOUNDS = { latMin: 0.6, latMax: 12.3, lngMin: -73.4, lngMax: -59.8 } as const;

export type CoordinateError = 'OUT_OF_RANGE' | 'SWAPPED_SUSPECTED';
export type CoordinateValidation = { ok: true } | { ok: false; error: CoordinateError };

const NUM = '(-?\\d+(?:\\.\\d+)?)';
const COORD_RE = new RegExp(`^\\s*coordenadas\\s*:\\s*\\(\\s*${NUM}\\s*,\\s*${NUM}\\s*\\)\\s*$`, 'i');

export function parseCoordinates(raw: string | null | undefined): LatLng | null {
  if (!raw) return null;
  const m = COORD_RE.exec(raw);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function inBounds({ lat, lng }: LatLng): boolean {
  const b = VENEZUELA_BOUNDS;
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax;
}

export function validateCoordinates(c: LatLng): CoordinateValidation {
  if (inBounds(c)) return { ok: true };
  if (inBounds({ lat: c.lng, lng: c.lat })) return { ok: false, error: 'SWAPPED_SUSPECTED' };
  return { ok: false, error: 'OUT_OF_RANGE' };
}

export function formatCoordinates(c: LatLng): string {
  return `Coordenadas: (${c.lat.toFixed(6)}, ${c.lng.toFixed(6)})`;
}

export function coordinateErrorMessage(error: CoordinateError): string {
  return error === 'SWAPPED_SUSPECTED'
    ? 'Latitud y longitud parecen estar invertidas. Use el orden (latitud, longitud).'
    : 'Las coordenadas están fuera de Venezuela.';
}
