import { usdConversionJoin, returnsUsdConversionJoin } from './query-builder';

export type ChildLevel = 'tienda' | 'producto';

export function parseChildLevel(v: string | null): ChildLevel | null {
  return v === 'tienda' || v === 'producto' ? v : null;
}

export interface ChildFilters {
  salesDateWhere: string; // built against alias `fs`
  returnsDateWhere: string; // built against alias `fr` on the selected returns column
  salesBucketWhere: string; // '' or bucketFilterClause(..., 'fs')
  returnsBucketWhere: string; // '' or bucketFilterClause(..., 'fr', returnsColumn)
  salesRepWhere: string; // '' or 'AND fs.SalesRepKey = @salesRepKey'
  returnsSalesRepWhere: string; // '' or 'AND fr.SalesRepKey = @salesRepKey'
}

// Tiendas of one Entidad (@entityKey = LegalEntityKey of the fact's own
// customer version — the same grain as the top-level Entidad row, so children
// sum to their parent). A tienda is the trimmed CustomerCode across all SCD2
// versions; its label is the current version's name.
export function tiendasQuery(f: ChildFilters): string {
  return `
    WITH sales AS (
      SELECT RTRIM(c.CustomerCode) AS Code,
             SUM(fs.NetAmount) AS SalesGrossBs,
             SUM(fs.NetAmount / NULLIF(fx.RateSell, 0)) AS SalesGrossUsd,
             SUM(fs.GrossAmount) AS GrossAmount,
             SUM(fs.DiscountAmount) AS DiscountAmount,
             SUM(fs.QuantitySold) AS UnitsSold
      FROM fact.Fact_Sales fs
      ${usdConversionJoin('fs')}
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 AND c.LegalEntityKey = @entityKey
        ${f.salesDateWhere} ${f.salesBucketWhere} ${f.salesRepWhere}
      GROUP BY RTRIM(c.CustomerCode)
    ),
    rets AS (
      SELECT RTRIM(c.CustomerCode) AS Code,
             SUM(fr.NetAmount) AS ReturnsBs,
             SUM(fr.NetAmount / NULLIF(frfx.RateSell, 0)) AS ReturnsUsd
      FROM fact.Fact_Returns fr
      ${returnsUsdConversionJoin('fr', 'frfx')}
      JOIN dim.Dim_Customer c ON c.CustomerKey = fr.CustomerKey
      WHERE fr.IsVoided = 0 AND c.LegalEntityKey = @entityKey
        ${f.returnsDateWhere} ${f.returnsBucketWhere} ${f.returnsSalesRepWhere}
      GROUP BY RTRIM(c.CustomerCode)
    )
    SELECT s.Code AS GroupValue,
           ISNULL(cur.CustomerName, s.Code) AS GroupLabel,
           s.SalesGrossBs, s.SalesGrossUsd, s.GrossAmount, s.DiscountAmount, s.UnitsSold,
           ISNULL(r.ReturnsBs, 0) AS ReturnsBs,
           CASE WHEN r.Code IS NULL THEN 0 ELSE r.ReturnsUsd END AS ReturnsUsd
    FROM sales s
    LEFT JOIN rets r ON r.Code = s.Code
    OUTER APPLY (
      SELECT TOP 1 c2.CustomerName FROM dim.Dim_Customer c2
      WHERE RTRIM(c2.CustomerCode) = s.Code AND c2.IsCurrent = 1
    ) cur
    ORDER BY s.SalesGrossBs DESC
  `;
}

// Productos of one tienda (@storeCode) within its Entidad (@entityKey).
export function productosQuery(f: ChildFilters): string {
  return `
    WITH sales AS (
      SELECT fs.ProductKey,
             SUM(fs.NetAmount) AS SalesGrossBs,
             SUM(fs.NetAmount / NULLIF(fx.RateSell, 0)) AS SalesGrossUsd,
             SUM(fs.GrossAmount) AS GrossAmount,
             SUM(fs.DiscountAmount) AS DiscountAmount,
             SUM(fs.QuantitySold) AS UnitsSold
      FROM fact.Fact_Sales fs
      ${usdConversionJoin('fs')}
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 AND c.LegalEntityKey = @entityKey AND RTRIM(c.CustomerCode) = @storeCode
        ${f.salesDateWhere} ${f.salesBucketWhere} ${f.salesRepWhere}
      GROUP BY fs.ProductKey
    ),
    rets AS (
      SELECT fr.ProductKey,
             SUM(fr.NetAmount) AS ReturnsBs,
             SUM(fr.NetAmount / NULLIF(frfx.RateSell, 0)) AS ReturnsUsd
      FROM fact.Fact_Returns fr
      ${returnsUsdConversionJoin('fr', 'frfx')}
      JOIN dim.Dim_Customer c ON c.CustomerKey = fr.CustomerKey
      WHERE fr.IsVoided = 0 AND c.LegalEntityKey = @entityKey AND RTRIM(c.CustomerCode) = @storeCode
        ${f.returnsDateWhere} ${f.returnsBucketWhere} ${f.returnsSalesRepWhere}
      GROUP BY fr.ProductKey
    )
    SELECT CAST(s.ProductKey AS varchar(20)) AS GroupValue,
           ISNULL(p.ProductName, p.ProductCode) AS GroupLabel,
           s.SalesGrossBs, s.SalesGrossUsd, s.GrossAmount, s.DiscountAmount, s.UnitsSold,
           ISNULL(r.ReturnsBs, 0) AS ReturnsBs,
           CASE WHEN r.ProductKey IS NULL THEN 0 ELSE r.ReturnsUsd END AS ReturnsUsd
    FROM sales s
    JOIN dim.Dim_Product p ON p.ProductKey = s.ProductKey
    LEFT JOIN rets r ON r.ProductKey = s.ProductKey
    ORDER BY s.SalesGrossBs DESC
  `;
}
