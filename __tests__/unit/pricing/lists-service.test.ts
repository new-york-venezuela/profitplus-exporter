// __tests__/unit/pricing/lists-service.test.ts  (key cases; add more in the same style)
import { describe, test, expect, beforeEach } from 'bun:test';
import { makeMemoryDb } from '../../helpers/memory-db';
import { makeFakeRatesErp, type FakeRatesState } from '../../helpers/fake-rates-erp';
import { applyRates, cloneList, createList, getRatesGrid, renameList, getArticlePrices, listPriceListDtos } from '@/lib/pricing/lists-service';
import { listAudit } from '@/lib/pricing/segments-repo';
import { getListMeta } from '@/lib/pricing/lists-repo';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/pricing/segments-service';

const actor = { id: '7', erpUser: 'PROFIT' };
const now = () => new Date(2026, 9, 1);           // 2026-10-01
let deps: Parameters<typeof applyRates>[0];
let state: FakeRatesState;

beforeEach(() => {
  const f = makeFakeRatesErp({
    lists: [{ coPrecio: '08', desPrecio: 'INDEPENDIENTES' }, { coPrecio: '01', desPrecio: 'CONTADO BS' }, { coPrecio: '05', desPrecio: 'ANUL' }],
    articles: [{ coArt: 'A1', artDes: 'Harina 1kg' }, { coArt: 'A2', artDes: 'Aceite 1L' }, { coArt: 'A3', artDes: 'Sal' }],
    rates: [
      { coArt: 'A1', coPrecio: '08', coAlma: '000015', desde: '2026-03-15', hasta: null, monto: 12.4, coMone: 'USD', validador: '0x01' },
      { coArt: 'A2', coPrecio: '08', coAlma: '000015', desde: '2026-03-15', hasta: null, monto: 21.1, coMone: 'USD', validador: '0x02' },
      { coArt: 'A1', coPrecio: '01', coAlma: '000015', desde: '2026-03-15', hasta: null, monto: 14, coMone: 'USD', validador: '0x03' },
      // A3 has rows in two warehouses inside list 08 → ambiguous
      { coArt: 'A3', coPrecio: '08', coAlma: '000015', desde: '2026-03-15', hasta: null, monto: 1, coMone: 'USD', validador: '0x04' },
      { coArt: 'A3', coPrecio: '08', coAlma: '000002', desde: '2026-03-15', hasta: null, monto: 1, coMone: 'USD', validador: '0x05' },
    ],
  });
  state = f.state;
  deps = { erp: f.erp, db: makeMemoryDb(), now };
});

describe('getRatesGrid', () => {
  test('current/next per article, ambiguity flagged, reference = current when no compareTo', async () => {
    const g = await getRatesGrid(deps, '08', null);
    const a1 = g.rows.find(r => r.coArt === 'A1')!;
    expect(a1.current).toMatchObject({ monto: 12.4, desde: '2026-03-15' });
    expect(a1.referenceMonto).toBe(12.4);
    expect(g.rows.find(r => r.coArt === 'A3')).toMatchObject({ ambiguous: true, current: null });
  });
  test('compareTo another list uses that list current price for the same article', async () => {
    const g = await getRatesGrid(deps, '08', '01');
    expect(g.rows.find(r => r.coArt === 'A1')!.referenceMonto).toBe(14);
    expect(g.rows.find(r => r.coArt === 'A2')!.referenceMonto).toBeNull();
  });
  test('unknown list → NotFoundError', async () => {
    await expect(getRatesGrid(deps, 'ZZ', null)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('applyRates', () => {
  test('writes, skips unchanged, rejects ambiguous, audits the batch once', async () => {
    const res = await applyRates(deps, '08', { effectiveFrom: '2026-10-01', changes: [
      { coArt: 'A1', monto: 13 }, { coArt: 'A2', monto: 21.1 }, { coArt: 'A3', monto: 2 },
    ] }, actor);
    expect(res.map(r => [r.coArt, r.outcome])).toEqual([['A1', 'success'], ['A2', 'skipped'], ['A3', 'rejected']]);
    const audit = listAudit(deps.db);
    expect(audit.length).toBe(1);
    expect(audit[0].action).toBe('rates_apply');
    expect(JSON.parse(audit[0].afterJson!).changes).toEqual([{ coArt: 'A1', before: 12.4, after: 13 }]);
  });
  test('a brand-new article uses the list dominant warehouse', async () => {
    await applyRates(deps, '08', { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A4', monto: 3 }] }, actor);
    expect(state.rates.find(r => r.coArt === 'A4' && r.coPrecio === '08')!.coAlma).toBe('000015');
  });
  test('same-day second apply updates in place', async () => {
    await applyRates(deps, '08', { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A1', monto: 13 }] }, actor);
    await applyRates(deps, '08', { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A1', monto: 14 }] }, actor);
    const rows = state.rates.filter(r => r.coArt === 'A1' && r.coPrecio === '08');
    expect(rows.map(r => r.monto).sort()).toEqual([12.4, 14]);        // original (closed) + today's row, no duplicate
  });
  test('a past date is rejected per article', async () => {
    const res = await applyRates(deps, '08', { effectiveFrom: '2026-09-01', changes: [{ coArt: 'A1', monto: 13 }] }, actor);
    expect(res[0].outcome).toBe('rejected');
  });
  test('list without a currency → ValidationError', async () => {
    state.lists.push({ coPrecio: '11', desPrecio: 'Vacía' });
    await expect(applyRates(deps, '11', { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A1', monto: 1 }] }, actor)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('createList / cloneList / renameList', () => {
  test('createList allocates the next code, stores currency meta, audits', async () => {
    const dto = await createList(deps, { mode: 'create', desPrecio: 'Nueva', coMone: 'USD' }, actor);
    expect(dto.coPrecio).toBe('09');                                  // existing 01,05,08 → max 8 → '09'
    expect(getListMeta(deps.db, dto.coPrecio)?.coMone).toBe('USD');
    expect(listAudit(deps.db)[0].action).toBe('list_create');
  });
  test('cloneList copies current rates with the percent adjustment, keeping warehouses', async () => {
    const dto = await cloneList(deps, { mode: 'clone', sourceCoPrecio: '08', desPrecio: 'Copia', percent: -10, effectiveFrom: '2026-10-01' }, actor);
    const rows = state.rates.filter(r => r.coPrecio === dto.coPrecio);
    expect(rows.find(r => r.coArt === 'A1')).toMatchObject({ monto: 11.16, coAlma: '000015', coMone: 'USD', desde: '2026-10-01', hasta: null });
    expect(listAudit(deps.db)[0].action).toBe('list_clone');
  });
  test('cloneList failure leaves no list and no audit', async () => {
    state.failCloneOnce = true;
    await expect(cloneList(deps, { mode: 'clone', sourceCoPrecio: '08', desPrecio: 'Copia', percent: null, effectiveFrom: '2026-10-01' }, actor)).rejects.toThrow();
    expect(state.lists.length).toBe(3);
    expect(listAudit(deps.db)).toEqual([]);
  });
  test('renameList conflict → ConflictError; unknown → NotFoundError', async () => {
    state.conflictNext = true;
    await expect(renameList(deps, '08', { desPrecio: 'X', validador: '0x00000000000000AA' }, actor)).rejects.toBeInstanceOf(ConflictError);
    await expect(renameList(deps, 'ZZ', { desPrecio: 'X', validador: '0x00000000000000AA' }, actor)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('listPriceListDtos', () => {
  test('flags empty lists (voided) and exposes currencies', async () => {
    const { priceLists, currencies } = await listPriceListDtos(deps);
    expect(priceLists.find(l => l.coPrecio === '05')!.isEmpty).toBe(true);
    expect(priceLists.find(l => l.coPrecio === '08')!.isEmpty).toBe(false);
    expect(currencies).toContain('USD');
  });
});

describe('getArticlePrices', () => {
  test('per-list current/next/history and effective price for a customer', async () => {
    state.customers['C1'] = { cliDes: 'Bodega', tipCli: '000003', coPrecio: '08' };
    const p = await getArticlePrices(deps, 'A1', 'C1');
    expect(p.lists.find(l => l.coPrecio === '08')!.current?.monto).toBe(12.4);
    expect(p.effective).toMatchObject({ coCli: 'C1', coPrecio: '08', monto: 12.4 });
  });
  test('unknown customer → NotFoundError', async () => {
    await expect(getArticlePrices(deps, 'A1', 'NOPE')).rejects.toBeInstanceOf(NotFoundError);
  });
});

const quiet = async <T,>(fn: () => Promise<T>) => { const o = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = o; } };

describe('extra behaviors', () => {
  test('apply with no success writes no audit', async () => {
    await applyRates(deps, '08', { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A2', monto: 21.1 }] }, actor);
    expect(listAudit(deps.db)).toEqual([]);
  });
  test('a thrown ERP error is reported per article as error', async () => {
    const orig = deps.erp.applyRatePeriod;
    deps.erp.applyRatePeriod = async a => { if (a.coArt === 'A1') throw new Error('boom'); return orig(a); };
    const res = await quiet(() => applyRates(deps, '08', { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A1', monto: 13 }, { coArt: 'A2', monto: 22 }] }, actor));
    expect(res.map(r => r.outcome)).toEqual(['error', 'success']);
    expect(res[0].message).toBe('Error al aplicar el precio de este artículo');   // raw message never leaks
  });
  test('currency falls back to list meta when the list has no rates', async () => {
    const dto = await createList(deps, { mode: 'create', desPrecio: 'Nueva', coMone: 'BSD' }, actor);
    await applyRates(deps, dto.coPrecio, { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A1', monto: 5 }] }, actor);
    expect(state.rates.find(r => r.coPrecio === dto.coPrecio)).toMatchObject({ coMone: 'BSD', coAlma: '000015' });
  });
  test('grid shows next scheduled rate', async () => {
    await applyRates(deps, '08', { effectiveFrom: '2026-11-01', changes: [{ coArt: 'A1', monto: 15 }] }, actor);
    const a1 = (await getRatesGrid(deps, '08', null)).rows.find(r => r.coArt === 'A1')!;
    expect(a1.next).toEqual({ monto: 15, desde: '2026-11-01' });
    expect(a1.current?.monto).toBe(12.4);
  });
  test('article history lists closed periods newest first', async () => {
    state.rates.push({ coArt: 'A1', coPrecio: '08', coAlma: '000015', desde: '2026-01-01', hasta: '2026-03-14', monto: 10, coMone: 'USD', validador: '0x09' });
    const l = (await getArticlePrices(deps, 'A1', null)).lists.find(x => x.coPrecio === '08')!;
    expect(l.history).toEqual([{ monto: 10, desde: '2026-01-01', hasta: '2026-03-14' }]);
    expect((await getArticlePrices(deps, 'A1', null)).effective).toBeNull();
  });
});

describe('fix round 1', () => {  const brokenDb = () => new Proxy(deps.db, { get: (t, k, r) => (k === 'insert' ? () => { throw new Error('sqlite down'); } : Reflect.get(t, k, r)) });

  test('grid names articles beyond the default 200 cap', async () => {
    for (let i = 0; i < 250; i++) state.articles.push({ coArt: `Z${i}`, artDes: `Zeta ${i}`, catDes: 'Cat' });
    state.rates.push({ coArt: 'Z249', coPrecio: '08', coAlma: '000015', desde: '2026-03-15', hasta: null, monto: 2, coMone: 'USD', validador: '0xzz' });
    const row = (await getRatesGrid(deps, '08', null)).rows.find(r => r.coArt === 'Z249')!;
    expect(row).toMatchObject({ artDes: 'Zeta 249', catDes: 'Cat' });
  });
  test('unknown compareTo → NotFoundError; ambiguous compare article → null reference', async () => {
    await expect(getRatesGrid(deps, '08', 'ZZ')).rejects.toBeInstanceOf(NotFoundError);
    const g = await getRatesGrid(deps, '01', '08');
    expect(g.rows.find(r => r.coArt === 'A1')!.referenceMonto).toBe(12.4);
    state.rates.push({ coArt: 'A1', coPrecio: '08', coAlma: '000002', desde: '2026-03-15', hasta: null, monto: 9, coMone: 'USD', validador: '0xaa' });
    expect((await getRatesGrid(deps, '01', '08')).rows.find(r => r.coArt === 'A1')!.referenceMonto).toBeNull();
  });
  test('createList / cloneList metadata failure → dto with warning', async () => {
    const d = { ...deps, db: brokenDb() };
    const c = await quiet(() => createList(d, { mode: 'create', desPrecio: 'N', coMone: 'USD' }, actor));
    expect(c.warning).toContain('sin metadatos');
    expect(state.lists.some(l => l.coPrecio === c.coPrecio)).toBe(true);
    const k = await quiet(() => cloneList(d, { mode: 'clone', sourceCoPrecio: '08', desPrecio: 'K', percent: null, effectiveFrom: '2026-10-01' }, actor));
    expect(k.warning).toContain('sin metadatos');
  });
  test('clone audit payload and meta currency', async () => {
    const dto = await cloneList(deps, { mode: 'clone', sourceCoPrecio: '08', desPrecio: 'Copia', percent: 10, effectiveFrom: '2026-10-05' }, actor);
    expect(getListMeta(deps.db, dto.coPrecio)?.coMone).toBe('USD');
    const a = listAudit(deps.db)[0];
    expect(JSON.parse(a.beforeJson!)).toBe('08');
    expect(JSON.parse(a.afterJson!)).toEqual({ coPrecio: dto.coPrecio, percent: 10, from: '2026-10-05', count: 4 });
  });
  test('clone copies ambiguous article to both warehouses', async () => {
    const dto = await cloneList(deps, { mode: 'clone', sourceCoPrecio: '08', desPrecio: 'Copia', percent: null, effectiveFrom: '2026-10-01' }, actor);
    const a3 = state.rates.filter(r => r.coPrecio === dto.coPrecio && r.coArt === 'A3').map(r => r.coAlma).sort();
    expect(a3).toEqual(['000002', '000015']);
  });
  test('clone of a source without current rates → ValidationError', async () => {
    await expect(cloneList(deps, { mode: 'clone', sourceCoPrecio: '05', desPrecio: 'X', percent: null, effectiveFrom: '2026-10-01' }, actor)).rejects.toBeInstanceOf(ValidationError);
  });
  test('effective is null when customer has no list or list has no current rate', async () => {
    state.customers['C2'] = { cliDes: 'Sin lista', tipCli: '000001', coPrecio: null };
    state.customers['C3'] = { cliDes: 'Lista 05', tipCli: '000001', coPrecio: '05' };
    expect((await getArticlePrices(deps, 'A1', 'C2')).effective).toBeNull();
    expect((await getArticlePrices(deps, 'A1', 'C3')).effective).toBeNull();
  });
  test('apply surfaces a conflict outcome and does not audit it', async () => {
    deps.erp.applyRatePeriod = async () => ({ outcome: 'conflict' });
    const res = await applyRates(deps, '08', { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A1', monto: 13 }] }, actor);
    expect(res[0].outcome).toBe('conflict');
    expect(listAudit(deps.db)).toEqual([]);
  });
  test('renameList success returns the renamed dto', async () => {
    const dto = await renameList(deps, '08', { desPrecio: 'Nuevo', validador: '0x00000000000000AA' }, actor);
    expect(dto.desPrecio).toBe('Nuevo');
  });
  test('fake rejects duplicate list codes', async () => {
    await expect(deps.erp.createList({ coPrecio: '08', desPrecio: 'dup', user: 'P' })).rejects.toThrow();
  });
});

describe('stale-grid expected check', () => {
  test('a stale expected price is a conflict, nothing is written or audited', async () => {
    const res = await applyRates(deps, '08', { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A1', monto: 13, expected: 11 }] }, actor);
    expect(res[0].outcome).toBe('conflict');
    expect(state.rates.filter(r => r.coArt === 'A1' && r.coPrecio === '08').map(r => r.monto)).toEqual([12.4]);
    expect(listAudit(deps.db)).toEqual([]);
  });
  test('matching expected applies; null expected on an unpriced article applies; omitted expected skips the check', async () => {
    const res = await applyRates(deps, '08', { effectiveFrom: '2026-10-01', changes: [
      { coArt: 'A1', monto: 13, expected: 12.4 }, { coArt: 'A4', monto: 3, expected: null }, { coArt: 'A2', monto: 22 },
    ] }, actor);
    expect(res.map(r => r.outcome)).toEqual(['success', 'success', 'success']);
  });
  test('expected null but the article has a current price → conflict', async () => {
    const res = await applyRates(deps, '08', { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A1', monto: 13, expected: null }] }, actor);
    expect(res[0].outcome).toBe('conflict');
  });
});

describe('final fixes D/E', () => {
  test('a RAISERROR (number 50000) message is shown; other errors are generic; both are logged', async () => {
    const logged: unknown[][] = [];
    const o = console.error; console.error = (...a: unknown[]) => { logged.push(a); };
    try {
      deps.erp.applyRatePeriod = async a => {
        if (a.coArt === 'A1') throw Object.assign(new Error('Ya existe una tarifa que inicia en esa fecha'), { number: 50000 });
        throw Object.assign(new Error('Violation of PRIMARY KEY constraint dbo.x'), { number: 2627 });
      };
      const res = await applyRates(deps, '08', { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A1', monto: 13 }, { coArt: 'A2', monto: 22 }] }, actor);
      expect(res.map(r => r.message)).toEqual(['Ya existe una tarifa que inicia en esa fecha', 'Error al aplicar el precio de este artículo']);
      expect(logged.length).toBe(2);
    } finally { console.error = o; }
  });
  test('an audit failure does not turn a successful apply into an error', async () => {
    const d = { ...deps, db: new Proxy(deps.db, { get: (t, k, r) => (k === 'insert' ? () => { throw new Error('sqlite down'); } : Reflect.get(t, k, r)) }) };
    const res = await quiet(() => applyRates(d, '08', { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A1', monto: 13 }] }, actor));
    expect(res[0].outcome).toBe('success');
  });
  test('createList rejects an unknown currency', async () => {
    await expect(createList(deps, { mode: 'create', desPrecio: 'N', coMone: 'XXX' }, actor)).rejects.toThrow('Moneda no válida');
    expect(state.lists.length).toBe(3);
  });
  test('an article whose covering row has another currency is rejected', async () => {
    state.rates.push({ coArt: 'A4', coPrecio: '08', coAlma: '000015', desde: '2026-03-15', hasta: null, monto: 5, coMone: 'BSD', validador: '0x0a' });
    const res = await applyRates(deps, '08', { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A4', monto: 6 }, { coArt: 'A1', monto: 13 }] }, actor);
    expect(res.map(r => [r.outcome, r.message])).toEqual([['rejected', 'El artículo tiene una moneda distinta a la de la lista'], ['success', undefined]]);
  });
});

describe('final fixes F: grid is the priced rows UNION the catalog', () => {
  test('catalog articles without a row appear unpriced; compareTo supplies their reference', async () => {
    state.articles.push({ coArt: 'A9', artDes: 'Zucaritas', catDes: 'Cereal' });
    state.rates.push({ coArt: 'A9', coPrecio: '01', coAlma: '000015', desde: '2026-03-15', hasta: null, monto: 8, coMone: 'USD', validador: '0x0b' });
    const g = await getRatesGrid(deps, '08', '01');
    expect(g.rows.find(r => r.coArt === 'A9')).toEqual({
      coArt: 'A9', artDes: 'Zucaritas', catDes: 'Cereal', coAlma: null, ambiguous: false, current: null, next: null, referenceMonto: 8,
    });
    expect((await getRatesGrid(deps, '08', null)).rows.find(r => r.coArt === 'A9')!.referenceMonto).toBeNull();
  });
  test('an empty list shows the whole catalog and can be priced', async () => {
    const dto = await createList(deps, { mode: 'create', desPrecio: 'Nueva', coMone: 'USD' }, actor);
    const g = await getRatesGrid(deps, dto.coPrecio, null);
    expect(g.rows.map(r => r.coArt).sort()).toEqual(['A1', 'A2', 'A3']);
    expect(g.rows.every(r => r.current === null && r.next === null && r.coAlma === null)).toBe(true);
  });
  test('a priced article that is no longer in the catalog stays, named by its code', async () => {
    state.rates.push({ coArt: 'OLD', coPrecio: '08', coAlma: '000015', desde: '2026-03-15', hasta: null, monto: 2, coMone: 'USD', validador: '0x0c' });
    const g = await getRatesGrid(deps, '08', null);
    expect(g.rows.find(r => r.coArt === 'OLD')).toMatchObject({ artDes: 'OLD', current: { monto: 2 } });
    expect(g.rows.filter(r => r.coArt === 'A1').length).toBe(1);
  });
});
