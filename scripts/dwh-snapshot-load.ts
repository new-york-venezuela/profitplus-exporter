import sql from 'mssql';

import {
    dwhDatabaseName,
    buildConfig, runDwhMigrations,
} from './migrate-dwh';

const SNAPSHOT_LOAD = `
EXEC dwh.Snapshot_Fact_AR;
`;

async function main() {
    const pool = await new sql.ConnectionPool(buildConfig(dwhDatabaseName())).connect();

    try {
        await pool.request().batch(SNAPSHOT_LOAD);
    } finally {
        await pool.close();
    }
}

if (import.meta.main) {
    main()
        .then(() => {
            console.log("Snapshot Load ran successfully");
        })
        .catch(error => {
            console.error('✗ Error aplicando migraciones:', error);
            process.exit(1);
        });
}
