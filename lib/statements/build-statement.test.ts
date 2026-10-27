import { describe, expect, test } from 'bun:test';
import { buildStatement, resolveUsdRate } from './build-statement';
import type { StatementDoc, UsdRate } from './types';

const d = (s: string, h = 0) => {
  const [y, m, day] = s.split('-').map(Number);
  return new Date(y, m - 1, day, h);
};
const addDays = (s: string, n: number) => {
  const [y, m, day] = s.split('-').map(Number);
  return new Date(y, m - 1, day + n);
};
const ASOF = '2026-10-26';
const rates: UsdRate[] = [{ fecha: d('2026-01-01'), tasaV: 50 }];
const doc = (over: Partial<StatementDoc>): StatementDoc => ({
  coTipoDoc: 'FACT',
  nroDoc: '1',
  fecEmis: d('2026-10-01'),
  fecVenc: d(ASOF),
  saldoBsd: 1000,
  ...over,
});
const build = (docs: StatementDoc[], r = rates) => buildStatement(docs, r, d(ASOF));

describe('resolveUsdRate', () => {
  const rs: UsdRate[] = [
    { fecha: d('2026-03-10'), tasaV: 40 },
    { fecha: d('2026-03-01'), tasaV: 30 },
    { fecha: d('2026-03-12', 14), tasaV: 45 },
  ];
  test('latest on or before, unsorted input', () => {
    expect(resolveUsdRate(rs, d('2026-03-11'))).toBe(40);
  });
  test('rate dated 14:00 same day counts', () => {
    expect(resolveUsdRate(rs, d('2026-03-12', 0))).toBe(45);
  });
  test('null before first rate', () => {
    expect(resolveUsdRate(rs, d('2026-02-28'))).toBeNull();
  });
});

describe('buildStatement', () => {
  test('FACT is debt with USD', () => {
    const s = build([doc({})]);
    const r = s.rows[0];
    expect(r.kind).toBe('debt');
    expect(r.rate).toBe(50);
    expect(r.amountUsd).toBe(20);
    expect(s.total).toEqual({ bsd: 1000, usd: 20 });
  });
  test('N/CR reduces', () => {
    const s = build([doc({}), doc({ coTipoDoc: 'N/CR', nroDoc: '2', saldoBsd: 500 })]);
    const cr = s.rows.find((r) => r.coTipoDoc === 'N/CR')!;
    expect(cr.kind).toBe('reducing');
    expect(cr.amountBsd).toBe(-500);
    expect(cr.amountUsd).toBe(-10);
    expect(cr.daysOverdue).toBeNull();
    expect(s.credits.bsd).toBe(-500);
    expect(s.total.bsd).toBe(500);
    expect(s.total.usd).toBe(10);
  });
  test('N/DB is debt; ADEL and NCR reducing', () => {
    const s = build([
      doc({ coTipoDoc: 'N/DB' }),
      doc({ coTipoDoc: 'ADEL', nroDoc: '2' }),
      doc({ coTipoDoc: 'NCR', nroDoc: '3' }),
    ]);
    expect(s.rows.map((r) => r.kind)).toEqual(['debt', 'reducing', 'reducing']);
    expect(s.rows.every((r) => !r.unknownType)).toBe(true);
  });
  test('unknown type is reducing + flagged', () => {
    const r = build([doc({ coTipoDoc: 'XYZ' })]).rows[0];
    expect(r.kind).toBe('reducing');
    expect(r.unknownType).toBe(true);
    expect(r.amountBsd).toBe(-1000);
  });
  test('missing rate: null usd, incomplete, excluded from usd sums', () => {
    const s = build([
      doc({}),
      doc({ nroDoc: '2', fecEmis: d('2025-01-01') }),
    ]);
    const missing = s.rows.find((r) => r.nroDoc === '2')!;
    expect(missing.amountUsd).toBeNull();
    expect(missing.rate).toBeNull();
    expect(s.incomplete).toBe(true);
    expect(s.total).toEqual({ bsd: 2000, usd: 20 });
    expect(s.aging.porVencer).toEqual({ bsd: 2000, usd: 20 });
  });
  test('complete when all rates found', () => {
    expect(build([doc({})]).incomplete).toBe(false);
  });

  const bucketOf = (fecVenc: Date | null) => {
    const s = build([doc({ fecVenc })]);
    const a = s.aging;
    const name = (Object.keys(a) as (keyof typeof a)[]).find((k) => a[k].bsd === 1000);
    return { name, days: s.rows[0].daysOverdue };
  };
  test.each([
    [0, 'porVencer', 0],
    [-1, 'd1_30', 1],
    [-30, 'd1_30', 30],
    [-31, 'd31_60', 31],
    [-60, 'd31_60', 60],
    [-61, 'd61_90', 61],
    [-90, 'd61_90', 90],
    [-91, 'd90plus', 91],
    [5, 'porVencer', -5],
  ] as [number, string, number][])('fecVenc asOf%+d -> %s', (off, bucket, days) => {
    const r = bucketOf(addDays(ASOF, off));
    expect(r.name).toBe(bucket);
    expect(r.days).toBe(days);
  });
  test('null fecVenc -> porVencer, daysOverdue null', () => {
    const r = bucketOf(null);
    expect(r.name).toBe('porVencer');
    expect(r.days).toBeNull();
  });

  test('only credits gives negative total', () => {
    const s = build([doc({ coTipoDoc: 'N/CR' })]);
    expect(s.total.bsd).toBeLessThan(0);
    expect(s.aging.porVencer.bsd).toBe(0);
  });
  test('sort: debt by fecVenc asc, then reducing', () => {
    const s = build([
      doc({ coTipoDoc: 'N/CR', nroDoc: 'c' }),
      doc({ nroDoc: 'b', fecVenc: addDays(ASOF, -1) }),
      doc({ nroDoc: 'a', fecVenc: addDays(ASOF, -10) }),
    ]);
    expect(s.rows.map((r) => r.nroDoc)).toEqual(['a', 'b', 'c']);
  });
});
