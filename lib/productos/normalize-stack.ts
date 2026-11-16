// 100% stacked view: each bucket's series values become shares of the bucket total.
// A bucket with no total stays all zeros (never NaN).
export function normalizeStack(
  rows: readonly Record<string, number>[],
  keys: readonly string[],
): Record<string, number>[] {
  return rows.map(row => {
    const total = keys.reduce((acc, k) => acc + (row[k] ?? 0), 0);
    const out: Record<string, number> = {};
    for (const k of keys) out[k] = total > 0 ? (row[k] ?? 0) / total : 0;
    return out;
  });
}
