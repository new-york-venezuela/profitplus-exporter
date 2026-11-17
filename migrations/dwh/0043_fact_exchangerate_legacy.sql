-- 0043: fact.Fact_ExchangeRate_Legacy -- USD exchange rates taken from the OLD
-- (pre-March-2026-cutover) ERP's own saTasa, loaded by
-- scripts/dwh-legacy-2025-import.ts. The Analítica histórica section converts
-- every legacy Bs figure to USD with this table (sales at the invoice date,
-- returns at the ORIGINAL factura's date), never with fact.Fact_ExchangeRate
-- (loaded from the current ERP) and never with DocumentExchangeRate.
--
-- One row per calendar day from the first real rate onward, like
-- fact.Fact_ExchangeRate: days with no saTasa row repeat the last real rate and
-- carry IsCarriedForward = 1. USD only; if the legacy saTasa shows another
-- currency that matters, add a CurrencyCode column to the key in a later
-- migration. A day with no row at all (before the first rate) gives a NULL USD
-- amount downstream, never 0.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_ExchangeRate_Legacy' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    CREATE TABLE fact.Fact_ExchangeRate_Legacy (
        DateKey          int            NOT NULL,
        RateBuy          decimal(21,8)  NULL,
        RateSell         decimal(21,8)  NOT NULL,
        IsCarriedForward bit            NOT NULL CONSTRAINT DF_Fact_ExchangeRate_Legacy_IsCarriedForward DEFAULT 0,
        LoadedAtUtc      datetime2(3)   NOT NULL CONSTRAINT DF_Fact_ExchangeRate_Legacy_LoadedAtUtc DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Fact_ExchangeRate_Legacy PRIMARY KEY (DateKey),
        CONSTRAINT FK_Fact_ExchangeRate_Legacy_Dim_Date FOREIGN KEY (DateKey) REFERENCES dim.Dim_Date(DateKey)
    );
END
GO
