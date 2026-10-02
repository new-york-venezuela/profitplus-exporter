import { resolveGranularity, bucketMode, bucketSpan } from '@/app/(app)/analitica/lib/granularity';
import type { BucketMode, Granularity } from '@/app/(app)/analitica/lib/granularity';
import { bucketKeyExpr } from './query-builder';

export interface TrendBucket {
  /** What the user asked for (after validation against the range). */
  granularity: Granularity;
  /** What the SQL actually groups by — 'range' when "month" collapses to one bucket. */
  mode: BucketMode;
  /** Bucket-key SQL expression over dim.Dim_Date aliased `dateAlias`. */
  keyExpr: (dateAlias?: string) => string;
}

export function parseTrendBucket(
  searchParams: URLSearchParams,
  dateRange: string,
  today: Date = new Date(),
): TrendBucket {
  const granularity = resolveGranularity(dateRange, searchParams.get('granularity'), today);
  const mode = bucketMode(dateRange, granularity, today);
  return { granularity, mode, keyExpr: (dateAlias = 'd') => bucketKeyExpr(mode, dateAlias) };
}

function toDateKey(iso: string): number {
  return parseInt(iso.replace(/-/g, ''));
}

/**
 * Drill-down filter for one clicked bucket, against a fact table's DateKey.
 * '' for the aggregate range bucket (dateRange already scopes it); null for a
 * malformed key. The numbers come out of bucketSpan's regex-validated digits,
 * so nothing user-controlled is concatenated as text.
 */
export function bucketFilterClause(mode: BucketMode, bucketKey: string, factAlias: string): string | null {
  if (mode === 'range') return '';
  const span = bucketSpan(mode, bucketKey);
  if (!span) return null;
  return `AND ${factAlias}.DateKey >= ${toDateKey(span.start)} AND ${factAlias}.DateKey <= ${toDateKey(span.end)}`;
}
