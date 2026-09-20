import sql from 'mssql';

export interface UsdRate {
  rate: number;
  date: Date;
}

export async function getUsdRateAsOf(pool: sql.ConnectionPool, asOf: Date): Promise<UsdRate | null> {
  const result = await pool.request()
    .input('asOf', sql.DateTime, asOf)
    .query(`
      SELECT TOP 1 fecha, tasa_v
      FROM saTasa
      WHERE co_mone = 'USD' AND fecha <= @asOf
      ORDER BY fecha DESC
    `);

  const row = result.recordset[0];
  if (!row) return null;

  return { rate: Number(row.tasa_v), date: new Date(row.fecha) };
}

/** `rate` is Bs per 1 USD (saTasa.tasa_v convention). */
export function convertBsdToUsd(amountBsd: number, rate: number): number {
  return amountBsd / rate;
}
