import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MIGRATION_CUTOVER_DATE, customerKindInYear, isMigrationBatch } from '../../../lib/dwh/cutover';

describe('migration cutover', () => {
  test('constant', () => expect(MIGRATION_CUTOVER_DATE).toBe('2026-03-28'));
  test('isMigrationBatch is exact-date', () => {
    expect(isMigrationBatch('2026-03-28')).toBe(true);
    expect(isMigrationBatch('2026-03-27')).toBe(false);
    expect(isMigrationBatch('2026-03-29')).toBe(false);
  });
  test('patrimonio in year Y = registered before Jan 1 of Y or in the cutover batch', () => {
    expect(customerKindInYear('2026-03-28', 2026)).toBe('patrimonio'); // batch
    expect(customerKindInYear('2025-11-02', 2026)).toBe('patrimonio');
    expect(customerKindInYear('2026-03-28', 2027)).toBe('patrimonio');
  });
  test('new in year Y = registered in Y and not in the batch', () => {
    expect(customerKindInYear('2026-04-01', 2026)).toBe('nuevo');
    expect(customerKindInYear('2026-01-15', 2026)).toBe('nuevo');   // before the cutover but not the batch
    expect(customerKindInYear('2026-04-01', 2027)).toBe('patrimonio');
  });
  test('registered after Y is neither', () => {
    expect(customerKindInYear('2027-02-01', 2026)).toBe('posterior');
  });
  test('rejects malformed dates', () => {
    expect(() => customerKindInYear('28/03/2026', 2026)).toThrow(/YYYY-MM-DD/);
  });
});

describe('SQL copy of the cutover date (migrations/dwh/0040)', () => {
  test('every @CutoverDate literal in 0040 equals MIGRATION_CUTOVER_DATE', () => {
    const sql = readFileSync(join(import.meta.dir, '..', '..', '..', 'migrations', 'dwh', '0040_route_frequency_registration.sql'), 'utf8');
    const literals = [...sql.matchAll(/DECLARE @CutoverDate date = '([^']*)'/g)].map(m => m[1]);
    expect(literals.length).toBeGreaterThan(0);
    for (const l of literals) expect(l).toBe(MIGRATION_CUTOVER_DATE);
  });
});
