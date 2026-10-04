import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { getCostLayers } from '@/lib/costing/erp-layers';

function buildMssqlConfig(): sql.config {
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

beforeAll(async () => {
  pool = await new sql.ConnectionPool(buildMssqlConfig()).connect();
});

afterAll(async () => {
  await pool.close();
});

describe('getCostLayers', () => {
  test('returns layers for a real article, oldest first, with positive remaining only', async () => {
    const layers = await getCostLayers(pool, '0000083');
    expect(layers.length).toBeGreaterThan(0);
    for (const layer of layers) {
      expect(layer.remaining).toBeGreaterThan(0);
      expect(layer.costBsd).toBeGreaterThan(0);
    }

    // independently fetch raw rows to confirm oldest-first ordering matches fecha_emision
    const raw = await pool.request().input('coArt', sql.Char(30), '0000083').query(`
      SELECT CHE.cantidad, CHE.cantidad_usada, CHE.costo, CHE.fecha_emision
      FROM saCostoHistoricoEntrada CHE
      JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
      WHERE A.co_art = @coArt AND (CHE.cantidad - CHE.cantidad_usada) > 0
      ORDER BY CHE.fecha_emision ASC
    `);
    expect(layers).toHaveLength(raw.recordset.length);
    expect(layers[0]!.remaining).toBeCloseTo(raw.recordset[0]!.cantidad - raw.recordset[0]!.cantidad_usada, 5);
    expect(layers[0]!.costBsd).toBeCloseTo(raw.recordset[0]!.costo, 5);
  });

  test('returns an empty array for an article with no purchase history', async () => {
    const layers = await getCostLayers(pool, '0000080');
    expect(layers).toEqual([]);
  });

  test('returns an empty array for a nonexistent article code', async () => {
    const layers = await getCostLayers(pool, 'NOEXISTE999');
    expect(layers).toEqual([]);
  });
});
