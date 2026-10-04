import type { DualAmount } from '../types';

// Shared definitions for the Analítica "ventas" metrics (see
// content/help/analitica-definiciones.md and docs/ventas-netas-analysis.md):
//   Ventas brutas = SUM(Fact_Sales.NetAmount)   — sin IVA, sin anuladas,
//                   neto de descuento de línea y global, por fecha de factura
//   Devoluciones  = SUM(Fact_Returns.NetAmount) — same basis
//   Ventas netas  = Ventas brutas − Devoluciones
// Pure helpers only, so both the API routes and the tabs can use them.

/**
 * a − b for a BS/USD pair. USD is null when it can't be known: a has no USD,
 * or b has a non-zero BS amount but no USD (a missing rate on the returns
 * side must not silently turn into "no returns").
 */
export function subtractDual(a: DualAmount, b: DualAmount): DualAmount {
  let usd: number | null;
  if (a.usd === null) usd = null;
  else if (b.usd === null) usd = b.bs === 0 ? a.usd : null;
  else usd = a.usd - b.usd;
  return { bs: a.bs - b.bs, usd };
}

/** Return rate on the BS side (returns / gross), null when gross is not positive. */
export function returnRate(returns: DualAmount, gross: DualAmount): number | null {
  return gross.bs > 0 ? returns.bs / gross.bs : null;
}

/** Builds a DualAmount from a recordset's BS/USD columns (USD may be NULL). */
export function dualFromRow(bs: unknown, usd: unknown): DualAmount {
  return { bs: Number(bs ?? 0), usd: usd === null || usd === undefined ? null : Number(usd) };
}

export type ReturnsBasisOption = 'factura' | 'devolucion';

export const RETURNS_BASIS_LABEL: Record<ReturnsBasisOption, string> = {
  factura: 'por fecha de factura',
  devolucion: 'por fecha de devolución',
};

/** Sums BS/USD pairs. Null for no items; USD ignores null rows and is null only when all are null. */
export function sumDual(items: DualAmount[]): DualAmount | null {
  if (items.length === 0) return null;
  const withUsd = items.filter(i => i.usd !== null);
  return {
    bs: items.reduce((s, i) => s + i.bs, 0),
    usd: withUsd.length === 0 ? null : withUsd.reduce((s, i) => s + (i.usd as number), 0),
  };
}
