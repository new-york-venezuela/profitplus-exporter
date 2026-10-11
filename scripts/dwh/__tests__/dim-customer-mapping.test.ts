import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';
import { upsertDwhMapping } from '../../../lib/customer-mapping/dwh';

process.env.DW_NAME = `DWH_AlimentosNY_Test_dim_customer_mapping_${Date.now()}`;

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

describe('Dim_CustomerMapping', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    await pool.request().execute('dwh.Load_Dim_Customer');
  }, 60_000);

  afterAll(async () => {
    await pool.close();
    const master = await new sql.ConnectionPool(testConfig('master')).connect();
    await master.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];`);
    await master.close();
  });

  test('upsert inserts then updates; the view exposes group/type/parent next to the dimension row', async () => {
    const pick = await pool.request().query(`SELECT TOP 1 RTRIM(CustomerCode) AS code FROM dim.Dim_Customer WHERE IsCurrent = 1`);
    const code: string = pick.recordset[0].code;
    const row = (grupo: string) => ({
      coCli: code, nombre: 'X', coVen: '', grupo, tipoCliente: 'Cadena' as const,
      clientePrincipal: 'Gama', effectiveFrom: '2026-03-01', sourceNote: '',
    });
    await upsertDwhMapping(pool, [row('Supermercado')]);
    await upsertDwhMapping(pool, [row('Farmacia')]);

    const count = await pool.request().input('c', sql.Char(16), code)
      .query(`SELECT COUNT(*) AS n FROM dim.Dim_CustomerMapping WHERE RTRIM(CustomerCode) = RTRIM(@c)`);
    expect(count.recordset[0].n).toBe(1);

    const v = await pool.request().input('c', sql.Char(16), code)
      .query(`SELECT CustomerGroup, CustomerType, ParentCustomerName FROM dim.vw_Customer_Classified
              WHERE RTRIM(CustomerCode) = RTRIM(@c) AND IsCurrent = 1`);
    expect(v.recordset[0]).toMatchObject({ CustomerGroup: 'Farmacia', CustomerType: 'Cadena', ParentCustomerName: 'Gama' });
  });

  test('migration 0039 is re-runnable', async () => {
    await runDwhMigrations();
  });
});
