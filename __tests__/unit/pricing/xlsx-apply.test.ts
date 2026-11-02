import { describe, expect, test } from 'bun:test';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as XLSX from 'xlsx';
import { makeMemoryDb } from '../../helpers/memory-db';
import { makeFakeRatesErp } from '../../helpers/fake-rates-erp';
import { makeFakeSegmentErp } from '../../helpers/fake-segment-erp';
import { parseWorkbook, planWorkbook } from '@/lib/pricing/xlsx/import';
import { applyWorkbook, resolveListSentinels, type WorkbookApplyDeps } from '@/lib/pricing/xlsx/apply';
import { listPromotions } from '@/lib/pricing/promotions-repo';
import type { ScopedArticle } from '@/lib/pricing/xlsx/scope';
import type { TipoClienteRow } from '@/lib/pricing/tipo-cliente-apply/csv';

const TODAY = '2026-11-02';
const NEW_DESDE = '2026-11-09';
const ACTOR = { id: 'import-xlsx', erpUser: 'PROFIT' };

const inScope: ScopedArticle[] = [
  { coArt: 'A1', artDes: 'Pan', line: 'Panaderia', category: 'Fresco' },
  { coArt: 'A2', artDes: 'Torta', line: 'Pasteleria', category: 'Fresco' },
];
const LISTAS = [['lista', 'nombre', 'moneda', 'desde', 'nueva'], ['08', 'INDEPENDIENTES', 'USD', TODAY, ''], ['B', 'Cadenas', 'USD', NEW_DESDE, 'si']];
const PRECIOS = [['co_art', 'nombre', 'linea', 'categoria', 'actual 08', 'B'], ['A1', 'Pan', 'Panaderia', 'Fresco', 10, 12], ['A2', 'Torta', 'Pasteleria', 'Fresco', 20, 25]];
const PROMO_HEAD = ['promocion', 'lista', 'desde', 'hasta', 'motivo', 'co_art', 'precio', 'estado'];
const DESC = [['co_cli', 'co_art', 'precio', 'desde', 'hasta']];
const CLI_HEAD = ['co_cli', 'nombre', 'tip_cli_actual', 'des_tipo_actual', 'lista_actual', 'lista_usada_90d', 'moneda_90d', 'tip_cli_nuevo'];
const cli = (...targets: string[]) => [CLI_HEAD, ...targets.map((t, i) => [`C${i + 1}`, `Bodega ${i + 1}`, '000001', 'GENERAL', '08', '08', 'USD', t])];

function book(over: Record<string, unknown[][]> = {}): Buffer {
  const sheets = { Listas: LISTAS, Precios: PRECIOS, Promociones: [PROMO_HEAD], 'Descuentos por cliente': DESC, Clientes: cli(''), ...over };
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** Fake ERP that records the call order of every write method (name only). */
function setup() {
  const rates = makeFakeRatesErp({
    lists: [{ coPrecio: '08', desPrecio: 'INDEPENDIENTES' }],
    articles: [{ coArt: 'A1', artDes: 'Pan' }, { coArt: 'A2', artDes: 'Torta' }],
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
  const calls: string[] = [];
  const hooks = { rejectPrices: false };
  const spy = <T extends object>(erp: T, names: string[]): T => new Proxy(erp, {
    get(t, p, r) {
      const v = Reflect.get(t, p, r);
      if (typeof p === 'string' && names.includes(p) && typeof v === 'function') {
        return (...a: unknown[]) => {
          calls.push(p);
          if (p === 'applyRatePeriod' && hooks.rejectPrices) return Promise.resolve({ outcome: 'rejected', message: 'rechazado' });
          return (v as (...x: unknown[]) => unknown)(...a);
        };
      }
      return v;
    },
  });
  const deps: WorkbookApplyDeps = {
    rates: spy(rates.erp, ['createList', 'applyRatePeriod']), segments: spy(seg.erp, ['createSegment', 'moveCustomer']),
    db: makeMemoryDb(), today: TODAY,
  };
  return { deps, calls, rates, seg, hooks };
}
const runFile = () => join(mkdtempSync(join(tmpdir(), 'xlsx-apply-')), 'runs', 'r1.jsonl');
async function prepare(sheets: Record<string, unknown[][]>) {
  const s = setup();
  const parsed = parseWorkbook(book(sheets), inScope);
  expect(parsed.errors).toEqual([]);
  const plan = await planWorkbook(s.deps, parsed, TODAY);
  return { ...s, parsed, plan };
}

const row = (coCli: string, target: string): TipoClienteRow => ({ line: 2, coCli, nombre: coCli, moneda90d: '', target });

describe('resolveListSentinels', () => {
  test('maps L:@key to L:<coPrecio>, key trimmed and case-insensitive; other targets untouched', () => {
    const out = resolveListSentinels([row('C1', 'L:@Cadenas'), row('C2', '000003'), row('C3', 'L:09'), row('C4', '')], [{ key: ' cadenas ', coPrecio: '12' }]);
    expect(out.map(r => r.target)).toEqual(['L:12', '000003', 'L:09', '']);
  });
  test('an unknown key throws a Spanish error with the key as typed', () => {
    expect(() => resolveListSentinels([row('C1', 'L:@Nope')], [{ key: 'B', coPrecio: '12' }])).toThrow('Lista «Nope» no existe');
  });
});

describe('applyWorkbook', () => {
  test('all: lists → promotions → customers in order; promos and customers resolve to the new list', async () => {
    const s = await prepare({
      Promociones: [PROMO_HEAD, ['Oferta', 'B', NEW_DESDE, '2026-12-01', '', 'A1', 9, '']],
      Clientes: cli('Cadenas', ''),
    });
    expect(s.plan.problems).toEqual([]);
    const file = runFile();
    const out = await applyWorkbook(s.deps, s.plan, s.parsed, 'all', ACTOR, file);
    expect(out.map(o => [o.step, o.status])).toEqual([['lists', 'ok'], ['promotions', 'ok'], ['customers', 'ok']]);

    const first = (n: string) => s.calls.indexOf(n);
    const last = (n: string) => s.calls.lastIndexOf(n);
    expect(first('createList')).toBe(0);
    expect(last('applyRatePeriod')).toBeLessThan(first('createSegment'));
    expect(first('createSegment')).toBeLessThan(first('moveCustomer'));
    // the promotion's price rows are written after the list's own prices (promotions step sits between lists and customers)
    const newCode = s.rates.state.lists.find(l => l.desPrecio === 'Cadenas')!.coPrecio;
    expect(listPromotions(s.deps.db).map(p => [p.name, p.coPrecio])).toEqual([['Oferta', newCode]]);
    expect(s.seg.state.customers.C1.tipCli).not.toBe('000001');
    expect(s.seg.state.customers.C2.tipCli).toBe('000001');
    expect(readFileSync(file, 'utf8')).toContain('"type":"move"');
    expect(out[2].moved).toBe(1);
  });

  test('step promotions never calls the lists writer', async () => {
    const s = await prepare({ Promociones: [PROMO_HEAD, ['Oferta', '08', NEW_DESDE, '2026-12-01', '', 'A1', 9, '']] });
    const out = await applyWorkbook(s.deps, s.plan, s.parsed, 'promotions', ACTOR, runFile());
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('ok');
    expect(s.calls).not.toContain('createList');
    expect(s.rates.state.lists).toHaveLength(1);
    expect(listPromotions(s.deps.db)).toHaveLength(1);
  });

  test('step promotions alone refuses promos targeting a list not yet in Profit', async () => {
    const s = await prepare({ Promociones: [PROMO_HEAD, ['Oferta', 'B', NEW_DESDE, '2026-12-01', '', 'A1', 9, '']] });
    const out = await applyWorkbook(s.deps, s.plan, s.parsed, 'promotions', ACTOR, runFile());
    expect(out[0].status).toBe('failed');
    expect(out[0].lines.join('\n')).toContain('apuntan a listas que aún no existen: «Oferta»');
    expect(s.calls).toEqual([]);
    expect(listPromotions(s.deps.db)).toEqual([]);
  });

  test('plan problems block every write', async () => {
    const s = await prepare({ Clientes: cli('NOPE') });
    expect(s.plan.problems.length).toBeGreaterThan(0);
    await expect(applyWorkbook(s.deps, s.plan, s.parsed, 'all', ACTOR, runFile())).rejects.toThrow('no se escribe nada');
    expect(s.calls).toEqual([]);
    expect(s.rates.state.lists).toHaveLength(1);
  });

  test('a failing step stops the later ones, reported as omitido', async () => {
    const s = await prepare({ Clientes: cli('Cadenas') });
    s.hooks.rejectPrices = true; // every price write is rejected -> lists step fails
    const out = await applyWorkbook(s.deps, s.plan, s.parsed, 'all', ACTOR, runFile());
    expect(out.map(o => [o.step, o.status])).toEqual([['lists', 'failed'], ['promotions', 'skipped'], ['customers', 'skipped']]);
    expect(out[0].failures).toBeGreaterThan(0);
    expect(out[1].lines).toEqual(['omitido']);
    expect(s.calls).not.toContain('moveCustomer');
  });

  test('customers alone resolves new-list keys by nombre against live lists', async () => {
    const s = await prepare({ Clientes: cli('Cadenas') });
    s.rates.state.lists.push({ coPrecio: '12', desPrecio: 'CADENAS' }); // created by an earlier --step lists run
    s.rates.state.rates.push({ coArt: 'A1', coPrecio: '12', coAlma: '000015', desde: NEW_DESDE, hasta: null, monto: 12, coMone: 'USD', validador: '0x1' });
    const out = await applyWorkbook(s.deps, s.plan, s.parsed, 'customers', ACTOR, runFile());
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('ok');
    expect(s.calls).not.toContain('createList');
    expect(s.calls).toContain('moveCustomer');
  });

  test('customers alone errors when the new list is not in Profit, writing nothing', async () => {
    const s = await prepare({ Clientes: cli('Cadenas') });
    const file = runFile();
    const out = await applyWorkbook(s.deps, s.plan, s.parsed, 'customers', ACTOR, file);
    expect(out[0].status).toBe('failed');
    expect(out[0].lines.join('\n')).toContain('Lista «Cadenas» no existe en Profit; ejecute antes --step lists');
    expect(s.calls).toEqual([]);
    expect(existsSync(file)).toBe(false);
  });
});
