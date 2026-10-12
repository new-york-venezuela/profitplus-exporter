import { describe, test, expect } from 'bun:test';
import { customerScope, parseCarteraScope, parseGrupo, parseRuta } from '../../../lib/clientes/scope';

const sp = (q: string) => new URLSearchParams(q);

describe('parseCarteraScope', () => {
  test('valid group code and route number', () => {
    expect(parseCarteraScope(sp('grupo=S1&ruta=3'))).toEqual({ grupo: 'S1', ruta: 3 });
  });
  test('missing or malformed values are ignored, never an error or an injection vector', () => {
    expect(parseCarteraScope(sp(''))).toEqual({ grupo: null, ruta: null });
    expect(parseCarteraScope(sp("grupo=S1' OR '1'='1&ruta=3;DROP"))).toEqual({ grupo: null, ruta: null });
    expect(parseCarteraScope(sp('grupo=TOOLONGCODE&ruta=12345'))).toEqual({ grupo: null, ruta: null });
    expect(parseCarteraScope(sp('ruta=0'))).toEqual({ grupo: null, ruta: 0 });
  });
});

describe('parseGrupo / parseRuta (shared by /api/dwh/clientes and /api/dwh/clientes/cobertura)', () => {
  test('group: trimmed; letters, digits, _ and - up to 6 chars; anything else is no filter (null)', () => {
    expect(parseGrupo(' S1 ')).toBe('S1');
    expect(parseGrupo('AB_-9z')).toBe('AB_-9z');
    expect(parseGrupo('')).toBeNull();
    expect(parseGrupo(null)).toBeNull();
    expect(parseGrupo('TOOLONG')).toBeNull();
    expect(parseGrupo("S1'--")).toBeNull();
    expect(parseGrupo('S 1')).toBeNull();
  });
  test('route: 1-3 digits, else null', () => {
    expect(parseRuta('3')).toBe(3);
    expect(parseRuta(' 3 ')).toBe(3);
    expect(parseRuta('1234')).toBeNull();
    expect(parseRuta(null)).toBeNull();
  });
  test('parseCarteraScope trims a padded group', () => {
    expect(parseCarteraScope(sp('grupo=%20S1%20'))).toEqual({ grupo: 'S1', ruta: null });
  });
});

describe('customerScope', () => {
  test('no scope adds no SQL and binds nothing', () => {
    const s = customerScope({ grupo: null, ruta: null });
    const bound: string[] = [];
    s.bind({ input: n => bound.push(n) });
    expect(s.where).toBe('');
    expect(bound).toEqual([]);
  });
  test('group only filters the CURRENT row by ErpSegmentCode', () => {
    const s = customerScope({ grupo: 'S1', ruta: null }, 'c');
    expect(s.where).toContain('c.CustomerCode IN (SELECT cur_s.CustomerCode');
    expect(s.where).toContain('cur_s.IsCurrent = 1');
    expect(s.where).toContain('RTRIM(cur_s.ErpSegmentCode) = @scopeGrupo');
    expect(s.where).not.toContain('@scopeRuta');
  });
  test('both filters bind both parameters with the parsed values', () => {
    const s = customerScope({ grupo: 'S1', ruta: 3 });
    const bound: Record<string, unknown> = {};
    s.bind({ input: (n, v) => { bound[n] = v; } });
    expect(bound).toEqual({ scopeGrupo: 'S1', scopeRuta: 3 });
    expect(s.where).toContain('z_s.RouteNumber = @scopeRuta');
  });
  test('the alias is validated because it is interpolated', () => {
    expect(() => customerScope({ grupo: 'S1', ruta: null }, 'c; DROP TABLE x')).toThrow(/Alias/);
  });
});
