import { returnsDateColumn, type ReturnsBasis } from '@/app/api/dwh/lib/query-builder';
import { HIST_START_KEY, histRangeWhere, type HistRange } from './window';

// USD rate join for a legacy fact alias. Same shape as legacyUsdConversionJoin
// in app/api/dwh/lib/query-builder.ts, but reads fact.Fact_ExchangeRate_Legacy
// (the OLD ERP's own rates, loaded by scripts/dwh-legacy-2025-import.ts), never
// fact.Fact_ExchangeRate and never DocumentExchangeRate. No row for the day ->
// RateSell NULL -> the paired USD sum is NULL ("Sin datos"), never 0.
// Use with dualAmountExpr(alias, col, bsAlias, usdAlias, joinAlias).
export function histUsdJoin(factAlias: string, dateColumn: string = 'DateKey', joinAlias: string = 'fx'): string {
  return `OUTER APPLY (
      SELECT TOP 1 ${joinAlias}r.RateSell
      FROM fact.Fact_ExchangeRate_Legacy ${joinAlias}r
      WHERE ${joinAlias}r.DateKey = ${factAlias}.${dateColumn}
    ) ${joinAlias}`;
}

// A return line's NetAmount is Bs at the ORIGINAL factura's price, so USD converts at
// that factura's date whatever basis the row was windowed by. A factura older than
// the rates table (before HIST_START_KEY) has no rate row, so such a return converts
// at its own devolución date instead of silently losing its USD.
export function histReturnsUsdJoin(factAlias: string = 'frl', joinAlias: string = 'fx'): string {
  return `OUTER APPLY (
      SELECT TOP 1 ${joinAlias}r.RateSell
      FROM fact.Fact_ExchangeRate_Legacy ${joinAlias}r
      WHERE ${joinAlias}r.DateKey = CASE WHEN ${factAlias}.OriginalInvoiceDateKey < ${HIST_START_KEY} THEN ${factAlias}.DateKey ELSE ${factAlias}.OriginalInvoiceDateKey END
    ) ${joinAlias}`;
}

// Non-voided sales in the range. Append to a WHERE (it starts with AND).
export function histSalesWhere(range: HistRange, alias: string = 'fsl'): string {
  return `AND ${alias}.IsVoided = 0 ${histRangeWhere(range, alias)}`;
}

// Non-voided returns in the range, windowed by the devolución's own date
// ('devolucion', the default basis) or the original factura's date ('factura').
export function histReturnsWhere(range: HistRange, basis: ReturnsBasis, alias: string = 'frl'): string {
  return `AND ${alias}.IsVoided = 0 ${histRangeWhere(range, alias, returnsDateColumn(basis))}`;
}

// Paired Bs / USD sum of a money column, for use with histUsdJoin /
// histReturnsUsdJoin (same joinAlias). Unlike dualAmountExpr, an EMPTY set gives
// 0 / 0 (a period with no returns is zero, not "Sin datos"); rows that all lack
// a rate give a NULL USD sum ("Sin datos", never 0); a partial set sums the
// rows that have a rate, as the main analytics does.
export function histDualSum(factAlias: string, column: string, bsAlias: string, usdAlias: string, joinAlias: string = 'fx'): string {
  const col = `${factAlias}.${column}`;
  return `ISNULL(SUM(${col}), 0) AS ${bsAlias},
      CASE WHEN COUNT(${col}) = 0 THEN 0 ELSE SUM(${col} / NULLIF(${joinAlias}.RateSell, 0)) END AS ${usdAlias}`;
}

// Escapes LIKE wildcards so a user's search text matches literally. Use with
// `LIKE @q ESCAPE '\'` and bind `%${escapeLike(text)}%` through .input().
export function escapeLike(text: string): string {
  return text.replace(/[\\%_[]/g, ch => `\\${ch}`);
}
