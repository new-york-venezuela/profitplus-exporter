import { describe, test, expect } from 'bun:test';
import { makeMemoryDb } from '../../helpers/memory-db';
import { sellerTargets } from '../../../lib/db/schema';
import { readTargetsForMonth } from '../../../lib/seguimiento/targets-repo';

describe('readTargetsForMonth', () => {
  test('returns only the requested month, keyed by salesRepKey, keeping nulls', () => {
    const db = makeMemoryDb();
    db.insert(sellerTargets).values([
      { salesRepKey: '1', periodMonth: '2026-10', salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: null },
      { salesRepKey: '2', periodMonth: '2026-10', salesQuotaUsd: null, weeklyVisitQuota: null, newCustomerQuota: 3 },
      { salesRepKey: '1', periodMonth: '2026-09', salesQuotaUsd: 999, weeklyVisitQuota: 9, newCustomerQuota: 9 },
    ]).run();
    const map = readTargetsForMonth(db, '2026-10');
    expect([...map.keys()].sort()).toEqual(['1', '2']);
    expect(map.get('1')).toEqual({ salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: null });
    expect(map.get('2')).toEqual({ salesQuotaUsd: null, weeklyVisitQuota: null, newCustomerQuota: 3 });
  });
  test('empty month gives an empty map', () => {
    expect(readTargetsForMonth(makeMemoryDb(), '2030-01').size).toBe(0);
  });
});
