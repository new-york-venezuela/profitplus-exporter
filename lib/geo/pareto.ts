import { PARETO_THRESHOLDS, type Pareto } from './types';

// Same thresholds and rule as app/api/dwh/clientes/route.ts: rank by period
// ventas brutas (BS, sin IVA, before returns) descending, bucket by the
// cumulative share INCLUDING the row itself. NOT always the same segment as
// /analitica: the map ranks per tienda code (ERP-active customers only),
// while the Clientes tab defaults to the legal-entity grain.
export function assignPareto(rows: { coCli: string; revenueBs: number }[]): Map<string, Pareto> {
  const ranked = rows.filter(r => r.revenueBs > 0).sort((a, b) => b.revenueBs - a.revenueBs);
  const total = ranked.reduce((s, r) => s + r.revenueBs, 0);
  const out = new Map<string, Pareto>();
  let cumulative = 0;
  for (const r of ranked) {
    cumulative += r.revenueBs;
    const share = total > 0 ? cumulative / total : 0;
    out.set(r.coCli, share <= PARETO_THRESHOLDS.a ? 'A' : share <= PARETO_THRESHOLDS.b ? 'B' : 'C');
  }
  return out;
}
