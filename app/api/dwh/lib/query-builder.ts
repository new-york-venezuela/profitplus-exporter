import { getDwhPool } from '@/lib/db/dwh-mssql';
import { NextResponse } from 'next/server';

// Every Analítica tab now renders its full report immediately on tab-mount
// (Part 1 of docs/superpowers/specs/2026-09-15-analitica-ui-and-margin-design.md
// — no more hidden-until-toggled sections), so every dwh/* route's success
// response should carry a short private HTTP cache window: 15 minutes is
// long enough to dedupe the burst of near-simultaneous requests a single
// tab-mount now fires (one per stacked section) and short enough that a
// user won't see meaningfully stale data. `private` (not `public`) because
// responses are gated by requireDwhAccess and must never be cached by a
// shared/proxy cache. Error responses (500s from a route's catch block)
// intentionally do NOT go through this helper — call NextResponse.json
// directly for those, so a transient DB error is never cached. This header
// is independent of each route's `export const dynamic = 'force-dynamic'`
// — that only disables Next.js's own server-side route-segment cache (no
// ISR/static generation); it does not touch the Cache-Control header sent
// to the browser, so this header reaches the client as intended.
export function jsonWithCache<T>(body: T, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, max-age=900');
  return response;
}

export async function getUsdRate(): Promise<number | null> {
  try {
    const pool = await getDwhPool();
    const result = await pool
      .request()
      .query(
        `SELECT TOP 1 f.RateSell AS ExchangeRate
         FROM fact.Fact_ExchangeRate f
         JOIN dim.Dim_Currency c ON c.CurrencyKey = f.CurrencyKey
         WHERE f.DateKey = (SELECT MAX(DateKey) FROM fact.Fact_ExchangeRate)
           AND RTRIM(c.CurrencyCode) = 'USD'
         ORDER BY f.DateKey DESC`
      );
    return result.recordset?.[0]?.ExchangeRate ?? null;
  } catch {
    return null;
  }
}

/**
 * LEFT JOIN fragment resolving the USD exchange rate for a fact table's own
 * date, keyed to a scalar CurrencyKey lookup for 'USD' rather than a second
 * join to dim.Dim_Currency (Fact_ExchangeRate itself has no CurrencyCode
 * column, only CurrencyKey). Used as a fallback when a row's own
 * DocumentExchangeRate is NULL/0 — see dualAmountExpr.
 *
 * dateColumn defaults to 'DateKey' (Fact_Sales/Fact_Returns/Fact_Collections/
 * Fact_Purchases all use this name); Fact_AR_Snapshot uses 'SnapshotDateKey'
 * instead — pass it explicitly for that table.
 *
 * joinAlias defaults to 'fx' — pass a distinct alias (and the SAME alias to
 * dualAmountExpr's own joinAlias param) whenever a query needs more than one
 * usdConversionJoin in scope at once (e.g. a correlated subquery alongside
 * an outer query, both needing their own exchange-rate lookup) so the two
 * joins' aliases never collide. Do NOT rename the alias post-hoc with
 * string .replace() on this function's output — Fact_ExchangeRate's alias
 * appears multiple times in the returned fragment (the join's own alias,
 * plus every reference to it in the ON clause), so a naive .replace() only
 * renames the first occurrence and leaves the rest pointing at an alias
 * that's no longer in scope. Always pass the alias as a parameter instead.
 */
export function usdConversionJoin(factAlias: string, dateColumn: string = 'DateKey', joinAlias: string = 'fx'): string {
  return `LEFT JOIN fact.Fact_ExchangeRate ${joinAlias} ON ${joinAlias}.DateKey = ${factAlias}.${dateColumn} AND ${joinAlias}.CurrencyKey = (SELECT CurrencyKey FROM dim.Dim_Currency WHERE RTRIM(CurrencyCode) = 'USD')`;
}

/**
 * Paired BS/USD SUM expression for a money column on a fact table already
 * carrying a DocumentExchangeRate column (Fact_Sales, Fact_Returns,
 * Fact_Collections, Fact_AR_Snapshot, Fact_Purchases only — see
 * docs/superpowers/specs/2026-09-23-historical-usd-conversion-design.md).
 * Requires the query to also include usdConversionJoin(factAlias, ...)'s
 * join for the fallback rate lookup, using the SAME joinAlias passed here
 * (both default to 'fx' — pass a matching non-default alias to both
 * functions if a query needs more than one such join in scope).
 *
 * Division happens per-row, inside the SUM — NOT SUM(column) / rate — so a
 * group spanning multiple historical rates converts each row at its own
 * rate before aggregating, rather than distorting the whole group by
 * today's rate. NULLIF(...,0) on the divisor means a row with neither its
 * own DocumentExchangeRate nor a same-day Fact_ExchangeRate row produces
 * NULL for that row's USD contribution (SQL Server's SUM ignores NULLs),
 * rather than a divide-by-zero error.
 */
export function dualAmountExpr(factAlias: string, column: string, bsAlias: string, usdAlias: string, joinAlias: string = 'fx'): string {
  const col = `${factAlias}.${column}`;
  const rate = `NULLIF(COALESCE(${factAlias}.DocumentExchangeRate, ${joinAlias}.RateSell), 0)`;
  return `SUM(${col}) AS ${bsAlias}, SUM(${col} / ${rate}) AS ${usdAlias}`;
}

const CUSTOM_RANGE_RE = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;
const MONTH_RANGE_RE = /^month:(\d{4})-(\d{2})$/;
const YTD_RANGE_RE = /^ytd:(\d{4})$/;

function dateKey(d: Date): number {
  return parseInt(
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
  );
}

// No hardcoded "no data before <year>" or similar installation-specific
// boundary anywhere here — an out-of-range month/year simply produces a
// DateKey window a fact table has no matching rows in, which is the correct,
// portable behavior for any installation's actual data range (see
// docs/superpowers/specs/2026-09-15-margen-operativo-accrual-design.md
// section 2.5).
export function buildDateWhereClause(
  dateRange: string,
  tableName: string = 'f'
): string {
  const customMatch = CUSTOM_RANGE_RE.exec(dateRange);
  if (customMatch) {
    const [, start, end] = customMatch;
    const startKey = start.replace(/-/g, '');
    const endKey = end.replace(/-/g, '');
    return `AND ${tableName}.DateKey >= ${startKey} AND ${tableName}.DateKey <= ${endKey}`;
  }

  const monthMatch = MONTH_RANGE_RE.exec(dateRange);
  if (monthMatch) {
    const [, yearStr, monthStr] = monthMatch;
    const year = parseInt(yearStr);
    const month = parseInt(monthStr); // 1-indexed
    const startKey = dateKey(new Date(Date.UTC(year, month - 1, 1)));
    // Day 0 of the NEXT month is the last day of THIS month — this
    // automatically handles 28/29/30/31-day months and leap years without
    // a lookup table.
    const endKey = dateKey(new Date(Date.UTC(year, month, 0)));
    return `AND ${tableName}.DateKey >= ${startKey} AND ${tableName}.DateKey <= ${endKey}`;
  }

  const ytdMatch = YTD_RANGE_RE.exec(dateRange);
  if (ytdMatch) {
    const year = parseInt(ytdMatch[1]);
    const startKey = year * 10000 + 101; // YYYY0101
    const currentYear = new Date().getUTCFullYear();
    const endKey = year === currentYear
      ? parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''))
      : year * 10000 + 1231; // YYYY1231
    return `AND ${tableName}.DateKey >= ${startKey} AND ${tableName}.DateKey <= ${endKey}`;
  }

  // '30d'/'90d' were removed from the UI (analitica-client.tsx) in favor of
  // month/YTD navigation — any value this function doesn't otherwise
  // recognize (including a stale bookmarked '30d'/'90d' URL) falls through
  // to the 365-day default rather than throwing, so an old link degrades
  // gracefully instead of erroring.
  return `AND ${tableName}.DateKey >= CONVERT(INT, FORMAT(DATEADD(DAY, -365, GETDATE()), 'yyyyMMdd'))`;
}

export type Dimension = 'cliente_entidad' | 'cliente_tienda' | 'producto' | 'vendedor' | 'proveedor';

/**
 * Short names for every fact table currently joined against via the generic
 * dimension mechanism (getDimensionSpec/isDimension) anywhere under
 * app/api/dwh/. Traced from actual call sites, not guessed:
 *  - 'sales'      -> fact.Fact_Sales      (ventas, vendedores)
 *  - 'returns'    -> fact.Fact_Returns    (devoluciones, and ventas'/
 *                     devoluciones' correlated Fact_Returns subqueries)
 *  - 'purchases'  -> fact.Fact_Purchases  (compras)
 *  - 'ar_snapshot'-> fact.Fact_AR_Snapshot (cxc's topDebtorsQuery)
 * fact.Fact_Collections and fact.Fact_CashMovements are also read under
 * app/api/dwh/, but never through getDimensionSpec/isDimension (their
 * queries hard-code their own columns), so they're intentionally omitted
 * here.
 */
export type FactTable = 'sales' | 'returns' | 'purchases' | 'ar_snapshot';

export interface DimensionSpec {
  /** SQL join fragment, assumes the base fact table is aliased `f`. */
  joinClause: string;
  /** Column(s) to GROUP BY (fully qualified, using this spec's own aliases). */
  groupByColumn: string;
  /** Display label expression, safe to alias as GroupLabel. */
  labelExpr: string;
  /** Value to return as the row's identifier, used as `parentValue` on drill-in. */
  valueExpr: string;
  /**
   * A correlation condition for use in a scalar subquery that needs to
   * re-aggregate a DIFFERENT fact table (e.g. Fact_Sales) for the same
   * dimension value as the outer query's row (built against Fact_Returns,
   * or Fact_AR_Snapshot, etc). `outerAlias`/`innerAlias` are the fact-table
   * aliases on each side (e.g. 'fr' outer, 'fs2' inner) — the function
   * builds its own inner join with a distinct alias so it never collides
   * with the outer query's join.
   */
  correlate: (outerAlias: string, innerAlias: string) => { innerJoin: string; condition: string };
  /**
   * Which fact tables this dimension is actually safe to join against (i.e.
   * `f`/the aliased fact table in joinClause has the key column this spec
   * joins on). Traced from real call sites under app/api/dwh/ — see
   * FactTable's doc comment. Used by isDimensionForFact to reject a
   * dimension that would otherwise reach the SQL layer and fail with
   * "Invalid column name" against a fact table that doesn't have the
   * relevant key column (e.g. 'proveedor' against Fact_Sales, which has no
   * SupplierKey).
   */
  readonly validFacts: readonly FactTable[];
}

const DIMENSION_SPECS: Record<Dimension, DimensionSpec> = {
  cliente_entidad: {
    // Used against Fact_Sales/Fact_Returns (ventas, devoluciones clienteDimension)
    // and Fact_AR_Snapshot (cxc topDebtorsQuery, via isClienteDimension).
    validFacts: ['sales', 'returns', 'ar_snapshot'],
    joinClause: 'JOIN dim.Dim_Customer c ON c.CustomerKey = f.CustomerKey JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey',
    groupByColumn: 'le.LegalEntityKey, le.LegalEntityName',
    labelExpr: 'le.LegalEntityName',
    valueExpr: 'CAST(le.LegalEntityKey AS varchar(20))',
    // NOTE: correlates on `le.LegalEntityKey`, not `${outerAlias}.CustomerKey`.
    // The outer query for this dimension is grouped by LegalEntityKey (via the
    // `le` alias this spec's own joinClause brings into scope), so `le` is the
    // only outer reference valid at that grain — SQL Server rejects a reference
    // to a non-grouped outer column (fs.CustomerKey) inside a nested subquery
    // with "invalid in the select list" even though it's only used for
    // correlation, not aggregation. `outerAlias`/`innerAlias` are accepted for
    // interface consistency with the other dimensions' correlate() but unused
    // here since `le` is already unambiguous and in scope.
    correlate: (_outerAlias, innerAlias) => ({
      innerJoin: `JOIN dim.Dim_Customer ${innerAlias}_c ON ${innerAlias}_c.CustomerKey = ${innerAlias}.CustomerKey`,
      condition: `${innerAlias}_c.LegalEntityKey = le.LegalEntityKey`,
    }),
  },
  cliente_tienda: {
    // Same usage as cliente_entidad: sales/returns (ventas, devoluciones) and
    // ar_snapshot (cxc, via isClienteDimension).
    validFacts: ['sales', 'returns', 'ar_snapshot'],
    joinClause: 'JOIN dim.Dim_Customer c ON c.CustomerKey = f.CustomerKey',
    groupByColumn: 'c.CustomerKey, ISNULL(c.CustomerName, c.CustomerCode)',
    labelExpr: 'ISNULL(c.CustomerName, c.CustomerCode)',
    valueExpr: 'CAST(c.CustomerKey AS varchar(20))',
    // Correlates on `c.CustomerKey` (this spec's own joined alias, which is
    // what the outer query actually GROUPs BY), not `${outerAlias}.CustomerKey`
    // (the fact-table alias) — SQL Server rejects a reference to a non-grouped
    // fact-table column inside a nested subquery even when it's join-equal to
    // a grouped dimension column. See cliente_entidad's note above.
    correlate: (_outerAlias, innerAlias) => ({
      innerJoin: '',
      condition: `${innerAlias}.CustomerKey = c.CustomerKey`,
    }),
  },
  producto: {
    // Used as breakdownBy against Fact_Sales (ventas, vendedores) and
    // Fact_Returns (devoluciones) only — never against Fact_AR_Snapshot
    // (cxc's topDebtorsQuery is only ever called with clienteDimension
    // values, never producto/vendedor).
    validFacts: ['sales', 'returns'],
    joinClause: 'JOIN dim.Dim_Product p ON p.ProductKey = f.ProductKey',
    groupByColumn: 'p.ProductKey, ISNULL(p.ProductName, p.ProductCode)',
    labelExpr: 'ISNULL(p.ProductName, p.ProductCode)',
    valueExpr: 'CAST(p.ProductKey AS varchar(20))',
    // Correlates on `p.ProductKey` (grouped alias), not `${outerAlias}.ProductKey`.
    correlate: (_outerAlias, innerAlias) => ({
      innerJoin: '',
      condition: `${innerAlias}.ProductKey = p.ProductKey`,
    }),
  },
  vendedor: {
    // Same usage as producto: breakdownBy against Fact_Sales/Fact_Returns only.
    validFacts: ['sales', 'returns'],
    joinClause: 'JOIN dim.Dim_SalesRep r ON r.SalesRepKey = f.SalesRepKey',
    groupByColumn: 'r.SalesRepKey, ISNULL(r.SalesRepName, r.SalesRepCode)',
    labelExpr: 'ISNULL(r.SalesRepName, r.SalesRepCode)',
    valueExpr: 'CAST(r.SalesRepKey AS varchar(20))',
    // Correlates on `r.SalesRepKey` (grouped alias), not `${outerAlias}.SalesRepKey`.
    correlate: (_outerAlias, innerAlias) => ({
      innerJoin: '',
      condition: `${innerAlias}.SalesRepKey = r.SalesRepKey`,
    }),
  },
  proveedor: {
    // Only Fact_Purchases has a SupplierKey column (confirmed live against
    // INFORMATION_SCHEMA.COLUMNS: Fact_Sales/Fact_Returns/Fact_AR_Snapshot
    // have none) — used only by compras.
    validFacts: ['purchases'],
    joinClause: 'JOIN dim.Dim_Supplier s ON s.SupplierKey = f.SupplierKey',
    groupByColumn: 's.SupplierKey, ISNULL(s.SupplierName, s.SupplierCode)',
    labelExpr: 'ISNULL(s.SupplierName, s.SupplierCode)',
    valueExpr: 'CAST(s.SupplierKey AS varchar(20))',
    // Correlates on `s.SupplierKey` (grouped alias), not `${outerAlias}.SupplierKey`.
    correlate: (_outerAlias, innerAlias) => ({
      innerJoin: '',
      condition: `${innerAlias}.SupplierKey = s.SupplierKey`,
    }),
  },
};

export function getDimensionSpec(dimension: Dimension): DimensionSpec {
  return DIMENSION_SPECS[dimension];
}

export function isDimension(value: string | null): value is Dimension {
  return value === 'cliente_entidad' || value === 'cliente_tienda' || value === 'producto' || value === 'vendedor' || value === 'proveedor';
}

/**
 * Fact-aware version of isDimension: also checks that the resolved spec's
 * validFacts includes the given fact table, so a dimension that is a valid
 * `Dimension` member in general but not joinable against THIS fact (e.g.
 * 'proveedor' against 'sales', which has no SupplierKey) is rejected here
 * rather than reaching the SQL layer and throwing "Invalid column name".
 *
 * Use this (not the bare isDimension) at any call site that parses a
 * breakdownBy-style query param and feeds it straight into
 * getDimensionSpec(...).joinClause against a specific, known fact table.
 * isDimension itself is left unchanged/unused-here for call sites that
 * aren't tied to one fact table.
 */
export function isDimensionForFact(value: string | null, fact: FactTable): value is Dimension {
  return isDimension(value) && DIMENSION_SPECS[value].validFacts.includes(fact);
}

/**
 * Narrower guard for `clienteDimension` params specifically — that param
 * should only ever be 'cliente_entidad' or 'cliente_tienda' (the two grains
 * a customer listing can roll up to). `producto`/`vendedor` are valid
 * `Dimension` values but never valid `clienteDimension` values: e.g.
 * cxc's topDebtorsQuery joins against Fact_AR_Snapshot, which has no
 * ProductKey/SalesRepKey column at all, and clientes/devoluciones would
 * silently mislabel a product- or rep-grain list as a customer list instead
 * of erroring. Use this (not the general isDimension) wherever a route
 * parses its own clienteDimension query param; keep isDimension for
 * breakdownBy params, which legitimately accept all 4 dimensions.
 */
export function isClienteDimension(value: string | null): value is 'cliente_entidad' | 'cliente_tienda' {
  return value === 'cliente_entidad' || value === 'cliente_tienda';
}
