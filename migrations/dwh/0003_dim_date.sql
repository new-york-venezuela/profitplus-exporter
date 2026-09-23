IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_Date' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_Date (
        DateKey     int          NOT NULL PRIMARY KEY,
        FullDate    date         NOT NULL,
        Year        int          NOT NULL,
        Month       int          NOT NULL,
        MonthName   varchar(20)  NOT NULL,
        Day         int          NOT NULL,
        DayOfWeek   int          NOT NULL,
        DayName     varchar(20)  NOT NULL,
        IsWeekend   bit          NOT NULL,
        YearMonth   char(7)      NOT NULL
    );
END
GO

DECLARE @StartDate date = '2020-01-01';
DECLARE @EndDate   date = '2035-12-31';
DECLARE @CurrentDate date = @StartDate;

WHILE @CurrentDate <= @EndDate
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dim.Dim_Date WHERE DateKey = CONVERT(int, FORMAT(@CurrentDate, 'yyyyMMdd')))
    BEGIN
        INSERT INTO dim.Dim_Date (DateKey, FullDate, Year, Month, MonthName, Day, DayOfWeek, DayName, IsWeekend, YearMonth)
        VALUES (
            CONVERT(int, FORMAT(@CurrentDate, 'yyyyMMdd')),
            @CurrentDate,
            YEAR(@CurrentDate),
            MONTH(@CurrentDate),
            DATENAME(month, @CurrentDate),
            DAY(@CurrentDate),
            DATEPART(weekday, @CurrentDate),
            DATENAME(weekday, @CurrentDate),
            CASE WHEN DATEPART(weekday, @CurrentDate) IN (1, 7) THEN 1 ELSE 0 END,
            FORMAT(@CurrentDate, 'yyyy-MM')
        );
    END
    SET @CurrentDate = DATEADD(day, 1, @CurrentDate);
END
