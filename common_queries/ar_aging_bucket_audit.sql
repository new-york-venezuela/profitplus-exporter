-- Audits WHY the CxC tab's "% vencido" is ~85% even though
-- common_queries/ar_data_freshness_check.sql confirmed production's
-- invoicing/collections feed is fresh (invoices and payments both landed
-- yesterday). With freshness ruled out, this checks whether the aging
-- classification itself (dwh-migrations/0012_fact_ar_snapshot.sql's
-- AgingBucket CASE, mirrored in app/api/dwh/cxc/route.ts's overdueShare)
-- is being fed a `fec_venc` (due date) that doesn't behave like a real
-- credit-term due date for some/most document types — e.g. cash-basis
-- documents where fec_venc == fec_emis would look "vencido" almost
-- immediately, well before anyone would consider them actually overdue.
--
-- Run each SELECT below against the SAME database the DWH's ETL reads
-- from (Ncake_a, per dwh-migrations/0012_fact_ar_snapshot.sql /
-- 0011_fact_collections.sql) — i.e. production's ERP database, not the DWH.
--
-- What to look for in each result set:
--   1) CreditTermDays distribution: if most rows show 0 (or a small/negative
--      number), fec_venc is effectively "due on the emission date" for a
--      large chunk of invoices — that alone would explain a high "vencido"
--      rate even on brand-new invoices, and would point to a document-type
--      that needs different treatment (e.g. a cash/contado series that
--      shouldn't be aged like a credit invoice at all, or should be
--      excluded/bucketed as "Current" regardless of fec_venc).
--   2) TipoDoc breakdown: confirms whether any co_tipo_doc besides
--      N/CR/NCR should also be excluded (or specially handled) in the
--      AgingBucket CASE — currently only N/CR/NCR are excluded.
--   3) Live bucket distribution: recomputes the aging buckets directly
--      from today's ERP data (bypassing the DWH snapshot entirely) — if
--      this also shows ~85% non-Current, the bug (if any) is in the
--      fec_venc data/semantics, not in the DWH load or the dashboard's
--      overdueShare math. If this shows a LOW overdue rate instead, the
--      bug is downstream — in the snapshot load or in the app route.
--   4) Recent invoices sample: sanity-check individual rows — do
--      yesterday's brand-new invoices already show DaysPastDue > 0?

-- 1) Credit term distribution (fec_venc - fec_emis), by document type
SELECT
  DATEDIFF(day, fec_emis, fec_venc) AS CreditTermDays,
  RTRIM(co_tipo_doc) AS TipoDoc,
  COUNT(*) AS n,
  SUM(saldo) AS TotalSaldo
FROM saDocumentoVenta
WHERE ISNULL(anulado, 0) = 0 AND saldo <> 0
GROUP BY DATEDIFF(day, fec_emis, fec_venc), RTRIM(co_tipo_doc)
ORDER BY n DESC;

-- 2) All distinct document types on open balances
SELECT
  RTRIM(co_tipo_doc) AS TipoDoc,
  COUNT(*) AS n,
  SUM(saldo) AS TotalSaldo,
  MIN(fec_emis) AS MinEmis,
  MAX(fec_emis) AS MaxEmis
FROM saDocumentoVenta
WHERE ISNULL(anulado, 0) = 0 AND saldo <> 0
GROUP BY RTRIM(co_tipo_doc)
ORDER BY TotalSaldo DESC;

-- 3) Live aging bucket distribution, recomputed straight from saDocumentoVenta
-- (same CASE as dwh-migrations/0012_fact_ar_snapshot.sql, evaluated against
-- GETDATE() instead of a stored snapshot date)
SELECT
  CASE
    WHEN RTRIM(co_tipo_doc) IN ('N/CR', 'NCR') THEN 'N/A'
    WHEN DATEDIFF(day, fec_venc, GETDATE()) <= 0 THEN 'Current'
    WHEN DATEDIFF(day, fec_venc, GETDATE()) BETWEEN 1 AND 30 THEN '1-30'
    WHEN DATEDIFF(day, fec_venc, GETDATE()) BETWEEN 31 AND 60 THEN '31-60'
    WHEN DATEDIFF(day, fec_venc, GETDATE()) BETWEEN 61 AND 90 THEN '61-90'
    ELSE '>90'
  END AS Bucket,
  COUNT(*) AS n,
  SUM(saldo) AS TotalSaldo
FROM saDocumentoVenta
WHERE ISNULL(anulado, 0) = 0 AND saldo <> 0
GROUP BY CASE
    WHEN RTRIM(co_tipo_doc) IN ('N/CR', 'NCR') THEN 'N/A'
    WHEN DATEDIFF(day, fec_venc, GETDATE()) <= 0 THEN 'Current'
    WHEN DATEDIFF(day, fec_venc, GETDATE()) BETWEEN 1 AND 30 THEN '1-30'
    WHEN DATEDIFF(day, fec_venc, GETDATE()) BETWEEN 31 AND 60 THEN '31-60'
    WHEN DATEDIFF(day, fec_venc, GETDATE()) BETWEEN 61 AND 90 THEN '61-90'
    ELSE '>90'
  END;

-- 4) The 15 most recently emitted open invoices, with computed DaysPastDue
SELECT TOP 15
  nro_doc, RTRIM(co_tipo_doc) AS TipoDoc, fec_emis, fec_venc, saldo,
  DATEDIFF(day, fec_venc, GETDATE()) AS DaysPastDue
FROM saDocumentoVenta
WHERE ISNULL(anulado, 0) = 0 AND saldo <> 0
ORDER BY fec_emis DESC;
