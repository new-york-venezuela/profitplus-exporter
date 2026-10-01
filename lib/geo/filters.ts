import { isValidDateRange, previousMonthRange, periodOptions } from './date-range';
import type { MapCustomer, MapSeller, Pareto, RouteDto } from './types';

export interface MapFilters {
  dateRange: string;
  seller: string | null;
  route: number | null;
  pareto: Pareto | null;
  noCoords: boolean;
}

export function parseFilters(params: URLSearchParams, now: Date = new Date()): MapFilters {
  const dateRange = params.get('dateRange');
  const route = params.get('route');
  const pareto = params.get('pareto');
  return {
    dateRange: dateRange && isValidDateRange(dateRange) ? dateRange : previousMonthRange(now),
    seller: params.get('seller') || null,
    route: route && /^\d+$/.test(route) ? parseInt(route, 10) : null,
    pareto: pareto === 'A' || pareto === 'B' || pareto === 'C' ? pareto : null,
    noCoords: params.get('noCoords') === '1',
  };
}

export function serializeFilters(f: MapFilters, now: Date = new Date()): URLSearchParams {
  const p = new URLSearchParams();
  if (f.dateRange !== previousMonthRange(now)) p.set('dateRange', f.dateRange);
  if (f.seller) p.set('seller', f.seller);
  if (f.route !== null) p.set('route', String(f.route));
  if (f.pareto) p.set('pareto', f.pareto);
  if (f.noCoords) p.set('noCoords', '1');
  return p;
}

// A route filter is only meaningful while it exists and (when a seller is
// selected) belongs to that seller.
export function normalizeFilters(f: MapFilters, routes: RouteDto[]): MapFilters {
  if (f.route === null) return f;
  const route = routes.find(r => r.id === f.route);
  if (!route || (f.seller !== null && route.sellerCode !== f.seller)) return { ...f, route: null };
  return f;
}

export function applyFilters(customers: MapCustomer[], f: MapFilters): MapCustomer[] {
  return customers.filter(c =>
    (f.seller === null || c.coVen === f.seller) &&
    (f.route === null || c.routeIds.includes(f.route)) &&
    (f.pareto === null || c.pareto === f.pareto) &&
    (!f.noCoords || c.lat === null),
  );
}

export interface FilterChip {
  key: 'dateRange' | 'seller' | 'route' | 'pareto' | 'noCoords';
  label: string;
}

export function filterChips(
  f: MapFilters, ctx: { sellers: MapSeller[]; routes: RouteDto[] }, now: Date = new Date(),
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.dateRange !== previousMonthRange(now)) {
    const label = periodOptions(now).find(o => o.value === f.dateRange)?.label ?? f.dateRange;
    chips.push({ key: 'dateRange', label: `Período: ${label}` });
  }
  if (f.seller) chips.push({ key: 'seller', label: `Vendedor: ${ctx.sellers.find(s => s.code === f.seller)?.name ?? f.seller}` });
  if (f.route !== null) chips.push({ key: 'route', label: `Ruta: ${ctx.routes.find(r => r.id === f.route)?.name ?? f.route}` });
  if (f.pareto) chips.push({ key: 'pareto', label: `Segmento: ${f.pareto}` });
  if (f.noCoords) chips.push({ key: 'noCoords', label: 'Sin coordenadas' });
  return chips;
}
