-- 0042: empty every legacy (pre-March-2026-cutover) table so
-- scripts/dwh-legacy-2025-import.ts can be re-run over a wider date range
-- (the Analítica histórica section needs 2020 onwards; the first import only
-- loaded 2025-01-01 .. 2026-02-28). The import script refuses to run while
-- fact.Fact_Sales_Legacy has rows, so this is the "truncate manually first"
-- step its guard message asks for.
--
-- DESTRUCTIVE and NOT idempotent in spirit: it deletes every row each time it
-- runs. scripts/migrate-dwh.ts tracks applied migrations in
-- dwh.__dwh_migrations, so it runs once per database; do not clear that
-- tracking row and re-run it after the re-import has loaded data.
--
-- Apply it right before running the import: between this migration and the
-- import, the Histórico 2025 tab (and the Analítica histórica section, once it
-- exists) shows no data.
--
-- Facts go first (they hold the FKs); the dims are referenced by those FKs, so
-- TRUNCATE is not allowed on them: DELETE + reseed the identity instead, so the
-- re-import starts again at key 1. The Fact_* tables are not referenced by any
-- FK, so they can be truncated. Only the *_Legacy tables are touched;
-- fact.Fact_Sales / fact.Fact_Returns / the current dims are never read or written.

IF OBJECT_ID('fact.Fact_Returns_Legacy', 'U') IS NOT NULL
    TRUNCATE TABLE fact.Fact_Returns_Legacy;
GO

IF OBJECT_ID('fact.Fact_Sales_Legacy', 'U') IS NOT NULL
    TRUNCATE TABLE fact.Fact_Sales_Legacy;
GO

IF OBJECT_ID('dim.Dim_Customer_Legacy', 'U') IS NOT NULL
BEGIN
    DELETE FROM dim.Dim_Customer_Legacy;
    DBCC CHECKIDENT ('dim.Dim_Customer_Legacy', RESEED, 0) WITH NO_INFOMSGS;
END
GO

IF OBJECT_ID('dim.Dim_Product_Legacy', 'U') IS NOT NULL
BEGIN
    DELETE FROM dim.Dim_Product_Legacy;
    DBCC CHECKIDENT ('dim.Dim_Product_Legacy', RESEED, 0) WITH NO_INFOMSGS;
END
GO

IF OBJECT_ID('dim.Dim_SalesRep_Legacy', 'U') IS NOT NULL
BEGIN
    DELETE FROM dim.Dim_SalesRep_Legacy;
    DBCC CHECKIDENT ('dim.Dim_SalesRep_Legacy', RESEED, 0) WITH NO_INFOMSGS;
END
GO
