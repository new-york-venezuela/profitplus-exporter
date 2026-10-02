// scripts/dwh/__tests__/pricing-segments.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { getPool } from '@/lib/db/mssql';
import { nextTipCliCode } from '@/lib/pricing/segment-name';
import {
  listSegmentRows, getSegmentRow, listTipCliCodes, createSegmentErp, updateSegmentErp,
} from '@/lib/pricing/tipo-cliente';
import { assignCustomerToSegment, readFullCustomerRow, updateCustomerTipCli } from '@/lib/pricing/sa-cliente-fields';

// Writes to the ERP (creates and deletes a saTipoCliente row). Non-production only.
describe('pricing segments (ERP)', () => {
  let pool: sql.ConnectionPool;
  let tipCli = '';
  let priceA = '';
  let priceB = '';
  let movedCoCli = '';
  let movedOriginalTipCli = '';

  beforeAll(async () => {
    expect(process.env.DB_SERVER).toBe('localhost'); // refuse to run against anything but the local mock
    pool = await getPool();
    const lists = await pool.request().query(`SELECT TOP 2 RTRIM(co_precio) AS p FROM saTipoPrecio ORDER BY co_precio`);
    priceA = lists.recordset[0].p; priceB = lists.recordset[1].p;
    tipCli = nextTipCliCode(await listTipCliCodes(pool));
  });

  afterAll(async () => {
    // restore the moved customer BEFORE dropping the segment it points at
    if (movedCoCli && movedOriginalTipCli) {
      const cur = await readFullCustomerRow(pool, movedCoCli);
      if (cur && cur.tipCli.trim() !== movedOriginalTipCli) await updateCustomerTipCli(pool, cur, movedOriginalTipCli, 'TESTRUN');
    }
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

  test('customer move via assignCustomerToSegment, then a stale validador conflicts', async () => {
    const pick = await pool.request().query(`SELECT TOP 1 RTRIM(co_cli) AS coCli, RTRIM(tip_cli) AS tipCli FROM saCliente WHERE inactivo = 0`);
    movedCoCli = pick.recordset[0].coCli;
    movedOriginalTipCli = pick.recordset[0].tipCli;
    if (!(await getSegmentRow(pool, tipCli))) await createSegmentErp(pool, { tipCli, desTipo: 'Prueba segmento', coPrecio: priceA, user: 'PROFIT' });

    const snapshot = await readFullCustomerRow(pool, movedCoCli); // taken before the move: becomes stale
    const moved = await assignCustomerToSegment(pool, movedCoCli, tipCli, 'TESTRUN');
    expect(moved).toMatchObject({ outcome: 'success', previousTipCli: movedOriginalTipCli });
    expect((await readFullCustomerRow(pool, movedCoCli))!.tipCli.trim()).toBe(tipCli);
    expect((await getSegmentRow(pool, tipCli))!.customerCount).toBe(1);

    // idempotent no-op into the same segment
    expect((await assignCustomerToSegment(pool, movedCoCli, tipCli, 'TESTRUN')).outcome).toBe('success');

    // a stale snapshot must not overwrite the move
    expect(await updateCustomerTipCli(pool, snapshot!, movedOriginalTipCli, 'TESTRUN')).toBe('conflict');
    expect((await readFullCustomerRow(pool, movedCoCli))!.tipCli.trim()).toBe(tipCli);

    // move back (afterAll also guards this)
    expect((await assignCustomerToSegment(pool, movedCoCli, movedOriginalTipCli, 'TESTRUN')).outcome).toBe('success');
    expect((await readFullCustomerRow(pool, movedCoCli))!.tipCli.trim()).toBe(movedOriginalTipCli);
  });
});
