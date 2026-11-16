import { describe, expect, test } from 'bun:test';
import { buildBubbleData } from '../bubble-data';
import type { CatalogoRow } from '@/app/(app)/analitica/types';

function row(over: Partial<CatalogoRow>): CatalogoRow {
  return {
    key: 'K', label: 'K', code: null, linea: 'L', sublinea: '',
    salesGross: { bs: 1000, usd: 20 }, returns: { bs: 0, usd: 0 }, salesNet: { bs: 1000, usd: 20 },
    units: 100, monthCount: 2, avgUnitsPerMonth: 50, avgPrice: { bs: 10, usd: 0.2 },
    returnRate: 0.05, clientCount: 1, posCount: 1, sharePct: 0.5, pareto: 'A', prevNet: null, trendPct: 0.1,
    ...over,
  };
}

describe('buildBubbleData', () => {
  test('empty input', () => {
    expect(buildBubbleData([], 'trend', 'bs')).toEqual({ points: [], missing: 0, truncated: 0 });
  });

  test('single item maps x, y, size, class', () => {
    const { points, missing, truncated } = buildBubbleData([row({ key: 'a', label: 'A' })], 'trend', 'bs');
    expect(missing).toBe(0);
    expect(truncated).toBe(0);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({
      key: 'a', label: 'A', x: 50, y: 0.1, yReal: 0.1, size: 1000, net: 1000,
      pareto: 'A', trendPct: 0.1, returnRate: 0.05,
    });
  });

  test('null Y counts as missing and is not plotted (both modes)', () => {
    const rows = [row({ key: 'a', trendPct: null }), row({ key: 'b', returnRate: null }), row({ key: 'c' })];
    const t = buildBubbleData(rows, 'trend', 'bs');
    expect(t.points.map(p => p.key).sort()).toEqual(['b', 'c']);
    expect(t.missing).toBe(1);
    const r = buildBubbleData(rows, 'returnRate', 'bs');
    expect(r.points.map(p => p.key).sort()).toEqual(['a', 'c']);
    expect(r.missing).toBe(1);
  });

  test('net <= 0 counts as missing', () => {
    const rows = [
      row({ key: 'zero', salesNet: { bs: 0, usd: 0 } }),
      row({ key: 'neg', salesNet: { bs: -5, usd: -1 } }),
      row({ key: 'ok' }),
    ];
    const r = buildBubbleData(rows, 'trend', 'bs');
    expect(r.points.map(p => p.key)).toEqual(['ok']);
    expect(r.missing).toBe(2);
  });

  test('USD mode uses usd net and drops null-USD items to missing', () => {
    const rows = [
      row({ key: 'a', salesNet: { bs: 1000, usd: 20 } }),
      row({ key: 'b', salesNet: { bs: 900, usd: null } }),
    ];
    const r = buildBubbleData(rows, 'trend', 'usd');
    expect(r.points.map(p => p.key)).toEqual(['a']);
    expect(r.points[0].size).toBe(20);
    expect(r.missing).toBe(1);
  });

  test('cap keeps the top by net desc and reports truncated', () => {
    const rows = [1, 2, 3, 4, 5].map(i => row({ key: `k${i}`, salesNet: { bs: i * 100, usd: i } }));
    const r = buildBubbleData(rows, 'trend', 'bs', { cap: 3 });
    expect(r.points.map(p => p.key)).toEqual(['k5', 'k4', 'k3']);
    expect(r.truncated).toBe(2);
    expect(r.missing).toBe(0);
  });

  test('default cap is 150', () => {
    const rows = Array.from({ length: 160 }, (_, i) => row({ key: `k${i}`, salesNet: { bs: i + 1, usd: i + 1 } }));
    const r = buildBubbleData(rows, 'trend', 'bs');
    expect(r.points).toHaveLength(150);
    expect(r.truncated).toBe(10);
  });

  test('trend y is clamped to +/-200% but yReal keeps the real value', () => {
    const rows = [row({ key: 'up', trendPct: 5 }), row({ key: 'down', trendPct: -3 }), row({ key: 'in', trendPct: 1.5 })];
    const r = buildBubbleData(rows, 'trend', 'bs');
    const by = Object.fromEntries(r.points.map(p => [p.key, p]));
    expect(by.up).toMatchObject({ y: 2, yReal: 5 });
    expect(by.down).toMatchObject({ y: -2, yReal: -3 });
    expect(by.in).toMatchObject({ y: 1.5, yReal: 1.5 });
  });

  test('clampPct option overrides; return rate is never clamped', () => {
    const t = buildBubbleData([row({ trendPct: 1 })], 'trend', 'bs', { clampPct: 0.5 });
    expect(t.points[0]).toMatchObject({ y: 0.5, yReal: 1 });
    const r = buildBubbleData([row({ returnRate: 3 })], 'returnRate', 'bs');
    expect(r.points[0]).toMatchObject({ y: 3, yReal: 3 });
  });

  test('null pareto is kept as null', () => {
    const r = buildBubbleData([row({ pareto: null })], 'trend', 'bs');
    expect(r.points[0].pareto).toBeNull();
  });
});
