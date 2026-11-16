export type ParetoClass = 'A' | 'B' | 'C';

export const PARETO_A = 0.8;
export const PARETO_B = 0.95;

/**
 * ABC (Pareto) classification. Items are ranked by value descending (ties by
 * key, so the result is stable). An item is A while the cumulative share
 * BEFORE it is < 0.80, B while < 0.95, else C. Values <= 0 are C and do not
 * count toward the total; null values get a null class and are excluded.
 * Keys are expected to be unique (a duplicate overwrites the earlier entry).
 */
export function classifyPareto(
  items: readonly { key: string; value: number | null }[],
): Map<string, ParetoClass | null> {
  const out = new Map<string, ParetoClass | null>();
  const positive: { key: string; value: number }[] = [];
  let total = 0;
  for (const { key, value } of items) {
    if (value === null) out.set(key, null);
    else if (value <= 0) out.set(key, 'C');
    else {
      positive.push({ key, value });
      total += value;
    }
  }
  positive.sort((a, b) => b.value - a.value || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  let cumulative = 0;
  for (const { key, value } of positive) {
    const before = cumulative / total;
    out.set(key, before < PARETO_A ? 'A' : before < PARETO_B ? 'B' : 'C');
    cumulative += value;
  }
  return out;
}
