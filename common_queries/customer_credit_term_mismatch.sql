-- Tests the hypothesis: are open FACT invoices with fec_venc == fec_emis
-- (found via common_queries/ar_aging_bucket_audit.sql: 376 of 456 open FACT
-- invoices, ~82%) actually genuine Contado sales, or are they credit
-- customers who got invoiced as Contado because saFacturaVenta.co_cond
-- didn't pick up the customer's real default (saCliente.cond_pag /
-- plaz_pag)?
--
-- Mechanism (confirmed via profit-plus-knowledge-base MCP):
--   - saCondicionPago.dias_cred = days added to fec_emis to compute the
--     default fec_venc for ANY commercial document (factura, pedido, etc).
--     co_cond = '000001' = "Contado", dias_cred = 0 — by design, a Contado
--     invoice is SUPPOSED to have fec_venc == fec_emis. That is correct
--     aging behavior, not a bug, for a genuinely cash-basis sale.
--   - saCliente.cond_pag / saCliente.plaz_pag = the CUSTOMER's own default
--     credit terms (e.g. 30 días).
--   - saFacturaVenta.co_cond = the condición de pago actually recorded on
--     THAT invoice — can be overridden per-document, but should normally
--     match the customer's saCliente.cond_pag unless someone deliberately
--     picked something else at billing time.
--
-- So the bug (if it exists) is invoices where co_cond ('000001'/Contado)
-- does NOT match the customer's saCliente.cond_pag (a real credit term) —
-- i.e. the invoice was billed as Contado despite the customer being set up
-- for credit. Run against the ERP database (Ncake_a).

-- 1) Per-customer: how many of their open FACT invoices are Contado
-- (co_cond = '000001' via fec_venc == fec_emis proxy) vs. their own
-- saCliente default credit terms — ordered by amount at risk, to prioritize
-- which customers to check/fix first.
SELECT
  d.co_cli,
  c.cli_des,
  c.cond_pag AS ClienteCondPagDefault,
  c.plaz_pag AS ClientePlazoPagoDias,
  cp.cond_des AS ClienteCondPagDescripcion,
  COUNT(*) AS FacturasAbiertasContadoAparente,
  SUM(d.saldo) AS SaldoAfectado
FROM saDocumentoVenta d
INNER JOIN saCliente c ON c.co_cli = d.co_cli
LEFT JOIN saCondicionPago cp ON cp.co_cond = c.cond_pag
WHERE d.anulado = 0
  AND d.saldo <> 0
  AND d.co_tipo_doc = 'FACT'
  AND d.fec_venc = d.fec_emis          -- looks like Contado (0-day term)
  AND c.cond_pag <> '000001'           -- but the CUSTOMER's default is NOT Contado
GROUP BY d.co_cli, c.cli_des, c.cond_pag, c.plaz_pag, cp.cond_des
ORDER BY SaldoAfectado DESC;

-- 2) Confirms the invoice-level co_cond actually used, cross-referenced
-- against the customer's default, for the same suspect population — this
-- is the row-level evidence (needs saFacturaVenta, which carries co_cond;
-- saDocumentoVenta itself doesn't expose it per the schema in
-- docs/tables/saDocumentoVenta.md).
SELECT
  fv.doc_num,
  fv.co_cli,
  c.cli_des,
  fv.co_cond AS FacturaCondPag,
  c.cond_pag AS ClienteCondPagDefault,
  fv.fec_emis,
  fv.fec_venc,
  fv.total_neto,
  d.saldo
FROM saFacturaVenta fv
INNER JOIN saCliente c ON c.co_cli = fv.co_cli
INNER JOIN saDocumentoVenta d ON d.co_tipo_doc = 'FACT' AND d.nro_doc = fv.doc_num
WHERE fv.anulado = 0
  AND d.saldo <> 0
  AND fv.co_cond <> c.cond_pag         -- invoice's condición de pago disagrees with the customer's default
ORDER BY d.saldo DESC;

-- 3) Summary: total exposure if the mismatch hypothesis is confirmed —
-- how much of the "vencido" balance would move to Current/a real aging
-- bucket if these invoices' fec_venc were corrected to the customer's
-- actual credit terms.
SELECT
  COUNT(*) AS FacturasSospechosas,
  SUM(d.saldo) AS SaldoTotalSospechoso
FROM saDocumentoVenta d
INNER JOIN saCliente c ON c.co_cli = d.co_cli
WHERE d.anulado = 0
  AND d.saldo <> 0
  AND d.co_tipo_doc = 'FACT'
  AND d.fec_venc = d.fec_emis
  AND c.cond_pag <> '000001';
