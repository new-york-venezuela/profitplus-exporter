import { describe, expect, test } from 'bun:test';
import { estadoMatrix, salesBridge } from '../retention';
import type { EstadoRow } from '../estados';

const m = (bs: number, usd: number | null) => ({ bs, usd });
const row = (over: Partial<EstadoRow>): EstadoRow => ({
  customerCode: 'X', customerName: 'X', entityName: null, sellerName: null, routeNumber: null, groupName: null,
  origen: 'patrimonio', estado: 'retenido', lastSaleDateKey: null, reasonDateKey: null, salesPeriod: m(0, 0), salesPrev: m(0, 0), ...over,
});

const ROWS: EstadoRow[] = [
  row({ customerCode: 'R1', estado: 'retenido', origen: 'patrimonio', salesPeriod: m(200, 20), salesPrev: m(100, 10) }),
  row({ customerCode: 'R2', estado: 'retenido', origen: 'nuevo', salesPeriod: m(50, 5), salesPrev: m(60, 6) }),
  row({ customerCode: 'C1', estado: 'enfriado', origen: 'patrimonio', salesPeriod: m(0, 0), salesPrev: m(40, 4) }),
  row({ customerCode: 'L1', estado: 'perdido', origen: 'nuevo', salesPeriod: m(0, 0), salesPrev: m(30, 3) }),
  row({ customerCode: 'N1', estado: 'nuevo_periodo', origen: 'nuevo', salesPeriod: m(70, 7), salesPrev: m(0, 0) }),
  row({ customerCode: 'B1', estado: 'recuperado', origen: 'patrimonio', salesPeriod: m(90, 9), salesPrev: m(0, 0) }),
  row({ customerCode: 'Z1', estado: 'sin_ventas', origen: 'nuevo' }),
  row({ customerCode: 'P1', estado: 'retenido', origen: 'posterior', salesPeriod: m(10, 1), salesPrev: m(10, 1) }),
];

describe('estadoMatrix', () => {
  const matrix = estadoMatrix(ROWS, 'usd');
  const by = (e: string) => matrix.find(x => x.estado === e)!;
  test('lists the six estados in order', () => {
    expect(matrix.map(x => x.estado)).toEqual(['nuevo_periodo', 'retenido', 'recuperado', 'enfriado', 'perdido', 'sin_ventas']);
  });
  test('splits each count by origen and keeps the total', () => {
    expect(by('retenido')).toMatchObject({ patrimonio: 1, nuevo: 1, total: 3 });   // the posterior customer is only in the total
    expect(by('enfriado')).toMatchObject({ patrimonio: 1, nuevo: 0, total: 1 });
  });
  test('sums sales in the active currency', () => {
    expect(by('retenido')).toMatchObject({ sales: 26, salesPrev: 17 });
    expect(by('nuevo_periodo')).toMatchObject({ sales: 7, salesPrev: 0 });
  });
  test('a null USD makes the sum null, never a partial total', () => {
    const out = estadoMatrix([row({ estado: 'retenido', salesPeriod: m(5, null) })], 'usd');
    expect(out.find(x => x.estado === 'retenido')!.sales).toBeNull();
    expect(estadoMatrix([row({ estado: 'retenido', salesPeriod: m(5, null) })], 'bs').find(x => x.estado === 'retenido')!.sales).toBe(5);
  });
});

describe('salesBridge', () => {
  test('previous - lost + change in retained + nuevos + recuperados = actual', () => {
    const b = salesBridge(ROWS, 'usd');
    expect(b).toEqual({ previous: 24, lost: -7, retainedChange: 9, nuevos: 7, recuperados: 9, actual: 42 });
    expect(b.previous! + b.lost! + b.retainedChange! + b.nuevos! + b.recuperados!).toBe(b.actual!);
  });
  test('null when any figure is unknown or there is no previous period', () => {
    expect(salesBridge([row({ estado: 'retenido', salesPrev: null })], 'usd').previous).toBeNull();
    expect(salesBridge([row({ estado: 'retenido', salesPeriod: m(1, null) })], 'usd').actual).toBeNull();
  });
});
