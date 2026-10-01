import { describe, test, expect } from 'bun:test';
import { heatPoints } from '@/lib/geo/layers';
import type { MapCustomer } from '@/lib/geo/types';

const cust = (over: Partial<MapCustomer> & { coCli: string }): MapCustomer => ({
  name: over.coCli, rif: null, coVen: '1', sellerName: null, direc1: null, dirEnt2: null,
  lat: null, lng: null, coordinatesIssue: null, revenueBs: 0, revenueUsd: 0, pareto: null, routeIds: [],
  areaId: null, areaName: null, areaSellerCodes: [], sellerMismatch: false, ...over,
});

describe('heatPoints', () => {
  test('only located customers with positive USD revenue, weighted by revenue', () => {
    expect(heatPoints([
      cust({ coCli: 'A', lat: 10, lng: -66, revenueUsd: 200 }),
      cust({ coCli: 'B', lat: 10, lng: -66, revenueUsd: 0 }),
      cust({ coCli: 'C', lat: 10, lng: -66, revenueUsd: null }),
      cust({ coCli: 'D', revenueUsd: 50 }),
    ])).toEqual([[10, -66, 200]]);
  });
  test('empty input → empty output', () => expect(heatPoints([])).toEqual([]));
});
