import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';

process.env.DW_NAME = `DWH_AlimentosNY_Test_fn_ingredient_cost_${Date.now()}`;

function dwhTestConfig(database: string): sql.config {
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

function erpTestConfig(): sql.config {
  return {
    server: process.env.DB_SERVER!,
    port: parseInt(process.env.DB_PORT ?? '1433'),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
    },
  };
}

async function callFn(dwhPool: sql.ConnectionPool, coArt: string, asOf: Date, qty: number) {
  const result = await dwhPool.request()
    .input('art', sql.Char(30), coArt)
    .input('asOf', sql.DateTime2(3), asOf)
    .input('qty', sql.Decimal(18, 5), qty)
    .query(`SELECT * FROM dwh.fn_IngredientCostAsOf(@art, @asOf, @qty)`);
  return result.recordset[0] as { CostBsd: number | null; HasData: boolean; Estimated: boolean };
}

describe('dwh.fn_IngredientCostAsOf', () => {
  let dwhPool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    dwhPool = await new sql.ConnectionPool(dwhTestConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(erpTestConfig()).connect();
  }, 60_000);

  afterAll(async () => {
    await dwhPool.close();
    await erpPool.close();
    const masterPool = await new sql.ConnectionPool(dwhTestConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  test('returns HasData = false and a null cost for a date before the article had any purchase history', async () => {
    const anyArticle = await erpPool.request().query(`
      SELECT TOP 1 A.co_art FROM saCostoHistoricoEntrada CHE
      JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
    `);
    const coArt = (anyArticle.recordset[0].co_art as string).trim();

    const row = await callFn(dwhPool, coArt, new Date('2000-01-01'), 1);
    expect(row.HasData).toBe(false);
    expect(row.CostBsd).toBeNull();
  });

  test('as-of "now" matches a hand-computed FIFO walk over the live cantidad_usada column', async () => {
    const article = await erpPool.request().query(`
      SELECT TOP 1 A.co_art
      FROM saCostoHistoricoEntrada CHE
      JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
      WHERE (CHE.cantidad - CHE.cantidad_usada) > 0
      GROUP BY A.co_art
      HAVING COUNT(*) >= 1
    `);
    if (article.recordset.length === 0) throw new Error('No article with remaining stock found for this test');
    const coArt = (article.recordset[0].co_art as string).trim();

    const layersResult = await erpPool.request()
      .input('art', sql.Char(30), coArt)
      .query(`
        SELECT CHE.costo, CHE.cantidad - CHE.cantidad_usada AS Remaining
        FROM saCostoHistoricoEntrada CHE
        JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
        WHERE A.co_art = @art AND (CHE.cantidad - CHE.cantidad_usada) > 0
        ORDER BY CHE.fecha_emision ASC
      `);
    const layers = layersResult.recordset as { costo: number; Remaining: number }[];
    const totalRemaining = layers.reduce((s, l) => s + Number(l.Remaining), 0);
    const quantity = totalRemaining / 2;

    let remainingNeeded = quantity;
    let expectedCostBsd = 0;
    for (const layer of layers) {
      if (remainingNeeded <= 0) break;
      const take = Math.min(Number(layer.Remaining), remainingNeeded);
      expectedCostBsd += take * Number(layer.costo);
      remainingNeeded -= take;
    }

    const row = await callFn(dwhPool, coArt, new Date(), quantity);
    expect(Number(row.CostBsd)).toBeCloseTo(expectedCostBsd, 2);
    expect(row.Estimated).toBe(false);
  });

  test('an earlier as-of date excludes later purchase layers, producing a different cost than "now"', async () => {
    const candidate = await erpPool.request().query(`
      SELECT TOP 1 A.co_art
      FROM saCostoHistoricoEntrada CHE
      JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
      GROUP BY A.co_art
      HAVING COUNT(DISTINCT CHE.fecha_emision) >= 2 AND COUNT(DISTINCT CHE.costo) >= 2
    `);
    if (candidate.recordset.length === 0) {
      throw new Error('No article with multiple differently-priced purchase layers found for this test');
    }
    const coArt = (candidate.recordset[0].co_art as string).trim();

    const layersResult = await erpPool.request()
      .input('art', sql.Char(30), coArt)
      .query(`
        SELECT CHE.fecha_emision, CHE.cantidad, CHE.costo
        FROM saCostoHistoricoEntrada CHE
        JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
        WHERE A.co_art = @art
        ORDER BY CHE.fecha_emision ASC
      `);
    const layers = layersResult.recordset as { fecha_emision: string; cantidad: number; costo: number }[];
    const earliestDate = new Date(layers[0]!.fecha_emision);
    const dayAfterEarliest = new Date(earliestDate.getTime() + 24 * 60 * 60 * 1000);

    // Use enough quantity to span multiple layers so point-in-time differences show
    // (at dayAfterEarliest, second layer doesn't exist yet, so shortfall is estimated;
    // at now, second layer exists and may have different price)
    let totalFirstLayer = Number(layers[0]!.cantidad);
    const quantity = layers.length > 1
      ? totalFirstLayer + Number(layers[1]!.cantidad) / 2
      : totalFirstLayer;

    const asOfEarly = await callFn(dwhPool, coArt, dayAfterEarliest, quantity);
    const asOfNow = await callFn(dwhPool, coArt, new Date(), quantity);

    expect(Number(asOfEarly.CostBsd)).not.toBeCloseTo(Number(asOfNow.CostBsd), 2);
  });
});
