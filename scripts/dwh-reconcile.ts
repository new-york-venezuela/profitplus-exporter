import sql from 'mssql';

import { dwhDatabaseName, buildConfig } from './migrate-dwh';

export interface ReconcileRow {
    FactTable: string;
    FactRows: number;
    OrphanLines: number;
    OrphanDocuments: number;
    OrphanNetAmount: number;
    OrphanPercent: number;
    SourceRows: number;
    Blocked: boolean;
}

// Wraps dwh.Reconcile_Orphan_Facts (migrations/dwh/0041). Dry run unless apply.
export async function reconcileOrphanFacts(
    pool: sql.ConnectionPool,
    opts: { apply: boolean; maxOrphanPercent?: number },
): Promise<ReconcileRow[]> {
    const req = pool.request().input('Apply', sql.Bit, opts.apply);
    if (opts.maxOrphanPercent !== undefined) {
        req.input('MaxOrphanPercent', sql.Decimal(5, 2), opts.maxOrphanPercent);
    }
    const res = await req.execute('dwh.Reconcile_Orphan_Facts');
    return res.recordset as ReconcileRow[];
}

// bun run dwh:reconcile [-- --apply] [--max-percent <n>]
async function main() {
    const args = process.argv.slice(2);
    const apply = args.includes('--apply');
    const i = args.indexOf('--max-percent');
    const maxOrphanPercent = i >= 0 ? Number(args[i + 1]) : undefined;
    if (maxOrphanPercent !== undefined && !Number.isFinite(maxOrphanPercent)) {
        console.error('--max-percent needs a number');
        process.exit(2);
    }

    const pool = await new sql.ConnectionPool(buildConfig(dwhDatabaseName())).connect();
    try {
        const rows = await reconcileOrphanFacts(pool, { apply, maxOrphanPercent });
        console.table(rows);
        console.log(apply ? 'Applied (deleted rows are in dwh.ReconcileLog).' : 'Dry run: nothing deleted. Re-run with --apply.');
    } finally {
        await pool.close();
    }
}

if (import.meta.main) {
    main().then(() => process.exit(0)).catch(error => {
        console.error('✗ Reconcile failed:', error.message ?? error);
        process.exit(1);
    });
}
