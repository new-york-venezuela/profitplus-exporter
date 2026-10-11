import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sql from 'mssql';
import { dwhDatabaseName, runDwhMigrations } from '../../migrate-dwh';
import { parseVisitFrequency, visitIntervalDays } from '../../../lib/customer-mapping/frequency';
import { routeNumberFromZone } from '../../../lib/customer-mapping/route-zones';
import { MIGRATION_CUTOVER_DATE } from '../../../lib/dwh/cutover';

process.env.DW_NAME = `DWH_AlimentosNY_Test_dim_customer_route_${Date.now()}`;

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

describe('0040: Dim_Customer route/frequency/registration, Dim_Zone, Dim_Segment', () => {
  let pool: sql.ConnectionPool;
  let erp: sql.ConnectionPool;

  const loadAll = async () => {
    await pool.request().execute('dwh.Load_Dim_Zone');
    await pool.request().execute('dwh.Load_Dim_Segment');
    await pool.request().execute('dwh.Load_Dim_Customer');
  };
  const resetWatermark = () => pool.request().query(
    `UPDATE dwh.EtlWatermark SET LastValidador = 0x0000000000000000 WHERE SourceTableName = 'saCliente'`);
  const total = async () => (await pool.request().query(`SELECT COUNT(*) AS n FROM dim.Dim_Customer`)).recordset[0].n as number;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erp = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
    await loadAll();
  }, 60_000);

  afterAll(async () => {
    try { await pool.close(); await erp.close(); } finally {
      const master = await new sql.ConnectionPool(testConfig('master')).connect();
      try {
        await master.request().query(`
          ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
          DROP DATABASE [${dwhDatabaseName()}];`);
      } finally { await master.close(); }
    }
  });

  test('PR #12 objects are dropped', async () => {
    const r = await pool.request().query(
      `SELECT OBJECT_ID('dim.Dim_CustomerMapping') AS t, OBJECT_ID('dim.vw_Customer_Classified') AS v`);
    expect(r.recordset[0]).toEqual({ t: null, v: null });
  });

  test('every current customer carries registration, migration-batch, route zone, frequency and segment code from the ERP', async () => {
    const e = await erp.request().query(`
      SELECT RTRIM(co_cli) AS code, CONVERT(char(10), CAST(fecha_reg AS date), 23) AS reg,
             RTRIM(co_zon) AS zone, RTRIM(frecu_vist) AS frec, RTRIM(co_seg) AS seg FROM saCliente`);
    const d = await pool.request().query(`
      SELECT RTRIM(CustomerCode) AS code, CONVERT(char(10), RegisteredDate, 23) AS reg, IsMigrationBatch,
             RTRIM(ZoneCode) AS zone, VisitFrequency, VisitIntervalDays, RTRIM(ErpSegmentCode) AS seg
      FROM dim.Dim_Customer WHERE IsCurrent = 1`);
    const byCode = new Map(d.recordset.map((x: { code: string }) => [x.code, x]));
    expect(e.recordset.length).toBeGreaterThan(0);
    for (const x of e.recordset as { code: string; reg: string; zone: string; frec: string | null; seg: string }[]) {
      const row = byCode.get(x.code) as Record<string, unknown>;
      const f = parseVisitFrequency(x.frec);
      expect(row.reg).toBe(x.reg);
      expect(row.IsMigrationBatch).toBe(x.reg === MIGRATION_CUTOVER_DATE);
      expect(row.zone).toBe(x.zone);
      expect(row.VisitFrequency).toBe(f);
      expect(row.VisitIntervalDays).toBe(visitIntervalDays(f));
      expect(row.seg).toBe(x.seg);
    }
  });

  test('Dim_Zone mirrors saZona; RouteNumber is set only for CCSnnn codes', async () => {
    const e = await erp.request().query(`SELECT RTRIM(co_zon) AS code, RTRIM(zon_des) AS name FROM saZona`);
    const d = await pool.request().query(`SELECT RTRIM(ZoneCode) AS code, ZoneName, IsRoute, RouteNumber FROM dim.Dim_Zone`);
    expect(d.recordset.length).toBe(e.recordset.length);
    for (const z of d.recordset as { code: string; ZoneName: string; IsRoute: boolean; RouteNumber: number | null }[]) {
      expect(z.RouteNumber).toBe(routeNumberFromZone(z.code));
      expect(z.IsRoute).toBe(routeNumberFromZone(z.code) !== null);
    }
  });

  test('Dim_Segment mirrors saSegmento', async () => {
    const e = await erp.request().query(`SELECT COUNT(*) AS n FROM saSegmento`);
    const d = await pool.request().query(`SELECT COUNT(*) AS n FROM dim.Dim_Segment`);
    expect(d.recordset[0].n).toBe(e.recordset[0].n);
  });

  test('re-running the loads, even with the customer watermark reset, creates no spurious versions', async () => {
    const before = await total();
    await loadAll();
    expect(await total()).toBe(before);
    await resetWatermark();
    await loadAll();
    expect(await total()).toBe(before);
  });

  test.each([
    ['VisitFrequency', `VisitFrequency = 'MENSUAL'`],
    ['RegisteredDate', `RegisteredDate = '2001-01-01'`],
    ['IsMigrationBatch', `IsMigrationBatch = 1 - IsMigrationBatch`],
  ])('drift in %s versions the customer (old row closed, new current row inserted)', async (_name, setClause) => {
    const pick = await pool.request().query(`SELECT TOP 1 CustomerKey, RTRIM(CustomerCode) AS code FROM dim.Dim_Customer
      WHERE IsCurrent = 1 AND RegisteredDate IS NOT NULL ORDER BY CustomerKey DESC`);
    const { CustomerKey, code } = pick.recordset[0];
    await pool.request().input('k', sql.Int, CustomerKey).query(`UPDATE dim.Dim_Customer SET ${setClause} WHERE CustomerKey = @k`);
    await resetWatermark();
    await loadAll();
    const rows = await pool.request().input('c', sql.Char(16), code).query(
      `SELECT CustomerKey, IsCurrent FROM dim.Dim_Customer WHERE RTRIM(CustomerCode) = RTRIM(@c) ORDER BY CustomerKey`);
    const old = rows.recordset.find((r: { CustomerKey: number }) => r.CustomerKey === CustomerKey);
    expect(old.IsCurrent).toBe(false);
    expect(rows.recordset.filter((r: { IsCurrent: boolean }) => r.IsCurrent)).toHaveLength(1);
  });

  test('0040 is re-runnable (all batches executed again, twice)', async () => {
    const text = readFileSync(join(import.meta.dir, '..', '..', '..', 'migrations', 'dwh', '0040_route_frequency_registration.sql'), 'utf8');
    const batches = text.split(/^\s*GO\s*$/im).map(b => b.trim()).filter(Boolean);
    for (let pass = 0; pass < 2; pass++) for (const b of batches) await pool.request().batch(b);
    await loadAll();
  });
});
