import { describe, test, expect } from 'bun:test';
import { stageEdit, pendingChanges, referenceFor, newDeltaPct, visibleRows, cellKey } from '@/lib/pricing/rates-staging';
import type { GridRow } from '@/lib/pricing/client-types';

function row(p: Partial<GridRow> & { coArt: string }): GridRow {
  return {
    artDes: p.coArt, catDes: null, coAlma: '000015', ambiguous: false,
    current: { monto: 10, desde: '2026-01-01', hasta: null }, next: null, referenceMonto: 8, ...p,
  };
}

describe('stageEdit', () => {
  test('sets a price without mutating the input', () => {
    const base = { A: 1 };
    const out = stageEdit(base, 'B', 5);
    expect(out).toEqual({ A: 1, B: 5 });
    expect(base).toEqual({ A: 1 });
  });
  test('removes on null, 0 and negative', () => {
    const base = { A: 1, B: 2, C: 3 };
    expect(stageEdit(base, 'A', null)).toEqual({ B: 2, C: 3 });
    expect(stageEdit(base, 'B', 0)).toEqual({ A: 1, C: 3 });
    expect(stageEdit(base, 'C', -4)).toEqual({ A: 1, B: 2 });
  });
});

describe('pendingChanges', () => {
  test('omits unchanged and ambiguous rows, reports before/after', () => {
    const rows = [
      row({ coArt: 'A', artDes: 'Harina' }),
      row({ coArt: 'B' }),
      row({ coArt: 'C', ambiguous: true }),
      row({ coArt: 'D', current: null }),
    ];
    const out = pendingChanges({ A: 12, B: 10, C: 20, D: 5, Z: 9 }, rows);
    expect(out).toEqual([
      { coArt: 'A', artDes: 'Harina', before: 10, after: 12 },
      { coArt: 'D', artDes: 'D', before: null, after: 5 },
    ]);
  });
});

describe('referenceFor / newDeltaPct', () => {
  test('reference is referenceMonto', () => {
    expect(referenceFor(row({ coArt: 'A' }))).toBe(8);
    expect(referenceFor(row({ coArt: 'A', referenceMonto: null }))).toBeNull();
  });
  test('uses the reference', () => {
    expect(newDeltaPct(row({ coArt: 'A' }), { A: 10 })).toBe(25);
  });
  test('null without reference or without staged price', () => {
    expect(newDeltaPct(row({ coArt: 'A', referenceMonto: null }), { A: 10 })).toBeNull();
    expect(newDeltaPct(row({ coArt: 'A' }), {})).toBeNull();
  });
});

describe('visibleRows', () => {
  const rows = [
    row({ coArt: 'HAR1', artDes: 'Harina 1kg', catDes: 'Harinas' }),
    row({ coArt: 'ARR1', artDes: 'Arroz', catDes: 'Granos' }),
    row({ coArt: 'NOP', artDes: 'Sin precio', catDes: 'Granos', current: null }),
    row({ coArt: 'AMB', artDes: 'Ambiguo', current: null, ambiguous: true }),
  ];
  const base = { search: '', category: '', showUnpriced: false, staged: {} };
  test('hides unpriced non-ambiguous rows by default', () => {
    expect(visibleRows(rows, base).map(r => r.coArt)).toEqual(['HAR1', 'ARR1', 'AMB']);
  });
  test('showUnpriced reveals them', () => {
    expect(visibleRows(rows, { ...base, showUnpriced: true })).toHaveLength(4);
  });
  test('staged price forces an unpriced row visible', () => {
    expect(visibleRows(rows, { ...base, staged: { NOP: 5 } }).map(r => r.coArt)).toContain('NOP');
  });
  test('search matches code or description case-insensitively', () => {
    expect(visibleRows(rows, { ...base, search: 'harina' }).map(r => r.coArt)).toEqual(['HAR1']);
    expect(visibleRows(rows, { ...base, search: 'arr1' }).map(r => r.coArt)).toEqual(['ARR1']);
  });
  test('category matches catDes', () => {
    expect(visibleRows(rows, { ...base, category: 'Granos' }).map(r => r.coArt)).toEqual(['ARR1']);
  });
  test('ambiguous row stays visible when staged', () => {
    expect(visibleRows(rows, { ...base, staged: { AMB: 5 } }).map(r => r.coArt)).toContain('AMB');
  });
  test('search and category combine', () => {
    expect(visibleRows(rows, { ...base, showUnpriced: true, search: 'sin', category: 'Granos' }).map(r => r.coArt)).toEqual(['NOP']);
    expect(visibleRows(rows, { ...base, search: 'harina', category: 'Granos' })).toEqual([]);
  });
});

describe('cellKey', () => {
  const r = row({ coArt: 'A' });
  test('changes when staged price, reference, current or warehouse change', () => {
    const k = cellKey(r, {});
    expect(cellKey(r, { A: 9 })).not.toBe(k);
    expect(cellKey({ ...r, referenceMonto: 7 }, {})).not.toBe(k);
    expect(cellKey({ ...r, current: null }, {})).not.toBe(k);
    expect(cellKey({ ...r, coAlma: 'X' }, {})).not.toBe(k);
  });
  test('stable otherwise and unaffected by other articles', () => {
    expect(cellKey(r, { B: 3 })).toBe(cellKey(r, {}));
  });
  test('discard resets the key', () => {
    expect(cellKey(r, {})).not.toBe(cellKey(r, { A: 9 }));
  });
});
