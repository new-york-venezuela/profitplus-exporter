import { describe, test, expect } from 'bun:test';
import { findDiscrepancies } from '@/lib/geo/discrepancies';
import type { MapCustomer } from '@/lib/geo/types';

const cust = (over: Partial<MapCustomer> & { coCli: string }): MapCustomer => ({
  name: over.coCli, rif: null, coVen: '1', sellerName: null, direc1: null, dirEnt2: null,
  lat: 10, lng: -66, coordinatesIssue: null, revenueBs: 0, revenueUsd: 0, pareto: null, routeIds: [],
  areaId: null, areaName: null, areaSellerCodes: [], sellerMismatch: false, ...over,
});

describe('findDiscrepancies', () => {
  const rows = [
    cust({ coCli: 'ok', areaId: 1, areaName: 'N', areaSellerCodes: ['1'] }),
    cust({ coCli: 'bad', areaId: 1, areaName: 'N', areaSellerCodes: ['2'], sellerMismatch: true }),
    cust({ coCli: 'out' }),
    cust({ coCli: 'nocoords', lat: null, lng: null }),
  ];
  test('mismatched = flagged customers; outside = located customers in no area', () => {
    const d = findDiscrepancies(rows, true);
    expect(d.mismatched.map(c => c.coCli)).toEqual(['bad']);
    expect(d.outside.map(c => c.coCli)).toEqual(['out']);
  });
  test('with no areas defined nothing is "outside" (there is nothing to be outside of)', () => {
    expect(findDiscrepancies(rows, false).outside).toEqual([]);
  });
});
