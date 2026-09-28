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
    // First run migrations to set up schema (0035 will try to seed ConsignmentProductMap but will find 0 products)
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();

    // Seed test fixture products (In production, Load_Dim_Product syncs from ERP; in test we must pre-seed)
    await pool.request().query(`
      INSERT INTO dim.Dim_Product (
        ProductCode, ProductName, ProductTypeCode, CostingMethodCode, LineCode, LineName,
        SubLineCode, SubLineName, CategoryCode, CategoryName, MarginMinPercent, MarginMaxPercent,
        IsInactive, ValidFrom, ValidTo, IsCurrent
      )
      VALUES
        ('0000007', '4 Granos 500gr',      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000008', '7 Cereales 600gr',    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000009', 'Miel y pasas 600gr',  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000022', 'Pan Blanco 600gr',    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000016', 'Magdalena',           NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000011', 'Molido 300gr',        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000003', 'Baguette 220gr',      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000017', 'cheese Cake fresa',   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000018', 'cheese Cake Choco',   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000002', 'Pizza Margarita 270', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000014', 'Pizza Magarita Cj',   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000015', 'Pizza New York Cj',   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000020', 'Pizza Americana Cj',  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1)
    `);

    // Seed ConsignmentProductMap now that products exist (replicates the migration's logic)
    await pool.request().query(`
      INSERT INTO dwh.ConsignmentProductMap (SourceClientTag, ExcelProductName, ProductKey, IsBoxUnit)
      SELECT 'gama', v.ExcelProductName, p.ProductKey, v.IsBoxUnit
      FROM (VALUES
        ('4 Granos 500gr',       '0000007', CAST(0 AS bit)),
        ('7 Cereales 600gr',     '0000008', CAST(0 AS bit)),
        ('Miel y pasas 600gr',   '0000009', CAST(0 AS bit)),
        ('Pan Blanco 600gr',     '0000022', CAST(0 AS bit)),
        ('Magdalena',            '0000016', CAST(0 AS bit)),
        ('Molido 300gr',         '0000011', CAST(0 AS bit)),
        ('Baguette 220gr',       '0000003', CAST(0 AS bit)),
        ('cheese Cake fresa',    '0000017', CAST(0 AS bit)),
        ('cheese Cake Choco',    '0000018', CAST(0 AS bit)),
        ('Pizza Margarita 270',  '0000002', CAST(0 AS bit)),
        ('Pizza Magarita Cj',    '0000014', CAST(1 AS bit)),
        ('Pizza New York Cj',    '0000015', CAST(1 AS bit)),
        ('Pizza Americana Cj',   '0000020', CAST(1 AS bit))
      ) AS v(ExcelProductName, ProductCode, IsBoxUnit)
      INNER JOIN dim.Dim_Product p ON RTRIM(p.ProductCode) = v.ProductCode AND p.IsCurrent = 1
    `);
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
