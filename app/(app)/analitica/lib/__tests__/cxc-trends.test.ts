import { describe, test, expect } from 'bun:test';
import { snapshotBucketKey, pickLastSnapshotPerBucket, isOverdueBucket, splitOverdue, rankByOverdue } from '../cxc-trends';

describe('snapshotBucketKey', () => {
  test('day / month / range', () => {
    expect(snapshotBucketKey('day', 20260916)).toBe('2026-09-16');
    expect(snapshotBucketKey('month', 20260916)).toBe('2026-09');
    expect(snapshotBucketKey('range', 20260916)).toBe('range');
  });
  test('week keys follow weekOfYear (Monday-first, week 1 holds Jan 1, split at year end)', () => {
    expect(snapshotBucketKey('week', 20260101)).toBe('2026-W01'); // Thu Jan 1 2026
    expect(snapshotBucketKey('week', 20260105)).toBe('2026-W02'); // first Monday after
    expect(snapshotBucketKey('week', 20251231)).toBe('2025-W53');
    expect(snapshotBucketKey('week', 20260916)).toBe('2026-W38');
  });
});

describe('pickLastSnapshotPerBucket', () => {
  test('keeps only the latest snapshot per bucket, sorted ascending', () => {
    const keys = [20260915, 20260901, 20260902, 20261003];
    expect(pickLastSnapshotPerBucket(keys, 'month')).toEqual([
      { bucket: '2026-09', snapshotDateKey: 20260915 },
      { bucket: '2026-10', snapshotDateKey: 20261003 },
    ]);
  });
  test('two snapshots in the same week keep the later one', () => {
    expect(pickLastSnapshotPerBucket([20260915, 20260916], 'week')).toEqual([{ bucket: '2026-W38', snapshotDateKey: 20260916 }]);
  });
  test('daily keeps every snapshot; range collapses to the last', () => {
    expect(pickLastSnapshotPerBucket([20260902, 20260901], 'day').map(p => p.snapshotDateKey)).toEqual([20260901, 20260902]);
    expect(pickLastSnapshotPerBucket([20260902, 20260901], 'range')).toEqual([{ bucket: 'range', snapshotDateKey: 20260902 }]);
  });
  test('empty input is empty', () => expect(pickLastSnapshotPerBucket([], 'week')).toEqual([]));
});

describe('overdue helpers', () => {
  const buckets = [
    { bucket: 'Current', amount: { bs: 100, usd: 1 } },
    { bucket: '1-30', amount: { bs: 50, usd: 0.5 } },
    { bucket: '>90', amount: { bs: 25, usd: null } },
  ];
  test('isOverdueBucket', () => {
    expect(isOverdueBucket('Current')).toBe(false);
    expect(isOverdueBucket('1-30')).toBe(true);
    expect(isOverdueBucket('>90')).toBe(true);
  });
  test('splitOverdue reconciles and keeps USD semantics', () => {
    const s = splitOverdue(buckets);
    expect(s.current).toEqual({ bs: 100, usd: 1 });
    expect(s.overdue).toEqual({ bs: 75, usd: 0.5 });
    expect(s.total.bs).toBe(s.overdue.bs + s.current.bs);
    expect(splitOverdue([{ bucket: '>90', amount: { bs: 5, usd: null } }]).overdue).toEqual({ bs: 5, usd: null });
    expect(splitOverdue([]).overdue).toEqual({ bs: 0, usd: 0 });
  });
  test('rankByOverdue puts overdue first, current-only customers last', () => {
    const rows = [
      { name: 'BigCurrent', buckets: [{ bucket: 'Current', amount: { bs: 1000, usd: null } }] },
      { name: 'SmallOverdue', buckets: [{ bucket: '>90', amount: { bs: 10, usd: null } }] },
      { name: 'MidOverdue', buckets: [{ bucket: '61-90', amount: { bs: 50, usd: null } }, { bucket: 'Current', amount: { bs: 5, usd: null } }] },
    ];
    expect(rankByOverdue(rows).map(r => r.name)).toEqual(['MidOverdue', 'SmallOverdue', 'BigCurrent']);
  });
});
