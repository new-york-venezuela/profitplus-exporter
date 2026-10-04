// Pure helpers for the Devoluciones KPI boxes. No server imports.

// A seller must carry at least this share of the period's ventas brutas to be
// eligible for "mayor tasa de devolución", so a one-invoice seller can't win at 100%.
export const MIN_SELLER_SALES_SHARE = 0.01;

export function safeRatio(n: number, d: number): number | null {
  return d > 0 ? n / d : null;
}

export function pickTopSellerByRate(
  rows: { name: string; returnsBs: number; salesBs: number }[],
  totalSalesBs: number,
): { name: string; rate: number; returnsBs: number } | null {
  if (totalSalesBs <= 0) return null;
  let best: { name: string; rate: number; returnsBs: number } | null = null;
  for (const r of rows) {
    if (r.returnsBs <= 0 || r.salesBs < totalSalesBs * MIN_SELLER_SALES_SHARE) continue;
    const rate = r.returnsBs / r.salesBs;
    if (!best || rate > best.rate) best = { name: r.name, rate, returnsBs: r.returnsBs };
  }
  return best;
}
