import { usdConversionJoin } from '@/app/api/dwh/lib/query-builder';

// One row per CURRENT customer version. Sales are keyed by CustomerKey, which may point at an older SCD2
// version of the same code, so every sales aggregate groups by RTRIM(CustomerCode) across all versions.
// Route / group / frequency / registration come from the current row (Dim_Zone, Dim_Segment joined on it).
// periodDateWhere (alias `fs`) comes from buildDateWhereClause(range, 'fs').
export function coberturaCustomersQuery(includeInactive: boolean, periodDateWhere: string): string {
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
      SELECT RTRIM(c.CustomerCode) AS Code, MAX(fs.DateKey) AS LastDateKey
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
      SELECT DISTINCT RTRIM(c.CustomerCode) AS Code
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 ${periodDateWhere}
    )
    SELECT cur.Code AS CustomerCode, cur.CustomerName, le.LegalEntityName, cur.SellerCode,
           r.SalesRepName AS SellerName, o.LastDateKey, e.LastDateKey AS EntityLastDateKey,
           cur.GroupCode, cur.GroupName, cur.RouteNumber, cur.RegisteredDate, cur.VisitIntervalDays,
           CASE WHEN ps.Code IS NULL THEN 0 ELSE 1 END AS InPeriod
    FROM Cur cur
    LEFT JOIN OwnSales o ON o.Code = cur.Code
    LEFT JOIN EntitySales e ON e.LegalEntityKey = cur.LegalEntityKey
    LEFT JOIN PeriodSales ps ON ps.Code = cur.Code
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
