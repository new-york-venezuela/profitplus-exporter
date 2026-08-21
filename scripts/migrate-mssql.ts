import sql from 'mssql';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(import.meta.dir, '..', 'mssql-migrations');

function buildConfig(): sql.config {
  return {
    server: process.env.DB_SERVER!,
    port: parseInt(process.env.DB_PORT ?? '1433'),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
    },
  };
}

async function ensureTrackingTableExists(pool: sql.ConnectionPool): Promise<void> {
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__exporter_migrations' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
        CREATE TABLE dbo.__exporter_migrations (
            name        VARCHAR(255)  NOT NULL PRIMARY KEY,
            applied_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
        );
    END
  `);
}

async function getAppliedMigrationNames(pool: sql.ConnectionPool): Promise<Set<string>> {
  const result = await pool.request().query(`SELECT name FROM dbo.__exporter_migrations`);
  return new Set(result.recordset.map((row: { name: string }) => row.name));
}

function splitIntoBatches(fileContents: string): string[] {
  return fileContents
    .split(/^\s*GO\s*$/im)
    .map(batch => batch.trim())
    .filter(batch => batch.length > 0);
}

export async function runMigrations(): Promise<string[]> {
  const pool = await new sql.ConnectionPool(buildConfig()).connect();

  try {
    await ensureTrackingTableExists(pool);
    const applied = await getAppliedMigrationNames(pool);

    const allFiles = (await readdir(MIGRATIONS_DIR))
      .filter(name => name.endsWith('.sql'))
      .sort();

    const newlyApplied: string[] = [];

    for (const fileName of allFiles) {
      if (applied.has(fileName)) continue;

      const contents = await readFile(join(MIGRATIONS_DIR, fileName), 'utf-8');
      const batches = splitIntoBatches(contents);

      for (const batch of batches) {
        await pool.request().batch(batch);
      }

      await pool.request()
        .input('name', sql.VarChar(255), fileName)
        .query(`INSERT INTO dbo.__exporter_migrations (name) VALUES (@name)`);

      newlyApplied.push(fileName);
    }

    return newlyApplied;
  } finally {
    await pool.close();
  }
}

if (import.meta.main) {
  runMigrations()
    .then(applied => {
      if (applied.length === 0) {
        console.log('✓ No hay migraciones nuevas que aplicar');
      } else {
        console.log(`✓ Migraciones aplicadas: ${applied.join(', ')}`);
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('✗ Error aplicando migraciones:', error);
      process.exit(1);
    });
}
