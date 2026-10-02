import { describe, test, expect } from 'bun:test';
import { parseCustomerFilters, buildCustomerQuery } from '@/lib/pricing/customers-query';

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
  test('accepts allowlisted sort + dir', () => {
    expect(parseCustomerFilters(new URLSearchParams('sort=ultimoPedido&dir=desc'))).toMatchObject({ sort: 'ultimoPedido', dir: 'desc' });
  });
});

describe('buildCustomerQuery', () => {
  test('no filters → empty where, name order, offset 0', () => {
    const q = buildCustomerQuery(parseCustomerFilters(new URLSearchParams()));
    expect(q.where).toBe('');
    expect(q.orderBy).toBe('ORDER BY c.cli_des ASC');
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
  test('ultimoPedido sorts nulls last in both directions', () => {
    const q = buildCustomerQuery(parseCustomerFilters(new URLSearchParams('sort=ultimoPedido&dir=desc')));
    expect(q.orderBy).toBe('ORDER BY CASE WHEN ult.ultimoPedido IS NULL THEN 1 ELSE 0 END, ult.ultimoPedido DESC, c.cli_des ASC');
  });
});
