import { describe, expect, test } from 'bun:test';
import { productosScopeQuery } from '../product-url';

describe('productosScopeQuery', () => {
  test('carries tienda, grupo and ruta to the Productos API', () => {
    const q = productosScopeQuery({ tienda: 'e:12', grupo: 'S1', ruta: '3' }, 'month:2026-10', { section: 'catalogo', nivel: 'sku', currency: 'usd' });
    expect(Object.fromEntries(q)).toEqual({ dateRange: 'month:2026-10', section: 'catalogo', nivel: 'sku', currency: 'usd', tienda: 'e:12', grupo: 'S1', ruta: '3' });
  });
  test('omits everything that is not set', () => {
    const q = productosScopeQuery({ tienda: null, grupo: null, ruta: null }, '12m', { section: 'catalogo', nivel: 'sku' });
    expect(Object.fromEntries(q)).toEqual({ dateRange: '12m', section: 'catalogo', nivel: 'sku' });
  });
});
