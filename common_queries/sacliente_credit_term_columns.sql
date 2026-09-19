-- Lists saCliente's columns so we can find the customer's default
-- payment-term field (e.g. "días de crédito" / "plazo de pago" — a number
-- of days), which dim.Dim_Customer does NOT currently load (only mont_cre,
-- a credit LIMIT amount, via CreditLimit — see dwh-migrations/0005_dim_customer.sql).
--
-- Context: audited via common_queries/ar_aging_bucket_audit.sql that ~82%
-- of open FACT invoices have fec_venc == fec_emis (due date = issue date),
-- which ages them into "vencido" almost immediately. Suspected cause: these
-- customers aren't properly configured with credit terms in Profit Plus, so
-- new invoices default to a same-day/Contado due date instead of picking up
-- the customer's actual terms. Before writing a fix command that updates
-- fec_venc to match "the customer's default credit conditions", we need to
-- confirm such a field actually exists and is populated.
--
-- Run against the ERP database (Ncake_a).
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'saCliente'
ORDER BY ORDINAL_POSITION;

-- Also check saDocumentoVenta for a "payment condition" column that might
-- already carry a code (e.g. 'CONTADO' vs a credit-terms code) distinct
-- from co_tipo_doc — this would explain per-INVOICE (not just per-customer)
-- why fec_venc defaults to fec_emis.
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'saDocumentoVenta'
ORDER BY ORDINAL_POSITION;
