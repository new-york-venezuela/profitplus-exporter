import { describe, test, expect } from 'bun:test';
import { parseFilters, serializeFilters, normalizeFilters, applyFilters, filterChips, type MapFilters } from '@/lib/geo/filters';
import type { MapCustomer, RouteDto } from '@/lib/geo/types';

const NOW = new Date(2026, 8, 30);
const base: MapFilters = { dateRange: 'month:2026-08', seller: null, route: null, area: null, pareto: null, noCoords: false };

const cust = (over: Partial<MapCustomer> & { coCli: string }): MapCustomer => ({
  name: over.coCli, rif: null, coVen: '000001', sellerName: 'Ana', direc1: null, dirEnt2: null,
  lat: 10, lng: -66, coordinatesIssue: null, revenueBs: 0, revenueUsd: 0, pareto: null, routeIds: [],
  areaId: null, areaName: null, areaSellerCodes: [], sellerMismatch: false, ...over,
});

describe('parseFilters / serializeFilters', () => {
  test('empty params → defaults (previous month)', () => {
    expect(parseFilters(new URLSearchParams(), NOW)).toEqual(base);
  });
  test('parses every key', () => {
    const f = parseFilters(new URLSearchParams('dateRange=ytd:2026&seller=000002&route=7&pareto=B&noCoords=1'), NOW);
    expect(f).toEqual({ dateRange: 'ytd:2026', seller: '000002', route: 7, area: null, pareto: 'B', noCoords: true });
  });
  test('garbage values fall back to defaults instead of throwing', () => {
    const f = parseFilters(new URLSearchParams("dateRange=evil';--&route=abc&pareto=Z&noCoords=maybe"), NOW);
    expect(f).toEqual(base);
  });
  test('serialize omits defaults and round-trips', () => {
    expect(serializeFilters(base, NOW).toString()).toBe('');
    const f: MapFilters = { dateRange: 'ytd:2026', seller: '000002', route: 7, area: 5, pareto: 'A', noCoords: true };
    expect(parseFilters(serializeFilters(f, NOW), NOW)).toEqual(f);
  });
});

describe('normalizeFilters', () => {
  const routes: RouteDto[] = [
    { id: 1, name: 'R1', sellerCode: '000001', customerCodes: [] },
    { id: 2, name: 'R2', sellerCode: '000002', customerCodes: [] },
  ];
  test('clears a route that belongs to a different seller', () => {
    expect(normalizeFilters({ ...base, seller: '000001', route: 2 }, routes).route).toBeNull();
  });
  test('keeps a route that matches the seller, or any route when no seller is set', () => {
    expect(normalizeFilters({ ...base, seller: '000001', route: 1 }, routes).route).toBe(1);
    expect(normalizeFilters({ ...base, route: 2 }, routes).route).toBe(2);
  });
  test('clears a route id that no longer exists', () => {
    expect(normalizeFilters({ ...base, route: 99 }, routes).route).toBeNull();
  });
});

describe('applyFilters', () => {
  const rows = [
    cust({ coCli: 'A', coVen: '000001', pareto: 'A', routeIds: [1] }),
    cust({ coCli: 'B', coVen: '000002', pareto: 'B', routeIds: [1, 2] }),
    cust({ coCli: 'C', coVen: '000001', pareto: null, lat: null, lng: null }),
  ];
  const codes = (f: Partial<MapFilters>) => applyFilters(rows, { ...base, ...f }).map(r => r.coCli);
  test('no filters → everyone', () => expect(codes({})).toEqual(['A', 'B', 'C']));
  test('seller', () => expect(codes({ seller: '000001' })).toEqual(['A', 'C']));
  test('route', () => expect(codes({ route: 1 })).toEqual(['A', 'B']));
  test('pareto', () => expect(codes({ pareto: 'B' })).toEqual(['B']));
  test('noCoords keeps only customers without a pin', () => expect(codes({ noCoords: true })).toEqual(['C']));
  test('filters combine with AND', () => expect(codes({ seller: '000001', route: 1 })).toEqual(['A']));
});

describe('filterChips', () => {
  test('no chips for defaults', () => {
    expect(filterChips(base, { sellers: [], routes: [] }, NOW)).toEqual([]);
  });
  test('one chip per active non-default filter, human-labelled', () => {
    const chips = filterChips(
      { dateRange: 'ytd:2026', seller: '000001', route: 1, area: null, pareto: 'A', noCoords: true },
      { sellers: [{ code: '000001', name: 'Ana' }], routes: [{ id: 1, name: 'Lunes', sellerCode: '000001', customerCodes: [] }] },
      NOW,
    );
    expect(chips.map(c => c.key)).toEqual(['dateRange', 'seller', 'route', 'pareto', 'noCoords']);
    expect(chips.find(c => c.key === 'seller')!.label).toBe('Vendedor: Ana');
    expect(chips.find(c => c.key === 'route')!.label).toBe('Ruta: Lunes');
    expect(chips.find(c => c.key === 'pareto')!.label).toBe('Segmento: A');
    expect(chips.find(c => c.key === 'noCoords')!.label).toBe('Sin coordenadas');
  });
});

describe('area filter', () => {
  test('parse, serialize, apply, and clear when the area no longer exists', () => {
    expect(parseFilters(new URLSearchParams('area=5'), NOW).area).toBe(5);
    expect(parseFilters(new URLSearchParams('area=x'), NOW).area).toBeNull();
    expect(serializeFilters({ ...base, area: 5 }, NOW).toString()).toBe('area=5');
    const rows = [cust({ coCli: 'A', areaId: 5 }), cust({ coCli: 'B', areaId: 6 }), cust({ coCli: 'C' })];
    expect(applyFilters(rows, { ...base, area: 5 }).map(r => r.coCli)).toEqual(['A']);
    expect(normalizeFilters({ ...base, area: 9 }, [], [{ id: 5, name: 'N', color: '#000000', ring: [], sellerCodes: [] }]).area).toBeNull();
    expect(filterChips({ ...base, area: 5 }, { sellers: [], routes: [], areas: [{ id: 5, name: 'Norte', color: '#000000', ring: [], sellerCodes: [] }] }, NOW)
      .find(c => c.key === 'area')!.label).toBe('Zona: Norte');
  });
});
