import { getDwhPool } from '@/lib/db/dwh-mssql';
import type { ApiQueryParams } from './types';

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

const CUSTOM_RANGE_RE = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;

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
  const days = dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
  // Adjust based on your DateKey format (if YYYYMMDD or similar)
  return `AND ${tableName}.DateKey >= CONVERT(INT, FORMAT(DATEADD(DAY, -${days}, GETDATE()), 'yyyyMMdd'))`;
}

export type Dimension = 'cliente_entidad' | 'cliente_tienda' | 'producto' | 'vendedor' | 'proveedor';

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
}

const DIMENSION_SPECS: Record<Dimension, DimensionSpec> = {
  cliente_entidad: {
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
