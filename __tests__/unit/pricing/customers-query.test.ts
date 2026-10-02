import { describe, test, expect } from 'bun:test';
import { parseCustomerFilters, buildCustomerQuery, escapeLike } from '@/lib/pricing/customers-query';

describe('parseCustomerFilters', () => {
  test('defaults', () => {
    expect(parseCustomerFilters(new URLSearchParams())).toEqual({
      search: '', tipCli: '', zona: '', vendedor: '', sort: 'cliDes', dir: 'asc', page: 1, pageSize: 50,
    });
  });
  test('clamps and falls back on garbage', () => {
    const f = parseCustomerFilters(new URLSearchParams('page=0&pageSize=9999&sort=DROP TABLE&dir=sideways'));
    expect(f).toMatchObject({ page: 1, pageSize: 200, sort: 'cliDes', dir: 'asc' });
  });
  test('caps page at 100000', () => {
    expect(parseCustomerFilters(new URLSearchParams('page=99999999')).page).toBe(100000);
  });
  test('accepts allowlisted sort + dir', () => {
    expect(parseCustomerFilters(new URLSearchParams('sort=ultimoPedido&dir=desc'))).toMatchObject({ sort: 'ultimoPedido', dir: 'desc' });
  });
});

describe('buildCustomerQuery', () => {
  test('no filters → empty where, name order, offset 0', () => {
    const q = buildCustomerQuery(parseCustomerFilters(new URLSearchParams()));
    expect(q.where).toBe('');
    expect(q.orderBy).toBe('ORDER BY c.cli_des ASC, c.co_cli ASC');
    expect(q.offset).toBe(0);
    expect(q.inputs).toEqual([]);
  });
  test('filters are parameterised, never interpolated', () => {
    const q = buildCustomerQuery(parseCustomerFilters(new URLSearchParams("search=o'brien&tipCli=000003&zona=CCS&vendedor=V1&page=3&pageSize=20")));
    expect(q.where).toContain('@search');
    expect(q.where).toContain('@tipCli');
    expect(q.where).not.toContain("o'brien");
    expect(q.inputs.map(i => i.name).sort()).toEqual(['search', 'tipCli', 'vendedor', 'zona']);
    expect(q.offset).toBe(40);
  });
  test('every sort variant ends with the co_cli tie-breaker', () => {
    for (const sort of ['cliDes', 'coZon', 'coVen', 'ultimoPedido']) {
      const q = buildCustomerQuery(parseCustomerFilters(new URLSearchParams(`sort=${sort}`)));
      expect(q.orderBy.endsWith(', c.co_cli ASC')).toBe(true);
    }
  });
  test('search escapes LIKE wildcards and uses ESCAPE on all predicates', () => {
    const q = buildCustomerQuery(parseCustomerFilters(new URLSearchParams('search=50%_[a]\\x')));
    expect(q.inputs[0].value).toBe('%50\\%\\_\\[a]\\\\x%');
    expect(q.where.match(/ESCAPE '\\'/g)?.length).toBe(3);
    expect(escapeLike('a%b')).toBe('a\\%b');
  });
  test('ultimoPedido sorts nulls last in both directions', () => {
    const q = buildCustomerQuery(parseCustomerFilters(new URLSearchParams('sort=ultimoPedido&dir=desc')));
    expect(q.orderBy).toBe('ORDER BY CASE WHEN ult.ultimoPedido IS NULL THEN 1 ELSE 0 END, ult.ultimoPedido DESC, c.cli_des ASC, c.co_cli ASC');
  });
});
