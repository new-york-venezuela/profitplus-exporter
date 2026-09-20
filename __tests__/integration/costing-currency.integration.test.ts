import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { getUsdRateAsOf, convertBsdToUsd } from '@/lib/costing/currency';

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
let latestUsdTasa: { fecha: Date; tasa_v: number };

beforeAll(async () => {
  pool = await new sql.ConnectionPool(buildMssqlConfig()).connect();
  const result = await pool.request()
    .query(`SELECT TOP 1 fecha, tasa_v FROM saTasa WHERE co_mone = 'USD' ORDER BY fecha DESC`);
  latestUsdTasa = result.recordset[0];
});

afterAll(async () => {
  await pool.close();
});

describe('getUsdRateAsOf', () => {
  test('returns the most recent USD rate on or before the given date', async () => {
    const asOf = new Date(latestUsdTasa.fecha.getTime() + 24 * 60 * 60 * 1000); // one day after the latest known rate
    const result = await getUsdRateAsOf(pool, asOf);
    expect(result).not.toBeNull();
    expect(result!.rate).toBeCloseTo(latestUsdTasa.tasa_v, 5);
  });

  test('returns null when asked for a date before any USD rate exists', async () => {
    const result = await getUsdRateAsOf(pool, new Date('1999-01-01'));
    expect(result).toBeNull();
  });
});

describe('convertBsdToUsd', () => {
  test('divides the BSD amount by the rate (Bs per 1 USD)', () => {
    expect(convertBsdToUsd(721.35, 721.35)).toBeCloseTo(1, 5);
    expect(convertBsdToUsd(1000, 500)).toBeCloseTo(2, 5);
  });
});
