import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VISIT_FREQUENCIES, VISIT_INTERVAL_DAYS } from '../../../lib/customer-mapping/frequency';
import { MIGRATION_CUTOVER_DATE } from '../../../lib/dwh/cutover';

const ROOT = join(import.meta.dir, '..', '..', '..');
const sqlOf = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('SQL copies of the TypeScript vocabulary', () => {
  test('0018 accepts exactly the TypeScript visit frequencies', () => {
    const sql = sqlOf('migrations/mssql/0018_pApi_routes.sql');
    const m = /NOT IN \(([^)]*)\)/.exec(sql);
    expect(m).not.toBeNull();
    const listed = [...m![1].matchAll(/'([A-Z]+)'/g)].map(x => x[1]);
    expect(listed).toEqual([...VISIT_FREQUENCIES]);
  });
  test('0018 route-zone pattern matches routeZoneCode()', () => {
    expect(sqlOf('migrations/mssql/0018_pApi_routes.sql')).toContain("'CCS[0-9][0-9][0-9]'");
  });
});

describe('migrations/dwh/0040 mirrors the TypeScript vocabulary', () => {
  const sql = sqlOf('migrations/dwh/0040_route_frequency_registration.sql');
  test('cutover date literal', () => {
    expect(sql).toContain(`DECLARE @CutoverDate date = '${MIGRATION_CUTOVER_DATE}'`);
  });
  test('frequency list and interval days', () => {
    for (const f of VISIT_FREQUENCIES) expect(sql).toContain(`'${f}'`);
    for (const [f, days] of Object.entries(VISIT_INTERVAL_DAYS)) expect(sql).toContain(`WHEN '${f}' THEN ${days}`);
  });
  test('every frequency IN-list in 0040 is exactly the TypeScript list', () => {
    const lists = [...sql.matchAll(/\bIN \(('[A-Z]+'(?:,\s*'[A-Z]+')*)\)/g)].map(m => [...m[1].matchAll(/'([A-Z]+)'/g)].map(x => x[1]));
    expect(lists.length).toBeGreaterThan(0);
    for (const l of lists) expect(l).toEqual([...VISIT_FREQUENCIES]);
  });
  test('route-zone pattern', () => expect(sql).toContain("'CCS[0-9][0-9][0-9]'"));
});
