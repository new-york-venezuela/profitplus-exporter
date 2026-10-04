# CxC: granularity on trends, vencido vs. corriente, collection-priority ordering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) DSO and aging trend charts follow the page date range and the day/week/month granularity rules used by Resumen/Ventas; (2) the top-10 "Mayor concentración de crédito" separates vencido from al corriente; (3) the top-15 "Concentración de deuda por cliente" is selected and ordered by vencido amount, with bars that make urgency readable.

**Architecture:** Pure, unit-tested helpers in `app/(app)/analitica/lib/cxc-trends.ts` bucket snapshot dates (last snapshot per bucket, keys identical to `bucketKeyExpr`) and rank/split by overdue. `/api/dwh/cxc` reads the snapshot dates inside the range, picks one snapshot per bucket, then queries aging/DSO only for those snapshots. Point-in-time cards (aging bar, top 10, top 15) keep using the latest snapshot.

**Tech Stack:** Next.js 16, mssql (DWH), Recharts, `bun test`.

**Spec:** `docs/superpowers/specs/2026-10-04-cxc-trends-and-priority-design.md`

**Execution order / dependencies:** PLAN 5 OF 5 (last). Independent of plans 1-4 at code level (Resumen's top-debtors card is left unchanged: `DebtorRow` stays as is and CxC gets an extended type).

## Global Constraints

- DWH only; `requireDwhAccess`; errors `{ error: string }`; ints inlined into `IN (...)` only after `Number.isInteger` filtering of values that came out of the DB; the date range goes through `buildDateWhereClause(dateRange, 'a', 'SnapshotDateKey')`.
- Granularity rules are exactly `lib/granularity.ts` (`resolveGranularity`, `bucketMode`, `bucketLabels`, `bucketTitle`); route uses `parseTrendBucket(searchParams, dateRange)`.
- Bucket keys: day `YYYY-MM-DD`, week `YYYY-Www` (Monday-first, week 1 contains Jan 1, split at year boundary — `weekOfYear`), month `YYYY-MM`, `range` for a ≤31-day range with month granularity.
- Each bucket uses the **last snapshot inside it**; buckets without snapshots are omitted (no interpolation).
- Vencido = `AgingBucket <> 'Current'` among non-credit-note rows (same as the existing `overdueShare`). Al corriente = `Current`.
- Snapshot AR is valued at the snapshot date's rate (existing rule); do not change.
- Spanish UI copy.

## Review Focus

- Only one snapshot in range (dev DWH has exactly one): each trend renders a single point/area without crashing; the empty-state text is accurate ("no hay snapshots en el período").
- Two snapshots in the same week/month: only the later one is used.
- Week keys at a year boundary (Dec 29 / Jan 1) match SQL `bucketKeyExpr('week')` (tested against `weekOfYear`).
- A customer with large current-only debt and no overdue must not displace customers with overdue in the top 15.
- `overdue + current = total` for every top-10 row (BS and USD); USD null when no row has a rate.
- Range with no snapshots but the latest-snapshot cards still present.

## File Structure

- Create `app/(app)/analitica/lib/cxc-trends.ts` + `lib/__tests__/cxc-trends.test.ts`.
- Modify `types.ts`, `app/api/dwh/cxc/route.ts`, `analitica-client.tsx` (`GRANULARITY_TABS`), `tabs/tab-cxc.tsx`, `content/help/analitica-definiciones.md`.

---

### Task 1: Pure CxC helpers

**Files:** Create `app/(app)/analitica/lib/cxc-trends.ts`; Test `app/(app)/analitica/lib/__tests__/cxc-trends.test.ts`.

**Interfaces:**
- Produces:
  - `snapshotBucketKey(mode: BucketMode, snapshotDateKey: number): string`
  - `pickLastSnapshotPerBucket(keys: number[], mode: BucketMode): { bucket: string; snapshotDateKey: number }[]` — ascending by snapshot date, one per bucket (the latest key in it).
  - `OVERDUE_EXCLUDED_BUCKET = 'Current'`, `isOverdueBucket(bucket: string): boolean`
  - `splitOverdue(buckets: { bucket: string; amount: DualAmount }[]): { overdue: DualAmount; current: DualAmount; total: DualAmount }` (USD `null` only when no non-null USD in that part; empty part = `{bs: 0, usd: 0}`)
  - `rankByOverdue<T extends { buckets: { bucket: string; amount: DualAmount }[] }>(rows: T[]): T[]` — overdue BS desc, then total BS desc.

- [ ] **Step 1: Failing tests**

```ts
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
```

- [ ] **Step 2:** run → FAIL. **Step 3: Implement**

```ts
import { weekOfYear, type BucketMode } from './granularity';
import type { DualAmount } from '../types';

export const OVERDUE_EXCLUDED_BUCKET = 'Current';

function keyToIso(key: number): string {
  const s = String(key);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

// Same bucket keys the SQL side produces (bucketKeyExpr) so labels/titles from
// lib/granularity apply unchanged.
export function snapshotBucketKey(mode: BucketMode, snapshotDateKey: number): string {
  const iso = keyToIso(snapshotDateKey);
  switch (mode) {
    case 'day': return iso;
    case 'week': {
      const w = weekOfYear(iso);
      return `${w.year}-W${String(w.week).padStart(2, '0')}`;
    }
    case 'month': return iso.slice(0, 7);
    case 'range': return 'range';
  }
}

// One point per bucket: the last snapshot inside it. Buckets with no snapshot
// are simply absent (no interpolation).
export function pickLastSnapshotPerBucket(keys: number[], mode: BucketMode): { bucket: string; snapshotDateKey: number }[] {
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

export function splitOverdue(buckets: { bucket: string; amount: DualAmount }[]): { overdue: DualAmount; current: DualAmount; total: DualAmount } {
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
```

- [ ] **Step 4:** run → PASS. **Step 5:** commit `feat(analitica): CxC trend/priority helpers`.

---

### Task 2: Types and API

**Files:** Modify `types.ts`, `app/api/dwh/cxc/route.ts`.

**Interfaces:**
- Produces (types): `DsoTrendRow { bucket: string; snapshotDateKey: number; dso: number | null }`; `AgingTrendRow { bucket: string; snapshotDateKey: number; buckets: AgingBucketRow[] }`; `CxcDebtorRow extends DebtorRow { overdue: DualAmount; current: DualAmount }`; `CxcResponse.topDebtors: CxcDebtorRow[]` and `CxcResponse.trendMode: BucketMode`; `DebtConcentrationRow` unchanged (ordering changes only).

- [ ] **Step 1: Types** — replace `yearMonth` with `bucket` + `snapshotDateKey` in both trend rows, add `CxcDebtorRow`, add `trendMode` (import `BucketMode` already imported at top of `types.ts`).
- [ ] **Step 2: Route — trends.** Replace `DSO_TREND_QUERY` and `AGING_TREND_QUERY` with:

```ts
// Snapshot dates inside the selected range (not "all history"); one point per
// day/week/month bucket is then chosen in TypeScript (pickLastSnapshotPerBucket).
function snapshotDatesQuery(dateRange: string): string {
  return `
    SELECT DISTINCT a.SnapshotDateKey
    FROM fact.Fact_AR_Snapshot a
    WHERE 1 = 1 ${buildDateWhereClause(dateRange, 'a', 'SnapshotDateKey')}
    ORDER BY a.SnapshotDateKey
  `;
}

function agingTrendQuery(snapshotKeys: number[]): string {
  return `
    SELECT a.SnapshotDateKey, a.AgingBucket,
      SUM(a.OutstandingBalance) AS AmountBs,
      SUM(a.OutstandingBalance / NULLIF(fx.RateSell, 0)) AS AmountUsd
    FROM fact.Fact_AR_Snapshot a
    ${usdConversionJoin('a', 'SnapshotDateKey')}
    WHERE a.IsCreditNote = 0 AND a.SnapshotDateKey IN (${snapshotKeys.join(', ')})
    GROUP BY a.SnapshotDateKey, a.AgingBucket
    ORDER BY a.SnapshotDateKey
  `;
}
```

  In `GET` (default section): `const dateRange = searchParams.get('dateRange') ?? '12m'; const trendBucket = parseTrendBucket(searchParams, dateRange);` then
  `const dates = (await pool.request().query(snapshotDatesQuery(dateRange))).recordset.map(r => Number(r.SnapshotDateKey)).filter(Number.isInteger);`
  `const picks = pickLastSnapshotPerBucket(dates, trendBucket.mode);` — when `picks.length === 0` skip both trend queries; otherwise run `agingTrendQuery(picks.map(p => p.snapshotDateKey))` and `dsoForSnapshotQuery()` once per pick (parallel, as today, using `req.input('snapshotDateKey', pick.snapshotDateKey)`). Map to `{ bucket: pick.bucket, snapshotDateKey, dso }` / `{ bucket, snapshotDateKey, buckets }` (group the aging rows by `SnapshotDateKey`). Delete the old month-grouping code. Add `trendMode: trendBucket.mode` to the response.
- [ ] **Step 3: Route — top 10 split.** In `topDebtorsQuery` add, after `OutstandingUsd`:

```sql
      SUM(CASE WHEN a.AgingBucket <> 'Current' THEN a.OutstandingBalance ELSE 0 END) AS OverdueBs,
      SUM(CASE WHEN a.AgingBucket <> 'Current' THEN a.OutstandingBalance / NULLIF(fx.RateSell, 0) END) AS OverdueUsd,
      SUM(CASE WHEN a.AgingBucket = 'Current' THEN a.OutstandingBalance ELSE 0 END) AS CurrentBs,
      SUM(CASE WHEN a.AgingBucket = 'Current' THEN a.OutstandingBalance / NULLIF(fx.RateSell, 0) END) AS CurrentUsd,
```

  and map them (`NULL` USD → `null`; an all-NULL SUM of zero rows of that kind is `null`, so map `OverdueUsd === null && OverdueBs === 0` to `0`).
- [ ] **Step 4: Route — top 15 by vencido.** In `debtConcentrationQuery`'s inner `SELECT TOP 15 …` change `ORDER BY SUM(a2.OutstandingBalance) DESC` to `ORDER BY SUM(CASE WHEN a2.AgingBucket <> 'Current' THEN a2.OutstandingBalance ELSE 0 END) DESC, SUM(a2.OutstandingBalance) DESC`; in `handleDebtConcentration` return `rankByOverdue(Array.from(byName.values()))`.
- [ ] **Step 5: Verify live** (throwaway `bun test`, mock `@/lib/dwh/access`): default + `section=debtConcentration` for `dateRange=12m`, `30d`, `month:2026-09`; assert top-10 rows satisfy `overdue.bs + current.bs ≈ outstanding.bs`; trend arrays have ≤1 entries (one snapshot exists) with correct `bucket` (month vs week vs day key) and a range containing no snapshot returns `[]`; the concentration rows are non-increasing in vencido.
- [ ] **Step 6:** `bunx tsc --noEmit -p .` (fix `tab-cxc.tsx` compile errors in Task 3, so run tsc after Task 3 if needed) ; commit `feat(analitica): CxC range-aware trends and overdue ranking API`.

---

### Task 3: UI

**Files:** Modify `analitica-client.tsx` (line 62: add `'cxc'`), `tabs/tab-cxc.tsx`.

- [ ] **Step 1:** `GRANULARITY_TABS = new Set(['resumen', 'ventas', 'productos', 'compras', 'cxc'])`.
- [ ] **Step 2: TabCxc props** `{ dateRange, currency, granularity }`; main fetch sends `dateRange` and `granularity`, deps `[clienteDimension, dateRange, granularity]`. Import `bucketLabels`, `bucketTitle`, `TREND_UNIT_LABEL`, `type Granularity` from `../lib/granularity`, `splitOverdue` etc. from `../lib/cxc-trends`.
- [ ] **Step 3: Trend charts.** For DSO and aging trend build `xLabels = bucketLabels(data.trendMode, rows.map(r => r.bucket))`; chart data rows carry `label`, `title: \`${bucketTitle(mode, row.bucket)} · snapshot ${formatSnapshotDate(row.snapshotDateKey)}\``; `XAxis dataKey="label"`; `Tooltip labelFormatter={(label, payload) => payload?.[0]?.payload?.title ?? label}`; subtitles mention the grain (`por ${TREND_UNIT_LABEL[data.trendMode]}`, "último snapshot de cada período"). Empty states: "No hay snapshots de cuentas por cobrar en el período seleccionado." (replace the old "se necesita más de un snapshot" text — a single point now renders). `dot` stays on the line so one point is visible.
- [ ] **Step 4: Top 10 card.** Columns: Cliente | Saldo | Vencido (red text) | Al corriente (green text) | % vencido (`overdue.bs / outstanding.bs`, `—` when 0) | Días prom. de pago. Subtitle "Top 10 clientes por saldo pendiente — vencido vs. al corriente". Values via `moneyLabel`.
- [ ] **Step 5: Top 15 chart.** Stack order from the axis: `['>90', '61-90', '31-60', '1-30', 'Current']` with colors `'#7f1d1d', '#b91c1c', '#ef4444', '#fca5a5', '#d1d5db'` and legend names `>90 d`, `61-90 d`, `31-60 d`, `1-30 d`, `Al corriente`; subtitle "Top 15 clientes por saldo vencido (mayor primero); lo gris aún no vence — para priorizar cobranza"; data rows keep server order (already ranked); tooltip `labelFormatter` adds `— vencido {moneyLabel(overdue)} ({pct})` using a name → `splitOverdue(row.buckets)` map. Keep the Entidad/Tienda toggle behavior.
- [ ] **Step 6:** `bunx tsc --noEmit -p .`; `bunx eslint "app/(app)/analitica" app/api/dwh`. **Step 7:** commit `feat(analitica): CxC trends granularity, vencido split and priority ordering`.

---

### Task 4: Docs and verification

- [ ] **Step 1:** In `content/help/analitica-definiciones.md` "## Cobranza, DSO y tasa de cobranza": add the trend rules (granularity by range; one point per period = last snapshot in it; periods without snapshot are omitted), the vencido/al corriente definition, and the top-15 ordering by saldo vencido.
- [ ] **Step 2:** Browser check (`bun dev`): CxC with `30d`/`12m`; granularity toggle appears; charts render a single point with the dev DWH's one snapshot. State what could not be verified (multi-snapshot behaviour is covered only by unit tests).
- [ ] **Step 3:** commit `docs(analitica): CxC trend and priority definitions`.
