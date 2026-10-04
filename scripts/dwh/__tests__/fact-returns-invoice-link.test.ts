// scripts/dwh/__tests__/fact-returns-invoice-link.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';

// Runs against a dedicated throwaway database (afterAll drops it), never the
// real DWH_AlimentosNY. dwhDatabaseName() reads DW_NAME.
process.env.DW_NAME = `DWH_AlimentosNY_Test_returns_invoice_link_${Date.now()}`;

const MIGRATIONS_DIR = join(import.meta.dir, '..', '..', '..', 'migrations', 'dwh');

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

// Re-applies 0036 exactly the way migrate-dwh.ts does (split on GO lines), to
// prove the migration (including its backfills) is safely re-runnable.
async function reapply0036(pool: sql.ConnectionPool): Promise<void> {
  const file = (await readdir(MIGRATIONS_DIR)).find(n => n.startsWith('0036_'));
  expect(file).toBeDefined();
  const contents = await readFile(join(MIGRATIONS_DIR, file!), 'utf-8');
  const batches = contents.split(/^\s*GO\s*$/im).map(b => b.trim()).filter(b => b.length > 0);
  for (const batch of batches) await pool.request().batch(batch);
}

describe('Fact_Returns original-factura link + global discount netting (0036)', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
    for (const proc of [
      'Load_Dim_Currency', 'Load_Fact_ExchangeRate', 'Load_Dim_Customer', 'Load_Dim_LegalEntity',
      'Load_Dim_Product', 'Load_Dim_SalesRep', 'Load_Dim_Warehouse', 'Load_Fact_Sales', 'Load_Fact_Returns',
    ]) {
      await pool.request().execute(`dwh.${proc}`);
    }
  }, 120_000);

  afterAll(async () => {
    await pool?.close();
    await erpPool?.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      IF EXISTS (SELECT 1 FROM sys.databases WHERE name = '${dwhDatabaseName()}')
      BEGIN
        ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        DROP DATABASE [${dwhDatabaseName()}];
      END
    `);
    await masterPool.close();
  });

  test('new columns exist, OriginalInvoiceDateKey has a FK to Dim_Date', async () => {
    const r = await pool.request().query(`
      SELECT c.name AS ColumnName, fk.name AS ForeignKeyName
      FROM sys.columns c
      LEFT JOIN sys.foreign_key_columns fkc ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
      LEFT JOIN sys.foreign_keys fk ON fk.object_id = fkc.constraint_object_id
      WHERE c.object_id = OBJECT_ID('fact.Fact_Returns')
        AND c.name IN ('OriginalInvoiceNumber', 'OriginalInvoiceLineNumber', 'OriginalInvoiceDateKey', 'HasInvoiceLink')
    `);
    expect(r.recordset.length).toBe(4);
    const dateKey = r.recordset.find((x: { ColumnName: string }) => x.ColumnName === 'OriginalInvoiceDateKey');
    expect(dateKey.ForeignKeyName).toBe('FK_Fact_Returns_Dim_Date_OriginalInvoice');
  });

  test('every loaded return line has an OriginalInvoiceDateKey; unlinked rows fall back to DateKey', async () => {
    const r = await pool.request().query(`
      SELECT
        COUNT(*) AS Total,
        SUM(CASE WHEN OriginalInvoiceDateKey IS NULL THEN 1 ELSE 0 END) AS NullKeys,
        SUM(CASE WHEN HasInvoiceLink = 0 AND OriginalInvoiceDateKey <> DateKey THEN 1 ELSE 0 END) AS BadFallback,
        SUM(CASE WHEN HasInvoiceLink = 1 THEN 1 ELSE 0 END) AS Linked
      FROM fact.Fact_Returns
    `);
    const row = r.recordset[0];
    expect(Number(row.Total)).toBeGreaterThan(0);
    expect(Number(row.NullKeys)).toBe(0);
    expect(Number(row.BadFallback)).toBe(0);
    expect(Number(row.Linked)).toBeGreaterThan(0);
  });

  test('linked rows match the factura line resolved by rowguid_doc in the ERP', async () => {
    const erp = await erpPool.request().query(`
      SELECT RTRIM(r.doc_num) AS CreditNoteNumber, r.reng_num AS LineNumber,
             RTRIM(fv.doc_num) AS InvoiceNumber, fvr.reng_num AS InvoiceLine,
             CONVERT(int, FORMAT(fv.fec_emis, 'yyyyMMdd')) AS InvoiceDateKey
      FROM saDevolucionClienteReng r
      JOIN saFacturaVentaReng fvr ON fvr.rowguid = r.rowguid_doc
      JOIN saFacturaVenta fv ON fv.doc_num = fvr.doc_num
    `);
    const dwh = await pool.request().query(`
      SELECT RTRIM(CreditNoteNumber) AS CreditNoteNumber, LineNumber,
             RTRIM(OriginalInvoiceNumber) AS InvoiceNumber, OriginalInvoiceLineNumber AS InvoiceLine,
             OriginalInvoiceDateKey AS InvoiceDateKey, HasInvoiceLink
      FROM fact.Fact_Returns
    `);
    const byKey = new Map(dwh.recordset.map((x: Record<string, unknown>) => [`${x.CreditNoteNumber}|${x.LineNumber}`, x]));
    let compared = 0;
    for (const e of erp.recordset) {
      const d = byKey.get(`${e.CreditNoteNumber}|${e.LineNumber}`) as Record<string, unknown> | undefined;
      if (!d) continue; // line filtered by missing dim, out of scope here
      compared++;
      expect(d.HasInvoiceLink).toBe(true);
      expect(d.InvoiceNumber).toBe(e.InvoiceNumber);
      expect(d.InvoiceLine).toBe(e.InvoiceLine);
      expect(d.InvoiceDateKey).toBe(e.InvoiceDateKey);
    }
    expect(compared).toBeGreaterThan(0);
  });

  test('NetAmount = GrossAmount - DiscountAmount (to the cent) on Fact_Sales and Fact_Returns', async () => {
    const r = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM fact.Fact_Sales WHERE ABS(GrossAmount - DiscountAmount - NetAmount) > 0.02) AS SalesBad,
        (SELECT COUNT(*) FROM fact.Fact_Returns WHERE ABS(GrossAmount - DiscountAmount - NetAmount) > 0.02) AS ReturnsBad
    `);
    expect(Number(r.recordset[0].SalesBad)).toBe(0);
    expect(Number(r.recordset[0].ReturnsBad)).toBe(0);
  });

  test('re-running Load_Fact_Returns is idempotent and does not duplicate rows', async () => {
    const before = await pool.request().query(`SELECT COUNT(*) AS n FROM fact.Fact_Returns`);
    await pool.request().execute('dwh.Load_Fact_Returns');
    const after = await pool.request().query(`SELECT COUNT(*) AS n FROM fact.Fact_Returns`);
    expect(Number(after.recordset[0].n)).toBe(Number(before.recordset[0].n));
  });

  test('a forced re-MERGE (watermark reset) rewrites the link columns, so later source edits are picked up', async () => {
    const target = (await pool.request().query(`
      SELECT TOP 1 CreditNoteNumber, LineNumber, OriginalInvoiceNumber, OriginalInvoiceDateKey
      FROM fact.Fact_Returns WHERE HasInvoiceLink = 1
    `)).recordset[0];
    await pool.request()
      .input('cn', target.CreditNoteNumber).input('ln', target.LineNumber)
      .query(`
        UPDATE fact.Fact_Returns SET OriginalInvoiceNumber = 'X', OriginalInvoiceDateKey = 20200101, HasInvoiceLink = 0
        WHERE CreditNoteNumber = @cn AND LineNumber = @ln;
        UPDATE dwh.EtlWatermark SET LastValidatorDateTime = '1900-01-01' WHERE SourceTableName = 'saDevolucionClienteReng';
      `);
    await pool.request().execute('dwh.Load_Fact_Returns');
    const r = await pool.request()
      .input('cn', target.CreditNoteNumber).input('ln', target.LineNumber)
      .query(`SELECT OriginalInvoiceNumber, OriginalInvoiceDateKey, HasInvoiceLink FROM fact.Fact_Returns WHERE CreditNoteNumber = @cn AND LineNumber = @ln`);
    expect(r.recordset[0].OriginalInvoiceNumber).toBe(target.OriginalInvoiceNumber);
    expect(r.recordset[0].OriginalInvoiceDateKey).toBe(target.OriginalInvoiceDateKey);
    expect(r.recordset[0].HasInvoiceLink).toBe(true);
  });

  test('backfill (re-applying 0036) repairs pre-0036 rows the incremental load cannot reach, and falls back for orphans', async () => {
    const target = (await pool.request().query(`
      SELECT TOP 1 CreditNoteNumber, LineNumber, OriginalInvoiceNumber, OriginalInvoiceLineNumber, OriginalInvoiceDateKey
      FROM fact.Fact_Returns WHERE HasInvoiceLink = 1
    `)).recordset[0];
    // Pre-0036 state: link columns NULL on an already-loaded row.
    await pool.request()
      .input('cn', target.CreditNoteNumber).input('ln', target.LineNumber)
      .query(`
        UPDATE fact.Fact_Returns
        SET OriginalInvoiceNumber = NULL, OriginalInvoiceLineNumber = NULL, OriginalInvoiceDateKey = NULL, HasInvoiceLink = 0
        WHERE CreditNoteNumber = @cn AND LineNumber = @ln
      `);
    // Orphan: a fact row whose source line does not exist in the ERP.
    await pool.request().query(`
      INSERT INTO fact.Fact_Returns (
        DateKey, CustomerKey, ProductKey, DocumentTypeKey, CreditNoteNumber, LineNumber,
        QuantityReturned, GrossAmount, DiscountAmount, TaxAmount, NetAmount, IsVoided
      )
      SELECT TOP 1 20260615, CustomerKey, ProductKey, DocumentTypeKey, 'ZZTEST0036', 1, 1, 10, 0, 0, 10, 0
      FROM fact.Fact_Returns
    `);

    // The incremental load does not touch the stuck row (source unchanged).
    await pool.request().execute('dwh.Load_Fact_Returns');
    const stuck = await pool.request()
      .input('cn', target.CreditNoteNumber).input('ln', target.LineNumber)
      .query(`SELECT OriginalInvoiceDateKey FROM fact.Fact_Returns WHERE CreditNoteNumber = @cn AND LineNumber = @ln`);
    expect(stuck.recordset[0].OriginalInvoiceDateKey).toBeNull();

    await reapply0036(pool);

    const fixed = await pool.request()
      .input('cn', target.CreditNoteNumber).input('ln', target.LineNumber)
      .query(`SELECT OriginalInvoiceNumber, OriginalInvoiceLineNumber, OriginalInvoiceDateKey, HasInvoiceLink FROM fact.Fact_Returns WHERE CreditNoteNumber = @cn AND LineNumber = @ln`);
    expect(fixed.recordset[0].OriginalInvoiceNumber).toBe(target.OriginalInvoiceNumber);
    expect(fixed.recordset[0].OriginalInvoiceLineNumber).toBe(target.OriginalInvoiceLineNumber);
    expect(fixed.recordset[0].OriginalInvoiceDateKey).toBe(target.OriginalInvoiceDateKey);
    expect(fixed.recordset[0].HasInvoiceLink).toBe(true);

    const orphan = await pool.request().query(`
      SELECT DateKey, OriginalInvoiceDateKey, HasInvoiceLink, NetAmount FROM fact.Fact_Returns WHERE CreditNoteNumber = 'ZZTEST0036'
    `);
    expect(orphan.recordset[0].OriginalInvoiceDateKey).toBe(20260615);
    expect(orphan.recordset[0].HasInvoiceLink).toBe(false);
    expect(Number(orphan.recordset[0].NetAmount)).toBe(10);
    await pool.request().query(`DELETE FROM fact.Fact_Returns WHERE CreditNoteNumber = 'ZZTEST0036'`);
  });

  test('backfill restores a Fact_Sales line still carrying the pre-0036 NetAmount (reng_neto without global discount)', async () => {
    const erp = await erpPool.request().query(`
      SELECT TOP 1 RTRIM(doc_num) AS doc_num, reng_num, reng_neto, monto_desc_glob
      FROM saFacturaVentaReng WHERE ISNULL(monto_desc_glob, 0) > 0
    `);
    if (erp.recordset.length === 0) return; // no global discounts in this dataset
    const line = erp.recordset[0];
    const req = () => pool.request().input('doc', line.doc_num).input('ln', line.reng_num);
    const exists = await req().query(`SELECT COUNT(*) AS n FROM fact.Fact_Sales WHERE RTRIM(InvoiceNumber) = @doc AND LineNumber = @ln`);
    if (Number(exists.recordset[0].n) === 0) return;

    await req().input('old', sql.Decimal(18, 2), line.reng_neto)
      .query(`UPDATE fact.Fact_Sales SET NetAmount = @old WHERE RTRIM(InvoiceNumber) = @doc AND LineNumber = @ln`);
    await reapply0036(pool);
    const r = await req().query(`SELECT NetAmount FROM fact.Fact_Sales WHERE RTRIM(InvoiceNumber) = @doc AND LineNumber = @ln`);
    expect(Number(r.recordset[0].NetAmount)).toBeCloseTo(Number(line.reng_neto) - Number(line.monto_desc_glob), 2);
  });

  test('June 2026 returns: by return date vs by original-factura date (logged for the report)', async () => {
    const r = await pool.request().query(`
      SELECT
        SUM(CASE WHEN DateKey BETWEEN 20260601 AND 20260630 THEN NetAmount ELSE 0 END) AS ByReturnDate,
        SUM(CASE WHEN OriginalInvoiceDateKey BETWEEN 20260601 AND 20260630 THEN NetAmount ELSE 0 END) AS ByInvoiceDate
      FROM fact.Fact_Returns WHERE IsVoided = 0
    `);
    const row = r.recordset[0];
    console.log(`June 2026 returns (BS): by return date ${row.ByReturnDate}, by original factura date ${row.ByInvoiceDate}`);
    expect(Number(row.ByReturnDate)).toBeGreaterThan(0);
    expect(Number(row.ByInvoiceDate)).toBeGreaterThan(0);
  });
});
