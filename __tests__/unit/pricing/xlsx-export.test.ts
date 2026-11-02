import { describe, test, expect } from 'bun:test';
import { buildExportWorkbook, selectPromotions, type ExportData } from '@/lib/pricing/xlsx/export';
import { SHEET, readWorkbookRows } from '@/lib/pricing/xlsx/workbook';

const TODAY = '2026-11-02';

const data: ExportData = {
  lists: [
    { coPrecio: '01', desPrecio: 'Mayorista', coMone: 'USD' },
    { coPrecio: '02', desPrecio: 'Detal', coMone: null },
  ],
  articles: [
    { coArt: 'A1', artDes: 'Pan', line: 'Panaderia', category: 'Fresco' },
    { coArt: 'A2', artDes: 'Pizza', line: 'Pizza', category: 'Congelado' },
  ],
  currentPrice: new Map([['01|A1', 2.5], ['02|A1', 3], ['01|A2', 0.0001]]),
  promotions: [
    { name: 'Activa', coPrecio: '01', startsOn: '2026-10-30', endsOn: '2026-11-05', reason: 'Lanzamiento', status: 'activa', items: [{ coArt: 'A1', monto: 2 }, { coArt: 'A2', monto: 1.5 }] },
    { name: 'Futura', coPrecio: '02', startsOn: '2026-12-01', endsOn: '2026-12-10', reason: null, status: 'programada', items: [{ coArt: 'A1', monto: 2.75 }] },
  ],
  customers: [
    { coCli: 'C1', nombre: 'Cliente Uno', tipCli: 'T1', desTipo: 'Tipo 1', listaActual: '01', lista90d: '01', moneda90d: 'USD' },
    { coCli: 'C2', nombre: 'Cliente Dos', tipCli: 'T2', desTipo: 'Tipo 2', listaActual: '02', lista90d: '' },
  ],
};

const read = (sheet: string) => {
  const r = readWorkbookRows(buildExportWorkbook(data, TODAY), sheet);
  if (!r) throw new Error(`missing sheet ${sheet}`);
  return r;
};

describe('buildExportWorkbook', () => {
  test('Listas: existing lists prefilled, no blank rows', () => {
    const { header, rows } = read(SHEET.listas);
    expect(header).toEqual(['lista', 'nombre', 'moneda', 'desde', 'nueva']);
    expect(rows).toEqual([
      ['01', 'Mayorista', 'USD', TODAY, ''],
      ['02', 'Detal', '', TODAY, ''],
    ]);
  });

  test('Precios: one row per article, existing price per list, empty where none', () => {
    const { header, rows } = read(SHEET.precios);
    expect(header).toEqual(['co_art', 'nombre', 'linea', 'categoria', 'actual 01', 'actual 02']);
    expect(rows).toEqual([
      ['A1', 'Pan', 'Panaderia', 'Fresco', '2.5', '3'],
      ['A2', 'Pizza', 'Pizza', 'Congelado', '0.0001', ''],
    ]);
  });

  test('Promociones: active and scheduled, one row per item, estado filled', () => {
    const { header, rows } = read(SHEET.promociones);
    expect(header).toEqual(['promocion', 'lista', 'desde', 'hasta', 'motivo', 'co_art', 'precio', 'estado']);
    expect(rows).toEqual([
      ['Activa', '01', '2026-10-30', '2026-11-05', 'Lanzamiento', 'A1', '2', 'activa'],
      ['Activa', '01', '2026-10-30', '2026-11-05', 'Lanzamiento', 'A2', '1.5', 'activa'],
      ['Futura', '02', '2026-12-01', '2026-12-10', '', 'A1', '2.75', 'programada'],
    ]);
  });

  test('Descuentos por cliente: header only', () => {
    const { header, rows } = read(SHEET.descuentos);
    expect(header).toEqual(['co_cli', 'co_art', 'precio', 'desde', 'hasta']);
    expect(rows).toEqual([]);
  });

  test('Clientes: header and rows with blank tip_cli_nuevo', () => {
    const { header, rows } = read(SHEET.clientes);
    expect(header).toEqual(['co_cli', 'nombre', 'tip_cli_actual', 'des_tipo_actual', 'lista_actual', 'lista_usada_90d', 'moneda_90d', 'tip_cli_nuevo']);
    expect(rows).toEqual([
      ['C1', 'Cliente Uno', 'T1', 'Tipo 1', '01', '01', 'USD', ''],
      ['C2', 'Cliente Dos', 'T2', 'Tipo 2', '02', '', '', ''],
    ]);
  });
});

describe('selectPromotions', () => {
  const base = { reason: null, baseCoPrecio: null, tipCli: null, createdBy: 'u', createdAt: 0, cancelledAt: null, coPrecio: '01' };
  const mk = (id: number, o: Record<string, unknown>) => ({ id, name: `P${id}`, kind: 'overlay', startsOn: '2026-10-01', endsOn: '2026-12-31', ...base, ...o }) as never;
  const items = () => [{ coArt: 'A1', promoMonto: 2 }];

  test('drops expired, cancelled and segment promotions; labels estado', () => {
    const out = selectPromotions([
      mk(1, { endsOn: '2026-11-01' }),             // expired
      mk(2, { cancelledAt: 123 }),                 // cancelled
      mk(3, { kind: 'segment' }),                  // not overlay
      mk(4, {}),                                   // covers today
      mk(5, { startsOn: '2026-11-03' }),           // future
      mk(6, { endsOn: '2026-11-02' }),             // ends today: still active
    ], items, TODAY);
    expect(out.map(p => [p.name, p.status])).toEqual([['P4', 'activa'], ['P5', 'programada'], ['P6', 'activa']]);
    expect(out[0].items).toEqual([{ coArt: 'A1', monto: 2 }]);
  });
});
