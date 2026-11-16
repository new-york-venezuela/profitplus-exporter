import { describe, expect, test } from 'bun:test';
import {
  buildClienteBreakdown, OVERDUE_FACTOR, OVERDUE_LOOKBACK_MONTHS, OVERDUE_MIN_ORDERS, RETURN_WARN_MULTIPLE,
  type ClienteRaw,
} from '../customer-breakdown';

const raw = (o: Partial<ClienteRaw> & { id: string }): ClienteRaw => ({
  name: o.id, groupCode: null, groupName: null, posItem: 1, posTotal: 1,
  gross: { bs: 100, usd: 10 }, returns: { bs: 0, usd: 0 }, units: 10,
  orders: 0, firstOrderKey: null, lastOrderKey: null, ...o,
});
const bs = { currency: 'bs' as const, todayKey: 20261116 };

describe('constants', () => {
  test('named values', () => {
    expect([OVERDUE_LOOKBACK_MONTHS, OVERDUE_MIN_ORDERS, OVERDUE_FACTOR, RETURN_WARN_MULTIPLE]).toEqual([12, 3, 2, 2]);
  });
});

describe('concentration', () => {
  test('top 3 of 4 clients, sorted by net desc, shares sum to 1', () => {
    const r = buildClienteBreakdown([
      raw({ id: 'a', gross: { bs: 10, usd: 1 } }), raw({ id: 'b', gross: { bs: 40, usd: 4 } }),
      raw({ id: 'c', gross: { bs: 30, usd: 3 } }), raw({ id: 'd', gross: { bs: 20, usd: 2 } }),
    ], bs);
    expect(r.rows.map(x => x.id)).toEqual(['b', 'c', 'd', 'a']);
    expect(r.itemNet).toEqual({ bs: 100, usd: 10 });
    expect(r.top3SharePct).toBeCloseTo(0.9, 10);
    expect(r.rows.reduce((s, x) => s + (x.sharePct ?? 0), 0)).toBeCloseTo(1, 10);
    expect(r.rows.reduce((s, x) => s + x.net.bs, 0)).toBe(r.itemNet.bs);
  });
  test('fewer than 3 clients: top3 is all of them', () => {
    const r = buildClienteBreakdown([raw({ id: 'a' }), raw({ id: 'b' })], bs);
    expect(r.top3SharePct).toBe(1);
  });
  test('item net <= 0: shares and top3 null', () => {
    const r = buildClienteBreakdown([raw({ id: 'a', gross: { bs: 10, usd: 1 }, returns: { bs: 10, usd: 1 } })], bs);
    expect(r.top3SharePct).toBeNull();
    expect(r.rows[0].sharePct).toBeNull();
  });
  test('empty input', () => {
    const r = buildClienteBreakdown([], bs);
    expect(r.rows).toEqual([]);
    expect(r.top3SharePct).toBeNull();
    expect(r.itemReturnRate).toBeNull();
  });
  test('USD mode: null USD nets sort last with null share', () => {
    const r = buildClienteBreakdown([
      raw({ id: 'n', gross: { bs: 999, usd: null } }), raw({ id: 'a', gross: { bs: 1, usd: 5 } }), raw({ id: 'b', gross: { bs: 1, usd: 15 } }),
    ], { currency: 'usd', todayKey: 20261116 });
    expect(r.rows.map(x => x.id)).toEqual(['b', 'a', 'n']);
    expect(r.rows[2].sharePct).toBeNull();
    expect(r.rows[0].sharePct).toBeCloseTo(0.75, 10);
    expect(r.top3SharePct).toBe(1);
    expect(r.rows[2].avgPrice.usd).toBeNull();
  });
});

describe('returns flags', () => {
  test('highReturn is strictly above 4 %', () => {
    const r = buildClienteBreakdown([
      raw({ id: 'eq', gross: { bs: 100, usd: 10 }, returns: { bs: 4, usd: 0.4 } }),
      raw({ id: 'hi', gross: { bs: 100, usd: 10 }, returns: { bs: 4.1, usd: 0.41 } }),
    ], bs);
    expect(r.rows.find(x => x.id === 'eq')!.highReturn).toBe(false);
    expect(r.rows.find(x => x.id === 'hi')!.highReturn).toBe(true);
  });
  test('returnWarn needs item rate > 0 and client rate > 2x', () => {
    const none = buildClienteBreakdown([raw({ id: 'a' }), raw({ id: 'b' })], bs);
    expect(none.itemReturnRate).toBe(0);
    expect(none.rows.every(x => !x.returnWarn)).toBe(true);
    const r = buildClienteBreakdown([
      raw({ id: 'a', gross: { bs: 100, usd: 10 }, returns: { bs: 10, usd: 1 } }),
      raw({ id: 'b', gross: { bs: 100, usd: 10 }, returns: { bs: 0, usd: 0 } }),
      raw({ id: 'c', gross: { bs: 100, usd: 10 }, returns: { bs: 2, usd: 0.2 } }),
    ], bs);
    expect(r.itemReturnRate).toBeCloseTo(0.04, 10);
    const by = (id: string) => r.rows.find(x => x.id === id)!;
    expect(by('a').returnWarn).toBe(true);
    expect(by('b').returnWarn).toBe(false);
    expect(by('c').returnWarn).toBe(false); // 2 % is not above 8 %
  });
  test('avg price and null return rate when gross is 0', () => {
    const r = buildClienteBreakdown([raw({ id: 'a', gross: { bs: 0, usd: 0 }, units: 0 })], bs);
    expect(r.rows[0].returnRate).toBeNull();
    expect(r.rows[0].avgPrice).toEqual({ bs: 0, usd: 0 });
  });
});

describe('overdue', () => {
  // first 20260101, last 20260111 => gap = 10 / (3 - 1)... use orders so avgGap = 5
  const hist = { orders: 3, firstOrderKey: 20260101, lastOrderKey: 20260111 };
  test('exactly 2x the gap is not overdue; one day more is', () => {
    // last 2026-01-11, today 2026-01-21 => 10 days = 2 x 5
    const eq = buildClienteBreakdown([raw({ id: 'a', ...hist })], { currency: 'bs', todayKey: 20260121 }).rows[0];
    expect(eq.avgGapDays).toBe(5);
    expect(eq.daysSinceLastOrder).toBe(10);
    expect(eq.overdue).toBe(false);
    const over = buildClienteBreakdown([raw({ id: 'a', ...hist })], { currency: 'bs', todayKey: 20260122 }).rows[0];
    expect(over.daysSinceLastOrder).toBe(11);
    expect(over.overdue).toBe(true);
  });
  test('2 orders: overdue null', () => {
    const r = buildClienteBreakdown([raw({ id: 'a', orders: 2, firstOrderKey: 20260101, lastOrderKey: 20260111 })], { currency: 'bs', todayKey: 20261116 }).rows[0];
    expect(r.overdue).toBeNull();
  });
  test('same-day orders (gap 0): overdue null', () => {
    const r = buildClienteBreakdown([raw({ id: 'a', orders: 3, firstOrderKey: 20260101, lastOrderKey: 20260101 })], { currency: 'bs', todayKey: 20261116 }).rows[0];
    expect(r.overdue).toBeNull();
    expect(r.daysSinceLastOrder).toBe(319);
  });
  test('no history: all null; date formatted and month boundaries', () => {
    const none = buildClienteBreakdown([raw({ id: 'a' })], bs).rows[0];
    expect([none.lastOrderDate, none.daysSinceLastOrder, none.avgGapDays, none.overdue]).toEqual([null, null, null, null]);
    const r = buildClienteBreakdown([raw({ id: 'a', orders: 3, firstOrderKey: 20260201, lastOrderKey: 20260228 })], { currency: 'bs', todayKey: 20260302 }).rows[0];
    expect(r.lastOrderDate).toBe('2026-02-28');
    expect(r.daysSinceLastOrder).toBe(2);
  });
});

describe('group', () => {
  test('group badge only when both code and name', () => {
    const r = buildClienteBreakdown([raw({ id: 'a', groupCode: 'G1', groupName: 'Cadenas' }), raw({ id: 'b', groupCode: 'G1' })], bs);
    expect(r.rows.find(x => x.id === 'a')!.group).toEqual({ code: 'G1', name: 'Cadenas' });
    expect(r.rows.find(x => x.id === 'b')!.group).toBeNull();
  });
});
