-- Bug found live 2026-09-22 while implementing the Depth of Line analytics
-- tab (docs/superpowers/specs/2026-09-21-profundidad-linea-tab-design.md):
-- Load_Dim_Customer (0005, redefined by 0014 and 0030) writes
-- dim.Dim_Customer.SegmentCode as the raw saCliente.co_seg code (e.g.
-- '46', '0023') rather than resolving it through saSegmento.seg_des to
-- the human-readable name ('CADENA', 'INDEPENDIENTES'). The Depth of Line
-- spec was designed against a live query directly on saCliente/saSegmento
-- in the ERP, which correctly resolves the join -- the spec's "verified
-- live" segment values are real, but Load_Dim_Customer never performs that
-- same join, so the DWH's copy of SegmentCode has never matched what every
-- consumer (this migration's own column name, the Depth of Line spec, and
-- any future segment-based feature) expects it to hold.
--
-- Confirmed live 2026-09-22 against DWH_AlimentosNY: every current
-- Dim_Customer row's SegmentCode holds '46' or '0023' (verbatim
-- saCliente.co_seg), and saSegmento resolves '46' -> 'CADENA',
-- '0023' -> 'INDEPENDIENTES' -- exactly the two segments the ERP-side
-- verification found, just never carried through the DWH load.
--
-- Per user direction (2026-09-22): this is a data-correction fix, not an
-- SCD2-tracked attribute change -- every row's SegmentCode (current AND
-- historical/non-current) should be corrected to the resolved name, and
-- kept in sync going forward via unconditional in-place UPDATE, the same
-- treatment MatrizCode got in 0030. A real segment reassignment on an
-- active customer should NOT mint a new Dim_Customer version -- it's a
-- correction to what the field always should have held, not a new fact
-- about the customer's history.
--
-- Fix: widen SegmentCode from char(6) (sized for the raw co_seg code) to
-- varchar(60) (matching saSegmento.seg_des's own width -- 'INDEPENDIENTES'
-- alone is 14 characters, already wider than the old char(6) column, which
-- would have silently truncated it); redefine Load_Dim_Customer to drop
-- SegmentCode from the SCD2 change-detection diff (same treatment as
-- MatrizCode) and instead keep it in sync via an unconditional in-place
-- UPDATE against every CURRENT row, every run; and one-time-backfill
-- SegmentCode for every existing row -- current and historical alike --
-- by resolving each row's stored raw code through saSegmento.

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dim.Dim_Customer') AND name = 'SegmentCode' AND max_length = 6
)
    ALTER TABLE dim.Dim_Customer ALTER COLUMN SegmentCode varchar(60) NULL;
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_Customer
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saCliente');
    DECLARE @NewWatermark binary(8);
    DECLARE @Now datetime2(3) = SYSUTCDATETIME();
    DECLARE @RowCount int;

    -- Close out current versions whose source row changed (SegmentCode NOT
    -- part of this diff -- see comment above; a segment correction/change
    -- never versions the row, same as MatrizCode).
    UPDATE tgt
    SET tgt.ValidTo = @Now, tgt.IsCurrent = 0
    FROM dim.Dim_Customer tgt
    INNER JOIN Ncake_a.dbo.saCliente src ON RTRIM(src.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(tgt.CustomerCode)
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
         -- MatrizCode and SegmentCode intentionally excluded -- see 0030
         -- and this migration's header comment. Neither is ever a reason
         -- to close out/version a Dim_Customer row.
      );

    -- Insert new versions: brand-new customers, and customers just closed
    -- out above. SegmentCode is resolved through saSegmento here too, so a
    -- brand-new row is never inserted with the raw code in the first place.
    INSERT INTO dim.Dim_Customer (
        CustomerCode, CustomerName, TaxId, LegalEntityRIF, IsSpecialTaxpayer, CreditLimit, CreditLimitCurrencyCode,
        ZoneCode, SegmentCode, DefaultSalesRepCode, IsLegalEntity, IsInactive, MatrizCode, ValidFrom, ValidTo, IsCurrent
    )
    SELECT
        RTRIM(src.co_cli), src.cli_des, src.rif, src.rif, ISNULL(src.contrib, 0), src.mont_cre, src.co_mone,
        src.co_zon, seg.seg_des, src.co_ven, ISNULL(src.juridico, 0), ISNULL(src.inactivo, 0),
        NULLIF(RTRIM(src.matriz), ''), @Now, NULL, 1
    FROM Ncake_a.dbo.saCliente src
    LEFT JOIN Ncake_a.dbo.saSegmento seg ON RTRIM(seg.co_seg) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(src.co_seg) COLLATE SQL_Latin1_General_CP1_CI_AS
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

    -- Keep SegmentCode in sync in place, unconditionally, every run -- same
    -- treatment as MatrizCode above, per this migration's header comment.
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

-- One-time correction: resolve SegmentCode for EVERY Dim_Customer row --
-- current and historical/non-current alike -- that still holds a raw
-- co_seg code instead of the resolved name. Matched by CustomerCode back
-- to the live ERP customer (every Dim_Customer row, current or not, still
-- corresponds to exactly one saCliente row by CustomerCode -- SCD2
-- versioning creates multiple Dim_Customer rows per customer over time,
-- never multiple saCliente rows), then resolved through saSegmento using
-- THAT CUSTOMER'S CURRENT co_seg. This intentionally applies today's
-- segment resolution uniformly across a customer's full history rather
-- than trying to reconstruct what segment they were in at each past
-- ValidFrom/ValidTo window -- Profit Plus keeps no history of co_seg
-- changes to reconstruct that from, and per user direction this is a data
-- correction (fixing what the field should always have held), not an
-- attempt at point-in-time historical accuracy.
UPDATE tgt
SET tgt.SegmentCode = seg.seg_des
FROM dim.Dim_Customer tgt
INNER JOIN Ncake_a.dbo.saCliente src ON RTRIM(src.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(tgt.CustomerCode)
LEFT JOIN Ncake_a.dbo.saSegmento seg ON RTRIM(seg.co_seg) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(src.co_seg) COLLATE SQL_Latin1_General_CP1_CI_AS
WHERE ISNULL(RTRIM(tgt.SegmentCode), '') <> ISNULL(RTRIM(seg.seg_des), '') COLLATE SQL_Latin1_General_CP1_CI_AS;
GO
