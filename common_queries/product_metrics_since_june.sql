-- Per-product metrics since June (current year): avg monthly production (units),
-- avg price, distinct entidades (legal entities) and tiendas (customer/store records),
-- avg return rate. Voided documents excluded from both sales and returns.
-- AvgMonthlyProduction only counts complete months (Jun-Aug); the current,
-- still-in-progress month is excluded so it doesn't drag the average down.
DECLARE @StartDateKey int = CONVERT(int, FORMAT(DATEFROMPARTS(YEAR(GETDATE()), 6, 1), 'yyyyMMdd'));

WITH SalesFiltered AS (
    SELECT
        fs.ProductKey,
        fs.CustomerKey,
        cust.LegalEntityKey,
        d.YearMonth,
        fs.QuantitySold,
        fs.NetAmount
    FROM fact.Fact_Sales fs
    INNER JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    INNER JOIN dim.Dim_Customer cust ON cust.CustomerKey = fs.CustomerKey
    WHERE fs.DateKey >= @StartDateKey
      AND fs.IsVoided = 0
),
ReturnsFiltered AS (
    SELECT
        fr.ProductKey,
        fr.QuantityReturned
    FROM fact.Fact_Returns fr
    INNER JOIN dim.Dim_Date d ON d.DateKey = fr.DateKey
    WHERE fr.DateKey >= @StartDateKey
      AND fr.IsVoided = 0
),
MonthlyProduction AS (
    SELECT
        ProductKey,
        YearMonth,
        SUM(QuantitySold) AS MonthlyQty
    FROM SalesFiltered
    WHERE YearMonth < FORMAT(DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1), 'yyyy-MM')
    GROUP BY ProductKey, YearMonth
),
SalesAgg AS (
    SELECT
        ProductKey,
        SUM(QuantitySold)                    AS TotalQtySold,
        SUM(NetAmount)                        AS TotalNetAmount,
        COUNT(DISTINCT CustomerKey)           AS StoreCount,
        COUNT(DISTINCT LegalEntityKey)        AS EntidadCount
    FROM SalesFiltered
    GROUP BY ProductKey
),
ReturnsAgg AS (
    SELECT
        ProductKey,
        SUM(QuantityReturned) AS TotalQtyReturned
    FROM ReturnsFiltered
    GROUP BY ProductKey
),
ProductionAgg AS (
    SELECT
        ProductKey,
        AVG(MonthlyQty) AS AvgMonthlyProduction
    FROM MonthlyProduction
    GROUP BY ProductKey
)
SELECT
    p.ProductKey,
    p.ProductCode,
    p.ProductName,
    prod.AvgMonthlyProduction,
    CASE WHEN s.TotalQtySold > 0 THEN s.TotalNetAmount / s.TotalQtySold ELSE NULL END AS AvgPrice,
    s.EntidadCount,
    s.StoreCount,
    CASE WHEN s.TotalQtySold > 0
         THEN ISNULL(r.TotalQtyReturned, 0) / s.TotalQtySold
         ELSE NULL
    END AS AvgReturnRate
FROM dim.Dim_Product p
INNER JOIN SalesAgg s ON s.ProductKey = p.ProductKey
LEFT JOIN ProductionAgg prod ON prod.ProductKey = p.ProductKey
LEFT JOIN ReturnsAgg r ON r.ProductKey = p.ProductKey
WHERE p.IsCurrent = 1
ORDER BY prod.AvgMonthlyProduction DESC;
