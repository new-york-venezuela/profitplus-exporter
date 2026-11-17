import type { ReturnsBasis } from '@/app/api/dwh/lib/query-builder';
import { returnsDateColumn } from '@/app/api/dwh/lib/query-builder';
import type { TrendBucket } from '@/app/api/dwh/lib/trend-bucket';
import { histDualSum, histReturnsUsdJoin, histUsdJoin } from './sql';

export const HIST_GROUP_BYS = ['mes', 'cliente', 'linea', 'vendedor', 'producto'] as const;
export type HistGroupBy = (typeof HIST_GROUP_BYS)[number];

export function isHistGroupBy(value: string | null): value is HistGroupBy {
  return value !== null && (HIST_GROUP_BYS as readonly string[]).includes(value);
}

interface Side { key: string; label: string; joins: string; extraWhere: string }
export interface GroupSpec { sales: Side; returns: Side; orderByKey: boolean }

// How each grouping reads the sales side (alias fsl) and the returns side (alias
// frl). Both sides use the same key so a group that only has returns still shows
// up (negative net). `producto` needs the `@parentValue` input (a LineCode, or
// 'SIN_LINEA') bound by the caller.
export function groupSpec(groupBy: HistGroupBy, bucket: TrendBucket, basis: ReturnsBasis): GroupSpec {
  switch (groupBy) {
    case 'mes':
      return {
        orderByKey: true,
        sales: { key: bucket.keyExpr('d'), label: bucket.keyExpr('d'), joins: 'JOIN dim.Dim_Date d ON d.DateKey = fsl.DateKey', extraWhere: '' },
        returns: { key: bucket.keyExpr('dr'), label: bucket.keyExpr('dr'), joins: `JOIN dim.Dim_Date dr ON dr.DateKey = frl.${returnsDateColumn(basis)}`, extraWhere: '' },
      };
    case 'cliente':
      return {
        orderByKey: false,
        sales: { key: 'CAST(c.CustomerLegacyKey AS varchar(20))', label: 'ISNULL(c.CustomerName, c.CustomerCode)', joins: 'JOIN dim.Dim_Customer_Legacy c ON c.CustomerLegacyKey = fsl.CustomerLegacyKey', extraWhere: '' },
        returns: { key: 'CAST(c.CustomerLegacyKey AS varchar(20))', label: 'ISNULL(c.CustomerName, c.CustomerCode)', joins: 'JOIN dim.Dim_Customer_Legacy c ON c.CustomerLegacyKey = frl.CustomerLegacyKey', extraWhere: '' },
      };
    case 'linea':
      return {
        orderByKey: false,
        sales: { key: "ISNULL(p.LineCode, 'SIN_LINEA')", label: "ISNULL(p.LineName, 'Sin línea')", joins: 'JOIN dim.Dim_Product_Legacy p ON p.ProductLegacyKey = fsl.ProductLegacyKey', extraWhere: '' },
        returns: { key: "ISNULL(p.LineCode, 'SIN_LINEA')", label: "ISNULL(p.LineName, 'Sin línea')", joins: 'JOIN dim.Dim_Product_Legacy p ON p.ProductLegacyKey = frl.ProductLegacyKey', extraWhere: '' },
      };
    case 'vendedor':
      return {
        orderByKey: false,
        sales: { key: 'CAST(ISNULL(fsl.SalesRepLegacyKey, 0) AS varchar(20))', label: "ISNULL(ISNULL(sr.SalesRepName, sr.SalesRepCode), 'Sin vendedor')", joins: 'LEFT JOIN dim.Dim_SalesRep_Legacy sr ON sr.SalesRepLegacyKey = fsl.SalesRepLegacyKey', extraWhere: '' },
        returns: { key: 'CAST(ISNULL(frl.SalesRepLegacyKey, 0) AS varchar(20))', label: "ISNULL(ISNULL(sr.SalesRepName, sr.SalesRepCode), 'Sin vendedor')", joins: 'LEFT JOIN dim.Dim_SalesRep_Legacy sr ON sr.SalesRepLegacyKey = frl.SalesRepLegacyKey', extraWhere: '' },
      };
    case 'producto':
      return {
        orderByKey: false,
        sales: { key: 'CAST(p.ProductLegacyKey AS varchar(20))', label: 'ISNULL(p.ProductName, p.ProductCode)', joins: 'JOIN dim.Dim_Product_Legacy p ON p.ProductLegacyKey = fsl.ProductLegacyKey', extraWhere: "AND ISNULL(p.LineCode, 'SIN_LINEA') = @parentValue" },
        returns: { key: 'CAST(p.ProductLegacyKey AS varchar(20))', label: 'ISNULL(p.ProductName, p.ProductCode)', joins: 'JOIN dim.Dim_Product_Legacy p ON p.ProductLegacyKey = frl.ProductLegacyKey', extraWhere: "AND ISNULL(p.LineCode, 'SIN_LINEA') = @parentValue" },
      };
  }
}

// One row per group: Bs/USD sales, Bs/USD returns and units sold. `salesWhere` /
// `returnsWhere` come from histSalesWhere / histReturnsWhere (they already carry
// the voided filter and the date window). `top` caps the row count (null = all).
export function buildGroupedQuery(spec: GroupSpec, salesWhere: string, returnsWhere: string, top: number | null): string {
  const topClause = top === null ? '' : `TOP ${Math.trunc(top)}`;
  return `
    WITH s AS (
      SELECT ${spec.sales.key} AS GroupKey, MAX(${spec.sales.label}) AS GroupLabel,
             ${histDualSum('fsl', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
             ISNULL(SUM(fsl.QuantitySold), 0) AS Units
      FROM fact.Fact_Sales_Legacy fsl
      ${histUsdJoin('fsl')}
      ${spec.sales.joins}
      WHERE 1 = 1 ${salesWhere} ${spec.sales.extraWhere}
      GROUP BY ${spec.sales.key}
    ), r AS (
      SELECT ${spec.returns.key} AS GroupKey, MAX(${spec.returns.label}) AS GroupLabel,
             ${histDualSum('frl', 'NetAmount', 'ReturnsBs', 'ReturnsUsd')}
      FROM fact.Fact_Returns_Legacy frl
      ${histReturnsUsdJoin('frl')}
      ${spec.returns.joins}
      WHERE 1 = 1 ${returnsWhere} ${spec.returns.extraWhere}
      GROUP BY ${spec.returns.key}
    )
    SELECT ${topClause}
           COALESCE(s.GroupKey, r.GroupKey) AS GroupValue,
           COALESCE(s.GroupLabel, r.GroupLabel) AS GroupLabel,
           ISNULL(s.SalesGrossBs, 0) AS SalesGrossBs, s.SalesGrossUsd AS SalesGrossUsd,
           ISNULL(r.ReturnsBs, 0) AS ReturnsBs, ISNULL(r.ReturnsUsd, 0) AS ReturnsUsd,
           ISNULL(s.Units, 0) AS Units
    FROM s FULL OUTER JOIN r ON r.GroupKey = s.GroupKey
    ORDER BY ${spec.orderByKey ? 'COALESCE(s.GroupKey, r.GroupKey)' : 'ISNULL(s.SalesGrossBs, 0) - ISNULL(r.ReturnsBs, 0) DESC'}`;
}
