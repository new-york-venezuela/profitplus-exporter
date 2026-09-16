// scripts/dwh/__tests__/dim-legal-entity.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';

// Runs against a dedicated throwaway database, never the real local/shared
// DWH_AlimentosNY -- afterAll drops this database unconditionally, which
// would otherwise wipe a real dev DWH someone else migrated/loaded.
// dwhDatabaseName() reads DW_NAME, so setting it before calling
// runDwhMigrations() routes every migrate-dwh.ts call in this file at the
// throwaway DB instead.
process.env.DW_NAME = `DWH_AlimentosNY_Test_dim_legal_entity_${Date.now()}`;

function testConfig(database: string): sql.config {
  return {
    server: process.env.DW_SERVER ?? process.env.DB_SERVER!,
    port: parseInt(process.env.DW_PORT ?? process.env.DB_PORT ?? '1433'),
    database,
    user: process.env.DW_USER ?? process.env.DB_USER!,
    password: process.env.DW_PASSWORD ?? process.env.DB_PASSWORD!,
    options: {
      encrypt: (process.env.DW_ENCRYPT ?? process.env.DB_ENCRYPT) === 'true',
      trustServerCertificate: (process.env.DW_TRUST_SERVER_CERT ?? process.env.DB_TRUST_SERVER_CERT) !== 'false',
    },
  };
}

describe('Dim_LegalEntity', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
    await pool.request().execute('dwh.Load_Dim_Customer');
    await pool.request().execute('dwh.Load_Dim_LegalEntity');
  }, 60_000);

  afterAll(async () => {
    await pool.close();
    await erpPool.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  test('every current Dim_Customer row has a non-null LegalEntityKey', async () => {
    const result = await pool.request().query(`
      SELECT COUNT(*) AS total FROM dim.Dim_Customer WHERE IsCurrent = 1 AND LegalEntityKey IS NULL
    `);
    expect(result.recordset[0].total).toBe(0);
  });

  test('a known multi-store chain (matriz populated in ERP) rolls up to one entity with correct StoreCount', async () => {
    // Find any parent code in the live ERP data that has at least 2 children
    // via matriz (verified live during design: Gama/Farmatodo/Plaza/Plansuárez
    // all qualify in the dev database).
    const chains = await erpPool.request().query(`
      SELECT LTRIM(RTRIM(matriz)) AS parentCode, COUNT(*) AS childCount
      FROM saCliente
      WHERE matriz IS NOT NULL AND LTRIM(RTRIM(matriz)) <> ''
      GROUP BY LTRIM(RTRIM(matriz))
      HAVING COUNT(*) >= 2
      ORDER BY COUNT(*) DESC
    `);
    expect(chains.recordset.length).toBeGreaterThan(0);
    const chain = chains.recordset[0];

    const entity = await pool.request()
      .input('rootCode', sql.Char(16), chain.parentCode)
      .query(`
        SELECT le.LegalEntityKey, le.StoreCount
        FROM dim.Dim_LegalEntity le
        WHERE RTRIM(le.RootCustomerCode) = @rootCode
      `);
    expect(entity.recordset.length).toBe(1);
    // StoreCount = parent (1) + all children
    expect(entity.recordset[0].StoreCount).toBe(1 + Number(chain.childCount));

    // All child rows resolve to that same LegalEntityKey
    const childrenResolved = await pool.request()
      .input('legalEntityKey', entity.recordset[0].LegalEntityKey)
      .input('rootCode', sql.Char(16), chain.parentCode)
      .query(`
        SELECT COUNT(*) AS total
        FROM dim.Dim_Customer c
        WHERE c.IsCurrent = 1 AND RTRIM(c.MatrizCode) = @rootCode AND c.LegalEntityKey = @legalEntityKey
      `);
    expect(childrenResolved.recordset[0].total).toBe(Number(chain.childCount));
  });

  test('a standalone customer (no matriz, not referenced as matriz) is its own entity of size 1', async () => {
    const standalone = await erpPool.request().query(`
      SELECT TOP 1 LTRIM(RTRIM(co_cli)) AS code
      FROM saCliente s
      WHERE (s.matriz IS NULL OR LTRIM(RTRIM(s.matriz)) = '')
        AND NOT EXISTS (
          SELECT 1 FROM saCliente child
          WHERE LTRIM(RTRIM(child.matriz)) = LTRIM(RTRIM(s.co_cli))
        )
    `);
    expect(standalone.recordset.length).toBe(1);
    const code = standalone.recordset[0].code;

    const entity = await pool.request()
      .input('code', sql.Char(16), code)
      .query(`
        SELECT le.StoreCount
        FROM dim.Dim_Customer c
        JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
        WHERE c.IsCurrent = 1 AND RTRIM(c.CustomerCode) = @code
      `);
    expect(entity.recordset.length).toBe(1);
    expect(entity.recordset[0].StoreCount).toBe(1);
  });

  test('re-running the load is idempotent', async () => {
    await pool.request().execute('dwh.Load_Dim_LegalEntity');
    const firstCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_LegalEntity`);

    await pool.request().execute('dwh.Load_Dim_LegalEntity');
    const secondCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_LegalEntity`);

    expect(secondCount.recordset[0].total).toBe(firstCount.recordset[0].total);
  });
});
