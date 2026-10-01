import { isValidDateRange, previousMonthRange, periodOptions } from './date-range';
import type { MapCustomer, MapSeller, Pareto, RouteDto } from './types';
import type { AreaDto } from './areas-repo';

export interface MapFilters {
  dateRange: string;
  seller: string | null;
  route: number | null;
  area: number | null;
  pareto: Pareto | null;
  noCoords: boolean;
}

export function parseFilters(params: URLSearchParams, now: Date = new Date()): MapFilters {
  const dateRange = params.get('dateRange');
  const route = params.get('route');
  const area = params.get('area');
  const pareto = params.get('pareto');
  return {
    dateRange: dateRange && isValidDateRange(dateRange) ? dateRange : previousMonthRange(now),
    seller: params.get('seller') || null,
    route: route && /^\d+$/.test(route) ? parseInt(route, 10) : null,
    area: area && /^\d+$/.test(area) ? parseInt(area, 10) : null,
    pareto: pareto === 'A' || pareto === 'B' || pareto === 'C' ? pareto : null,
    noCoords: params.get('noCoords') === '1',
  };
}

export function serializeFilters(f: MapFilters, now: Date = new Date()): URLSearchParams {
  const p = new URLSearchParams();
  if (f.dateRange !== previousMonthRange(now)) p.set('dateRange', f.dateRange);
  if (f.seller) p.set('seller', f.seller);
  if (f.route !== null) p.set('route', String(f.route));
  if (f.area !== null) p.set('area', String(f.area));
  if (f.pareto) p.set('pareto', f.pareto);
  if (f.noCoords) p.set('noCoords', '1');
  return p;
}

// A route filter is only meaningful while it exists and (when a seller is
// selected) belongs to that seller. An area filter only while the area exists.
export function normalizeFilters(f: MapFilters, routes: RouteDto[], areas: AreaDto[] = []): MapFilters {
  let out = f;
  if (out.route !== null) {
    const route = routes.find(r => r.id === out.route);
    if (!route || (out.seller !== null && route.sellerCode !== out.seller)) out = { ...out, route: null };
  }
  if (out.area !== null && !areas.some(a => a.id === out.area)) out = { ...out, area: null };
  return out;
}

export function applyFilters(customers: MapCustomer[], f: MapFilters): MapCustomer[] {
  return customers.filter(c =>
    (f.seller === null || c.coVen === f.seller) &&
    (f.route === null || c.routeIds.includes(f.route)) &&
    (f.area === null || c.areaId === f.area) &&
    (f.pareto === null || c.pareto === f.pareto) &&
    (!f.noCoords || c.lat === null),
  );
}

export interface FilterChip {
  key: 'dateRange' | 'seller' | 'route' | 'area' | 'pareto' | 'noCoords';
  label: string;
}

export function filterChips(
  f: MapFilters, ctx: { sellers: MapSeller[]; routes: RouteDto[]; areas?: AreaDto[] }, now: Date = new Date(),
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.dateRange !== previousMonthRange(now)) {
    const label = periodOptions(now).find(o => o.value === f.dateRange)?.label ?? f.dateRange;
    chips.push({ key: 'dateRange', label: `Período: ${label}` });
  }
  if (f.seller) chips.push({ key: 'seller', label: `Vendedor: ${ctx.sellers.find(s => s.code === f.seller)?.name ?? f.seller}` });
  if (f.route !== null) chips.push({ key: 'route', label: `Ruta: ${ctx.routes.find(r => r.id === f.route)?.name ?? f.route}` });
  if (f.area !== null) chips.push({ key: 'area', label: `Zona: ${ctx.areas?.find(a => a.id === f.area)?.name ?? f.area}` });
  if (f.pareto) chips.push({ key: 'pareto', label: `Segmento: ${f.pareto}` });
  if (f.noCoords) chips.push({ key: 'noCoords', label: 'Sin coordenadas' });
  return chips;
}
