-- WeekStartDate/YearWeek let the seller x product x store matrix export
-- (docs/superpowers/specs/2026-09-23-seller-product-store-matrix-design.md)
-- roll sales/returns up to week grain in Excel — no other tab in this
-- dashboard needed a week concept before now (everything else uses
-- YearMonth or raw DateKey window filtering).
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dim.Dim_Date') AND name = 'WeekStartDate')
    ALTER TABLE dim.Dim_Date ADD WeekStartDate date NULL;
GO

-- char(8), not char(7): the 'YYYY-Www' format is 8 characters
-- (e.g. '2020-W01'), not 7 -- 4-digit year + '-W' + 2-digit zero-padded
-- week number = 4 + 2 + 2 = 8.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dim.Dim_Date') AND name = 'YearWeek')
    ALTER TABLE dim.Dim_Date ADD YearWeek char(8) NULL;
GO

-- Backfill: Monday-anchor independent of session DATEFIRST by normalizing
-- DATEPART(weekday, ...) (which IS DATEFIRST-dependent) against @@DATEFIRST
-- itself, so this produces the same Monday regardless of the connecting
-- session's DATEFIRST setting. YearWeek's year component is the year of
-- that week's Thursday (DATEADD(day, 3, WeekStartDate)) -- the ISO 8601
-- definition of which year a week "belongs to" -- not YEAR(FullDate),
-- which would be wrong for the last days of December / first days of
-- January whenever the ISO week crosses the calendar year boundary.
UPDATE dim.Dim_Date
SET
    WeekStartDate = DATEADD(day, 1 - ((DATEPART(weekday, FullDate) + @@DATEFIRST - 2) % 7 + 1), FullDate),
    YearWeek = CONCAT(
        YEAR(DATEADD(day, 3, DATEADD(day, 1 - ((DATEPART(weekday, FullDate) + @@DATEFIRST - 2) % 7 + 1), FullDate))),
        '-W',
        RIGHT('0' + CAST(DATEPART(iso_week, FullDate) AS varchar(2)), 2)
    )
WHERE WeekStartDate IS NULL OR YearWeek IS NULL;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dim.Dim_Date') AND name = 'WeekStartDate' AND is_nullable = 1)
    ALTER TABLE dim.Dim_Date ALTER COLUMN WeekStartDate date NOT NULL;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dim.Dim_Date') AND name = 'YearWeek' AND is_nullable = 1)
    ALTER TABLE dim.Dim_Date ALTER COLUMN YearWeek char(8) NOT NULL;
GO
