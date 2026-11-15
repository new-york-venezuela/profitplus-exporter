import { afterEach, describe, expect, test } from 'bun:test';
import type sql from 'mssql';
import { QUERY_REPORTS, runQueryReport } from '../query-reports';

const pool = {} as sql.ConnectionPool;

afterEach(() => {
  delete QUERY_REPORTS['fake'];
});

describe('runQueryReport', () => {
  test('fetch -> trim -> map', async () => {
    QUERY_REPORTS['fake'] = {
      fetch: async () => [{ a: '  x  ', n: 1 }],
      map: rows => rows.map(r => ({ ...r, b: `${r.a}!` })),
    };
    expect(await runQueryReport('fake', pool, {})).toEqual([{ a: 'x', n: 1, b: 'x!' }]);
  });
  test('passes filters to fetch', async () => {
    let seen: unknown;
    QUERY_REPORTS['fake'] = { fetch: async (_p, f) => { seen = f; return []; }, map: r => r };
    await runQueryReport('fake', pool, { startDate: '2026-01-01' });
    expect(seen).toEqual({ startDate: '2026-01-01' });
  });
  for (const id of ['nope', '__proto__', 'constructor']) {
    test(`rejects ${id}`, async () => {
      await expect(runQueryReport(id, pool, {})).rejects.toThrow('Reporte no encontrado');
    });
  }
});
