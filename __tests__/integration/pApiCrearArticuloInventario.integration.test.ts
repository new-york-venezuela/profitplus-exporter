process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterEach, afterAll } from 'bun:test';
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
const createdArticles: string[] = [];

async function callProcedure(params: {
  coArt: string; artDes: string; tipo: string; coLin: string; coSubl: string;
  coCat: string; coUni: string;
}) {
  const request = pool.request();
  request.input('sCoArt', sql.Char(30), params.coArt);
  request.input('sArtDes', sql.VarChar(120), params.artDes);
  request.input('sTipo', sql.Char(1), params.tipo);
  request.input('sCoLin', sql.Char(6), params.coLin);
  request.input('sCoSubl', sql.Char(6), params.coSubl);
  request.input('sCoCat', sql.Char(6), params.coCat);
  request.input('sCoUni', sql.Char(6), params.coUni);
  request.input('sCoUsIn', sql.Char(6), 'PROFIT');
  request.input('sCoSucuIn', sql.Char(6), null);
  return request.execute('pApiCrearArticuloInventario');
}

async function cleanupArticle(coArt: string): Promise<void> {
  await pool.request().input('a', sql.Char(30), coArt)
    .query(`DELETE FROM saStockAlmacen WHERE co_art = @a`);
  await pool.request().input('a', sql.Char(30), coArt)
    .query(`DELETE FROM saArtUnidad WHERE co_art = @a`);
  await pool.request().input('a', sql.Char(30), coArt)
    .query(`DELETE FROM saArticulo WHERE co_art = @a`);
}

async function nextTestCoArt(): Promise<string> {
  const result = await pool.request()
    .query(`SELECT MAX(TRY_CAST(co_art AS BIGINT)) AS maxCode FROM saArticulo WHERE TRY_CAST(co_art AS BIGINT) IS NOT NULL`);
  const next = Number(result.recordset[0].maxCode ?? 0) + 1;
  return String(next).padStart(7, '0');
}

async function realLookupRow(): Promise<{ coLin: string; coSubl: string; coCat: string; coUni: string }> {
  const linResult = await pool.request().query(`SELECT TOP 1 co_lin FROM saLineaArticulo`);
  const coLin = (linResult.recordset[0].co_lin as string).trim();
  const sublResult = await pool.request().input('lin', sql.Char(6), coLin)
    .query(`SELECT TOP 1 co_subl FROM saSubLinea WHERE co_lin = @lin`);
  const coSubl = (sublResult.recordset[0].co_subl as string).trim();
  const catResult = await pool.request().query(`SELECT TOP 1 co_cat FROM saCatArticulo`);
  const coCat = (catResult.recordset[0].co_cat as string).trim();
  const uniResult = await pool.request().query(`SELECT TOP 1 co_uni FROM saUnidad`);
  const coUni = (uniResult.recordset[0].co_uni as string).trim();
  return { coLin, coSubl, coCat, coUni };
}

beforeAll(async () => {
  await runMigrations();
  pool = await new sql.ConnectionPool(buildTestConfig()).connect();
});

afterEach(async () => {
  while (createdArticles.length > 0) {
    await cleanupArticle(createdArticles.pop()!);
  }
});

afterAll(async () => {
  if (pool?.connected) await pool.close();
});

describe('pApiCrearArticuloInventario @mssql', () => {
  test('creates a saArticulo row and a matching single-unit saArtUnidad row', async () => {
    const coArt = await nextTestCoArt();
    const lookup = await realLookupRow();

    await callProcedure({
      coArt, artDes: 'Test Article Integration', tipo: 'M',
      coLin: lookup.coLin, coSubl: lookup.coSubl, coCat: lookup.coCat, coUni: lookup.coUni,
    });
    createdArticles.push(coArt);

    const articleCheck = await pool.request().input('a', sql.Char(30), coArt)
      .query(`SELECT art_des, tipo, anulado, co_color, co_ubicacion FROM saArticulo WHERE co_art = @a`);
    expect(articleCheck.recordset).toHaveLength(1);
    expect((articleCheck.recordset[0].art_des as string).trim()).toBe('Test Article Integration');
    expect((articleCheck.recordset[0].tipo as string).trim()).toBe('M');
    expect(articleCheck.recordset[0].anulado).toBe(false);
    expect((articleCheck.recordset[0].co_color as string).trim()).toBe('GEN');
    expect((articleCheck.recordset[0].co_ubicacion as string).trim()).toBe('00001');

    const unitCheck = await pool.request().input('a', sql.Char(30), coArt)
      .query(`SELECT co_uni, relacion, equivalencia, uni_principal, uso_principal FROM saArtUnidad WHERE co_art = @a`);
    expect(unitCheck.recordset).toHaveLength(1);
    expect((unitCheck.recordset[0].co_uni as string).trim()).toBe(lookup.coUni);
    expect(unitCheck.recordset[0].relacion).toBe(false);
    expect(Number(unitCheck.recordset[0].equivalencia)).toBe(1);
    expect(unitCheck.recordset[0].uni_principal).toBe(true);
    expect(unitCheck.recordset[0].uso_principal).toBe(true);
  });

  test('rejects a duplicate co_art and leaves no partial insert', async () => {
    const coArt = await nextTestCoArt();
    const lookup = await realLookupRow();

    await callProcedure({
      coArt, artDes: 'First insert', tipo: 'M',
      coLin: lookup.coLin, coSubl: lookup.coSubl, coCat: lookup.coCat, coUni: lookup.coUni,
    });
    createdArticles.push(coArt);

    await expect(callProcedure({
      coArt, artDes: 'Duplicate attempt', tipo: 'M',
      coLin: lookup.coLin, coSubl: lookup.coSubl, coCat: lookup.coCat, coUni: lookup.coUni,
    })).rejects.toThrow();

    const articleCheck = await pool.request().input('a', sql.Char(30), coArt)
      .query(`SELECT art_des FROM saArticulo WHERE co_art = @a`);
    expect(articleCheck.recordset).toHaveLength(1);
    expect((articleCheck.recordset[0].art_des as string).trim()).toBe('First insert');
  });

  test('a failure in the unit insert rolls back the article insert too', async () => {
    const coArt = await nextTestCoArt();
    const lookup = await realLookupRow();

    await expect(callProcedure({
      coArt, artDes: 'Should roll back', tipo: 'M',
      coLin: lookup.coLin, coSubl: lookup.coSubl, coCat: lookup.coCat,
      coUni: 'NOEXIST',
    })).rejects.toThrow();

    const articleCheck = await pool.request().input('a', sql.Char(30), coArt)
      .query(`SELECT 1 FROM saArticulo WHERE co_art = @a`);
    expect(articleCheck.recordset).toHaveLength(0);
  });
});
