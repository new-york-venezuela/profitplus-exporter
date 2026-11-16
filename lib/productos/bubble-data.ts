import type { CatalogoRow, Currency } from '@/app/(app)/analitica/types';
import type { ParetoClass } from './pareto';

export type BubbleY = 'trend' | 'returnRate';

export interface BubblePoint {
  key: string;
  label: string;
  x: number;
  y: number;
  yReal: number;
  size: number;
  pareto: ParetoClass | null;
  trendPct: number | null;
  returnRate: number | null;
  net: number;
}

const DEFAULT_CAP = 150;
const DEFAULT_CLAMP = 2;

/**
 * Bubble-plot points: x = avg units/month, size = net sales (selected currency),
 * y = trend vs. previous period or return rate. Items without a Y value or with
 * no positive net (a bubble can't be sized) count in `missing` and are not
 * plotted. Only the `cap` biggest by net are plotted (`truncated` = the rest).
 * The trend axis is clamped to ±clampPct (y); yReal keeps the true value.
 */
export function buildBubbleData(
  rows: CatalogoRow[],
  yMode: BubbleY,
  currency: Currency,
  opts: { cap?: number; clampPct?: number } = {},
): { points: BubblePoint[]; missing: number; truncated: number } {
  const cap = opts.cap ?? DEFAULT_CAP;
  const clamp = opts.clampPct ?? DEFAULT_CLAMP;
  const all: BubblePoint[] = [];
  let missing = 0;
  for (const r of rows) {
    const net = currency === 'usd' ? r.salesNet.usd : r.salesNet.bs;
    const yReal = yMode === 'trend' ? r.trendPct : r.returnRate;
    if (net === null || !(net > 0) || yReal === null || !Number.isFinite(yReal)) {
      missing += 1;
      continue;
    }
    const y = yMode === 'trend' ? Math.max(-clamp, Math.min(clamp, yReal)) : yReal;
    all.push({
      key: r.key, label: r.label, x: r.avgUnitsPerMonth, y, yReal, size: net,
      pareto: r.pareto, trendPct: r.trendPct, returnRate: r.returnRate, net,
    });
  }
  all.sort((a, b) => b.net - a.net || a.key.localeCompare(b.key));
  const points = all.slice(0, cap);
  return { points, missing, truncated: all.length - points.length };
}
