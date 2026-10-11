import { describe, test, expect } from 'bun:test';
import type sql from 'mssql';
import { runDwhRestateLoads } from '../../../lib/customer-mapping/dwh';
import * as dwh from '../../../lib/customer-mapping/dwh';
import { INCREMENTAL_LOAD } from '../../../lib/dwh/incremental-load-sql';
import { INCREMENTAL_LOAD as FROM_SCRIPT_RE_EXPORT } from '../../../scripts/dwh-incremental-load';

describe('runDwhRestateLoads', () => {
  test('executes exactly the INCREMENTAL_LOAD batch (all dimensions, then all facts)', async () => {
    const batches: string[] = [];
    const pool = { request: () => ({ batch: async (b: string) => { batches.push(b); } }) } as unknown as sql.ConnectionPool;
    await runDwhRestateLoads(pool);
    expect(batches).toEqual([INCREMENTAL_LOAD]);
    expect(FROM_SCRIPT_RE_EXPORT).toBe(INCREMENTAL_LOAD);
    expect(INCREMENTAL_LOAD).toContain('dwh.Load_Dim_Product');
    expect(INCREMENTAL_LOAD.indexOf('Load_Dim_Product')).toBeLessThan(INCREMENTAL_LOAD.indexOf('Load_Fact_Sales'));
  });
});

describe("dead PR #12 code", () => {
  test("the Dim_CustomerMapping writer is gone", () => {
    expect("upsertDwhMapping" in dwh).toBe(false);
  });
});
