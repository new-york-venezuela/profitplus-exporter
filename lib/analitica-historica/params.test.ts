import { describe, test, expect } from 'bun:test';
import { parseHistParams } from './params';
import { resolveHistRange, histPresetRange } from './window';

const req = (qs: string) => new Request(`http://localhost/api/dwh/analitica-historica/x?${qs}`);

describe('parseHistParams', () => {
  test('defaults: 12m window and devolución basis', () => {
    const p = parseHistParams(req(''));
    expect(p.range).toEqual(resolveHistRange(histPresetRange('12m')));
    expect(p.basis).toBe('devolucion');
    expect(p.dateRange).toBe(histPresetRange('12m'));
  });

  test('reads dateRange and returnsBasis', () => {
    const p = parseHistParams(req('dateRange=month:2024-02&returnsBasis=factura'));
    expect(p.range).toEqual({ startKey: 20240201, endKey: 20240229, empty: false });
    expect(p.basis).toBe('factura');
    expect(p.dateRange).toBe('month:2024-02');
  });

  test('an unknown basis falls back to devolución', () => {
    expect(parseHistParams(req('returnsBasis=nope')).basis).toBe('devolucion');
  });

  test('clienteDimension defaults to the casa matriz roll-up and accepts tienda', () => {
    expect(parseHistParams(req('')).dimension).toBe('entidad');
    expect(parseHistParams(req('clienteDimension=tienda')).dimension).toBe('tienda');
    expect(parseHistParams(req('clienteDimension=nope')).dimension).toBe('entidad');
  });

  test('exposes the raw search params', () => {
    expect(parseHistParams(req('groupBy=cliente')).searchParams.get('groupBy')).toBe('cliente');
  });
});
