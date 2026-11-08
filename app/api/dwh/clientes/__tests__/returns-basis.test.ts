import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReturnsDateWhereClause } from '../../lib/query-builder';

const src = readFileSync(join(import.meta.dir, '..', 'route.ts'), 'utf8')
  .split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

describe('dwh/clientes always windows returns by devolución date', () => {
  test('never reads a returnsBasis param', () => {
    expect(src).not.toMatch(/returnsBasis/);
  });

  test('buildReturnsDateWhereClause is called without a factura basis', () => {
    const calls = src.match(/buildReturnsDateWhereClause\([^)]*\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c).not.toMatch(/factura/);
  });

  test('default window is on DateKey, not OriginalInvoiceDateKey', () => {
    const where = buildReturnsDateWhereClause('12m', 'fr');
    expect(where).toContain('fr.DateKey');
    expect(where).not.toContain('OriginalInvoiceDateKey');
  });
});
