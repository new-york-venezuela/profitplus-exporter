import { describe, expect, test } from 'bun:test';
import { bindItemFilter, itemFilterSql, parseItemFilter, returnsItemFilterSql, type ItemFilter } from '../item-filter';

const empty: ItemFilter = { lineas: [], sublineas: [], grupo: null, ruta: null, q: null };
const rec = () => {
  const calls: [string, unknown][] = [];
  return { calls, input: (n: string, v: unknown) => { calls.push([n, v]); } };
};
const p = (s: string) => parseItemFilter(new URLSearchParams(s));

describe('parseItemFilter', () => {
  test('empty', () => expect(p('')).toEqual(empty));
  test('lists trimmed, empties dropped', () => {
    expect(p('lineas=A, B ,,C&sublineas= X ,').lineas).toEqual(['A', 'B', 'C']);
    expect(p('sublineas= X ,').sublineas).toEqual(['X']);
  });
  test('max 50 entries per list', () => {
    const many = Array.from({ length: 80 }, (_, i) => `L${i}`).join(',');
    expect(p(`lineas=${many}`).lineas).toHaveLength(50);
  });
  test('grupo trimmed, blank -> null', () => {
    expect(p('grupo= 07 ').grupo).toBe('07');
    expect(p('grupo=%20').grupo).toBeNull();
  });
  test('ruta parses 1-3 digits; malformed or blank -> null', () => {
    expect(p('ruta=%203%20').ruta).toBe(3);
    expect(p('ruta=abc').ruta).toBeNull();
    expect(p("ruta=3'%20OR%20'1'='1").ruta).toBeNull();
    expect(p('ruta=1234').ruta).toBeNull();
    expect(p('').ruta).toBeNull();
  });
  test('q trimmed, capped at 80, blank -> null', () => {
    expect(p('q=%20abc%20').q).toBe('abc');
    expect(p('q=' + 'x'.repeat(200)).q).toHaveLength(80);
    expect(p('q=%20%20').q).toBeNull();
  });
});

describe('itemFilterSql', () => {
  test('empty filter -> empty string', () => expect(itemFilterSql(empty)).toBe(''));
  test('each predicate only when set', () => {
    const l = itemFilterSql({ ...empty, lineas: ['A', 'B'] });
    expect(l).toContain("ISNULL(p.LineName, 'Sin línea') IN (@linea0, @linea1)");
    expect(l).not.toContain('SubLineName');
    expect(l).not.toContain('@grupo');
    expect(l).not.toContain('@q');
    const s = itemFilterSql({ ...empty, sublineas: ['A'] });
    expect(s).toContain("ISNULL(p.SubLineName, 'Sin sublínea') IN (@sublinea0)");
    const g = itemFilterSql({ ...empty, grupo: '07' });
    expect(g).toContain('fs.CustomerKey IN (SELECT tk.CustomerKey FROM dim.Dim_Customer tk JOIN dim.Dim_Customer cur ON cur.CustomerCode = tk.CustomerCode AND cur.IsCurrent = 1 WHERE RTRIM(cur.ErpSegmentCode) = @grupo)');
    const r = itemFilterSql({ ...empty, ruta: 3 });
    expect(r).toContain('fs.CustomerKey IN (SELECT tk.CustomerKey FROM dim.Dim_Customer tk JOIN dim.Dim_Customer cur ON cur.CustomerCode = tk.CustomerCode AND cur.IsCurrent = 1 JOIN dim.Dim_Zone z ON z.ZoneCode = cur.ZoneCode WHERE z.RouteNumber = @ruta)');
    expect(r).not.toContain('@grupo');
    const q = itemFilterSql({ ...empty, q: 'x' });
    expect(q).toContain("(p.ProductCode LIKE @q ESCAPE '\\' OR p.ProductName LIKE @q ESCAPE '\\')");
  });
  test('AND-prefixed, never raw values', () => {
    const sql = itemFilterSql({ lineas: ['Pan'], sublineas: ['Dulce'], grupo: 'GRP9', ruta: 7, q: "'; DROP TABLE x;--" });
    expect(sql.trimStart().startsWith('AND ')).toBe(true);
    for (const raw of ['Pan', 'Dulce', 'GRP9', 'DROP']) expect(sql).not.toContain(raw);
  });
  test('custom aliases', () => {
    const sql = itemFilterSql({ ...empty, lineas: ['A'], grupo: 'g' }, { product: 'pp', fact: 'ff' });
    expect(sql).toContain('pp.LineName');
    expect(sql).toContain('ff.CustomerKey');
  });
});

describe('returnsItemFilterSql', () => {
  test('uses pr / fr', () => {
    const sql = returnsItemFilterSql({ ...empty, lineas: ['A'], grupo: 'g', q: 'x' });
    expect(sql).toContain('pr.LineName');
    expect(sql).toContain('fr.CustomerKey');
    expect(sql).toContain('pr.ProductCode LIKE @q');
    expect(sql).not.toContain('fs.');
  });
});

describe('bindItemFilter', () => {
  test('nothing for empty', () => {
    const r = rec();
    bindItemFilter(r, empty);
    expect(r.calls).toEqual([]);
  });
  test('names and values', () => {
    const r = rec();
    bindItemFilter(r, { lineas: ['A', 'B'], sublineas: ['S'], grupo: '07', ruta: null, q: 'pan' });
    expect(r.calls).toEqual([
      ['linea0', 'A'], ['linea1', 'B'], ['sublinea0', 'S'], ['grupo', '07'], ['q', '%pan%'],
    ]);
  });
  test('wildcards escaped', () => {
    const r = rec();
    bindItemFilter(r, { ...empty, q: '50%_[x]\\' });
    expect(r.calls).toEqual([['q', '%50\\%\\_\\[x]\\\\%']]);
  });
  test('injection-shaped q only as bound value', () => {
    const r = rec();
    const f = { ...empty, q: "'; DROP TABLE x;--" };
    bindItemFilter(r, f);
    expect(r.calls).toEqual([['q', "%'; DROP TABLE x;--%"]]);
    expect(itemFilterSql(f)).not.toContain('DROP');
  });

describe('bindItemFilter ruta', () => {
  test('binds @ruta only when set, as a number', () => {
    const a = rec();
    bindItemFilter(a, { ...empty, ruta: 3 });
    expect(a.calls).toEqual([['ruta', 3]]);
    const b = rec();
    bindItemFilter(b, empty);
    expect(b.calls).toEqual([]);
  });
});
});

