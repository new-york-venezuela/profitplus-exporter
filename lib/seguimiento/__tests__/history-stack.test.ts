import { describe, expect, test } from 'bun:test';
import { chooseVisibleLines, OTHER_LINE_LABEL } from '../category-mix';
import { historyCategories, stackMonth, sumHistoryLines, type HistoryLine } from '../history-stack';
import type { HistoryPoint } from '../types';

const ln = (line: string | null, usd: number | null, bs = (usd ?? 1) * 50, units = 1): HistoryLine => ({ line, sales: { bs, usd }, units });
const point = (month: string, byLine: HistoryLine[]): HistoryPoint => {
  const t = sumHistoryLines(byLine);
  return { month, sales: t.sales, units: t.units, returns: { bs: 0, usd: 0 }, returnUnits: 0, byLine };
};

describe('sumHistoryLines', () => {
  test('bs and units add up; USD ignores a null line and is null only when every line is null', () => {
    expect(sumHistoryLines([ln('A', 10, 500, 2), ln('B', null, 100, 3)])).toEqual({ sales: { bs: 600, usd: 10 }, units: 5 });
    expect(sumHistoryLines([ln('A', null, 500), ln('B', null, 100)]).sales.usd).toBeNull();
    expect(sumHistoryLines([])).toEqual({ sales: { bs: 0, usd: null }, units: 0 });
  });
});

describe('historyCategories', () => {
  test('ranks lines over the 12 months like the Categorías block (chooseVisibleLines), max 6, blank/null never visible', () => {
    const pts = [
      point('2026-09', [ln('Pan', 10), ln('Pizza', 50), ln(null, 999), ln('  ', 999)]),
      point('2026-10', [ln('Pan', 60), ln('Torta', 5)]),
    ];
    expect(historyCategories(pts)).toEqual(['Pan', 'Pizza', 'Torta']);
  });
  test('more than 6 lines: the 7th goes to Otros', () => {
    const many = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n, i) => ln(n, 100 - i));
    expect(historyCategories([point('2026-10', many)])).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });
  test('points without byLine (older cached responses) give no categories', () => {
    expect(historyCategories([{ month: '2026-10', sales: { bs: 1, usd: 1 }, units: 1, returns: { bs: 0, usd: 0 }, returnUnits: 0 }])).toEqual([]);
  });
});

describe('historyCategories ranks by 12-month USD, not Bs', () => {
  // A: huge in Bs (recent months, high rate) but small in USD; B: the opposite.
  const pts = [
    point('2026-01', [ln('B', 100, 1000), ln('A', 10, 100)]),
    point('2026-10', [ln('B', 100, 1000), ln('A', 20, 9000)]),
  ];
  test('the Bs ranking and the USD ranking disagree; the visible set follows USD', () => {
    const rows = pts.flatMap(p => p.byLine ?? []);
    expect(chooseVisibleLines(rows, 1)).toEqual(['A']);
    expect(historyCategories(pts, 1)).toEqual(['B']);
    expect(historyCategories(pts)).toEqual(['B', 'A']);
  });
  test('with 7 lines the one that is last in USD (but first in Bs) drops to Otros', () => {
    const lines = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n, i) => ln(n, 100 - i, n === 'G' ? 1e6 : 100));
    expect(historyCategories([point('2026-10', lines)])).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });
  test('lines with USD in no row rank after every line with USD, ordered by Bs; ties by name', () => {
    const p = point('2026-10', [ln('N1', null, 900), ln('N2', null, 800), ln('U', 1, 1), ln('Zeta', 5, 5), ln('Alfa', 5, 5)]);
    expect(historyCategories([p])).toEqual(['Alfa', 'Zeta', 'U', 'N1', 'N2']);
  });
  test('a null USD month does not zero out a line that has USD in other months', () => {
    const p1 = point('2026-09', [ln('X', null, 9999)]);
    const p2 = point('2026-10', [ln('X', 3, 150), ln('Y', 2, 100)]);
    expect(historyCategories([p1, p2])).toEqual(['X', 'Y']);
  });
  test('the set is independent of the currency toggle; stackMonth order follows the chosen currency', () => {
    const visible = historyCategories(pts);
    const month = pts[1].byLine!;
    expect(stackMonth(month, visible, 'usd').map(s => s.category)).toEqual(['B', 'A']);
    expect(stackMonth(month, visible, 'bs').map(s => s.category)).toEqual(['A', 'B']);
  });
});

describe('stackMonth', () => {
  const visible = ['Pan', 'Pizza', 'Torta'];

  test('biggest at the base: segments sorted by that month value, descending; order flips between months', () => {
    const sep = stackMonth([ln('Pan', 10), ln('Pizza', 50), ln('Torta', 30)], visible, 'usd');
    const oct = stackMonth([ln('Pan', 60), ln('Pizza', 20), ln('Torta', 30)], visible, 'usd');
    expect(sep.map(s => s.category)).toEqual(['Pizza', 'Torta', 'Pan']);
    expect(oct.map(s => s.category)).toEqual(['Pan', 'Torta', 'Pizza']);
  });

  test('Otros is always the topmost segment, even when it is the biggest; null/blank lines go to Otros', () => {
    const s = stackMonth([ln('Pan', 10), ln('Extra', 500), ln(null, 100), ln('', 1)], visible, 'usd');
    expect(s.map(x => x.category)).toEqual(['Pan', OTHER_LINE_LABEL]);
    expect(s[1].value).toBe(601);
  });

  test('ties break by name', () => {
    const s = stackMonth([ln('Torta', 20), ln('Pan', 20), ln('Pizza', 20)], visible, 'usd');
    expect(s.map(x => x.category)).toEqual(['Pan', 'Pizza', 'Torta']);
  });

  test('a category with null USD stays null (never 0) and sits above the valued ones, below Otros', () => {
    const s = stackMonth([ln('Pan', null, 400), ln('Pizza', 5), ln('X', 1)], visible, 'usd');
    expect(s).toEqual([
      { category: 'Pizza', value: 5 },
      { category: 'Pan', value: null },
      { category: OTHER_LINE_LABEL, value: 1 },
    ]);
  });

  test('the segments add up to the month brutas, in USD (null lines ignored like SQL SUM) and in Bs', () => {
    const lines = [ln('Pan', 12.5, 600), ln('Pizza', null, 300), ln('Otro', 7.25, 400), ln(null, 3, 150), ln('Torta', 0.25, 10)];
    const p = point('2026-10', lines);
    const sum = (xs: { value: number | null }[]) => xs.reduce((a, x) => a + (x.value ?? 0), 0);
    expect(sum(stackMonth(lines, visible, 'usd'))).toBeCloseTo(p.sales.usd!);
    expect(sum(stackMonth(lines, visible, 'bs'))).toBeCloseTo(p.sales.bs);
  });

  test('Bs currency sorts and stacks on the Bs side', () => {
    const s = stackMonth([ln('Pan', 100, 10), ln('Pizza', 1, 900)], visible, 'bs');
    expect(s.map(x => x.category)).toEqual(['Pizza', 'Pan']);
    expect(s[0].value).toBe(900);
  });

  test('no lines, no segments', () => {
    expect(stackMonth([], visible, 'usd')).toEqual([]);
  });
});
