import { getDwhPool } from '@/lib/db/dwh-mssql';
import type { ApiQueryParams } from './types';

export async function getUsdRate(): Promise<number | null> {
  try {
    const pool = await getDwhPool();
    const result = await pool
      .request()
      .query(
        `SELECT TOP 1 f.RateSell AS ExchangeRate
         FROM fact.Fact_ExchangeRate f
         JOIN dim.Dim_Currency c ON c.CurrencyKey = f.CurrencyKey
         WHERE f.DateKey = (SELECT MAX(DateKey) FROM fact.Fact_ExchangeRate)
           AND RTRIM(c.CurrencyCode) = 'USD'
         ORDER BY f.DateKey DESC`
      );
    return result.recordset?.[0]?.ExchangeRate ?? null;
  } catch {
    return null;
  }
}

export function buildDateWhereClause(
  dateRange: string,
  tableName: string = 'f'
): string {
  const days = dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
  // Adjust based on your DateKey format (if YYYYMMDD or similar)
  return `AND ${tableName}.DateKey >= CONVERT(INT, FORMAT(DATEADD(DAY, -${days}, GETDATE()), 'yyyyMMdd'))`;
}
