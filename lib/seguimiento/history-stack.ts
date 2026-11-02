// Pure shaping for the Seguimiento month-to-month chart's stacked bars (one segment per product
// line = Dim_Product.LineName, the Categorías block's notion of "categoría"). No I/O.
import { DEFAULT_MAX_VISIBLE_LINES, OTHER_LINE_LABEL, type Dual } from './category-mix';
import type { HistoryPoint } from './types';

export interface HistoryLine { line: string | null; sales: Dual; units: number }
export interface StackSegment { category: string; value: number | null }

// USD ignores a null side and is null only when every side is null: the same result SQL SUM gives
// over the ungrouped rows, so a month's total equals the sum of its lines.
function addDual(acc: Dual, d: Dual): Dual {
  return { bs: acc.bs + d.bs, usd: acc.usd === null && d.usd === null ? null : (acc.usd ?? 0) + (d.usd ?? 0) };
}

/** Month brutas and units from its per-line rows (fetchHistory derives the month total this way). */
export function sumHistoryLines(lines: readonly HistoryLine[]): { sales: Dual; units: number } {
  let sales: Dual = { bs: 0, usd: null };
  let units = 0;
  for (const l of lines) {
    sales = addDual(sales, l.sales);
    units += l.units;
  }
  return { sales, units };
}

/**
 * The lines that get their own segment: the top DEFAULT_MAX_VISIBLE_LINES = 6 by their 12-month USD
 * total (each month's USD is already converted per invoice at that invoice date's rate by the SQL, so
 * recent months do not dominate through the Bs/USD rate). Always USD, whatever the chart's currency, so
 * toggling to Bs never changes the set. A line with no USD in any row ranks after every line with USD,
 * ordered by Bs total; ties by name. Null or blank line names are never visible and fall into "Otros".
 * (The Categorías block keeps its own Bs ranking via chooseVisibleLines.)
 */
export function historyCategories(points: readonly HistoryPoint[], max: number = DEFAULT_MAX_VISIBLE_LINES): string[] {
  const totals = new Map<string, { bs: number; usd: number | null }>();
  for (const l of points.flatMap(p => p.byLine ?? [])) {
    const name = l.line?.trim();
    if (!name || !(l.sales.bs > 0)) continue;
    const acc = totals.get(name) ?? { bs: 0, usd: null };
    acc.bs += l.sales.bs;
    if (l.sales.usd !== null) acc.usd = (acc.usd ?? 0) + l.sales.usd;
    totals.set(name, acc);
  }
  return [...totals]
    .sort(([na, a], [nb, b]) => {
      if (a.usd !== null && b.usd !== null) {
        if (a.usd !== b.usd) return b.usd - a.usd;
      } else if (a.usd !== b.usd) {
        return a.usd === null ? 1 : -1;
      } else if (a.bs !== b.bs) {
        return b.bs - a.bs;
      }
      return na.localeCompare(nb);
    })
    .slice(0, max)
    .map(([name]) => name);
}

/**
 * One month's segments, bottom to top: the visible lines sorted by this month's value, biggest at the
 * base (ties by name; a null USD value sits above the valued ones), then "Otros" always on top.
 * Every row is bucketed (nothing dropped), so the values add up to the month's brutas.
 */
export function stackMonth(lines: readonly HistoryLine[], visible: readonly string[], currency: 'usd' | 'bs'): StackSegment[] {
  const visibleSet = new Set(visible);
  const byCat = new Map<string, Dual>();
  let other: Dual | null = null;
  for (const l of lines) {
    const name = l.line?.trim() || null;
    if (name && visibleSet.has(name)) byCat.set(name, addDual(byCat.get(name) ?? { bs: 0, usd: null }, l.sales));
    else other = addDual(other ?? { bs: 0, usd: null }, l.sales);
  }
  const pick = (d: Dual) => (currency === 'usd' ? d.usd : d.bs);
  const segments: StackSegment[] = [...byCat].map(([category, d]) => ({ category, value: pick(d) }));
  segments.sort((a, b) => {
    if (a.value === null || b.value === null) {
      if (a.value !== b.value) return a.value === null ? 1 : -1;
    } else if (a.value !== b.value) {
      return b.value - a.value;
    }
    return a.category.localeCompare(b.category);
  });
  if (other) segments.push({ category: OTHER_LINE_LABEL, value: pick(other) });
  return segments;
}
