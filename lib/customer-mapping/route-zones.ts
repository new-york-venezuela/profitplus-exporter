// A route is a saZona row. The code must fit char(6) (saZona.co_zon, saCliente.co_zon,
// Dim_Customer.ZoneCode), so the spec's "CCS-003" (7 chars) is written "CCS003".
export const ROUTE_ZONE_PREFIX = 'CCS';
export const MIN_ROUTE = 1;
export const MAX_ROUTE = 999;

export function parseRouteNumber(raw: unknown): number | null {
  let n: number;
  if (typeof raw === 'number') n = raw;
  else if (typeof raw === 'string') {
    const m = /^\s*(?:ruta\s*)?(\d{1,3})\s*$/i.exec(raw);
    if (!m) return null;
    n = Number(m[1]);
  } else return null;
  return Number.isInteger(n) && n >= MIN_ROUTE && n <= MAX_ROUTE ? n : null;
}

export function routeZoneCode(route: number): string {
  if (!Number.isInteger(route) || route < MIN_ROUTE || route > MAX_ROUTE) {
    throw new RangeError(`Número de ruta fuera de rango (${MIN_ROUTE}..${MAX_ROUTE}): ${route}`);
  }
  return `${ROUTE_ZONE_PREFIX}${String(route).padStart(3, '0')}`;
}

export function routeZoneName(route: number): string {
  return `Ruta ${route}`;
}

export function routeNumberFromZone(coZon: string | null | undefined): number | null {
  const m = /^CCS(\d{3})$/.exec((coZon ?? '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n >= MIN_ROUTE ? n : null;
}
