import { usdConversionJoin } from '@/app/api/dwh/lib/query-builder';

// One row per CURRENT customer code with sales in the period or in the previous equal period. Sales are keyed
// by CustomerKey (which may point at an older SCD2 version of the same code), so every aggregate groups by
// RTRIM(CustomerCode) across all versions. periodWhere / prevWhere use alias `fs`; scopeWhere uses alias `c`
// on Dim_Customer (customerScope(scope, 'c').where). prevWhere null = no previous window.
export function trayectoriaQuery(scopeWhere: string, periodWhere: string, prevWhere: string | null): string {
  return `
    WITH Cur AS (
      SELECT RTRIM(c.CustomerCode) AS Code, c.CustomerName AS Name, c.LegalEntityKey
      FROM dim.Dim_Customer c
      WHERE c.IsCurrent = 1 ${scopeWhere}
    ),
    PeriodSales AS (
      SELECT RTRIM(c.CustomerCode) AS Code, SUM(fs.NetAmount) AS SalesBs, SUM(fs.NetAmount / NULLIF(fx.RateSell, 0)) AS SalesUsd,
             SUM(fs.QuantitySold) AS Units, COUNT(DISTINCT fs.InvoiceNumber) AS Orders
      FROM fact.Fact_Sales fs
      ${usdConversionJoin('fs')}
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 ${periodWhere}
      GROUP BY RTRIM(c.CustomerCode)
    ),
    PrevSales AS (
      SELECT RTRIM(c.CustomerCode) AS Code, SUM(fs.NetAmount) AS SalesBs, SUM(fs.NetAmount / NULLIF(fx.RateSell, 0)) AS SalesUsd,
             SUM(fs.QuantitySold) AS Units
      FROM fact.Fact_Sales fs
      ${usdConversionJoin('fs')}
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 ${prevWhere ?? 'AND 1 = 0'}
      GROUP BY RTRIM(c.CustomerCode)
    ),
    OwnSales AS (
      SELECT RTRIM(c.CustomerCode) AS Code, MIN(fs.DateKey) AS FirstDateKey, MAX(fs.DateKey) AS LastDateKey
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0
      GROUP BY RTRIM(c.CustomerCode)
    )
    SELECT cur.Code, cur.Name, cur.LegalEntityKey, le.LegalEntityName,
           ps.SalesBs, ps.SalesUsd, ps.Units, ps.Orders,
           pv.SalesBs AS PrevBs, pv.SalesUsd AS PrevUsd, pv.Units AS PrevUnits,
           o.FirstDateKey, o.LastDateKey
    FROM Cur cur
    LEFT JOIN PeriodSales ps ON ps.Code = cur.Code
    LEFT JOIN PrevSales pv ON pv.Code = cur.Code
    LEFT JOIN OwnSales o ON o.Code = cur.Code
    LEFT JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = cur.LegalEntityKey
    WHERE ps.Code IS NOT NULL OR pv.Code IS NOT NULL
  `;
}
