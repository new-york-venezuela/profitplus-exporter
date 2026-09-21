import sql from 'mssql';
import { eq } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { getDb } from '@/lib/db/sqlite';
import { recipes, recipeLines } from '@/lib/db/schema';
import * as schema from '@/lib/db/schema';
import { getPool } from '@/lib/db/mssql';
import { computeProductCost, type RecipeLineInput } from '@/lib/costing/product-cost';
import { buildConfig, dwhDatabaseName } from './migrate-dwh';

// The only DWH data source that isn't pure T-SQL against Ncake_a — see
// dwh-migrations/0031_stg_recipe_cost_snapshot.sql for why. This computes one
// cost snapshot per active recipe (via the app's own SQLite DB + a live FIFO
// walk over the ERP pool) and inserts them into stg.RecipeCostSnapshot on
// the DWH pool. Pools/db are injectable so tests can point this at throwaway
// databases instead of the real ones.
export async function loadRecipeCostSnapshots(params: {
  sqliteDb: BunSQLiteDatabase<typeof schema>;
  erpPool: sql.ConnectionPool;
  dwhPool: sql.ConnectionPool;
}): Promise<{ recipesProcessed: number }> {
  const { sqliteDb, erpPool, dwhPool } = params;
  const snapshotAt = new Date();

  const activeRecipes = sqliteDb.select().from(recipes).where(eq(recipes.active, true)).all();

  await dwhPool.request().query(`TRUNCATE TABLE stg.RecipeLine`);

  for (const recipe of activeRecipes) {
    const lines = sqliteDb.select().from(recipeLines)
      .where(eq(recipeLines.recipeId, recipe.id))
      .orderBy(recipeLines.sortOrder)
      .all();

    for (const line of lines) {
      await dwhPool.request()
        .input('productCode', sql.Char(30), recipe.coArt)
        .input('lineType', sql.VarChar(20), line.lineType)
        .input('ingredientCode', sql.Char(30), line.coArt)
        .input('quantity', sql.Decimal(18, 5), line.quantity)
        .input('manualUnitCostUsd', sql.Decimal(18, 5), line.manualUnitCostUsd)
        .query(`
          INSERT INTO stg.RecipeLine (ProductCode, LineType, IngredientCode, Quantity, ManualUnitCostUsd)
          VALUES (@productCode, @lineType, @ingredientCode, @quantity, @manualUnitCostUsd)
        `);
    }

    const input: RecipeLineInput[] = lines.map(l => ({
      lineType: l.lineType,
      coArt: l.coArt,
      quantity: l.quantity,
      manualUnitCostUsd: l.manualUnitCostUsd,
    }));

    const cost = await computeProductCost(erpPool, input);

    await dwhPool.request()
      .input('productCode', sql.Char(30), recipe.coArt)
      .input('recipeId', sql.Int, recipe.id)
      .input('totalCostUsd', sql.Decimal(18, 5), cost.totalUsd)
      .input('rawMaterialCostUsd', sql.Decimal(18, 5), cost.rawMaterialCostUsd)
      .input('incomplete', sql.Bit, cost.incomplete)
      .input('rawMaterialEstimated', sql.Bit, cost.rawMaterialEstimated)
      .input('asOfRateDateUtc', sql.DateTime2(3), cost.asOfRateDate ? new Date(cost.asOfRateDate) : null)
      .input('snapshotAtUtc', sql.DateTime2(3), snapshotAt)
      .query(`
        INSERT INTO stg.RecipeCostSnapshot
          (ProductCode, RecipeId, TotalCostUsd, RawMaterialCostUsd, Incomplete, RawMaterialEstimated, AsOfRateDateUtc, SnapshotAtUtc)
        VALUES
          (@productCode, @recipeId, @totalCostUsd, @rawMaterialCostUsd, @incomplete, @rawMaterialEstimated, @asOfRateDateUtc, @snapshotAtUtc)
      `);
  }

  // Fact_Sales's own MERGE only re-evaluates rows whose ERP source changed
  // (watermark-gated) — it won't revisit an already-loaded invoice line just
  // because a fresher/new snapshot showed up here. Running this afterward
  // keeps existing Fact_Sales rows' cost columns in sync unconditionally,
  // including a product's historical sales the very first time it gets a
  // recipe. See dwh-migrations/0032_fact_sales_recipe_cost.sql.
  await dwhPool.request().execute('dwh.Backfill_Fact_Sales_RecipeCost');

  return { recipesProcessed: activeRecipes.length };
}

async function main() {
  const dwhPool = await new sql.ConnectionPool(buildConfig(dwhDatabaseName())).connect();
  const erpPool = await getPool();
  try {
    const result = await loadRecipeCostSnapshots({ sqliteDb: getDb(), erpPool, dwhPool });
    console.log(`✓ Recipe cost snapshots loaded: ${result.recipesProcessed} active recipe(s)`);
  } finally {
    await dwhPool.close();
  }
}

if (import.meta.main) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('✗ Error loading recipe cost snapshots:', error);
      process.exit(1);
    });
}
