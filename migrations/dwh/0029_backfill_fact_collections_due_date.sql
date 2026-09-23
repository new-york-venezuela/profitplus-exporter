-- 0027_fact_collections_due_date.sql added Fact_Collections.DueDateKey and
-- wired it into Load_Fact_Collections going forward, but that procedure's
-- MERGE only touches a row when its source saCobroDocReng.fe_us_mo or
-- saCobro.validador has advanced past the stored watermark -- same
-- watermark-gated shape as the Dim_Customer.MatrizCode gap fixed by
-- 0028_backfill_matriz_code.sql. Every collection row already loaded before
-- 0027 shipped (and whose source row hasn't changed since) was left with
-- DueDateKey permanently NULL, no matter how many times the incremental
-- load runs. Since cxc's WEEKDAY_VENCIMIENTO_QUERY (app/api/dwh/cxc/route.ts)
-- filters WHERE DueDateKey IS NOT NULL, it was silently only ever seeing the
-- sliver of collections loaded after 0027 -- producing implausibly small
-- totals per weekday in production, e.g. a few dollars of "overdue invoices
-- paid on Wednesday" against months of real collections history.
--
-- This is a one-time correction of a load defect (backfilling data that
-- should have been set at original load time), not a new business-meaningful
-- change, so it updates fact.Fact_Collections in place. Mirrors 0027's own
-- dedup logic exactly: saDocumentoVenta.nro_doc is not unique on its own
-- (adjustment doc types can share a nro_doc with a different document), so
-- pick one row per nro_doc deterministically (most recent fec_venc) before
-- joining, same as Load_Fact_Collections does.
;WITH DedupedDocumentoVenta AS (
    SELECT nro_doc, fec_venc,
        ROW_NUMBER() OVER (PARTITION BY RTRIM(nro_doc) ORDER BY fec_venc DESC) AS rn
    FROM Ncake_a.dbo.saDocumentoVenta
)
UPDATE tgt
SET tgt.DueDateKey = dd.DateKey
FROM fact.Fact_Collections tgt
INNER JOIN DedupedDocumentoVenta dv ON RTRIM(dv.nro_doc) = RTRIM(tgt.InvoiceNumber) COLLATE SQL_Latin1_General_CP1_CI_AS AND dv.rn = 1
INNER JOIN dim.Dim_Date dd ON dd.DateKey = CONVERT(int, FORMAT(dv.fec_venc, 'yyyyMMdd'))
WHERE tgt.DueDateKey IS NULL;
GO
