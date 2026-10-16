import { usdConversionJoin } from '@/app/api/dwh/lib/query-builder';

// One row per CURRENT customer version. Sales are keyed by CustomerKey, which may point at an older SCD2
// version of the same code, so every sales aggregate groups by RTRIM(CustomerCode) across all versions.
// Route / group / frequency / registration come from the current row (Dim_Zone, Dim_Segment joined on it).
// periodDateWhere (alias `fs`) comes from buildDateWhereClause(range, 'fs').
// prevDateWhere: the same-length window before the range (null = none, e.g. a closed past YTD year -> PrevSales is empty).
export function coberturaCustomersQuery(includeInactive: boolean, periodDateWhere: string, prevDateWhere: string | null = null): string {
  return `
    WITH Cur AS (
      SELECT RTRIM(c.CustomerCode) AS Code, c.CustomerName, RTRIM(c.DefaultSalesRepCode) AS SellerCode, c.LegalEntityKey,
             RTRIM(c.ErpSegmentCode) AS GroupCode, sg.SegmentName AS GroupName, z.RouteNumber AS RouteNumber,
             c.RegisteredDate AS RegisteredDate, c.VisitIntervalDays AS VisitIntervalDays
      FROM dim.Dim_Customer c
      LEFT JOIN dim.Dim_Segment sg ON sg.ErpSegmentCode = c.ErpSegmentCode
      LEFT JOIN dim.Dim_Zone z ON z.ZoneCode = c.ZoneCode
      WHERE c.IsCurrent = 1 ${includeInactive ? '' : 'AND c.IsInactive = 0'}
    ),
    OwnSales AS (
      SELECT RTRIM(c.CustomerCode) AS Code, MAX(fs.DateKey) AS LastDateKey, MIN(fs.DateKey) AS FirstDateKey
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0
      GROUP BY RTRIM(c.CustomerCode)
    ),
    EntitySales AS (
      SELECT c.LegalEntityKey, MAX(fs.DateKey) AS LastDateKey
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 AND c.LegalEntityKey IS NOT NULL
      GROUP BY c.LegalEntityKey
    ),
    PeriodSales AS (
      SELECT RTRIM(c.CustomerCode) AS Code, SUM(fs.NetAmount) AS SalesBs, SUM(fs.NetAmount / NULLIF(fx.RateSell, 0)) AS SalesUsd
      FROM fact.Fact_Sales fs
      ${usdConversionJoin('fs')}
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 ${periodDateWhere}
      GROUP BY RTRIM(c.CustomerCode)
    ),
    PrevSales AS (
      SELECT RTRIM(c.CustomerCode) AS Code, SUM(fs.NetAmount) AS SalesBs, SUM(fs.NetAmount / NULLIF(fx.RateSell, 0)) AS SalesUsd
      FROM fact.Fact_Sales fs
      ${usdConversionJoin('fs')}
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 ${prevDateWhere ?? 'AND 1 = 0'}
      GROUP BY RTRIM(c.CustomerCode)
    )
    SELECT cur.Code AS CustomerCode, cur.CustomerName, le.LegalEntityName, cur.SellerCode,
           r.SalesRepName AS SellerName, o.LastDateKey, e.LastDateKey AS EntityLastDateKey,
           cur.GroupCode, cur.GroupName, cur.RouteNumber, cur.RegisteredDate, cur.VisitIntervalDays,
           CASE WHEN ps.Code IS NULL THEN 0 ELSE 1 END AS InPeriod, o.FirstDateKey,
           ps.SalesBs AS PeriodBs, ps.SalesUsd AS PeriodUsd, pv.SalesBs AS PrevBs, pv.SalesUsd AS PrevUsd,
           CASE WHEN pv.Code IS NULL THEN 0 ELSE 1 END AS InPrev
    FROM Cur cur
    LEFT JOIN OwnSales o ON o.Code = cur.Code
    LEFT JOIN EntitySales e ON e.LegalEntityKey = cur.LegalEntityKey
    LEFT JOIN PeriodSales ps ON ps.Code = cur.Code
    LEFT JOIN PrevSales pv ON pv.Code = cur.Code
    LEFT JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = cur.LegalEntityKey
    LEFT JOIN dim.Dim_SalesRep r ON RTRIM(r.SalesRepCode) = cur.SellerCode
  `;
}

export const COBERTURA_MONTHLY_QUERY = `
  SELECT RTRIM(c.CustomerCode) AS Code, d.YearMonth,
         SUM(fs.QuantitySold) AS Units,
         SUM(fs.NetAmount / NULLIF(fx.RateSell, 0)) AS Usd
  FROM fact.Fact_Sales fs
  JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
  JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
  ${usdConversionJoin('fs')}
  WHERE fs.IsVoided = 0 AND fs.DateKey >= @windowStartKey
  GROUP BY RTRIM(c.CustomerCode), d.YearMonth
`;

// Distinct invoice days per customer over the last 3 x 30 days: input of the 'constancia' classification (3 visit windows).
export const COBERTURA_RECENT_DAYS_QUERY = `
  SELECT DISTINCT RTRIM(c.CustomerCode) AS Code, fs.DateKey
  FROM fact.Fact_Sales fs
  JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
  WHERE fs.IsVoided = 0 AND fs.DateKey >= @recentStartKey
`;
