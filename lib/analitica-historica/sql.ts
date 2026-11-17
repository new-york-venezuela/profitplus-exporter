import { returnsDateColumn, type ReturnsBasis } from '@/app/api/dwh/lib/query-builder';
import { type HistClienteDimension } from './dimension';
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

export { parseClienteDimension, type HistClienteDimension } from './dimension';

// Numeric id of the casa matriz of the legacy customer `c`: its legal entity, or, for a
// customer without an entity row (data loaded before migration 0044), minus its own key
// so it still counts as one client of its own and never merges with another.
export function histEntityId(c: string = 'c'): string {
  return `ISNULL(${c}.LegalEntityLegacyKey, -${c}.CustomerLegacyKey)`;
}

export interface ClienteKeySql {
  /** SQL expression of the group key (a string). */
  key: string;
  /** Display name; use inside MAX() when grouping by `key`. */
  name: string;
  /** Code shown next to the name: the casa matriz's code, or the customer's. */
  code: string;
  /** JOINs that make `c` (and `le`) available, from the fact alias. */
  joins: (factAlias: string) => string;
}

// What a "client" is when listing by customer: with `entidad` every store rolls up to its
// casa matriz (the same rule as the main analytics' cliente_entidad); `tienda` keeps one
// row per customer code.
export function histClienteKeySql(dimension: HistClienteDimension): ClienteKeySql {
  if (dimension === 'tienda') {
    return {
      key: 'CAST(c.CustomerLegacyKey AS varchar(20))',
      name: 'ISNULL(c.CustomerName, c.CustomerCode)',
      code: 'RTRIM(c.CustomerCode)',
      joins: f => `JOIN dim.Dim_Customer_Legacy c ON c.CustomerLegacyKey = ${f}.CustomerLegacyKey`,
    };
  }
  return {
    key: "CASE WHEN c.LegalEntityLegacyKey IS NULL THEN 'c' + CAST(c.CustomerLegacyKey AS varchar(20)) ELSE 'e' + CAST(c.LegalEntityLegacyKey AS varchar(20)) END",
    name: 'ISNULL(le.LegalEntityName, ISNULL(c.CustomerName, c.CustomerCode))',
    code: 'RTRIM(ISNULL(le.RootCustomerCode, c.CustomerCode))',
    joins: f => `JOIN dim.Dim_Customer_Legacy c ON c.CustomerLegacyKey = ${f}.CustomerLegacyKey
      LEFT JOIN dim.Dim_LegalEntity_Legacy le ON le.LegalEntityLegacyKey = c.LegalEntityLegacyKey`,
  };
}
