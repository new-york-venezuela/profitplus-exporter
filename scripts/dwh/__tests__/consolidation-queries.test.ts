import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';
import { fetchSellerCoverage } from '../../../lib/dwh/seller-coverage';
import { buildDateWhereClause } from '../../../app/api/dwh/lib/query-builder';
import { coberturaCustomersQuery } from '../../../lib/clientes/cobertura-sql';

process.env.DW_NAME = `DWH_AlimentosNY_Test_consolidation_${Date.now()}`;

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

// Synthetic warehouse (Oct 2026 unless noted). Legal entities: LE1 'Cadena Uno' (C1, C2), LE2 (C3), LE3 (C4).
//   C1  S1 Abasto      route 3  seller V1  registered 2026-03-28 (migration batch)  SEMANAL
//   C2  S1 Abasto      route 3  seller V1  registered 2026-05-10                     no frequency
//       (C2 has an OLD version in S2 / route 4 that I3 points at)
//   C3  S2 Restaurante route 4  seller V2  registered 2020-01-01                     MENSUAL
//   C4  no group, no zone, seller V2, registered NULL, no frequency
//   C5  S1 Abasto      route 3  seller V1  registered 2026-06-01  (never invoiced)
// Products: P1 Panaderia/Artesanal/Fresco, P2 Panaderia/Industrial/Congelado, P3 Pizza/Industrial/Congelado.
// Invoices: I1 C1 P1 1000 (10-05, V1) | I2 C1 P2 500 (10-05, V1) | I3 C2old P1 2000 (10-06, V1) |
//           I4 C3 P3 700 (09-20, V2) | I5 C4 P1 300 (10-07, V2) | I7 C3 P1 400 (10-08, V2) | I6 C1 P1 9999 VOIDED (10-07).
async function seed(pool: sql.ConnectionPool) {
  await pool.request().batch(`
    ALTER TABLE fact.Fact_Sales NOCHECK CONSTRAINT ALL;
    INSERT INTO dim.Dim_Currency (CurrencyCode, CurrencyName, IsBaseCurrency) VALUES ('USD', 'Dolar', 0), ('BSD', 'Bolivar', 1);
    DECLARE @usd int = (SELECT CurrencyKey FROM dim.Dim_Currency WHERE RTRIM(CurrencyCode) = 'USD');
    INSERT INTO fact.Fact_ExchangeRate (DateKey, CurrencyKey, RateBuy, RateSell)
      VALUES (20260920, @usd, 50, 50), (20261005, @usd, 50, 50), (20261006, @usd, 50, 50), (20261007, @usd, 50, 50), (20261008, @usd, 50, 50);
    INSERT INTO dim.Dim_SalesRep (SalesRepCode, SalesRepName, IsSalesperson, IsCollector, IsInactive)
      VALUES ('V1', 'Ana', 1, 0, 0), ('V2', 'Beto', 1, 0, 0);
    DECLARE @v1 int = (SELECT SalesRepKey FROM dim.Dim_SalesRep WHERE RTRIM(SalesRepCode) = 'V1');
    DECLARE @v2 int = (SELECT SalesRepKey FROM dim.Dim_SalesRep WHERE RTRIM(SalesRepCode) = 'V2');
    INSERT INTO dim.Dim_Zone (ZoneCode, ZoneName, IsRoute, RouteNumber) VALUES ('CCS003', 'Ruta 3', 1, 3), ('CCS004', 'Ruta 4', 1, 4);
    INSERT INTO dim.Dim_Segment (ErpSegmentCode, SegmentName) VALUES ('S1', 'Abasto'), ('S2', 'Restaurante');
    INSERT INTO dim.Dim_LegalEntity (RootCustomerCode, LegalEntityName, StoreCount)
      VALUES ('C1', 'Cadena Uno', 2), ('C3', 'Indep Dos', 1), ('C4', 'Indep Tres', 1);
    DECLARE @le1 int = (SELECT LegalEntityKey FROM dim.Dim_LegalEntity WHERE RTRIM(RootCustomerCode) = 'C1');
    DECLARE @le2 int = (SELECT LegalEntityKey FROM dim.Dim_LegalEntity WHERE RTRIM(RootCustomerCode) = 'C3');
    DECLARE @le3 int = (SELECT LegalEntityKey FROM dim.Dim_LegalEntity WHERE RTRIM(RootCustomerCode) = 'C4');
    INSERT INTO dim.Dim_Product (ProductCode, ProductName, LineCode, LineName, SubLineCode, SubLineName, CategoryCode, CategoryName, IsInactive, ValidFrom, IsCurrent)
      VALUES ('P1', 'Pan Baguette', 'L1', 'Panaderia', 'SL1', 'Artesanal', 'K1', 'Fresco', 0, '2020-01-01', 1),
             ('P2', 'Pan Molde', 'L1', 'Panaderia', 'SL2', 'Industrial', 'K2', 'Congelado', 0, '2020-01-01', 1),
             ('P3', 'Pizza Familiar', 'L2', 'Pizza', 'SL2', 'Industrial', 'K2', 'Congelado', 0, '2020-01-01', 1);
    INSERT INTO dim.Dim_Customer (CustomerCode, CustomerName, IsSpecialTaxpayer, IsLegalEntity, IsInactive, ValidFrom, ValidTo, IsCurrent,
                                  ZoneCode, ErpSegmentCode, DefaultSalesRepCode, LegalEntityKey, RegisteredDate, IsMigrationBatch, VisitFrequency)
      VALUES ('C1', 'Cliente Uno',  0, 0, 0, '2020-01-01', NULL,         1, 'CCS003', 'S1', 'V1', @le1, '2026-03-28', 1, 'SEMANAL'),
             ('C2', 'Cliente Dos',  0, 0, 0, '2020-01-01', '2026-09-01', 0, 'CCS004', 'S2', 'V2', @le1, '2026-05-10', 0, NULL),
             ('C2', 'Cliente Dos',  0, 0, 0, '2026-09-01', NULL,         1, 'CCS003', 'S1', 'V1', @le1, '2026-05-10', 0, NULL),
             ('C3', 'Cliente Tres', 0, 0, 0, '2020-01-01', NULL,         1, 'CCS004', 'S2', 'V2', @le2, '2020-01-01', 0, 'MENSUAL'),
             ('C4', 'Cliente Cuatro', 0, 0, 0, '2020-01-01', NULL,       1, NULL,     NULL, 'V2', @le3, NULL,         0, NULL),
             ('C5', 'Cliente Cinco', 0, 0, 0, '2020-01-01', NULL,        1, 'CCS003', 'S1', 'V1', NULL, '2026-06-01', 0, NULL);
    DECLARE @c1 int = (SELECT CustomerKey FROM dim.Dim_Customer WHERE CustomerCode = 'C1');
    DECLARE @c2old int = (SELECT CustomerKey FROM dim.Dim_Customer WHERE CustomerCode = 'C2' AND IsCurrent = 0);
    DECLARE @c3 int = (SELECT CustomerKey FROM dim.Dim_Customer WHERE CustomerCode = 'C3');
    DECLARE @c4 int = (SELECT CustomerKey FROM dim.Dim_Customer WHERE CustomerCode = 'C4');
    DECLARE @p1 int = (SELECT ProductKey FROM dim.Dim_Product WHERE ProductCode = 'P1');
    DECLARE @p2 int = (SELECT ProductKey FROM dim.Dim_Product WHERE ProductCode = 'P2');
    DECLARE @p3 int = (SELECT ProductKey FROM dim.Dim_Product WHERE ProductCode = 'P3');
    INSERT INTO fact.Fact_Sales (DateKey, CustomerKey, ProductKey, SalesRepKey, DocumentTypeKey, InvoiceNumber, LineNumber,
        QuantitySold, GrossAmount, DiscountAmount, TaxAmount, NetAmount, CostSourceFlag, IsVoided)
      VALUES (20261005, @c1,    @p1, @v1, 1, 'I1', 1, 10, 1000, 0, 0, 1000, 'NO_COST_DATA', 0),
             (20261005, @c1,    @p2, @v1, 1, 'I2', 1,  5,  500, 0, 0,  500, 'NO_COST_DATA', 0),
             (20261006, @c2old, @p1, @v1, 1, 'I3', 1, 20, 2000, 0, 0, 2000, 'NO_COST_DATA', 0),
             (20260920, @c3,    @p3, @v2, 1, 'I4', 1,  7,  700, 0, 0,  700, 'NO_COST_DATA', 0),
             (20261007, @c4,    @p1, @v2, 1, 'I5', 1,  3,  300, 0, 0,  300, 'NO_COST_DATA', 0),
             (20261008, @c3,    @p1, @v2, 1, 'I7', 1,  4,  400, 0, 0,  400, 'NO_COST_DATA', 0),
             (20261007, @c1,    @p1, @v1, 1, 'I6', 1, 99, 9999, 0, 0, 9999, 'NO_COST_DATA', 1);
  `);
}

describe('consolidation queries (disposable DWH)', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    await seed(pool);
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

  test('fetchSellerCoverage: pooled penetration, no dependency on CADENA/INDEPENDIENTES, worst gap first', async () => {
    // Window Sep-Oct: entities with sales = LE1, LE2, LE3 (3). Panaderia bought by LE1, LE2 (I7), LE3 = 3/3 = primera;
    // Pizza by LE2 only = 1/3 = segunda; baseline = (1 + 1/3) / 2. No Dim_Customer.SegmentCode is set anywhere.
    const rows = await fetchSellerCoverage(pool, buildDateWhereClause('custom:2026-09-01:2026-10-31', 'fs'));
    expect(rows.map(r => r.salesRepName)).toEqual(['Ana', 'Beto']);
    const [ana, beto] = rows;
    expect(ana.entitiesServed).toBe(1);                       // LE1 only
    expect(ana.ownPenetration).toBeCloseTo(0.5, 6);           // (LE1|Panaderia) / (1 entity x 2 tiered lines)
    expect(beto.entitiesServed).toBe(2);                      // LE2, LE3
    expect(beto.ownPenetration).toBeCloseTo(0.75, 6);         // (LE2|Pizza, LE2|Panaderia, LE3|Panaderia) / (2 x 2)
    expect(beto.baselinePenetration).toBeCloseTo((1 + 1 / 3) / 2, 6);
    expect(ana.gapVsBaseline).toBeLessThan(beto.gapVsBaseline!);
  });

  test('coberturaCustomersQuery: current rows only, route/group/frequency from the current row, period activity across SCD2 versions', async () => {
    const where = buildDateWhereClause('custom:2026-10-01:2026-10-07', 'fs');
    const result = await pool.request().query(coberturaCustomersQuery(false, where));
    const by = new Map(result.recordset.map(r => [String(r.CustomerCode).trim(), r]));
    // Migration 0035 itself seeds one consignment-store customer (J-301420608-24, current, never invoiced here);
    // only the synthetic codes are asserted. C2's old version is not a row.
    expect([...by.keys()].filter(k => k !== 'J-301420608-24').sort()).toEqual(['C1', 'C2', 'C3', 'C4', 'C5']);
    expect(result.recordset).toHaveLength(6);
    expect(by.get('C1')).toMatchObject({ RouteNumber: 3, GroupCode: 'S1', GroupName: 'Abasto', VisitIntervalDays: 7, InPeriod: 1 });
    // I3 points at C2's OLD key (S2 / route 4): activity counts for C2, attributes come from the CURRENT row (S1 / route 3).
    expect(by.get('C2')).toMatchObject({ RouteNumber: 3, GroupCode: 'S1', VisitIntervalDays: null, InPeriod: 1 });
    // C3's invoices are 09-20 and 10-08: both outside 10-01..10-07, but the last sale is still found.
    expect(by.get('C3')).toMatchObject({ InPeriod: 0, VisitIntervalDays: 30, LastDateKey: 20261008 });
    expect(by.get('C4')).toMatchObject({ RouteNumber: null, GroupName: null, RegisteredDate: null, InPeriod: 1 });
    expect(by.get('C5')).toMatchObject({ InPeriod: 0, LastDateKey: null });
  });
});
