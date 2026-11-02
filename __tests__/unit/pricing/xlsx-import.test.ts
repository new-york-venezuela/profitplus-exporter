import { describe, expect, test } from 'bun:test';
import * as XLSX from 'xlsx';
import { makeMemoryDb } from '../../helpers/memory-db';
import { makeFakeRatesErp } from '../../helpers/fake-rates-erp';
import { makeFakeSegmentErp } from '../../helpers/fake-segment-erp';
import { parseWorkbook, planWorkbook, type WorkbookDeps } from '@/lib/pricing/xlsx/import';
import { listPromotions } from '@/lib/pricing/promotions-repo';
import { listAudit } from '@/lib/pricing/segments-repo';
import type { ScopedArticle } from '@/lib/pricing/xlsx/scope';

const TODAY = '2026-11-02';
const NEW_DESDE = '2026-11-09';

const inScope: ScopedArticle[] = [
  { coArt: 'A1', artDes: 'Pan', line: 'Panaderia', category: 'Fresco' },
  { coArt: 'A2', artDes: 'Torta', line: 'Pasteleria', category: 'Fresco' },
];

type Sheets = Record<string, unknown[][]>;

const LISTAS = [['lista', 'nombre', 'moneda', 'desde', 'nueva'], ['08', 'INDEPENDIENTES', 'USD', TODAY, ''], ['B', 'Cadenas', 'USD', NEW_DESDE, 'si']];
const PRECIOS = [['co_art', 'nombre', 'linea', 'categoria', 'actual 08', 'B'], ['A1', 'Pan', 'Panaderia', 'Fresco', 10, 12], ['A2', 'Torta', 'Pasteleria', 'Fresco', 20, 25]];
const PROMOS = [['promocion', 'lista', 'desde', 'hasta', 'motivo', 'co_art', 'precio', 'estado'], ['Vieja', '08', TODAY, '2026-12-01', '', 'A1', 8, 'activa']];
const DESC = [['co_cli', 'co_art', 'precio', 'desde', 'hasta']];
const CLIENTES = [['co_cli', 'nombre', 'tip_cli_actual', 'des_tipo_actual', 'lista_actual', 'lista_usada_90d', 'moneda_90d', 'tip_cli_nuevo'], ['C1', 'Bodega 1', '000001', 'GENERAL', '08', '08', 'USD', '']];

function book(over: Sheets = {}): Buffer {
  const sheets: Sheets = { Listas: LISTAS, Precios: PRECIOS, Promociones: PROMOS, 'Descuentos por cliente': DESC, Clientes: CLIENTES, ...over };
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
const withTarget = (target: string) => [CLIENTES[0], [...CLIENTES[1].slice(0, 7), target]];

describe('parseWorkbook', () => {
  test('only nueva=SI rows become lists; the new list price column is read and `actual 08` is ignored', () => {
    const p = parseWorkbook(book(), inScope);
    expect(p.errors).toEqual([]);
    expect(p.lists).toEqual([{ key: 'B', nombre: 'Cadenas', coMone: 'USD', desde: NEW_DESDE }]);
    expect(p.cells.map(c => [c.coArt, c.key, c.monto])).toEqual([['A1', 'B', 12], ['A2', 'B', 25]]);
  });

  test('an unmodified export (no nueva rows) parses clean and empty', () => {
    const p = parseWorkbook(book({ Listas: [LISTAS[0], LISTAS[1]], Precios: PRECIOS.map(r => r.slice(0, 5)) }), inScope);
    expect(p).toMatchObject({ lists: [], cells: [], promos: [], discounts: [], errors: [] });
    expect(p.customers.map(c => c.target)).toEqual(['']);
  });

  test('promotion rows with estado filled are ignored; blank-estado rows are read', () => {
    const rows = [...PROMOS, ['Nueva', 'B', NEW_DESDE, '2026-12-01', 'x', 'A2', 22, '']];
    const p = parseWorkbook(book({ Promociones: rows }), inScope);
    expect(p.errors).toEqual([]);
    expect(p.promos.map(x => [x.name, x.lista, x.items.map(i => i.coArt)])).toEqual([['Nueva', 'B', ['A2']]]);
  });

  test('a price, promotion or discount for an article outside the scope is a scope error', () => {
    const p = parseWorkbook(book({
      Precios: [...PRECIOS, ['X9', 'Harina', 'Insumos', '', '', 3]],
      Promociones: [...PROMOS, ['Nueva', 'B', NEW_DESDE, '2026-12-01', '', 'X8', 22, '']],
      'Descuentos por cliente': [...DESC, ['C1', 'X7', 5, NEW_DESDE, '']],
    }), inScope);
    const text = p.errors.join('\n');
    expect(text).toContain('Precios: X9 no es un producto terminado');
    expect(text).toContain('Promociones: X8 no es un producto terminado');
    expect(text).toContain('Descuentos por cliente: X7 no es un producto terminado');
  });

  test('tip_cli_nuevo equal to a new list key or name becomes the L:@key sentinel; other values are untouched', () => {
    const rows = [CLIENTES[0], ['C1', 'a', '', '', '', '', '', ' cadenas '], ['C2', 'b', '', '', '', '', '', 'b'], ['C3', 'c', '', '', '', '', '', 'L:09'], ['C4', 'd', '', '', '', '', '', '000003'], ['C5', 'e', '', '', '', '', '', '09']];
    const p = parseWorkbook(book({ Clientes: rows }), inScope);
    expect(p.customers.map(c => c.target)).toEqual(['L:@B', 'L:@B', 'L:09', '000003', '09']);
  });

  test('moneda_90d is optional on Clientes', () => {
    const rows = CLIENTES.map(r => [...r.slice(0, 6), r[7]]);
    const p = parseWorkbook(book({ Clientes: rows }), inScope);
    expect(p.errors).toEqual([]);
    expect(p.customers[0].moneda90d).toBe('');
  });

  test('a missing sheet, a missing column and a damaged header are errors, not throws', () => {
    const noSheet = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(noSheet, XLSX.utils.aoa_to_sheet(LISTAS), 'Listas');
    const buf = XLSX.write(noSheet, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const e1 = parseWorkbook(buf, inScope).errors.join('\n');
    expect(e1).toContain('Falta la hoja «Precios»');
    expect(e1).toContain('Falta la hoja «Clientes»');

    const e2 = parseWorkbook(book({ Clientes: [['co_cli', 'nombre'], ['C1', 'x']] }), inScope).errors.join('\n');
    expect(e2).toContain('Falta la columna «tip_cli_nuevo» en «Clientes»');

    const e3 = parseWorkbook(book({ 'Descuentos por cliente': [['co_cli;co_art;precio;desde;hasta'], ['C1;A1;5;2026-11-09;']] }), inScope).errors;
    expect(e3.length).toBeGreaterThan(0);

    expect(parseWorkbook(Buffer.from('not a workbook'), inScope).errors.length).toBeGreaterThan(0);
  });

  test('malformed values are reported with the sheet name', () => {
    const p = parseWorkbook(book({ Precios: [PRECIOS[0], ['A1', '', '', '', '', '12,5']] }), inScope);
    expect(p.errors.join('\n')).toContain('la hoja Precios');
  });
});

function makeDeps() {
  const rates = makeFakeRatesErp({
    lists: [{ coPrecio: '08', desPrecio: 'INDEPENDIENTES' }],
    articles: [{ coArt: 'A1', artDes: 'Pan' }, { coArt: 'A2', artDes: 'Torta' }, { coArt: 'X9', artDes: 'Harina' }],
    rates: [
      { coArt: 'A1', coPrecio: '08', coAlma: '000015', desde: '2026-01-01', hasta: null, monto: 10, coMone: 'USD', validador: '0x1' },
      { coArt: 'A2', coPrecio: '08', coAlma: '000015', desde: '2026-01-01', hasta: null, monto: 20, coMone: 'USD', validador: '0x1' },
    ],
    customers: { C1: { cliDes: 'Bodega 1', tipCli: '000001', coPrecio: '08' }, C2: { cliDes: 'Bodega 2', tipCli: '000001', coPrecio: '08' } },
  });
  const seg = makeFakeSegmentErp({
    segments: [{ tipCli: '000001', desTipo: 'GENERAL', coPrecio: '08', desPrecio: null, customerCount: 2, validador: '0x1' }],
    customers: { C1: { cliDes: 'Bodega 1', tipCli: '000001' }, C2: { cliDes: 'Bodega 2', tipCli: '000001' } },
  });
  return { rates, seg, db: makeMemoryDb() };
}

const WRITES = ['applyRatePeriod', 'applyPlanned', 'createList', 'updateList', 'cloneList', 'createSegment', 'updateSegment', 'moveCustomer'];
/** Wraps an ERP fake so any write method is recorded and then throws. */
function guarded<T extends object>(erp: T, log: string[]): T {
  return new Proxy(erp, {
    get(target, prop, recv) {
      if (typeof prop === 'string' && WRITES.includes(prop)) return () => { log.push(prop); throw new Error(`write attempted: ${prop}`); };
      return Reflect.get(target, prop, recv);
    },
  });
}

describe('planWorkbook', () => {
  test('plans new lists, promotions on them, and compiles per-customer discounts against the new list prices', async () => {
    const d = makeDeps();
    const deps: WorkbookDeps = { rates: d.rates.erp, segments: d.seg.erp, db: d.db };
    const parsed = parseWorkbook(book({
      Promociones: [PROMOS[0], ['Oferta', 'B', NEW_DESDE, '2026-12-01', '', 'A1', 9, '']],
      Clientes: withTarget('Cadenas'),
      'Descuentos por cliente': [...DESC, ['C1', 'A1', '-10%', NEW_DESDE, ''], ['C1', 'A2', 24, NEW_DESDE, '']],
    }), inScope);
    expect(parsed.errors).toEqual([]);
    const plan = await planWorkbook(deps, parsed, TODAY);
    expect(plan.problems).toEqual([]);
    expect(plan.lists.lists).toMatchObject([{ key: 'B', existingCoPrecio: null, changes: [{ coArt: 'A1', monto: 12 }, { coArt: 'A2', monto: 25 }] }]);
    expect(plan.promos.promos).toMatchObject([{ name: 'Oferta', target: { kind: 'pending', key: 'B' }, items: [{ coArt: 'A1', monto: 9, regular: 12 }] }]);
    expect(plan.customers).toBeNull();
    expect(plan.warnings.join('\n')).toContain('listas nuevas');
    expect(plan.discounts.errors).toEqual([]);
    expect(plan.discounts.sets).toHaveLength(1);
    expect([...plan.discounts.sets[0].overrides]).toEqual([['A1', 10.8], ['A2', 24]]);
    expect(plan.discounts.sets[0].customers.map(c => c.coCli)).toEqual(['C1']);
  });

  test('a customer without a target uses its live ERP list for percent discounts', async () => {
    const d = makeDeps();
    const parsed = parseWorkbook(book({ 'Descuentos por cliente': [...DESC, ['C2', 'a1', '-10%', NEW_DESDE, '']] }), inScope);
    const plan = await planWorkbook({ rates: d.rates.erp, segments: d.seg.erp, db: d.db }, parsed, TODAY);
    expect([...plan.discounts.sets[0].overrides]).toEqual([['A1', 9]]);
    expect(plan.customers).toMatchObject({ blank: 1, moves: [] });
  });

  test('a customer moving to an existing list resolves the discount base from that list', async () => {
    const d = makeDeps();
    const parsed = parseWorkbook(book({ Clientes: withTarget('08'), 'Descuentos por cliente': [...DESC, ['C1', 'A2', '-50%', NEW_DESDE, '']] }), inScope);
    const plan = await planWorkbook({ rates: d.rates.erp, segments: d.seg.erp, db: d.db }, parsed, TODAY);
    expect(plan.customers).not.toBeNull();
    expect([...plan.discounts.sets[0].overrides]).toEqual([['A2', 10]]);
  });

  test('an unknown customer target is a customers problem, not a throw', async () => {
    const d = makeDeps();
    const parsed = parseWorkbook(book({ Clientes: withTarget('NOPE') }), inScope);
    const plan = await planWorkbook({ rates: d.rates.erp, segments: d.seg.erp, db: d.db }, parsed, TODAY);
    expect(plan.problems.join('\n')).toContain('no es un segmento ni una lista');
  });

  test('parse errors short-circuit: problems carry the errors and no section is planned', async () => {
    const d = makeDeps();
    const parsed = parseWorkbook(book({ Clientes: [['co_cli']] }), inScope);
    const plan = await planWorkbook({ rates: d.rates.erp, segments: d.seg.erp, db: d.db }, parsed, TODAY);
    expect(plan.problems).toEqual(parsed.errors);
    expect(plan.lists.lists).toEqual([]);
  });

  test('an unmodified export yields an empty, problem-free plan', async () => {
    const d = makeDeps();
    const parsed = parseWorkbook(book({ Listas: [LISTAS[0], LISTAS[1]], Precios: PRECIOS.map(r => r.slice(0, 5)) }), inScope);
    const plan = await planWorkbook({ rates: d.rates.erp, segments: d.seg.erp, db: d.db }, parsed, TODAY);
    expect(plan.problems).toEqual([]);
    expect(plan.lists.lists).toEqual([]);
    expect(plan.promos.promos).toEqual([]);
    expect(plan.customers).toMatchObject({ moves: [], blank: 1 });
  });

  test('planWorkbook reports 0 writes: no ERP write method is called and SQLite stays untouched', async () => {
    const d = makeDeps();
    const log: string[] = [];
    const deps: WorkbookDeps = { rates: guarded(d.rates.erp, log), segments: guarded(d.seg.erp, log), db: d.db };
    const parsed = parseWorkbook(book({
      Promociones: [PROMOS[0], ['Oferta', '08', NEW_DESDE, '2026-12-01', '', 'A1', 9, ''], ['Oferta B', 'B', NEW_DESDE, '2026-12-01', '', 'A1', 9, '']],
      Clientes: withTarget('08'),
      'Descuentos por cliente': [...DESC, ['C1', 'A1', '-10%', NEW_DESDE, '']],
    }), inScope);
    const ratesBefore = structuredClone(d.rates.state.rates);
    const plan = await planWorkbook(deps, parsed, TODAY);
    expect(plan.promos.promos.length).toBe(2);
    expect(log).toEqual([]);
    expect(d.rates.state.rates).toEqual(ratesBefore);
    expect(d.rates.state.lists).toHaveLength(1);
    expect(d.seg.state.customers.C1.tipCli).toBe('000001');
    expect(listPromotions(d.db)).toEqual([]);
    expect(listAudit(d.db)).toEqual([]);
  });
});
