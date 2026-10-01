import { parseCoordinates, validateCoordinates } from './coordinates';
import { assignPareto } from './pareto';
import type { MapCustomer, MapSeller, RouteDto } from './types';

export interface ErpCustomerRow {
  coCli: string; name: string; rif: string | null;
  coVen: string; sellerName: string | null;
  direc1: string | null; dirEnt2: string | null; campo1: string | null;
}

export interface RevenueRow { coCli: string; revenueBs: number; revenueUsd: number | null }

const blankToNull = (v: string | null) => (v && v.trim() ? v.trim() : null);

function locate(campo1: string | null): Pick<MapCustomer, 'lat' | 'lng' | 'coordinatesIssue'> {
  if (!campo1 || !campo1.trim()) return { lat: null, lng: null, coordinatesIssue: null };
  const parsed = parseCoordinates(campo1);
  if (!parsed) return { lat: null, lng: null, coordinatesIssue: 'UNPARSEABLE' };
  const v = validateCoordinates(parsed);
  if (!v.ok) return { lat: null, lng: null, coordinatesIssue: v.error };
  return { lat: parsed.lat, lng: parsed.lng, coordinatesIssue: null };
}

export function mergeCustomers(erp: ErpCustomerRow[], revenue: RevenueRow[], routes: RouteDto[]): MapCustomer[] {
  const known = new Set(erp.map(c => c.coCli.trim()));
  const revenueByCode = new Map<string, RevenueRow>();
  for (const r of revenue) {
    const code = r.coCli.trim();
    if (!known.has(code)) continue;
    const prev = revenueByCode.get(code);
    revenueByCode.set(code, prev
      ? { coCli: code, revenueBs: prev.revenueBs + r.revenueBs, revenueUsd: prev.revenueUsd === null && r.revenueUsd === null ? null : (prev.revenueUsd ?? 0) + (r.revenueUsd ?? 0) }
      : { ...r, coCli: code });
  }
  const pareto = assignPareto([...revenueByCode.values()]);

  const routeIdsByCustomer = new Map<string, number[]>();
  for (const route of routes) {
    for (const code of route.customerCodes) {
      const list = routeIdsByCustomer.get(code) ?? [];
      list.push(route.id);
      routeIdsByCustomer.set(code, list);
    }
  }

  return erp.map(c => {
    const code = c.coCli.trim();
    const rev = revenueByCode.get(code);
    return {
      coCli: code,
      name: c.name.trim(),
      rif: blankToNull(c.rif),
      coVen: c.coVen.trim(),
      sellerName: blankToNull(c.sellerName),
      direc1: blankToNull(c.direc1),
      dirEnt2: blankToNull(c.dirEnt2),
      ...locate(c.campo1),
      revenueBs: rev?.revenueBs ?? 0,
      revenueUsd: rev ? rev.revenueUsd : 0,
      pareto: pareto.get(code) ?? null,
      routeIds: routeIdsByCustomer.get(code) ?? [],
      areaId: null, areaName: null, areaSellerCodes: [], sellerMismatch: false,
    };
  });
}

export function distinctSellers(customers: MapCustomer[]): MapSeller[] {
  const byCode = new Map<string, MapSeller>();
  for (const c of customers) {
    if (!byCode.has(c.coVen)) byCode.set(c.coVen, { code: c.coVen, name: c.sellerName ?? c.coVen });
  }
  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
