import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';
import { importDeliveries } from '../../import-consignment-deliveries';

process.env.DW_NAME = `DWH_AlimentosNY_Test_consignment_run_${Date.now()}`;

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

const fixturePath = join(import.meta.dir, 'fixtures', 'despacho-sample.xlsx');

describe('importDeliveries', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    // First run migrations to set up schema (0035 will try to seed ConsignmentProductMap but will find 0 products).
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();

    // Seed test fixture products (in production, Load_Dim_Product syncs from ERP;
    // in test we must pre-seed) -- same pattern as consignment-deliveries-schema.test.ts,
    // limited to the two product columns actually used by the fixtures in this file.
    await pool.request().query(`
      INSERT INTO dim.Dim_Product (
        ProductCode, ProductName, ProductTypeCode, CostingMethodCode, LineCode, LineName,
        SubLineCode, SubLineName, CategoryCode, CategoryName, MarginMinPercent, MarginMaxPercent,
        IsInactive, ValidFrom, ValidTo, IsCurrent
      )
      VALUES
        ('0000007', '4 Granos 500gr',   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000008', '7 Cereales 600gr', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1)
    `);

    // Seed ConsignmentProductMap now that the products exist (replicates the migration's logic).
    await pool.request().query(`
      INSERT INTO dwh.ConsignmentProductMap (SourceClientTag, ExcelProductName, ProductKey, IsBoxUnit)
      SELECT 'gama', v.ExcelProductName, p.ProductKey, v.IsBoxUnit
      FROM (VALUES
        ('4 Granos 500gr',   '0000007', CAST(0 AS bit)),
        ('7 Cereales 600gr', '0000008', CAST(0 AS bit))
      ) AS v(ExcelProductName, ProductCode, IsBoxUnit)
      INNER JOIN dim.Dim_Product p ON RTRIM(p.ProductCode) = v.ProductCode AND p.IsCurrent = 1
    `);

    // Seed the two Gama child-store Dim_Customer rows this file's fixtures reference
    // (Gama Vizcaya = J-301420608-10, Gama Express Chuao = J-301420608-21). In
    // production these are synced from the ERP by Load_Dim_Customer; the 0035
    // migration only inserts the one brand-new "Gama La Joya" row (J-301420608-24)
    // that has no ERP row yet, so a fresh test DB has none of the other pre-existing
    // Gama child stores STORE_MAP points at -- same "seed it in the test's own
    // beforeAll" pattern already used above for Dim_Product/ConsignmentProductMap.
    await pool.request().query(`
      INSERT INTO dim.Dim_Customer (
        CustomerCode, CustomerName, TaxId, LegalEntityRIF, IsSpecialTaxpayer, CreditLimit, CreditLimitCurrencyCode,
        ZoneCode, SegmentCode, DefaultSalesRepCode, IsLegalEntity, IsInactive, MatrizCode, ValidFrom, ValidTo, IsCurrent, LegalEntityKey
      )
      VALUES
        ('J-301420608-10 ', 'EXCELSIOR GAMA SUPERMERCADOS, C.A. (Vizcaya)',       NULL, NULL, 0, NULL, NULL, 'CCS   ', NULL, NULL, 0, 0, 'J-301420608     ', SYSUTCDATETIME(), NULL, 1, 26),
        ('J-301420608-21 ', 'EXCELSIOR GAMA SUPERMERCADOS, C.A. (Express Chuao)', NULL, NULL, 0, NULL, NULL, 'CCS   ', NULL, NULL, 0, 0, 'J-301420608     ', SYSUTCDATETIME(), NULL, 1, 26)
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

  test('first run inserts one row per non-blank product cell, with no price found (no Fact_Sales history in a fresh test DB)', async () => {
    const report = await importDeliveries(pool, fixturePath, 'gama');
    expect(report.inserted).toBe(3); // matches the fixture's 3 non-blank product cells
    expect(report.updated).toHaveLength(0);
    expect(report.unmappedStores).toHaveLength(0);
    expect(report.unmappedProducts).toHaveLength(0);
    expect(report.pricesNotFound.length).toBeGreaterThan(0); // fresh DB has no Fact_Sales rows to price against

    const rows = await pool.request().query(`SELECT QuantityDelivered, UnitPriceUsd FROM fact.Fact_ConsignmentDeliveries`);
    expect(rows.recordset).toHaveLength(3);
    expect(rows.recordset.every((r: { UnitPriceUsd: number | null }) => r.UnitPriceUsd === null)).toBe(true);
  });

  test('second run against the same unchanged file inserts nothing new and updates nothing', async () => {
    const report = await importDeliveries(pool, fixturePath, 'gama');
    expect(report.inserted).toBe(0);
    expect(report.updated).toHaveLength(0);

    const rows = await pool.request().query(`SELECT COUNT(*) AS Count FROM fact.Fact_ConsignmentDeliveries`);
    expect(rows.recordset[0].Count).toBe(3); // still 3, not 6 -- no duplicate inserts
  });

  test('re-importing after the employee corrects a quantity updates the existing row instead of duplicating it', async () => {
    // This is the scenario SourceRowKey/SourceRowContentHash was split for
    // (spec Section 3/6) -- write two versions of the same fixture (same
    // store/date/nota/product identity, different quantity) to a dedicated
    // path so this test doesn't interact with fixturePath's row counts used
    // by the tests above.
    const XLSX = await import('xlsx');
    const editFixturePath = join(import.meta.dir, 'fixtures', 'despacho-edit-in-place.xlsx');

    const buildFixture = (quantity: number) => {
      const wb = XLSX.utils.book_new();
      const data = [
        ['Nombre de Cliente', 'Fecha de Despacho', 'Orden de Compra', '4 Granos 500gr'],
        ['Gama Vizcaya', new Date(2026, 4, 5), 'F0050', quantity],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'GAMA');
      // XLSX.writeFile() throws "cannot save file" under the bun:test runner
      // (its Node-fs-backed writer path isn't available there, mirroring the
      // XLSX.readFile() incompatibility Task 2 hit and worked around with
      // readFileSync + XLSX.read(buffer)) -- write the buffer via Bun.write instead.
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      writeFileSync(editFixturePath, buf);
    };

    buildFixture(18);
    const firstReport = await importDeliveries(pool, editFixturePath, 'gama');
    expect(firstReport.inserted).toBe(1);
    expect(firstReport.updated).toHaveLength(0);

    const afterFirst = await pool.request().query(`
      SELECT QuantityDelivered FROM fact.Fact_ConsignmentDeliveries
      WHERE NotaEntregaNum = 'F0050'
    `);
    expect(afterFirst.recordset).toHaveLength(1);
    expect(Number(afterFirst.recordset[0].QuantityDelivered)).toBe(18);

    // Employee corrects the quantity in the same workbook (same store, date, nota, product -- only quantity changes).
    buildFixture(20);
    const secondReport = await importDeliveries(pool, editFixturePath, 'gama');
    expect(secondReport.inserted).toBe(0);
    expect(secondReport.updated).toHaveLength(1);
    expect(secondReport.updated[0].oldQuantity).toBe(18);
    expect(secondReport.updated[0].newQuantity).toBe(20);

    const afterSecond = await pool.request().query(`
      SELECT QuantityDelivered FROM fact.Fact_ConsignmentDeliveries
      WHERE NotaEntregaNum = 'F0050'
    `);
    expect(afterSecond.recordset).toHaveLength(1); // still exactly one row, not two
    expect(Number(afterSecond.recordset[0].QuantityDelivered)).toBe(20);
  });

  test('a row whose product/store has no map entry is reported as unmapped, not silently dropped or crashed on', async () => {
    // Use a real PRODUCT_COLUMNS name so parseWorkbook actually reads it into a
    // ParsedRow (an unrecognized column header is invisible to parseWorkbook by
    // design -- see PRODUCT_COLUMNS, scripts/import-consignment-deliveries.ts --
    // so it could never surface in unmappedProducts; that's not the realistic
    // failure mode anyway). Instead, import under a sourceClientTag with zero
    // seeded dwh.ConsignmentProductMap rows, so resolveProductMap(pool, tag)
    // comes back empty and this otherwise-valid product correctly fails the
    // productMap.has(row.productName) check -- the actual real-world scenario
    // of "a product not yet mapped for this client."
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const data = [
      ['Nombre de Cliente', 'Fecha de Despacho', 'Orden de Compra', '4 Granos 500gr'],
      ['Gama Express Chuao', new Date(2026, 4, 1), 'D9999', 3],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'GAMA');
    const badFixturePath = join(import.meta.dir, 'fixtures', 'despacho-unmapped-product.xlsx');
    // See the writeFileSync workaround note above -- XLSX.writeFile() doesn't work under bun:test.
    writeFileSync(badFixturePath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const report = await importDeliveries(pool, badFixturePath, 'unmapped-test-tag');
    expect(report.unmappedProducts).toContain('4 Granos 500gr');
    expect(report.inserted).toBe(0);
  });
});
