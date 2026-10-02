import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { getPool } from '@/lib/db/mssql';
import { addDaysIso, todayIso } from '@/lib/pricing/dates';
import { nextPriceListCode } from '@/lib/pricing/list-code';
import {
  applyRatePeriodErp, cloneListErp, createListErp, getPriceList, listPriceListCodes, listPriceLists,
  readListRates, updateListErp, dominantWarehouse,
} from '@/lib/pricing/rates-erp';

describe('pricing rates (ERP)', () => {
  let pool: sql.ConnectionPool;
  let list = ''; let clone = '';
  let art = ''; let alma = '';
  const today = todayIso();
  const user = 'PROFIT';

  beforeAll(async () => {
    expect(process.env.DB_SERVER).toBe('localhost');
    pool = await getPool();
    const codes = await listPriceListCodes(pool);
    list = nextPriceListCode(codes);
    clone = nextPriceListCode([...codes, list]);
    const a = await pool.request().query(`SELECT TOP 1 RTRIM(co_art) AS a FROM saArticulo WHERE anulado = 0 ORDER BY co_art`);
    art = a.recordset[0].a;
    alma = (await dominantWarehouse(pool)) ?? 'TODOS';
  });

  afterAll(async () => {
    for (const l of [list, clone]) {
      if (!l) continue;
      await pool.request().input('l', sql.Char(6), l).query(`DELETE FROM saArtPrecio WHERE co_precio = @l; DELETE FROM saTipoPrecio WHERE co_precio = @l`);
    }
  });

  test('create list, rename with validador, stale rename conflicts', async () => {
    await createListErp(pool, { coPrecio: list, desPrecio: 'Prueba lista', user });
    const row = await getPriceList(pool, list);
    expect(row).toMatchObject({ coPrecio: list, desPrecio: 'Prueba lista', rateCount: 0 });
    expect(await updateListErp(pool, { coPrecio: list, desPrecio: 'Prueba renombrada', validador: row!.validador, user })).toBe('success');
    expect(await updateListErp(pool, { coPrecio: list, desPrecio: 'Otra', validador: row!.validador, user })).toBe('conflict');
    expect((await listPriceLists(pool)).some(l => l.coPrecio === list)).toBe(true);
  });

  test('first rate inserts; same-day re-edit updates in place; later date closes and inserts', async () => {
    const base = { coPrecio: list, coArt: art, coAlma: alma, coMone: 'USD', to: null as string | null, today, user };
    expect((await applyRatePeriodErp(pool, { ...base, from: today, monto: 5 })).outcome).toBe('success');
    expect((await applyRatePeriodErp(pool, { ...base, from: today, monto: 6 })).outcome).toBe('success');   // same-day edit
    let rows = (await readListRates(pool, list)).filter(r => r.coArt === art);
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ desde: today, hasta: null, monto: 6, coMone: 'USD' });

    const later = addDaysIso(today, 10);
    expect((await applyRatePeriodErp(pool, { ...base, from: later, monto: 7 })).outcome).toBe('success');
    rows = (await readListRates(pool, list)).filter(r => r.coArt === art).sort((a, b) => a.desde.localeCompare(b.desde));
    expect(rows.map(r => [r.desde, r.hasta, r.monto])).toEqual([[today, addDaysIso(later, -1), 6], [later, null, 7]]);

    expect((await applyRatePeriodErp(pool, { ...base, from: later, monto: 7 })).outcome).toBe('skipped');
  });

  test('bounded promo splits the regular row (regular → promo → continuation)', async () => {
    const base = { coPrecio: list, coArt: art, coAlma: alma, coMone: 'USD', today, user };
    const from = addDaysIso(today, 20); const to = addDaysIso(today, 25);
    const r = await applyRatePeriodErp(pool, { ...base, from, to, monto: 4 });
    expect(r.outcome).toBe('success');
    const rows = (await readListRates(pool, list)).filter(x => x.coArt === art).sort((a, b) => a.desde.localeCompare(b.desde));
    expect(rows.map(x => [x.desde, x.hasta, x.monto]).slice(-3)).toEqual([
      [addDaysIso(today, 10), addDaysIso(from, -1), 7],
      [from, to, 4],
      [addDaysIso(to, 1), null, 7],
    ]);
  });

  test('a rejected plan reports a message and writes nothing', async () => {
    const before = (await readListRates(pool, list)).length;
    const r = await applyRatePeriodErp(pool, { coPrecio: list, coArt: art, coAlma: alma, coMone: 'USD', from: addDaysIso(today, -1), to: null, monto: 9, today, user });
    expect(r).toMatchObject({ outcome: 'rejected' });
    expect((await readListRates(pool, list)).length).toBe(before);
  });

  test('clone is all-or-nothing', async () => {
    await expect(cloneListErp(pool, { coPrecio: clone, desPrecio: 'Copia', coMone: 'USD', from: today, rows: [{ coArt: art, coAlma: alma, monto: 3 }, { coArt: 'NO-EXISTE', coAlma: alma, monto: 3 }], user })).rejects.toThrow();
    expect(await getPriceList(pool, clone)).toBeNull();           // rolled back, no list left behind

    await cloneListErp(pool, { coPrecio: clone, desPrecio: 'Copia', coMone: 'USD', from: today, rows: [{ coArt: art, coAlma: alma, monto: 3 }], user });
    expect((await readListRates(pool, clone)).map(r => r.monto)).toEqual([3]);
  });
});
