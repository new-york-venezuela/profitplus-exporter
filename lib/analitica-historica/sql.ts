import { returnsDateColumn, type ReturnsBasis } from '@/app/api/dwh/lib/query-builder';
import { histRangeWhere, type HistRange } from './window';

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

// A return line's NetAmount is Bs at the ORIGINAL factura's price, so USD
// converts at that factura's date whatever basis the row was windowed by.
export function histReturnsUsdJoin(factAlias: string = 'frl', joinAlias: string = 'fx'): string {
  return histUsdJoin(factAlias, 'OriginalInvoiceDateKey', joinAlias);
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
