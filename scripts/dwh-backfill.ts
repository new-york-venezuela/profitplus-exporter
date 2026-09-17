import sql from 'mssql';

import {
    dwhDatabaseName,
    buildConfig,
} from './migrate-dwh';

// Operational re-sync tool, not a migration. dwh-migrations/0028 and 0029
// fixed a one-time historical gap (rows loaded before MatrizCode/DueDateKey
// existed, stuck NULL forever because the incremental loaders are
// watermark-gated and never revisit an unchanged source row). Editing
// saCliente/saCobro/saDocumentoVenta going forward bumps their `validador`
// rowversion automatically, so dwh:incremental-load already picks up most
// changes on its own -- this script exists for the cases that don't:
//   - saCobroDocReng's watermark is fe_us_mo, an app-layer datetime the
//     README documents as "not guaranteed monotonic or gap-free" (unlike a
//     real rowversion) -- a receipt-detail change can in principle be missed
//     by the incremental load in a way a Dim_Customer change cannot.
//   - a fast, code-deploy-free lever if MatrizCode/LegalEntityKey/
//     DueDateKey ever look wrong in production and someone wants to force a
//     re-sync from source without waiting on/writing a new migration file.
// Both statements below are idempotent (re-sync on divergence from source,
// not just fill NULLs) and safe to run anytime, repeatedly, against a live
// database -- same as the incremental load itself.
const BACKFILL = `
UPDATE tgt
SET tgt.MatrizCode = NULLIF(RTRIM(src.matriz), '')
FROM dim.Dim_Customer tgt
INNER JOIN Ncake_a.dbo.saCliente src ON RTRIM(src.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(tgt.CustomerCode)
WHERE tgt.IsCurrent = 1
  AND ISNULL(RTRIM(tgt.MatrizCode), '') <> ISNULL(RTRIM(src.matriz), '') COLLATE SQL_Latin1_General_CP1_CI_AS;

EXEC dwh.Load_Dim_LegalEntity;

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
WHERE tgt.DueDateKey IS NULL OR tgt.DueDateKey <> dd.DateKey;
`;

async function main() {
    const pool = await new sql.ConnectionPool(buildConfig(dwhDatabaseName())).connect();

    try {
        await pool.request().batch(BACKFILL);
    } finally {
        await pool.close();
    }
}

if (import.meta.main) {
    main()
        .then(() => {
            console.log('DWH backfill ran successfully');
        })
        .catch(error => {
            console.error('✗ Error aplicando el backfill:', error);
            process.exit(1);
        });
}
