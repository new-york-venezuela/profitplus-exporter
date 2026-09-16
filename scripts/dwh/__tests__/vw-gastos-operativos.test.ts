// scripts/dwh/__tests__/vw-gastos-operativos.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';

// Runs against a dedicated throwaway database, never the real local/shared
// DWH_AlimentosNY -- afterAll drops this database unconditionally, which
// would otherwise wipe a real dev DWH someone else migrated/loaded.
// dwhDatabaseName() reads DW_NAME, so setting it before calling
// runDwhMigrations() routes every migrate-dwh.ts call in this file at the
// throwaway DB instead.
process.env.DW_NAME = `DWH_AlimentosNY_Test_vw_gastos_operativos_${Date.now()}`;

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

describe('dwh.vw_GastosOperativos', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    await pool.request().execute('dwh.Load_Dim_Currency');
    await pool.request().execute('dwh.Load_Dim_Customer');
    await pool.request().execute('dwh.Load_Dim_LegalEntity');
    await pool.request().execute('dwh.Load_Dim_Product');
    await pool.request().execute('dwh.Load_Dim_SalesRep');
    await pool.request().execute('dwh.Load_Dim_Warehouse');
    await pool.request().execute('dwh.Load_Dim_ExpenseConcept');
    await pool.request().execute('dwh.Load_Dim_Supplier');
    await pool.request().execute('dwh.Load_Fact_Purchases');
    await pool.request().execute('dwh.Load_Fact_CashMovements');
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

  test('four commission concepts are reclassified to Category = Comisiones, IsExcludedFromEbitda unchanged (0)', async () => {
    const result = await pool.request().query(`
      SELECT ConceptCode, Category, IsExcludedFromEbitda
      FROM dim.Dim_ExpenseConcept
      WHERE ConceptCode IN ('E-217', 'E-213', '134', 'E-111')
    `);
    expect(result.recordset.length).toBe(4);
    for (const row of result.recordset) {
      expect(row.Category).toBe('Comisiones');
      expect(row.IsExcludedFromEbitda).toBe(false);
    }
  });

  test('E-217 keeps its CostCenter = Ventas after reclassification', async () => {
    const result = await pool.request().query(`
      SELECT CostCenter FROM dim.Dim_ExpenseConcept WHERE ConceptCode = 'E-217'
    `);
    expect(result.recordset[0].CostCenter).toBe('Ventas');
  });

  test('the view contains Compras rows sourced from Fact_Purchases', async () => {
    const result = await pool.request().query(`
      SELECT COUNT(*) AS total FROM dwh.vw_GastosOperativos WHERE Category = 'Compras' AND SourceFact = 'Fact_Purchases'
    `);
    const fpCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Purchases WHERE IsVoided = 0`);
    expect(Number(result.recordset[0].total)).toBe(Number(fpCount.recordset[0].total));
  });

  test('the view never contains MateriaPrima (replaced by Compras, not merged)', async () => {
    const result = await pool.request().query(`
      SELECT COUNT(*) AS total FROM dwh.vw_GastosOperativos WHERE Category = 'MateriaPrima'
    `);
    expect(Number(result.recordset[0].total)).toBe(0);
  });

  test('the view never contains Intereses/Impuestos/DiferencialCambiario (excluded by definition)', async () => {
    const result = await pool.request().query(`
      SELECT COUNT(*) AS total FROM dwh.vw_GastosOperativos
      WHERE Category IN ('Intereses', 'Impuestos', 'DiferencialCambiario')
    `);
    expect(Number(result.recordset[0].total)).toBe(0);
  });

  test('the view sums to the same total as the two source queries combined', async () => {
    const viewTotal = await pool.request().query(`SELECT SUM(Amount) AS total FROM dwh.vw_GastosOperativos`);
    const purchasesTotal = await pool.request().query(`SELECT SUM(NetAmount) AS total FROM fact.Fact_Purchases WHERE IsVoided = 0`);
    const cashTotal = await pool.request().query(`
      SELECT SUM(fe.Amount) AS total
      FROM fact.Fact_CashMovements fe
      JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
      WHERE fe.IsVoided = 0 AND ec.ConceptType = 'Gasto' AND ec.IsExcludedFromEbitda = 0 AND ec.Category <> 'MateriaPrima'
    `);
    const expected = Number(purchasesTotal.recordset[0].total ?? 0) + Number(cashTotal.recordset[0].total ?? 0);
    expect(Number(viewTotal.recordset[0].total ?? 0)).toBeCloseTo(expected, 2);
  });

  test('Compras (Fact_Purchases) total is materially larger than the excluded cash-ledger MateriaPrima total — the core fix this view exists to establish', async () => {
    const viewCompras = await pool.request().query(`
      SELECT SUM(Amount) AS total FROM dwh.vw_GastosOperativos WHERE Category = 'Compras'
    `);
    const cashLedgerMateriaPrima = await pool.request().query(`
      SELECT SUM(fe.Amount) AS total
      FROM fact.Fact_CashMovements fe
      JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
      WHERE fe.IsVoided = 0 AND ec.Category = 'MateriaPrima'
    `);
    const comprasTotal = Number(viewCompras.recordset[0].total ?? 0);
    const materiaPrimaTotal = Number(cashLedgerMateriaPrima.recordset[0].total ?? 0);
    // The whole reason this view replaces MateriaPrima with Fact_Purchases is
    // that the cash ledger dramatically undercounts real purchase spend
    // (Profit Plus records invoices reliably but not their bank settlement
    // promptly). If a future change silently reverted to the old cash-ledger
    // union, this ratio would collapse toward 1x and this test would catch it.
    expect(materiaPrimaTotal).toBeGreaterThan(0); // sanity: the comparison baseline isn't itself empty/broken
    expect(comprasTotal).toBeGreaterThan(materiaPrimaTotal * 1.5);
  });
});
