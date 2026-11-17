import { buildLegacyConfig } from './dwh-legacy-2025-import';
import sql from 'mssql';

// Read-only diagnostic for the legacy (pre-March-2026-cutover) Profit Plus
// server. Run it before widening the Histórico import to 2020:
//   bun --env-file=.env.local scripts/dwh-legacy-probe.ts
// It only issues SELECTs. It answers: how far back do invoices/returns go,
// and what does saTasa (exchange rates) look like there.

async function main(): Promise<void> {
  const pool = await new sql.ConnectionPool(buildLegacyConfig()).connect();
  try {
    console.log('== saFacturaVenta: invoices per year (fec_emis) ==');
    console.table((await pool.request().query(`
      SELECT YEAR(fec_emis) AS Year, COUNT(*) AS Invoices,
             SUM(CASE WHEN ISNULL(anulado, 0) = 1 THEN 1 ELSE 0 END) AS Voided,
             MIN(fec_emis) AS FirstDate, MAX(fec_emis) AS LastDate
      FROM dbo.saFacturaVenta GROUP BY YEAR(fec_emis) ORDER BY 1
    `)).recordset);

    console.log('== saDevolucionCliente: returns per year (fec_emis) ==');
    console.table((await pool.request().query(`
      SELECT YEAR(fec_emis) AS Year, COUNT(*) AS Returns,
             MIN(fec_emis) AS FirstDate, MAX(fec_emis) AS LastDate
      FROM dbo.saDevolucionCliente GROUP BY YEAR(fec_emis) ORDER BY 1
    `)).recordset);

    console.log('== saTasa: rows per currency and year ==');
    console.table((await pool.request().query(`
      SELECT RTRIM(co_mone) AS Currency, YEAR(fecha) AS Year, COUNT(*) AS Rows,
             MIN(fecha) AS FirstDate, MAX(fecha) AS LastDate,
             MIN(tasa_v) AS MinSell, MAX(tasa_v) AS MaxSell
      FROM dbo.saTasa GROUP BY RTRIM(co_mone), YEAR(fecha) ORDER BY 1, 2
    `)).recordset);

    console.log('== saTasa USD: calendar days between first and last rate with NO row ==');
    console.table((await pool.request().query(`
      SELECT RTRIM(co_mone) AS Currency,
             DATEDIFF(day, MIN(fecha), MAX(fecha)) + 1 AS CalendarDays,
             COUNT(DISTINCT CONVERT(date, fecha)) AS DaysWithRow,
             DATEDIFF(day, MIN(fecha), MAX(fecha)) + 1 - COUNT(DISTINCT CONVERT(date, fecha)) AS DaysMissing
      FROM dbo.saTasa GROUP BY RTRIM(co_mone)
    `)).recordset);

    console.log('== saTasa USD: first and last 3 rates ==');
    console.table((await pool.request().query(`
      SELECT * FROM (
        SELECT TOP 3 fecha, tasa_c, tasa_v FROM dbo.saTasa WHERE RTRIM(co_mone) IN ('USD','US$') ORDER BY fecha ASC
      ) a
      UNION ALL
      SELECT * FROM (
        SELECT TOP 3 fecha, tasa_c, tasa_v FROM dbo.saTasa WHERE RTRIM(co_mone) IN ('USD','US$') ORDER BY fecha DESC
      ) b
    `)).recordset);

    console.log('== saTasa has a validador (rowversion) column? ==');
    console.table((await pool.request().query(`
      SELECT COUNT(*) AS HasValidador FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.saTasa') AND name = 'validador'
    `)).recordset);
  } finally {
    await pool.close();
  }
}

if (import.meta.main) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('✗ Legacy probe failed:', error);
      process.exit(1);
    });
}
