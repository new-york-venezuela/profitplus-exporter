import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';
import {
  fetchCustomerInvoiceLines, fetchCustomers, fetchExcludedInvoices, fetchLineSales, fetchWeekActivity,
} from '../../../lib/seguimiento/queries';

process.env.DW_NAME = `DWH_AlimentosNY_Test_seguimiento_${Date.now()}`;

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

describe('seguimiento queries (disposable DWH)', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    // Minimal synthetic warehouse. FKs on the fact table are irrelevant to the queries under test.
    await pool.request().batch(`
      ALTER TABLE fact.Fact_Sales NOCHECK CONSTRAINT ALL;
      INSERT INTO dim.Dim_Currency (CurrencyCode, CurrencyName, IsBaseCurrency) VALUES ('USD', 'Dolar', 0), ('BSD', 'Bolivar', 1);
      DECLARE @usd int = (SELECT CurrencyKey FROM dim.Dim_Currency WHERE RTRIM(CurrencyCode) = 'USD');
      INSERT INTO fact.Fact_ExchangeRate (DateKey, CurrencyKey, RateBuy, RateSell)
        VALUES (20261005, @usd, 50, 50), (20261006, @usd, 50, 50), (20261007, @usd, 50, 50), (20261013, @usd, 50, 50);
      INSERT INTO dim.Dim_SalesRep (SalesRepCode, SalesRepName, IsSalesperson, IsCollector, IsInactive)
        VALUES ('V1', 'Ana', 1, 0, 0), ('V2', 'Beto', 1, 0, 0);
      INSERT INTO dim.Dim_Zone (ZoneCode, ZoneName, IsRoute, RouteNumber) VALUES ('CCS003', 'Ruta 3', 1, 3), ('CCS004', 'Ruta 4', 1, 4);
      INSERT INTO dim.Dim_Segment (ErpSegmentCode, SegmentName) VALUES ('S1', 'Abasto'), ('S2', 'Restaurante');
      INSERT INTO dim.Dim_Product (ProductCode, ProductName, LineCode, LineName, IsInactive, ValidFrom, IsCurrent)
        VALUES ('P1', 'Pan Baguette', 'L1', 'Panaderia', 0, '2020-01-01', 1), ('P2', 'Pizza Familiar', 'L2', 'Pizza', 0, '2020-01-01', 1);
      -- C2 has TWO versions: an old one (seller V2, route 4) that its September invoices point at, and the current one.
      INSERT INTO dim.Dim_Customer (CustomerCode, CustomerName, IsSpecialTaxpayer, IsLegalEntity, IsInactive, ValidFrom, ValidTo, IsCurrent,
                                    ZoneCode, ErpSegmentCode, DefaultSalesRepCode, RegisteredDate, IsMigrationBatch, VisitFrequency)
        VALUES ('C1', 'Cliente Uno',  0, 0, 0, '2020-01-01', NULL,         1, 'CCS003', 'S1', 'V1', '2026-10-02', 0, 'SEMANAL'),
               ('C2', 'Cliente Dos',  0, 0, 0, '2020-01-01', '2026-09-01', 0, 'CCS004', 'S2', 'V2', '2026-03-28', 1, NULL),
               ('C2', 'Cliente Dos',  0, 0, 0, '2026-09-01', NULL,         1, 'CCS003', 'S1', 'V1', '2026-03-28', 1, NULL),
               ('C3', 'Cliente Tres', 0, 0, 0, '2020-01-01', NULL,         1, 'CCS004', 'S2', 'V2', '2020-05-10', 0, 'MENSUAL');
      DECLARE @c1 int = (SELECT CustomerKey FROM dim.Dim_Customer WHERE CustomerCode = 'C1');
      DECLARE @c2old int = (SELECT CustomerKey FROM dim.Dim_Customer WHERE CustomerCode = 'C2' AND IsCurrent = 0);
      DECLARE @c3 int = (SELECT CustomerKey FROM dim.Dim_Customer WHERE CustomerCode = 'C3');
      DECLARE @p1 int = (SELECT ProductKey FROM dim.Dim_Product WHERE ProductCode = 'P1');
      DECLARE @p2 int = (SELECT ProductKey FROM dim.Dim_Product WHERE ProductCode = 'P2');
      INSERT INTO fact.Fact_Sales (DateKey, CustomerKey, ProductKey, DocumentTypeKey, InvoiceNumber, LineNumber,
          QuantitySold, GrossAmount, DiscountAmount, TaxAmount, NetAmount, CostSourceFlag, IsVoided)
        VALUES (20261005, @c1,    @p1, 1, 'I1', 1, 10, 1000, 0, 0, 1000, 'NO_COST_DATA', 0),
               (20261013, @c1,    @p2, 1, 'I2', 1,  5,  500, 0, 0,  500, 'NO_COST_DATA', 0),
               (20261006, @c2old, @p1, 1, 'I3', 1, 20, 2000, 0, 0, 2000, 'NO_COST_DATA', 0),
               (20260920, @c3,    @p1, 1, 'I4', 1,  7,  700, 0, 0,  700, 'NO_COST_DATA', 0),
               (20261007, @c1,    @p1, 1, 'I5', 1, 99, 9999, 0, 0, 9999, 'NO_COST_DATA', 1);
      -- A return of half of I1 (Panaderia). Seguimiento reports ventas BRUTAS (plan Global Constraints:
      -- SUM(Fact_Sales.NetAmount), before returns, same as vendedores/route.ts), so this row must NOT
      -- change any figure below; pinned by the 'gross sales' test.
      ALTER TABLE fact.Fact_Returns NOCHECK CONSTRAINT ALL;
      INSERT INTO fact.Fact_Returns (DateKey, CustomerKey, ProductKey, DocumentTypeKey, CreditNoteNumber, LineNumber,
          QuantityReturned, GrossAmount, DiscountAmount, TaxAmount, NetAmount, IsVoided)
        VALUES (20261008, @c1, @p1, 1, 'D1', 1, 5, 500, 0, 0, 500, 0);
    `);
  }, 90_000);

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

  test('fetchCustomers: one current row per customer, joined to seller, route and group', async () => {
    const rows = await fetchCustomers(pool, '2026-10-14');
    // Migration 0035 itself seeds one consignment-store customer (J-301420608-24); only the synthetic
    // C* customers are under test here (C2 has two SCD2 rows and must come back once).
    expect(rows.map(r => r.customerCode).filter(c => /^C\d$/.test(c)).sort()).toEqual(['C1', 'C2', 'C3']);
    const c1 = rows.find(r => r.customerCode === 'C1')!;
    expect(c1).toMatchObject({
      salesRepName: 'Ana', zoneCode: 'CCS003', routeNumber: 3, segmentCode: 'S1', segmentName: 'Abasto',
      registeredDate: '2026-10-02', isMigrationBatch: false, visitIntervalDays: 7, lastInvoiceDate: '2026-10-13', isInactive: false,
    });
    const c2 = rows.find(r => r.customerCode === 'C2')!;
    expect(c2).toMatchObject({ salesRepName: 'Ana', routeNumber: 3, isMigrationBatch: true, visitIntervalDays: null });
    expect(c2.lastInvoiceDate).toBe('2026-10-06');          // found through the OLD customer key
    expect(rows.find(r => r.customerCode === 'C3')).toMatchObject({ visitIntervalDays: 30, lastInvoiceDate: '2026-09-20' });
  });

  test('fetchCustomers: lastInvoiceDate respects asOf and ignores voided invoices', async () => {
    const rows = await fetchCustomers(pool, '2026-10-10');
    expect(rows.find(r => r.customerCode === 'C1')!.lastInvoiceDate).toBe('2026-10-05'); // I2 is after asOf, I5 is voided
  });

  test('fetchLineSales: attributes old-version invoices to the current customer, dual amounts, no voided', async () => {
    const rows = await fetchLineSales(pool, '2026-10');
    const key = (r: { customerCode: string; line: string | null }) => `${r.customerCode}|${r.line}`;
    const byKey = new Map(rows.map(r => [key(r), r]));
    expect(byKey.get('C1|Panaderia')).toMatchObject({ units: 10, sales: { bs: 1000, usd: 20 } });
    expect(byKey.get('C1|Pizza')).toMatchObject({ units: 5, sales: { bs: 500, usd: 10 } });
    expect(byKey.get('C2|Panaderia')).toMatchObject({ units: 20, sales: { bs: 2000, usd: 40 } });
    expect([...byKey.keys()].some(k => k.startsWith('C3'))).toBe(false);   // September sale is outside the month
    expect(rows).toHaveLength(3);
  });

  test('fetchWeekActivity: customer x ISO week pairs inside the window', async () => {
    const all = await fetchWeekActivity(pool, '2026-09-28', '2026-11-01');
    const pairs = all.map(a => `${a.customerCode}:${a.yearWeek}`).sort();
    expect(pairs).toEqual(['C1:2026-W41', 'C1:2026-W42', 'C2:2026-W41']);
    const week42 = await fetchWeekActivity(pool, '2026-10-12', '2026-10-18');
    expect(week42.map(a => `${a.customerCode}:${a.yearWeek}`)).toEqual(['C1:2026-W42']);
  });

  test('fetchCustomerInvoiceLines: lines of the customer for the month, through any SCD2 version', async () => {
    const c2 = await fetchCustomerInvoiceLines(pool, 'C2', '2026-10');
    expect(c2).toHaveLength(1);
    expect(c2[0]).toMatchObject({
      invoiceNumber: 'I3', invoiceDate: '2026-10-06', lineNumber: 1, productCode: 'P1', lineName: 'Panaderia',
      quantity: 20, amount: { bs: 2000, usd: 40 }, unitPrice: { bs: 100, usd: 2 },
    });
    const c1 = await fetchCustomerInvoiceLines(pool, 'C1', '2026-10');
    expect(c1.map(l => l.invoiceNumber)).toEqual(['I2', 'I1']);          // newest first, voided I5 excluded
  });

  test('user-controlled values are parameters: an injection attempt just matches nothing', async () => {
    expect(await fetchCustomerInvoiceLines(pool, "C1' OR '1'='1", '2026-10')).toEqual([]);
    expect(await fetchExcludedInvoices(pool, '2026-10', ["C1' --"])).toEqual([]);
  });

  test('fetchExcludedInvoices: invoice totals for the given codes only', async () => {
    const inv = await fetchExcludedInvoices(pool, '2026-10', ['C1']);
    expect(inv.map(i => [i.invoiceNumber, i.amountNet.bs, i.amountNet.usd])).toEqual([['I2', 500, 10], ['I1', 1000, 20]]);
    expect(await fetchExcludedInvoices(pool, '2026-10', [])).toEqual([]);
  });

  // --- Review carry-forwards (Tasks 1-3) ---

  test('dates come back date-only (visitCompliance/parseIso reject timestamps)', async () => {
    const rows = await fetchCustomers(pool, '2026-10-14');
    for (const r of rows) {
      if (r.lastInvoiceDate !== null) expect(r.lastInvoiceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (r.registeredDate !== null) expect(r.registeredDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    for (const l of await fetchCustomerInvoiceLines(pool, 'C1', '2026-10')) expect(l.invoiceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const i of await fetchExcludedInvoices(pool, '2026-10', ['C1'])) expect(i.invoiceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('gross sales: line sales are SUM(Fact_Sales.NetAmount), returns are not netted and amounts are never negative', async () => {
    const rows = await fetchLineSales(pool, '2026-10');
    const c1Pan = rows.find(r => r.customerCode === 'C1' && r.line === 'Panaderia')!;
    expect(c1Pan).toMatchObject({ units: 10, sales: { bs: 1000, usd: 20 } });   // the D1 return of 500 is not subtracted
    expect(rows.every(r => r.sales.bs >= 0 && r.units >= 0)).toBe(true);
  });

  test('week activity: keys equal Dim_Date.YearWeek, ISO weeks crossing the month count, voided-only weeks do not', async () => {
    // I4 (2026-09-20, a Sunday) belongs to ISO week 38 (Mon 2026-09-14 .. Sun 2026-09-20).
    const sept = await fetchWeekActivity(pool, '2026-09-14', '2026-09-20');
    expect(sept.map(a => `${a.customerCode}:${a.yearWeek}`)).toEqual(['C3:2026-W38']);
    // 2026-10-07 has only the voided I5: nobody is active from it.
    expect(await fetchWeekActivity(pool, '2026-10-07', '2026-10-07')).toEqual([]);
    const all = await fetchWeekActivity(pool, '2026-09-01', '2026-11-01');
    expect(all.every(a => /^\d{4}-W\d{2}$/.test(a.yearWeek))).toBe(true);
  });

  test('malformed month/date arguments are rejected before any SQL runs', async () => {
    await expect(fetchLineSales(pool, '2026-1; DROP TABLE x')).rejects.toThrow(/Mes inválido/);
    await expect(fetchWeekActivity(pool, '2026-10-01', "2026-10-31'; --")).rejects.toThrow(/Fecha inválida/);
  });
});
