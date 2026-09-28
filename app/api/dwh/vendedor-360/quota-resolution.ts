// Resolves a monthly-quota sum across a (possibly multi-month) selected
// range. A month with no row, or a row whose quota field is null, both
// count as "missing" for that month and set isPartial — the caller (the
// vendedor-360 route) surfaces this as "meta parcial: falta meta para
// <month>" rather than silently treating a partially-set range as either
// fully set or fully unset. See docs/superpowers/specs/
// 2026-09-27-seller-360-dashboard-design.md, Section 7 (Cuota) and
// Section 10 (multi-month edge case).
export interface QuotaRowLike {
  periodMonth: string;
  quotaValue: number | null;
}

export interface QuotaSumResult {
  total: number | null; // null only when NO month in range has a set value
  isPartial: boolean;   // true when at least one month in range is missing/null
}

export function resolveQuotaSum(rows: QuotaRowLike[], months: string[]): QuotaSumResult {
  const byMonth = new Map<string, number | null>();
  for (const row of rows) byMonth.set(row.periodMonth, row.quotaValue);

  let total: number | null = null;
  let isPartial = false;
  for (const month of months) {
    const value = byMonth.get(month) ?? null;
    if (value === null) {
      isPartial = true;
      continue;
    }
    total = (total ?? 0) + value;
  }

  return { total, isPartial };
}
