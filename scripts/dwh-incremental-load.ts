import sql from 'mssql';

import {
    dwhDatabaseName,
    buildConfig, runDwhMigrations,
} from './migrate-dwh';

// Ordering note: this script runs all dimension loads, then all fact loads
// (dims-then-facts) — the only ordering requirement is that every fact's
// prerequisite dimension(s) load before that fact does. (An earlier SQL
// Agent job used a different, interleaved ordering; that job was removed —
// see git history, "Remove job agents" — this script is now the only
// scheduled/automatable load path.)
const INCREMENTAL_LOAD = `
EXEC dwh.Load_Dim_Currency;
EXEC dwh.Load_Fact_ExchangeRate;
EXEC dwh.Load_Dim_Customer;
EXEC dwh.Load_Dim_LegalEntity;
EXEC dwh.Load_Dim_Product;
EXEC dwh.Load_Dim_SalesRep;
EXEC dwh.Load_Dim_Warehouse;
EXEC dwh.Load_Dim_ExpenseConcept;
EXEC dwh.Load_Dim_Supplier;
EXEC dwh.Load_Fact_Sales;
EXEC dwh.Load_Fact_Returns;
EXEC dwh.Load_Fact_Collections;
EXEC dwh.Load_Fact_CashMovements;
EXEC dwh.Load_Fact_Purchases;
`;

async function main() {
    const pool = await new sql.ConnectionPool(buildConfig(dwhDatabaseName())).connect();

    try {
        await pool.request().batch(INCREMENTAL_LOAD);
    } finally {
        await pool.close();
    }
}

if (import.meta.main) {
    main()
        .then(() => {
            console.log("Incremental Load ran successfully");
        })
        .catch(error => {
            console.error('✗ Error aplicando migraciones:', error);
            process.exit(1);
        });
}
