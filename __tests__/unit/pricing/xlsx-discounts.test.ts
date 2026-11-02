import { describe, expect, test } from 'bun:test';
import { compileDiscounts, parseDiscountsCsv, type DiscountRow } from '@/lib/pricing/xlsx/discounts';

const H = 'co_cli,co_art,precio,desde,hasta\n';

const row = (o: Partial<DiscountRow> & { coCli: string }): DiscountRow => ({
  line: 2, coArt: 'A1', kind: 'percent', value: 8, desde: '2026-11-01', hasta: null, ...o,
});
const lists = (m: Record<string, Record<string, number>>) => (c: string) =>
  m[c] ? new Map(Object.entries(m[c])) : null;

describe('parseDiscountsCsv', () => {
  test('parses price and percent rows', () => {
    const r = parseDiscountsCsv(`${H}C1,A1,12.40,2026-11-01,2026-12-31\nC1,A2,-8%,2026-11-01,2026-12-31\n`);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { line: 2, coCli: 'C1', coArt: 'A1', kind: 'price', value: 12.4, desde: '2026-11-01', hasta: '2026-12-31' },
      { line: 3, coCli: 'C1', coArt: 'A2', kind: 'percent', value: 8, desde: '2026-11-01', hasta: '2026-12-31' },
    ]);
  });
  test('blank hasta is null', () => {
    expect(parseDiscountsCsv(`${H}C1,A1,5,2026-11-01,\n`).rows[0].hasta).toBeNull();
  });
  test('bad header and semicolon hint', () => {
    expect(parseDiscountsCsv('a,b\n').errors[0]).toContain('encabezado');
    expect(parseDiscountsCsv('co_cli;co_art;precio;desde;hasta\n').errors[0]).toContain(';');
  });
  test('duplicate (coCli, coArt) case-insensitive', () => {
    const r = parseDiscountsCsv(`${H}C1,a1,5,2026-11-01,\nc1,A1,6,2026-11-01,\n`);
    expect(r.errors.some(e => e.includes('línea 3') && e.includes('repetid'))).toBe(true);
  });
  test.each(['8%', '-0%', '-100%', '-101%', '-%', '-8.5.5%'])('invalid percent %s', p => {
    const r = parseDiscountsCsv(`${H}C1,A1,${p},2026-11-01,\n`);
    expect(r.errors.length).toBe(1);
    expect(r.errors[0]).toContain('línea 2');
  });
  test('decimal percent ok', () => {
    expect(parseDiscountsCsv(`${H}C1,A1,-7.5%,2026-11-01,\n`).rows[0].value).toBe(7.5);
  });
  test('price rules from parsePrice', () => {
    expect(parseDiscountsCsv(`${H}C1,A1,0,2026-11-01,\n`).errors.length).toBe(1);
    expect(parseDiscountsCsv(`${H}C1,A1,"1,5",2026-11-01,\n`).errors.length).toBe(1);
  });
  test('bad dates and hasta < desde', () => {
    expect(parseDiscountsCsv(`${H}C1,A1,5,01/11/2026,\n`).errors[0]).toContain('desde');
    expect(parseDiscountsCsv(`${H}C1,A1,5,2026-11-01,xx\n`).errors[0]).toContain('hasta');
    expect(parseDiscountsCsv(`${H}C1,A1,5,2026-11-05,2026-11-01\n`).errors[0]).toContain('hasta');
  });
  test('one customer with different hasta values', () => {
    const r = parseDiscountsCsv(`${H}C1,A1,5,2026-11-01,2026-12-01\nC1,A2,5,2026-11-01,2026-12-31\n`);
    expect(r.errors.some(e => e.includes('C1') && e.includes('hasta'))).toBe(true);
  });
  test('missing fields', () => {
    expect(parseDiscountsCsv(`${H}C1,,5,2026-11-01,\n`).errors[0]).toContain('faltan');
  });
});

describe('compileDiscounts', () => {
  const tl = lists({ C1: { A1: 10, A2: 20 }, C2: { A1: 10, A2: 20 } });

  test('-8% over base 10 gives 9.2', () => {
    const r = compileDiscounts([row({ coCli: 'C1' })], tl);
    expect(r.errors).toEqual([]);
    expect(r.sets[0].overrides.get('A1')).toBe(9.2);
  });
  test('rounds to 5 decimals', () => {
    const r = compileDiscounts([row({ coCli: 'C1', value: 33.33333 })], lists({ C1: { A1: 7 } }));
    expect(r.sets[0].overrides.get('A1')).toBe(4.66667);
  });
  test('result of 0 rejected', () => {
    const r = compileDiscounts([row({ coCli: 'C1' })], lists({ C1: { A1: 0 } }));
    expect(r.sets).toEqual([]);
    expect(r.errors.length).toBe(1);
  });
  test('tiny base rounding to 0 rejected', () => {
    const r = compileDiscounts([row({ coCli: 'C1', value: 90 })], lists({ C1: { A1: 0.00001 } }));
    expect(r.errors.length).toBe(1);
  });
  test('article missing in type list (percent and price) mentions co_art', () => {
    const a = compileDiscounts([row({ coCli: 'C1', coArt: 'ZZ' })], tl);
    expect(a.errors[0]).toContain('ZZ');
    const b = compileDiscounts([row({ coCli: 'C1', coArt: 'ZZ', kind: 'price', value: 5 })], tl);
    expect(b.errors[0]).toContain('ZZ');
  });
  test('unresolvable type list', () => {
    const r = compileDiscounts([row({ coCli: 'NOPE' })], tl);
    expect(r.errors).toEqual(['cliente NOPE: no se pudo determinar su lista de tipo']);
    expect(r.sets).toEqual([]);
  });
  test('identical overrides and desde share one set, hasta may differ', () => {
    const r = compileDiscounts([
      row({ coCli: 'C1', hasta: '2026-12-01' }),
      row({ coCli: 'C2', kind: 'price', value: 9.2, hasta: '2026-12-31' }),
    ], tl);
    expect(r.errors).toEqual([]);
    expect(r.sets.length).toBe(1);
    expect(r.sets[0].customers).toEqual([
      { coCli: 'C1', desde: '2026-11-01', hasta: '2026-12-01' },
      { coCli: 'C2', desde: '2026-11-01', hasta: '2026-12-31' },
    ]);
  });
  test('same overrides, different desde: two sets with distinct keys', () => {
    const r = compileDiscounts([row({ coCli: 'C1' }), row({ coCli: 'C2', desde: '2026-11-15' })], tl);
    expect(r.sets.length).toBe(2);
    expect(r.sets[0].key).not.toBe(r.sets[1].key);
  });
  test('different prices: two sets; key stable and 8 hex', () => {
    const rows = [row({ coCli: 'C1' }), row({ coCli: 'C2', value: 10 })];
    const a = compileDiscounts(rows, tl);
    const b = compileDiscounts(rows, tl);
    expect(a.sets.length).toBe(2);
    expect(a.sets.map(s => s.key)).toEqual(b.sets.map(s => s.key));
    expect(a.sets[0].key).toMatch(/^[0-9a-f]{8}$/);
  });
  test('article order does not change key', () => {
    const r = compileDiscounts([
      row({ coCli: 'C1', coArt: 'A1' }), row({ coCli: 'C1', coArt: 'A2' }),
      row({ coCli: 'C2', coArt: 'A2' }), row({ coCli: 'C2', coArt: 'A1' }),
    ], tl);
    expect(r.sets.length).toBe(1);
  });
  const tlc = lists({ c1: { A1: 10, A2: 20 }, C1: { A1: 10, A2: 20 } });
  test('case-variant customer across rows is ONE customer in ONE set', () => {
    const r = compileDiscounts([
      row({ coCli: 'c1', coArt: 'A1' }),
      row({ coCli: 'C1', coArt: 'A2' }),
    ], tlc);
    expect(r.errors).toEqual([]);
    expect(r.sets.length).toBe(1);
    expect(r.sets[0].customers).toEqual([{ coCli: 'c1', desde: '2026-11-01', hasta: null }]);
    expect([...r.sets[0].overrides.keys()].sort()).toEqual(['A1', 'A2']);
  });
  test('customer with different desde values reports an error', () => {
    const r = compileDiscounts([
      row({ coCli: 'C1', coArt: 'A1' }),
      row({ coCli: 'C1', coArt: 'A2', desde: '2026-11-15' }),
    ], tlc);
    expect(r.sets).toEqual([]);
    expect(r.errors).toEqual(['cliente C1: tiene valores de «desde» distintos']);
  });
  test('case-variant customer with different desde reports the desde error', () => {
    const r = compileDiscounts([
      row({ coCli: 'c1', coArt: 'A1' }),
      row({ coCli: 'C1', coArt: 'A2', desde: '2026-11-15' }),
    ], tlc);
    expect(r.sets).toEqual([]);
    expect(r.errors).toEqual(['cliente c1: tiene valores de «desde» distintos']);
  });
});
