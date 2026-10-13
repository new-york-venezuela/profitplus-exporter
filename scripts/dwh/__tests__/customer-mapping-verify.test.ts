import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';
import { findSellerMismatches, findRouteMismatches } from '../../../lib/customer-mapping/dwh';
import type { MappingRow } from '../../../lib/customer-mapping/types';

process.env.DW_NAME = `DWH_AlimentosNY_Test_cm_verify_${Date.now()}`;

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

const row = (coCli: string, coVen: string): MappingRow => ({
  coCli, nombre: 'X', coVen, grupo: 'G', ruta: 5, frecuencia: 'SEMANAL' });

describe('findSellerMismatches', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    // Seed minimal rows directly. FKs to date/product/doc-type/etc. are irrelevant to the
    // query under test, so they are disabled on the two fact tables for the seed.
    await pool.request().batch(`
      ALTER TABLE fact.Fact_Sales NOCHECK CONSTRAINT ALL;
      ALTER TABLE fact.Fact_Returns NOCHECK CONSTRAINT ALL;
      INSERT INTO dim.Dim_SalesRep (SalesRepCode, IsSalesperson, IsCollector, IsInactive)
        VALUES ('007', 1, 0, 0), ('009', 1, 0, 0);
      INSERT INTO dim.Dim_Customer (CustomerCode, IsSpecialTaxpayer, IsLegalEntity, IsInactive, ValidFrom, IsCurrent)
        VALUES ('C-WRONG', 0,0,0,'2020-01-01',1), ('C-VOID',0,0,0,'2020-01-01',1),
               ('C-NULL',0,0,0,'2020-01-01',1), ('C-OLD',0,0,0,'2020-01-01',1),
               ('C-OK',0,0,0,'2020-01-01',1), ('C-Pad',0,0,0,'2020-01-01',1);
      DECLARE @r7 int = (SELECT SalesRepKey FROM dim.Dim_SalesRep WHERE SalesRepCode='007');
      DECLARE @r9 int = (SELECT SalesRepKey FROM dim.Dim_SalesRep WHERE SalesRepCode='009');
      DECLARE @c TABLE (code varchar(16), k int);
      INSERT @c SELECT RTRIM(CustomerCode), CustomerKey FROM dim.Dim_Customer;
      -- (customer, date, rep, voided, invoice)
      INSERT INTO fact.Fact_Sales (DateKey, CustomerKey, ProductKey, SalesRepKey, DocumentTypeKey, InvoiceNumber, LineNumber,
          QuantitySold, GrossAmount, DiscountAmount, TaxAmount, NetAmount, CostSourceFlag, IsVoided)
      SELECT v.d, c.k, 1, v.rep, 1, v.inv, v.ln, 1,0,0,0,0,'NO_COST_DATA', v.voided
      FROM (VALUES
        ('C-WRONG', 20260401, @r9, 0, 'I1', 1), ('C-WRONG', 20260402, @r9, 0, 'I2', 1),
        ('C-VOID',  20260401, @r9, 1, 'I3', 1),
        ('C-OLD',   20250101, @r9, 0, 'I4', 1),
        ('C-OK',    20260401, @r7, 0, 'I5', 1),
        ('C-Pad',   20260401, @r9, 0, 'I6', 1)
      ) v(code, d, rep, voided, inv, ln) JOIN @c c ON c.code = v.code;
      INSERT INTO fact.Fact_Returns (DateKey, CustomerKey, ProductKey, SalesRepKey, DocumentTypeKey, CreditNoteNumber, LineNumber,
          QuantityReturned, GrossAmount, DiscountAmount, TaxAmount, NetAmount, IsVoided)
      SELECT 20260403, c.k, 1, NULL, 1, 'N1', 1, 1,0,0,0,0, 0 FROM @c c WHERE c.code = 'C-NULL';`);
  }, 60_000);

  afterAll(async () => {
    try { await pool.close(); } finally {
      const master = await new sql.ConnectionPool(testConfig('master')).connect();
      try {
        await master.request().query(`
          ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
          DROP DATABASE [${dwhDatabaseName()}];`);
      } finally { await master.close(); }
    }
  });

  test('reports real mismatches only', async () => {
    const rows = [
      row('C-WRONG', '7'), row('C-VOID', '7'), row('C-NULL', '7'), row('C-OLD', '7'),
      row('C-OK', '7'),            // '007' in DWH vs '7' in mapping: equivalent
      row('  c-pad  ', '7'),       // padded / lower-case code still compared
      row('C-NOSELLER', ''),       // no expected seller: never flagged
    ];
    const out = await findSellerMismatches(pool, rows, 20260101);
    const sorted = out.sort((a, b) => a.coCli.localeCompare(b.coCli));
    expect(sorted).toEqual([
      { table: 'Fact_Returns', coCli: 'C-NULL', expected: '7', actual: null, n: 1 },
      { table: 'Fact_Sales', coCli: 'C-Pad', expected: '7', actual: '009', n: 1 },
      { table: 'Fact_Sales', coCli: 'C-WRONG', expected: '7', actual: '009', n: 2 },
    ]);
  });

  test('findRouteMismatches reads the CURRENT Dim_Customer row', async () => {
    await pool.request().batch(`
      INSERT INTO dim.Dim_Customer (CustomerCode, IsSpecialTaxpayer, IsLegalEntity, IsInactive, ValidFrom, ValidTo, IsCurrent, ZoneCode, DefaultSalesRepCode, VisitFrequency)
        VALUES ('C-RT', 0,0,0,'2020-01-01','2021-01-01',0,'CCS',  '009', NULL),
               ('C-RT', 0,0,0,'2021-01-01',NULL,      1,'CCS005','007', 'SEMANAL');`);
    const mk = (o: Partial<MappingRow>): MappingRow => ({ ...row('C-RT', '7'), ...o });
    expect(await findRouteMismatches(pool, [mk({ ruta: 5 })])).toEqual([]);
    expect(await findRouteMismatches(pool, [mk({ ruta: 6, frecuencia: 'MENSUAL' })])).toEqual([
      { coCli: 'C-RT', field: 'ZoneCode', expected: 'CCS006', actual: 'CCS005' },
      { coCli: 'C-RT', field: 'VisitFrequency', expected: 'MENSUAL', actual: 'SEMANAL' },
    ]);
  });
});
