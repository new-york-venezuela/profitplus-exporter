import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VISIT_FREQUENCIES } from '../../../lib/customer-mapping/frequency';

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
