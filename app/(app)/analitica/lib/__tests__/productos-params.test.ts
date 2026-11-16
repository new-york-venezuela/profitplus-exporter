import { describe, expect, test } from 'bun:test';
import { applyProductosParams, parseProductosParams, trendClickPatch } from '../productos-params';

describe('parseProductosParams', () => {
  test('defaults', () => {
    expect(parseProductosParams(new URLSearchParams())).toEqual({
      nivel: 'linea', metric: 'ventas', tienda: null, categoria: null,
      lineas: [], sublineas: [], grupo: null, q: '', matriz: true,
    });
  });
  test('garbled values fall back to defaults', () => {
    const p = parseProductosParams(new URLSearchParams('nivel=zzz&metric=foo'));
    expect(p.nivel).toBe('linea');
    expect(p.metric).toBe('ventas');
  });
  test('reads lists and scalars', () => {
    const p = parseProductosParams(new URLSearchParams('nivel=sku&metric=unidades&lineas=a,b&sublineas=c&grupo=G&q=pan&tienda=T&categoria=Fresco'));
    expect(p).toEqual({
      nivel: 'sku', metric: 'unidades', tienda: 'T', categoria: 'Fresco',
      lineas: ['a', 'b'], sublineas: ['c'], grupo: 'G', q: 'pan', matriz: true,
    });
  });
});

describe('applyProductosParams', () => {
  test('preserves other params and round-trips', () => {
    const sp = new URLSearchParams('tab=productos&dateRange=30d&currency=usd');
    const out = applyProductosParams(sp, { nivel: 'sublinea', lineas: ['a', 'b'], q: 'x' });
    expect(out.get('tab')).toBe('productos');
    expect(out.get('dateRange')).toBe('30d');
    expect(out.get('currency')).toBe('usd');
    expect(out.get('lineas')).toBe('a,b');
    expect(parseProductosParams(out)).toMatchObject({ nivel: 'sublinea', lineas: ['a', 'b'], q: 'x' });
    expect(sp.has('nivel')).toBe(false);
  });
  test('omits defaults and empties', () => {
    const sp = new URLSearchParams('nivel=sku&metric=unidades&lineas=a&q=z&tienda=T&grupo=G&categoria=C');
    const out = applyProductosParams(sp, {
      nivel: 'linea', metric: 'ventas', lineas: [], q: '', tienda: null, grupo: null, categoria: null,
    });
    expect(out.toString()).toBe('');
  });
});

describe('matriz param', () => {
  test('matriz=0 parses to false, garbled to true', () => {
    expect(parseProductosParams(new URLSearchParams('matriz=0')).matriz).toBe(false);
    expect(parseProductosParams(new URLSearchParams('matriz=zzz')).matriz).toBe(true);
    expect(parseProductosParams(new URLSearchParams('matriz=1')).matriz).toBe(true);
  });
  test('closed writes matriz=0, open omits it, other params preserved', () => {
    const closed = applyProductosParams(new URLSearchParams('tab=productos'), { matriz: false });
    expect(closed.get('matriz')).toBe('0');
    expect(closed.get('tab')).toBe('productos');
    const open = applyProductosParams(closed, { matriz: true });
    expect(open.has('matriz')).toBe(false);
    expect(applyProductosParams(closed, { q: 'x' }).get('matriz')).toBe('0');
  });
});

describe('trendClickPatch', () => {
  test('linea -> its sublineas', () => {
    expect(trendClickPatch('linea', undefined, 'Panaderia')).toEqual({ lineas: ['Panaderia'], sublineas: [], nivel: 'sublinea' });
  });
  test('sublinea -> its SKUs, using seriesMeta', () => {
    expect(trendClickPatch('sublinea', { linea: 'Panaderia', sublinea: 'Artesanal' }, 'Panaderia › Artesanal'))
      .toEqual({ lineas: ['Panaderia'], sublineas: ['Artesanal'], nivel: 'sku' });
  });
  test('sku -> searches by code', () => {
    expect(trendClickPatch('sku', { code: 'P1' }, 'Pan')).toEqual({ q: 'P1' });
  });
  test('Otras and unknown series are no-ops', () => {
    expect(trendClickPatch('linea', undefined, 'Otras')).toBeNull();
    expect(trendClickPatch('sublinea', undefined, 'X › Y')).toBeNull();
    expect(trendClickPatch('sku', {}, 'Pan')).toBeNull();
    expect(trendClickPatch('sku', { code: 'P1' }, 'Otras')).toBeNull();
  });
});
