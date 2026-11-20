import { describe, expect, test } from 'bun:test';
import { activeFilterCount, applyClientesParams, dimToApi, parseClientesParams, referenceYearOf, type ClientesParams } from '../clientes-params';

const DEFAULTS: ClientesParams = {
  dim: 'entidad', grupo: null, ruta: null, tienda: null, origen: 'todos', ver: 'total', nivel: 'linea', detalle: false,
};

describe('parseClientesParams', () => {
  test('parses defaults for empty params', () => {
    expect(parseClientesParams(new URLSearchParams())).toEqual(DEFAULTS);
  });
  test('reads every key', () => {
    const p = parseClientesParams(new URLSearchParams('dim=tienda&grupo=S1&ruta=3&tienda=e:12&origen=nuevo&ver=producto&nivel=sku&detalle=1'));
    expect(p).toEqual({
      dim: 'tienda', grupo: 'S1', ruta: '3', tienda: 'e:12', origen: 'nuevo', ver: 'producto', nivel: 'sku', detalle: true,
    });
  });
  test('ignores malformed values (dim=x, ver=x, nivel=x, origen=x)', () => {
    expect(parseClientesParams(new URLSearchParams('dim=x&ver=x&nivel=x&origen=x&ruta=abc&grupo=%20'))).toEqual(DEFAULTS);
  });
});

describe('applyClientesParams', () => {
  test('omits defaults when applying', () => {
    const out = applyClientesParams(new URLSearchParams('dim=tienda&grupo=S1'), { dim: 'entidad', grupo: null });
    expect(out.toString()).toBe('');
  });
  test('keeps unrelated params (dateRange, tab)', () => {
    const out = applyClientesParams(new URLSearchParams('tab=clientes&dateRange=12m'), { grupo: 'S1', detalle: true });
    expect(out.get('tab')).toBe('clientes');
    expect(out.get('dateRange')).toBe('12m');
    expect(out.get('grupo')).toBe('S1');
    expect(out.get('detalle')).toBe('1');
  });
  test('round-trips a full patch', () => {
    const patch = { dim: 'tienda', grupo: 'S2', ruta: '7', tienda: 't:ABC', origen: 'patrimonio', ver: 'grupo', nivel: 'sublinea', detalle: true } as const;
    expect(parseClientesParams(applyClientesParams(new URLSearchParams(), patch))).toEqual(patch);
  });
});

describe('activeFilterCount', () => {
  test('counts grupo, ruta, tienda and origen', () => {
    const p = parseClientesParams(new URLSearchParams('grupo=S1&ruta=3&origen=nuevo&tienda=e:1'));
    expect(activeFilterCount(p)).toBe(4);
  });
  test('is zero at defaults and ignores dim, ver, nivel, detalle', () => {
    const p = parseClientesParams(new URLSearchParams('dim=tienda&ver=producto&nivel=sku&detalle=1'));
    expect(activeFilterCount(p)).toBe(0);
  });
});

describe('dimToApi', () => {
  test('maps both values', () => {
    expect(dimToApi('entidad')).toBe('cliente_entidad');
    expect(dimToApi('tienda')).toBe('cliente_tienda');
  });
});

describe('referenceYearOf', () => {
  const today = new Date('2026-11-20T12:00:00Z');
  test('year the range ends in', () => {
    expect(referenceYearOf('custom:2025-12-01:2026-01-15', today)).toBe(2026);
    expect(referenceYearOf('month:2025-12', today)).toBe(2025);
    expect(referenceYearOf('ytd:2024', today)).toBe(2024);
  });
  test('rolling ranges end today', () => {
    expect(referenceYearOf('30d', today)).toBe(2026);
    expect(referenceYearOf('12m', today)).toBe(2026);
  });
});
