// Pure helpers for the CxC tab: snapshot bucketing for the trend charts and
// vencido / al corriente splitting. No server imports.
import { weekOfYear, type BucketMode } from './granularity';
import type { DualAmount } from '../types';

export const OVERDUE_EXCLUDED_BUCKET = 'Current';

function keyToIso(key: number): string {
  const s = String(key);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

// Same bucket keys the SQL side produces (bucketKeyExpr), so the labels and
// titles from ./granularity apply unchanged.
export function snapshotBucketKey(mode: BucketMode, snapshotDateKey: number): string {
  const iso = keyToIso(snapshotDateKey);
  switch (mode) {
    case 'day':
      return iso;
    case 'week': {
      const w = weekOfYear(iso);
      return `${w.year}-W${String(w.week).padStart(2, '0')}`;
    }
    case 'month':
      return iso.slice(0, 7);
    case 'range':
      return 'range';
  }
}

// One point per bucket: the last snapshot inside it. Buckets with no snapshot
// are simply absent (no interpolation).
export function pickLastSnapshotPerBucket(
  keys: number[],
  mode: BucketMode,
): { bucket: string; snapshotDateKey: number }[] {
  const byBucket = new Map<string, number>();
  for (const k of [...keys].sort((a, b) => a - b)) byBucket.set(snapshotBucketKey(mode, k), k);
  return [...byBucket.entries()]
    .map(([bucket, snapshotDateKey]) => ({ bucket, snapshotDateKey }))
    .sort((a, b) => a.snapshotDateKey - b.snapshotDateKey);
}

export function isOverdueBucket(bucket: string): boolean {
  return bucket !== OVERDUE_EXCLUDED_BUCKET;
}

function sum(items: DualAmount[]): DualAmount {
  if (items.length === 0) return { bs: 0, usd: 0 };
  const withUsd = items.filter(i => i.usd !== null);
  return {
    bs: items.reduce((s, i) => s + i.bs, 0),
    usd: withUsd.length === 0 ? null : withUsd.reduce((s, i) => s + (i.usd as number), 0),
  };
}

export function splitOverdue(buckets: { bucket: string; amount: DualAmount }[]): {
  overdue: DualAmount;
  current: DualAmount;
  total: DualAmount;
} {
  const overdue = sum(buckets.filter(b => isOverdueBucket(b.bucket)).map(b => b.amount));
  const current = sum(buckets.filter(b => !isOverdueBucket(b.bucket)).map(b => b.amount));
  return { overdue, current, total: sum([overdue, current]) };
}

// Collection priority: biggest vencido first; customers with only al-corriente
// debt come last; ties by total outstanding.
export function rankByOverdue<T extends { buckets: { bucket: string; amount: DualAmount }[] }>(rows: T[]): T[] {
  const withSplit = rows.map(r => ({ r, s: splitOverdue(r.buckets) }));
  withSplit.sort((a, b) => b.s.overdue.bs - a.s.overdue.bs || b.s.total.bs - a.s.total.bs);
  return withSplit.map(x => x.r);
}
