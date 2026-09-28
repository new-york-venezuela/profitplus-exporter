import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';

process.env.DW_NAME = `DWH_AlimentosNY_Test_consignment_${Date.now()}`;

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

describe('0035_consignment_store_deliveries migration', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
  }, 60_000);

  afterAll(async () => {
    await pool.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  test('inserts the Gama La Joya customer row under the Gama matriz', async () => {
    const result = await pool.request().query(`
      SELECT CustomerName, RTRIM(MatrizCode) AS MatrizCode, LegalEntityKey, IsCurrent
      FROM dim.Dim_Customer WHERE RTRIM(CustomerCode) = 'J-301420608-24'
    `);
    expect(result.recordset).toHaveLength(1);
    expect(result.recordset[0].MatrizCode).toBe('J-301420608');
    expect(result.recordset[0].LegalEntityKey).toBe(26);
    expect(result.recordset[0].IsCurrent).toBe(true);
  });

  test('seeds all 13 ConsignmentProductMap rows for gama, with 3 flagged IsBoxUnit', async () => {
    const result = await pool.request().query(`
      SELECT ExcelProductName, IsBoxUnit FROM dwh.ConsignmentProductMap WHERE SourceClientTag = 'gama'
    `);
    expect(result.recordset).toHaveLength(13);
    const boxUnitNames = result.recordset.filter((r: { IsBoxUnit: boolean }) => r.IsBoxUnit).map((r: { ExcelProductName: string }) => r.ExcelProductName);
    expect(boxUnitNames.sort()).toEqual(['Pizza Americana Cj', 'Pizza Magarita Cj', 'Pizza New York Cj']);
  });

  test('creates Fact_ConsignmentDeliveries with FKs to Dim_Date, Dim_Customer, Dim_Product', async () => {
    const result = await pool.request().query(`
      SELECT OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable
      FROM sys.foreign_keys fk
      WHERE fk.parent_object_id = OBJECT_ID('fact.Fact_ConsignmentDeliveries')
    `);
    const referencedTables = result.recordset.map((r: { ReferencedTable: string }) => r.ReferencedTable);
    expect(referencedTables).toEqual(expect.arrayContaining(['Dim_Date', 'Dim_Customer', 'Dim_Product']));
  });

  test('enforces uniqueness on SourceRowKey', async () => {
    const dateRow = await pool.request().query(`SELECT TOP 1 DateKey FROM dim.Dim_Date`);
    const custRow = await pool.request().query(`SELECT TOP 1 CustomerKey FROM dim.Dim_Customer`);
    const prodRow = await pool.request().query(`SELECT TOP 1 ProductKey FROM dim.Dim_Product`);
    const insertOne = () => pool.request()
      .input('dateKey', sql.Int, dateRow.recordset[0].DateKey)
      .input('customerKey', sql.Int, custRow.recordset[0].CustomerKey)
      .input('productKey', sql.Int, prodRow.recordset[0].ProductKey)
      .query(`
        INSERT INTO fact.Fact_ConsignmentDeliveries
          (DateKey, CustomerKey, ProductKey, QuantityDelivered, SourceClientTag, SourceFileName, SourceRowKey, SourceRowContentHash)
        VALUES (@dateKey, @customerKey, @productKey, 1, 'gama', 'test.xlsx', 'dup-key', 'hash-a')
      `);
    await insertOne();
    await expect(insertOne()).rejects.toThrow();
  });

  test('migration is re-runnable without error', async () => {
    await expect(runDwhMigrations()).resolves.toBeDefined();
  });
});
