import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { getPool } from '@/lib/db/mssql';
import { addDaysIso, todayIso } from '@/lib/pricing/dates';
import { hexToBuffer } from '@/lib/pricing/tipo-cliente';
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

  describe('hasta end-of-day and date-based row matching (0014)', () => {
    let art2 = '';
    const rawRows = async (a: string) => (await pool.request().input('l', sql.Char(6), list).input('a', sql.Char(30), a)
      .query(`SELECT CONVERT(VARCHAR(23), desde, 121) AS desde, CONVERT(VARCHAR(23), hasta, 121) AS hasta FROM saArtPrecio WHERE co_precio = @l AND co_art = @a ORDER BY desde`)).recordset as { desde: string; hasta: string | null }[];

    test('a closed period stores hasta at 23:59:59.997 while readListRates returns the plain date', async () => {
      const rows = await rawRows(art);
      const closed = rows.find(r => r.hasta !== null)!;
      expect(closed.hasta!.slice(10)).toBe(' 23:59:59.997');
      expect(closed.desde.slice(10)).toBe(' 00:00:00.000');
      const read = (await readListRates(pool, list)).filter(r => r.coArt === art && r.hasta !== null);
      expect(read.every(r => /^\d{4}-\d{2}-\d{2}$/.test(r.hasta!))).toBe(true);
    });

    test('a row with a time-of-day desde (written outside the app) can be closed by the app', async () => {
      art2 = (await pool.request().input('a', sql.Char(30), art).query(`SELECT TOP 1 RTRIM(co_art) AS a FROM saArticulo WHERE anulado = 0 AND co_art > @a ORDER BY co_art`)).recordset[0].a;
      await pool.request().input('l', sql.Char(6), list).input('a', sql.Char(30), art2).input('w', sql.Char(6), alma === 'TODOS' ? null : alma)
        .query(`INSERT INTO saArtPrecio (co_art, co_precio, desde, hasta, co_alma, monto, precioOm, co_us_in, fe_us_in, co_us_mo, fe_us_mo, co_mone)
                VALUES (@a, @l, DATEADD(HOUR, 10, DATEADD(MINUTE, 30, CONVERT(DATETIME, CONVERT(DATE, GETDATE())))), NULL, @w, 2, 0, 'PROFIT', GETDATE(), 'PROFIT', GETDATE(), 'USD')`);
      const later = addDaysIso(today, 5);
      const r = await applyRatePeriodErp(pool, { coPrecio: list, coArt: art2, coAlma: alma, coMone: 'USD', from: later, to: null, monto: 3, today, user });
      expect(r.outcome).toBe('success');
      const rows = (await readListRates(pool, list)).filter(x => x.coArt === art2);
      expect(rows.map(x => [x.desde, x.hasta, x.monto])).toEqual([[today, addDaysIso(later, -1), 2], [later, null, 3]]);
      // a same-day edit of the time-of-day row also updates in place (no duplicate-start conflict)
      const r2 = await applyRatePeriodErp(pool, { coPrecio: list, coArt: art2, coAlma: alma, coMone: 'USD', from: today, to: null, monto: 9, today, user });
      expect(r2.outcome).toBe('success');
    });
  });

  test('a wrong expected current price is a conflict and nothing is written; the right one applies', async () => {
    const snapshot = async () => JSON.stringify((await readListRates(pool, list)).map(r => [r.coArt, r.desde, r.hasta, r.monto, r.validador]));
    const cover = (await readListRates(pool, list)).find(r => r.coArt === art && r.desde <= today && (r.hasta === null || r.hasta >= today))!;
    const base = { coPrecio: list, coArt: art, coAlma: alma, coMone: 'USD', from: addDaysIso(today, 40), to: null as string | null, monto: 11, today, user };
    const before = await snapshot();
    expect((await applyRatePeriodErp(pool, { ...base, expectedCurrent: cover.monto + 1 })).outcome).toBe('conflict');
    expect((await applyRatePeriodErp(pool, { ...base, expectedCurrent: null })).outcome).toBe('conflict');
    expect(await snapshot()).toBe(before);
    expect((await applyRatePeriodErp(pool, { ...base, expectedCurrent: cover.monto })).outcome).toBe('success');
  });

  describe('procedures stop after a validation error (direct EXEC, no transaction)', () => {
    const rateCount = async () => (await pool.request().query(`SELECT COUNT(*) AS n FROM saArtPrecio`)).recordset[0].n as number;
    const listCount = async () => (await pool.request().query(`SELECT COUNT(*) AS n FROM saTipoPrecio`)).recordset[0].n as number;
    const ins = (o: { art?: string; precio?: string; desde?: string; hasta?: string | null; monto?: number }) =>
      pool.request()
        .input('sCoArt', sql.Char(30), o.art ?? art).input('sCoPrecio', sql.Char(6), o.precio ?? list)
        .input('sCoAlma', sql.Char(6), alma === 'TODOS' ? null : alma)
        .input('sDesde', sql.Char(10), o.desde ?? addDaysIso(today, 200)).input('sHasta', sql.Char(10), o.hasta ?? null)
        .input('deMonto', sql.Decimal(18, 5), o.monto ?? 1).input('sCoMone', sql.Char(6), 'USD').input('sCoUsIn', sql.Char(6), user)
        .execute('pApiInsertarPrecioArticulo');

    test('insert: monto 0, hasta < desde, duplicate start, unknown article, unknown list write nothing', async () => {
      const d = addDaysIso(today, 200);
      const before = await rateCount();
      await expect(ins({ monto: 0 })).rejects.toThrow();
      await expect(ins({ desde: d, hasta: addDaysIso(d, -1) })).rejects.toThrow();
      await expect(ins({ art: 'NO-EXISTE' })).rejects.toThrow();
      await expect(ins({ precio: '9Z9Z9Z' })).rejects.toThrow();
      expect(await rateCount()).toBe(before);
      // duplicate start date: the first insert is legitimate, the second must not add a row
      await ins({ desde: d, monto: 1 });
      expect(await rateCount()).toBe(before + 1);
      await expect(ins({ desde: d, monto: 2 })).rejects.toThrow();
      expect(await rateCount()).toBe(before + 1);
    });

    test('update: monto 0 and a stale validador change nothing', async () => {
      const row = (await readListRates(pool, list))[0];
      const upd = (monto: number | null, validador: string) =>
        pool.request()
          .input('sCoArt', sql.Char(30), row.coArt).input('sCoPrecio', sql.Char(6), row.coPrecio)
          .input('sCoAlma', sql.Char(6), row.coAlma === 'TODOS' ? null : row.coAlma)
          .input('sDesdeOri', sql.Char(10), row.desde).input('sDesde', sql.Char(10), null).input('sHasta', sql.Char(10), null)
          .input('bSetHasta', sql.Bit, 0).input('deMonto', sql.Decimal(18, 5), monto)
          .input('tsValidador', sql.Binary, hexToBuffer(validador)).input('sCoUsMo', sql.Char(6), user)
          .execute('pApiActualizarPrecioArticulo');
      await expect(upd(0, row.validador)).rejects.toThrow();
      const stale = await upd(123, '0x0000000000000001');
      expect(stale.recordset[0].updated).toBe(0);
      const after = (await readListRates(pool, list)).find(r => r.coArt === row.coArt && r.desde === row.desde);
      expect(after).toMatchObject({ monto: row.monto, validador: row.validador });
    });

    test('tipo precio: duplicate code and rename of an unknown list write nothing', async () => {
      const before = await listCount();
      await expect(createListErp(pool, { coPrecio: list, desPrecio: 'Duplicada', user })).rejects.toThrow();
      expect(await listCount()).toBe(before);
      expect((await getPriceList(pool, list))?.desPrecio).toBe('Prueba renombrada');
      const r = await pool.request().input('sCoPrecio', sql.Char(6), '9Z9Z9Z').input('sDesPrecio', sql.VarChar(60), 'x')
        .input('tsValidador', sql.Binary, hexToBuffer('0x0000000000000001')).input('sCoUsMo', sql.Char(6), user)
        .execute('pApiActualizarTipoPrecio').then(() => 'ok', () => 'rejected');
      expect(r).toBe('rejected');
      expect(await listCount()).toBe(before);
    });
  });
});
