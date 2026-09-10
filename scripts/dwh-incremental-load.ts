import sql from 'mssql';

import {
    dwhDatabaseName,
    buildConfig, runDwhMigrations,
} from './migrate-dwh';

const INCREMENTAL_LOAD = `
EXEC dwh.Load_Dim_Currency;
EXEC dwh.Load_Fact_ExchangeRate;
EXEC dwh.Load_Dim_Customer;
EXEC dwh.Load_Dim_Product;
EXEC dwh.Load_Dim_SalesRep;
EXEC dwh.Load_Dim_Warehouse;
EXEC dwh.Load_Fact_Sales;
EXEC dwh.Load_Fact_Returns;
EXEC dwh.Load_Fact_Collections;
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
