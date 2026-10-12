-- 0040: routes, visit frequency and registration date in the DWH (sales tabs refactor, plan A).
--  * Drops dim.vw_Customer_Classified and dim.Dim_CustomerMapping (0039 was applied, so it is not edited;
--    group = saCliente.co_seg already reaches Dim_Customer, route/frequency come from the ERP too).
--  * dim.Dim_Customer gains RegisteredDate, IsMigrationBatch, VisitFrequency, ErpSegmentCode and the
--    persisted computed VisitIntervalDays (7/15/30 from VisitFrequency).
--  * dwh.Load_Dim_Customer is redefined (current definition: 0031). RegisteredDate, IsMigrationBatch and
--    VisitFrequency take part in SCD2 change detection; ErpSegmentCode is synced in place like SegmentCode.
--  * dim.Dim_Zone / dim.Dim_Segment: full-refresh mirrors of saZona / saSegmento.
-- Historical (non-current) Dim_Customer rows are backfilled ONCE from today's ERP values (the ERP keeps
-- no history of these fields), the same data-correction philosophy as 0031.
-- The cutover date below is repeated from lib/dwh/cutover.ts (MIGRATION_CUTOVER_DATE); a unit test pins both.
-- The frequency list and intervals are repeated from lib/customer-mapping/frequency.ts (VISIT_FREQUENCIES,
-- VISIT_INTERVAL_DAYS) and normalised the same way as parseVisitFrequency (trim + upper-case); a unit test
-- pins both. The route-zone pattern mirrors routeNumberFromZone (lib/customer-mapping/route-zones.ts).

IF OBJECT_ID('dim.vw_Customer_Classified', 'V') IS NOT NULL DROP VIEW dim.vw_Customer_Classified;
GO
IF OBJECT_ID('dim.Dim_CustomerMapping', 'U') IS NOT NULL DROP TABLE dim.Dim_CustomerMapping;
GO

IF COL_LENGTH('dim.Dim_Customer', 'RegisteredDate') IS NULL
    ALTER TABLE dim.Dim_Customer ADD RegisteredDate date NULL;
GO
IF COL_LENGTH('dim.Dim_Customer', 'IsMigrationBatch') IS NULL
    ALTER TABLE dim.Dim_Customer ADD IsMigrationBatch bit NOT NULL CONSTRAINT DF_Dim_Customer_IsMigrationBatch DEFAULT (0);
GO
IF COL_LENGTH('dim.Dim_Customer', 'VisitFrequency') IS NULL
    ALTER TABLE dim.Dim_Customer ADD VisitFrequency varchar(10) NULL;
GO
IF COL_LENGTH('dim.Dim_Customer', 'ErpSegmentCode') IS NULL
    ALTER TABLE dim.Dim_Customer ADD ErpSegmentCode char(6) NULL;
GO
IF COL_LENGTH('dim.Dim_Customer', 'VisitIntervalDays') IS NULL
    ALTER TABLE dim.Dim_Customer ADD VisitIntervalDays AS (
        CASE VisitFrequency WHEN 'SEMANAL' THEN 7 WHEN 'QUINCENAL' THEN 15 WHEN 'MENSUAL' THEN 30 END) PERSISTED;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_Zone' AND schema_id = SCHEMA_ID('dim'))
    CREATE TABLE dim.Dim_Zone (
        ZoneCode    char(6)      NOT NULL PRIMARY KEY,
        ZoneName    varchar(60)  NOT NULL,
        IsRoute     bit          NOT NULL,
        RouteNumber int          NULL,
        LoadedAtUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
GO
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_Segment' AND schema_id = SCHEMA_ID('dim'))
    CREATE TABLE dim.Dim_Segment (
        ErpSegmentCode char(6)      NOT NULL PRIMARY KEY,
        SegmentName    varchar(60)  NOT NULL,
        LoadedAtUtc    datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_Zone
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRAN;
    DELETE FROM dim.Dim_Zone;
    INSERT INTO dim.Dim_Zone (ZoneCode, ZoneName, IsRoute, RouteNumber)
    SELECT src.co_zon, RTRIM(src.zon_des), CASE WHEN rn.n IS NULL THEN 0 ELSE 1 END, rn.n
    FROM Ncake_a.dbo.saZona src
    OUTER APPLY (
        SELECT CASE WHEN RTRIM(src.co_zon) COLLATE Latin1_General_BIN LIKE 'CCS[0-9][0-9][0-9]'
                     AND SUBSTRING(RTRIM(src.co_zon), 4, 3) <> '000'
                    THEN CAST(SUBSTRING(RTRIM(src.co_zon), 4, 3) AS int) END AS n
    ) rn;
    COMMIT TRAN;
END
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_Segment
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRAN;
    DELETE FROM dim.Dim_Segment;
    INSERT INTO dim.Dim_Segment (ErpSegmentCode, SegmentName)
    SELECT src.co_seg, RTRIM(src.seg_des) FROM Ncake_a.dbo.saSegmento src;
    COMMIT TRAN;
END
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_Customer
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saCliente');
    DECLARE @NewWatermark binary(8);
    DECLARE @Now datetime2(3) = SYSUTCDATETIME();
    DECLARE @RowCount int;
    DECLARE @CutoverDate date = '2026-03-28';

    -- Close out current versions whose source row changed. MatrizCode, SegmentCode and ErpSegmentCode are
    -- intentionally NOT part of this diff (in-place syncs below, see 0030/0031); RegisteredDate,
    -- IsMigrationBatch and VisitFrequency are. VisitIntervalDays is computed from VisitFrequency.
    UPDATE tgt
    SET tgt.ValidTo = @Now, tgt.IsCurrent = 0
    FROM dim.Dim_Customer tgt
    INNER JOIN Ncake_a.dbo.saCliente src ON RTRIM(src.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(tgt.CustomerCode)
    OUTER APPLY (
        SELECT CASE WHEN UPPER(LTRIM(RTRIM(src.frecu_vist))) IN ('SEMANAL', 'QUINCENAL', 'MENSUAL')
                    THEN UPPER(LTRIM(RTRIM(src.frecu_vist))) END AS Freq
    ) f
    WHERE tgt.IsCurrent = 1
      AND src.validador > @Watermark
      AND (
            ISNULL(tgt.CustomerName, '') <> ISNULL(src.cli_des, '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.TaxId, '') <> ISNULL(src.rif, '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.LegalEntityRIF, '') <> ISNULL(src.rif, '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.IsSpecialTaxpayer, 0) <> ISNULL(src.contrib, 0)
         OR ISNULL(tgt.CreditLimit, -1) <> ISNULL(src.mont_cre, -1)
         OR ISNULL(RTRIM(tgt.CreditLimitCurrencyCode), '') <> ISNULL(RTRIM(src.co_mone), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(RTRIM(tgt.ZoneCode), '') <> ISNULL(RTRIM(src.co_zon), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(RTRIM(tgt.DefaultSalesRepCode), '') <> ISNULL(RTRIM(src.co_ven), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.IsLegalEntity, 0) <> ISNULL(src.juridico, 0)
         OR ISNULL(tgt.IsInactive, 0) <> ISNULL(src.inactivo, 0)
         OR ISNULL(tgt.RegisteredDate, '19000101') <> ISNULL(CAST(src.fecha_reg AS date), '19000101')
         OR tgt.IsMigrationBatch <> CASE WHEN CAST(src.fecha_reg AS date) = @CutoverDate THEN 1 ELSE 0 END
         OR ISNULL(tgt.VisitFrequency, '') <> ISNULL(f.Freq, '') COLLATE SQL_Latin1_General_CP1_CI_AS
      );

    -- Insert new versions: brand-new customers, and customers just closed out above.
    INSERT INTO dim.Dim_Customer (
        CustomerCode, CustomerName, TaxId, LegalEntityRIF, IsSpecialTaxpayer, CreditLimit, CreditLimitCurrencyCode,
        ZoneCode, SegmentCode, ErpSegmentCode, DefaultSalesRepCode, IsLegalEntity, IsInactive, MatrizCode,
        RegisteredDate, IsMigrationBatch, VisitFrequency, ValidFrom, ValidTo, IsCurrent
    )
    SELECT
        RTRIM(src.co_cli), src.cli_des, src.rif, src.rif, ISNULL(src.contrib, 0), src.mont_cre, src.co_mone,
        src.co_zon, seg.seg_des, RTRIM(src.co_seg), src.co_ven, ISNULL(src.juridico, 0), ISNULL(src.inactivo, 0),
        NULLIF(RTRIM(src.matriz), ''),
        CAST(src.fecha_reg AS date), CASE WHEN CAST(src.fecha_reg AS date) = @CutoverDate THEN 1 ELSE 0 END, f.Freq,
        @Now, NULL, 1
    FROM Ncake_a.dbo.saCliente src
    LEFT JOIN Ncake_a.dbo.saSegmento seg ON RTRIM(seg.co_seg) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(src.co_seg) COLLATE SQL_Latin1_General_CP1_CI_AS
    OUTER APPLY (
        SELECT CASE WHEN UPPER(LTRIM(RTRIM(src.frecu_vist))) IN ('SEMANAL', 'QUINCENAL', 'MENSUAL')
                    THEN UPPER(LTRIM(RTRIM(src.frecu_vist))) END AS Freq
    ) f
    WHERE src.validador > @Watermark
      AND NOT EXISTS (
          SELECT 1 FROM dim.Dim_Customer tgt
          WHERE RTRIM(tgt.CustomerCode) = RTRIM(src.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS AND tgt.IsCurrent = 1
      );

    -- Keep MatrizCode in sync in place, unconditionally, every run -- see 0030.
    UPDATE tgt
    SET tgt.MatrizCode = NULLIF(RTRIM(src.matriz), '')
    FROM dim.Dim_Customer tgt
    INNER JOIN Ncake_a.dbo.saCliente src ON RTRIM(src.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(tgt.CustomerCode)
    WHERE tgt.IsCurrent = 1
      AND ISNULL(RTRIM(tgt.MatrizCode), '') <> ISNULL(RTRIM(src.matriz), '') COLLATE SQL_Latin1_General_CP1_CI_AS;

    -- Keep ErpSegmentCode in sync in place (same treatment as SegmentCode, which holds the resolved name).
    UPDATE tgt
    SET tgt.ErpSegmentCode = RTRIM(src.co_seg)
    FROM dim.Dim_Customer tgt
    INNER JOIN Ncake_a.dbo.saCliente src ON RTRIM(src.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(tgt.CustomerCode)
    WHERE tgt.IsCurrent = 1
      AND ISNULL(RTRIM(tgt.ErpSegmentCode), '') <> ISNULL(RTRIM(src.co_seg), '') COLLATE SQL_Latin1_General_CP1_CI_AS;

    -- Keep SegmentCode (resolved name) in sync in place, unconditionally, every run -- see 0031.
    UPDATE tgt
    SET tgt.SegmentCode = seg.seg_des
    FROM dim.Dim_Customer tgt
    INNER JOIN Ncake_a.dbo.saCliente src ON RTRIM(src.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(tgt.CustomerCode)
    LEFT JOIN Ncake_a.dbo.saSegmento seg ON RTRIM(seg.co_seg) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(src.co_seg) COLLATE SQL_Latin1_General_CP1_CI_AS
    WHERE tgt.IsCurrent = 1
      AND ISNULL(RTRIM(tgt.SegmentCode), '') <> ISNULL(RTRIM(seg.seg_des), '') COLLATE SQL_Latin1_General_CP1_CI_AS;

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(validador), @Watermark) FROM Ncake_a.dbo.saCliente;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saCliente';
END
GO

-- One-time backfill of rows that predate this migration (current AND historical): they cannot be reached by
-- the watermark-gated diff above. Applies today's ERP value uniformly across a customer's versions.
-- Without it, the first post-0040 load would see NULL vs the ERP value on every current row and mint a new
-- SCD2 version for every customer the next time its validador moved.
DECLARE @CutoverDate date = '2026-03-28';
UPDATE tgt
SET tgt.RegisteredDate = CAST(src.fecha_reg AS date),
    tgt.IsMigrationBatch = CASE WHEN CAST(src.fecha_reg AS date) = @CutoverDate THEN 1 ELSE 0 END,
    tgt.VisitFrequency = CASE WHEN UPPER(LTRIM(RTRIM(src.frecu_vist))) IN ('SEMANAL', 'QUINCENAL', 'MENSUAL')
                              THEN UPPER(LTRIM(RTRIM(src.frecu_vist))) END
FROM dim.Dim_Customer tgt
INNER JOIN Ncake_a.dbo.saCliente src ON RTRIM(src.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(tgt.CustomerCode)
WHERE tgt.RegisteredDate IS NULL;

UPDATE tgt
SET tgt.ErpSegmentCode = RTRIM(src.co_seg)
FROM dim.Dim_Customer tgt
INNER JOIN Ncake_a.dbo.saCliente src ON RTRIM(src.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(tgt.CustomerCode)
WHERE tgt.ErpSegmentCode IS NULL;
GO
