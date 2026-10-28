import { describe, test, expect } from 'bun:test';
import { parseTipoClienteCsv } from '@/lib/pricing/tipo-cliente-apply/csv';
import { buildTipoClientePlan, type PlanContext } from '@/lib/pricing/tipo-cliente-apply/plan';

const ctx: PlanContext = {
  customers: new Map([
    ['C1', { coCli: 'C1', cliDes: 'Bodega 1', tipCli: '000001' }],
    ['C2', { coCli: 'C2', cliDes: 'Bodega 2', tipCli: '000003' }],
    ['C3', { coCli: 'C3', cliDes: 'Bodega 3', tipCli: '000001' }],
  ]),
  segments: [
    { tipCli: '000001', desTipo: 'INDEPENDIENTE', coPrecio: '01', special: false },
    { tipCli: '000003', desTipo: 'Mayorista', coPrecio: '09', special: false },
    { tipCli: '000004', desTipo: 'Cadena A', coPrecio: '04', special: false },
    { tipCli: '000005', desTipo: 'Cadena B', coPrecio: '04', special: false },
    { tipCli: '000006', desTipo: 'Promo X · hasta 31/10', coPrecio: '09', special: true },
    { tipCli: '02', desTipo: 'USD CONTADO', coPrecio: '03', special: false },
  ],
  lists: [
    { coPrecio: '01', desPrecio: 'BASE', coMone: 'BSD', rateCount: 1 },
    { coPrecio: '02', desPrecio: 'CONTADO USD', coMone: 'USD', rateCount: 21 },
    { coPrecio: '03', desPrecio: 'Lista 03', coMone: 'BSD', rateCount: 4 },
    { coPrecio: '04', desPrecio: 'Cadenas', coMone: 'USD', rateCount: 14 },
    { coPrecio: '09', desPrecio: 'Mayorista USD', coMone: 'USD', rateCount: 17 },
    { coPrecio: '10', desPrecio: 'Vacía', coMone: 'USD', rateCount: 0 },
  ],
};
const row = (coCli: string, target: string, moneda90d = '', line = 2) => ({ line, coCli, nombre: '', moneda90d, target });

describe('parseTipoClienteCsv', () => {
  test('reads the export, keeps blanks, rejects missing columns and duplicates', () => {
    const ok = parseTipoClienteCsv('co_cli,nombre,moneda_90d,tip_cli_nuevo\nC1,"A, B",usd,09\nC2,X,,\n');
    expect(ok.errors).toEqual([]);
    expect(ok.rows.map(r => [r.coCli, r.moneda90d, r.target])).toEqual([['C1', 'USD', '09'], ['C2', '', '']]);
    expect(parseTipoClienteCsv('co_cli,nombre\nC1,x\n').errors[0]).toContain('tip_cli_nuevo');
    expect(parseTipoClienteCsv('co_cli,tip_cli_nuevo\nC1,09\nC1,09\n').errors[0]).toContain('repetido');
  });
});

describe('buildTipoClientePlan', () => {
  test('blank rows are left alone; a customer already in the target is unchanged', () => {
    const p = buildTipoClientePlan([row('C1', ''), row('C2', '000003')], ctx);
    expect(p).toMatchObject({ blank: 1, unchanged: 1, moves: [], problems: [] });
  });
  test('a list code picks that list\'s only ordinary segment (the promotion segment is ignored)', () => {
    const p = buildTipoClientePlan([row('C1', '09')], ctx);
    expect(p.moves).toEqual([{ coCli: 'C1', nombre: 'Bodega 1', fromTipCli: '000001', toTipCli: '000003', createForList: null, coPrecio: '09' }]);
  });
  test('a list without a segment creates one, once, for all customers', () => {
    const p = buildTipoClientePlan([row('C1', '02'), row('C3', 'L:02')], ctx);
    expect(p.segmentsToCreate).toEqual([{ coPrecio: '02', desTipo: 'CONTADO USD' }]);
    expect(p.moves.map(m => [m.coCli, m.toTipCli, m.createForList])).toEqual([['C1', '02', null], ['C3', null, '02']]);
  });
  test('a bare value that is both a segment and another list warns and prefers the segment; L: forces the list', () => {
    const bare = buildTipoClientePlan([row('C1', '02')], ctx);
    expect(bare.moves[0].coPrecio).toBe('03');
    expect(bare.warnings[0]).toContain('L:02');
  });
  test('problems: unknown customer or target, special segment, ambiguous list, empty list', () => {
    const p = buildTipoClientePlan([row('NOPE', '09'), row('C1', 'ZZ'), row('C1', '000006'), row('C1', '04'), row('C1', '10')], ctx);
    const text = p.problems.join('\n');
    expect(text).toContain('cliente no encontrado');
    expect(text).toContain('no es un segmento ni una lista');
    expect(text).toContain('promoción o precio especial');
    expect(text).toContain('varios segmentos');
    expect(text).toContain('no tiene precios');
  });
  test('warns when the customer invoiced in another currency than the list', () => {
    expect(buildTipoClientePlan([row('C1', '09', 'BSD')], ctx).warnings[0]).toContain('facturó en BSD');
  });
});
