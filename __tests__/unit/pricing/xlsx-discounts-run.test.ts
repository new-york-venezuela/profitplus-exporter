import { describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as XLSX from 'xlsx';
import { makeMemoryDb } from '../../helpers/memory-db';
import { makeFakeRatesErp } from '../../helpers/fake-rates-erp';
import { makeFakeSegmentErp } from '../../helpers/fake-segment-erp';
import { getSegmentMeta } from '@/lib/pricing/segments-repo';
import type { SegmentMoveResult } from '@/lib/pricing/segments-service';
import type { DiscountSet } from '@/lib/pricing/xlsx/discounts';
import {
  applyDiscountSets, describeDiscountSets, discountDateIssues, groupDiscountTargets, loadTypeContext,
  resolveCustomerType, specialListName, staleSpecialLists, type TypeContext,
} from '@/lib/pricing/xlsx/discounts-run';
import { parseWorkbook, planWorkbook } from '@/lib/pricing/xlsx/import';
import { applyWorkbook, STEP_ORDER } from '@/lib/pricing/xlsx/apply';
import type { ScopedArticle } from '@/lib/pricing/xlsx/scope';

const TODAY = '2026-11-02';
const ACTOR = { id: 'import-xlsx', erpUser: 'PROFIT' };
const KEY = 'aaaaaaaa';

const rate = (coArt: string, coPrecio: string, monto: number, desde = '2026-01-01', hasta: string | null = null) =>
  ({ coArt, coPrecio, coAlma: '000015', desde, hasta, monto, coMone: 'USD', validador: '0x1' });

/** Two type lists (08, 09) with one ordinary segment each; C1, C2 in 000001 (08), C3 in 000002 (09). */
function setup() {
  const rates = makeFakeRatesErp({
    lists: [{ coPrecio: '08', desPrecio: 'INDEPENDIENTES' }, { coPrecio: '09', desPrecio: 'CADENAS' }],
    articles: [{ coArt: 'A1', artDes: 'Pan' }, { coArt: 'A2', artDes: 'Torta' }],
    rates: [rate('A1', '08', 10), rate('A2', '08', 20), rate('A1', '09', 11), rate('A2', '09', 21)],
  });
  const seg = makeFakeSegmentErp({
    segments: [
      { tipCli: '000001', desTipo: 'GENERAL', coPrecio: '08', desPrecio: null, customerCount: 2, validador: '0x1' },
      { tipCli: '000002', desTipo: 'CADENA', coPrecio: '09', desPrecio: null, customerCount: 1, validador: '0x1' },
    ],
    customers: {
      C1: { cliDes: 'Bodega 1', tipCli: '000001' }, C2: { cliDes: 'Bodega 2', tipCli: '000001' }, C3: { cliDes: 'Cadena 3', tipCli: '000002' },
    },
  });
  const db = makeMemoryDb();
  const calls: { name: string; args: unknown[] }[] = [];
  const hooks = { moveOutcome: null as null | ((coCli: string) => SegmentMoveResult | null) };
  const spy = <T extends object>(erp: T, names: string[]): T => new Proxy(erp, {
    get(t, p, r) {
      const v = Reflect.get(t, p, r);
      if (typeof p === 'string' && names.includes(p) && typeof v === 'function') {
        return (...a: unknown[]) => {
          calls.push({ name: p, args: a });
          if (p === 'moveCustomer' && hooks.moveOutcome) {
            const forced = hooks.moveOutcome(a[0] as string);
            if (forced) return Promise.resolve(forced);
          }
          return (v as (...x: unknown[]) => unknown)(...a);
        };
      }
      return v;
    },
  });
  const ratesErp = spy(rates.erp, ['cloneList', 'createList', 'applyRatePeriod']);
  const segErp = spy(seg.erp, ['createSegment', 'moveCustomer']);
  const deps = { lists: { erp: ratesErp, db }, segments: { erp: segErp, db } };
  const now = () => new Date(`${TODAY}T12:00:00`);
  const fixedDeps = { lists: { ...deps.lists, now }, segments: { ...deps.segments, now } };
  const count = (n: string) => calls.filter(c => c.name === n).length;
  const liveTypeOf = async (coCli: string) => {
    const ctx = await loadTypeContext({ rates: ratesErp, segments: segErp, db });
    const c = await segErp.getCustomer(coCli);
    return c ? resolveCustomerType(ctx, c.tipCli) : null;
  };
  return { rates, seg, db, calls, hooks, deps: fixedDeps, count, liveTypeOf, ratesErp, segErp };
}

const set = (customers: DiscountSet['customers'], overrides: [string, number][] = [['A1', 9]], key = KEY): DiscountSet =>
  ({ key, overrides: new Map(overrides), customers });
const perm = (coCli: string, desde = TODAY) => ({ coCli, desde, hasta: null });
const dated = (coCli: string, hasta: string, desde = TODAY) => ({ coCli, desde, hasta });
const TYPE_08 = { coPrecio: '08', tipCli: '000001' };

describe('specialListName', () => {
  test('Desc <key> · <type list>, max 60 chars', () => {
    expect(specialListName('INDEPENDIENTES', KEY)).toBe('Desc aaaaaaaa · INDEPENDIENTES');
    const long = specialListName('X'.repeat(80), KEY);
    expect(long).toHaveLength(60);
    expect(long.startsWith('Desc aaaaaaaa · XXX')).toBe(true);
  });
});

describe('applyDiscountSets', () => {
  test('two permanent customers sharing overrides: ONE cloneList and ONE group segment, both moved', async () => {
    const s = setup();
    const out = await applyDiscountSets(s.deps, [set([perm('C1'), perm('C2')])], () => TYPE_08, ACTOR);
    expect(s.count('cloneList')).toBe(1);
    expect(s.count('createSegment')).toBe(1);
    const clone = s.calls.find(c => c.name === 'cloneList')!.args[0] as { desPrecio: string; from: string; rows: { coArt: string; monto: number }[] };
    expect(clone.desPrecio).toBe('Desc aaaaaaaa · INDEPENDIENTES');
    expect(clone.from).toBe(TODAY);
    expect(clone.rows.map(r => [r.coArt, r.monto]).sort()).toEqual([['A1', 9], ['A2', 20]]);
    const created = s.seg.state.segments.find(x => x.desTipo === 'Desc aaaaaaaa · INDEPENDIENTES')!;
    expect(created.coPrecio).toBe(out[0].coPrecio);
    expect(getSegmentMeta(s.db, created.tipCli)?.kind).toBe('group');
    expect(s.seg.state.customers.C1.tipCli).toBe(created.tipCli);
    expect(s.seg.state.customers.C2.tipCli).toBe(created.tipCli);
    expect(out).toEqual([{ key: KEY, coPrecio: out[0].coPrecio, reusedList: false, customers: [{ coCli: 'C1', outcome: 'success' }, { coCli: 'C2', outcome: 'success' }] }]);
  });

  test('a dated customer gets a special segment expiring on hasta with the type segment as fallback', async () => {
    const s = setup();
    const out = await applyDiscountSets(s.deps, [set([dated('C1', '2026-12-15')])], () => TYPE_08, ACTOR);
    expect(out[0].customers).toEqual([{ coCli: 'C1', outcome: 'success' }]);
    const tip = s.seg.state.customers.C1.tipCli;
    expect(tip).not.toBe('000001');
    const meta = getSegmentMeta(s.db, tip)!;
    expect(meta).toMatchObject({ kind: 'special', expiresAt: '2026-12-15', fallbackTipCli: '000001', customerCoCli: 'C1', reason: 'Descuento por artículo' });
    expect(s.seg.state.segments.find(x => x.tipCli === tip)!.coPrecio).toBe(out[0].coPrecio);
  });

  test('re-running with the list present: no cloneList, no second segment, no re-move', async () => {
    const s = setup();
    const sets = [set([perm('C1'), perm('C2'), dated('C3', '2026-12-15')], [['A1', 9]])];
    const typeOf = (c: string) => (c === 'C3' ? { coPrecio: '08', tipCli: '000001' } : TYPE_08);
    await applyDiscountSets(s.deps, sets, typeOf, ACTOR);
    const before = { clone: s.count('cloneList'), seg: s.count('createSegment'), move: s.count('moveCustomer') };
    expect(before).toEqual({ clone: 1, seg: 2, move: 3 });
    const again = await applyDiscountSets(s.deps, sets, typeOf, ACTOR);
    expect({ clone: s.count('cloneList'), seg: s.count('createSegment'), move: s.count('moveCustomer') }).toEqual(before);
    expect(again[0].reusedList).toBe(true);
    expect(again[0].customers.map(c => c.outcome)).toEqual(['success', 'success', 'success']);
  });

  test('one moveCustomer conflict leaves the other customer success', async () => {
    const s = setup();
    s.hooks.moveOutcome = c => (c === 'C1' ? { coCli: c, outcome: 'conflict' } : null);
    const out = await applyDiscountSets(s.deps, [set([perm('C1'), perm('C2')])], () => TYPE_08, ACTOR);
    expect(out[0].customers.map(c => [c.coCli, c.outcome])).toEqual([['C1', 'conflict'], ['C2', 'success']]);
    expect(s.seg.state.customers.C1.tipCli).toBe('000001');
    expect(s.seg.state.customers.C2.tipCli).not.toBe('000001');
  });

  test('two customers of different type lists sharing a set get two lists, disambiguated by type list', async () => {
    const s = setup();
    const typeOf = (c: string) => (c === 'C3' ? { coPrecio: '09', tipCli: '000002' } : TYPE_08);
    const out = await applyDiscountSets(s.deps, [set([perm('C1'), perm('C3')])], typeOf, ACTOR);
    expect(s.count('cloneList')).toBe(2);
    const names = s.calls.filter(c => c.name === 'cloneList').map(c => (c.args[0] as { desPrecio: string }).desPrecio);
    expect(names).toEqual(['Desc aaaaaaaa-08 · INDEPENDIENTES', 'Desc aaaaaaaa-09 · CADENAS']);
    const c3Rows = (s.calls.filter(c => c.name === 'cloneList')[1].args[0] as { rows: { coArt: string; monto: number }[] }).rows;
    expect(c3Rows.map(r => [r.coArt, r.monto]).sort()).toEqual([['A1', 9], ['A2', 21]]);
    expect(out.map(o => o.key)).toEqual([`${KEY}-08`, `${KEY}-09`]);
  });

  test('a customer whose type cannot be resolved is an error and is never moved', async () => {
    const s = setup();
    const out = await applyDiscountSets(s.deps, [set([perm('C1'), perm('C2')])], c => (c === 'C2' ? null : TYPE_08), ACTOR);
    const all = out.flatMap(o => o.customers);
    expect(all.find(c => c.coCli === 'C2')).toMatchObject({ outcome: 'error', message: expect.stringContaining('tipo') });
    expect(all.find(c => c.coCli === 'C1')!.outcome).toBe('success');
    expect(s.calls.filter(c => c.name === 'moveCustomer').map(c => c.args[0])).toEqual(['C1']);
    expect(s.seg.state.customers.C2.tipCli).toBe('000001');
  });

  test('a failing list creation marks every customer of that list as error, nothing moved', async () => {
    const s = setup();
    s.rates.state.failCloneOnce = true;
    const out = await applyDiscountSets(s.deps, [set([perm('C1'), dated('C2', '2026-12-15')])], () => TYPE_08, ACTOR);
    expect(out[0].customers.map(c => [c.coCli, c.outcome])).toEqual([['C1', 'error'], ['C2', 'error']]);
    expect(out[0].customers[0].message).toContain('clone failed');
    expect(s.count('moveCustomer')).toBe(0);
    expect(s.count('createSegment')).toBe(0);
  });

  test('an override article not priced in the type list is an error for the list, nothing written', async () => {
    const s = setup();
    const out = await applyDiscountSets(s.deps, [set([perm('C1')], [['A9', 5]])], () => TYPE_08, ACTOR);
    expect(out[0].customers[0]).toMatchObject({ outcome: 'error', message: expect.stringContaining('A9') });
    expect(s.count('cloneList')).toBe(0);
  });
});

describe('resolveCustomerType', () => {
  const ctx: TypeContext = {
    lists: [
      { coPrecio: '08', desPrecio: 'INDEPENDIENTES' },
      { coPrecio: '20', desPrecio: 'Desc aaaaaaaa · INDEPENDIENTES' },
      { coPrecio: '30', desPrecio: 'MAYORISTAS DEL CENTRO Y OCCIDENTE DE LA REGION CAPITAL' },
      { coPrecio: '31', desPrecio: specialListName('MAYORISTAS DEL CENTRO Y OCCIDENTE DE LA REGION CAPITAL', KEY) },
    ],
    segments: [
      { tipCli: '000001', coPrecio: '08', kind: 'group', fallbackTipCli: null },
      { tipCli: '000005', coPrecio: '20', kind: 'group', fallbackTipCli: null },
      { tipCli: '000006', coPrecio: '20', kind: 'special', fallbackTipCli: '000001' },
      { tipCli: '000007', coPrecio: '30', kind: 'group', fallbackTipCli: null },
      { tipCli: '000008', coPrecio: '31', kind: 'group', fallbackTipCli: null },
    ],
  };
  test('an ordinary segment is its own type', () => {
    expect(resolveCustomerType(ctx, '000001')).toEqual({ tipCli: '000001', coPrecio: '08', desPrecio: 'INDEPENDIENTES' });
  });
  test('a dated discount segment resolves to its fallback', () => {
    expect(resolveCustomerType(ctx, '000006')).toEqual({ tipCli: '000001', coPrecio: '08', desPrecio: 'INDEPENDIENTES' });
  });
  test('a shared discount segment resolves through the special list name, even when truncated', () => {
    expect(resolveCustomerType(ctx, '000005')?.tipCli).toBe('000001');
    expect(resolveCustomerType(ctx, '000008')?.tipCli).toBe('000007');
  });
  test('unknown segment, or a discount list whose type list is gone, is null', () => {
    expect(resolveCustomerType(ctx, 'NOPE')).toBeNull();
    expect(resolveCustomerType({ ...ctx, lists: ctx.lists.filter(l => l.coPrecio !== '08') }, '000005')).toBeNull();
  });
});

describe('dry-run helpers', () => {
  const typeOf = (c: string) => (c === 'C3' ? { coPrecio: '09', desPrecio: 'CADENAS' } : { coPrecio: '08', desPrecio: 'INDEPENDIENTES' });

  test('groupDiscountTargets splits a set by type list only when needed', () => {
    const one = groupDiscountTargets([set([perm('C1'), perm('C2')])], typeOf);
    expect(one.targets.map(t => [t.key, t.name, t.customers.length])).toEqual([[KEY, 'Desc aaaaaaaa · INDEPENDIENTES', 2]]);
    const two = groupDiscountTargets([set([perm('C1'), perm('C3')])], typeOf);
    expect(two.targets.map(t => t.name)).toEqual(['Desc aaaaaaaa-08 · INDEPENDIENTES', 'Desc aaaaaaaa-09 · CADENAS']);
  });

  test('describeDiscountSets: created vs existing, article count, customers with their period', () => {
    const lines = describeDiscountSets(
      [set([perm('C1'), dated('C2', '2026-12-15')], [['A1', 9], ['A2', 18]]), set([perm('C3')], [['A1', 1]], 'bbbbbbbb')],
      ['Desc bbbbbbbb · CADENAS'], typeOf,
    );
    expect(lines).toEqual([
      'lista especial «Desc aaaaaaaa · INDEPENDIENTES»: se creará — 2 artículos distintos del tipo — clientes: C1 (permanente), C2 (hasta 2026-12-15)',
      'lista especial «Desc bbbbbbbb · CADENAS»: ya existe — 1 artículos distintos del tipo — clientes: C3 (permanente)',
    ]);
  });

  test('staleSpecialLists counts non-overridden articles whose price differs from the type list', () => {
    const notices = staleSpecialLists([
      { name: 'Desc a · T', typeName: 'T', special: new Map([['A1', 9], ['A2', 20], ['A3', 5]]), type: new Map([['A1', 10], ['A2', 22], ['A3', 5], ['A4', 7]]), overridden: ['A1'] },
      { name: 'Desc b · T', typeName: 'T', special: new Map([['A1', 9], ['A2', 20]]), type: new Map([['A1', 10], ['A2', 20]]), overridden: ['A1'] },
    ]);
    expect(notices).toEqual(['lista especial «Desc a · T» está desactualizada respecto a «T» (2 artículos); vuelva a cargar el libro para sincronizarla']);
  });

  test('discountDateIssues: hasta not after today is an error naming the customer; a future desde warns', () => {
    const r = discountDateIssues([set([dated('C1', TODAY), dated('C2', '2026-11-03'), perm('C3', '2026-11-09')])], TODAY);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain('C1');
    expect(r.errors[0]).toContain('hasta');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('C3');
  });
});

// ---------- pipeline ----------

const inScope: ScopedArticle[] = [
  { coArt: 'A1', artDes: 'Pan', line: 'Panaderia', category: 'Fresco' },
  { coArt: 'A2', artDes: 'Torta', line: 'Pasteleria', category: 'Fresco' },
];
const LISTAS = [['lista', 'nombre', 'moneda', 'desde', 'nueva'], ['08', 'INDEPENDIENTES', 'USD', TODAY, '']];
const PRECIOS = [['co_art', 'nombre', 'linea', 'categoria', 'actual 08'], ['A1', 'Pan', 'Panaderia', 'Fresco', 10], ['A2', 'Torta', 'Pasteleria', 'Fresco', 20]];
const PROMO_HEAD = ['promocion', 'lista', 'desde', 'hasta', 'motivo', 'co_art', 'precio', 'estado'];
const DESC = [['co_cli', 'co_art', 'precio', 'desde', 'hasta']];
const CLI_HEAD = ['co_cli', 'nombre', 'tip_cli_actual', 'des_tipo_actual', 'lista_actual', 'lista_usada_90d', 'moneda_90d', 'tip_cli_nuevo'];

function book(over: Record<string, unknown[][]>): Buffer {
  const sheets = { Listas: LISTAS, Precios: PRECIOS, Promociones: [PROMO_HEAD], 'Descuentos por cliente': DESC, Clientes: [CLI_HEAD], ...over };
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
const runFile = () => join(mkdtempSync(join(tmpdir(), 'xlsx-disc-')), 'runs', 'r1.jsonl');

async function pipeline(sheets: Record<string, unknown[][]>) {
  const s = setup();
  const wdeps = { rates: s.ratesErp, segments: s.segErp, db: s.db, today: TODAY };
  const parsed = parseWorkbook(book(sheets), inScope);
  expect(parsed.errors).toEqual([]);
  const plan = await planWorkbook(wdeps, parsed, TODAY);
  return { ...s, wdeps, parsed, plan };
}

describe('workbook pipeline with discounts', () => {
  test('STEP_ORDER is lists → promotions → customers → discounts', () => {
    expect(STEP_ORDER).toEqual(['lists', 'promotions', 'customers', 'discounts']);
  });

  test('all runs discounts last; a re-run of the same workbook writes nothing new and does not re-move customers', async () => {
    const sheets = {
      'Descuentos por cliente': [...DESC, ['C1', 'A1', '-10%', TODAY, ''], ['C2', 'A1', '-10%', TODAY, '']],
      Clientes: [CLI_HEAD, ['C1', 'Bodega 1', '000002', 'CADENA', '09', '', 'USD', '000001']],
    };
    const s = await pipeline(sheets);
    s.seg.state.customers.C1.tipCli = '000002'; // C1 is moved to its type 000001 by the customers step
    const p = await planWorkbook(s.wdeps, s.parsed, TODAY);
    expect(p.problems).toEqual([]);
    expect(p.discounts.lines).toEqual([
      'lista especial «Desc ' + p.discounts.sets[0].key + ' · INDEPENDIENTES»: se creará — 1 artículos distintos del tipo — clientes: C1 (permanente), C2 (permanente)',
    ]);
    const out = await applyWorkbook(s.wdeps, p, s.parsed, 'all', ACTOR, runFile());
    expect(out.map(o => [o.step, o.status])).toEqual([['lists', 'ok'], ['promotions', 'ok'], ['customers', 'ok'], ['discounts', 'ok']]);
    const order = s.calls.map(c => c.name);
    expect(order.indexOf('moveCustomer')).toBeLessThan(order.indexOf('cloneList'));
    const seg = s.seg.state.segments.find(x => x.desTipo.startsWith('Desc '))!;
    expect(s.seg.state.customers.C1.tipCli).toBe(seg.tipCli);
    expect(s.seg.state.customers.C2.tipCli).toBe(seg.tipCli);
    const discountList = s.rates.state.rates.filter(r => r.coPrecio === seg.coPrecio).map(r => [r.coArt, r.monto]).sort();
    expect(discountList).toEqual([['A1', 9], ['A2', 20]]);

    const before = s.calls.length;
    const again = await planWorkbook(s.wdeps, s.parsed, TODAY);
    expect(again.problems).toEqual([]);
    expect(again.discounts.sets[0].key).toBe(p.discounts.sets[0].key); // percent still computed against the type list
    expect(again.discounts.lines[0]).toContain('ya existe');
    const out2 = await applyWorkbook(s.wdeps, again, s.parsed, 'all', ACTOR, runFile());
    expect(out2.every(o => o.status === 'ok')).toBe(true);
    expect(s.calls.slice(before).map(c => c.name)).toEqual([]);
  });

  test('a stale special list is reported in the plan', async () => {
    const sheets = { 'Descuentos por cliente': [...DESC, ['C1', 'A1', 9, TODAY, '']] };
    const s = await pipeline(sheets);
    await applyWorkbook(s.wdeps, s.plan, s.parsed, 'discounts', ACTOR, runFile());
    const a2 = s.rates.state.rates.find(r => r.coPrecio === '08' && r.coArt === 'A2')!;
    a2.monto = 25; // the type list moved on after the special list was cloned
    const again = await planWorkbook(s.wdeps, s.parsed, TODAY);
    expect(again.discounts.stale).toEqual([
      `lista especial «Desc ${again.discounts.sets[0].key} · INDEPENDIENTES» está desactualizada respecto a «INDEPENDIENTES» (1 artículos); vuelva a cargar el libro para sincronizarla`,
    ]);
  });

  test('discounts is omitido when an earlier step fails', async () => {
    const s = await pipeline({
      'Descuentos por cliente': [...DESC, ['C1', 'A1', 9, TODAY, '']],
      Clientes: [CLI_HEAD, ['C2', 'Bodega 2', '000001', 'GENERAL', '08', '', 'USD', '000002']],
    });
    s.hooks.moveOutcome = c => (c === 'C2' ? { coCli: c, outcome: 'conflict' } : null);
    const out = await applyWorkbook(s.wdeps, s.plan, s.parsed, 'all', ACTOR, runFile());
    expect(out.map(o => [o.step, o.status])).toEqual([['lists', 'ok'], ['promotions', 'ok'], ['customers', 'failed'], ['discounts', 'skipped']]);
    expect(out[3].lines).toEqual(['omitido']);
    expect(s.count('cloneList')).toBe(0);
  });

  test('hasta not after today is a plan problem and blocks every write', async () => {
    const s = await pipeline({ 'Descuentos por cliente': [...DESC, ['C1', 'A1', 9, '2026-10-01', TODAY]] });
    expect(s.plan.problems.join('\n')).toMatch(/Descuentos por cliente: .*C1.*hasta/);
    await expect(applyWorkbook(s.wdeps, s.plan, s.parsed, 'all', ACTOR, runFile())).rejects.toThrow('no se escribe nada');
    expect(s.calls).toEqual([]);
  });

  test('step discounts alone applies only discounts', async () => {
    const s = await pipeline({ 'Descuentos por cliente': [...DESC, ['C1', 'A1', 9, TODAY, '2026-12-15']] });
    const out = await applyWorkbook(s.wdeps, s.plan, s.parsed, 'discounts', ACTOR, runFile());
    expect(out.map(o => [o.step, o.status])).toEqual([['discounts', 'ok']]);
    expect(getSegmentMeta(s.db, s.seg.state.customers.C1.tipCli)).toMatchObject({ kind: 'special', expiresAt: '2026-12-15', fallbackTipCli: '000001' });
  });
});
