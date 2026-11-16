import { describe, expect, test } from 'bun:test';
import { bindTienda, isSingleStore, parseTienda, tiendaKeysSql } from '../tienda-filter';

describe('parseTienda', () => {
  test('entidad', () => expect(parseTienda('e:12')).toEqual({ kind: 'entidad', key: 12 }));
  test('tienda prefixed and bare', () => {
    expect(parseTienda('t:J123')).toEqual({ kind: 'tienda', code: 'J123' });
    expect(parseTienda('J123')).toEqual({ kind: 'tienda', code: 'J123' });
  });
  test('invalid -> null', () => {
    for (const v of ['e:abc', 'e:', 't:', '', '  ', null]) expect(parseTienda(v)).toBeNull();
  });
});

describe('tiendaKeysSql', () => {
  test('entidad resolves via current rows then all versions', () => {
    const sql = tiendaKeysSql({ kind: 'entidad', key: 1 });
    expect(sql).toContain('cur.IsCurrent = 1');
    expect(sql).toContain('cur.LegalEntityKey = @entidadKey');
    expect(sql).toContain('CustomerCode IN');
  });
  test('tienda', () => {
    expect(tiendaKeysSql({ kind: 'tienda', code: 'J1' })).toContain('tk.CustomerCode = @tiendaCode');
  });
});

describe('bindTienda', () => {
  const rec = () => {
    const calls: [string, unknown][] = [];
    return { calls, input: (n: string, v: unknown) => { calls.push([n, v]); } };
  };
  test('entidad', () => {
    const r = rec();
    bindTienda(r, { kind: 'entidad', key: 5 });
    expect(r.calls).toEqual([['entidadKey', 5]]);
  });
  test('tienda', () => {
    const r = rec();
    bindTienda(r, { kind: 'tienda', code: 'J1' });
    expect(r.calls).toEqual([['tiendaCode', 'J1']]);
  });
  test('null', () => {
    const r = rec();
    bindTienda(r, null);
    expect(r.calls).toEqual([]);
  });
});

describe('isSingleStore', () => {
  test('only tienda', () => {
    expect(isSingleStore({ kind: 'tienda', code: 'J1' })).toBe(true);
    expect(isSingleStore({ kind: 'entidad', key: 1 })).toBe(false);
    expect(isSingleStore(null)).toBe(false);
  });
});
