IF OBJECT_ID('view.v_SellerProductStoreMatrix', 'V') IS NOT NULL
DROP VIEW view.v_SellerProductStoreMatrix;
GO

CREATE VIEW view.v_SellerProductStoreMatrix AS
WITH SalesAgg AS (
    SELECT
        fs.SalesRepKey,
        fs.ProductKey,
        fs.CustomerKey,
        d.DateKey,
        d.FullDate,
        -- ISO Week Calculation independent of @@DATEFIRST
        DATEADD(day, 1 - ((DATEPART(weekday, d.FullDate) + @@DATEFIRST - 2) % 7 + 1), d.FullDate) AS WeekStartDate,
        CONCAT(
            YEAR(DATEADD(day, 3, DATEADD(day, 1 - ((DATEPART(weekday, d.FullDate) + @@DATEFIRST - 2) % 7 + 1), d.FullDate))),
                '-W',
            RIGHT('0' + CAST(DATEPART(iso_week, d.FullDate) AS varchar(2)), 2)
        ) AS YearWeek,
        fs.NetAmount AS SalesNetAmount,
        fs.QuantitySold AS UnitsSold,
        0 AS ReturnsNetAmount,
        0 AS UnitsReturned
    FROM fact.Fact_Sales fs
             JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0

    UNION ALL

    SELECT
        fr.SalesRepKey,
        fr.ProductKey,
        fr.CustomerKey,
        d.DateKey,
        d.FullDate,
        DATEADD(day, 1 - ((DATEPART(weekday, d.FullDate) + @@DATEFIRST - 2) % 7 + 1), d.FullDate) AS WeekStartDate,
        CONCAT(
            YEAR(DATEADD(day, 3, DATEADD(day, 1 - ((DATEPART(weekday, d.FullDate) + @@DATEFIRST - 2) % 7 + 1), d.FullDate))),
                '-W',
            RIGHT('0' + CAST(DATEPART(iso_week, d.FullDate) AS varchar(2)), 2)
        ) AS YearWeek,
        0 AS SalesNetAmount,
        0 AS UnitsSold,
        fr.NetAmount AS ReturnsNetAmount,
        fr.QuantityReturned AS UnitsReturned
    FROM fact.Fact_Returns fr
             JOIN dim.Dim_Date d ON d.DateKey = fr.DateKey
    WHERE fr.IsVoided = 0
)
SELECT
    -- Seller metadata
    a.SalesRepKey,
    ISNULL(sr.SalesRepName, sr.SalesRepCode) AS SalesRepName,

    -- Product metadata
    a.ProductKey,
    p.ProductName,
    p.LineName,
    p.SubLineName,
    p.CategoryName,

    -- Customer/Store metadata
    a.CustomerKey,
    ISNULL(c.CustomerName, c.CustomerCode) AS CustomerName,
    le.LegalEntityKey,
    le.LegalEntityName,

    -- Temporal metadata (for Excel week/month/year pivoting)
    a.DateKey,
    a.FullDate,
    a.WeekStartDate,
    a.YearWeek,

    -- Measures & USD Conversion (using DocumentExchangeRate fallback)
    SUM(a.SalesNetAmount) AS GrossSalesAmount,
    SUM(a.UnitsSold) AS UnitsSold,
    SUM(a.SalesNetAmount / NULLIF(COALESCE(fx.RateSell, 1), 0)) AS GrossSalesAmountUSD,

    SUM(a.ReturnsNetAmount) AS ReturnsAmount,
    SUM(a.UnitsReturned) AS UnitsReturned,
    SUM(a.ReturnsNetAmount / NULLIF(COALESCE(fx.RateSell, 1), 0)) AS ReturnsAmountUSD,

    -- Net Metrics
    SUM(a.SalesNetAmount - a.ReturnsNetAmount) AS NetAmount,
    SUM(a.UnitsSold - a.UnitsReturned) AS NetUnits,

    -- Ratios (Returns / Sales)
    CASE
        WHEN SUM(a.SalesNetAmount) > 0
            THEN SUM(a.ReturnsNetAmount) / SUM(a.SalesNetAmount)
        ELSE NULL
        END AS ReturnRateAmount,

    CASE
        WHEN SUM(a.UnitsSold) > 0
            THEN CAST(SUM(a.UnitsReturned) AS float) / SUM(a.UnitsSold)
        ELSE NULL
        END AS ReturnRateUnits

FROM SalesAgg a
         JOIN dim.Dim_SalesRep sr ON sr.SalesRepKey = a.SalesRepKey
         JOIN dim.Dim_Product p ON p.ProductKey = a.ProductKey
         JOIN dim.Dim_Customer c ON c.CustomerKey = a.CustomerKey
         JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
         LEFT JOIN fact.Fact_ExchangeRate fx
                   ON fx.DateKey = a.DateKey
                       AND fx.CurrencyKey = (SELECT CurrencyKey FROM dim.Dim_Currency WHERE RTRIM(CurrencyCode) = 'USD')
GROUP BY
    a.SalesRepKey,
    ISNULL(sr.SalesRepName, sr.SalesRepCode),
    a.ProductKey,
    p.ProductName,
    p.LineName,
    p.SubLineName,
    p.CategoryName,
    a.CustomerKey,
    ISNULL(c.CustomerName, c.CustomerCode),
    le.LegalEntityKey,
    le.LegalEntityName,
    a.DateKey,
    a.FullDate,
    a.WeekStartDate,
    a.YearWeek;
GO