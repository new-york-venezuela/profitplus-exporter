import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';

process.env.DW_NAME = `DWH_AlimentosNY_Test_reconcile_${Date.now()}`;

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

// Fake document numbers: never exist in the ERP, fit in char(20).
const FAKE_SALE = 'ZZ-ORPHAN-SALE';
const FAKE_RETURN = 'ZZ-ORPHAN-RET';
const FAKE_PURCHASE = 'ZZ-ORPHAN-PUR';

describe('dwh.Reconcile_Orphan_Facts', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    for (const proc of [
      'Load_Dim_Currency', 'Load_Dim_Customer', 'Load_Dim_Product', 'Load_Dim_SalesRep',
      'Load_Dim_Warehouse', 'Load_Dim_Supplier',
      'Load_Fact_Sales', 'Load_Fact_Returns', 'Load_Fact_Purchases',
    ]) {
      await pool.request().execute(`dwh.${proc}`);
    }
  }, 120_000);

  afterAll(async () => {
    await pool.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  beforeEach(async () => {
    await pool.request().query(`
      DELETE FROM fact.Fact_Sales WHERE InvoiceNumber LIKE 'ZZ-ORPHAN%';
      DELETE FROM fact.Fact_Returns WHERE CreditNoteNumber LIKE 'ZZ-ORPHAN%';
      DELETE FROM fact.Fact_Purchases WHERE InvoiceNumber LIKE 'ZZ-ORPHAN%';
      DELETE FROM dwh.ReconcileLog;
    `);
  });

  const count = async (table: string, col: string, like = 'ZZ-ORPHAN%') =>
    (await pool.request().query(`SELECT COUNT(*) AS n FROM fact.${table} WHERE ${col} LIKE '${like}'`)).recordset[0].n as number;

  // Clone a real row under a fake document number so it has no source in the ERP.
  async function plantSale(inv: string, line: number) {
    await pool.request().input('inv', sql.Char(20), inv).input('line', sql.Int, line).query(`
      INSERT INTO fact.Fact_Sales (DateKey, CustomerKey, ProductKey, SalesRepKey, WarehouseKey, CurrencyKey, DocumentTypeKey,
        InvoiceNumber, LineNumber, QuantitySold, GrossAmount, DiscountAmount, TaxAmount, NetAmount,
        UnitCost, COGSAmount, GrossProfitAmount, CostSourceFlag, DocumentExchangeRate, IsVoided)
      SELECT TOP 1 DateKey, CustomerKey, ProductKey, SalesRepKey, WarehouseKey, CurrencyKey, DocumentTypeKey,
        @inv, @line, QuantitySold, GrossAmount, DiscountAmount, TaxAmount, NetAmount,
        NULL, NULL, NULL, 'NO_COST_DATA', DocumentExchangeRate, IsVoided
      FROM fact.Fact_Sales WHERE InvoiceNumber NOT LIKE 'ZZ-ORPHAN%'`);
  }

  async function plantReturn(inv: string) {
    await pool.request().input('inv', sql.Char(20), inv).query(`
      INSERT INTO fact.Fact_Returns (DateKey, CustomerKey, ProductKey, SalesRepKey, WarehouseKey, CurrencyKey, DocumentTypeKey,
        CreditNoteNumber, LineNumber, QuantityReturned, GrossAmount, DiscountAmount, TaxAmount, NetAmount,
        DocumentExchangeRate, IsVoided, OriginalInvoiceNumber, OriginalInvoiceLineNumber, OriginalInvoiceDateKey, HasInvoiceLink)
      SELECT TOP 1 DateKey, CustomerKey, ProductKey, SalesRepKey, WarehouseKey, CurrencyKey, DocumentTypeKey,
        @inv, 1, QuantityReturned, GrossAmount, DiscountAmount, TaxAmount, NetAmount,
        DocumentExchangeRate, IsVoided, OriginalInvoiceNumber, OriginalInvoiceLineNumber, OriginalInvoiceDateKey, HasInvoiceLink
      FROM fact.Fact_Returns WHERE CreditNoteNumber NOT LIKE 'ZZ-ORPHAN%'`);
  }

  async function plantPurchase(inv: string) {
    await pool.request().input('inv', sql.Char(20), inv).query(`
      INSERT INTO fact.Fact_Purchases (DateKey, SupplierKey, ProductKey, CurrencyKey,
        InvoiceNumber, LineNumber, QuantityPurchased, GrossAmount, DiscountAmount, TaxAmount, NetAmount,
        DocumentExchangeRate, IsVoided)
      SELECT TOP 1 DateKey, SupplierKey, ProductKey, CurrencyKey,
        @inv, 1, QuantityPurchased, GrossAmount, DiscountAmount, TaxAmount, NetAmount,
        DocumentExchangeRate, IsVoided
      FROM fact.Fact_Purchases WHERE InvoiceNumber NOT LIKE 'ZZ-ORPHAN%'`);
  }

  test('dry run (default) reports orphans per fact table and deletes nothing', async () => {
    await plantSale(FAKE_SALE, 1);
    await plantSale(FAKE_SALE, 2);
    await plantReturn(FAKE_RETURN);
    await plantPurchase(FAKE_PURCHASE);

    const res = await pool.request().input('MaxOrphanPercent', sql.Decimal(5, 2), 100).execute('dwh.Reconcile_Orphan_Facts');
    const byTable = Object.fromEntries(res.recordset.map((r: any) => [r.FactTable, r]));

    expect(byTable.Fact_Sales.OrphanLines).toBe(2);
    expect(byTable.Fact_Sales.OrphanDocuments).toBe(1);
    expect(byTable.Fact_Returns.OrphanLines).toBe(1);
    expect(byTable.Fact_Purchases.OrphanLines).toBe(1);

    expect(await count('Fact_Sales', 'InvoiceNumber')).toBe(2);
    expect(await count('Fact_Returns', 'CreditNoteNumber')).toBe(1);
    expect(await count('Fact_Purchases', 'InvoiceNumber')).toBe(1);
  });

  test('@Apply = 1 deletes only the orphans, keeps every real row, and logs what it removed', async () => {
    const before = (await pool.request().query(`SELECT COUNT(*) AS n FROM fact.Fact_Sales WHERE InvoiceNumber NOT LIKE 'ZZ-ORPHAN%'`)).recordset[0].n;
    await plantSale(FAKE_SALE, 1);
    await plantReturn(FAKE_RETURN);
    await plantPurchase(FAKE_PURCHASE);

    await pool.request()
      .input('Apply', sql.Bit, 1)
      .input('MaxOrphanPercent', sql.Decimal(5, 2), 100)
      .execute('dwh.Reconcile_Orphan_Facts');

    expect(await count('Fact_Sales', 'InvoiceNumber')).toBe(0);
    expect(await count('Fact_Returns', 'CreditNoteNumber')).toBe(0);
    expect(await count('Fact_Purchases', 'InvoiceNumber')).toBe(0);

    const after = (await pool.request().query(`SELECT COUNT(*) AS n FROM fact.Fact_Sales`)).recordset[0].n;
    expect(after).toBe(before);

    const log = await pool.request().query(`SELECT FactTable, RTRIM(DocNumber) AS DocNumber, LineNumber FROM dwh.ReconcileLog ORDER BY FactTable`);
    expect(log.recordset.map((r: any) => `${r.FactTable}:${r.DocNumber}:${r.LineNumber}`)).toEqual([
      `Fact_Purchases:${FAKE_PURCHASE}:1`,
      `Fact_Returns:${FAKE_RETURN}:1`,
      `Fact_Sales:${FAKE_SALE}:1`,
    ]);
  });

  test('removes a line that no longer exists on an invoice that still does (line-level, not only whole invoices)', async () => {
    const real = (await pool.request().query(`SELECT TOP 1 RTRIM(InvoiceNumber) AS inv FROM fact.Fact_Sales`)).recordset[0].inv as string;
    await plantSale(real, 99999); // real invoice, line number the ERP does not have

    await pool.request()
      .input('Apply', sql.Bit, 1)
      .input('MaxOrphanPercent', sql.Decimal(5, 2), 100)
      .execute('dwh.Reconcile_Orphan_Facts');

    const ghost = await pool.request().input('inv', sql.Char(20), real).query(
      `SELECT COUNT(*) AS n FROM fact.Fact_Sales WHERE InvoiceNumber = @inv AND LineNumber = 99999`);
    expect(ghost.recordset[0].n).toBe(0);
    const stillThere = await pool.request().input('inv', sql.Char(20), real).query(
      `SELECT COUNT(*) AS n FROM fact.Fact_Sales WHERE InvoiceNumber = @inv AND LineNumber <> 99999`);
    expect(stillThere.recordset[0].n).toBeGreaterThan(0);
  });

  test('refuses to delete anything when orphans exceed @MaxOrphanPercent', async () => {
    await plantSale(FAKE_SALE, 1);

    await expect(
      pool.request()
        .input('Apply', sql.Bit, 1)
        .input('MaxOrphanPercent', sql.Decimal(5, 2), 0)
        .execute('dwh.Reconcile_Orphan_Facts'),
    ).rejects.toThrow(/exceed/i);

    expect(await count('Fact_Sales', 'InvoiceNumber')).toBe(1);
  });

  test('a clean warehouse reports zero orphans and is a no-op when applied', async () => {
    const res = await pool.request()
      .input('Apply', sql.Bit, 1)
      .execute('dwh.Reconcile_Orphan_Facts');
    for (const row of res.recordset) expect(row.OrphanLines).toBe(0);
    const log = await pool.request().query(`SELECT COUNT(*) AS n FROM dwh.ReconcileLog`);
    expect(log.recordset[0].n).toBe(0);
  });
});
