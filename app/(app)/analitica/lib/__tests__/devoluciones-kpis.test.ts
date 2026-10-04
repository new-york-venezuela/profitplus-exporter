import { describe, test, expect } from 'bun:test';
import { MIN_SELLER_SALES_SHARE, safeRatio, pickTopSellerByRate } from '../devoluciones-kpis';

describe('safeRatio', () => {
  test('null for non-positive denominators', () => {
    expect(safeRatio(5, 0)).toBeNull();
    expect(safeRatio(5, -1)).toBeNull();
    expect(safeRatio(5, 100)).toBeCloseTo(0.05);
  });
});

describe('pickTopSellerByRate', () => {
  const rows = [
    { name: 'Tiny', returnsBs: 90, salesBs: 90 }, // 100% rate but a sliver of sales
    { name: 'Big', returnsBs: 50, salesBs: 500 }, // 10%
    { name: 'Mid', returnsBs: 20, salesBs: 400 }, // 5%
  ];
  test('nobody reaching the minimum share is null', () => {
    expect(MIN_SELLER_SALES_SHARE).toBe(0.01);
    expect(pickTopSellerByRate(rows, 100_000)).toBeNull();
  });
  test('ignores sellers below the minimum sales share', () => {
    const r = pickTopSellerByRate(rows, 5_000); // 1% = 50 -> Tiny (90) qualifies!
    expect(r?.name).toBe('Tiny');
    const r2 = pickTopSellerByRate(rows, 20_000); // 1% = 200 -> Tiny out, Big/Mid in
    expect(r2?.name).toBe('Big');
    expect(r2?.rate).toBeCloseTo(0.1);
  });
  test('null with no rows or no sales', () => {
    expect(pickTopSellerByRate([], 1000)).toBeNull();
    expect(pickTopSellerByRate([{ name: 'A', returnsBs: 1, salesBs: 10 }], 0)).toBeNull();
  });
  test('sellers with zero returns do not win', () => {
    expect(pickTopSellerByRate([{ name: 'A', returnsBs: 0, salesBs: 500 }], 1000)).toBeNull();
  });
});
