// scripts/dwh/__tests__/fact-cash-movements.test.ts
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

describe('Fact_CashMovements', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
    await pool.request().execute('dwh.Load_Dim_ExpenseConcept');
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

  test('I-01 Ventas is classified as operating income (IsExcludedFromEbitda = 0, Category = VentasOperativas)', async () => {
    const result = await pool.request().query(`
      SELECT Category, IsExcludedFromEbitda FROM dim.Dim_ExpenseConcept WHERE ConceptCode = 'I-01'
    `);
    expect(result.recordset[0].Category).toBe('VentasOperativas');
    expect(result.recordset[0].IsExcludedFromEbitda).toBe(false);
  });

  test('every other Ingreso concept is excluded from EBITDA', async () => {
    const result = await pool.request().query(`
      SELECT COUNT(*) AS total FROM dim.Dim_ExpenseConcept
      WHERE ConceptType = 'Ingreso' AND ConceptCode <> 'I-01' AND IsExcludedFromEbitda = 0
    `);
    expect(result.recordset[0].total).toBe(0);
  });

  test('Traspaso concepts (e.g. I-08) remain ConceptType = Traspaso, not reclassified as Ingreso', async () => {
    const result = await pool.request().query(`
      SELECT ConceptType FROM dim.Dim_ExpenseConcept WHERE ConceptCode = 'I-08'
    `);
    expect(result.recordset[0].ConceptType).toBe('Traspaso');
  });

  test('loads both Gasto and Ingreso rows from saMovimientoBanco/saMovimientoCaja, excluding Traspaso', async () => {
    await pool.request().execute('dwh.Load_Fact_CashMovements');

    const erpCount = await erpPool.request().query(`
      SELECT COUNT(*) AS total
      FROM (
        SELECT co_cta_ingr_egr FROM saMovimientoBanco
        UNION ALL
        SELECT co_cta_ingr_egr FROM saMovimientoCaja
      ) m
      INNER JOIN saCuentaIngEgr c ON LTRIM(RTRIM(c.co_cta_ingr_egr)) = LTRIM(RTRIM(m.co_cta_ingr_egr))
    `);
    // saCuentaIngEgr has no ConceptType column itself (that's a DWH-side
    // classification derived in Dim_ExpenseConcept), so this ERP-side count
    // is every movement joining to a known concept at all -- Fact_CashMovements
    // should be a subset of it (Traspaso-classified concepts excluded).
    const dwhCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_CashMovements`);
    expect(Number(dwhCount.recordset[0].total)).toBeGreaterThan(0);
    expect(Number(dwhCount.recordset[0].total)).toBeLessThanOrEqual(Number(erpCount.recordset[0].total));
  });

  test('an Ingreso row (I-01) has a negative Amount, matching the debit-minus-credit sign convention', async () => {
    await pool.request().execute('dwh.Load_Fact_CashMovements');

    const result = await pool.request().query(`
      SELECT TOP 1 fe.Amount
      FROM fact.Fact_CashMovements fe
      JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
      WHERE ec.ConceptCode = 'I-01' AND fe.IsVoided = 0
      ORDER BY fe.Amount ASC
    `);
    if (result.recordset.length === 0) return; // no I-01 movements in this dataset -- skip
    expect(Number(result.recordset[0].Amount)).toBeLessThan(0);
  });

  test('I-01 operating income total matches an independent ERP-side cross-check (sign and figure)', async () => {
    await pool.request().execute('dwh.Load_Fact_CashMovements');

    // Step 1: DWH-side total, same shape as route.ts's cashFlowIncomeQuery.
    const dwhResult = await pool.request().query(`
      SELECT SUM(-fe.Amount) AS total
      FROM fact.Fact_CashMovements fe
      JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
      WHERE fe.IsVoided = 0 AND ec.ConceptType = 'Ingreso' AND ec.IsExcludedFromEbitda = 0
    `);
    const dwhTotal = Number(dwhResult.recordset[0].total);

    // Step 2: independent ERP-side total, computed directly from the source
    // tables without going through the DWH's negation logic -- raw
    // monto_d - monto_h, not negated. Trim/collate pattern copied from
    // dwh-migrations/0023_fact_cash_movements.sql's Load_Fact_CashMovements.
    const erpResult = await erpPool.request().query(`
      SELECT SUM(ISNULL(m.monto_d, 0) - ISNULL(m.monto_h, 0)) AS total
      FROM (
        SELECT monto_d, monto_h, co_cta_ingr_egr, anulado FROM saMovimientoBanco
        UNION ALL
        SELECT monto_d, monto_h, co_cta_ingr_egr, anulado FROM saMovimientoCaja
      ) m
      WHERE LTRIM(RTRIM(m.co_cta_ingr_egr)) = 'I-01' AND ISNULL(m.anulado, 0) = 0
    `);
    const erpRawTotal = Number(erpResult.recordset[0].total);

    // The raw ERP sum nets negative for income (monto_d - monto_h); the
    // DWH-side query already negates once, so DWH total should equal the
    // NEGATIVE of the raw ERP sum.
    expect(dwhTotal).toBeCloseTo(-erpRawTotal, 2);

    // Catches a polarity flip even if the cross-check math above had a
    // subtle error: I-01 operating income must be positive.
    expect(dwhTotal).toBeGreaterThan(0);
  });

  test('re-running the load is idempotent when nothing changed', async () => {
    await pool.request().execute('dwh.Load_Fact_CashMovements');
    const firstCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_CashMovements`);

    await pool.request().execute('dwh.Load_Fact_CashMovements');
    const secondCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_CashMovements`);

    expect(secondCount.recordset[0].total).toBe(firstCount.recordset[0].total);
  });
});
