-- Type 1 (overwrite) dimension, following Dim_SalesRep's pattern
-- (dwh-migrations/0007_dim_salesrep_warehouse_documenttype.sql) rather than
-- Dim_Customer's SCD Type 2 pattern — suppliers are used here purely for
-- "top supplier by spend" rollups (same shape as Vendedores' "top rep by
-- sales"), which has no point-in-time-history requirement. Revisit if a
-- future need for historical supplier attribute tracking emerges.
--
-- Per this project's standing rule (established in the Finanzas plan, see
-- 0017_dim_expense_concept.sql / 0018_fact_expenses.sql): always
-- LTRIM(RTRIM(...)) both sides of a join or comparison against a
-- fixed-width char column sourced from Ncake_a (here, saProveedor.co_prov /
-- Dim_Supplier.SupplierCode), plus COLLATE SQL_Latin1_General_CP1_CI_AS
-- when comparing across the Ncake_a/DWH_AlimentosNY cross-database
-- boundary. Applied throughout this migration's MERGE below.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_Supplier' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_Supplier (
        SupplierKey       int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SupplierCode      char(16)      NOT NULL UNIQUE,
        SupplierName      varchar(120)  NULL,
        ZoneCode          char(6)       NULL,
        SegmentCode       char(6)       NULL,
        SupplierTypeCode  char(6)       NULL,
        IsInactive        bit           NOT NULL,
        LoadedAtUtc       datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saProveedor')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saProveedor', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_Supplier
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saProveedor');
    DECLARE @NewWatermark binary(8);
    DECLARE @RowCount int;

    MERGE dim.Dim_Supplier AS tgt
    USING (
        SELECT
            LTRIM(RTRIM(src.co_prov)) AS SupplierCode, src.prov_des AS SupplierName,
            src.co_zon AS ZoneCode, src.co_seg AS SegmentCode, src.tip_pro AS SupplierTypeCode,
            ISNULL(src.inactivo, 0) AS IsInactive
        FROM Ncake_a.dbo.saProveedor src
        WHERE src.validador > @Watermark
    ) AS src
        ON LTRIM(RTRIM(tgt.SupplierCode)) = LTRIM(RTRIM(src.SupplierCode)) COLLATE SQL_Latin1_General_CP1_CI_AS
    WHEN MATCHED THEN UPDATE SET
        tgt.SupplierName = src.SupplierName,
        tgt.ZoneCode = src.ZoneCode,
        tgt.SegmentCode = src.SegmentCode,
        tgt.SupplierTypeCode = src.SupplierTypeCode,
        tgt.IsInactive = src.IsInactive,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (SupplierCode, SupplierName, ZoneCode, SegmentCode, SupplierTypeCode, IsInactive)
        VALUES (src.SupplierCode, src.SupplierName, src.ZoneCode, src.SegmentCode, src.SupplierTypeCode, src.IsInactive);

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(validador), @Watermark) FROM Ncake_a.dbo.saProveedor;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saProveedor';
END
GO
