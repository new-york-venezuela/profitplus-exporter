import { describe, test, expect } from 'bun:test';
import { mergeCustomers, distinctSellers, type ErpCustomerRow } from '@/lib/geo/merge';

const erp = (over: Partial<ErpCustomerRow> & { coCli: string }): ErpCustomerRow => ({
  name: over.coCli, rif: null, coVen: '000001', sellerName: 'Ana', direc1: null, dirEnt2: null, campo1: null, ...over,
});

describe('mergeCustomers', () => {
  test('parses valid coordinates into lat/lng', () => {
    const [c] = mergeCustomers([erp({ coCli: 'A', campo1: 'Coordenadas: (10.5, -66.9)' })], [], []);
    expect(c).toMatchObject({ lat: 10.5, lng: -66.9, coordinatesIssue: null });
    expect(c).toMatchObject({ areaId: null, sellerMismatch: false });
  });
  test('empty / null campo1 → no pin and NO issue (just unlocated)', () => {
    const rows = mergeCustomers([erp({ coCli: 'A', campo1: null }), erp({ coCli: 'B', campo1: '   ' })], [], []);
    for (const c of rows) expect(c).toMatchObject({ lat: null, lng: null, coordinatesIssue: null });
  });
  test('free text in campo1 → no pin, UNPARSEABLE', () => {
    const [c] = mergeCustomers([erp({ coCli: 'A', campo1: 'llamar antes' })], [], []);
    expect(c).toMatchObject({ lat: null, lng: null, coordinatesIssue: 'UNPARSEABLE' });
  });
  test('swapped and out-of-box coordinates are never plotted', () => {
    const rows = mergeCustomers([
      erp({ coCli: 'S', campo1: 'Coordenadas: (-66.9, 10.5)' }),
      erp({ coCli: 'O', campo1: 'Coordenadas: (40.4, -3.7)' }),
    ], [], []);
    expect(rows[0]).toMatchObject({ lat: null, lng: null, coordinatesIssue: 'SWAPPED_SUSPECTED' });
    expect(rows[1]).toMatchObject({ lat: null, lng: null, coordinatesIssue: 'OUT_OF_RANGE' });
  });
  test('joins revenue by trimmed code; customers without revenue get 0 and no Pareto', () => {
    const rows = mergeCustomers(
      [erp({ coCli: 'A' }), erp({ coCli: 'B' })],
      [{ coCli: 'A', revenueBs: 100, revenueUsd: 2.5 }],
      [],
    );
    expect(rows.find(r => r.coCli === 'A')).toMatchObject({ revenueBs: 100, revenueUsd: 2.5, pareto: 'C' });
    expect(rows.find(r => r.coCli === 'B')).toMatchObject({ revenueBs: 0, revenueUsd: 0, pareto: null });
  });
  test('revenue for a customer not in the ERP active list is ignored', () => {
    const rows = mergeCustomers([erp({ coCli: 'A' })], [{ coCli: 'GHOST', revenueBs: 999, revenueUsd: 9 }], []);
    expect(rows.map(r => r.coCli)).toEqual(['A']);
  });
  test('Pareto ranks over ALL revenue rows, including inactive customers', () => {
    const revenue = [
      { coCli: 'A', revenueBs: 100, revenueUsd: 1 },
      ...['G1', 'G2', 'G3', 'G4'].map(coCli => ({ coCli, revenueBs: 100, revenueUsd: 1 })),
    ];
    const [c] = mergeCustomers([erp({ coCli: 'A' })], revenue, []);
    // 100 of 500 total -> cumulative 20% -> A (ranking only active codes would give C).
    expect(c.pareto).toBe('A');
    expect(c.revenueBs).toBe(100);
  });
  test('null USD (no exchange rate) stays null, not 0', () => {
    const [c] = mergeCustomers([erp({ coCli: 'A' })], [{ coCli: 'A', revenueBs: 10, revenueUsd: null }], []);
    expect(c.revenueUsd).toBeNull();
  });
  test('attaches the ids of every route containing the customer', () => {
    const rows = mergeCustomers(
      [erp({ coCli: 'A' }), erp({ coCli: 'B' })],
      [],
      [
        { id: 1, name: 'R1', sellerCode: '000001', customerCodes: ['A', 'B'] },
        { id: 2, name: 'R2', sellerCode: '000001', customerCodes: ['A'] },
      ],
    );
    expect(rows.find(r => r.coCli === 'A')!.routeIds).toEqual([1, 2]);
    expect(rows.find(r => r.coCli === 'B')!.routeIds).toEqual([1]);
  });
});

describe('distinctSellers', () => {
  test('unique by code, sorted by name, falls back to the code when the name is missing', () => {
    const rows = mergeCustomers([
      erp({ coCli: 'A', coVen: '000002', sellerName: 'Zoe' }),
      erp({ coCli: 'B', coVen: '000001', sellerName: 'Ana' }),
      erp({ coCli: 'C', coVen: '000001', sellerName: 'Ana' }),
      erp({ coCli: 'D', coVen: '000003', sellerName: null }),
    ], [], []);
    expect(distinctSellers(rows)).toEqual([
      // sorted by display name: the code-fallback "000003" sorts before letters
      { code: '000003', name: '000003', inactive: false }, { code: '000001', name: 'Ana', inactive: false }, { code: '000002', name: 'Zoe', inactive: false },
    ]);
  });

  test('carries the ERP inactive flag so inactive sellers are not offered for reassignment', () => {
    const rows = mergeCustomers([erp({ coCli: 'A', coVen: '000001', sellerName: 'Ana', sellerInactive: true })], [], []);
    expect(distinctSellers(rows)).toEqual([{ code: '000001', name: 'Ana', inactive: true }]);
  });
});
