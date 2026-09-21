import sql from 'mssql';

import {
    dwhDatabaseName,
    buildConfig, runDwhMigrations,
} from './migrate-dwh';
import { loadRecipeCostSnapshots } from './dwh-recipe-cost-load';
import { getDb } from '@/lib/db/sqlite';
import { getPool } from '@/lib/db/mssql';

// Ordering note: this script runs all dimension loads, then all fact loads
// (dims-then-facts). The SQL Agent job built by dwh-migrations 0013/0015/
// 0016/0019/0022 instead interleaves dim/fact pairs in the order they were
// historically added (..., Collections, ExpenseConcept, Expenses, Supplier,
// Purchases). These two orderings are intentionally independent and are not
// meant to mirror each other — each is valid on its own terms as long as
// every fact's prerequisite dimension(s) load before that fact does. Do not
// "fix" one to match the other without re-checking both against their own
// dependency requirements.
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
        // Runs before Load_Fact_Sales below: it's not one of the EXEC'd
        // stored procedures because it needs the app's own SQLite database
        // and a live FIFO cost walk (TypeScript), not just Ncake_a — see
        // dwh-migrations/0031_stg_recipe_cost_snapshot.sql. It also runs
        // dwh.Backfill_Fact_Sales_RecipeCost itself, so cost columns on
        // already-loaded historical sales stay in sync too, not just new ones.
        const erpPool = await getPool();
        await loadRecipeCostSnapshots({ sqliteDb: getDb(), erpPool, dwhPool: pool });

        await pool.request().batch(INCREMENTAL_LOAD);
    } finally {
        await pool.close();
    }
}

if (import.meta.main) {
    main()
        .then(() => {
            console.log("Incremental Load ran successfully");
            process.exit(0);
        })
        .catch(error => {
            console.error('✗ Error aplicando migraciones:', error);
            process.exit(1);
        });
}
