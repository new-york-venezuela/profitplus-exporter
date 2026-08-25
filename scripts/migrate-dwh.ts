import sql from 'mssql';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(import.meta.dir, '..', 'dwh-migrations');

function dwEnv(name: string, fallback: string): string {
  return process.env[`DW_${name}`] ?? process.env[`DB_${name}`] ?? fallback;
}

export function dwhDatabaseName(): string {
  return process.env.DW_NAME ?? 'DWH_AlimentosNY';
}

function buildConfig(database: string): sql.config {
  return {
    server: dwEnv('SERVER', 'localhost'),
    port: parseInt(dwEnv('PORT', '1433')),
    database,
    user: dwEnv('USER', 'sa'),
    password: dwEnv('PASSWORD', ''),
    options: {
      encrypt: dwEnv('ENCRYPT', 'false') === 'true',
      trustServerCertificate: dwEnv('TRUST_SERVER_CERT', 'true') !== 'false',
    },
  };
}

function splitIntoBatches(fileContents: string): string[] {
  return fileContents
    .split(/^\s*GO\s*$/im)
    .map(batch => batch.trim())
    .filter(batch => batch.length > 0);
}

async function ensureDatabaseExists(): Promise<void> {
  const masterPool = await new sql.ConnectionPool(buildConfig('master')).connect();
  try {
    const dbName = dwhDatabaseName();
    await masterPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '${dbName}')
      BEGIN
          EXEC('CREATE DATABASE [${dbName}]');
      END
    `);
  } finally {
    await masterPool.close();
  }
}

async function ensureTrackingTableExists(pool: sql.ConnectionPool): Promise<void> {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'dwh')
    BEGIN
        EXEC('CREATE SCHEMA dwh');
    END
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__dwh_migrations' AND schema_id = SCHEMA_ID('dwh'))
    BEGIN
        CREATE TABLE dwh.__dwh_migrations (
            name        VARCHAR(255)  NOT NULL PRIMARY KEY,
            applied_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
        );
    END
  `);
}

async function getAppliedMigrationNames(pool: sql.ConnectionPool): Promise<Set<string>> {
  const result = await pool.request().query(`SELECT name FROM dwh.__dwh_migrations`);
  return new Set(result.recordset.map((row: { name: string }) => row.name));
}

export async function runDwhMigrations(): Promise<string[]> {
  await ensureDatabaseExists();

  const pool = await new sql.ConnectionPool(buildConfig(dwhDatabaseName())).connect();

  try {
    await ensureTrackingTableExists(pool);
    const applied = await getAppliedMigrationNames(pool);

    const allFiles = (await readdir(MIGRATIONS_DIR))
      .filter(name => name.endsWith('.sql'))
      .sort();

    const newlyApplied: string[] = [];

    for (const fileName of allFiles) {
      if (applied.has(fileName)) continue;
      if (fileName === '0001_create_database.sql') {
        // Database creation already handled by ensureDatabaseExists() against
        // master, before this pool connected to the (now-existing) DWH
        // database — record it as applied without re-running its SQL.
        await pool.request()
          .input('name', sql.VarChar(255), fileName)
          .query(`INSERT INTO dwh.__dwh_migrations (name) VALUES (@name)`);
        newlyApplied.push(fileName);
        continue;
      }

      const contents = await readFile(join(MIGRATIONS_DIR, fileName), 'utf-8');
      const batches = splitIntoBatches(contents);

      for (const batch of batches) {
        await pool.request().batch(batch);
      }

      await pool.request()
        .input('name', sql.VarChar(255), fileName)
        .query(`INSERT INTO dwh.__dwh_migrations (name) VALUES (@name)`);

      newlyApplied.push(fileName);
    }

    return newlyApplied;
  } finally {
    await pool.close();
  }
}

if (import.meta.main) {
  runDwhMigrations()
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
