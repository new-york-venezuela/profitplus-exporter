import { validateCoordinates, formatCoordinates, coordinateErrorMessage, type LatLng } from './coordinates';

export interface LocationPatchValue { campo1?: string; coordinates?: LatLng; dirEnt2?: string }

type Result =
  | { ok: true; value: LocationPatchValue }
  | { ok: false; error: string; field?: 'coordinates' | 'dirEnt2' };

const MAX_ADDRESS = 500;

export function parseLocationPatch(body: unknown): Result {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, error: 'Datos inválidos' };
  const b = body as Record<string, unknown>;
  const value: LocationPatchValue = {};

  const hasLat = 'lat' in b;
  const hasLng = 'lng' in b;
  if (hasLat || hasLng) {
    if (!hasLat || !hasLng) return { ok: false, field: 'coordinates', error: 'Indique latitud y longitud' };
    if (typeof b.lat !== 'number' || typeof b.lng !== 'number' || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) {
      return { ok: false, field: 'coordinates', error: 'Latitud y longitud deben ser números' };
    }
    const c = { lat: b.lat, lng: b.lng };
    const v = validateCoordinates(c);
    if (!v.ok) return { ok: false, field: 'coordinates', error: coordinateErrorMessage(v.error) };
    value.coordinates = c;
    value.campo1 = formatCoordinates(c);
  }

  if ('dirEnt2' in b) {
    if (typeof b.dirEnt2 !== 'string' || !b.dirEnt2.trim()) return { ok: false, field: 'dirEnt2', error: 'La dirección no puede estar vacía' };
    if (b.dirEnt2.trim().length > MAX_ADDRESS) return { ok: false, field: 'dirEnt2', error: `Dirección demasiado larga (máximo ${MAX_ADDRESS})` };
    value.dirEnt2 = b.dirEnt2.trim();
  }

  if (!value.campo1 && !value.dirEnt2) return { ok: false, error: 'Nada que actualizar' };
  return { ok: true, value };
}
