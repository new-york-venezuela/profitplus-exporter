import { describe, test, expect } from 'bun:test';
import { bucketCategoryMix, chooseVisibleLines, OTHER_LINE_LABEL, type LineAmount } from '../../../lib/seguimiento/category-mix';

const a = (line: string | null, bs: number, usd: number | null = bs / 50): LineAmount => ({ line, sales: { bs, usd } });

describe('chooseVisibleLines', () => {
  test('ranks lines by Bs, merges rows of the same line, ignores null/blank/non-positive', () => {
    const v = chooseVisibleLines([a('Panaderia', 100), a('Pizza', 500), a('Panaderia', 700), a(null, 9999), a('  ', 9999), a('Pasteleria', 0), a('Devuelta', -5)]);
    expect(v).toEqual(['Panaderia', 'Pizza']);
  });
  test('caps at max and breaks ties by name', () => {
    const lines = ['E', 'D', 'C', 'B', 'A'].map(n => a(n, 10));
    expect(chooseVisibleLines(lines, 3)).toEqual(['A', 'B', 'C']);
  });
  test('a brand new line (Navidad) shows up with no code change', () => {
    expect(chooseVisibleLines([a('Panaderia', 100), a('Navidad', 300)])).toEqual(['Navidad', 'Panaderia']);
  });
});

describe('bucketCategoryMix', () => {
  const visible = ['Panaderia', 'Pizza'];
  test('shares by Bs over the positive total, visible order, remainder as Otros', () => {
    const mix = bucketCategoryMix([a('Panaderia', 600), a('Pizza', 200), a('Pasteleria', 100), a(null, 100)], visible);
    expect(mix.map(m => m.line)).toEqual(['Panaderia', 'Pizza', OTHER_LINE_LABEL]);
    expect(mix.map(m => m.share)).toEqual([0.6, 0.2, 0.2]);
    expect(mix[2].sales.bs).toBe(200);
  });
  test('visible lines with no sales are omitted', () => {
    expect(bucketCategoryMix([a('Pizza', 50)], visible).map(m => m.line)).toEqual(['Pizza']);
  });
  test('USD ignores null rows and is null only when every row is null', () => {
    const mix = bucketCategoryMix([a('Panaderia', 100, 2), a('Panaderia', 100, null), a('Pizza', 100, null)], visible);
    expect(mix[0].sales).toEqual({ bs: 200, usd: 2 });
    expect(mix[1].sales).toEqual({ bs: 100, usd: null });
  });
  test('nothing positive gives an empty mix', () => {
    expect(bucketCategoryMix([], visible)).toEqual([]);
    expect(bucketCategoryMix([a('Pizza', 0), a('Pizza', -10)], visible)).toEqual([]);
  });
});
