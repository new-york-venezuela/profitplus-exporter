// scripts/dwh/__tests__/dim-salesrep-warehouse-documenttype.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';

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

describe('Dim_SalesRep, Dim_Warehouse, Dim_DocumentType', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
  });

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

  test('Dim_DocumentType is pre-seeded with the known Profit Plus document type domain', async () => {
    const result = await pool.request().query(`SELECT DocumentTypeCode, IsCredit, AffectsAR FROM dim.Dim_DocumentType`);
    expect(result.recordset.length).toBe(6);
    const fact = result.recordset.find(r => r.DocumentTypeCode.trim() === 'FACT');
    expect(fact.IsCredit).toBe(false);
    expect(fact.AffectsAR).toBe(true);
  });

  test('Load_Dim_SalesRep row count matches saVendedor', async () => {
    await pool.request().execute('dwh.Load_Dim_SalesRep');

    const erpCount = await erpPool.request().query(`SELECT COUNT(*) AS total FROM saVendedor`);
    const dwhCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_SalesRep`);
    expect(dwhCount.recordset[0].total).toBe(erpCount.recordset[0].total);
  });

  test('Load_Dim_Warehouse flags HasRealStock correctly, matching only warehouses 13/14 per documented finding', async () => {
    await pool.request().execute('dwh.Load_Dim_Warehouse');

    const realStockWarehouses = await pool.request().query(`
      SELECT WarehouseCode FROM dim.Dim_Warehouse WHERE HasRealStock = 1
    `);
    const codes = realStockWarehouses.recordset.map(r => r.WarehouseCode.trim());
    expect(codes.length).toBeGreaterThan(0);
    // per erp-knowledge-base/docs/tables/saAlmacen.md, only 13 and 14 carry real stock today
    expect(codes.every(c => ['13', '14'].includes(c))).toBe(true);
  });
});
