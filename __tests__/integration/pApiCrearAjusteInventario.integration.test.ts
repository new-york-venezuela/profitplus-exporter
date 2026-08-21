import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import sql from 'mssql';
import { runMigrations } from '@/scripts/migrate-mssql';

function buildTestConfig(): sql.config {
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

let pool: sql.ConnectionPool;
let testArticle: { co_art: string; co_uni: string };
let stockSnapshot: number;
let secondArticle: { co_art: string; co_uni: string } | null = null;
let secondStockSnapshot: number | null = null;
let pricedArticle: { co_art: string; co_uni: string; expectedCost: number } | null = null;
const WAREHOUSE = '14';

function buildLineasTable(lines: Array<{
  co_tipo: string; co_art: string; co_alma: string; co_uni: string;
  total_art: number; cost_unit: number | null; permitir_negativo: boolean;
}>): sql.Table {
  const table = new sql.Table('AjusteInventarioLineaType');
  table.columns.add('co_tipo', sql.Char(6));
  table.columns.add('co_art', sql.Char(30));
  table.columns.add('co_alma', sql.Char(6));
  table.columns.add('co_uni', sql.Char(6));
  table.columns.add('total_art', sql.Decimal(18, 5));
  table.columns.add('cost_unit', sql.Decimal(18, 5));
  table.columns.add('permitir_negativo', sql.Bit);
  for (const line of lines) {
    table.rows.add(
      line.co_tipo, line.co_art, line.co_alma, line.co_uni,
      line.total_art, line.cost_unit, line.permitir_negativo,
    );
  }
  return table;
}

async function callProcedure(lines: Parameters<typeof buildLineasTable>[0]) {
  const request = pool.request();
  request.input('sMotivo', sql.VarChar(80), 'Integration test adjustment');
  request.input('dtFecha', sql.SmallDateTime, new Date());
  request.input('sCoUsIn', sql.Char(6), 'PROFIT');
  request.input('sCoSucuIn', sql.Char(6), null);
  request.input('Lineas', buildLineasTable(lines));
  request.output('sAjueNumOut', sql.Char(20));
  return request.execute('pApiCrearAjusteInventario');
}

async function getStock(coArt: string, coAlma: string): Promise<number> {
  const result = await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .input('coAlma', sql.Char(6), coAlma)
    .query(`SELECT stock FROM saStockAlmacen WHERE co_art = @coArt AND co_alma = @coAlma AND tipo = 'ACT'`);
  return result.recordset[0]?.stock ?? 0;
}

async function getAjusNumProxN(): Promise<number> {
  const result = await pool.request().query(`
    SELECT S.prox_n
    FROM saConsecutivo C
    JOIN saSerie S ON S.co_serie = C.co_serie
    WHERE C.co_consecutivo = 'AJUS_NUM'
  `);
  return Number(result.recordset[0].prox_n);
}

async function restoreStock(coArt: string, coAlma: string, value: number): Promise<void> {
  await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .input('coAlma', sql.Char(6), coAlma)
    .input('value', sql.Decimal(18, 5), value)
    .query(`UPDATE saStockAlmacen SET stock = @value WHERE co_art = @coArt AND co_alma = @coAlma AND tipo = 'ACT'`);
}

async function cleanupAjuste(ajueNum: string): Promise<void> {
  // The stored procedure's write path (via pInsertarRenglonesAjusteEntradaSalida ->
  // pCostoActualizarEntrada/Salida) inserts FIFO cost-layer rows into
  // saCostoHistoricoEntrada/saCostoHistoricoSalida tagged tipo_doc='AJUS', with
  // doc_orig set to the *line's* saAjusteReng.rowguid (not the ajue_num string and
  // not saAjuste.rowguid — verified against pInsertarRenglonesAjusteEntradaSalida's
  // and pCostoActualizarEntrada/Salida's live definitions). These must be deleted
  // while the saAjusteReng rows they reference still exist, and before saAjusteReng
  // itself is deleted, or the join to find them is lost.
  //
  // saCostoHistoricoSalida and saCostoHistoricoEntrada also cross-reference each
  // other (FK_saCostoHistoricoSalida_saCostoHistoricoEntrada via
  // cod_costo_historico_entrada); deleting Salida rows before Entrada rows keeps
  // this FK-safe.
  await pool.request().input('n', sql.Char(20), ajueNum)
    .query(`
      DELETE CHS FROM saCostoHistoricoSalida CHS
      JOIN saAjusteReng AR ON AR.rowguid = CHS.doc_orig
      WHERE CHS.tipo_doc = 'AJUS' AND AR.ajue_num = @n
    `);
  await pool.request().input('n', sql.Char(20), ajueNum)
    .query(`
      DELETE CHE FROM saCostoHistoricoEntrada CHE
      JOIN saAjusteReng AR ON AR.rowguid = CHE.doc_orig
      WHERE CHE.tipo_doc = 'AJUS' AND AR.ajue_num = @n
    `);
  await pool.request().input('n', sql.Char(20), ajueNum)
    .query(`DELETE FROM saAjusteReng WHERE ajue_num = @n`);
  await pool.request().input('n', sql.Char(20), ajueNum)
    .query(`DELETE FROM saAjuste WHERE ajue_num = @n`);
}

beforeAll(async () => {
  await runMigrations();
  pool = await new sql.ConnectionPool(buildTestConfig()).connect();

  const articleResult = await pool.request()
    .input('coAlma', sql.Char(6), WAREHOUSE)
    .query(`
      SELECT TOP 1 s.co_art, au.co_uni
      FROM saStockAlmacen s
      JOIN saArtUnidad au ON au.co_art = s.co_art
      WHERE s.co_alma = @coAlma AND s.tipo = 'ACT' AND s.stock > 10
    `);
  if (articleResult.recordset.length === 0) {
    throw new Error(`No article with stock > 10 found in warehouse ${WAREHOUSE} for test setup`);
  }
  testArticle = {
    co_art: (articleResult.recordset[0].co_art as string).trim(),
    co_uni: (articleResult.recordset[0].co_uni as string).trim(),
  };
  stockSnapshot = await getStock(testArticle.co_art, WAREHOUSE);

  const secondArticleResult = await pool.request()
    .input('coAlma', sql.Char(6), WAREHOUSE)
    .input('excludeArt', sql.Char(30), testArticle.co_art)
    .query(`
      SELECT TOP 1 s.co_art, au.co_uni
      FROM saStockAlmacen s
      JOIN saArtUnidad au ON au.co_art = s.co_art
      WHERE s.co_alma = @coAlma AND s.tipo = 'ACT' AND s.stock > 10
        AND s.co_art <> @excludeArt
    `);
  if (secondArticleResult.recordset.length > 0) {
    secondArticle = {
      co_art: (secondArticleResult.recordset[0].co_art as string).trim(),
      co_uni: (secondArticleResult.recordset[0].co_uni as string).trim(),
    };
    secondStockSnapshot = await getStock(secondArticle.co_art, WAREHOUSE);
  }

  // costo > 0 ensures this resolves to an article with a genuine, nonzero cost so
  // the test below actually exercises the cod_articulo_rowguid join instead of
  // passing vacuously via ISNULL(@cost_unit, 0) fallback matching an incidental 0 cost.
  const pricedArticleResult = await pool.request()
    .query(`
      SELECT TOP 1 A.co_art, au.co_uni, CHE.costo
      FROM saCostoHistoricoEntrada CHE
      JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
      JOIN saArtUnidad au ON au.co_art = A.co_art
      WHERE CHE.tipo_doc <> 'AJUS' AND CHE.costo > 0
      ORDER BY CHE.fecha_emision DESC
    `);
  if (pricedArticleResult.recordset.length > 0) {
    pricedArticle = {
      co_art: (pricedArticleResult.recordset[0].co_art as string).trim(),
      co_uni: (pricedArticleResult.recordset[0].co_uni as string).trim(),
      expectedCost: Number(pricedArticleResult.recordset[0].costo),
    };
  }
});

afterEach(async () => {
  await restoreStock(testArticle.co_art, WAREHOUSE, stockSnapshot);
  if (secondArticle && secondStockSnapshot !== null) {
    await restoreStock(secondArticle.co_art, WAREHOUSE, secondStockSnapshot);
  }
});

afterAll(async () => {
  if (pool?.connected) await pool.close();
});

describe('pApiCrearAjusteInventario', () => {
  test('creates a header, line, and updates stock for a single entrada line', async () => {
    const result = await callProcedure([{
      co_tipo: 'E00003', co_art: testArticle.co_art, co_alma: WAREHOUSE,
      co_uni: testArticle.co_uni, total_art: 5, cost_unit: null, permitir_negativo: false,
    }]);

    const ajueNum = (result.output.sAjueNumOut as string).trim();
    expect(ajueNum.length).toBeGreaterThan(0);

    const newStock = await getStock(testArticle.co_art, WAREHOUSE);
    expect(newStock).toBe(stockSnapshot + 5);

    const lineCheck = await pool.request().input('n', sql.Char(20), ajueNum)
      .query(`SELECT co_art, total_art FROM saAjusteReng WHERE ajue_num = @n`);
    expect(lineCheck.recordset).toHaveLength(1);
    expect((lineCheck.recordset[0].co_art as string).trim()).toBe(testArticle.co_art);

    await cleanupAjuste(ajueNum);
  });

  test('a single call with one entrada line and one salida line applies both correctly', async () => {
    if (!secondArticle || secondStockSnapshot === null) {
      throw new Error('Need a second distinct stocked article in warehouse 14 for the multi-line test');
    }

    const result = await callProcedure([
      {
        co_tipo: 'E00003', co_art: testArticle.co_art, co_alma: WAREHOUSE,
        co_uni: testArticle.co_uni, total_art: 3, cost_unit: null, permitir_negativo: false,
      },
      {
        co_tipo: 'S00005', co_art: secondArticle.co_art, co_alma: WAREHOUSE,
        co_uni: secondArticle.co_uni, total_art: 2, cost_unit: null, permitir_negativo: false,
      },
    ]);
    const ajueNum = (result.output.sAjueNumOut as string).trim();

    expect(await getStock(testArticle.co_art, WAREHOUSE)).toBe(stockSnapshot + 3);
    expect(await getStock(secondArticle.co_art, WAREHOUSE)).toBe(secondStockSnapshot - 2);

    const lineCheck = await pool.request().input('n', sql.Char(20), ajueNum)
      .query(`SELECT co_art FROM saAjusteReng WHERE ajue_num = @n ORDER BY reng_num`);
    expect(lineCheck.recordset).toHaveLength(2);

    await cleanupAjuste(ajueNum);
  });

  test('cost lookup resolves the most recent saCostoHistoricoEntrada entry for a priced article', async () => {
    if (!pricedArticle) {
      throw new Error('No article with saCostoHistoricoEntrada rows found for this test scenario');
    }

    const beforeStock = await getStock(pricedArticle.co_art, WAREHOUSE);
    const result = await callProcedure([{
      co_tipo: 'E00003', co_art: pricedArticle.co_art, co_alma: WAREHOUSE,
      co_uni: pricedArticle.co_uni, total_art: 1, cost_unit: null, permitir_negativo: true,
    }]);
    const ajueNum = (result.output.sAjueNumOut as string).trim();

    const lineCheck = await pool.request().input('n', sql.Char(20), ajueNum)
      .query(`SELECT cost_unit FROM saAjusteReng WHERE ajue_num = @n`);
    expect(Number(lineCheck.recordset[0].cost_unit)).toBe(pricedArticle.expectedCost);

    await cleanupAjuste(ajueNum);
    await restoreStock(pricedArticle.co_art, WAREHOUSE, beforeStock);
  });

  test('rejects negative stock and leaves no trace (header, line, stock all unchanged)', async () => {
    const beforeCount = (await pool.request()
      .query(`SELECT COUNT(*) AS c FROM saAjuste`)).recordset[0].c;
    const proxNBefore = await getAjusNumProxN();

    await expect(callProcedure([{
      co_tipo: 'S00005', co_art: testArticle.co_art, co_alma: WAREHOUSE,
      co_uni: testArticle.co_uni, total_art: stockSnapshot + 1000,
      cost_unit: null, permitir_negativo: false,
    }])).rejects.toThrow();

    const afterCount = (await pool.request()
      .query(`SELECT COUNT(*) AS c FROM saAjuste`)).recordset[0].c;
    expect(afterCount).toBe(beforeCount);

    const stockAfter = await getStock(testArticle.co_art, WAREHOUSE);
    expect(stockAfter).toBe(stockSnapshot);

    // The consecutivo counter (advanced earlier in the same transaction by
    // pConsecutivoProximoOutPut, before the failing pStockActualizar call) must
    // also roll back — the design spec's all-or-nothing guarantee covers this
    // counter too, not just saAjuste/saAjusteReng/saStockAlmacen.
    const proxNAfter = await getAjusNumProxN();
    expect(proxNAfter).toBe(proxNBefore);
  });

  test('allows negative stock when permitir_negativo is true', async () => {
    const result = await callProcedure([{
      co_tipo: 'S00005', co_art: testArticle.co_art, co_alma: WAREHOUSE,
      co_uni: testArticle.co_uni, total_art: stockSnapshot + 100,
      cost_unit: null, permitir_negativo: true,
    }]);
    const ajueNum = (result.output.sAjueNumOut as string).trim();

    const newStock = await getStock(testArticle.co_art, WAREHOUSE);
    expect(newStock).toBe(-100);

    await cleanupAjuste(ajueNum);
  });

  test('falls back to cost 0 when cost_unit is null and no cost history exists', async () => {
    const noCostArticle = await pool.request()
      .query(`
        SELECT TOP 1 A.co_art
        FROM saArticulo A
        WHERE NOT EXISTS (SELECT 1 FROM saCostoHistoricoEntrada CHE WHERE CHE.cod_articulo_rowguid = A.rowguid)
          AND EXISTS (SELECT 1 FROM saArtUnidad au WHERE au.co_art = A.co_art)
      `);
    if (noCostArticle.recordset.length === 0) {
      throw new Error('No article without cost history found for this test scenario');
    }
    const coArt = (noCostArticle.recordset[0].co_art as string).trim();
    const uniResult = await pool.request().input('a', sql.Char(30), coArt)
      .query(`SELECT TOP 1 co_uni FROM saArtUnidad WHERE co_art = @a`);
    const coUni = (uniResult.recordset[0].co_uni as string).trim();

    const result = await callProcedure([{
      co_tipo: 'E00003', co_art: coArt, co_alma: WAREHOUSE,
      co_uni: coUni, total_art: 1, cost_unit: null, permitir_negativo: true,
    }]);
    const ajueNum = (result.output.sAjueNumOut as string).trim();

    const lineCheck = await pool.request().input('n', sql.Char(20), ajueNum)
      .query(`SELECT cost_unit FROM saAjusteReng WHERE ajue_num = @n`);
    expect(Number(lineCheck.recordset[0].cost_unit)).toBe(0);

    await cleanupAjuste(ajueNum);
    await restoreStock(coArt, WAREHOUSE, await getStock(coArt, WAREHOUSE) - 1);
  });

  test('the saTipoAjuste rows used above are seeded by migration 0003 as entrada/salida', async () => {
    const rows = await pool.request()
      .query(`SELECT co_tipo, tipo_trans FROM saTipoAjuste WHERE co_tipo IN ('E00003', 'S00005')`);
    const byCode = new Map(rows.recordset.map((r: { co_tipo: string; tipo_trans: string }) => [r.co_tipo.trim(), r.tipo_trans.trim()]));
    expect(byCode.get('E00003')).toBe('0');
    expect(byCode.get('S00005')).toBe('1');
  });
});
