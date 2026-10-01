import { PARETO_THRESHOLDS, type Pareto } from './types';

// Mirrors app/api/dwh/clientes/route.ts so a customer has the same segment
// on /analitica and on /mapa: rank by period net sales (BS) descending,
// bucket by the cumulative share INCLUDING the row itself.
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
