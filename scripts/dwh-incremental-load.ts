import sql from 'mssql';

import {
    dwhDatabaseName,
    buildConfig, runDwhMigrations,
} from './migrate-dwh';
import { loadRecipeCostSnapshots } from './dwh-recipe-cost-load';
import { getDb } from '@/lib/db/sqlite';
import { getPool } from '@/lib/db/mssql';
import { INCREMENTAL_LOAD } from '@/lib/dwh/incremental-load-sql';
import { reconcileOrphanFacts } from './dwh-reconcile';

export { INCREMENTAL_LOAD };

async function main() {
    const pool = await new sql.ConnectionPool(buildConfig(dwhDatabaseName())).connect();

    try {
        // Runs before Load_Fact_Sales below: it's not one of the EXEC'd
        // stored procedures because it needs the app's own SQLite database
        // and a live FIFO cost walk (TypeScript), not just Ncake_a — see
        // migrations/dwh/0037_stg_recipe_cost_snapshot.sql. It also runs
        // dwh.Backfill_Fact_Sales_RecipeCost itself, so cost columns on
        // already-loaded historical sales stay in sync too, not just new ones.
        const erpPool = await getPool();
        await loadRecipeCostSnapshots({ sqliteDb: getDb(), erpPool, dwhPool: pool });

        await pool.request().batch(INCREMENTAL_LOAD);

        // Drop fact lines whose document was deleted/renumbered in the ERP (the loads
        // are MERGEs without a delete path). Not part of INCREMENTAL_LOAD on purpose:
        // that batch is also reused by the customer-mapping restate, which must not
        // fail on the orphan guard. Throws (job fails, nothing deleted) past the guard.
        const report = await reconcileOrphanFacts(pool, { apply: true });
        for (const r of report) {
            if (r.OrphanLines > 0) console.log(`Reconciled ${r.OrphanLines} orphan line(s) from ${r.FactTable}`);
        }
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
