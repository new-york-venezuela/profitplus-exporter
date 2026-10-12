import { describe, test, expect } from 'bun:test';
import { customerScope, parseCarteraScope } from '../../../lib/clientes/scope';

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
