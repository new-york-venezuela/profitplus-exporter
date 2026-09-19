-- Checks whether the ERP's AR source tables (saDocumentoVenta = invoices,
-- saCobro = collections/payments) are still actively syncing, to explain a
-- suspiciously high "% vencido" on the CxC tab (app/api/dwh/cxc/route.ts).
--
-- Context: fact.Fact_AR_Snapshot is a periodic point-in-time snapshot of
-- open balances, computed from these two ERP tables. If either table stops
-- receiving new rows (an ETL/sync gap, or the ERP itself not being used),
-- open invoices age past their due date with no new payments ever landing
-- to shrink them, so the aging buckets skew almost entirely into "vencido"
-- even though real-world collections may be happening fine. Verified locally
-- 2026-09-19: max fec_venc was 2026-07-29, max saCobro.fecha was 2026-07-10,
-- but the snapshot itself had run as recently as 2026-09-16 — i.e. the
-- snapshot job was fresh, but its two source tables were ~2 months stale.
-- Run this against the same server/database the DWH's ETL reads from
-- (Ncake_a in dwh-migrations/0012_fact_ar_snapshot.sql and 0011_fact_collections.sql).
--
-- How to read the result:
--   - DiasSinFacturarNuevo / DiasSinCobrarNuevo small (a few days): the
--     data is fresh, so a high "% vencido" reading elsewhere reflects a
--     different, local environment/data-load state, not production.
--   - Both large (weeks/months): production's own invoicing/collections
--     feed is stale — that's an ETL/ops issue upstream of this dashboard,
--     not a bug in the CxC aging query itself.
SELECT
  (SELECT MAX(fec_venc) FROM saDocumentoVenta WHERE ISNULL(anulado, 0) = 0) AS UltimaFacturaVencimiento,
  (SELECT MAX(fec_emis) FROM saDocumentoVenta WHERE ISNULL(anulado, 0) = 0) AS UltimaFacturaEmision,
  (SELECT MAX(c.fecha) FROM saCobro c WHERE ISNULL(c.anulado, 0) = 0) AS UltimoCobro,
  GETDATE() AS FechaActual,
  DATEDIFF(day, (SELECT MAX(fec_emis) FROM saDocumentoVenta WHERE ISNULL(anulado, 0) = 0), GETDATE()) AS DiasSinFacturarNuevo,
  DATEDIFF(day, (SELECT MAX(c.fecha) FROM saCobro c WHERE ISNULL(c.anulado, 0) = 0), GETDATE()) AS DiasSinCobrarNuevo;
