import { describe, test, expect } from 'bun:test';
import { customerScope, parseCarteraScope, parseGrupo, parseOrigenScope, parseRuta } from '../../../lib/clientes/scope';

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

describe('parseOrigenScope', () => {
  const today = new Date('2026-11-20T12:00:00Z');
  test('patrimonio / nuevo with the year the range ends in', () => {
    expect(parseOrigenScope(sp('origen=nuevo&dateRange=month:2026-10'), today)).toEqual({ origen: 'nuevo', year: 2026 });
    expect(parseOrigenScope(sp('origen=patrimonio&dateRange=custom:2025-01-01:2025-06-30'), today)).toEqual({ origen: 'patrimonio', year: 2025 });
  });
  test('rolling ranges end today', () => {
    expect(parseOrigenScope(sp('origen=nuevo&dateRange=12m'), today)).toEqual({ origen: 'nuevo', year: 2026 });
  });
  test('todos, missing or malformed origen is no scope (null), never an error or an injection vector', () => {
    expect(parseOrigenScope(sp('origen=todos'), today)).toBeNull();
    expect(parseOrigenScope(sp(''), today)).toBeNull();
    expect(parseOrigenScope(sp("origen=nuevo' OR '1'='1"), today)).toBeNull();
  });
});

describe('customerScope origen', () => {
  const bind = (s: ReturnType<typeof customerScope>) => {
    const bound: Record<string, unknown> = {};
    s.bind({ input: (n, v) => { bound[n] = v; } });
    return bound;
  };
  test('patrimonio = migration batch or registered before Jan 1 of the year, on the CURRENT row', () => {
    const s = customerScope({ grupo: null, ruta: null }, 'c', { origen: 'patrimonio', year: 2026 });
    expect(s.where).toContain('cur_s.IsCurrent = 1');
    expect(s.where).toContain('(cur_s.IsMigrationBatch = 1 OR cur_s.RegisteredDate < @scopeOrigenFrom)');
    expect(bind(s)).toEqual({ scopeOrigenFrom: '2026-01-01' });
  });
  test('nuevo = registered during the year, outside the migration batch', () => {
    const s = customerScope({ grupo: null, ruta: null }, 'c', { origen: 'nuevo', year: 2026 });
    expect(s.where).toContain('cur_s.IsMigrationBatch = 0 AND cur_s.RegisteredDate >= @scopeOrigenFrom AND cur_s.RegisteredDate < @scopeOrigenTo');
    expect(bind(s)).toEqual({ scopeOrigenFrom: '2026-01-01', scopeOrigenTo: '2027-01-01' });
  });
  test('combines with grupo and ruta in one subquery', () => {
    const s = customerScope({ grupo: 'S1', ruta: 3 }, 'c', { origen: 'nuevo', year: 2026 });
    expect(s.where.match(/SELECT cur_s\.CustomerCode/g)).toHaveLength(1);
    expect(bind(s)).toMatchObject({ scopeGrupo: 'S1', scopeRuta: 3, scopeOrigenFrom: '2026-01-01' });
  });
  test('no origen leaves the SQL and binds exactly as before', () => {
    expect(customerScope({ grupo: null, ruta: null }, 'c', null).where).toBe('');
    expect(bind(customerScope({ grupo: 'S1', ruta: null }, 'c', null))).toEqual({ scopeGrupo: 'S1' });
  });
});

