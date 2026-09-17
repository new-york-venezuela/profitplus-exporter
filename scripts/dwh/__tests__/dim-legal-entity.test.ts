// scripts/dwh/__tests__/dim-legal-entity.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';

// Runs against a dedicated throwaway database, never the real local/shared
// DWH_AlimentosNY -- afterAll drops this database unconditionally, which
// would otherwise wipe a real dev DWH someone else migrated/loaded.
// dwhDatabaseName() reads DW_NAME, so setting it before calling
// runDwhMigrations() routes every migrate-dwh.ts call in this file at the
// throwaway DB instead.
process.env.DW_NAME = `DWH_AlimentosNY_Test_dim_legal_entity_${Date.now()}`;

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

describe('Dim_LegalEntity', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
    await pool.request().execute('dwh.Load_Dim_Customer');
    await pool.request().execute('dwh.Load_Dim_LegalEntity');
    // Needed by the repair-logic test below, which fabricates a synthetic
    // Fact_Sales row and needs a real ProductKey/DateKey to satisfy its FKs.
    await pool.request().execute('dwh.Load_Dim_Product');
  }, 60_000);

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

  test('every current Dim_Customer row has a non-null LegalEntityKey', async () => {
    const result = await pool.request().query(`
      SELECT COUNT(*) AS total FROM dim.Dim_Customer WHERE IsCurrent = 1 AND LegalEntityKey IS NULL
    `);
    expect(result.recordset[0].total).toBe(0);
  });

  test('a known multi-store chain (matriz populated in ERP) rolls up to one entity with correct StoreCount', async () => {
    // Find any parent code in the live ERP data that has at least 2 children
    // via matriz (verified live during design: Gama/Farmatodo/Plaza/Plansuárez
    // all qualify in the dev database).
    const chains = await erpPool.request().query(`
      SELECT LTRIM(RTRIM(matriz)) AS parentCode, COUNT(*) AS childCount
      FROM saCliente
      WHERE matriz IS NOT NULL AND LTRIM(RTRIM(matriz)) <> ''
      GROUP BY LTRIM(RTRIM(matriz))
      HAVING COUNT(*) >= 2
      ORDER BY COUNT(*) DESC
    `);
    expect(chains.recordset.length).toBeGreaterThan(0);
    const chain = chains.recordset[0];

    const entity = await pool.request()
      .input('rootCode', sql.Char(16), chain.parentCode)
      .query(`
        SELECT le.LegalEntityKey, le.StoreCount
        FROM dim.Dim_LegalEntity le
        WHERE RTRIM(le.RootCustomerCode) = @rootCode
      `);
    expect(entity.recordset.length).toBe(1);
    // StoreCount = parent (1) + all children
    expect(entity.recordset[0].StoreCount).toBe(1 + Number(chain.childCount));

    // All child rows resolve to that same LegalEntityKey
    const childrenResolved = await pool.request()
      .input('legalEntityKey', entity.recordset[0].LegalEntityKey)
      .input('rootCode', sql.Char(16), chain.parentCode)
      .query(`
        SELECT COUNT(*) AS total
        FROM dim.Dim_Customer c
        WHERE c.IsCurrent = 1 AND RTRIM(c.MatrizCode) = @rootCode AND c.LegalEntityKey = @legalEntityKey
      `);
    expect(childrenResolved.recordset[0].total).toBe(Number(chain.childCount));
  });

  test('a standalone customer (no matriz, not referenced as matriz) is its own entity of size 1', async () => {
    const standalone = await erpPool.request().query(`
      SELECT TOP 1 LTRIM(RTRIM(co_cli)) AS code
      FROM saCliente s
      WHERE (s.matriz IS NULL OR LTRIM(RTRIM(s.matriz)) = '')
        AND NOT EXISTS (
          SELECT 1 FROM saCliente child
          WHERE LTRIM(RTRIM(child.matriz)) = LTRIM(RTRIM(s.co_cli))
        )
    `);
    expect(standalone.recordset.length).toBe(1);
    const code = standalone.recordset[0].code;

    const entity = await pool.request()
      .input('code', sql.Char(16), code)
      .query(`
        SELECT le.StoreCount
        FROM dim.Dim_Customer c
        JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
        WHERE c.IsCurrent = 1 AND RTRIM(c.CustomerCode) = @code
      `);
    expect(entity.recordset.length).toBe(1);
    expect(entity.recordset[0].StoreCount).toBe(1);
  });

  test('re-running the load is idempotent', async () => {
    await pool.request().execute('dwh.Load_Dim_LegalEntity');
    const firstCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_LegalEntity`);

    await pool.request().execute('dwh.Load_Dim_LegalEntity');
    const secondCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_LegalEntity`);

    expect(secondCount.recordset[0].total).toBe(firstCount.recordset[0].total);
  });

  // Regression test for the production gap fixed by
  // 0028_backfill_matriz_code.sql, updated for 0030's behavior change:
  // Load_Dim_Customer now keeps MatrizCode in sync with an unconditional,
  // watermark-independent UPDATE on every run (folded in by
  // 0030_fix_matriz_scd2_and_repair_split_customers.sql), so a stuck NULL
  // MatrizCode self-heals on the very next incremental load -- a dedicated
  // backfill re-application is no longer required for this case. See the
  // "never mints a new CustomerKey" test below for the actual live-caught
  // bug 0030 fixed.
  test('a customer row stuck with NULL MatrizCode is self-healed by re-running the incremental load (no separate backfill needed since 0030)', async () => {
    const chain = (await erpPool.request().query(`
      SELECT TOP 1 LTRIM(RTRIM(matriz)) AS parentCode, LTRIM(RTRIM(co_cli)) AS childCode
      FROM saCliente
      WHERE matriz IS NOT NULL AND LTRIM(RTRIM(matriz)) <> ''
    `)).recordset[0];
    expect(chain).toBeDefined();

    // Simulate a stuck state: MatrizCode/LegalEntityKey wiped back to NULL
    // on an already-current row (e.g. as if inserted before MatrizCode
    // existed, pre-0014).
    await pool.request()
      .input('childCode', sql.Char(16), chain.childCode)
      .query(`
        UPDATE dim.Dim_Customer
        SET MatrizCode = NULL, LegalEntityKey = NULL
        WHERE RTRIM(CustomerCode) = @childCode AND IsCurrent = 1
      `);

    await pool.request().execute('dwh.Load_Dim_Customer');
    await pool.request().execute('dwh.Load_Dim_LegalEntity');

    const fixed = await pool.request()
      .input('childCode', sql.Char(16), chain.childCode)
      .query(`
        SELECT RTRIM(MatrizCode) AS matrizCode, LegalEntityKey FROM dim.Dim_Customer
        WHERE RTRIM(CustomerCode) = @childCode AND IsCurrent = 1
      `);
    expect(fixed.recordset[0].matrizCode).toBe(chain.parentCode);
    expect(fixed.recordset[0].LegalEntityKey).not.toBeNull();
  });

  // Regression test for the live-caught bug 0030 fixed: Load_Dim_Customer
  // used to treat MatrizCode as an SCD2-tracked attribute exactly like
  // CustomerName/CreditLimit -- any change closed out the current
  // Dim_Customer row and inserted a new one with a brand-new CustomerKey.
  // Reproduced live 2026-09-17: setting saCliente.matriz on an existing
  // customer and running the incremental load minted a new CustomerKey and
  // left the old one's LegalEntityKey frozen NULL forever (Load_Dim_
  // LegalEntity's backfill only ever touches IsCurrent = 1 rows) -- every
  // fact row still pointing at the old CustomerKey (all history up to that
  // point) then silently dropped out of every cliente_entidad-grouped
  // report. $4.96M / 142 rows for the case this was caught on. A matriz
  // change must never mint a new CustomerKey -- it should update the
  // current row in place, same CustomerKey, no SCD2 versioning event.
  test('setting matriz on an existing current customer updates MatrizCode in place -- it never mints a new CustomerKey', async () => {
    const standalone = (await erpPool.request().query(`
      SELECT TOP 1 LTRIM(RTRIM(co_cli)) AS code
      FROM saCliente s
      WHERE (s.matriz IS NULL OR LTRIM(RTRIM(s.matriz)) = '')
        AND NOT EXISTS (SELECT 1 FROM saCliente child WHERE LTRIM(RTRIM(child.matriz)) = LTRIM(RTRIM(s.co_cli)))
    `)).recordset[0];
    const anyOtherCustomer = (await erpPool.request().query(`
      SELECT TOP 1 LTRIM(RTRIM(co_cli)) AS code FROM saCliente
      WHERE LTRIM(RTRIM(co_cli)) <> '${standalone.code}'
    `)).recordset[0];
    expect(standalone).toBeDefined();
    expect(anyOtherCustomer).toBeDefined();

    const before = await pool.request()
      .input('code', sql.Char(16), standalone.code)
      .query(`SELECT CustomerKey FROM dim.Dim_Customer WHERE RTRIM(CustomerCode) = @code AND IsCurrent = 1`);
    const originalKey = before.recordset[0].CustomerKey;

    // Real-world action: someone sets matriz in the ERP on an existing
    // customer (the "add a casa matriz" scenario), then the normal
    // incremental load runs.
    await erpPool.request()
      .input('parentCode', sql.Char(16), anyOtherCustomer.code)
      .input('childCode', sql.Char(16), standalone.code)
      .query(`UPDATE saCliente SET matriz = @parentCode WHERE LTRIM(RTRIM(co_cli)) = @childCode`);
    try {
      await pool.request().execute('dwh.Load_Dim_Customer');

      const after = await pool.request()
        .input('code', sql.Char(16), standalone.code)
        .query(`
          SELECT CustomerKey, RTRIM(MatrizCode) AS matrizCode, IsCurrent
          FROM dim.Dim_Customer WHERE RTRIM(CustomerCode) = @code
        `);
      // Exactly one row for this CustomerCode -- no new version was minted.
      expect(after.recordset.length).toBe(1);
      expect(after.recordset[0].CustomerKey).toBe(originalKey);
      expect(after.recordset[0].IsCurrent).toBe(true);
      expect(after.recordset[0].matrizCode).toBe(anyOtherCustomer.code);
    } finally {
      // Restore ERP state so this test doesn't leak into other tests in
      // this file that assume standalone/chain customer shapes.
      await erpPool.request()
        .input('childCode', sql.Char(16), standalone.code)
        .query(`UPDATE saCliente SET matriz = NULL WHERE LTRIM(RTRIM(co_cli)) = @childCode`);
      await pool.request().execute('dwh.Load_Dim_Customer');
    }
  });

  // Regression test for 0030's Part 2 repair logic: customers already split
  // by the old MatrizCode-versioning bug (before this fix existed) need a
  // one-time merge back onto a single CustomerKey. Since this test DB was
  // created fresh with the fix already applied, it can't reproduce the split
  // naturally -- manually fabricate the exact "before" shape the repair is
  // meant to fix (a closed-out old version, identical to the current row in
  // every tracked attribute except MatrizCode, with fact rows still pointing
  // at the old key), then re-run the same repair statements 0030 applies.
  test('a customer already split by the old MatrizCode-versioning bug is merged back onto its current CustomerKey by the repair logic', async () => {
    const current = (await pool.request().query(`
      SELECT TOP 1 CustomerKey, CustomerCode FROM dim.Dim_Customer WHERE IsCurrent = 1
    `)).recordset[0];
    expect(current).toBeDefined();
    const product = (await pool.request().query(`SELECT TOP 1 ProductKey FROM dim.Dim_Product`)).recordset[0];
    const docType = (await pool.request().query(`SELECT TOP 1 DocumentTypeKey FROM dim.Dim_DocumentType`)).recordset[0];
    const dateKey = (await pool.request().query(`SELECT TOP 1 DateKey FROM dim.Dim_Date`)).recordset[0];
    expect(product).toBeDefined();
    expect(docType).toBeDefined();
    expect(dateKey).toBeDefined();

    // Fabricate a closed-out "old version" row for this same CustomerCode --
    // identical to the current row in every SCD2-tracked attribute, only
    // MatrizCode/LegalEntityKey/dates/IsCurrent differ, exactly what the old
    // bug would have produced.
    const oldKeyResult = await pool.request()
      .input('code', sql.Char(16), current.CustomerCode)
      .query(`
        INSERT INTO dim.Dim_Customer (
          CustomerCode, CustomerName, TaxId, LegalEntityRIF, IsSpecialTaxpayer, CreditLimit,
          CreditLimitCurrencyCode, ZoneCode, SegmentCode, DefaultSalesRepCode, IsLegalEntity,
          IsInactive, MatrizCode, LegalEntityKey, ValidFrom, ValidTo, IsCurrent
        )
        OUTPUT INSERTED.CustomerKey
        SELECT
          CustomerCode, CustomerName, TaxId, LegalEntityRIF, IsSpecialTaxpayer, CreditLimit,
          CreditLimitCurrencyCode, ZoneCode, SegmentCode, DefaultSalesRepCode, IsLegalEntity,
          IsInactive, NULL, NULL, DATEADD(day, -30, ValidFrom), DATEADD(day, -1, ValidFrom), 0
        FROM dim.Dim_Customer WHERE CustomerKey = @currentKey
      `.replace('@currentKey', String(current.CustomerKey)));
    const oldKey = oldKeyResult.recordset[0].CustomerKey;

    // Synthesize a minimal Fact_Sales row pointed at the fabricated old key,
    // as if it was loaded before the (fabricated) split happened.
    const factSalesKeyResult = await pool.request()
      .input('dateKey', dateKey.DateKey)
      .input('oldKey', oldKey)
      .input('productKey', product.ProductKey)
      .input('docTypeKey', docType.DocumentTypeKey)
      .query(`
        INSERT INTO fact.Fact_Sales (
          DateKey, CustomerKey, ProductKey, DocumentTypeKey, InvoiceNumber, LineNumber,
          QuantitySold, GrossAmount, DiscountAmount, TaxAmount, NetAmount, CostSourceFlag, IsVoided
        )
        OUTPUT INSERTED.FactSalesKey
        VALUES (
          @dateKey, @oldKey, @productKey, @docTypeKey, 'TEST-MATRIZ-MERGE  ', 1,
          1, 100, 0, 0, 100, 'NO_COST_DATA', 0
        )
      `);
    const factSalesKey = factSalesKeyResult.recordset[0].FactSalesKey;

    // Re-run 0030's Part 2 repair logic verbatim (same statements the
    // migration applies) against this fabricated split.
    await pool.request().batch(`
      IF OBJECT_ID('tempdb..#SplitCustomers') IS NOT NULL DROP TABLE #SplitCustomers;
      SELECT RTRIM(CustomerCode) AS CustomerCode, MIN(CustomerKey) AS AnyKey
      INTO #SplitCustomers
      FROM dim.Dim_Customer
      GROUP BY RTRIM(CustomerCode)
      HAVING COUNT(*) > 1;

      IF OBJECT_ID('tempdb..#SafeToMerge') IS NOT NULL DROP TABLE #SafeToMerge;
      SELECT sc.CustomerCode
      INTO #SafeToMerge
      FROM #SplitCustomers sc
      WHERE (SELECT COUNT(*) FROM dim.Dim_Customer c WHERE RTRIM(c.CustomerCode) = sc.CustomerCode AND c.IsCurrent = 1) = 1
        AND NOT EXISTS (
              SELECT 1
              FROM dim.Dim_Customer old
              CROSS JOIN (
                  SELECT TOP 1 * FROM dim.Dim_Customer cur
                  WHERE RTRIM(cur.CustomerCode) = sc.CustomerCode AND cur.IsCurrent = 1
              ) cur
              WHERE RTRIM(old.CustomerCode) = sc.CustomerCode
                AND old.IsCurrent = 0
                AND (
                      ISNULL(old.CustomerName, '') <> ISNULL(cur.CustomerName, '')
                   OR ISNULL(old.TaxId, '') <> ISNULL(cur.TaxId, '')
                   OR ISNULL(old.LegalEntityRIF, '') <> ISNULL(cur.LegalEntityRIF, '')
                   OR ISNULL(old.IsSpecialTaxpayer, 0) <> ISNULL(cur.IsSpecialTaxpayer, 0)
                   OR ISNULL(old.CreditLimit, -1) <> ISNULL(cur.CreditLimit, -1)
                   OR ISNULL(RTRIM(old.CreditLimitCurrencyCode), '') <> ISNULL(RTRIM(cur.CreditLimitCurrencyCode), '')
                   OR ISNULL(RTRIM(old.ZoneCode), '') <> ISNULL(RTRIM(cur.ZoneCode), '')
                   OR ISNULL(RTRIM(old.SegmentCode), '') <> ISNULL(RTRIM(cur.SegmentCode), '')
                   OR ISNULL(RTRIM(old.DefaultSalesRepCode), '') <> ISNULL(RTRIM(cur.DefaultSalesRepCode), '')
                   OR ISNULL(old.IsLegalEntity, 0) <> ISNULL(cur.IsLegalEntity, 0)
                   OR ISNULL(old.IsInactive, 0) <> ISNULL(cur.IsInactive, 0)
                )
            );

      UPDATE f SET f.CustomerKey = cur.CustomerKey
      FROM fact.Fact_Sales f
      JOIN dim.Dim_Customer old ON old.CustomerKey = f.CustomerKey AND old.IsCurrent = 0
      JOIN #SafeToMerge sm ON sm.CustomerCode = RTRIM(old.CustomerCode)
      JOIN dim.Dim_Customer cur ON RTRIM(cur.CustomerCode) = sm.CustomerCode AND cur.IsCurrent = 1;

      UPDATE f SET f.CustomerKey = cur.CustomerKey
      FROM fact.Fact_Returns f
      JOIN dim.Dim_Customer old ON old.CustomerKey = f.CustomerKey AND old.IsCurrent = 0
      JOIN #SafeToMerge sm ON sm.CustomerCode = RTRIM(old.CustomerCode)
      JOIN dim.Dim_Customer cur ON RTRIM(cur.CustomerCode) = sm.CustomerCode AND cur.IsCurrent = 1;

      UPDATE f SET f.CustomerKey = cur.CustomerKey
      FROM fact.Fact_Collections f
      JOIN dim.Dim_Customer old ON old.CustomerKey = f.CustomerKey AND old.IsCurrent = 0
      JOIN #SafeToMerge sm ON sm.CustomerCode = RTRIM(old.CustomerCode)
      JOIN dim.Dim_Customer cur ON RTRIM(cur.CustomerCode) = sm.CustomerCode AND cur.IsCurrent = 1;

      UPDATE f SET f.CustomerKey = cur.CustomerKey
      FROM fact.Fact_AR_Snapshot f
      JOIN dim.Dim_Customer old ON old.CustomerKey = f.CustomerKey AND old.IsCurrent = 0
      JOIN #SafeToMerge sm ON sm.CustomerCode = RTRIM(old.CustomerCode)
      JOIN dim.Dim_Customer cur ON RTRIM(cur.CustomerCode) = sm.CustomerCode AND cur.IsCurrent = 1;

      DELETE old
      FROM dim.Dim_Customer old
      JOIN #SafeToMerge sm ON sm.CustomerCode = RTRIM(old.CustomerCode)
      WHERE old.IsCurrent = 0;

      DROP TABLE #SafeToMerge;
      DROP TABLE #SplitCustomers;
    `);

    // The fabricated old row is gone, the real fact row is repointed at the
    // original current key, and the CustomerCode has exactly one row again.
    const remaining = await pool.request()
      .input('code', sql.Char(16), current.CustomerCode)
      .query(`SELECT CustomerKey, IsCurrent FROM dim.Dim_Customer WHERE RTRIM(CustomerCode) = RTRIM(@code)`);
    expect(remaining.recordset.length).toBe(1);
    expect(remaining.recordset[0].CustomerKey).toBe(current.CustomerKey);
    expect(remaining.recordset[0].IsCurrent).toBe(true);

    const repointedSale = await pool.request()
      .input('factSalesKey', factSalesKey)
      .query(`SELECT CustomerKey FROM fact.Fact_Sales WHERE FactSalesKey = @factSalesKey`);
    expect(repointedSale.recordset[0].CustomerKey).toBe(current.CustomerKey);
  });
});
