-- Bug found live 2026-09-17: Load_Dim_Customer (0005, widened by 0014) treats
-- MatrizCode as an SCD2-tracked attribute exactly like CustomerName or
-- CreditLimit -- any change closes out the current Dim_Customer row and
-- inserts a new one with a brand-new CustomerKey. That's correct SCD2 for a
-- descriptive attribute, but MatrizCode isn't descriptive: it's the key
-- Dim_LegalEntity/LegalEntityKey depends on to give a chain's stores one
-- stable identity. Reproduced live: setting saCliente.matriz on an existing
-- customer and running the normal incremental load minted a new CustomerKey
-- and closed out the old one -- and since Load_Dim_LegalEntity's own
-- backfill step only ever touches IsCurrent = 1 rows, the closed-out row's
-- LegalEntityKey is frozen NULL forever. Every fact row still pointing at
-- that old CustomerKey (all of the customer's history up to that moment)
-- then silently drops out of every cliente_entidad-grouped report (its
-- INNER JOIN to Dim_LegalEntity never matches a NULL LegalEntityKey) --
-- $4.96M / 142 rows for the case this was caught on. New activity from that
-- point on posts under the new CustomerKey, permanently splitting even
-- cliente_tienda-grouped history across two keys for what is really the
-- same store account.
--
-- Part 1: stop MatrizCode from ever triggering SCD2 versioning. Redefine
-- Load_Dim_Customer to drop it from the change-detection/INSERT-new-version
-- path, and instead keep it in sync with an in-place UPDATE (same shape as
-- scripts/dwh-backfill.ts) that runs every time, unconditionally, not gated
-- by the validador watermark -- so a matriz edit is reflected on the very
-- next incremental load regardless of whether anything else on that
-- customer changed.
CREATE OR ALTER PROCEDURE dwh.Load_Dim_Customer
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saCliente');
    DECLARE @NewWatermark binary(8);
    DECLARE @Now datetime2(3) = SYSUTCDATETIME();
    DECLARE @RowCount int;

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
         OR ISNULL(RTRIM(tgt.SegmentCode), '') <> ISNULL(RTRIM(src.co_seg), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(RTRIM(tgt.DefaultSalesRepCode), '') <> ISNULL(RTRIM(src.co_ven), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.IsLegalEntity, 0) <> ISNULL(src.juridico, 0)
         OR ISNULL(tgt.IsInactive, 0) <> ISNULL(src.inactivo, 0)
         -- MatrizCode intentionally excluded -- see comment above. It is
         -- never a reason to close out/version a Dim_Customer row.
      );

    INSERT INTO dim.Dim_Customer (
        CustomerCode, CustomerName, TaxId, LegalEntityRIF, IsSpecialTaxpayer, CreditLimit, CreditLimitCurrencyCode,
        ZoneCode, SegmentCode, DefaultSalesRepCode, IsLegalEntity, IsInactive, MatrizCode, ValidFrom, ValidTo, IsCurrent
    )
    SELECT
        RTRIM(src.co_cli), src.cli_des, src.rif, src.rif, ISNULL(src.contrib, 0), src.mont_cre, src.co_mone,
        src.co_zon, src.co_seg, src.co_ven, ISNULL(src.juridico, 0), ISNULL(src.inactivo, 0),
        NULLIF(RTRIM(src.matriz), ''), @Now, NULL, 1
    FROM Ncake_a.dbo.saCliente src
    WHERE src.validador > @Watermark
      AND NOT EXISTS (
          SELECT 1 FROM dim.Dim_Customer tgt
          WHERE RTRIM(tgt.CustomerCode) = RTRIM(src.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS AND tgt.IsCurrent = 1
      );

    -- Keep MatrizCode in sync in place, unconditionally, every run --
    -- independent of @Watermark so a matriz-only edit is never missed
    -- regardless of whether any other tracked attribute also changed this
    -- run. Same statement scripts/dwh-backfill.ts runs manually; folded in
    -- here so it also happens automatically on every scheduled incremental
    -- load, not just when someone remembers to run the manual tool.
    UPDATE tgt
    SET tgt.MatrizCode = NULLIF(RTRIM(src.matriz), '')
    FROM dim.Dim_Customer tgt
    INNER JOIN Ncake_a.dbo.saCliente src ON RTRIM(src.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(tgt.CustomerCode)
    WHERE tgt.IsCurrent = 1
      AND ISNULL(RTRIM(tgt.MatrizCode), '') <> ISNULL(RTRIM(src.matriz), '') COLLATE SQL_Latin1_General_CP1_CI_AS;

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(validador), @Watermark) FROM Ncake_a.dbo.saCliente;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saCliente';
END
GO

-- Part 2: one-time repair of customers already split by this bug. A
-- CustomerCode with more than one Dim_Customer row is only safe to collapse
-- automatically when every version is identical except MatrizCode/
-- ValidFrom/ValidTo/IsCurrent/LegalEntityKey/CustomerKey/LoadedAtUtc -- i.e.
-- the ONLY reason it was ever versioned was this bug, not a genuine
-- attribute change that happened to land in the same or a different run.
-- Anything else (a real name/credit-limit/etc. change bundled with a matriz
-- change) is left untouched for manual review rather than guessed at.
IF OBJECT_ID('tempdb..#SplitCustomers') IS NOT NULL DROP TABLE #SplitCustomers;

SELECT
    RTRIM(CustomerCode) AS CustomerCode,
    MIN(CustomerKey) AS AnyKey -- just to drive the safety check below per-code
INTO #SplitCustomers
FROM dim.Dim_Customer
GROUP BY RTRIM(CustomerCode)
HAVING COUNT(*) > 1;

IF OBJECT_ID('tempdb..#SafeToMerge') IS NOT NULL DROP TABLE #SafeToMerge;

-- A CustomerCode is safe to merge only if it has exactly one IsCurrent=1
-- row, and every non-current row's tracked attributes (everything
-- Load_Dim_Customer's SCD2 diff compares, excluding MatrizCode itself)
-- match that current row's exactly.
SELECT sc.CustomerCode
INTO #SafeToMerge
FROM #SplitCustomers sc
WHERE (SELECT COUNT(*) FROM dim.Dim_Customer c WHERE RTRIM(c.CustomerCode) = sc.CustomerCode AND c.IsCurrent = 1) = 1
  AND NOT EXISTS (
        SELECT 1
        FROM dim.Dim_Customer old
        CROSS JOIN (
            SELECT TOP 1 * FROM dim.Dim_Customer cur
            WHERE RTRIM(cur.CustomerCode) = sc.CustomerCode AND cur.IsCurrent = 1
        ) cur
        WHERE RTRIM(old.CustomerCode) = sc.CustomerCode
          AND old.IsCurrent = 0
          AND (
                ISNULL(old.CustomerName, '') <> ISNULL(cur.CustomerName, '')
             OR ISNULL(old.TaxId, '') <> ISNULL(cur.TaxId, '')
             OR ISNULL(old.LegalEntityRIF, '') <> ISNULL(cur.LegalEntityRIF, '')
             OR ISNULL(old.IsSpecialTaxpayer, 0) <> ISNULL(cur.IsSpecialTaxpayer, 0)
             OR ISNULL(old.CreditLimit, -1) <> ISNULL(cur.CreditLimit, -1)
             OR ISNULL(RTRIM(old.CreditLimitCurrencyCode), '') <> ISNULL(RTRIM(cur.CreditLimitCurrencyCode), '')
             OR ISNULL(RTRIM(old.ZoneCode), '') <> ISNULL(RTRIM(cur.ZoneCode), '')
             OR ISNULL(RTRIM(old.SegmentCode), '') <> ISNULL(RTRIM(cur.SegmentCode), '')
             OR ISNULL(RTRIM(old.DefaultSalesRepCode), '') <> ISNULL(RTRIM(cur.DefaultSalesRepCode), '')
             OR ISNULL(old.IsLegalEntity, 0) <> ISNULL(cur.IsLegalEntity, 0)
             OR ISNULL(old.IsInactive, 0) <> ISNULL(cur.IsInactive, 0)
          )
      );

-- Re-point every fact row from each safe-to-merge customer's old (now
-- non-current) CustomerKey(s) to its single surviving current CustomerKey,
-- across every fact table that carries CustomerKey, then delete the
-- orphaned old Dim_Customer row(s). Safe because #SafeToMerge already
-- guaranteed there is exactly one current row and every old row is an
-- attribute-for-attribute match of it.
UPDATE f
SET f.CustomerKey = cur.CustomerKey
FROM fact.Fact_Sales f
JOIN dim.Dim_Customer old ON old.CustomerKey = f.CustomerKey AND old.IsCurrent = 0
JOIN #SafeToMerge sm ON sm.CustomerCode = RTRIM(old.CustomerCode)
JOIN dim.Dim_Customer cur ON RTRIM(cur.CustomerCode) = sm.CustomerCode AND cur.IsCurrent = 1;

UPDATE f
SET f.CustomerKey = cur.CustomerKey
FROM fact.Fact_Returns f
JOIN dim.Dim_Customer old ON old.CustomerKey = f.CustomerKey AND old.IsCurrent = 0
JOIN #SafeToMerge sm ON sm.CustomerCode = RTRIM(old.CustomerCode)
JOIN dim.Dim_Customer cur ON RTRIM(cur.CustomerCode) = sm.CustomerCode AND cur.IsCurrent = 1;

UPDATE f
SET f.CustomerKey = cur.CustomerKey
FROM fact.Fact_Collections f
JOIN dim.Dim_Customer old ON old.CustomerKey = f.CustomerKey AND old.IsCurrent = 0
JOIN #SafeToMerge sm ON sm.CustomerCode = RTRIM(old.CustomerCode)
JOIN dim.Dim_Customer cur ON RTRIM(cur.CustomerCode) = sm.CustomerCode AND cur.IsCurrent = 1;

UPDATE f
SET f.CustomerKey = cur.CustomerKey
FROM fact.Fact_AR_Snapshot f
JOIN dim.Dim_Customer old ON old.CustomerKey = f.CustomerKey AND old.IsCurrent = 0
JOIN #SafeToMerge sm ON sm.CustomerCode = RTRIM(old.CustomerCode)
JOIN dim.Dim_Customer cur ON RTRIM(cur.CustomerCode) = sm.CustomerCode AND cur.IsCurrent = 1;

DELETE old
FROM dim.Dim_Customer old
JOIN #SafeToMerge sm ON sm.CustomerCode = RTRIM(old.CustomerCode)
WHERE old.IsCurrent = 0;

DROP TABLE #SafeToMerge;
DROP TABLE #SplitCustomers;
GO

-- Resolve LegalEntityKey for the now-merged current rows (their MatrizCode
-- may already be correct, but LegalEntityKey wasn't recomputed above).
EXEC dwh.Load_Dim_LegalEntity;
GO
