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

export function buildDateWhereClause(
  dateRange: string,
  tableName: string = 'f'
): string {
  const days = dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
  // Adjust based on your DateKey format (if YYYYMMDD or similar)
  return `AND ${tableName}.DateKey >= CONVERT(INT, FORMAT(DATEADD(DAY, -${days}, GETDATE()), 'yyyyMMdd'))`;
}

export type Dimension = 'cliente_entidad' | 'cliente_tienda' | 'producto' | 'vendedor';

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
    correlate: (outerAlias, innerAlias) => ({
      innerJoin: `JOIN dim.Dim_Customer ${innerAlias}_c ON ${innerAlias}_c.CustomerKey = ${innerAlias}.CustomerKey`,
      condition: `${innerAlias}_c.LegalEntityKey = (SELECT c3.LegalEntityKey FROM dim.Dim_Customer c3 WHERE c3.CustomerKey = ${outerAlias}.CustomerKey)`,
    }),
  },
  cliente_tienda: {
    joinClause: 'JOIN dim.Dim_Customer c ON c.CustomerKey = f.CustomerKey',
    groupByColumn: 'c.CustomerKey, ISNULL(c.CustomerName, c.CustomerCode)',
    labelExpr: 'ISNULL(c.CustomerName, c.CustomerCode)',
    valueExpr: 'CAST(c.CustomerKey AS varchar(20))',
    correlate: (outerAlias, innerAlias) => ({
      innerJoin: '',
      condition: `${innerAlias}.CustomerKey = ${outerAlias}.CustomerKey`,
    }),
  },
  producto: {
    joinClause: 'JOIN dim.Dim_Product p ON p.ProductKey = f.ProductKey',
    groupByColumn: 'p.ProductKey, ISNULL(p.ProductName, p.ProductCode)',
    labelExpr: 'ISNULL(p.ProductName, p.ProductCode)',
    valueExpr: 'CAST(p.ProductKey AS varchar(20))',
    correlate: (outerAlias, innerAlias) => ({
      innerJoin: '',
      condition: `${innerAlias}.ProductKey = ${outerAlias}.ProductKey`,
    }),
  },
  vendedor: {
    joinClause: 'JOIN dim.Dim_SalesRep r ON r.SalesRepKey = f.SalesRepKey',
    groupByColumn: 'r.SalesRepKey, ISNULL(r.SalesRepName, r.SalesRepCode)',
    labelExpr: 'ISNULL(r.SalesRepName, r.SalesRepCode)',
    valueExpr: 'CAST(r.SalesRepKey AS varchar(20))',
    correlate: (outerAlias, innerAlias) => ({
      innerJoin: '',
      condition: `${innerAlias}.SalesRepKey = ${outerAlias}.SalesRepKey`,
    }),
  },
};

export function getDimensionSpec(dimension: Dimension): DimensionSpec {
  return DIMENSION_SPECS[dimension];
}

export function isDimension(value: string | null): value is Dimension {
  return value === 'cliente_entidad' || value === 'cliente_tienda' || value === 'producto' || value === 'vendedor';
}
