import { describe, expect, test } from 'bun:test';
import { parseClientesParams } from '@/app/(app)/analitica/lib/clientes-params';
import { productosScopeQuery } from '../product-url';

const params = (qs: string) => parseClientesParams(new URLSearchParams(qs));

describe('productosScopeQuery', () => {
  test('carries tienda, grupo, ruta, nivel and the product drill to the Productos API', () => {
    const q = productosScopeQuery(params('tienda=e:12&grupo=S1&ruta=3&nivel=sublinea&lineas=Pan,Torta&sublineas=Dulce&q=harina'), 'month:2026-10', { section: 'catalogo', currency: 'usd' });
    expect(Object.fromEntries(q)).toEqual({
      dateRange: 'month:2026-10', section: 'catalogo', currency: 'usd', nivel: 'sublinea',
      tienda: 'e:12', grupo: 'S1', ruta: '3', lineas: 'Pan,Torta', sublineas: 'Dulce', q: 'harina',
    });
  });
  test('omits everything that is not set', () => {
    const q = productosScopeQuery(params(''), '12m', { section: 'porLineaMes', granularity: 'week' });
    expect(Object.fromEntries(q)).toEqual({ dateRange: '12m', section: 'porLineaMes', granularity: 'week', nivel: 'linea' });
  });
  test('the entidad/tienda switch (dim) never leaks into the Productos request', () => {
    expect(productosScopeQuery(params('dim=tienda'), '12m', { section: 'catalogo' }).has('dim')).toBe(false);
  });
});
