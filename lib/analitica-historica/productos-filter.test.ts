import { describe, test, expect } from 'bun:test';
import { parseHistProductosFilters } from './productos-filter';

const p = (qs: string) => parseHistProductosFilters(new URLSearchParams(qs));

describe('parseHistProductosFilters', () => {
  test('defaults: línea level, ventas metric, no filters', () => {
    expect(p('')).toEqual({
      nivel: 'linea', metric: 'ventas', categoria: null, currency: 'bs',
      filter: { lineas: [], sublineas: [], grupo: null, ruta: null, q: null },
    });
  });

  test('reads nivel, metric, currency, categoria, lists and q', () => {
    const f = p('nivel=sku&metric=unidades&currency=usd&categoria=Fresco&lineas=A,B&sublineas=X&q=pan');
    expect(f.nivel).toBe('sku');
    expect(f.metric).toBe('unidades');
    expect(f.currency).toBe('usd');
    expect(f.categoria).toBe('Fresco');
    expect(f.filter).toEqual({ lineas: ['A', 'B'], sublineas: ['X'], grupo: null, ruta: null, q: 'pan' });
  });

  test('an unknown nivel or metric falls back to the defaults', () => {
    expect(p('nivel=nope&metric=nope').nivel).toBe('linea');
    expect(p('nivel=nope&metric=nope').metric).toBe('ventas');
  });

  test('the customer-group filter never applies to legacy data (grupo is always null)', () => {
    expect(p('grupo=S1').filter.grupo).toBeNull();
  });

  test('an over-long categoria is ignored', () => {
    expect(p(`categoria=${'x'.repeat(61)}`).categoria).toBeNull();
  });
});
