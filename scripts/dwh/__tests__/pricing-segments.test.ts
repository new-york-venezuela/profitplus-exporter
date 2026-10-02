// scripts/dwh/__tests__/pricing-segments.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { getPool } from '@/lib/db/mssql';
import { nextTipCliCode } from '@/lib/pricing/segment-name';
import {
  listSegmentRows, getSegmentRow, listTipCliCodes, createSegmentErp, updateSegmentErp,
} from '@/lib/pricing/tipo-cliente';

// Writes to the ERP (creates and deletes a saTipoCliente row). Non-production only.
describe('pricing segments (ERP)', () => {
  let pool: sql.ConnectionPool;
  let tipCli = '';
  let priceA = '';
  let priceB = '';

  beforeAll(async () => {
    expect(process.env.DB_SERVER).toBe('localhost'); // refuse to run against anything but the local mock
    pool = await getPool();
    const lists = await pool.request().query(`SELECT TOP 2 RTRIM(co_precio) AS p FROM saTipoPrecio ORDER BY co_precio`);
    priceA = lists.recordset[0].p; priceB = lists.recordset[1].p;
    tipCli = nextTipCliCode(await listTipCliCodes(pool));
  });

  afterAll(async () => {
    if (tipCli) await pool.request().input('t', sql.Char(6), tipCli).query(`DELETE FROM saTipoCliente WHERE tip_cli = @t`);
  });

  test('create → list/get → rename+repoint → stale validador conflicts', async () => {
    await createSegmentErp(pool, { tipCli, desTipo: 'Prueba segmento', coPrecio: priceA, user: 'PROFIT' });

    const created = await getSegmentRow(pool, tipCli);
    expect(created).toMatchObject({ tipCli, desTipo: 'Prueba segmento', coPrecio: priceA, customerCount: 0 });
    expect(created!.validador).toMatch(/^0x[0-9A-F]{16}$/i);
    expect((await listSegmentRows(pool)).some(s => s.tipCli === tipCli)).toBe(true);

    const first = await updateSegmentErp(pool, { tipCli, desTipo: 'Prueba renombrada', coPrecio: priceB, validador: created!.validador, user: 'PROFIT' });
    expect(first).toBe('success');
    const after = await getSegmentRow(pool, tipCli);
    expect(after).toMatchObject({ desTipo: 'Prueba renombrada', coPrecio: priceB });

    const stale = await updateSegmentErp(pool, { tipCli, desTipo: 'Otra', coPrecio: null, validador: created!.validador, user: 'PROFIT' });
    expect(stale).toBe('conflict');
    expect((await getSegmentRow(pool, tipCli))!.desTipo).toBe('Prueba renombrada');
  });

  test('update of an unknown segment or list throws', async () => {
    await expect(updateSegmentErp(pool, { tipCli: 'ZZZZZZ', desTipo: 'x', coPrecio: null, validador: '0x0000000000000000', user: 'PROFIT' })).rejects.toThrow();
    const row = await getSegmentRow(pool, tipCli);
    await expect(updateSegmentErp(pool, { tipCli, desTipo: null, coPrecio: 'NOEXIS', validador: row!.validador, user: 'PROFIT' })).rejects.toThrow();
  });
});
