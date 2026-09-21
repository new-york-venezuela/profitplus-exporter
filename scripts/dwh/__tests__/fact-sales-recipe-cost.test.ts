import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { eq } from 'drizzle-orm';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';
import { loadRecipeCostSnapshots } from '../../dwh-recipe-cost-load';
import { getDb } from '@/lib/db/sqlite';
import { recipes, recipeLines } from '@/lib/db/schema';
import { computeProductCost } from '@/lib/costing/product-cost';

process.env.DW_NAME = `DWH_AlimentosNY_Test_recipe_cost_${Date.now()}`;

// Real ERP articles, chosen because both are already exercised elsewhere in
// this suite as known-good: '0000002' (Pizza Margarita Individual 270gr) has
// real sales history in saFacturaVentaReng, and '0000084' (Harina Panadera
// 45Kg (Aveiro)) has real saCostoHistoricoEntrada purchase layers. Any
// pre-existing recipe on this product is deleted first so this test is
// collision-proof regardless of what real recipes exist in the app's
// (shared, non-test-isolated) SQLite database.
const TEST_PRODUCT_CO_ART = '0000002';
const TEST_INGREDIENT_CO_ART = '0000084';

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

describe('Recipe cost -> Fact_Sales pipeline', () => {
  let dwhPool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;
  let recipeId: number;

  beforeAll(async () => {
    await runDwhMigrations();
    dwhPool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();

    await dwhPool.request().execute('dwh.Load_Dim_Currency');
    await dwhPool.request().execute('dwh.Load_Dim_Customer');
    await dwhPool.request().execute('dwh.Load_Dim_Product');
    await dwhPool.request().execute('dwh.Load_Dim_SalesRep');
    await dwhPool.request().execute('dwh.Load_Dim_Warehouse');

    const db = getDb();
    db.delete(recipes).where(eq(recipes.coArt, TEST_PRODUCT_CO_ART)).run();
    const now = Date.now();
    const created = db.insert(recipes).values({
      coArt: TEST_PRODUCT_CO_ART, label: 'Test fixture — do not keep', active: true, createdAt: now, updatedAt: now,
    }).returning({ id: recipes.id }).get()!;
    recipeId = created.id;
    db.insert(recipeLines).values({
      recipeId, lineType: 'erp_article', coArt: TEST_INGREDIENT_CO_ART, manualLabel: null,
      quantity: 0.1, unit: 'KG', manualUnitCostUsd: null, sortOrder: 0,
    }).run();
  }, 60_000);

  afterAll(async () => {
    const db = getDb();
    db.delete(recipes).where(eq(recipes.id, recipeId)).run();

    await dwhPool.close();
    await erpPool.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  test('loadRecipeCostSnapshots writes one row to stg.RecipeCostSnapshot matching computeProductCost', async () => {
    const expected = await computeProductCost(erpPool, [
      { lineType: 'erp_article', coArt: TEST_INGREDIENT_CO_ART, quantity: 0.1, manualUnitCostUsd: null },
    ]);

    const result = await loadRecipeCostSnapshots({ sqliteDb: getDb(), erpPool, dwhPool });
    expect(result.recipesProcessed).toBeGreaterThanOrEqual(1);

    const snapshot = await dwhPool.request()
      .input('code', sql.Char(30), TEST_PRODUCT_CO_ART)
      .query(`SELECT TOP 1 RawMaterialCostUsd, Incomplete, RawMaterialEstimated FROM stg.RecipeCostSnapshot WHERE ProductCode = @code ORDER BY SnapshotAtUtc DESC`);
    expect(snapshot.recordset).toHaveLength(1);
    expect(Number(snapshot.recordset[0].RawMaterialCostUsd)).toBeCloseTo(expected.rawMaterialCostUsd!, 5);
    expect(Boolean(snapshot.recordset[0].RawMaterialEstimated)).toBe(expected.rawMaterialEstimated);
  });

  test('loadRecipeCostSnapshots also mirrors the recipe\'s lines into stg.RecipeLine', async () => {
    await loadRecipeCostSnapshots({ sqliteDb: getDb(), erpPool, dwhPool });

    const rows = await dwhPool.request()
      .input('code', sql.Char(30), TEST_PRODUCT_CO_ART)
      .query(`SELECT LineType, IngredientCode, Quantity FROM stg.RecipeLine WHERE ProductCode = @code`);
    expect(rows.recordset).toHaveLength(1);
    expect(rows.recordset[0].LineType).toBe('erp_article');
    expect((rows.recordset[0].IngredientCode as string).trim()).toBe(TEST_INGREDIENT_CO_ART);
    expect(Number(rows.recordset[0].Quantity)).toBeCloseTo(0.1, 5);
  });

  test('Load_Fact_Sales + the automatic backfill populate cost columns for the recipe product, leaving other products untouched', async () => {
    await loadRecipeCostSnapshots({ sqliteDb: getDb(), erpPool, dwhPool });
    await dwhPool.request().execute('dwh.Load_Fact_Sales');

    const rows = await dwhPool.request()
      .input('code', sql.Char(30), TEST_PRODUCT_CO_ART)
      .query(`
        SELECT fs.UnitCost, fs.COGSAmount, fs.GrossProfitAmount, fs.NetAmount, fs.QuantitySold, fs.CostSourceFlag
        FROM fact.Fact_Sales fs
        JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
        WHERE p.ProductCode = @code
      `);
    expect(rows.recordset.length).toBeGreaterThan(0);
    for (const row of rows.recordset) {
      expect(row.CostSourceFlag).toBe('RECIPE_FIFO');
      expect(row.UnitCost).not.toBeNull();
      expect(Number(row.COGSAmount)).toBeCloseTo(Number(row.UnitCost) * Number(row.QuantitySold), 2);
      expect(Number(row.GrossProfitAmount)).toBeCloseTo(Number(row.NetAmount) - Number(row.COGSAmount), 2);
    }

    // A product with no recipe at all must remain untouched — this pipeline
    // must never invent a cost for a product it has no data for.
    const otherRows = await dwhPool.request().query(`
      SELECT TOP 1 CostSourceFlag FROM fact.Fact_Sales fs
      JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
      WHERE RTRIM(p.ProductCode) NOT IN ('${TEST_PRODUCT_CO_ART}')
        AND NOT EXISTS (SELECT 1 FROM stg.RecipeCostSnapshot s WHERE RTRIM(s.ProductCode) = RTRIM(p.ProductCode))
    `);
    if (otherRows.recordset.length > 0) {
      expect(otherRows.recordset[0].CostSourceFlag).toBe('NO_COST_DATA');
    }
  });

  test('re-running the recipe cost load and backfill is idempotent on row counts', async () => {
    await loadRecipeCostSnapshots({ sqliteDb: getDb(), erpPool, dwhPool });
    await dwhPool.request().execute('dwh.Load_Fact_Sales');
    const firstCount = await dwhPool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Sales`);

    await loadRecipeCostSnapshots({ sqliteDb: getDb(), erpPool, dwhPool });
    await dwhPool.request().execute('dwh.Load_Fact_Sales');
    const secondCount = await dwhPool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Sales`);

    expect(secondCount.recordset[0].total).toBe(firstCount.recordset[0].total);
  });
});
