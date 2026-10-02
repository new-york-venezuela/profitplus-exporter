import { describe, test, expect } from 'bun:test';
import { makeMemoryDb } from '../../helpers/memory-db';
import { getSegmentMetaMap, getSegmentMeta, upsertSegmentMeta, setSegmentExpiry, appendAudit, listAudit } from '@/lib/pricing/segments-repo';

const row = (tipCli: string, extra = {}) => ({
  tipCli, kind: 'special' as const, customerCoCli: 'C1', reason: 'r', expiresAt: '2026-10-31',
  fallbackTipCli: '000001', previousTipCli: '000001', createdBy: '1', createdAt: 1, ...extra,
});

describe('segments repo', () => {
  test('upsert inserts then updates in place', () => {
    const db = makeMemoryDb();
    upsertSegmentMeta(db, row('000010'));
    upsertSegmentMeta(db, row('000010', { reason: 'otro' }));
    expect(getSegmentMetaMap(db).size).toBe(1);
    expect(getSegmentMeta(db, '000010')?.reason).toBe('otro');
  });
  test('setSegmentExpiry updates, clears, and reports a missing row', () => {
    const db = makeMemoryDb();
    upsertSegmentMeta(db, row('000010'));
    expect(setSegmentExpiry(db, '000010', '2026-11-30')).toBe(true);
    expect(getSegmentMeta(db, '000010')?.expiresAt).toBe('2026-11-30');
    expect(setSegmentExpiry(db, '000010', null)).toBe(true);
    expect(getSegmentMeta(db, '000010')?.expiresAt).toBeNull();
    expect(setSegmentExpiry(db, 'nope', '2026-11-30')).toBe(false);
  });
  test('audit stores JSON and lists newest first', () => {
    const db = makeMemoryDb();
    appendAudit(db, { userId: '1', action: 'customer_move', target: 'C1', before: { tipCli: 'A' }, after: { tipCli: 'B' }, now: 100 });
    appendAudit(db, { userId: '2', action: 'segment_create', target: '000010', now: 200 });
    const rows = listAudit(db);
    expect(rows.map(r => r.target)).toEqual(['000010', 'C1']);
    expect(JSON.parse(rows[1].beforeJson!)).toEqual({ tipCli: 'A' });
    expect(rows[0].beforeJson).toBeNull();
  });
});
