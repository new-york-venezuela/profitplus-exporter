# Seguimiento Tab (plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new Analítica tab, **Seguimiento**, that turns the business's hand-built route scorecard into a visual, drillable view: root toggle (Vendedor / Ruta / Grupo de cliente) -> total -> root -> customer -> invoice lines, with a weekly activation strip, a quota bar with a projection marker, average price, a category-mix stacked bar and a "new customers vs target" chip per row, plus a table view one click away.

**Architecture:** All business rules (month pace and projection, ISO weeks, visit compliance, quota roll-up, category mix, root aggregation) are pure TypeScript modules in `lib/seguimiento/`, unit-tested without I/O. SQL lives in `lib/seguimiento/queries.ts` (functions take a `mssql` pool, so a disposable-DWH integration test can call them) and is orchestrated by one new route, `app/api/dwh/seguimiento/route.ts`, which merges DWH rows with SQLite `seller_targets`. The tab (`tab-seguimiento.tsx`) and small presentational components render the computed response; the existing `SellerProfile` (seller drill-down + inline quota editing) stays reachable from the tab. Nothing from the old Vendedores tab is deleted here (plan C does that).

**Tech Stack:** Bun (`bun test`), Next.js 16 App Router, React 19 + Tailwind, Recharts not needed (CSS/SVG bars), `mssql` (DWH, via `getDwhPool()`), Drizzle/`bun:sqlite` (`seller_targets`), React Testing Library on happy-dom, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-11-sales-tabs-refactor-design.md` (section "B. Seguimiento tab (new)" and the Decisions table). Depends on plan A `docs/superpowers/plans/2026-10-11-route-data-layer.md` (implemented BEFORE this plan): `dim.Dim_Customer.ErpSegmentCode/RegisteredDate/IsMigrationBatch/VisitFrequency/VisitIntervalDays`, `dim.Dim_Zone`, `dim.Dim_Segment`.

## Global Constraints

- Branch `feat/sales-tabs-refactor`; do not switch branches. Commit messages end with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Do not delete** the Vendedores tab, `app/api/dwh/vendedores/*`, `app/api/dwh/vendedor-360/*`, `tab-cadencia`, Profundidad, Matriz, or their tests/e2e specs. Deletion and tab consolidation are plan C. This plan only (a) adds files, (b) adds Seguimiento to the `TABS` registry, (c) moves `consignment.ts` (import-path updates only, behavior unchanged), (d) extracts `QuotaEditor` out of `seller-profile.tsx` and adds an optional `backLabel` prop.
- DWH queries only through `getDwhPool()`; every user-controlled value reaches SQL through `.input()`. Date windows come from `buildDateWhereClause` fed only regex-validated values (`month:YYYY-MM`, `custom:YYYY-MM-DD:YYYY-MM-DD`).
- Module gate on both layers: `requireDwhAccess(request)` in the route (401/403), page already gated by `hasDwhAccess` (`app/(app)/analitica/page.tsx`). Error shape `{ error: string }`.
- PostHog: `captureEvent(auth.session.sub, 'seguimiento_viewed', {...})` right before the success return; `captureException` + `console.error` in the catch (convention of `app/api/mapa/clientes/route.ts`).
- Money: every figure is a `Dual { bs: number; usd: number | null }` built with `dualAmountExpr` + `usdConversionJoin('fs')` (per-row USD at the invoice date's `RateSell`; NULL-rate rows are ignored by `SUM`, an empty set is 0). `usd: null` renders as "—", never `$0`. Quotas are USD-only. Ventas **brutas** = `SUM(Fact_Sales.NetAmount)` (sin IVA, before returns), consignment-pattern root invoices excluded exactly as `vendedores/route.ts` does (`getFlaggedRootCodes`, `DEFAULT_ROOT_SHARE_THRESHOLD`).
- Working days are **weekends only** (Saturday/Sunday); holidays are not modelled. Cutover/`IsMigrationBatch` come from the DWH flag (plan A); `MIGRATION_CUTOVER_DATE` is not re-declared here.
- Local DWH/ERP is a stale copy of production: all tests use mocks or a disposable DWH (`DW_NAME` set at the top of the integration test, `--timeout 30000`). Production-dependent assumptions are in "Verify on production".
- Spanish user-facing text, English identifiers. Tailwind classes follow the sibling tabs (`bg-white border border-gray-200 rounded-lg`, blue/green/amber/red scale).
- E2E: the default suite (`bun run e2e`) has **no DWH**; `scripts/e2e-seed.ts` seeds only SQLite users. Seguimiento UI behavior is therefore covered in the default suite with Playwright `page.route` mocks of `/api/dwh/seguimiento` and `/api/admin/seller-targets`, and against real data in an `@mssql`-tagged describe (run by `bun run e2e:mssql` on a machine with the migrated + loaded DWH, never in default CI). Always run e2e with `SQLITE_PATH=./e2e/.tmp` (see memory "Dev DB wipe hazards"); it is already set in `.env.test`.

## Review Focus

1. **Customers that moved (SCD2).** Invoices point at the `CustomerKey` version that existed when they were issued; a customer re-assigned to another seller/route by `mapping:apply` has several `Dim_Customer` rows. Attribution must follow the *current* row by `CustomerCode` (one customer, one root; no double counting, no orphan sales). Pinned in Task 5 (disposable DWH) and Task 4.
2. **Missing or partial quotas and NULL USD.** A root/seller with no `seller_targets` row, a `0` quota, a partial roll-up (one of several sellers without a quota), or `usd: null` sales must render "Sin meta" / "—", never `0%`, `NaN` or a bar at 100%. Pinned in Tasks 3, 4, 8.
3. **Calendar edges.** ISO weeks that cross the year (2026-W53, 2025-W01 starting 2024-12-30), a month whose first week started in the previous month, a future month, `asOf` before the month starts (0 working days elapsed => projection `null`, not `Infinity`), month with 20 vs 22 working days. Pinned in Task 1.
4. **No visit frequency yet.** Until `mapping:apply` runs, `VisitIntervalDays` is NULL for every customer: no one is overdue, nothing is counted as "0 days", the compliance rate is `null` and the UI says "Sin frecuencia". Pinned in Tasks 2, 4, 8.
5. **Consignment roots and inactive customers.** A flagged consignment-root customer code and `IsInactive` customers must not inflate sales, activation denominators or customer counts; excluded sales are still surfaced (footnote + invoice list), as the old Vendedores tab did. Pinned in Tasks 4, 6, 9.

## Interfaces plan C consumes

Produced by this plan; repeated here so plan C can be read standalone. All paths exist after the named task.

```ts
// lib/seguimiento/iso-date.ts  (Task 1)
export function parseIso(d: string): Date;                       // throws on non YYYY-MM-DD / impossible dates
export function toIso(d: Date): string;
export function addDays(d: string, n: number): string;
export function daysBetween(from: string, to: string): number;   // to - from, whole days (can be negative)

// lib/seguimiento/month-pace.ts  (Task 1)  <- plan C Resumen "month-pace strip"
export function isWorkingDay(isoDate: string): boolean;           // Mon-Fri
export function monthBounds(month: string): { start: string; end: string };      // 'YYYY-MM' -> 'YYYY-MM-01'..last day
export function countWorkingDays(from: string, to: string): number;               // inclusive, 0 when to < from
export interface MonthPace {
  month: string; asOf: string;
  workingDaysInMonth: number; workingDaysElapsed: number; workingDaysRemaining: number;
  fractionElapsed: number;                                        // elapsed / inMonth, 0..1 (the "% of month")
}
export function monthPace(month: string, asOf: string): MonthPace;                // asOf is clamped into the month
export function projectToMonth(actual: number | null, pace: Pick<MonthPace, 'workingDaysInMonth' | 'workingDaysElapsed'>): number | null;
export interface ReferenceMonth { month: string; monthStart: string; monthEnd: string; asOf: string }
export function resolveReferenceMonth(dateRange: string, today: string): ReferenceMonth;

// lib/seguimiento/iso-weeks.ts  (Task 1)
export interface IsoWeek { yearWeek: string; weekStart: string; weekEnd: string; label: string }   // '2026-W41','2026-10-05','2026-10-11','S41'
export function isoWeekOf(isoDate: string): IsoWeek;              // yearWeek format == dim.Dim_Date.YearWeek
export function isoWeeksOfMonth(month: string): IsoWeek[];        // every ISO week with >= 1 day in the month

// lib/seguimiento/visit-compliance.ts  (Task 2)  <- plan C Clientes "visit-compliance column / overdue list"
export type VisitStatus = 'ok' | 'overdue' | 'no_interval' | 'no_invoice';
export interface VisitCompliance { status: VisitStatus; daysSinceLastInvoice: number | null; intervalDays: number | null; daysOverdue: number | null }
export function visitCompliance(input: { lastInvoiceDate: string | null; intervalDays: number | null | undefined; asOf: string }): VisitCompliance;
export interface ComplianceSummary { total: number; ok: number; overdue: number; noInterval: number; noInvoice: number; complianceRate: number | null }
export function summarizeCompliance(items: readonly VisitCompliance[]): ComplianceSummary;

// lib/seguimiento/types.ts  (Task 4)
export interface Dual { bs: number; usd: number | null }          // structurally identical to DualAmount
export type RootKind = 'vendedor' | 'ruta' | 'grupo';
export function parseRootKind(v: string | null): RootKind;        // unknown -> 'vendedor'
export interface SeguimientoResponse { /* see Task 4 */ }
export interface SeguimientoLinesResponse { lines: SeguimientoInvoiceLine[] }
export interface SeguimientoExcludedResponse { invoices: SeguimientoExcludedInvoice[] }

// lib/seguimiento/aggregate.ts  (Task 4)
export function rootOf(kind: RootKind, c: RootableCustomer): { value: string; label: string };

// lib/seguimiento/queries.ts  (Task 5)  <- plan C Clientes reuses fetchCustomers for assigned customers + lastInvoiceDate
export function fetchCustomers(pool: sql.ConnectionPool, asOf: string): Promise<CustomerFact[]>;

// app/api/dwh/lib/consignment.ts  (Task 6; moved from app/api/dwh/vendedores/consignment.ts, same exports)
export const DEFAULT_ROOT_SHARE_THRESHOLD: number;
export function isConsignmentPattern(salesOnRoot: number, totalSales: number, threshold: number): boolean;
export function getFlaggedRootCodes(dateWhere: string, rootShareThreshold: number): Promise<string[]>;

// app/(app)/analitica/components/seguimiento/*  (Tasks 8-9)
export function MonthPaceStrip(props: { pace: MonthPace }): JSX.Element;          // visuals.tsx  <- Resumen
export function VisitBadge(props: { visit: VisitCompliance }): JSX.Element;       // visuals.tsx  <- Clientes
export function WeekStrip / WeekDots / QuotaBar / MixBar / NewCustomersChip       // visuals.tsx
// app/(app)/analitica/components/quota-editor.tsx  (Task 7)
export function QuotaEditor(props: {...}): JSX.Element; export function saveSellerTargetField(args): Promise<boolean>;
// app/(app)/analitica/tabs/tab-seguimiento.tsx (Task 9): default export TabSeguimiento({ dateRange, currency })
```

---

## Task 1: Pure date helpers: ISO dates, month pace, projection, ISO weeks, reference month

**Files:**
- Create: `lib/seguimiento/iso-date.ts`, `lib/seguimiento/month-pace.ts`, `lib/seguimiento/iso-weeks.ts`
- Test: `__tests__/unit/seguimiento/month-pace.test.ts`, `__tests__/unit/seguimiento/iso-weeks.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseIso`, `toIso`, `addDays`, `daysBetween`, `isWorkingDay`, `monthBounds`, `countWorkingDays`, `MonthPace`, `monthPace`, `projectToMonth`, `ReferenceMonth`, `resolveReferenceMonth`, `IsoWeek`, `isoWeekOf`, `isoWeeksOfMonth` exactly as in "Interfaces plan C consumes". `isoWeekOf(...).yearWeek` has the same `'YYYY-Www'` format (ISO year = year of the week's Thursday) as `dim.Dim_Date.YearWeek` (migration `0033_dim_date_add_week.sql`). Definitions: a day is *elapsed* when `date <= asOf` (today counts as elapsed); `projectToMonth = actual / (elapsed / inMonth)` and is `null` when `actual` is `null` or `elapsed <= 0`.

- [ ] **Step 1: Write the failing tests**

`__tests__/unit/seguimiento/month-pace.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import { addDays, daysBetween, parseIso } from '../../../lib/seguimiento/iso-date';
import {
  countWorkingDays, isWorkingDay, monthBounds, monthPace, projectToMonth, resolveReferenceMonth,
} from '../../../lib/seguimiento/month-pace';

describe('iso-date', () => {
  test('addDays and daysBetween cross month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-01', '2026-10-14')).toBe(13);
    expect(daysBetween('2026-10-14', '2026-10-01')).toBe(-13);
  });
  test('parseIso rejects malformed and impossible dates', () => {
    expect(() => parseIso('2026-13-01')).toThrow();
    expect(() => parseIso('2026-02-30')).toThrow();
    expect(() => parseIso('28/03/2026')).toThrow(/YYYY-MM-DD/);
  });
});

describe('working days (weekends only)', () => {
  test('isWorkingDay', () => {
    expect(isWorkingDay('2026-10-02')).toBe(true);  // Friday
    expect(isWorkingDay('2026-10-03')).toBe(false); // Saturday
    expect(isWorkingDay('2026-10-04')).toBe(false); // Sunday
  });
  test('countWorkingDays is inclusive and 0 for an inverted range', () => {
    expect(countWorkingDays('2026-10-01', '2026-10-14')).toBe(10);
    expect(countWorkingDays('2026-10-03', '2026-10-04')).toBe(0);
    expect(countWorkingDays('2026-10-14', '2026-10-01')).toBe(0);
  });
  test('monthBounds handles 28/29/30/31-day months', () => {
    expect(monthBounds('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthBounds('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(monthBounds('2026-10').end).toBe('2026-10-31');
    expect(() => monthBounds('2026-13')).toThrow();
  });
});

describe('monthPace', () => {
  test('October 2026 has 22 working days; 10 elapsed on the 14th', () => {
    const p = monthPace('2026-10', '2026-10-14');
    expect(p).toMatchObject({ workingDaysInMonth: 22, workingDaysElapsed: 10, workingDaysRemaining: 12 });
    expect(p.fractionElapsed).toBeCloseTo(10 / 22, 10);
  });
  test('February 2026 has 20 working days', () => {
    expect(monthPace('2026-02', '2026-02-28').workingDaysInMonth).toBe(20);
  });
  test('asOf on a weekend does not add working days', () => {
    expect(monthPace('2026-10', '2026-10-10').workingDaysElapsed).toBe(7);
  });
  test('asOf before the month is 0 elapsed, after the month is the full month', () => {
    expect(monthPace('2026-10', '2026-09-30').workingDaysElapsed).toBe(0);
    expect(monthPace('2026-10', '2026-11-15').workingDaysElapsed).toBe(22);
    expect(monthPace('2026-10', '2026-11-15').fractionElapsed).toBe(1);
  });
});

describe('projectToMonth', () => {
  const pace = { workingDaysInMonth: 22, workingDaysElapsed: 10 };
  test('actual / (elapsed / inMonth)', () => {
    expect(projectToMonth(1000, pace)).toBe(2200);
    expect(projectToMonth(0, pace)).toBe(0);
  });
  test('null actual or nothing elapsed is null, never Infinity or NaN', () => {
    expect(projectToMonth(null, pace)).toBeNull();
    expect(projectToMonth(1000, { workingDaysInMonth: 22, workingDaysElapsed: 0 })).toBeNull();
  });
  test('closed month projects to the actual', () => {
    expect(projectToMonth(1234, { workingDaysInMonth: 22, workingDaysElapsed: 22 })).toBe(1234);
  });
});

describe('resolveReferenceMonth', () => {
  const today = '2026-10-11';
  test('month:YYYY-MM past month is closed', () => {
    expect(resolveReferenceMonth('month:2026-09', today)).toEqual({
      month: '2026-09', monthStart: '2026-09-01', monthEnd: '2026-09-30', asOf: '2026-09-30',
    });
  });
  test('month:YYYY-MM current month is as of today', () => {
    expect(resolveReferenceMonth('month:2026-10', today).asOf).toBe('2026-10-11');
  });
  test('trailing windows and unknown values use the current month', () => {
    for (const r of ['30d', '12m', 'weird']) {
      expect(resolveReferenceMonth(r, today)).toMatchObject({ month: '2026-10', asOf: '2026-10-11' });
    }
  });
  test('custom range uses the month and day of its end', () => {
    expect(resolveReferenceMonth('custom:2026-08-03:2026-09-15', today)).toMatchObject({ month: '2026-09', asOf: '2026-09-15' });
  });
  test('ytd: current year is this month, past year is December of that year', () => {
    expect(resolveReferenceMonth('ytd:2026', today).month).toBe('2026-10');
    expect(resolveReferenceMonth('ytd:2025', today)).toMatchObject({ month: '2025-12', asOf: '2025-12-31' });
  });
  test('an impossible month falls back to the current month instead of throwing', () => {
    expect(resolveReferenceMonth('month:2026-13', today).month).toBe('2026-10');
  });
  test('a future month is not elapsed at all', () => {
    const ref = resolveReferenceMonth('month:2027-01', today);
    expect(ref.asOf).toBe(today);
    expect(monthPace(ref.month, ref.asOf).workingDaysElapsed).toBe(0);
  });
});
```

`__tests__/unit/seguimiento/iso-weeks.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import { isoWeekOf, isoWeeksOfMonth } from '../../../lib/seguimiento/iso-weeks';

describe('isoWeekOf', () => {
  test('Thursday 2026-10-01 is 2026-W40 starting Monday 2026-09-28', () => {
    expect(isoWeekOf('2026-10-01')).toEqual({ yearWeek: '2026-W40', weekStart: '2026-09-28', weekEnd: '2026-10-04', label: 'S40' });
  });
  test('a Sunday belongs to the week that started the Monday before', () => {
    expect(isoWeekOf('2026-10-11')).toMatchObject({ yearWeek: '2026-W41', weekStart: '2026-10-05' });
  });
  test('year boundaries use the year of the Thursday', () => {
    expect(isoWeekOf('2026-01-01')).toMatchObject({ yearWeek: '2026-W01', weekStart: '2025-12-29' });
    expect(isoWeekOf('2024-12-30')).toMatchObject({ yearWeek: '2025-W01' });
    expect(isoWeekOf('2027-01-01')).toMatchObject({ yearWeek: '2026-W53' });
  });
});

describe('isoWeeksOfMonth', () => {
  test('October 2026 spans weeks 40-44 (the workbook weeks)', () => {
    const weeks = isoWeeksOfMonth('2026-10');
    expect(weeks.map(w => w.yearWeek)).toEqual(['2026-W40', '2026-W41', '2026-W42', '2026-W43', '2026-W44']);
    expect(weeks[0].weekStart).toBe('2026-09-28');
    expect(weeks[4].weekEnd).toBe('2026-11-01');
  });
  test('a month starting on Monday does not include the previous week', () => {
    expect(isoWeeksOfMonth('2026-06')[0].weekStart).toBe('2026-06-01');
  });
  test('January 2027 starts in 2026-W53', () => {
    expect(isoWeeksOfMonth('2027-01')[0].yearWeek).toBe('2026-W53');
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/seguimiento/month-pace.test.ts __tests__/unit/seguimiento/iso-weeks.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`lib/seguimiento/iso-date.ts`:
```ts
// Pure UTC date arithmetic on 'YYYY-MM-DD' strings. No library, no local time zone
// (AGENTS.md: "No date library"; lib/dates.ts is month-range oriented, this is day-level).
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIso(d: string): Date {
  const m = ISO.exec(d);
  if (!m) throw new Error(`Fecha inválida '${d}'; se esperaba YYYY-MM-DD`);
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (date.toISOString().slice(0, 10) !== d) throw new Error(`Fecha inválida '${d}'`);
  return date;
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  const x = parseIso(d);
  x.setUTCDate(x.getUTCDate() + n);
  return toIso(x);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000);
}
```

`lib/seguimiento/month-pace.ts`:
```ts
import { addDays, daysBetween, parseIso, toIso } from './iso-date';

// Weekends only; holidays are not modelled (spec decision "Working days").
export function isWorkingDay(isoDate: string): boolean {
  const dow = parseIso(isoDate).getUTCDay();
  return dow !== 0 && dow !== 6;
}

const MONTH = /^(\d{4})-(\d{2})$/;

export function isValidMonth(month: string): boolean {
  const m = MONTH.exec(month);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

export function monthBounds(month: string): { start: string; end: string } {
  const m = MONTH.exec(month);
  if (!m || !isValidMonth(month)) throw new Error(`Mes inválido '${month}'; se esperaba YYYY-MM`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return { start: toIso(new Date(Date.UTC(y, mo - 1, 1))), end: toIso(new Date(Date.UTC(y, mo, 0))) };
}

export function countWorkingDays(from: string, to: string): number {
  const span = daysBetween(from, to);
  let n = 0;
  for (let i = 0; i <= span; i++) if (isWorkingDay(addDays(from, i))) n++;
  return n;
}

export interface MonthPace {
  month: string;
  asOf: string;
  workingDaysInMonth: number;
  workingDaysElapsed: number;
  workingDaysRemaining: number;
  fractionElapsed: number;
}

// "Elapsed" = working days from the 1st through asOf, inclusive (today counts).
// asOf is clamped into the month: before it => 0 elapsed, after it => the whole month.
export function monthPace(month: string, asOf: string): MonthPace {
  const { start, end } = monthBounds(month);
  const workingDaysInMonth = countWorkingDays(start, end);
  const effectiveEnd = asOf < end ? asOf : end;
  const workingDaysElapsed = effectiveEnd < start ? 0 : countWorkingDays(start, effectiveEnd);
  return {
    month, asOf, workingDaysInMonth, workingDaysElapsed,
    workingDaysRemaining: workingDaysInMonth - workingDaysElapsed,
    fractionElapsed: workingDaysElapsed / workingDaysInMonth,
  };
}

// Spec: projection = actual / (working days elapsed / working days in month).
export function projectToMonth(
  actual: number | null,
  pace: Pick<MonthPace, 'workingDaysInMonth' | 'workingDaysElapsed'>,
): number | null {
  if (actual === null || pace.workingDaysElapsed <= 0) return null;
  return (actual * pace.workingDaysInMonth) / pace.workingDaysElapsed;
}

export interface ReferenceMonth { month: string; monthStart: string; monthEnd: string; asOf: string }

const CUSTOM_END = /^custom:\d{4}-\d{2}-\d{2}:(\d{4}-\d{2}-\d{2})$/;
const MONTH_RANGE = /^month:(\d{4}-\d{2})$/;
const YTD_RANGE = /^ytd:(\d{4})$/;

// Seguimiento is a monthly scorecard (monthly quotas, ISO weeks, month projection). The shell's
// dateRange is mapped to ONE reference month: the month the range ends in, and "as of" the
// earliest of today, the range end and the month end.
export function resolveReferenceMonth(dateRange: string, today: string): ReferenceMonth {
  let month = today.slice(0, 7);
  let rangeEnd = today;
  const custom = CUSTOM_END.exec(dateRange);
  const monthRange = MONTH_RANGE.exec(dateRange);
  const ytd = YTD_RANGE.exec(dateRange);
  if (custom) {
    month = custom[1].slice(0, 7);
    rangeEnd = custom[1];
  } else if (monthRange) {
    month = monthRange[1];
    rangeEnd = isValidMonth(month) ? monthBounds(month).end : today;
  } else if (ytd && ytd[1] !== today.slice(0, 4)) {
    month = `${ytd[1]}-12`;
    rangeEnd = `${ytd[1]}-12-31`;
  }
  if (!isValidMonth(month)) {
    month = today.slice(0, 7);
    rangeEnd = today;
  }
  const { start, end } = monthBounds(month);
  const asOf = [today, rangeEnd, end].reduce((a, b) => (a < b ? a : b));
  return { month, monthStart: start, monthEnd: end, asOf };
}
```

`lib/seguimiento/iso-weeks.ts`:
```ts
import { addDays, daysBetween, parseIso } from './iso-date';
import { monthBounds } from './month-pace';

export interface IsoWeek { yearWeek: string; weekStart: string; weekEnd: string; label: string }

// Same definition as dim.Dim_Date.YearWeek (migrations/dwh/0033): Monday-first, the ISO year is
// the year of the week's Thursday, so 'YYYY-Www' strings match what the SQL side returns.
export function isoWeekOf(isoDate: string): IsoWeek {
  const weekday = parseIso(isoDate).getUTCDay() || 7; // Mon=1 .. Sun=7
  const weekStart = addDays(isoDate, 1 - weekday);
  const thursday = addDays(weekStart, 3);
  const isoYear = Number(thursday.slice(0, 4));
  const week = Math.floor(daysBetween(`${isoYear}-01-01`, thursday) / 7) + 1;
  return {
    yearWeek: `${isoYear}-W${String(week).padStart(2, '0')}`,
    weekStart,
    weekEnd: addDays(weekStart, 6),
    label: `S${week}`,
  };
}

export function isoWeeksOfMonth(month: string): IsoWeek[] {
  const { start, end } = monthBounds(month);
  const weeks: IsoWeek[] = [];
  for (let cursor = isoWeekOf(start).weekStart; cursor <= end; cursor = addDays(cursor, 7)) {
    weeks.push(isoWeekOf(cursor));
  }
  return weeks;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/seguimiento/month-pace.test.ts __tests__/unit/seguimiento/iso-weeks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/seguimiento/iso-date.ts lib/seguimiento/month-pace.ts lib/seguimiento/iso-weeks.ts __tests__/unit/seguimiento/month-pace.test.ts __tests__/unit/seguimiento/iso-weeks.test.ts
git commit -m "feat(seguimiento): month pace, projection and ISO week helpers" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Pure visit-compliance helper (shared with plan C's Clientes tab)

**Files:**
- Create: `lib/seguimiento/visit-compliance.ts`
- Test: `__tests__/unit/seguimiento/visit-compliance.test.ts`

**Interfaces:**
- Consumes: `daysBetween(from: string, to: string): number` from `lib/seguimiento/iso-date.ts`.
- Produces: `VisitStatus`, `VisitCompliance`, `visitCompliance`, `ComplianceSummary`, `summarizeCompliance` exactly as in "Interfaces plan C consumes". Rules: a customer is **overdue** when `daysSinceLastInvoice > intervalDays` (strictly greater); a `null`/`undefined`/`<= 0`/`NaN` interval is `no_interval` — never overdue, never treated as 0 (`daysOverdue` is `null`); a valid interval with no invoice at all is `no_invoice` (neither ok nor overdue; the caller decides how to present it); negative day counts (last invoice after `asOf`) clamp to 0. `complianceRate = ok / (ok + overdue)`, `null` when that denominator is 0.

- [ ] **Step 1: Write the failing test**

`__tests__/unit/seguimiento/visit-compliance.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import { summarizeCompliance, visitCompliance } from '../../../lib/seguimiento/visit-compliance';

const asOf = '2026-10-14';

describe('visitCompliance', () => {
  test('within the interval is ok; exactly on the interval is still ok', () => {
    expect(visitCompliance({ lastInvoiceDate: '2026-10-12', intervalDays: 7, asOf }))
      .toEqual({ status: 'ok', daysSinceLastInvoice: 2, intervalDays: 7, daysOverdue: 0 });
    expect(visitCompliance({ lastInvoiceDate: '2026-10-07', intervalDays: 7, asOf }).status).toBe('ok');
  });
  test('one day past the interval is overdue by one', () => {
    expect(visitCompliance({ lastInvoiceDate: '2026-10-06', intervalDays: 7, asOf }))
      .toEqual({ status: 'overdue', daysSinceLastInvoice: 8, intervalDays: 7, daysOverdue: 1 });
  });
  test('a null, undefined, zero or NaN interval is never overdue and never 0 days', () => {
    for (const intervalDays of [null, undefined, 0, -3, NaN]) {
      const v = visitCompliance({ lastInvoiceDate: '2020-01-01', intervalDays, asOf });
      expect(v.status).toBe('no_interval');
      expect(v.intervalDays).toBeNull();
      expect(v.daysOverdue).toBeNull();
      expect(v.daysSinceLastInvoice).toBeGreaterThan(2000);
    }
  });
  test('a valid interval with no invoice is no_invoice', () => {
    expect(visitCompliance({ lastInvoiceDate: null, intervalDays: 15, asOf }))
      .toEqual({ status: 'no_invoice', daysSinceLastInvoice: null, intervalDays: 15, daysOverdue: null });
  });
  test('no interval and no invoice has no days at all', () => {
    expect(visitCompliance({ lastInvoiceDate: null, intervalDays: null, asOf }))
      .toEqual({ status: 'no_interval', daysSinceLastInvoice: null, intervalDays: null, daysOverdue: null });
  });
  test('a last invoice after asOf clamps to 0 days', () => {
    expect(visitCompliance({ lastInvoiceDate: '2026-10-20', intervalDays: 7, asOf }).daysSinceLastInvoice).toBe(0);
  });
});

describe('summarizeCompliance', () => {
  test('counts each status and computes the rate over ok + overdue only', () => {
    const items = [
      visitCompliance({ lastInvoiceDate: '2026-10-13', intervalDays: 7, asOf }),
      visitCompliance({ lastInvoiceDate: '2026-10-12', intervalDays: 7, asOf }),
      visitCompliance({ lastInvoiceDate: '2026-09-01', intervalDays: 7, asOf }),
      visitCompliance({ lastInvoiceDate: null, intervalDays: 7, asOf }),
      visitCompliance({ lastInvoiceDate: '2026-10-01', intervalDays: null, asOf }),
    ];
    expect(summarizeCompliance(items)).toEqual({ total: 5, ok: 2, overdue: 1, noInterval: 1, noInvoice: 1, complianceRate: 2 / 3 });
  });
  test('nobody has a frequency yet: rate is null, not 0', () => {
    const items = [visitCompliance({ lastInvoiceDate: '2026-10-01', intervalDays: null, asOf })];
    expect(summarizeCompliance(items).complianceRate).toBeNull();
    expect(summarizeCompliance([]).complianceRate).toBeNull();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/seguimiento/visit-compliance.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`lib/seguimiento/visit-compliance.ts`:
```ts
import { daysBetween } from './iso-date';

// Overdue visits (spec, section A): a customer is overdue when days since its last invoice exceed
// Dim_Customer.VisitIntervalDays. Computed in code/queries, never stored. A NULL interval (no
// frequency assigned yet) must NEVER be read as 0 days, so it can never be overdue.
export type VisitStatus = 'ok' | 'overdue' | 'no_interval' | 'no_invoice';

export interface VisitCompliance {
  status: VisitStatus;
  daysSinceLastInvoice: number | null;
  intervalDays: number | null;
  daysOverdue: number | null;
}

export function visitCompliance(input: {
  lastInvoiceDate: string | null;
  intervalDays: number | null | undefined;
  asOf: string;
}): VisitCompliance {
  const interval = typeof input.intervalDays === 'number' && input.intervalDays > 0 ? input.intervalDays : null;
  const days = input.lastInvoiceDate ? Math.max(0, daysBetween(input.lastInvoiceDate, input.asOf)) : null;
  if (interval === null) {
    return { status: 'no_interval', daysSinceLastInvoice: days, intervalDays: null, daysOverdue: null };
  }
  if (days === null) {
    return { status: 'no_invoice', daysSinceLastInvoice: null, intervalDays: interval, daysOverdue: null };
  }
  return days > interval
    ? { status: 'overdue', daysSinceLastInvoice: days, intervalDays: interval, daysOverdue: days - interval }
    : { status: 'ok', daysSinceLastInvoice: days, intervalDays: interval, daysOverdue: 0 };
}

export interface ComplianceSummary {
  total: number;
  ok: number;
  overdue: number;
  noInterval: number;
  noInvoice: number;
  complianceRate: number | null;
}

export function summarizeCompliance(items: readonly VisitCompliance[]): ComplianceSummary {
  const count = (s: VisitStatus) => items.filter(i => i.status === s).length;
  const ok = count('ok');
  const overdue = count('overdue');
  return {
    total: items.length, ok, overdue,
    noInterval: count('no_interval'), noInvoice: count('no_invoice'),
    complianceRate: ok + overdue > 0 ? ok / (ok + overdue) : null,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/seguimiento/visit-compliance.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/seguimiento/visit-compliance.ts __tests__/unit/seguimiento/visit-compliance.test.ts
git commit -m "feat(seguimiento): shared visit-compliance helper" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 3: Pure quota roll-up, quota-bar geometry and category mix

**Files:**
- Create: `lib/seguimiento/quotas.ts`, `lib/seguimiento/category-mix.ts`
- Test: `__tests__/unit/seguimiento/quotas.test.ts`, `__tests__/unit/seguimiento/category-mix.test.ts`

**Interfaces:**
- Consumes: nothing (local structural `Dual { bs: number; usd: number | null }` is declared in `category-mix.ts` and re-exported from `types.ts` in Task 4).
- Produces:
```ts
// quotas.ts
export interface SellerTargets { salesQuotaUsd: number | null; weeklyVisitQuota: number | null; newCustomerQuota: number | null }
export interface RolledQuota {
  salesQuotaUsd: number | null; weeklyVisitQuota: number | null; newCustomerQuota: number | null;
  sellersTotal: number;
  partial: { sales: boolean; weeklyVisits: boolean; newCustomers: boolean };   // some sellers have a value, some do not
}
export function rollUpQuotas(sellerKeys: readonly string[], targets: ReadonlyMap<string, SellerTargets>): RolledQuota;
export interface QuotaBarGeometry { fillPct: number; targetPct: number; projectionPct: number | null }
export function quotaBarGeometry(actual: number | null, quota: number | null, projected: number | null): QuotaBarGeometry | null;
// category-mix.ts
export const OTHER_LINE_LABEL = 'Otros';
export const DEFAULT_MAX_VISIBLE_LINES = 6;
export interface Dual { bs: number; usd: number | null }
export interface LineAmount { line: string | null; sales: Dual }
export interface MixSegment { line: string; share: number; sales: Dual }          // share 0..1 by Bs
export function chooseVisibleLines(lines: readonly LineAmount[], max?: number): string[];
export function bucketCategoryMix(lines: readonly LineAmount[], visible: readonly string[]): MixSegment[];
```
Semantics. `rollUpQuotas`: sum over the DISTINCT seller keys; a field's total is `null` only when no seller has a value; `partial.x` is true when at least one but not all sellers have a value. `quotaBarGeometry`: `null` when `quota` is `null`/`<= 0` (nothing to draw); otherwise scale = max(quota, actual, projected); all percentages are 0..100 of that scale (`actual` null => fill 0). `chooseVisibleLines`: real line names with positive Bs, ranked by total Bs desc (ties by name), top `max`; a `null`/blank line name is never visible (it goes to "Otros"). `bucketCategoryMix`: only positive amounts, shares by Bs over the positive total, visible lines first in the given order, then one `Otros` segment for everything else; `[]` when nothing is positive. This is how "Panaderia / Pasteleria / Pizza and any line added later (Navidad)" appear dynamically with no hard-coded list.

- [ ] **Step 1: Write the failing tests**

`__tests__/unit/seguimiento/quotas.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import { quotaBarGeometry, rollUpQuotas, type SellerTargets } from '../../../lib/seguimiento/quotas';

const t = (s: number | null, w: number | null, n: number | null): SellerTargets =>
  ({ salesQuotaUsd: s, weeklyVisitQuota: w, newCustomerQuota: n });

describe('rollUpQuotas', () => {
  const targets = new Map<string, SellerTargets>([['1', t(100, 2, 1)], ['2', t(50, null, null)], ['3', t(null, null, null)]]);

  test('a single seller is returned as is', () => {
    expect(rollUpQuotas(['1'], targets)).toMatchObject({ salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: 1, sellersTotal: 1 });
  });
  test('sums the sellers and flags partial fields', () => {
    const r = rollUpQuotas(['1', '2'], targets);
    expect(r.salesQuotaUsd).toBe(150);
    expect(r.partial.sales).toBe(false);
    expect(r.weeklyVisitQuota).toBe(2);
    expect(r.partial.weeklyVisits).toBe(true);
  });
  test('duplicate seller keys count once', () => {
    expect(rollUpQuotas(['1', '1', '1'], targets).salesQuotaUsd).toBe(100);
  });
  test('sellers without any row, or with all-null rows, give null (not 0)', () => {
    const r = rollUpQuotas(['3', '99'], targets);
    expect(r.salesQuotaUsd).toBeNull();
    expect(r.weeklyVisitQuota).toBeNull();
    expect(r.newCustomerQuota).toBeNull();
    expect(r.partial).toEqual({ sales: false, weeklyVisits: false, newCustomers: false });
  });
  test('an explicit 0 quota is a real value', () => {
    expect(rollUpQuotas(['z'], new Map([['z', t(0, null, null)]])).salesQuotaUsd).toBe(0);
  });
  test('no sellers at all', () => {
    expect(rollUpQuotas([], targets)).toMatchObject({ salesQuotaUsd: null, sellersTotal: 0 });
  });
});

describe('quotaBarGeometry', () => {
  test('actual below quota: marker at the quota end of the scale when projection is lower than quota', () => {
    expect(quotaBarGeometry(70, 100, 90)).toEqual({ fillPct: 70, targetPct: 100, projectionPct: 90 });
  });
  test('projection above quota rescales so everything fits', () => {
    const g = quotaBarGeometry(70, 100, 154)!;
    expect(g.projectionPct).toBe(100);
    expect(g.targetPct).toBeCloseTo((100 / 154) * 100, 6);
    expect(g.fillPct).toBeCloseTo((70 / 154) * 100, 6);
  });
  test('no quota, zero quota or negative quota draws nothing', () => {
    expect(quotaBarGeometry(70, null, 80)).toBeNull();
    expect(quotaBarGeometry(70, 0, 80)).toBeNull();
    expect(quotaBarGeometry(70, -5, 80)).toBeNull();
  });
  test('null actual draws an empty fill, null projection draws no marker', () => {
    expect(quotaBarGeometry(null, 100, null)).toEqual({ fillPct: 0, targetPct: 100, projectionPct: null });
  });
});
```

`__tests__/unit/seguimiento/category-mix.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import { bucketCategoryMix, chooseVisibleLines, OTHER_LINE_LABEL, type LineAmount } from '../../../lib/seguimiento/category-mix';

const a = (line: string | null, bs: number, usd: number | null = bs / 50): LineAmount => ({ line, sales: { bs, usd } });

describe('chooseVisibleLines', () => {
  test('ranks lines by Bs, merges rows of the same line, ignores null/blank/non-positive', () => {
    const v = chooseVisibleLines([a('Panaderia', 100), a('Pizza', 500), a('Panaderia', 700), a(null, 9999), a('  ', 9999), a('Pasteleria', 0), a('Devuelta', -5)]);
    expect(v).toEqual(['Panaderia', 'Pizza']);
  });
  test('caps at max and breaks ties by name', () => {
    const lines = ['E', 'D', 'C', 'B', 'A'].map(n => a(n, 10));
    expect(chooseVisibleLines(lines, 3)).toEqual(['A', 'B', 'C']);
  });
  test('a brand new line (Navidad) shows up with no code change', () => {
    expect(chooseVisibleLines([a('Panaderia', 100), a('Navidad', 300)])).toEqual(['Navidad', 'Panaderia']);
  });
});

describe('bucketCategoryMix', () => {
  const visible = ['Panaderia', 'Pizza'];
  test('shares by Bs over the positive total, visible order, remainder as Otros', () => {
    const mix = bucketCategoryMix([a('Panaderia', 600), a('Pizza', 200), a('Pasteleria', 100), a(null, 100)], visible);
    expect(mix.map(m => m.line)).toEqual(['Panaderia', 'Pizza', OTHER_LINE_LABEL]);
    expect(mix.map(m => m.share)).toEqual([0.6, 0.2, 0.2]);
    expect(mix[2].sales.bs).toBe(200);
  });
  test('visible lines with no sales are omitted', () => {
    expect(bucketCategoryMix([a('Pizza', 50)], visible).map(m => m.line)).toEqual(['Pizza']);
  });
  test('USD ignores null rows and is null only when every row is null', () => {
    const mix = bucketCategoryMix([a('Panaderia', 100, 2), a('Panaderia', 100, null), a('Pizza', 100, null)], visible);
    expect(mix[0].sales).toEqual({ bs: 200, usd: 2 });
    expect(mix[1].sales).toEqual({ bs: 100, usd: null });
  });
  test('nothing positive gives an empty mix', () => {
    expect(bucketCategoryMix([], visible)).toEqual([]);
    expect(bucketCategoryMix([a('Pizza', 0), a('Pizza', -10)], visible)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/seguimiento/quotas.test.ts __tests__/unit/seguimiento/category-mix.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`lib/seguimiento/quotas.ts`:
```ts
// Quotas live in SQLite seller_targets, keyed by (salesRepKey, periodMonth). A group/route root has
// no quota store of its own: its quota is the SUM of its sellers' quotas (a view, not a new store).
export interface SellerTargets {
  salesQuotaUsd: number | null;
  weeklyVisitQuota: number | null;
  newCustomerQuota: number | null;
}

export interface RolledQuota {
  salesQuotaUsd: number | null;
  weeklyVisitQuota: number | null;
  newCustomerQuota: number | null;
  sellersTotal: number;
  partial: { sales: boolean; weeklyVisits: boolean; newCustomers: boolean };
}

function sum(
  keys: readonly string[],
  targets: ReadonlyMap<string, SellerTargets>,
  pick: (t: SellerTargets) => number | null,
): { total: number | null; partial: boolean } {
  let total: number | null = null;
  let missing = 0;
  for (const key of keys) {
    const t = targets.get(key);
    const v = t ? pick(t) : null;
    if (v === null || v === undefined) { missing++; continue; }
    total = (total ?? 0) + v;
  }
  return { total, partial: total !== null && missing > 0 };
}

export function rollUpQuotas(sellerKeys: readonly string[], targets: ReadonlyMap<string, SellerTargets>): RolledQuota {
  const keys = [...new Set(sellerKeys)];
  const sales = sum(keys, targets, t => t.salesQuotaUsd);
  const weekly = sum(keys, targets, t => t.weeklyVisitQuota);
  const fresh = sum(keys, targets, t => t.newCustomerQuota);
  return {
    salesQuotaUsd: sales.total, weeklyVisitQuota: weekly.total, newCustomerQuota: fresh.total,
    sellersTotal: keys.length,
    partial: { sales: sales.partial, weeklyVisits: weekly.partial, newCustomers: fresh.partial },
  };
}

export interface QuotaBarGeometry {
  fillPct: number;
  targetPct: number;
  projectionPct: number | null;
}

// Pure layout for the quota bar: one scale that fits the quota, the actual and the projection.
export function quotaBarGeometry(
  actual: number | null,
  quota: number | null,
  projected: number | null,
): QuotaBarGeometry | null {
  if (quota === null || !(quota > 0)) return null;
  const scale = Math.max(quota, actual ?? 0, projected ?? 0);
  const pct = (v: number) => (v / scale) * 100;
  return {
    fillPct: actual === null ? 0 : pct(Math.max(0, actual)),
    targetPct: pct(quota),
    projectionPct: projected === null ? null : pct(Math.max(0, projected)),
  };
}
```

`lib/seguimiento/category-mix.ts`:
```ts
// Workbook "categoría" = Dim_Product.LineName, read dynamically (today Panaderia, Pasteleria, Pizza;
// Navidad appears by itself once it has sales). Fresco/Congelado (CategoryName) is NOT a level here.
export const OTHER_LINE_LABEL = 'Otros';
export const DEFAULT_MAX_VISIBLE_LINES = 6;

export interface Dual { bs: number; usd: number | null }
export interface LineAmount { line: string | null; sales: Dual }
export interface MixSegment { line: string; share: number; sales: Dual }

function realName(line: string | null): string | null {
  const n = line?.trim();
  return n ? n : null;
}

export function chooseVisibleLines(lines: readonly LineAmount[], max: number = DEFAULT_MAX_VISIBLE_LINES): string[] {
  const totals = new Map<string, number>();
  for (const l of lines) {
    const name = realName(l.line);
    if (!name || !(l.sales.bs > 0)) continue;
    totals.set(name, (totals.get(name) ?? 0) + l.sales.bs);
  }
  return [...totals]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .slice(0, max)
    .map(([name]) => name);
}

function addInto(acc: { bs: number; usd: number | null }, d: Dual): void {
  acc.bs += d.bs;
  if (d.usd !== null) acc.usd = (acc.usd ?? 0) + d.usd;
}

export function bucketCategoryMix(lines: readonly LineAmount[], visible: readonly string[]): MixSegment[] {
  const visibleSet = new Set(visible);
  const byLine = new Map<string, { bs: number; usd: number | null }>();
  const other = { bs: 0, usd: null as number | null };
  let total = 0;
  for (const l of lines) {
    if (!(l.sales.bs > 0)) continue;
    total += l.sales.bs;
    const name = realName(l.line);
    if (name && visibleSet.has(name)) {
      const acc = byLine.get(name) ?? { bs: 0, usd: null };
      addInto(acc, l.sales);
      byLine.set(name, acc);
    } else {
      addInto(other, l.sales);
    }
  }
  if (total <= 0) return [];
  const segments: MixSegment[] = visible
    .filter(name => byLine.has(name))
    .map(name => ({ line: name, share: byLine.get(name)!.bs / total, sales: byLine.get(name)! }));
  if (other.bs > 0) segments.push({ line: OTHER_LINE_LABEL, share: other.bs / total, sales: other });
  return segments;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/seguimiento/quotas.test.ts __tests__/unit/seguimiento/category-mix.test.ts`
Expected: PASS. (If `0.6/0.2/0.2` fails on float equality, the sums 600/1000 etc. are exact in IEEE; no change needed.)

- [ ] **Step 5: Commit**

```bash
git add lib/seguimiento/quotas.ts lib/seguimiento/category-mix.ts __tests__/unit/seguimiento/quotas.test.ts __tests__/unit/seguimiento/category-mix.test.ts
git commit -m "feat(seguimiento): quota roll-up, quota-bar geometry and category mix helpers" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 4: Response types and the pure root aggregation (`buildSeguimiento`)

**Files:**
- Create: `lib/seguimiento/types.ts`, `lib/seguimiento/aggregate.ts`, `__tests__/unit/seguimiento/fixture.ts` (shared fixture, not a test file)
- Test: `__tests__/unit/seguimiento/aggregate.test.ts`

**Interfaces:**
- Consumes: `monthBounds`, `monthPace`, `projectToMonth`, `MonthPace` (Task 1); `isoWeeksOfMonth` (Task 1); `visitCompliance`, `summarizeCompliance`, `VisitCompliance`, `ComplianceSummary` (Task 2); `rollUpQuotas`, `SellerTargets` (Task 3); `chooseVisibleLines`, `bucketCategoryMix`, `MixSegment`, `Dual` (Task 3).
- Produces (all exported from `types.ts` unless noted):
```ts
export type { Dual } from './category-mix';
export type RootKind = 'vendedor' | 'ruta' | 'grupo';
export function parseRootKind(v: string | null): RootKind;

export interface WeekHeader { yearWeek: string; weekStart: string; weekEnd: string; label: string; isFuture: boolean }
export interface WeekCell { yearWeek: string; active: number; assigned: number; pct: number | null }   // pct null: future week or nobody assigned
export interface NewCustomersInfo { count: number; quota: number | null; partial: boolean }

export interface RootMetrics {
  customerCount: number;              // assigned: current, not inactive, not a consignment-root code
  sellerKeys: string[];
  sales: Dual; units: number; avgPrice: Dual | null;      // avgPrice = sales / units, null when units = 0
  excludedSales: Dual;                // sales to consignment-root codes, kept out of `sales`
  salesQuotaUsd: number | null; quotaPartial: boolean; quotaShared: boolean;
  attainment: number | null;          // sales.usd / quota
  projected: Dual | null;             // null when no working day has elapsed
  projectedAttainment: number | null; // projected.usd / quota
  weeklyVisitQuota: number | null;
  weeks: WeekCell[];                  // aligned 1:1 with SeguimientoResponse.weeks
  mix: MixSegment[];
  newCustomers: NewCustomersInfo;
  compliance: ComplianceSummary;
}
export interface SeguimientoCustomer {
  customerCode: string; customerName: string;
  salesRepName: string | null; routeLabel: string | null; groupLabel: string | null;
  sales: Dual; units: number; avgPrice: Dual | null;
  activeWeeks: string[];              // yearWeek values with >= 1 invoice
  mix: MixSegment[]; isNew: boolean; lastInvoiceDate: string | null; visit: VisitCompliance;
}
export interface SeguimientoRoot extends RootMetrics {
  value: string;                      // salesRepKey | zoneCode | ErpSegmentCode | 'sin-vendedor' | 'sin-ruta' | 'sin-grupo'
  label: string;
  salesRepKey: string | null;         // set on vendedor roots with a real seller
  targets: SellerTargets | null;      // same, for inline quota editing (null = no row yet)
  customers: SeguimientoCustomer[];   // sorted by sales (Bs) desc
}
export interface SeguimientoResponse {
  kind: RootKind; month: string; monthStart: string; monthEnd: string; asOf: string;
  pace: MonthPace; weeks: WeekHeader[]; visibleLines: string[];
  total: RootMetrics; roots: SeguimientoRoot[];
}
export interface SeguimientoInvoiceLine { invoiceNumber: string; invoiceDate: string; lineNumber: number; productCode: string; productName: string; lineName: string | null; quantity: number; amount: Dual; unitPrice: Dual | null }
export interface SeguimientoLinesResponse { lines: SeguimientoInvoiceLine[] }
export interface SeguimientoExcludedInvoice { customerCode: string; customerName: string; invoiceNumber: string; invoiceDate: string; amountNet: Dual }
export interface SeguimientoExcludedResponse { invoices: SeguimientoExcludedInvoice[] }
```
and in `aggregate.ts`:
```ts
export interface CustomerFact {
  customerCode: string; customerName: string; isInactive: boolean;
  salesRepKey: string | null; salesRepName: string | null;
  zoneCode: string | null; routeNumber: number | null;
  segmentCode: string | null; segmentName: string | null;           // segmentCode = ErpSegmentCode
  registeredDate: string | null; isMigrationBatch: boolean;
  visitIntervalDays: number | null; lastInvoiceDate: string | null;  // last invoice on or before asOf
}
export type RootableCustomer = Pick<CustomerFact, 'salesRepKey' | 'salesRepName' | 'zoneCode' | 'routeNumber' | 'segmentCode' | 'segmentName'>;
export interface CustomerLineSales { customerCode: string; line: string | null; units: number; sales: Dual }
export interface CustomerWeekActivity { customerCode: string; yearWeek: string }
export interface SeguimientoInput {
  kind: RootKind; month: string; asOf: string;
  customers: CustomerFact[]; lineSales: CustomerLineSales[]; weekActivity: CustomerWeekActivity[];
  consignmentRootCodes: string[]; targets: ReadonlyMap<string, SellerTargets>;
}
export const NO_SELLER = 'sin-vendedor'; export const NO_ROUTE = 'sin-ruta'; export const NO_GROUP = 'sin-grupo';
export function rootOf(kind: RootKind, c: RootableCustomer): { value: string; label: string };
export function buildSeguimiento(input: SeguimientoInput): Pick<SeguimientoResponse, 'pace' | 'weeks' | 'visibleLines' | 'total' | 'roots'>;
```
Definitions implemented here (spec): a customer belongs to the root given by its CURRENT `Dim_Customer` row (seller = `DefaultSalesRepCode`; route = `ZoneCode` when it is a route zone; group = `ErpSegmentCode`). **Active in a week** = at least one invoice that ISO week (whole week, even days before the 1st) from a customer assigned to the root; denominator = assigned customers. `isNew` = `!isMigrationBatch && registeredDate` inside the month. Totals sum customers across roots once; the total quota is the sum over distinct sellers (never the sum of root quotas, which would double count a seller with several routes). `quotaShared` (route/group roots only) = any of the root's sellers also appears in another root of the same kind; the UI then marks the quota as "compartida".

- [ ] **Step 1: Write the shared fixture and the failing test**

`__tests__/unit/seguimiento/fixture.ts` (consumed by Tasks 4, 6, 9, 10):
```ts
import { buildSeguimiento, type CustomerFact, type CustomerLineSales, type CustomerWeekActivity, type SeguimientoInput } from '../../../lib/seguimiento/aggregate';
import { monthBounds } from '../../../lib/seguimiento/month-pace';
import type { RootKind, SeguimientoInvoiceLine, SeguimientoResponse } from '../../../lib/seguimiento/types';
import type { SellerTargets } from '../../../lib/seguimiento/quotas';

export const FIXTURE_MONTH = '2026-10';
export const FIXTURE_AS_OF = '2026-10-14'; // Wednesday: 10 of 22 working days elapsed

const cust = (o: Partial<CustomerFact> & Pick<CustomerFact, 'customerCode' | 'customerName'>): CustomerFact => ({
  isInactive: false, salesRepKey: null, salesRepName: null, zoneCode: null, routeNumber: null,
  segmentCode: null, segmentName: null, registeredDate: '2020-05-10', isMigrationBatch: false,
  visitIntervalDays: null, lastInvoiceDate: null, ...o,
});

export const FIXTURE_CUSTOMERS: CustomerFact[] = [
  cust({ customerCode: 'C1', customerName: 'Cliente Uno', salesRepKey: '1', salesRepName: 'Ana', zoneCode: 'CCS003', routeNumber: 3,
    segmentCode: 'S1', segmentName: 'Abasto', registeredDate: '2026-10-02', visitIntervalDays: 7, lastInvoiceDate: '2026-10-12' }),
  cust({ customerCode: 'C2', customerName: 'Cliente Dos', salesRepKey: '1', salesRepName: 'Ana', zoneCode: 'CCS003', routeNumber: 3,
    segmentCode: 'S1', segmentName: 'Abasto', registeredDate: '2026-03-28', isMigrationBatch: true, visitIntervalDays: 7, lastInvoiceDate: '2026-09-20' }),
  cust({ customerCode: 'C3', customerName: 'Cliente Tres', salesRepKey: '2', salesRepName: 'Beto', zoneCode: 'CCS004', routeNumber: 4,
    segmentCode: 'S2', segmentName: 'Restaurante' }),
  cust({ customerCode: 'C4', customerName: 'Cadena Raiz', salesRepKey: '2', salesRepName: 'Beto', zoneCode: 'CCS004', routeNumber: 4,
    segmentCode: 'S2', segmentName: 'Restaurante' }),                                  // consignment root code
  cust({ customerCode: 'C5', customerName: 'Cliente Inactivo', isInactive: true, salesRepKey: '2', salesRepName: 'Beto',
    zoneCode: 'CCS004', routeNumber: 4, segmentCode: 'S2', segmentName: 'Restaurante' }),
];

const sale = (customerCode: string, line: string | null, units: number, bs: number, usd: number | null): CustomerLineSales =>
  ({ customerCode, line, units, sales: { bs, usd } });

export const FIXTURE_LINE_SALES: CustomerLineSales[] = [
  sale('C1', 'Panaderia', 10, 1000, 20), sale('C1', 'Pizza', 5, 500, 10),
  sale('C2', 'Panaderia', 20, 2000, 40),
  sale('C3', 'Pasteleria', 4, 400, 8),
  sale('C4', 'Panaderia', 100, 9000, 180),
];

export const FIXTURE_WEEK_ACTIVITY: CustomerWeekActivity[] = [
  { customerCode: 'C1', yearWeek: '2026-W41' }, { customerCode: 'C1', yearWeek: '2026-W42' },
  { customerCode: 'C2', yearWeek: '2026-W41' }, { customerCode: 'C4', yearWeek: '2026-W41' },
];

export const FIXTURE_TARGETS = new Map<string, SellerTargets>([
  ['1', { salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: 1 }],
  ['2', { salesQuotaUsd: 50, weeklyVisitQuota: null, newCustomerQuota: null }],
]);

export const FIXTURE_CONSIGNMENT_ROOTS = ['C4'];

export function fixtureInput(kind: RootKind): SeguimientoInput {
  return {
    kind, month: FIXTURE_MONTH, asOf: FIXTURE_AS_OF,
    customers: FIXTURE_CUSTOMERS, lineSales: FIXTURE_LINE_SALES, weekActivity: FIXTURE_WEEK_ACTIVITY,
    consignmentRootCodes: FIXTURE_CONSIGNMENT_ROOTS, targets: FIXTURE_TARGETS,
  };
}

export function fixtureResponse(kind: RootKind): SeguimientoResponse {
  const { start, end } = monthBounds(FIXTURE_MONTH);
  return { kind, month: FIXTURE_MONTH, monthStart: start, monthEnd: end, asOf: FIXTURE_AS_OF, ...buildSeguimiento(fixtureInput(kind)) };
}

export const FIXTURE_INVOICE_LINES: SeguimientoInvoiceLine[] = [
  { invoiceNumber: 'F000101', invoiceDate: '2026-10-13', lineNumber: 1, productCode: 'P-PIZ', productName: 'Pizza Familiar', lineName: 'Pizza',
    quantity: 5, amount: { bs: 500, usd: 10 }, unitPrice: { bs: 100, usd: 2 } },
  { invoiceNumber: 'F000100', invoiceDate: '2026-10-05', lineNumber: 1, productCode: 'P-PAN', productName: 'Pan Baguette', lineName: 'Panaderia',
    quantity: 10, amount: { bs: 1000, usd: 20 }, unitPrice: { bs: 100, usd: 2 } },
];
```

`__tests__/unit/seguimiento/aggregate.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import { buildSeguimiento, rootOf } from '../../../lib/seguimiento/aggregate';
import { parseRootKind } from '../../../lib/seguimiento/types';
import { FIXTURE_CUSTOMERS, fixtureInput } from './fixture';

describe('parseRootKind / rootOf', () => {
  test('unknown kinds fall back to vendedor', () => {
    expect(parseRootKind('ruta')).toBe('ruta');
    expect(parseRootKind('grupo')).toBe('grupo');
    expect(parseRootKind('x')).toBe('vendedor');
    expect(parseRootKind(null)).toBe('vendedor');
  });
  test('roots for customers without seller, route or group', () => {
    const blank = { salesRepKey: null, salesRepName: null, zoneCode: 'CCS', routeNumber: null, segmentCode: null, segmentName: null };
    expect(rootOf('vendedor', blank)).toEqual({ value: 'sin-vendedor', label: 'Sin vendedor' });
    expect(rootOf('ruta', blank)).toEqual({ value: 'sin-ruta', label: 'Sin ruta' });      // 'CCS' is a region, not a route
    expect(rootOf('grupo', blank)).toEqual({ value: 'sin-grupo', label: 'Sin grupo' });
  });
});

describe('buildSeguimiento: vendedor roots', () => {
  const out = buildSeguimiento(fixtureInput('vendedor'));
  const ana = out.roots.find(r => r.label === 'Ana')!;
  const beto = out.roots.find(r => r.label === 'Beto')!;

  test('pace, weeks and visible lines', () => {
    expect(out.pace).toMatchObject({ workingDaysInMonth: 22, workingDaysElapsed: 10 });
    expect(out.weeks.map(w => [w.yearWeek, w.isFuture])).toEqual([
      ['2026-W40', false], ['2026-W41', false], ['2026-W42', false], ['2026-W43', true], ['2026-W44', true],
    ]);
    expect(out.visibleLines).toEqual(['Panaderia', 'Pizza', 'Pasteleria']); // consignment sales do not rank lines
  });

  test('roots are sorted by sales (Bs) desc', () => {
    expect(out.roots.map(r => r.label)).toEqual(['Ana', 'Beto']);
  });

  test('Ana: sales, units, average price, quota, attainment and projection', () => {
    expect(ana.customerCount).toBe(2);
    expect(ana.sales).toEqual({ bs: 3500, usd: 70 });
    expect(ana.units).toBe(35);
    expect(ana.avgPrice).toEqual({ bs: 100, usd: 2 });
    expect(ana.salesQuotaUsd).toBe(100);
    expect(ana.attainment).toBeCloseTo(0.7, 10);
    expect(ana.projected!.usd).toBeCloseTo(154, 10);
    expect(ana.projectedAttainment).toBeCloseTo(1.54, 10);
    expect(ana.quotaShared).toBe(false);
    expect(ana.salesRepKey).toBe('1');
    expect(ana.targets).toEqual({ salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: 1 });
  });

  test('Ana: weekly activation counts customers with an invoice that ISO week; future weeks have no pct', () => {
    expect(ana.weeks).toEqual([
      { yearWeek: '2026-W40', active: 0, assigned: 2, pct: 0 },
      { yearWeek: '2026-W41', active: 2, assigned: 2, pct: 1 },
      { yearWeek: '2026-W42', active: 1, assigned: 2, pct: 0.5 },
      { yearWeek: '2026-W43', active: 0, assigned: 2, pct: null },
      { yearWeek: '2026-W44', active: 0, assigned: 2, pct: null },
    ]);
  });

  test('Ana: category mix, new customers and visit compliance', () => {
    expect(ana.mix.map(m => [m.line, Number(m.share.toFixed(4))])).toEqual([['Panaderia', 0.8571], ['Pizza', 0.1429]]);
    expect(ana.newCustomers).toEqual({ count: 1, quota: 1, partial: false });     // C1 registered in October; C2 is the migration batch
    expect(ana.compliance).toMatchObject({ total: 2, ok: 1, overdue: 1, complianceRate: 0.5 });
  });

  test('Ana customers: sorted by sales, flags and visit status', () => {
    expect(ana.customers.map(c => c.customerCode)).toEqual(['C2', 'C1']);
    const c1 = ana.customers.find(c => c.customerCode === 'C1')!;
    expect(c1).toMatchObject({ isNew: true, routeLabel: 'Ruta 3', groupLabel: 'Abasto', activeWeeks: ['2026-W41', '2026-W42'] });
    expect(c1.visit.status).toBe('ok');
    expect(ana.customers.find(c => c.customerCode === 'C2')!.visit).toMatchObject({ status: 'overdue', daysOverdue: 17 });
  });

  test('Beto: consignment root sales are excluded, inactive customers do not count, no frequency means no overdue', () => {
    expect(beto.customerCount).toBe(1);                       // C3 only (C4 consignment, C5 inactive)
    expect(beto.sales).toEqual({ bs: 400, usd: 8 });
    expect(beto.excludedSales).toEqual({ bs: 9000, usd: 180 });
    expect(beto.customers.map(c => c.customerCode)).toEqual(['C3']);
    expect(beto.attainment).toBeCloseTo(0.16, 10);
    expect(beto.compliance).toMatchObject({ noInterval: 1, overdue: 0, complianceRate: null });
    expect(beto.newCustomers).toEqual({ count: 0, quota: null, partial: false });
    expect(beto.weeks[1]).toMatchObject({ assigned: 1, active: 0 });       // C4's W41 invoice is not C3's
  });

  test('total counts every customer once and sums quotas over distinct sellers', () => {
    expect(out.total.customerCount).toBe(3);
    expect(out.total.sales).toEqual({ bs: 3900, usd: 78 });
    expect(out.total.excludedSales).toEqual({ bs: 9000, usd: 180 });
    expect(out.total.salesQuotaUsd).toBe(150);
    expect(out.total.weeks[1]).toMatchObject({ active: 2, assigned: 3 });
    expect(out.total.newCustomers).toEqual({ count: 1, quota: 1, partial: true });
    expect(out.total.compliance).toMatchObject({ total: 3, ok: 1, overdue: 1, noInterval: 1 });
  });
});

describe('buildSeguimiento: route and group roots', () => {
  test('route roots follow the customer\'s current zone and label Ruta N', () => {
    const out = buildSeguimiento(fixtureInput('ruta'));
    expect(out.roots.map(r => [r.value, r.label, r.customerCount])).toEqual([['CCS003', 'Ruta 3', 2], ['CCS004', 'Ruta 4', 1]]);
    expect(out.roots.every(r => r.salesRepKey === null && r.targets === null)).toBe(true);
    expect(out.roots[1].excludedSales).toEqual({ bs: 9000, usd: 180 });
  });

  test('a seller serving two routes marks both route quotas as shared', () => {
    const extra = { ...FIXTURE_CUSTOMERS[0], customerCode: 'C6', customerName: 'Otro', zoneCode: 'CCS004', routeNumber: 4, registeredDate: '2020-01-01' };
    const input = fixtureInput('ruta');
    const out = buildSeguimiento({ ...input, customers: [...input.customers, extra] });
    expect(out.roots.map(r => r.quotaShared)).toEqual([true, true]);
    expect(out.roots[1].salesQuotaUsd).toBe(150);           // sellers 2 and 1
    expect(out.total.salesQuotaUsd).toBe(150);              // total never double counts
  });

  test('group roots use the ERP segment', () => {
    const out = buildSeguimiento(fixtureInput('grupo'));
    expect(out.roots.map(r => [r.label, r.customerCount])).toEqual([['Abasto', 2], ['Restaurante', 1]]);
    expect(out.roots[0].salesQuotaUsd).toBe(100);
  });
});

describe('buildSeguimiento: degenerate input', () => {
  test('no data: empty roots, zero total, no NaN', () => {
    const out = buildSeguimiento({ ...fixtureInput('vendedor'), customers: [], lineSales: [], weekActivity: [], consignmentRootCodes: [] });
    expect(out.roots).toEqual([]);
    expect(out.total).toMatchObject({ customerCount: 0, sales: { bs: 0, usd: 0 }, avgPrice: null, attainment: null, mix: [] });
    expect(out.total.weeks.every(w => w.pct === null)).toBe(true);
  });

  test('usd null (no exchange rate) keeps usd null: no attainment, no projection usd', () => {
    const input = fixtureInput('vendedor');
    const lineSales = input.lineSales.map(l => ({ ...l, sales: { bs: l.sales.bs, usd: null } }));
    const ana = buildSeguimiento({ ...input, lineSales }).roots.find(r => r.label === 'Ana')!;
    expect(ana.sales.usd).toBeNull();
    expect(ana.attainment).toBeNull();
    expect(ana.projected!.usd).toBeNull();
    expect(ana.projectedAttainment).toBeNull();
    expect(ana.avgPrice!.usd).toBeNull();
  });

  test('a zero quota is treated as no goal (no division by zero)', () => {
    const input = fixtureInput('vendedor');
    const targets = new Map(input.targets).set('1', { salesQuotaUsd: 0, weeklyVisitQuota: null, newCustomerQuota: null });
    const ana = buildSeguimiento({ ...input, targets }).roots.find(r => r.label === 'Ana')!;
    expect(ana.salesQuotaUsd).toBe(0);
    expect(ana.attainment).toBeNull();
    expect(ana.projectedAttainment).toBeNull();
  });

  test('asOf before the month (and before its first ISO week): nothing elapsed, projection null, every week is future', () => {
    const ana = buildSeguimiento({ ...fixtureInput('vendedor'), asOf: '2026-09-27' }).roots.find(r => r.label === 'Ana')!;
    expect(ana.projected).toBeNull();
    expect(ana.weeks.every(w => w.pct === null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/seguimiento/aggregate.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`lib/seguimiento/types.ts`:
```ts
import type { MonthPace } from './month-pace';
import type { MixSegment, Dual } from './category-mix';
import type { SellerTargets } from './quotas';
import type { ComplianceSummary, VisitCompliance } from './visit-compliance';

export type { Dual } from './category-mix';

export type RootKind = 'vendedor' | 'ruta' | 'grupo';

export function parseRootKind(v: string | null): RootKind {
  return v === 'ruta' || v === 'grupo' ? v : 'vendedor';
}

export interface WeekHeader { yearWeek: string; weekStart: string; weekEnd: string; label: string; isFuture: boolean }
export interface WeekCell { yearWeek: string; active: number; assigned: number; pct: number | null }
export interface NewCustomersInfo { count: number; quota: number | null; partial: boolean }

export interface RootMetrics {
  customerCount: number;
  sellerKeys: string[];
  sales: Dual;
  units: number;
  avgPrice: Dual | null;
  excludedSales: Dual;
  salesQuotaUsd: number | null;
  quotaPartial: boolean;
  quotaShared: boolean;
  attainment: number | null;
  projected: Dual | null;
  projectedAttainment: number | null;
  weeklyVisitQuota: number | null;
  weeks: WeekCell[];
  mix: MixSegment[];
  newCustomers: NewCustomersInfo;
  compliance: ComplianceSummary;
}

export interface SeguimientoCustomer {
  customerCode: string;
  customerName: string;
  salesRepName: string | null;
  routeLabel: string | null;
  groupLabel: string | null;
  sales: Dual;
  units: number;
  avgPrice: Dual | null;
  activeWeeks: string[];
  mix: MixSegment[];
  isNew: boolean;
  lastInvoiceDate: string | null;
  visit: VisitCompliance;
}

export interface SeguimientoRoot extends RootMetrics {
  value: string;
  label: string;
  salesRepKey: string | null;
  targets: SellerTargets | null;
  customers: SeguimientoCustomer[];
}

export interface SeguimientoResponse {
  kind: RootKind;
  month: string;
  monthStart: string;
  monthEnd: string;
  asOf: string;
  pace: MonthPace;
  weeks: WeekHeader[];
  visibleLines: string[];
  total: RootMetrics;
  roots: SeguimientoRoot[];
}

export interface SeguimientoInvoiceLine {
  invoiceNumber: string;
  invoiceDate: string;
  lineNumber: number;
  productCode: string;
  productName: string;
  lineName: string | null;
  quantity: number;
  amount: Dual;
  unitPrice: Dual | null;
}
export interface SeguimientoLinesResponse { lines: SeguimientoInvoiceLine[] }

export interface SeguimientoExcludedInvoice {
  customerCode: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  amountNet: Dual;
}
export interface SeguimientoExcludedResponse { invoices: SeguimientoExcludedInvoice[] }
```

`lib/seguimiento/aggregate.ts`:
```ts
import { bucketCategoryMix, chooseVisibleLines, type LineAmount } from './category-mix';
import { isoWeeksOfMonth } from './iso-weeks';
import { monthBounds, monthPace, projectToMonth, type MonthPace } from './month-pace';
import { rollUpQuotas, type SellerTargets } from './quotas';
import type {
  Dual, RootKind, RootMetrics, SeguimientoCustomer, SeguimientoResponse, SeguimientoRoot, WeekHeader,
} from './types';
import { summarizeCompliance, visitCompliance } from './visit-compliance';

export const NO_SELLER = 'sin-vendedor';
export const NO_ROUTE = 'sin-ruta';
export const NO_GROUP = 'sin-grupo';

export interface CustomerFact {
  customerCode: string;
  customerName: string;
  isInactive: boolean;
  salesRepKey: string | null;
  salesRepName: string | null;
  zoneCode: string | null;
  routeNumber: number | null;
  segmentCode: string | null;
  segmentName: string | null;
  registeredDate: string | null;
  isMigrationBatch: boolean;
  visitIntervalDays: number | null;
  lastInvoiceDate: string | null;
}
export type RootableCustomer = Pick<CustomerFact, 'salesRepKey' | 'salesRepName' | 'zoneCode' | 'routeNumber' | 'segmentCode' | 'segmentName'>;

export interface CustomerLineSales { customerCode: string; line: string | null; units: number; sales: Dual }
export interface CustomerWeekActivity { customerCode: string; yearWeek: string }

export interface SeguimientoInput {
  kind: RootKind;
  month: string;
  asOf: string;
  customers: CustomerFact[];
  lineSales: CustomerLineSales[];
  weekActivity: CustomerWeekActivity[];
  consignmentRootCodes: string[];
  targets: ReadonlyMap<string, SellerTargets>;
}

// A customer belongs to the root given by its CURRENT Dim_Customer row (the queries resolve the
// current row by CustomerCode, so invoices issued under an older SCD2 version follow the customer).
export function rootOf(kind: RootKind, c: RootableCustomer): { value: string; label: string } {
  if (kind === 'vendedor') {
    return c.salesRepKey
      ? { value: c.salesRepKey, label: c.salesRepName ?? `Vendedor ${c.salesRepKey}` }
      : { value: NO_SELLER, label: 'Sin vendedor' };
  }
  if (kind === 'ruta') {
    return c.routeNumber != null && c.zoneCode
      ? { value: c.zoneCode, label: `Ruta ${c.routeNumber}` }
      : { value: NO_ROUTE, label: 'Sin ruta' };
  }
  return c.segmentCode
    ? { value: c.segmentCode, label: c.segmentName ?? c.segmentCode }
    : { value: NO_GROUP, label: 'Sin grupo' };
}

// USD ignores null rows and is null only when every row is null (same convention as sumDual).
function sumDuals(items: readonly Dual[]): Dual {
  if (items.length === 0) return { bs: 0, usd: 0 };
  const withUsd = items.filter(i => i.usd !== null);
  return {
    bs: items.reduce((s, i) => s + i.bs, 0),
    usd: withUsd.length === 0 ? null : withUsd.reduce((s, i) => s + (i.usd as number), 0),
  };
}

function avgPriceOf(sales: Dual, units: number): Dual | null {
  if (!(units > 0)) return null;
  return { bs: sales.bs / units, usd: sales.usd === null ? null : sales.usd / units };
}

interface Row {
  fact: CustomerFact;
  consignment: boolean;
  assigned: boolean;
  lines: CustomerLineSales[];
  active: Set<string>;
  sales: Dual;
  units: number;
}

interface Ctx {
  month: string;
  monthStart: string;
  monthEnd: string;
  asOf: string;
  pace: MonthPace;
  headers: WeekHeader[];
  visible: string[];
  targets: ReadonlyMap<string, SellerTargets>;
}

function isNew(c: CustomerFact, ctx: Ctx): boolean {
  return !c.isMigrationBatch && c.registeredDate !== null && c.registeredDate >= ctx.monthStart && c.registeredDate <= ctx.monthEnd;
}

function toLineAmounts(rows: readonly Row[]): LineAmount[] {
  return rows.flatMap(r => r.lines.map(l => ({ line: l.line, sales: l.sales })));
}

function buildMetrics(rows: Row[], sellerKeys: string[], shared: boolean, ctx: Ctx): RootMetrics {
  const counted = rows.filter(r => !r.consignment);
  const assigned = counted.filter(r => r.assigned);
  const sales = sumDuals(counted.map(r => r.sales));
  const units = counted.reduce((s, r) => s + r.units, 0);
  const quota = rollUpQuotas(sellerKeys, ctx.targets);
  const quotaUsd = quota.salesQuotaUsd;
  const hasGoal = quotaUsd !== null && quotaUsd > 0;
  const projectedBs = projectToMonth(sales.bs, ctx.pace);
  const projected: Dual | null = projectedBs === null ? null : { bs: projectedBs, usd: projectToMonth(sales.usd, ctx.pace) };
  return {
    customerCount: assigned.length,
    sellerKeys,
    sales, units,
    avgPrice: avgPriceOf(sales, units),
    excludedSales: sumDuals(rows.filter(r => r.consignment).map(r => r.sales)),
    salesQuotaUsd: quotaUsd,
    quotaPartial: quota.partial.sales,
    quotaShared: shared,
    attainment: hasGoal && sales.usd !== null ? sales.usd / quotaUsd : null,
    projected,
    projectedAttainment: hasGoal && projected?.usd != null ? projected.usd / quotaUsd : null,
    weeklyVisitQuota: quota.weeklyVisitQuota,
    weeks: ctx.headers.map(h => {
      const active = h.isFuture ? 0 : assigned.filter(r => r.active.has(h.yearWeek)).length;
      return {
        yearWeek: h.yearWeek, active, assigned: assigned.length,
        pct: h.isFuture || assigned.length === 0 ? null : active / assigned.length,
      };
    }),
    mix: bucketCategoryMix(toLineAmounts(counted), ctx.visible),
    newCustomers: {
      count: assigned.filter(r => isNew(r.fact, ctx)).length,
      quota: quota.newCustomerQuota,
      partial: quota.partial.newCustomers,
    },
    compliance: summarizeCompliance(assigned.map(r => visitCompliance({
      lastInvoiceDate: r.fact.lastInvoiceDate, intervalDays: r.fact.visitIntervalDays, asOf: ctx.asOf,
    }))),
  };
}

function toCustomer(r: Row, ctx: Ctx): SeguimientoCustomer {
  return {
    customerCode: r.fact.customerCode,
    customerName: r.fact.customerName,
    salesRepName: r.fact.salesRepName,
    routeLabel: r.fact.routeNumber != null ? `Ruta ${r.fact.routeNumber}` : null,
    groupLabel: r.fact.segmentName,
    sales: r.sales, units: r.units, avgPrice: avgPriceOf(r.sales, r.units),
    activeWeeks: ctx.headers.map(h => h.yearWeek).filter(w => r.active.has(w)),
    mix: bucketCategoryMix(toLineAmounts([r]), ctx.visible),
    isNew: isNew(r.fact, ctx),
    lastInvoiceDate: r.fact.lastInvoiceDate,
    visit: visitCompliance({ lastInvoiceDate: r.fact.lastInvoiceDate, intervalDays: r.fact.visitIntervalDays, asOf: ctx.asOf }),
  };
}

function distinctSellerKeys(rows: readonly Row[]): string[] {
  return [...new Set(rows.filter(r => !r.consignment).map(r => r.fact.salesRepKey).filter((k): k is string => k !== null))];
}

export function buildSeguimiento(
  input: SeguimientoInput,
): Pick<SeguimientoResponse, 'pace' | 'weeks' | 'visibleLines' | 'total' | 'roots'> {
  const { start, end } = monthBounds(input.month);
  const pace = monthPace(input.month, input.asOf);
  const headers: WeekHeader[] = isoWeeksOfMonth(input.month).map(w => ({ ...w, isFuture: w.weekStart > input.asOf }));
  const flagged = new Set(input.consignmentRootCodes.map(c => c.trim()));

  const linesBy = new Map<string, CustomerLineSales[]>();
  for (const l of input.lineSales) linesBy.set(l.customerCode, [...(linesBy.get(l.customerCode) ?? []), l]);
  const activeBy = new Map<string, Set<string>>();
  for (const a of input.weekActivity) {
    const set = activeBy.get(a.customerCode) ?? new Set<string>();
    set.add(a.yearWeek);
    activeBy.set(a.customerCode, set);
  }

  const allRows: Row[] = input.customers.map(fact => {
    const lines = linesBy.get(fact.customerCode) ?? [];
    const consignment = flagged.has(fact.customerCode);
    return {
      fact, consignment, lines,
      assigned: !fact.isInactive && !consignment,
      active: activeBy.get(fact.customerCode) ?? new Set<string>(),
      sales: sumDuals(lines.map(l => l.sales)),
      units: lines.reduce((s, l) => s + l.units, 0),
    };
  });
  // Irrelevant rows: inactive customers (or consignment roots) with no sales this month.
  const rows = allRows.filter(r => r.assigned || r.lines.length > 0);

  const visible = chooseVisibleLines(toLineAmounts(rows.filter(r => !r.consignment)));
  const ctx: Ctx = { month: input.month, monthStart: start, monthEnd: end, asOf: input.asOf, pace, headers, visible, targets: input.targets };

  const groups = new Map<string, { label: string; rows: Row[] }>();
  for (const r of rows) {
    const { value, label } = rootOf(input.kind, r.fact);
    const g = groups.get(value) ?? { label, rows: [] };
    g.rows.push(r);
    groups.set(value, g);
  }

  const sellerRootCount = new Map<string, number>();
  for (const g of groups.values()) for (const k of distinctSellerKeys(g.rows)) sellerRootCount.set(k, (sellerRootCount.get(k) ?? 0) + 1);

  const roots: SeguimientoRoot[] = [...groups].map(([value, g]) => {
    const sellerKeys = distinctSellerKeys(g.rows);
    const shared = input.kind !== 'vendedor' && sellerKeys.some(k => (sellerRootCount.get(k) ?? 0) > 1);
    const realSeller = input.kind === 'vendedor' && value !== NO_SELLER ? value : null;
    return {
      ...buildMetrics(g.rows, sellerKeys, shared, ctx),
      value, label: g.label,
      salesRepKey: realSeller,
      targets: realSeller ? (input.targets.get(realSeller) ?? null) : null,
      customers: g.rows.filter(r => !r.consignment)
        .sort((a, b) => b.sales.bs - a.sales.bs || a.fact.customerName.localeCompare(b.fact.customerName))
        .map(r => toCustomer(r, ctx)),
    };
  });

  roots.sort((a, b) => {
    const tail = (r: SeguimientoRoot) => (r.value === NO_SELLER || r.value === NO_ROUTE || r.value === NO_GROUP ? 1 : 0);
    if (tail(a) !== tail(b)) return tail(a) - tail(b);
    if (input.kind === 'ruta') return a.label.localeCompare(b.label, 'es', { numeric: true });
    return b.sales.bs - a.sales.bs || a.label.localeCompare(b.label, 'es');
  });

  return {
    pace, weeks: headers, visibleLines: visible,
    total: buildMetrics(rows, distinctSellerKeys(rows), false, ctx),
    roots,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/seguimiento/`
Expected: PASS (all Task 1-4 tests). If the `Beto` weeks assertion fails, re-check that consignment rows are excluded from `assigned` AND from `active` counting (they are: `assigned` requires `!consignment`).

- [ ] **Step 5: Commit**

```bash
git add lib/seguimiento/types.ts lib/seguimiento/aggregate.ts __tests__/unit/seguimiento/fixture.ts __tests__/unit/seguimiento/aggregate.test.ts
git commit -m "feat(seguimiento): response types and pure root aggregation" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 5: SQL layer (`queries.ts`), `seller_targets` reader and disposable-DWH integration test

**Files:**
- Create: `lib/seguimiento/queries.ts`, `lib/seguimiento/targets-repo.ts`
- Test: `scripts/dwh/__tests__/seguimiento-queries.test.ts` (disposable DWH), `__tests__/unit/seguimiento/targets-repo.test.ts`

**Interfaces:**
- Consumes: `buildDateWhereClause`, `dualAmountExpr`, `usdConversionJoin` (`app/api/dwh/lib/query-builder.ts`); `CustomerFact`, `CustomerLineSales`, `CustomerWeekActivity` (Task 4); `SeguimientoInvoiceLine`, `SeguimientoExcludedInvoice`, `Dual` (Task 4); `SellerTargets` (Task 3); `sellerTargets` table (`lib/db/schema.ts`); `AppDb` (`lib/geo/routes-repo.ts`); `makeMemoryDb` (`__tests__/helpers/memory-db.ts`); plan A's `dim.Dim_Zone`, `dim.Dim_Segment` and `Dim_Customer` columns (`ErpSegmentCode`, `RegisteredDate`, `IsMigrationBatch`, `VisitIntervalDays`), via `runDwhMigrations` from `scripts/migrate-dwh.ts`.
- Produces:
```ts
// queries.ts  (pool = the mssql ConnectionPool from getDwhPool())
export function dateKeyToIso(key: number): string;
export function fetchCustomers(pool: sql.ConnectionPool, asOf: string): Promise<CustomerFact[]>;
export function fetchLineSales(pool: sql.ConnectionPool, month: string): Promise<CustomerLineSales[]>;
export function fetchWeekActivity(pool: sql.ConnectionPool, from: string, to: string): Promise<CustomerWeekActivity[]>;
export function fetchCustomerInvoiceLines(pool: sql.ConnectionPool, customerCode: string, month: string): Promise<SeguimientoInvoiceLine[]>;
export function fetchExcludedInvoices(pool: sql.ConnectionPool, month: string, customerCodes: string[]): Promise<SeguimientoExcludedInvoice[]>;
// targets-repo.ts
export function readTargetsForMonth(db: AppDb, month: string): Map<string, SellerTargets>;   // key = salesRepKey as stored (string)
```
Attribution rule (Review Focus 1): every sales query joins `Fact_Sales -> Dim_Customer c (by CustomerKey, any SCD2 version) -> Dim_Customer cur (same CustomerCode, IsCurrent = 1)` and groups by `cur.CustomerCode`; the customer list is the `IsCurrent = 1` rows. `LastInvoice` = latest non-voided invoice date with `DateKey <= asOfKey` over all history in `fact.Fact_Sales` (the legacy snapshot tables use different customer ids and are intentionally not read). Window strings come from `buildDateWhereClause` with values asserted against `^\d{4}-(0[1-9]|1[0-2])$` / `^\d{4}-\d{2}-\d{2}$` first.

- [ ] **Step 1: Write the failing tests**

`__tests__/unit/seguimiento/targets-repo.test.ts`:
```ts
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
```

`scripts/dwh/__tests__/seguimiento-queries.test.ts`:
```ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';
import {
  fetchCustomerInvoiceLines, fetchCustomers, fetchExcludedInvoices, fetchLineSales, fetchWeekActivity,
} from '../../../lib/seguimiento/queries';

process.env.DW_NAME = `DWH_AlimentosNY_Test_seguimiento_${Date.now()}`;

function testConfig(database: string): sql.config {
  return {
    server: process.env.DW_SERVER ?? process.env.DB_SERVER!,
    port: parseInt(process.env.DW_PORT ?? process.env.DB_PORT ?? '1433'),
    database,
    user: process.env.DW_USER ?? process.env.DB_USER!,
    password: process.env.DW_PASSWORD ?? process.env.DB_PASSWORD!,
    options: {
      encrypt: (process.env.DW_ENCRYPT ?? process.env.DB_ENCRYPT) === 'true',
      trustServerCertificate: (process.env.DW_TRUST_SERVER_CERT ?? process.env.DB_TRUST_SERVER_CERT) !== 'false',
    },
  };
}

describe('seguimiento queries (disposable DWH)', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    // Minimal synthetic warehouse. FKs on the fact table are irrelevant to the queries under test.
    await pool.request().batch(`
      ALTER TABLE fact.Fact_Sales NOCHECK CONSTRAINT ALL;
      INSERT INTO dim.Dim_Currency (CurrencyCode, CurrencyName, IsBaseCurrency) VALUES ('USD', 'Dolar', 0), ('BSD', 'Bolivar', 1);
      DECLARE @usd int = (SELECT CurrencyKey FROM dim.Dim_Currency WHERE RTRIM(CurrencyCode) = 'USD');
      INSERT INTO fact.Fact_ExchangeRate (DateKey, CurrencyKey, RateBuy, RateSell)
        VALUES (20261005, @usd, 50, 50), (20261006, @usd, 50, 50), (20261007, @usd, 50, 50), (20261013, @usd, 50, 50);
      INSERT INTO dim.Dim_SalesRep (SalesRepCode, SalesRepName, IsSalesperson, IsCollector, IsInactive)
        VALUES ('V1', 'Ana', 1, 0, 0), ('V2', 'Beto', 1, 0, 0);
      INSERT INTO dim.Dim_Zone (ZoneCode, ZoneName, IsRoute, RouteNumber) VALUES ('CCS003', 'Ruta 3', 1, 3), ('CCS004', 'Ruta 4', 1, 4);
      INSERT INTO dim.Dim_Segment (ErpSegmentCode, SegmentName) VALUES ('S1', 'Abasto'), ('S2', 'Restaurante');
      INSERT INTO dim.Dim_Product (ProductCode, ProductName, LineCode, LineName, IsInactive, ValidFrom, IsCurrent)
        VALUES ('P1', 'Pan Baguette', 'L1', 'Panaderia', 0, '2020-01-01', 1), ('P2', 'Pizza Familiar', 'L2', 'Pizza', 0, '2020-01-01', 1);
      -- C2 has TWO versions: an old one (seller V2, route 4) that its September invoices point at, and the current one.
      INSERT INTO dim.Dim_Customer (CustomerCode, CustomerName, IsSpecialTaxpayer, IsLegalEntity, IsInactive, ValidFrom, ValidTo, IsCurrent,
                                    ZoneCode, ErpSegmentCode, DefaultSalesRepCode, RegisteredDate, IsMigrationBatch, VisitFrequency)
        VALUES ('C1', 'Cliente Uno',  0, 0, 0, '2020-01-01', NULL,         1, 'CCS003', 'S1', 'V1', '2026-10-02', 0, 'SEMANAL'),
               ('C2', 'Cliente Dos',  0, 0, 0, '2020-01-01', '2026-09-01', 0, 'CCS004', 'S2', 'V2', '2026-03-28', 1, NULL),
               ('C2', 'Cliente Dos',  0, 0, 0, '2026-09-01', NULL,         1, 'CCS003', 'S1', 'V1', '2026-03-28', 1, NULL),
               ('C3', 'Cliente Tres', 0, 0, 0, '2020-01-01', NULL,         1, 'CCS004', 'S2', 'V2', '2020-05-10', 0, 'MENSUAL');
      DECLARE @c1 int = (SELECT CustomerKey FROM dim.Dim_Customer WHERE CustomerCode = 'C1');
      DECLARE @c2old int = (SELECT CustomerKey FROM dim.Dim_Customer WHERE CustomerCode = 'C2' AND IsCurrent = 0);
      DECLARE @c3 int = (SELECT CustomerKey FROM dim.Dim_Customer WHERE CustomerCode = 'C3');
      DECLARE @p1 int = (SELECT ProductKey FROM dim.Dim_Product WHERE ProductCode = 'P1');
      DECLARE @p2 int = (SELECT ProductKey FROM dim.Dim_Product WHERE ProductCode = 'P2');
      INSERT INTO fact.Fact_Sales (DateKey, CustomerKey, ProductKey, DocumentTypeKey, InvoiceNumber, LineNumber,
          QuantitySold, GrossAmount, DiscountAmount, TaxAmount, NetAmount, CostSourceFlag, IsVoided)
        VALUES (20261005, @c1,    @p1, 1, 'I1', 1, 10, 1000, 0, 0, 1000, 'NO_COST_DATA', 0),
               (20261013, @c1,    @p2, 1, 'I2', 1,  5,  500, 0, 0,  500, 'NO_COST_DATA', 0),
               (20261006, @c2old, @p1, 1, 'I3', 1, 20, 2000, 0, 0, 2000, 'NO_COST_DATA', 0),
               (20260920, @c3,    @p1, 1, 'I4', 1,  7,  700, 0, 0,  700, 'NO_COST_DATA', 0),
               (20261007, @c1,    @p1, 1, 'I5', 1, 99, 9999, 0, 0, 9999, 'NO_COST_DATA', 1);
    `);
  }, 90_000);

  afterAll(async () => {
    try { await pool.close(); } finally {
      const master = await new sql.ConnectionPool(testConfig('master')).connect();
      try {
        await master.request().query(`
          ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
          DROP DATABASE [${dwhDatabaseName()}];`);
      } finally { await master.close(); }
    }
  });

  test('fetchCustomers: one current row per customer, joined to seller, route and group', async () => {
    const rows = await fetchCustomers(pool, '2026-10-14');
    expect(rows.map(r => r.customerCode).sort()).toEqual(['C1', 'C2', 'C3']);
    const c1 = rows.find(r => r.customerCode === 'C1')!;
    expect(c1).toMatchObject({
      salesRepName: 'Ana', zoneCode: 'CCS003', routeNumber: 3, segmentCode: 'S1', segmentName: 'Abasto',
      registeredDate: '2026-10-02', isMigrationBatch: false, visitIntervalDays: 7, lastInvoiceDate: '2026-10-13', isInactive: false,
    });
    const c2 = rows.find(r => r.customerCode === 'C2')!;
    expect(c2).toMatchObject({ salesRepName: 'Ana', routeNumber: 3, isMigrationBatch: true, visitIntervalDays: null });
    expect(c2.lastInvoiceDate).toBe('2026-10-06');          // found through the OLD customer key
    expect(rows.find(r => r.customerCode === 'C3')).toMatchObject({ visitIntervalDays: 30, lastInvoiceDate: '2026-09-20' });
  });

  test('fetchCustomers: lastInvoiceDate respects asOf and ignores voided invoices', async () => {
    const rows = await fetchCustomers(pool, '2026-10-10');
    expect(rows.find(r => r.customerCode === 'C1')!.lastInvoiceDate).toBe('2026-10-05'); // I2 is after asOf, I5 is voided
  });

  test('fetchLineSales: attributes old-version invoices to the current customer, dual amounts, no voided', async () => {
    const rows = await fetchLineSales(pool, '2026-10');
    const key = (r: { customerCode: string; line: string | null }) => `${r.customerCode}|${r.line}`;
    const byKey = new Map(rows.map(r => [key(r), r]));
    expect(byKey.get('C1|Panaderia')).toMatchObject({ units: 10, sales: { bs: 1000, usd: 20 } });
    expect(byKey.get('C1|Pizza')).toMatchObject({ units: 5, sales: { bs: 500, usd: 10 } });
    expect(byKey.get('C2|Panaderia')).toMatchObject({ units: 20, sales: { bs: 2000, usd: 40 } });
    expect([...byKey.keys()].some(k => k.startsWith('C3'))).toBe(false);   // September sale is outside the month
    expect(rows).toHaveLength(3);
  });

  test('fetchWeekActivity: customer x ISO week pairs inside the window', async () => {
    const all = await fetchWeekActivity(pool, '2026-09-28', '2026-11-01');
    const pairs = all.map(a => `${a.customerCode}:${a.yearWeek}`).sort();
    expect(pairs).toEqual(['C1:2026-W41', 'C1:2026-W42', 'C2:2026-W41']);
    const week42 = await fetchWeekActivity(pool, '2026-10-12', '2026-10-18');
    expect(week42.map(a => `${a.customerCode}:${a.yearWeek}`)).toEqual(['C1:2026-W42']);
  });

  test('fetchCustomerInvoiceLines: lines of the customer for the month, through any SCD2 version', async () => {
    const c2 = await fetchCustomerInvoiceLines(pool, 'C2', '2026-10');
    expect(c2).toHaveLength(1);
    expect(c2[0]).toMatchObject({
      invoiceNumber: 'I3', invoiceDate: '2026-10-06', lineNumber: 1, productCode: 'P1', lineName: 'Panaderia',
      quantity: 20, amount: { bs: 2000, usd: 40 }, unitPrice: { bs: 100, usd: 2 },
    });
    const c1 = await fetchCustomerInvoiceLines(pool, 'C1', '2026-10');
    expect(c1.map(l => l.invoiceNumber)).toEqual(['I2', 'I1']);          // newest first, voided I5 excluded
  });

  test('user-controlled values are parameters: an injection attempt just matches nothing', async () => {
    expect(await fetchCustomerInvoiceLines(pool, "C1' OR '1'='1", '2026-10')).toEqual([]);
    expect(await fetchExcludedInvoices(pool, '2026-10', ["C1' --"])).toEqual([]);
  });

  test('fetchExcludedInvoices: invoice totals for the given codes only', async () => {
    const inv = await fetchExcludedInvoices(pool, '2026-10', ['C1']);
    expect(inv.map(i => [i.invoiceNumber, i.amountNet.bs, i.amountNet.usd])).toEqual([['I2', 500, 10], ['I1', 1000, 20]]);
    expect(await fetchExcludedInvoices(pool, '2026-10', [])).toEqual([]);
  });

  test('malformed month/date arguments are rejected before any SQL runs', async () => {
    await expect(fetchLineSales(pool, '2026-1; DROP TABLE x')).rejects.toThrow(/Mes inválido/);
    await expect(fetchWeekActivity(pool, '2026-10-01', "2026-10-31'; --")).rejects.toThrow(/Fecha inválida/);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/seguimiento/targets-repo.test.ts`
Expected: FAIL (module not found).
Run: `bun test --isolate --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/seguimiento-queries.test.ts`
Expected: FAIL (module not found). (Needs the local SQL Server from `.env.local`; the test creates and drops its own database.)

- [ ] **Step 3: Implement**

`lib/seguimiento/targets-repo.ts`:
```ts
import { eq } from 'drizzle-orm';
import { sellerTargets } from '@/lib/db/schema';
import type { AppDb } from '@/lib/geo/routes-repo';
import type { SellerTargets } from './quotas';

// seller_targets rows for one month, keyed by sales_rep_key (= Dim_SalesRep.SalesRepKey as text).
// Drizzle on bun:sqlite is synchronous (AGENTS.md "Code Conventions").
export function readTargetsForMonth(db: AppDb, month: string): Map<string, SellerTargets> {
  const rows = db.select().from(sellerTargets).where(eq(sellerTargets.periodMonth, month)).all();
  return new Map(rows.map(r => [r.salesRepKey, {
    salesQuotaUsd: r.salesQuotaUsd, weeklyVisitQuota: r.weeklyVisitQuota, newCustomerQuota: r.newCustomerQuota,
  }]));
}
```

`lib/seguimiento/queries.ts`:
```ts
import sql from 'mssql';
import { buildDateWhereClause, dualAmountExpr, usdConversionJoin } from '@/app/api/dwh/lib/query-builder';
import type { CustomerFact, CustomerLineSales, CustomerWeekActivity } from './aggregate';
import type { Dual, SeguimientoExcludedInvoice, SeguimientoInvoiceLine } from './types';

// Reads only the pre-aggregated dim/fact schema of DWH_AlimentosNY (no ERP tables, no collation
// handling). All user-controlled values go through .input(); the only interpolated SQL is the date
// window from buildDateWhereClause, fed values validated here.
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertMonth(month: string): void {
  if (!MONTH_RE.test(month)) throw new Error(`Mes inválido '${month}'; se esperaba YYYY-MM`);
}
function assertIso(d: string): void {
  if (!ISO_RE.test(d)) throw new Error(`Fecha inválida '${d}'; se esperaba YYYY-MM-DD`);
}

export function dateKeyToIso(key: number): string {
  const s = String(key);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

const isoOf = (v: unknown): string => new Date(v as string | Date).toISOString().slice(0, 10);
const dualOf = (bs: unknown, usd: unknown): Dual => ({ bs: Number(bs ?? 0), usd: usd === null || usd === undefined ? null : Number(usd) });

// Invoice -> the customer version it was issued under -> that customer's CURRENT row (same code).
const TO_CURRENT_CUSTOMER = `
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_Customer cur ON cur.CustomerCode = c.CustomerCode AND cur.IsCurrent = 1`;

const CUSTOMERS_QUERY = `
  ;WITH LastInvoice AS (
    SELECT c.CustomerCode, MAX(fs.DateKey) AS LastDateKey
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    WHERE fs.IsVoided = 0 AND fs.DateKey <= @asOfKey
    GROUP BY c.CustomerCode
  )
  SELECT RTRIM(cur.CustomerCode) AS CustomerCode, cur.CustomerName, cur.IsInactive,
    r.SalesRepKey, ISNULL(r.SalesRepName, RTRIM(r.SalesRepCode)) AS SalesRepName,
    RTRIM(cur.ZoneCode) AS ZoneCode, z.RouteNumber,
    RTRIM(cur.ErpSegmentCode) AS ErpSegmentCode, s.SegmentName,
    cur.RegisteredDate, cur.IsMigrationBatch, cur.VisitIntervalDays, li.LastDateKey
  FROM dim.Dim_Customer cur
  LEFT JOIN dim.Dim_SalesRep r ON r.SalesRepCode = cur.DefaultSalesRepCode
  LEFT JOIN dim.Dim_Zone z ON z.ZoneCode = cur.ZoneCode
  LEFT JOIN dim.Dim_Segment s ON s.ErpSegmentCode = cur.ErpSegmentCode
  LEFT JOIN LastInvoice li ON li.CustomerCode = cur.CustomerCode
  WHERE cur.IsCurrent = 1
`;

export async function fetchCustomers(pool: sql.ConnectionPool, asOf: string): Promise<CustomerFact[]> {
  assertIso(asOf);
  const result = await pool.request().input('asOfKey', sql.Int, Number(asOf.replace(/-/g, ''))).query(CUSTOMERS_QUERY);
  return result.recordset.map(r => ({
    customerCode: String(r.CustomerCode),
    customerName: String(r.CustomerName ?? r.CustomerCode).trim(),
    isInactive: Boolean(r.IsInactive),
    salesRepKey: r.SalesRepKey === null || r.SalesRepKey === undefined ? null : String(r.SalesRepKey),
    salesRepName: r.SalesRepName === null || r.SalesRepName === undefined ? null : String(r.SalesRepName).trim(),
    zoneCode: r.ZoneCode ? String(r.ZoneCode) : null,
    routeNumber: r.RouteNumber === null || r.RouteNumber === undefined ? null : Number(r.RouteNumber),
    segmentCode: r.ErpSegmentCode ? String(r.ErpSegmentCode) : null,
    segmentName: r.SegmentName ? String(r.SegmentName).trim() : null,
    registeredDate: r.RegisteredDate ? isoOf(r.RegisteredDate) : null,
    isMigrationBatch: Boolean(r.IsMigrationBatch),
    visitIntervalDays: r.VisitIntervalDays === null || r.VisitIntervalDays === undefined ? null : Number(r.VisitIntervalDays),
    lastInvoiceDate: r.LastDateKey ? dateKeyToIso(Number(r.LastDateKey)) : null,
  }));
}

export async function fetchLineSales(pool: sql.ConnectionPool, month: string): Promise<CustomerLineSales[]> {
  assertMonth(month);
  const where = buildDateWhereClause(`month:${month}`, 'fs');
  const result = await pool.request().query(`
    SELECT RTRIM(cur.CustomerCode) AS CustomerCode, p.LineName AS LineName,
      SUM(fs.QuantitySold) AS Units, ${dualAmountExpr('fs', 'NetAmount', 'SalesBs', 'SalesUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    ${TO_CURRENT_CUSTOMER}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${where}
    GROUP BY RTRIM(cur.CustomerCode), p.LineName
  `);
  return result.recordset.map(r => ({
    customerCode: String(r.CustomerCode),
    line: r.LineName === null || r.LineName === undefined ? null : String(r.LineName).trim() || null,
    units: Number(r.Units ?? 0),
    sales: dualOf(r.SalesBs, r.SalesUsd),
  }));
}

export async function fetchWeekActivity(pool: sql.ConnectionPool, from: string, to: string): Promise<CustomerWeekActivity[]> {
  assertIso(from);
  assertIso(to);
  const where = buildDateWhereClause(`custom:${from}:${to}`, 'fs');
  const result = await pool.request().query(`
    SELECT DISTINCT RTRIM(cur.CustomerCode) AS CustomerCode, d.YearWeek
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    ${TO_CURRENT_CUSTOMER}
    WHERE fs.IsVoided = 0 ${where}
  `);
  return result.recordset.map(r => ({ customerCode: String(r.CustomerCode), yearWeek: String(r.YearWeek).trim() }));
}

export async function fetchCustomerInvoiceLines(
  pool: sql.ConnectionPool, customerCode: string, month: string,
): Promise<SeguimientoInvoiceLine[]> {
  assertMonth(month);
  const where = buildDateWhereClause(`month:${month}`, 'fs');
  const result = await pool.request().input('customerCode', sql.VarChar(16), customerCode).query(`
    SELECT TOP 500 RTRIM(fs.InvoiceNumber) AS InvoiceNumber, d.FullDate AS InvoiceDate, fs.LineNumber,
      RTRIM(p.ProductCode) AS ProductCode, ISNULL(p.ProductName, RTRIM(p.ProductCode)) AS ProductName, p.LineName,
      fs.QuantitySold AS Quantity, fs.NetAmount AS AmountBs, fs.NetAmount / NULLIF(fx.RateSell, 0) AS AmountUsd
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 AND c.CustomerCode = @customerCode ${where}
    ORDER BY d.FullDate DESC, fs.InvoiceNumber, fs.LineNumber
  `);
  return result.recordset.map(r => {
    const quantity = Number(r.Quantity);
    const amount = dualOf(r.AmountBs, r.AmountUsd);
    return {
      invoiceNumber: String(r.InvoiceNumber),
      invoiceDate: isoOf(r.InvoiceDate),
      lineNumber: Number(r.LineNumber),
      productCode: String(r.ProductCode),
      productName: String(r.ProductName).trim(),
      lineName: r.LineName === null || r.LineName === undefined ? null : String(r.LineName).trim() || null,
      quantity,
      amount,
      unitPrice: quantity > 0 ? { bs: amount.bs / quantity, usd: amount.usd === null ? null : amount.usd / quantity } : null,
    };
  });
}

export async function fetchExcludedInvoices(
  pool: sql.ConnectionPool, month: string, customerCodes: string[],
): Promise<SeguimientoExcludedInvoice[]> {
  assertMonth(month);
  if (customerCodes.length === 0) return [];
  const where = buildDateWhereClause(`month:${month}`, 'fs');
  const req = pool.request();
  const placeholders = customerCodes.map((code, i) => {
    req.input(`code${i}`, sql.VarChar(16), code);
    return `@code${i}`;
  });
  const result = await req.query(`
    SELECT RTRIM(c.CustomerCode) AS CustomerCode, c.CustomerName, RTRIM(fs.InvoiceNumber) AS InvoiceNumber, d.FullDate AS InvoiceDate,
      ${dualAmountExpr('fs', 'NetAmount', 'NetBs', 'NetUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 AND c.CustomerCode IN (${placeholders.join(', ')}) ${where}
    GROUP BY c.CustomerCode, c.CustomerName, fs.InvoiceNumber, d.FullDate
    ORDER BY d.FullDate DESC, fs.InvoiceNumber
  `);
  return result.recordset.map(r => ({
    customerCode: String(r.CustomerCode),
    customerName: String(r.CustomerName ?? r.CustomerCode).trim(),
    invoiceNumber: String(r.InvoiceNumber),
    invoiceDate: isoOf(r.InvoiceDate),
    amountNet: dualOf(r.NetBs, r.NetUsd),
  }));
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/seguimiento/targets-repo.test.ts`
Expected: PASS.
Run: `bun test --isolate --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/seguimiento-queries.test.ts`
Expected: PASS. If the synthetic `INSERT INTO dim.Dim_Customer` fails with "Cannot insert NULL into column X", plan A's migration `0040` added a NOT NULL column without default: add X to the insert (never change the query under test to suit the seed). If the `Dim_Currency` insert fails with a unique violation, drop that line (a migration already seeds the codes).

- [ ] **Step 5: Commit**

```bash
git add lib/seguimiento/queries.ts lib/seguimiento/targets-repo.ts scripts/dwh/__tests__/seguimiento-queries.test.ts __tests__/unit/seguimiento/targets-repo.test.ts
git commit -m "feat(seguimiento): DWH queries, targets reader and disposable-DWH integration test" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 6: Move `consignment.ts` to `app/api/dwh/lib/` and add the `/api/dwh/seguimiento` route

**Files:**
- Move: `app/api/dwh/vendedores/consignment.ts` -> `app/api/dwh/lib/consignment.ts`; `app/api/dwh/vendedores/__tests__/consignment.test.ts` -> `app/api/dwh/lib/__tests__/consignment.test.ts`
- Modify (import path only): `app/api/dwh/vendedores/route.ts:9`, `app/api/dwh/vendedor-360/route.ts:13`, `app/api/dwh/vendedor-360/__tests__/route.test.ts:5`
- Create: `app/api/dwh/seguimiento/route.ts`
- Test: `app/api/dwh/seguimiento/__tests__/route.test.ts` (mocked), `app/api/dwh/seguimiento/__tests__/route.auth.test.ts` (no mocks, existing 401 pattern)

**Interfaces:**
- Consumes: `requireDwhAccess` (`lib/dwh/access.ts`); `getDwhPool` (`lib/db/dwh-mssql.ts`); `getDb` (`lib/db/sqlite.ts`); `captureEvent`, `captureException` (`lib/analytics/posthog.ts`); `buildDateWhereClause`, `jsonWithCache` (`app/api/dwh/lib/query-builder.ts`); `getFlaggedRootCodes`, `DEFAULT_ROOT_SHARE_THRESHOLD` (moved file); Task 1 `resolveReferenceMonth`, `isoWeeksOfMonth`; Task 4 `buildSeguimiento`, `rootOf`, `parseRootKind`, response types; Task 5 `fetchCustomers`, `fetchLineSales`, `fetchWeekActivity`, `fetchCustomerInvoiceLines`, `fetchExcludedInvoices`, `readTargetsForMonth`; fixture from Task 4.
- Produces: `GET /api/dwh/seguimiento` (route-handler contract; plan C and the tab depend on it):
  - `?kind=vendedor|ruta|grupo&dateRange=<shell dateRange>` (defaults `vendedor`, `30d`; unknown `kind` -> `vendedor`) -> `SeguimientoResponse`.
  - `?section=lines&customerCode=<code>&dateRange=...` -> `SeguimientoLinesResponse`; `400 {error}` when `customerCode` is missing or not `^[A-Za-z0-9._\- ]{1,16}$`.
  - `?section=excluded&kind=...&rootValue=<root value>&dateRange=...` -> `SeguimientoExcludedResponse` (invoices of the flagged consignment-root customers that belong to that root); `400` when `rootValue` is missing.
  - 401 `{error:'No autorizado'}` / 403 `{error:'Prohibido'}` from `requireDwhAccess`; 500 `{error:'Error al consultar el Data Warehouse'}`.
  - Successful responses use `jsonWithCache` (`Cache-Control: private, max-age=900`); the tab bypasses it with `cache: 'no-store'` after a quota save.
  - Consignment flags are computed for the reference month window (`month:YYYY-MM`) with `DEFAULT_ROOT_SHARE_THRESHOLD`, the same rule as the Vendedores tab.

- [ ] **Step 1: Move the consignment helper (no behavior change)**

```bash
git mv app/api/dwh/vendedores/consignment.ts app/api/dwh/lib/consignment.ts
git mv app/api/dwh/vendedores/__tests__/consignment.test.ts app/api/dwh/lib/__tests__/consignment.test.ts
```
Edit the imports (exact replacements):
- `app/api/dwh/vendedores/route.ts`: `from './consignment'` -> `from '@/app/api/dwh/lib/consignment'`
- `app/api/dwh/vendedor-360/route.ts`: `from '@/app/api/dwh/vendedores/consignment'` -> `from '@/app/api/dwh/lib/consignment'`
- `app/api/dwh/vendedor-360/__tests__/route.test.ts`: same replacement as above.
- `app/api/dwh/lib/__tests__/consignment.test.ts`: `from '../consignment'` stays valid (the test now sits next to the file).
- In the moved `consignment.ts` comment, change "Shared by vendedores/route.ts and vendedor-360/route.ts" to "Shared by vendedores/route.ts, vendedor-360/route.ts and seguimiento/route.ts".

Run: `grep -rn "vendedores/consignment\|from './consignment'" app lib e2e scripts __tests__`
Expected: no output.
Run: `bun test --isolate --env-file=.env.local app/api/dwh/lib/__tests__/consignment.test.ts app/api/dwh/vendedores app/api/dwh/vendedor-360`
Expected: PASS (same results as before the move).

- [ ] **Step 2: Write the failing route tests**

`app/api/dwh/seguimiento/__tests__/route.auth.test.ts` (existing unauthenticated pattern, no mocks):
```ts
import { describe, test, expect } from 'bun:test';
import { NextRequest } from 'next/server';
import { GET } from '../route';

describe('GET /api/dwh/seguimiento (no session)', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const res = await GET(new NextRequest('http://localhost/api/dwh/seguimiento'));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('No autorizado');
  });
});
```

`app/api/dwh/seguimiento/__tests__/route.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test';
import { NextRequest, NextResponse } from 'next/server';
import { makeMemoryDb } from '@/__tests__/helpers/memory-db';
import { sellerTargets } from '@/lib/db/schema';
import { FIXTURE_CONSIGNMENT_ROOTS, FIXTURE_CUSTOMERS, FIXTURE_INVOICE_LINES, FIXTURE_LINE_SALES, FIXTURE_WEEK_ACTIVITY } from '@/__tests__/unit/seguimiento/fixture';

const pool = { tag: 'pool' };
const memoryDb = makeMemoryDb();
const access = mock(async (): Promise<{ ok: true; session: { sub: string; role: 'admin' } } | { ok: false; response: NextResponse }> =>
  ({ ok: true, session: { sub: '7', role: 'admin' } }));
const capture = mock((_id: string, _event: string, _props?: unknown) => {});
const captureEx = mock((_e: unknown, _id: string) => {});
const fetchCustomers = mock(async (_p: unknown, _asOf: string) => FIXTURE_CUSTOMERS);
const fetchLineSales = mock(async (_p: unknown, _m: string) => FIXTURE_LINE_SALES);
const fetchWeekActivity = mock(async (_p: unknown, _f: string, _t: string) => FIXTURE_WEEK_ACTIVITY);
const fetchCustomerInvoiceLines = mock(async (_p: unknown, _c: string, _m: string) => FIXTURE_INVOICE_LINES);
const fetchExcludedInvoices = mock(async (_p: unknown, _m: string, codes: string[]) =>
  codes.length ? [{ customerCode: 'C4', customerName: 'Cadena Raiz', invoiceNumber: 'F9', invoiceDate: '2026-10-05', amountNet: { bs: 9000, usd: 180 } }] : []);
const flagged = mock(async (_w: string, _t: number) => FIXTURE_CONSIGNMENT_ROOTS);

mock.module('@/lib/dwh/access', () => ({ requireDwhAccess: access }));
mock.module('@/lib/db/dwh-mssql', () => ({ getDwhPool: async () => pool }));
mock.module('@/lib/db/sqlite', () => ({ getDb: () => memoryDb }));
mock.module('@/lib/analytics/posthog', () => ({ captureEvent: capture, captureException: captureEx }));
mock.module('@/lib/seguimiento/queries', () => ({ fetchCustomers, fetchLineSales, fetchWeekActivity, fetchCustomerInvoiceLines, fetchExcludedInvoices }));
mock.module('@/app/api/dwh/lib/consignment', () => ({ getFlaggedRootCodes: flagged, DEFAULT_ROOT_SHARE_THRESHOLD: 0.15 }));

const { GET } = await import('../route');
const call = (qs = '') => GET(new NextRequest(`http://localhost/api/dwh/seguimiento${qs}`));

beforeAll(() => setSystemTime(new Date('2026-10-14T15:00:00Z')));
afterAll(() => setSystemTime());
beforeEach(() => {
  for (const m of [capture, captureEx, fetchCustomers, fetchLineSales, fetchWeekActivity, fetchCustomerInvoiceLines, fetchExcludedInvoices, flagged]) m.mockClear();
  access.mockImplementation(async () => ({ ok: true, session: { sub: '7', role: 'admin' } }));
  memoryDb.delete(sellerTargets).run();
  memoryDb.insert(sellerTargets).values([
    { salesRepKey: '1', periodMonth: '2026-10', salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: 1 },
    { salesRepKey: '2', periodMonth: '2026-10', salesQuotaUsd: 50, weeklyVisitQuota: null, newCustomerQuota: null },
    { salesRepKey: '1', periodMonth: '2026-09', salesQuotaUsd: 7, weeklyVisitQuota: null, newCustomerQuota: null },
  ]).run();
});

describe('GET /api/dwh/seguimiento: access', () => {
  test('passes the 401/403 from requireDwhAccess through and runs no query', async () => {
    access.mockImplementation(async () => ({ ok: false, response: NextResponse.json({ error: 'Prohibido' }, { status: 403 }) }));
    const res = await call();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Prohibido' });
    expect(fetchCustomers).not.toHaveBeenCalled();
  });
});

describe('GET /api/dwh/seguimiento: main response', () => {
  test('vendedor roots with quotas from seller_targets for the reference month', async () => {
    const res = await call('?kind=vendedor&dateRange=30d');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=900');
    const body = await res.json();
    expect(body).toMatchObject({ kind: 'vendedor', month: '2026-10', asOf: '2026-10-14' });
    expect(body.pace).toMatchObject({ workingDaysInMonth: 22, workingDaysElapsed: 10 });
    expect(body.roots.map((r: { label: string }) => r.label)).toEqual(['Ana', 'Beto']);
    expect(body.roots[0]).toMatchObject({ salesRepKey: '1', salesQuotaUsd: 100, targets: { salesQuotaUsd: 100 } });
    expect(body.total.salesQuotaUsd).toBe(150);            // the September row (7) is not used
    expect(body.total.excludedSales).toEqual({ bs: 9000, usd: 180 });
  });

  test('queries get the reference month, as-of day and the full ISO-week window', async () => {
    await call('?dateRange=30d');
    expect(fetchCustomers).toHaveBeenCalledWith(pool, '2026-10-14');
    expect(fetchLineSales).toHaveBeenCalledWith(pool, '2026-10');
    expect(fetchWeekActivity).toHaveBeenCalledWith(pool, '2026-09-28', '2026-11-01');
    expect(flagged.mock.calls[0][0]).toContain('DateKey');
    expect(flagged.mock.calls[0][1]).toBe(0.15);
  });

  test('a past month is closed and uses that month\'s quotas', async () => {
    await call('?dateRange=month:2026-09');
    expect(fetchLineSales).toHaveBeenCalledWith(pool, '2026-09');
    expect(fetchCustomers).toHaveBeenCalledWith(pool, '2026-09-30');
  });

  test('ruta and grupo kinds; unknown kinds fall back to vendedor', async () => {
    expect((await (await call('?kind=ruta')).json()).roots.map((r: { label: string }) => r.label)).toEqual(['Ruta 3', 'Ruta 4']);
    expect((await (await call('?kind=grupo')).json()).roots.map((r: { label: string }) => r.label)).toEqual(['Abasto', 'Restaurante']);
    expect((await (await call('?kind=zzz')).json()).kind).toBe('vendedor');
  });

  test('sends a PostHog event with the session id', async () => {
    await call('?kind=ruta');
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0][0]).toBe('7');
    expect(capture.mock.calls[0][1]).toBe('seguimiento_viewed');
    expect(capture.mock.calls[0][2]).toMatchObject({ kind: 'ruta', month: '2026-10', roots: 2 });
  });

  test('a database failure is a 500 { error } and is reported, not cached', async () => {
    fetchLineSales.mockImplementationOnce(async () => { throw new Error('boom'); });
    const res = await call();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Error al consultar el Data Warehouse' });
    expect(res.headers.get('Cache-Control')).toBeNull();
    expect(captureEx).toHaveBeenCalledTimes(1);
    expect(capture).not.toHaveBeenCalled();
  });
});

describe('GET /api/dwh/seguimiento: sections', () => {
  test('lines: validates the customer code, then returns the lines', async () => {
    expect((await call('?section=lines')).status).toBe(400);
    expect((await call('?section=lines&customerCode=' + encodeURIComponent("C1'; DROP TABLE x"))).status).toBe(400);
    expect(fetchCustomerInvoiceLines).not.toHaveBeenCalled();
    const res = await call('?section=lines&customerCode=C1&dateRange=30d');
    expect(res.status).toBe(200);
    expect((await res.json()).lines).toHaveLength(2);
    expect(fetchCustomerInvoiceLines).toHaveBeenCalledWith(pool, 'C1', '2026-10');
  });

  test('excluded: only flagged consignment codes that belong to the requested root', async () => {
    expect((await call('?section=excluded&kind=vendedor')).status).toBe(400);
    const res = await call('?section=excluded&kind=vendedor&rootValue=2');
    expect(res.status).toBe(200);
    expect(fetchExcludedInvoices).toHaveBeenCalledWith(pool, '2026-10', ['C4']);
    expect((await res.json()).invoices).toHaveLength(1);
    fetchExcludedInvoices.mockClear();
    await call('?section=excluded&kind=vendedor&rootValue=1');      // Ana has no flagged code
    expect(fetchExcludedInvoices).toHaveBeenCalledWith(pool, '2026-10', []);
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `bun test --isolate --env-file=.env.local app/api/dwh/seguimiento`
Expected: FAIL (route not found).

- [ ] **Step 4: Implement the route**

`app/api/dwh/seguimiento/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getDb } from '@/lib/db/sqlite';
import { captureEvent, captureException } from '@/lib/analytics/posthog';
import { buildDateWhereClause, jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import { DEFAULT_ROOT_SHARE_THRESHOLD, getFlaggedRootCodes } from '@/app/api/dwh/lib/consignment';
import { buildSeguimiento, rootOf } from '@/lib/seguimiento/aggregate';
import { isoWeeksOfMonth } from '@/lib/seguimiento/iso-weeks';
import { resolveReferenceMonth } from '@/lib/seguimiento/month-pace';
import {
  fetchCustomerInvoiceLines, fetchCustomers, fetchExcludedInvoices, fetchLineSales, fetchWeekActivity,
} from '@/lib/seguimiento/queries';
import { readTargetsForMonth } from '@/lib/seguimiento/targets-repo';
import {
  parseRootKind,
  type SeguimientoExcludedResponse, type SeguimientoLinesResponse, type SeguimientoResponse,
} from '@/lib/seguimiento/types';

export const dynamic = 'force-dynamic';

// Reads the pre-aggregated dim/fact schema of DWH_AlimentosNY plus the app's own SQLite
// seller_targets. Replaces the Vendedores tab and the Vendedor 360 table (spec section B).
// Consignment-pattern exclusion is the same rule as app/api/dwh/vendedores/route.ts.
const CUSTOMER_CODE_RE = /^[A-Za-z0-9._\- ]{1,16}$/;

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const kind = parseRootKind(searchParams.get('kind'));
  const section = searchParams.get('section');
  const today = new Date().toISOString().slice(0, 10);
  const ref = resolveReferenceMonth(searchParams.get('dateRange') ?? '30d', today);

  const customerCode = (searchParams.get('customerCode') ?? '').trim();
  if (section === 'lines' && !CUSTOMER_CODE_RE.test(customerCode)) {
    return NextResponse.json({ error: 'customerCode inválido' }, { status: 400 });
  }
  const rootValue = searchParams.get('rootValue');
  if (section === 'excluded' && !rootValue) {
    return NextResponse.json({ error: 'Falta rootValue' }, { status: 400 });
  }

  try {
    const pool = await getDwhPool();

    if (section === 'lines') {
      const lines = await fetchCustomerInvoiceLines(pool, customerCode, ref.month);
      const body: SeguimientoLinesResponse = { lines };
      return jsonWithCache(body);
    }

    const flaggedCodes = await getFlaggedRootCodes(buildDateWhereClause(`month:${ref.month}`, 'fs'), DEFAULT_ROOT_SHARE_THRESHOLD);

    if (section === 'excluded') {
      const flaggedSet = new Set(flaggedCodes.map(c => c.trim()));
      const customers = await fetchCustomers(pool, ref.asOf);
      const codes = customers
        .filter(c => flaggedSet.has(c.customerCode) && rootOf(kind, c).value === rootValue)
        .map(c => c.customerCode);
      const body: SeguimientoExcludedResponse = { invoices: await fetchExcludedInvoices(pool, ref.month, codes) };
      return jsonWithCache(body);
    }

    const weeks = isoWeeksOfMonth(ref.month);
    const [customers, lineSales, weekActivity] = await Promise.all([
      fetchCustomers(pool, ref.asOf),
      fetchLineSales(pool, ref.month),
      // Activation counts the whole ISO week, including days before the 1st / after the last day.
      fetchWeekActivity(pool, weeks[0].weekStart, weeks[weeks.length - 1].weekEnd),
    ]);
    const targets = readTargetsForMonth(getDb(), ref.month);

    const response: SeguimientoResponse = {
      kind, month: ref.month, monthStart: ref.monthStart, monthEnd: ref.monthEnd, asOf: ref.asOf,
      ...buildSeguimiento({ kind, month: ref.month, asOf: ref.asOf, customers, lineSales, weekActivity, consignmentRootCodes: flaggedCodes, targets }),
    };
    captureEvent(auth.session.sub, 'seguimiento_viewed', { kind, month: ref.month, roots: response.roots.length });
    return jsonWithCache(response);
  } catch (err) {
    console.error('GET /api/dwh/seguimiento failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `bun test --isolate --env-file=.env.local app/api/dwh/seguimiento app/api/dwh/lib app/api/dwh/vendedores app/api/dwh/vendedor-360`
Expected: PASS. If `@/__tests__/...` fails to resolve, use the relative paths `../../../../../__tests__/...` (the repo's `@/*` alias maps to the project root, but verify with `grep -n '"@/\*"' tsconfig.json`).
Run: `bunx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/dwh/lib/consignment.ts app/api/dwh/lib/__tests__/consignment.test.ts app/api/dwh/vendedores/route.ts app/api/dwh/vendedor-360/route.ts app/api/dwh/vendedor-360/__tests__/route.test.ts app/api/dwh/seguimiento
git commit -m "feat(seguimiento): /api/dwh/seguimiento route; move consignment helper to dwh/lib" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
(`git mv` already staged the renames; the explicit `git add` of the moved paths keeps them in the commit.)

---

## Task 7: Extract `QuotaEditor` into a shared component and add `backLabel` to `SellerProfile`

Preserves the inline quota-editing behavior (click "Definir meta", number input, "Guardar", full three-field POST so the delete-then-insert upsert in `app/api/admin/seller-targets/route.ts` never wipes the other two quotas) and makes it reusable from the Seguimiento rows.

**Files:**
- Create: `app/(app)/analitica/components/quota-editor.tsx`
- Modify: `app/(app)/analitica/tabs/seller-profile.tsx` (remove the local `SellerTargetRow`, `EMPTY_TARGET_ROW`, `QuotaEditor`; import them; add optional `backLabel` prop; change one help sentence)
- Test: `app/(app)/analitica/components/__tests__/quota-editor.test.tsx`

**Interfaces:**
- Consumes: nothing new (moves existing code verbatim).
- Produces:
```ts
// components/quota-editor.tsx
export interface SellerTargetRow { salesQuotaUsd: number | null; weeklyVisitQuota: number | null; newCustomerQuota: number | null }
export const EMPTY_TARGET_ROW: SellerTargetRow;
export function QuotaEditor(props: {
  currentValue: number | null; field: keyof SellerTargetRow; suffix?: string;
  onSave: (field: keyof SellerTargetRow, newValue: number) => Promise<boolean>;
}): JSX.Element;
export function saveSellerTargetField(args: {
  salesRepKey: string; periodMonth: string; current: SellerTargetRow; field: keyof SellerTargetRow; value: number;
}): Promise<boolean>;     // POST /api/admin/seller-targets with the FULL three-field row
// SellerProfile gains: backLabel?: string   (default 'Volver a Vendedores'; rendered as `← ${backLabel}`)
```

- [ ] **Step 1: Write the failing test**

`app/(app)/analitica/components/__tests__/quota-editor.test.tsx`:
```tsx
import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EMPTY_TARGET_ROW, QuotaEditor, saveSellerTargetField } from '../quota-editor';

afterEach(cleanup);

describe('QuotaEditor', () => {
  test('shows "Definir meta" when empty, edits inline and saves the typed number', async () => {
    const onSave = mock(async (_f: string, _v: number) => true);
    render(<QuotaEditor currentValue={null} field="salesQuotaUsd" suffix="USD" onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: 'Definir meta (USD)' }));
    await userEvent.type(screen.getByRole('spinbutton'), '1500');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('salesQuotaUsd', 1500));
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });
  test('shows the current value and pre-fills the editor', async () => {
    render(<QuotaEditor currentValue={80} field="weeklyVisitQuota" onSave={async () => true} />);
    await userEvent.click(screen.getByRole('button', { name: 'Editar meta (80)' }));
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('80');
  });
  test('a failed save keeps the editor open with an error', async () => {
    render(<QuotaEditor currentValue={null} field="newCustomerQuota" onSave={async () => false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Definir meta' }));
    await userEvent.type(screen.getByRole('spinbutton'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('No se pudo guardar la meta')).toBeTruthy();
    expect(screen.getByRole('spinbutton')).toBeTruthy();
  });
  test('a negative value is never saved', async () => {
    const onSave = mock(async (_f: string, _v: number) => true);
    render(<QuotaEditor currentValue={null} field="salesQuotaUsd" onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: 'Definir meta' }));
    await userEvent.type(screen.getByRole('spinbutton'), '-5');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('spinbutton')).toBeTruthy();
  });
});

describe('saveSellerTargetField', () => {
  const fetchMock = mock(async (_url: string, _init?: RequestInit) => ({ ok: true }) as Response);
  beforeEach(() => { fetchMock.mockClear(); globalThis.fetch = fetchMock as unknown as typeof fetch; });

  test('always POSTs the full three-field row so the upsert never nulls the other quotas', async () => {
    const ok = await saveSellerTargetField({
      salesRepKey: '12', periodMonth: '2026-10',
      current: { salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: null },
      field: 'newCustomerQuota', value: 4,
    });
    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/admin/seller-targets');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      salesRepKey: '12', periodMonth: '2026-10', salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: 4,
    });
  });
  test('false on a non-ok response and on a network error', async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: false }) as Response);
    expect(await saveSellerTargetField({ salesRepKey: '1', periodMonth: '2026-10', current: EMPTY_TARGET_ROW, field: 'salesQuotaUsd', value: 1 })).toBe(false);
    fetchMock.mockImplementationOnce(async () => { throw new Error('offline'); });
    expect(await saveSellerTargetField({ salesRepKey: '1', periodMonth: '2026-10', current: EMPTY_TARGET_ROW, field: 'salesQuotaUsd', value: 1 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `bun test --isolate --env-file=.env.local "app/(app)/analitica/components/__tests__/quota-editor.test.tsx"`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `app/(app)/analitica/components/quota-editor.tsx` by MOVING, verbatim, from `seller-profile.tsx` lines 39-125 (`SellerTargetRow`, `EMPTY_TARGET_ROW`, the long comment and `QuotaEditor`), adding `'use client';` + `import { useState } from 'react';`, exporting the three names, and appending:
```tsx
// Persists one quota field. POST /api/admin/seller-targets is a delete-then-reinsert upsert, so the
// body must always carry the full three-field row: any field left out would be written back as null.
export async function saveSellerTargetField(args: {
  salesRepKey: string;
  periodMonth: string;
  current: SellerTargetRow;
  field: keyof SellerTargetRow;
  value: number;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/seller-targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salesRepKey: args.salesRepKey, periodMonth: args.periodMonth, ...args.current, [args.field]: args.value }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

In `seller-profile.tsx`:
1. Delete the local `SellerTargetRow`, `EMPTY_TARGET_ROW` and `QuotaEditor` definitions (the block described above) and add `import { EMPTY_TARGET_ROW, QuotaEditor, type SellerTargetRow } from '../components/quota-editor';`.
2. Change the props to `{ salesRepKey, dateRange, currency, onBack, backLabel = 'Volver a Vendedores' }: { ...; backLabel?: string }` and replace the two literals `← Volver a Vendedores` with `{`← ${backLabel}`}`.
3. Change the sentence "igual que la pestaña Vendedores." to "igual que la pestaña Seguimiento."
4. Leave `saveQuotaField`, `loadTargetRow`, `resolveLatestPeriodMonth` untouched.

- [ ] **Step 4: Run to verify it passes, and that the profile still compiles**

Run: `bun test --isolate --env-file=.env.local "app/(app)/analitica/components/__tests__/quota-editor.test.tsx"`
Expected: PASS.
Run: `bunx tsc --noEmit && bunx eslint "app/(app)/analitica/tabs/seller-profile.tsx" "app/(app)/analitica/components/quota-editor.tsx"`
Expected: clean. (The existing `@mssql` spec `e2e/vendedores-seller-profile.spec.ts` still sees "← Volver a Vendedores" because that is the default.)

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/analitica/components/quota-editor.tsx" "app/(app)/analitica/components/__tests__/quota-editor.test.tsx" "app/(app)/analitica/tabs/seller-profile.tsx"
git commit -m "refactor(analitica): extract QuotaEditor; SellerProfile backLabel prop" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 8: Visual components (week strip, quota bar, mix bar, chips, month-pace strip, visit badge)

**Files:**
- Create: `app/(app)/analitica/components/seguimiento/fmt.ts`, `.../colors.ts`, `.../visuals.tsx`
- Test: `app/(app)/analitica/components/seguimiento/__tests__/visuals.test.tsx`

**Interfaces:**
- Consumes: `WeekCell`, `WeekHeader`, `NewCustomersInfo` (Task 4); `MixSegment`, `OTHER_LINE_LABEL` (Task 3); `quotaBarGeometry` (Task 3); `MonthPace` (Task 1); `VisitCompliance` (Task 2); `moneyLabel` (`app/(app)/analitica/lib/format.ts`); `Currency` (`../types`).
- Produces (all from `visuals.tsx`):
```tsx
export function WeekStrip(props: { weeks: WeekCell[]; headers: WeekHeader[] }): JSX.Element;       // role="img"; bars data-testid="week-bar-<yearWeek>" data-pct
export function WeekDots(props: { headers: WeekHeader[]; activeWeeks: string[] }): JSX.Element;    // per-customer on/off dots
export function QuotaBar(props: { actual: Dual; quotaUsd: number | null; projected: Dual | null; currency: Currency; shared?: boolean; partial?: boolean }): JSX.Element;
export function MixBar(props: { segments: MixSegment[]; visibleLines: readonly string[] }): JSX.Element;
export function NewCustomersChip(props: { info: NewCustomersInfo }): JSX.Element;
export function MonthPaceStrip(props: { pace: MonthPace }): JSX.Element;                           // reused by plan C's Resumen
export function VisitBadge(props: { visit: VisitCompliance }): JSX.Element;                        // reused by plan C's Clientes
// fmt.ts:  pct(n: number | null): string ('—' for null, one decimal);  monthLabel(month: string): string ('octubre 2026');  num(n: number): string
// colors.ts: lineColor(line: string, visible: readonly string[]): string
```
UI rules pinned by the tests: `usd: null` actual renders "—" and no fill; quota `null`/`0` renders "Sin meta" and no geometry; shared quota renders "Meta compartida"; bars are `role="img"` with an `aria-label` that states the numbers (accessible and testable); no external chart library.

- [ ] **Step 1: Write the failing test**

`app/(app)/analitica/components/seguimiento/__tests__/visuals.test.tsx`:
```tsx
import { screen } from '../../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import {
  MixBar, MonthPaceStrip, NewCustomersChip, QuotaBar, VisitBadge, WeekDots, WeekStrip,
} from '../visuals';
import { monthPace } from '../../../../../../lib/seguimiento/month-pace';
import { visitCompliance } from '../../../../../../lib/seguimiento/visit-compliance';
import type { WeekCell, WeekHeader } from '../../../../../../lib/seguimiento/types';

afterEach(cleanup);

const headers: WeekHeader[] = [
  { yearWeek: '2026-W41', weekStart: '2026-10-05', weekEnd: '2026-10-11', label: 'S41', isFuture: false },
  { yearWeek: '2026-W42', weekStart: '2026-10-12', weekEnd: '2026-10-18', label: 'S42', isFuture: false },
  { yearWeek: '2026-W43', weekStart: '2026-10-19', weekEnd: '2026-10-25', label: 'S43', isFuture: true },
];
const cells: WeekCell[] = [
  { yearWeek: '2026-W41', active: 2, assigned: 2, pct: 1 },
  { yearWeek: '2026-W42', active: 1, assigned: 2, pct: 0.5 },
  { yearWeek: '2026-W43', active: 0, assigned: 2, pct: null },
];

describe('WeekStrip', () => {
  test('one bar per week with the percentage, future weeks without one', () => {
    render(<WeekStrip weeks={cells} headers={headers} />);
    expect(screen.getByTestId('week-bar-2026-W41').getAttribute('data-pct')).toBe('1');
    expect(screen.getByTestId('week-bar-2026-W42').getAttribute('data-pct')).toBe('0.5');
    expect(screen.getByTestId('week-bar-2026-W43').getAttribute('data-pct')).toBe('');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('S42: 50.0%');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('S43: sin datos');
    expect(screen.getByText('S41')).toBeTruthy();
  });
});

describe('WeekDots', () => {
  test('marks the weeks with an invoice', () => {
    render(<WeekDots headers={headers} activeWeeks={['2026-W42']} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Semanas con factura: S42');
  });
  test('says so when there are none', () => {
    render(<WeekDots headers={headers} activeWeeks={[]} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Semanas con factura: ninguna');
  });
});

describe('QuotaBar', () => {
  test('fill, target and projection positions on one shared scale', () => {
    render(<QuotaBar actual={{ bs: 3500, usd: 70 }} quotaUsd={100} projected={{ bs: 7700, usd: 154 }} currency="usd" />);
    const bar = screen.getByRole('img');
    expect(bar.getAttribute('aria-label')).toContain('$70');
    expect(bar.getAttribute('aria-label')).toContain('meta $100');
    expect(bar.getAttribute('aria-label')).toContain('proyección $154');
    expect(Number(screen.getByTestId('quota-bar-fill').getAttribute('data-pct'))).toBeCloseTo((70 / 154) * 100, 3);
    expect(Number(screen.getByTestId('quota-bar-target').getAttribute('data-pct'))).toBeCloseTo((100 / 154) * 100, 3);
    expect(Number(screen.getByTestId('quota-bar-projection').getAttribute('data-pct'))).toBe(100);
  });
  test('no quota: "Sin meta" and no bar geometry', () => {
    render(<QuotaBar actual={{ bs: 400, usd: 8 }} quotaUsd={null} projected={null} currency="usd" />);
    expect(screen.getByText('Sin meta')).toBeTruthy();
    expect(screen.queryByTestId('quota-bar-fill')).toBeNull();
  });
  test('zero quota is also "Sin meta"', () => {
    render(<QuotaBar actual={{ bs: 400, usd: 8 }} quotaUsd={0} projected={null} currency="usd" />);
    expect(screen.getByText('Sin meta')).toBeTruthy();
  });
  test('unknown USD sales show a dash, never $0', () => {
    render(<QuotaBar actual={{ bs: 400, usd: null }} quotaUsd={100} projected={{ bs: 880, usd: null }} currency="usd" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('—');
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toContain('$0');
    expect(screen.queryByTestId('quota-bar-projection')).toBeNull();
  });
  test('a shared quota (seller with several routes) is labelled as such', () => {
    render(<QuotaBar actual={{ bs: 100, usd: 2 }} quotaUsd={100} projected={null} currency="usd" shared />);
    expect(screen.getByText('Meta compartida')).toBeTruthy();
  });
  test('partial quota (some sellers without a goal) is flagged', () => {
    render(<QuotaBar actual={{ bs: 100, usd: 2 }} quotaUsd={100} projected={null} currency="usd" partial />);
    expect(screen.getByText('Meta parcial')).toBeTruthy();
  });
  test('Bs currency shows the actual in Bs but the quota stays in USD', () => {
    render(<QuotaBar actual={{ bs: 3500, usd: 70 }} quotaUsd={100} projected={null} currency="bs" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Bs. 3.500');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('meta $100');
  });
});

describe('MixBar', () => {
  test('segments are proportional and labelled', () => {
    render(<MixBar visibleLines={['Panaderia', 'Pizza']} segments={[
      { line: 'Panaderia', share: 0.75, sales: { bs: 75, usd: 1.5 } }, { line: 'Otros', share: 0.25, sales: { bs: 25, usd: 0.5 } },
    ]} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Panaderia 75%, Otros 25%');
    expect(screen.getByTestId('mix-Panaderia').getAttribute('style')).toContain('width: 75%');
  });
  test('empty mix renders a placeholder, not an empty bar', () => {
    render(<MixBar visibleLines={[]} segments={[]} />);
    expect(screen.getByText('Sin ventas')).toBeTruthy();
  });
});

describe('NewCustomersChip', () => {
  test('met, in progress, none and no goal', () => {
    const { rerender } = render(<NewCustomersChip info={{ count: 2, quota: 2, partial: false }} />);
    expect(screen.getByText('Nuevos 2 / 2').className).toContain('green');
    rerender(<NewCustomersChip info={{ count: 1, quota: 3, partial: false }} />);
    expect(screen.getByText('Nuevos 1 / 3').className).toContain('amber');
    rerender(<NewCustomersChip info={{ count: 0, quota: 3, partial: false }} />);
    expect(screen.getByText('Nuevos 0 / 3').className).toContain('red');
    rerender(<NewCustomersChip info={{ count: 4, quota: null, partial: false }} />);
    expect(screen.getByText('Nuevos 4 (sin meta)').className).toContain('gray');
  });
  test('partial goal gets an asterisk and a tooltip', () => {
    render(<NewCustomersChip info={{ count: 1, quota: 2, partial: true }} />);
    expect(screen.getByText('Nuevos 1 / 2*').getAttribute('title')).toContain('parcial');
  });
});

describe('MonthPaceStrip', () => {
  test('working days elapsed and share of the month', () => {
    render(<MonthPaceStrip pace={monthPace('2026-10', '2026-10-14')} />);
    expect(screen.getByText(/Día laborable 10 de 22/)).toBeTruthy();
    expect(screen.getByText(/45\.5% del mes/)).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('45');
  });
});

describe('VisitBadge', () => {
  const asOf = '2026-10-14';
  test('overdue shows the days over, ok is al día', () => {
    const { rerender } = render(<VisitBadge visit={visitCompliance({ lastInvoiceDate: '2026-09-20', intervalDays: 7, asOf })} />);
    expect(screen.getByText('Vencida 17 d')).toBeTruthy();
    rerender(<VisitBadge visit={visitCompliance({ lastInvoiceDate: '2026-10-12', intervalDays: 7, asOf })} />);
    expect(screen.getByText('Al día')).toBeTruthy();
  });
  test('no frequency and no invoice are neutral, never "0 d"', () => {
    const { rerender } = render(<VisitBadge visit={visitCompliance({ lastInvoiceDate: '2026-10-12', intervalDays: null, asOf })} />);
    expect(screen.getByText('Sin frecuencia')).toBeTruthy();
    rerender(<VisitBadge visit={visitCompliance({ lastInvoiceDate: null, intervalDays: 7, asOf })} />);
    expect(screen.getByText('Sin compras')).toBeTruthy();
    expect(screen.queryByText(/0 d/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `bun test --isolate --env-file=.env.local "app/(app)/analitica/components/seguimiento/__tests__/visuals.test.tsx"`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`app/(app)/analitica/components/seguimiento/fmt.ts`:
```ts
export function pct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

export function num(n: number): string {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(n);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('es-VE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}
```

`app/(app)/analitica/components/seguimiento/colors.ts`:
```ts
import { OTHER_LINE_LABEL } from '@/lib/seguimiento/category-mix';

// Same palette as tab-productos.tsx's LINEA_COLORS so a línea keeps its colour across tabs.
const LINE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#6b7280'];

export function lineColor(line: string, visible: readonly string[]): string {
  if (line === OTHER_LINE_LABEL) return '#9ca3af';
  const idx = visible.indexOf(line);
  return LINE_COLORS[(idx < 0 ? 0 : idx) % LINE_COLORS.length];
}
```

`app/(app)/analitica/components/seguimiento/visuals.tsx`:
```tsx
'use client';

import type { MixSegment } from '@/lib/seguimiento/category-mix';
import type { MonthPace } from '@/lib/seguimiento/month-pace';
import { quotaBarGeometry } from '@/lib/seguimiento/quotas';
import type { Dual, NewCustomersInfo, WeekCell, WeekHeader } from '@/lib/seguimiento/types';
import type { VisitCompliance } from '@/lib/seguimiento/visit-compliance';
import { moneyLabel } from '../../lib/format';
import type { Currency } from '../../types';
import { lineColor } from './colors';
import { pct } from './fmt';

export function WeekStrip({ weeks, headers }: { weeks: WeekCell[]; headers: WeekHeader[] }) {
  const labelOf = (i: number) => headers[i]?.label ?? weeks[i].yearWeek;
  const summary = weeks.map((w, i) => `${labelOf(i)}: ${w.pct === null ? 'sin datos' : pct(w.pct)}`).join(', ');
  return (
    <div role="img" aria-label={`Activación semanal. ${summary}`} className="flex items-end gap-1 h-12">
      {weeks.map((w, i) => {
        const future = headers[i]?.isFuture ?? false;
        const height = future || w.pct === null ? 20 : Math.max(8, Math.round(w.pct * 100));
        return (
          <div key={w.yearWeek} className="flex flex-col items-center justify-end h-full w-6">
            <div
              data-testid={`week-bar-${w.yearWeek}`}
              data-pct={w.pct === null ? '' : String(w.pct)}
              title={w.pct === null ? `${labelOf(i)}: sin datos` : `${labelOf(i)}: ${w.active} de ${w.assigned} clientes (${pct(w.pct)})`}
              className={`w-full rounded-sm ${future ? 'border border-dashed border-gray-300 bg-gray-50' : 'bg-blue-500'}`}
              style={{ height: `${height}%` }}
            />
            <span className="text-[10px] text-gray-500 leading-none mt-0.5">{labelOf(i)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function WeekDots({ headers, activeWeeks }: { headers: WeekHeader[]; activeWeeks: string[] }) {
  const active = new Set(activeWeeks);
  const names = headers.filter(h => active.has(h.yearWeek)).map(h => h.label);
  return (
    <div role="img" aria-label={`Semanas con factura: ${names.length ? names.join(', ') : 'ninguna'}`} className="flex items-center gap-1">
      {headers.map(h => (
        <span
          key={h.yearWeek}
          title={h.label}
          className={`inline-block w-2.5 h-2.5 rounded-full ${active.has(h.yearWeek) ? 'bg-blue-500' : h.isFuture ? 'border border-dashed border-gray-300' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  );
}

function barTone(ratio: number | null, muted: boolean): string {
  if (muted || ratio === null) return 'bg-gray-400';
  if (ratio >= 1) return 'bg-green-500';
  if (ratio >= 0.8) return 'bg-amber-500';
  return 'bg-red-500';
}

export function QuotaBar({
  actual, quotaUsd, projected, currency, shared = false, partial = false,
}: {
  actual: Dual;
  quotaUsd: number | null;
  projected: Dual | null;
  currency: Currency;
  shared?: boolean;
  partial?: boolean;
}) {
  const geometry = quotaBarGeometry(actual.usd, quotaUsd, projected?.usd ?? null);
  const actualLabel = moneyLabel(actual, currency);
  if (!geometry) {
    return (
      <div className="text-xs text-gray-500">
        <div className="font-medium text-gray-900">{actualLabel}</div>
        <div className="text-gray-400">Sin meta</div>
      </div>
    );
  }
  const projectedLabel = projected ? moneyLabel(projected, currency) : '—';
  const ratio = projected?.usd != null && quotaUsd ? projected.usd / quotaUsd : actual.usd != null && quotaUsd ? actual.usd / quotaUsd : null;
  return (
    <div className="text-xs text-gray-600">
      <div
        role="img"
        aria-label={`Ventas ${actualLabel}, meta $${quotaUsd}, proyección ${projectedLabel}`}
        className="relative h-3 rounded bg-gray-100 overflow-visible"
      >
        <div
          data-testid="quota-bar-fill"
          data-pct={geometry.fillPct}
          className={`absolute inset-y-0 left-0 rounded ${barTone(ratio, shared)}`}
          style={{ width: `${geometry.fillPct}%` }}
        />
        <div
          data-testid="quota-bar-target"
          data-pct={geometry.targetPct}
          title="Meta"
          className="absolute -top-1 -bottom-1 w-0.5 bg-gray-800"
          style={{ left: `${geometry.targetPct}%` }}
        />
        {geometry.projectionPct !== null && (
          <div
            data-testid="quota-bar-projection"
            data-pct={geometry.projectionPct}
            title="Proyección al cierre del mes"
            className="absolute -top-2 text-[10px] leading-none text-blue-700 -translate-x-1/2"
            style={{ left: `${geometry.projectionPct}%` }}
          >
            ▼
          </div>
        )}
      </div>
      <div className="mt-1 flex flex-wrap justify-between gap-x-2">
        <span className="font-medium text-gray-900">{actualLabel}</span>
        <span>Meta ${quotaUsd}</span>
        <span>Proy. {projectedLabel}</span>
      </div>
      {(shared || partial) && (
        <div className="text-amber-700">{shared ? 'Meta compartida' : 'Meta parcial'}</div>
      )}
    </div>
  );
}

export function MixBar({ segments, visibleLines }: { segments: MixSegment[]; visibleLines: readonly string[] }) {
  if (segments.length === 0) return <div className="text-xs text-gray-400">Sin ventas</div>;
  const label = segments.map(s => `${s.line} ${Math.round(s.share * 100)}%`).join(', ');
  return (
    <div role="img" aria-label={label} className="flex h-3 w-full overflow-hidden rounded bg-gray-100">
      {segments.map(s => (
        <div
          key={s.line}
          data-testid={`mix-${s.line}`}
          title={`${s.line}: ${pct(s.share)}`}
          style={{ width: `${s.share * 100}%`, backgroundColor: lineColor(s.line, visibleLines) }}
        />
      ))}
    </div>
  );
}

export function NewCustomersChip({ info }: { info: NewCustomersInfo }) {
  const { count, quota, partial } = info;
  let text: string;
  let tone: string;
  if (quota === null) {
    text = `Nuevos ${count} (sin meta)`;
    tone = 'bg-gray-100 text-gray-600';
  } else {
    text = `Nuevos ${count} / ${quota}${partial ? '*' : ''}`;
    tone = count >= quota ? 'bg-green-100 text-green-800' : count > 0 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
  }
  return (
    <span
      title={partial ? 'Meta parcial: falta la meta de algún vendedor' : 'Clientes registrados en el mes (sin el lote de migración) frente a la meta'}
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {text}
    </span>
  );
}

export function MonthPaceStrip({ pace }: { pace: MonthPace }) {
  const percent = Math.round(pace.fractionElapsed * 100);
  return (
    <div className="flex items-center gap-3 text-xs text-gray-600">
      <span>
        Día laborable {pace.workingDaysElapsed} de {pace.workingDaysInMonth} · {(pace.fractionElapsed * 100).toFixed(1)}% del mes
      </span>
      <div
        role="progressbar"
        aria-label="Avance del mes"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(pace.fractionElapsed * 100)}
        className="h-1.5 w-32 rounded bg-gray-200 overflow-hidden"
      >
        <div className="h-full bg-blue-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function VisitBadge({ visit }: { visit: VisitCompliance }) {
  const base = 'inline-block rounded px-2 py-0.5 text-xs font-medium';
  switch (visit.status) {
    case 'overdue':
      return <span className={`${base} bg-red-100 text-red-800`} title={`${visit.daysSinceLastInvoice} días desde la última factura; frecuencia ${visit.intervalDays} días`}>Vencida {visit.daysOverdue} d</span>;
    case 'ok':
      return <span className={`${base} bg-green-100 text-green-800`} title={`${visit.daysSinceLastInvoice} días desde la última factura`}>Al día</span>;
    case 'no_invoice':
      return <span className={`${base} bg-gray-100 text-gray-600`}>Sin compras</span>;
    default:
      return <span className={`${base} bg-gray-100 text-gray-500`} title="El cliente no tiene frecuencia de visita asignada">Sin frecuencia</span>;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test --isolate --env-file=.env.local "app/(app)/analitica/components/seguimiento/__tests__/visuals.test.tsx"`
Expected: PASS. (`aria-valuenow` for 10/22 floors to 45 while the text shows 45.5%; the `%` string uses `toFixed(1)` = `45.5`.)

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/analitica/components/seguimiento"
git commit -m "feat(seguimiento): week strip, quota bar, mix bar, chips and pace strip components" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 9: Seguimiento tab (toggle, hierarchy, table view, invoice lines, seller profile) and tab registration

**Files:**
- Create: `app/(app)/analitica/components/seguimiento/root-views.tsx`, `app/(app)/analitica/tabs/tab-seguimiento.tsx`
- Modify: `app/(app)/analitica/analitica-client.tsx` (import + one `TABS` entry after `resumen`)
- Test: `app/(app)/analitica/tabs/__tests__/tab-seguimiento.test.tsx`

**Interfaces:**
- Consumes: Task 8 components; Task 7 `QuotaEditor`, `EMPTY_TARGET_ROW`, `saveSellerTargetField`; Task 4 types; `fixtureResponse`, `FIXTURE_INVOICE_LINES` (`__tests__/unit/seguimiento/fixture.ts`); `KpiCard` (`components/kpi-card.tsx`); `moneyLabel`; `SellerProfile` (`tabs/seller-profile.tsx`, with the new `backLabel` prop); `TabComponentProps` shape `{ dateRange, currency, granularity }` of `analitica-client.tsx` (the tab ignores `granularity`).
- Produces: default export `TabSeguimiento({ dateRange, currency }: { dateRange: DateRange; currency: Currency })`; `root-views.tsx` exports `RootCard`, `RootTable`, `CustomerList`, `InvoiceLines`. Fetch contract used (Task 6): `GET /api/dwh/seguimiento?kind=<kind>&dateRange=<enc>` and `...&section=lines&customerCode=<enc>`, `...&section=excluded&kind=<kind>&rootValue=<enc>`. Stable UI strings (e2e and plan C rely on them): heading "Seguimiento de ventas"; toggle group `aria-label="Agrupar por"` with buttons "Vendedor", "Ruta", "Grupo de cliente"; group `aria-label="Vista"` with "Tarjetas", "Tabla"; each root is an `<article aria-label="<root label>">` with a button "Ver clientes"/"Ocultar clientes" (`aria-expanded`); customer buttons expand a region `aria-label="Líneas de factura"`; vendedor roots with a real seller have a "Ver perfil" button; consignment footnote heading "Facturas excluidas — patrón de consignación". The table view is not the default and renders no `<table>` until "Tabla" is chosen. The tab keeps the selected kind/view in component state (not URL params): the shell's `updateParams` only manages `tab/dateRange/granularity/currency`.

- [ ] **Step 1: Write the failing test**

`app/(app)/analitica/tabs/__tests__/tab-seguimiento.test.tsx`:
```tsx
import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { act, cleanup, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FIXTURE_INVOICE_LINES, fixtureResponse } from '../../../../../__tests__/unit/seguimiento/fixture';

const capture = mock((_e: string, _p?: unknown) => {});
mock.module('posthog-js', () => ({ default: { capture } }));
const profileProps: Array<Record<string, unknown>> = [];
mock.module('../seller-profile', () => ({
  default: (props: Record<string, unknown>) => { profileProps.push(props); return <div>Perfil mock {String(props.salesRepKey)}</div>; },
}));
const { default: TabSeguimiento } = await import('../tab-seguimiento');

const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as unknown as Response;
const fetchMock = mock(async (url: string, _init?: RequestInit): Promise<Response> => {
  if (url.includes('section=lines')) return json({ lines: FIXTURE_INVOICE_LINES });
  if (url.includes('section=excluded')) {
    return json({ invoices: [{ customerCode: 'C4', customerName: 'Cadena Raiz', invoiceNumber: 'F9', invoiceDate: '2026-10-05', amountNet: { bs: 9000, usd: 180 } }] });
  }
  const kind = /kind=(\w+)/.exec(url)?.[1] ?? 'vendedor';
  return json(fixtureResponse(kind as 'vendedor' | 'ruta' | 'grupo'));
});
const urls = () => fetchMock.mock.calls.map(c => String(c[0]));

beforeEach(() => {
  fetchMock.mockClear(); capture.mockClear(); profileProps.length = 0;
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);

async function loaded(currency: 'bs' | 'usd' = 'usd') {
  const utils = render(<TabSeguimiento dateRange="30d" currency={currency} />);
  await screen.findByRole('heading', { name: 'Seguimiento de ventas' });
  return utils;
}

describe('TabSeguimiento', () => {
  test('loads vendedor roots by default, with month pace, KPIs and one card per seller', async () => {
    await loaded();
    expect(urls()[0]).toContain('kind=vendedor');
    expect(urls()[0]).toContain('dateRange=30d');
    expect(screen.getByRole('article', { name: 'Ana' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Beto' })).toBeTruthy();
    expect(screen.getByText(/Día laborable 10 de 22/)).toBeTruthy();
    expect(screen.getByText('Ventas brutas')).toBeTruthy();
    expect(screen.getByText('Meta de ventas')).toBeTruthy();
    expect(screen.getByText('Visitas vencidas')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();                      // cards are the default view
  });

  test('each card shows quota bar, projection marker, week strip, mix, new-customers chip and visit badge counts', async () => {
    await loaded();
    const ana = screen.getByRole('article', { name: 'Ana' });
    expect(within(ana).getByRole('img', { name: /Ventas \$70, meta \$100, proyección \$154/ })).toBeTruthy();
    expect(within(ana).getByTestId('quota-bar-projection')).toBeTruthy();
    expect(within(ana).getByRole('img', { name: /Activación semanal/ })).toBeTruthy();
    expect(within(ana).getByRole('img', { name: /Panaderia 86%, Pizza 14%/ })).toBeTruthy();
    expect(within(ana).getByText('Nuevos 1 / 1')).toBeTruthy();
    expect(within(ana).getByText(/Precio prom\./)).toBeTruthy();
  });

  test('Beto has a goal but no frequency: no overdue count is shown as a number', async () => {
    await loaded();
    const beto = screen.getByRole('article', { name: 'Beto' });
    expect(within(beto).getByText('Nuevos 0 (sin meta)')).toBeTruthy();
    expect(within(beto).getByText(/Sin frecuencia/)).toBeTruthy();
  });

  test('switching the root toggle refetches with the new kind', async () => {
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Ruta' }));
    await waitFor(() => expect(urls().some(u => u.includes('kind=ruta'))).toBe(true));
    expect(await screen.findByRole('article', { name: 'Ruta 3' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver perfil' })).toBeNull();     // profile only for sellers
    await userEvent.click(screen.getByRole('button', { name: 'Grupo de cliente' }));
    expect(await screen.findByRole('article', { name: 'Abasto' })).toBeTruthy();
  });

  test('hierarchy: expand a seller, then a customer to see its invoice lines', async () => {
    await loaded();
    const ana = screen.getByRole('article', { name: 'Ana' });
    await userEvent.click(within(ana).getByRole('button', { name: 'Ver clientes' }));
    expect(within(ana).getByRole('button', { name: /Cliente Uno/ })).toBeTruthy();
    await userEvent.click(within(ana).getByRole('button', { name: /Cliente Uno/ }));
    const region = await within(ana).findByRole('region', { name: 'Líneas de factura' });
    expect(urls().some(u => u.includes('section=lines') && u.includes('customerCode=C1'))).toBe(true);
    expect(within(region).getByText('F000101')).toBeTruthy();
    expect(within(region).getByText('Pizza Familiar')).toBeTruthy();
  });

  test('table view is one click away and lists every root with its numbers', async () => {
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Tabla' }));
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Ana')).toBeTruthy();
    expect(within(table).getByRole('columnheader', { name: 'Ventas' })).toBeTruthy();
    expect(within(table).getByRole('columnheader', { name: 'S41' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Tarjetas' }));
    expect(screen.queryByRole('table')).toBeNull();
  });

  test('"Ver perfil" opens the seller profile with the Seguimiento back label', async () => {
    await loaded();
    await userEvent.click(within(screen.getByRole('article', { name: 'Ana' })).getByRole('button', { name: 'Ver perfil' }));
    expect(await screen.findByText('Perfil mock 1')).toBeTruthy();
    expect(profileProps.at(-1)).toMatchObject({ salesRepKey: '1', dateRange: '30d', currency: 'usd', backLabel: 'Seguimiento' });
    await act(async () => { (profileProps.at(-1)!.onBack as () => void)(); });
    expect(await screen.findByRole('heading', { name: 'Seguimiento de ventas' })).toBeTruthy();
  });

  test('inline quota editing sends the FULL row for the response month and refetches without cache', async () => {
    await loaded();
    const ana = screen.getByRole('article', { name: 'Ana' });
    await userEvent.click(within(ana).getByRole('button', { name: 'Editar metas' }));
    fetchMock.mockClear();
    await userEvent.click(within(ana).getByRole('button', { name: 'Editar meta (100USD)' }));
    const input = within(ana).getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '120');
    await userEvent.click(within(ana).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(c => String(c[0]) === '/api/admin/seller-targets')).toBe(true));
    const post = fetchMock.mock.calls.find(c => String(c[0]) === '/api/admin/seller-targets')!;
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual({
      salesRepKey: '1', periodMonth: '2026-10', salesQuotaUsd: 120, weeklyVisitQuota: 2, newCustomerQuota: 1,
    });
    await waitFor(() => expect(fetchMock.mock.calls.filter(c => String(c[0]).includes('/api/dwh/seguimiento')).length).toBeGreaterThan(0));
    const refetch = fetchMock.mock.calls.find(c => String(c[0]).includes('/api/dwh/seguimiento'))!;
    expect((refetch[1] as RequestInit | undefined)?.cache).toBe('no-store');
  });

  test('consignment footnote lists the excluded invoices of that seller on demand', async () => {
    await loaded();
    expect(screen.getByRole('heading', { name: 'Facturas excluidas — patrón de consignación' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Beto: .* excluidos/ }));
    expect(await screen.findByText('F9')).toBeTruthy();
    expect(urls().some(u => u.includes('section=excluded') && u.includes('rootValue=2'))).toBe(true);
  });

  test('Bs currency shows Bs amounts on the cards', async () => {
    await loaded('bs');
    expect(within(screen.getByRole('article', { name: 'Ana' })).getAllByText(/Bs\. 3\.500/).length).toBeGreaterThan(0);
  });

  test('server error shows the message and no cards', async () => {
    fetchMock.mockImplementationOnce(async () => json({ error: 'Error al consultar el Data Warehouse' }, false, 500));
    render(<TabSeguimiento dateRange="30d" currency="usd" />);
    expect(await screen.findByText('Error al consultar el Data Warehouse')).toBeTruthy();
    expect(screen.queryByRole('article')).toBeNull();
  });

  test('a month without data shows an empty state, not zeros', async () => {
    fetchMock.mockImplementationOnce(async () => json({ ...fixtureResponse('vendedor'), roots: [] }));
    render(<TabSeguimiento dateRange="30d" currency="usd" />);
    expect(await screen.findByText('Sin datos para este mes.')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `bun test --isolate --env-file=.env.local "app/(app)/analitica/tabs/__tests__/tab-seguimiento.test.tsx"`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `root-views.tsx`**

`app/(app)/analitica/components/seguimiento/root-views.tsx`:
```tsx
'use client';

import { Fragment, type ReactNode } from 'react';
import type {
  RootMetrics, SeguimientoCustomer, SeguimientoInvoiceLine, SeguimientoRoot, WeekHeader,
} from '@/lib/seguimiento/types';
import { moneyLabel } from '../../lib/format';
import type { Currency } from '../../types';
import { num, pct } from './fmt';
import { MixBar, NewCustomersChip, QuotaBar, VisitBadge, WeekDots, WeekStrip } from './visuals';

export function overdueLabel(m: RootMetrics): string {
  const c = m.compliance;
  if (c.ok + c.overdue === 0) return c.noInterval > 0 ? 'Sin frecuencia' : '—';
  return `${c.overdue} vencida${c.overdue === 1 ? '' : 's'} de ${c.ok + c.overdue}`;
}

export function RootCard({
  title, subtitle, metrics, headers, visibleLines, currency, expanded, onToggle, actions, footer, children,
}: {
  title: string;
  subtitle?: string;
  metrics: RootMetrics;
  headers: WeekHeader[];
  visibleLines: readonly string[];
  currency: Currency;
  expanded: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  footer?: ReactNode;      // always rendered (e.g. the inline quota editors); `children` only when expanded
  children?: ReactNode;
}) {
  return (
    <article aria-label={title} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{metrics.customerCount} clientes{subtitle ? ` · ${subtitle}` : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <NewCustomersChip info={metrics.newCustomers} />
          {actions}
          <button
            onClick={onToggle}
            aria-expanded={expanded}
            className="text-xs text-blue-600 hover:underline"
          >
            {expanded ? 'Ocultar clientes' : 'Ver clientes'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
        <div>
          <div className="text-[11px] font-semibold uppercase text-gray-500 mb-1">Activación semanal</div>
          <WeekStrip weeks={metrics.weeks} headers={headers} />
        </div>
        <div className="md:col-span-2">
          <div className="text-[11px] font-semibold uppercase text-gray-500 mb-1">Ventas vs meta del mes</div>
          <QuotaBar
            actual={metrics.sales} quotaUsd={metrics.salesQuotaUsd} projected={metrics.projected}
            currency={currency} shared={metrics.quotaShared} partial={metrics.quotaPartial}
          />
        </div>
        <div className="space-y-1">
          <div className="text-xs text-gray-600">
            Precio prom.: <span className="font-medium text-gray-900">{metrics.avgPrice ? moneyLabel(metrics.avgPrice, currency) : '—'}</span>
          </div>
          <div className="text-xs text-gray-600">Visitas: <span className="font-medium text-gray-900">{overdueLabel(metrics)}</span></div>
        </div>
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase text-gray-500 mb-1">Mezcla por línea</div>
        <MixBar segments={metrics.mix} visibleLines={visibleLines} />
      </div>
      {footer}
      {expanded && children}
    </article>
  );
}

export function InvoiceLines({ lines, currency }: { lines: SeguimientoInvoiceLine[]; currency: Currency }) {
  if (lines.length === 0) return <div className="text-xs text-gray-400 py-1">Sin facturas en el mes.</div>;
  const byInvoice = new Map<string, SeguimientoInvoiceLine[]>();
  for (const l of lines) byInvoice.set(l.invoiceNumber, [...(byInvoice.get(l.invoiceNumber) ?? []), l]);
  return (
    <table className="min-w-full text-xs">
      <thead>
        <tr className="text-left text-gray-500">
          <th className="pr-3 py-1">Factura</th><th className="pr-3 py-1">Fecha</th><th className="pr-3 py-1">Producto</th>
          <th className="pr-3 py-1">Línea</th><th className="text-right pr-3 py-1">Cant.</th>
          <th className="text-right pr-3 py-1">Precio</th><th className="text-right py-1">Monto</th>
        </tr>
      </thead>
      <tbody>
        {[...byInvoice].map(([invoice, rows]) => (
          <Fragment key={invoice}>
            {rows.map((l, i) => (
              <tr key={`${invoice}-${l.lineNumber}`} className="text-gray-700">
                <td className="pr-3 py-0.5">{i === 0 ? invoice : ''}</td>
                <td className="pr-3 py-0.5">{i === 0 ? l.invoiceDate : ''}</td>
                <td className="pr-3 py-0.5">{l.productName}</td>
                <td className="pr-3 py-0.5">{l.lineName ?? '—'}</td>
                <td className="text-right pr-3 py-0.5">{num(l.quantity)}</td>
                <td className="text-right pr-3 py-0.5">{l.unitPrice ? moneyLabel(l.unitPrice, currency) : '—'}</td>
                <td className="text-right py-0.5">{moneyLabel(l.amount, currency)}</td>
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

export function CustomerList({
  customers, headers, visibleLines, currency, openCustomer, onOpenCustomer, linesFor,
}: {
  customers: SeguimientoCustomer[];
  headers: WeekHeader[];
  visibleLines: readonly string[];
  currency: Currency;
  openCustomer: string | null;
  onOpenCustomer: (code: string) => void;
  linesFor: (code: string) => { loading: boolean; error: string | null; lines: SeguimientoInvoiceLine[] };
}) {
  if (customers.length === 0) return <div className="text-xs text-gray-400 py-2">Sin clientes.</div>;
  return (
    <ul className="divide-y divide-gray-100 border-t border-gray-100">
      {customers.map(c => {
        const open = openCustomer === c.customerCode;
        const state = open ? linesFor(c.customerCode) : null;
        return (
          <li key={c.customerCode} className="py-2">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-center text-xs">
              <button
                onClick={() => onOpenCustomer(c.customerCode)}
                aria-expanded={open}
                className="text-left text-blue-700 hover:underline md:col-span-2"
              >
                {c.customerName}
              </button>
              <WeekDots headers={headers} activeWeeks={c.activeWeeks} />
              <div className="text-gray-900 font-medium">{moneyLabel(c.sales, currency)}</div>
              <MixBar segments={c.mix} visibleLines={visibleLines} />
              <div className="flex items-center gap-1 flex-wrap">
                {c.isNew && <span className="rounded bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[10px] font-medium">Nuevo</span>}
                <VisitBadge visit={c.visit} />
              </div>
            </div>
            {open && (
              <section aria-label="Líneas de factura" className="mt-2 ml-2 overflow-x-auto">
                {state?.loading ? <div className="text-xs text-gray-400">Cargando…</div>
                  : state?.error ? <div className="text-xs text-red-600">{state.error}</div>
                  : <InvoiceLines lines={state?.lines ?? []} currency={currency} />}
              </section>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function RootTable({
  roots, total, headers, currency, renderExpanded, expandedValue, onToggle,
}: {
  roots: SeguimientoRoot[];
  total: RootMetrics;
  headers: WeekHeader[];
  currency: Currency;
  renderExpanded: (root: SeguimientoRoot) => ReactNode;
  expandedValue: string | null;
  onToggle: (value: string) => void;
}) {
  const metricsRow = (label: ReactNode, m: RootMetrics, key: string) => (
    <tr key={key} className="border-t border-gray-100 text-gray-700">
      <td className="px-3 py-2 font-medium text-gray-900">{label}</td>
      <td className="px-3 py-2 text-right">{m.customerCount}</td>
      <td className="px-3 py-2 text-right">{moneyLabel(m.sales, currency)}</td>
      <td className="px-3 py-2 text-right">{m.salesQuotaUsd === null ? '—' : `$${m.salesQuotaUsd}`}</td>
      <td className="px-3 py-2 text-right">{pct(m.attainment)}</td>
      <td className="px-3 py-2 text-right">{m.projected ? moneyLabel(m.projected, currency) : '—'}</td>
      <td className="px-3 py-2 text-right">{m.avgPrice ? moneyLabel(m.avgPrice, currency) : '—'}</td>
      {m.weeks.map(w => <td key={w.yearWeek} className="px-3 py-2 text-right">{pct(w.pct)}</td>)}
      <td className="px-3 py-2 text-right">{m.newCustomers.count}{m.newCustomers.quota === null ? '' : ` / ${m.newCustomers.quota}`}</td>
      <td className="px-3 py-2 text-right">{overdueLabel(m)}</td>
    </tr>
  );
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-gray-500 text-left">
            <th className="px-3 py-2">Raíz</th>
            <th className="px-3 py-2 text-right">Clientes</th>
            <th className="px-3 py-2 text-right">Ventas</th>
            <th className="px-3 py-2 text-right">Meta</th>
            <th className="px-3 py-2 text-right">Avance</th>
            <th className="px-3 py-2 text-right">Proyección</th>
            <th className="px-3 py-2 text-right">Precio prom.</th>
            {headers.map(h => <th key={h.yearWeek} className="px-3 py-2 text-right">{h.label}</th>)}
            <th className="px-3 py-2 text-right">Nuevos</th>
            <th className="px-3 py-2 text-right">Visitas</th>
          </tr>
        </thead>
        <tbody>
          {metricsRow('Total', total, 'total')}
          {roots.map(r => (
            <Fragment key={r.value}>
              {metricsRow(
                <button onClick={() => onToggle(r.value)} aria-expanded={expandedValue === r.value} className="text-blue-700 hover:underline text-left">
                  {r.label}
                </button>,
                r, r.value,
              )}
              {expandedValue === r.value && (
                <tr><td colSpan={9 + headers.length} className="px-3 py-2 bg-gray-50">{renderExpanded(r)}</td></tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```
(The `colSpan` is 7 fixed columns (Raíz, Clientes, Ventas, Meta, Avance, Proyección, Precio prom.) + `headers.length` week columns + 2 trailing columns (Nuevos, Visitas) = `9 + headers.length`.)

- [ ] **Step 4: Implement the tab**

`app/(app)/analitica/tabs/tab-seguimiento.tsx`:
```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import posthog from 'posthog-js';
import type { RootKind, SeguimientoExcludedInvoice, SeguimientoInvoiceLine, SeguimientoResponse, SeguimientoRoot } from '@/lib/seguimiento/types';
import { KpiCard } from '../components/kpi-card';
import { EMPTY_TARGET_ROW, QuotaEditor, saveSellerTargetField, type SellerTargetRow } from '../components/quota-editor';
import { monthLabel, pct } from '../components/seguimiento/fmt';
import { CustomerList, overdueLabel, RootCard, RootTable } from '../components/seguimiento/root-views';
import { MonthPaceStrip } from '../components/seguimiento/visuals';
import { moneyLabel } from '../lib/format';
import type { Currency, DateRange } from '../types';
import SellerProfile from './seller-profile';

const KIND_OPTIONS: { value: RootKind; label: string }[] = [
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'ruta', label: 'Ruta' },
  { value: 'grupo', label: 'Grupo de cliente' },
];

type View = 'cards' | 'table';
interface LinesState { loading: boolean; error: string | null; lines: SeguimientoInvoiceLine[] }

function ToggleGroup<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
      {options.map(o => (
        <button
          key={o.value}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 text-sm font-medium rounded transition-colors ${value === o.value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function TabSeguimiento({ dateRange, currency }: { dateRange: DateRange; currency: Currency }) {
  const [kind, setKind] = useState<RootKind>('vendedor');
  const [view, setView] = useState<View>('cards');
  const [data, setData] = useState<SeguimientoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [expandedRoot, setExpandedRoot] = useState<string | null>(null);
  const [openCustomer, setOpenCustomer] = useState<string | null>(null);
  const [linesByCustomer, setLinesByCustomer] = useState<Record<string, LinesState>>({});
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
  const [excludedFor, setExcludedFor] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<{ loading: boolean; invoices: SeguimientoExcludedInvoice[] }>({ loading: false, invoices: [] });
  const [editingMetas, setEditingMetas] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({ kind, dateRange });
        // After a quota save the 15-minute private cache would serve the pre-save response.
        const res = await fetch(`/api/dwh/seguimiento?${params.toString()}`, reloadToken > 0 ? { cache: 'no-store' } : undefined);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        const body: SeguimientoResponse = await res.json();
        if (cancelled) return;
        setData(body);
        setExpandedRoot(null);
        setOpenCustomer(null);
        setLinesByCustomer({});
        setExcludedFor(null);
      } catch {
        if (!cancelled) setError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [kind, dateRange, reloadToken]);

  const changeKind = (next: RootKind) => {
    posthog.capture('seguimiento_root_changed', { kind: next });
    setKind(next);
  };
  const changeView = (next: View) => {
    posthog.capture('seguimiento_view_changed', { view: next });
    setView(next);
  };

  const openCustomerLines = useCallback(async (code: string) => {
    if (openCustomer === code) { setOpenCustomer(null); return; }
    setOpenCustomer(code);
    if (linesByCustomer[code]) return;
    setLinesByCustomer(prev => ({ ...prev, [code]: { loading: true, error: null, lines: [] } }));
    try {
      const params = new URLSearchParams({ section: 'lines', customerCode: code, dateRange, kind });
      const res = await fetch(`/api/dwh/seguimiento?${params.toString()}`);
      if (!res.ok) throw new Error('lines');
      const body: { lines: SeguimientoInvoiceLine[] } = await res.json();
      setLinesByCustomer(prev => ({ ...prev, [code]: { loading: false, error: null, lines: body.lines } }));
    } catch {
      setLinesByCustomer(prev => ({ ...prev, [code]: { loading: false, error: 'No se pudieron cargar las facturas', lines: [] } }));
    }
  }, [openCustomer, linesByCustomer, dateRange, kind]);

  async function toggleExcluded(root: SeguimientoRoot) {
    if (excludedFor === root.value) { setExcludedFor(null); return; }
    setExcludedFor(root.value);
    setExcluded({ loading: true, invoices: [] });
    try {
      const params = new URLSearchParams({ section: 'excluded', kind, rootValue: root.value, dateRange });
      const res = await fetch(`/api/dwh/seguimiento?${params.toString()}`);
      const body: { invoices?: SeguimientoExcludedInvoice[] } = res.ok ? await res.json() : {};
      setExcluded({ loading: false, invoices: body.invoices ?? [] });
    } catch {
      setExcluded({ loading: false, invoices: [] });
    }
  }

  if (selectedSeller) {
    return (
      <SellerProfile
        salesRepKey={selectedSeller}
        dateRange={dateRange}
        currency={currency}
        onBack={() => setSelectedSeller(null)}
        backLabel="Seguimiento"
      />
    );
  }

  if (loading && !data) return <div className="p-6 text-sm text-gray-500">Cargando…</div>;
  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      </div>
    );
  }
  if (!data) return null;

  const currentWeekIdx = data.weeks.reduce((last, w, i) => (w.isFuture ? last : i), -1);
  const currentWeek = currentWeekIdx >= 0 ? data.total.weeks[currentWeekIdx] : null;
  const total = data.total;
  const rootsWithExcluded = data.roots.filter(r => r.excludedSales.bs > 0);

  const saveField = async (root: SeguimientoRoot, field: keyof SellerTargetRow, value: number) => {
    if (!root.salesRepKey) return false;
    const ok = await saveSellerTargetField({
      salesRepKey: root.salesRepKey, periodMonth: data.month, current: root.targets ?? EMPTY_TARGET_ROW, field, value,
    });
    if (ok) setReloadToken(t => t + 1);
    return ok;
  };

  const customersOf = (root: SeguimientoRoot) => (
    <CustomerList
      customers={root.customers}
      headers={data.weeks}
      visibleLines={data.visibleLines}
      currency={currency}
      openCustomer={openCustomer}
      onOpenCustomer={openCustomerLines}
      linesFor={code => linesByCustomer[code] ?? { loading: true, error: null, lines: [] }}
    />
  );

  return (
    <div className="p-6 max-w-7xl space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Seguimiento de ventas</h2>
          <p className="text-xs text-gray-500">
            {monthLabel(data.month)} · al {data.asOf}. Ventas brutas sin IVA, sin consignación a nivel de cadena; meta y proyección del mes.
          </p>
          <div className="mt-1"><MonthPaceStrip pace={data.pace} /></div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ToggleGroup label="Agrupar por" value={kind} options={KIND_OPTIONS} onChange={changeKind} />
          <ToggleGroup<View> label="Vista" value={view} options={[{ value: 'cards', label: 'Tarjetas' }, { value: 'table', label: 'Tabla' }]} onChange={changeView} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Ventas brutas" value={moneyLabel(total.sales, currency)} subtitle={total.avgPrice ? `Precio prom. ${moneyLabel(total.avgPrice, currency)}` : undefined} />
        <KpiCard
          label="Meta de ventas"
          value={total.salesQuotaUsd === null ? 'Sin meta' : `$${total.salesQuotaUsd}`}
          subtitle={total.attainment === null ? undefined : `${pct(total.attainment)} de la meta`}
          tone={total.attainment !== null && total.attainment < 0.8 ? 'warn' : 'default'}
        />
        <KpiCard
          label="Proyección al cierre"
          value={total.projected ? moneyLabel(total.projected, currency) : '—'}
          subtitle={total.projectedAttainment === null ? undefined : `${pct(total.projectedAttainment)} de la meta`}
        />
        <KpiCard
          label="Clientes activos (semana actual)"
          value={currentWeek && currentWeek.pct !== null ? pct(currentWeek.pct) : '—'}
          subtitle={currentWeek ? `${currentWeek.active} de ${currentWeek.assigned}` : undefined}
        />
        <KpiCard
          label="Nuevos clientes"
          value={`${total.newCustomers.count}${total.newCustomers.quota === null ? '' : ` / ${total.newCustomers.quota}`}`}
        />
        <KpiCard label="Visitas vencidas" value={overdueLabel(total)} />
      </div>

      {data.roots.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-gray-400">Sin datos para este mes.</div>
      ) : view === 'table' ? (
        <RootTable
          roots={data.roots} total={total} headers={data.weeks} currency={currency}
          expandedValue={expandedRoot} onToggle={v => setExpandedRoot(expandedRoot === v ? null : v)}
          renderExpanded={customersOf}
        />
      ) : (
        <div className="space-y-3">
          {data.roots.map(root => (
            <RootCard
              key={root.value}
              title={root.label}
              subtitle={kind === 'vendedor' ? undefined : root.sellerKeys.length > 1 ? `${root.sellerKeys.length} vendedores` : undefined}
              metrics={root}
              headers={data.weeks}
              visibleLines={data.visibleLines}
              currency={currency}
              expanded={expandedRoot === root.value}
              onToggle={() => setExpandedRoot(expandedRoot === root.value ? null : root.value)}
              actions={root.salesRepKey ? (
                <>
                  <button onClick={() => setSelectedSeller(root.salesRepKey)} className="text-xs text-blue-600 hover:underline">Ver perfil</button>
                  <button onClick={() => setEditingMetas(editingMetas === root.value ? null : root.value)} className="text-xs text-blue-600 hover:underline">Editar metas</button>
                </>
              ) : undefined}
              footer={root.salesRepKey && editingMetas === root.value ? (
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 border-t border-gray-100 pt-2">
                  <span>Ventas: <QuotaEditor currentValue={root.targets?.salesQuotaUsd ?? null} field="salesQuotaUsd" suffix="USD" onSave={(f, v) => saveField(root, f, v)} /></span>
                  <span>Visitas por semana: <QuotaEditor currentValue={root.targets?.weeklyVisitQuota ?? null} field="weeklyVisitQuota" onSave={(f, v) => saveField(root, f, v)} /></span>
                  <span>Clientes nuevos: <QuotaEditor currentValue={root.targets?.newCustomerQuota ?? null} field="newCustomerQuota" onSave={(f, v) => saveField(root, f, v)} /></span>
                </div>
              ) : undefined}
            >
              {customersOf(root)}
            </RootCard>
          ))}
        </div>
      )}

      {rootsWithExcluded.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-1">Facturas excluidas — patrón de consignación</h2>
          <p className="text-xs text-gray-500 mb-3">
            Facturas emitidas de forma agregada a nivel de cadena (no por tienda): no es posible atribuir de forma confiable qué
            vendedor generó la venta. Se excluyen de las ventas, la meta y la activación de arriba en vez de estimarse.
          </p>
          <ul className="space-y-2">
            {rootsWithExcluded.map(root => (
              <li key={root.value} className="text-sm">
                <button onClick={() => toggleExcluded(root)} className="text-amber-700 hover:text-amber-900 underline">
                  {root.label}: {moneyLabel(root.excludedSales, currency)} excluidos
                </button>
                {excludedFor === root.value && (
                  <div className="mt-2 ml-4 text-xs">
                    {excluded.loading ? <div className="text-gray-400 py-1">Cargando…</div>
                      : excluded.invoices.length === 0 ? <div className="text-gray-400 py-1">Sin facturas.</div>
                      : (
                        <table className="min-w-full">
                          <thead><tr className="text-gray-500"><th className="text-left pr-4 py-1">Cliente</th><th className="text-left pr-4 py-1">Factura</th><th className="text-left pr-4 py-1">Fecha</th><th className="text-right py-1">Monto</th></tr></thead>
                          <tbody>
                            {excluded.invoices.map(inv => (
                              <tr key={inv.invoiceNumber} className="text-gray-700">
                                <td className="pr-4 py-1">{inv.customerName}</td><td className="pr-4 py-1">{inv.invoiceNumber}</td>
                                <td className="pr-4 py-1">{inv.invoiceDate}</td><td className="text-right py-1">{moneyLabel(inv.amountNet, currency)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```
Notes for the implementer: (1) the consignment button text must read `<label>: <money> excluidos` so the test regex `/Beto: .* excluidos/` and the old e2e idiom (`button` containing "excluidos") match; (2) `QuotaEditor` button names come from the extracted component (`Editar meta (100USD)` for `suffix="USD"`, i.e. `Editar meta (${value}${suffix})`).

- [ ] **Step 5: Register the tab**

In `app/(app)/analitica/analitica-client.tsx`: add `import TabSeguimiento from './tabs/tab-seguimiento';` after the `TabResumen` import and insert, right after the `resumen` entry in `TABS`:
```ts
  { key: 'seguimiento', label: 'Seguimiento', component: TabSeguimiento },
```
Do NOT remove `vendedores` or any other tab. Do not add `'seguimiento'` to `GRANULARITY_TABS`.

- [ ] **Step 6: Run to verify it passes**

Run: `bun test --isolate --env-file=.env.local "app/(app)/analitica/tabs/__tests__/tab-seguimiento.test.tsx"`
Expected: PASS.
Run: `bun run test:components`
Expected: PASS (existing component tests plus the new ones).
Run: `bunx tsc --noEmit && bunx eslint "app/(app)/analitica" lib/seguimiento app/api/dwh/seguimiento`
Expected: clean. If the React Compiler lint complains about `openCustomerLines`'s `useCallback`, drop `useCallback` (same note as `analitica-client.tsx`'s `handleDateRangeChange`).

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/analitica/components/seguimiento/root-views.tsx" "app/(app)/analitica/tabs/tab-seguimiento.tsx" "app/(app)/analitica/tabs/__tests__/tab-seguimiento.test.tsx" "app/(app)/analitica/analitica-client.tsx"
git commit -m "feat(seguimiento): Seguimiento tab with root toggle, drill-down, table view and quota editing" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 10: Help content, Playwright e2e (mocked default suite + `@mssql`), docs and final verification

**Files:**
- Modify: `content/help/analitica-definiciones.md` (new "## Seguimiento" section; no new help slug)
- Create: `e2e/seguimiento.spec.ts`
- Modify: `AGENTS.md` (directory map + a short "Seguimiento" paragraph), `INSTRUCTIONS.md` only if it lists Analítica tabs (check with `grep -n "Vendedores" INSTRUCTIONS.md`; if it does not, leave it)
- Test: `e2e/seguimiento.spec.ts` itself

**Interfaces:**
- Consumes: the stable UI strings from Task 9; `fixtureResponse`, `FIXTURE_INVOICE_LINES` from `__tests__/unit/seguimiento/fixture.ts` (type-only imports of lib types are erased by Playwright's TS transpile); the `adminPage` fixture from `e2e/fixtures.ts` (admin bypasses the `dwh` module gate; `user@e2e.test` has no `dwh` grant).
- Produces: help section consumed by the existing `HelpPanel page="analitica-definiciones"` (all Analítica tabs share that single help page: `app/api/help/[page]/route.ts` allowlists `analitica-definiciones` and no per-tab pages exist for analytics, so no new slug or allowlist entry is added); an e2e spec with two describes: `seguimiento (mocked API)` (default suite) and `seguimiento @mssql` (real DWH).

- [ ] **Step 1: Help content**

Append to `content/help/analitica-definiciones.md`, before "## Cómo cuadrar con un Excel de Profit":
```markdown
## Seguimiento

La pestaña **Seguimiento** replica el cuadro de seguimiento por ruta: para un mes muestra, por **vendedor**, **ruta** o **grupo de cliente**, la activación semanal, el avance contra la meta con su proyección, el precio promedio, la mezcla por línea y los clientes nuevos. Haga clic en un vendedor, ruta o grupo para ver sus clientes y en un cliente para ver sus líneas de factura. El botón **Tabla** muestra lo mismo en forma de tabla.

- **Mes de referencia:** el mes en que termina el rango de fechas elegido (con "30 días" o "12 meses", el mes actual). Las ventas y la meta son de ese mes, hasta hoy.
- **Ventas:** ventas brutas sin IVA, antes de devoluciones, sin la facturación agregada de consignación (que se lista aparte, igual que antes en Vendedores).
- **Cliente asignado:** el cliente pertenece al vendedor, ruta o grupo que tiene hoy en su ficha del ERP; las facturas antiguas siguen al cliente. Los clientes inactivos no cuentan.
- **Cliente activo en una semana:** tuvo al menos una factura esa semana ISO (lunes a domingo, aunque la semana empiece en el mes anterior). Porcentaje = clientes activos ÷ clientes asignados.
- **Proyección:** ventas del mes ÷ (días laborables transcurridos ÷ días laborables del mes). Solo se excluyen sábados y domingos; los feriados no se consideran.
- **Meta:** las metas se definen por vendedor (botón "Editar metas" en la tarjeta del vendedor). Para rutas y grupos es la suma de las metas de sus vendedores; si un vendedor atiende varias rutas, la meta aparece como "compartida" porque no se reparte entre ellas.
- **Precio promedio:** ventas ÷ unidades vendidas del período (las unidades de distintas líneas se suman tal como se facturan).
- **Mezcla por línea:** participación de cada línea de producto en las ventas; las líneas se leen de Profit Plus, de modo que una línea nueva aparece sola cuando tenga ventas. Las líneas menores se agrupan en "Otros".
- **Clientes nuevos:** clientes registrados en el mes, sin contar el lote de clientes migrado en la puesta en marcha, frente a la meta de clientes nuevos.
- **Visita vencida:** el cliente lleva más días sin comprar que su frecuencia de visita (semanal 7, quincenal 15, mensual 30). Un cliente sin frecuencia asignada nunca figura como vencido ("Sin frecuencia").
```
Run: `bun test --isolate --env-file=.env.local app/api/help` (if a help test exists; otherwise skip) and `grep -n "^## Seguimiento" content/help/analitica-definiciones.md`.
Expected: one match.

- [ ] **Step 2: Write the e2e spec**

`e2e/seguimiento.spec.ts`:
```ts
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { FIXTURE_INVOICE_LINES, fixtureResponse } from '../__tests__/unit/seguimiento/fixture';

// Default suite (no DWH available): the API is mocked with page.route, so these tests cover the
// UI behaviour of the Seguimiento tab end to end (toggle, drill-down, table view, quota editing,
// error state). Real-data coverage is the @mssql describe at the bottom.
// /analitica is gated by hasDwhAccess; only the admin role bypasses it, so use adminPage.

async function mockApi(page: Page, opts: { fail?: boolean } = {}) {
  const seen: string[] = [];
  const posts: unknown[] = [];
  await page.route(/\/api\/dwh\/seguimiento(\?|$)/, async route => {
    const url = new URL(route.request().url());
    seen.push(url.search);
    if (opts.fail) return route.fulfill({ status: 500, json: { error: 'Error al consultar el Data Warehouse' } });
    if (url.searchParams.get('section') === 'lines') return route.fulfill({ json: { lines: FIXTURE_INVOICE_LINES } });
    if (url.searchParams.get('section') === 'excluded') {
      return route.fulfill({ json: { invoices: [{ customerCode: 'C4', customerName: 'Cadena Raiz', invoiceNumber: 'F9', invoiceDate: '2026-10-05', amountNet: { bs: 9000, usd: 180 } }] } });
    }
    const kind = (url.searchParams.get('kind') ?? 'vendedor') as 'vendedor' | 'ruta' | 'grupo';
    return route.fulfill({ json: fixtureResponse(kind) });
  });
  await page.route('**/api/admin/seller-targets', async route => {
    if (route.request().method() === 'POST') {
      posts.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, json: { id: 1 } });
    }
    return route.fulfill({ json: null });
  });
  return { seen, posts };
}

test.describe('seguimiento (mocked API)', () => {
  test('renders seller cards with quota bar, projection marker and week strip; table is hidden', async ({ adminPage }) => {
    await mockApi(adminPage);
    await adminPage.goto('/analitica?tab=seguimiento');
    await expect(adminPage.getByRole('heading', { name: 'Seguimiento de ventas' })).toBeVisible({ timeout: 15_000 });
    const ana = adminPage.getByRole('article', { name: 'Ana' });
    await expect(ana).toBeVisible();
    await expect(ana.getByRole('img', { name: /meta \$100, proyección \$154/ })).toBeVisible();
    await expect(ana.getByTestId('quota-bar-projection')).toBeVisible();
    await expect(ana.getByRole('img', { name: /Activación semanal/ })).toBeVisible();
    await expect(ana.getByText('Nuevos 1 / 1')).toBeVisible();
    await expect(adminPage.getByText(/Día laborable 10 de 22/)).toBeVisible();
    await expect(adminPage.locator('table')).toHaveCount(0);
  });

  test('root toggle switches to routes and groups', async ({ adminPage }) => {
    const { seen } = await mockApi(adminPage);
    await adminPage.goto('/analitica?tab=seguimiento');
    await expect(adminPage.getByRole('article', { name: 'Ana' })).toBeVisible({ timeout: 15_000 });
    await adminPage.getByRole('button', { name: 'Ruta', exact: true }).click();
    await expect(adminPage.getByRole('article', { name: 'Ruta 3' })).toBeVisible();
    await adminPage.getByRole('button', { name: 'Grupo de cliente' }).click();
    await expect(adminPage.getByRole('article', { name: 'Abasto' })).toBeVisible();
    expect(seen.some(s => s.includes('kind=ruta'))).toBe(true);
    expect(seen.some(s => s.includes('kind=grupo'))).toBe(true);
  });

  test('drill-down: seller -> customer -> invoice lines', async ({ adminPage }) => {
    await mockApi(adminPage);
    await adminPage.goto('/analitica?tab=seguimiento');
    const ana = adminPage.getByRole('article', { name: 'Ana' });
    await ana.getByRole('button', { name: 'Ver clientes' }).click();
    await ana.getByRole('button', { name: /Cliente Uno/ }).click();
    const lines = ana.getByRole('region', { name: 'Líneas de factura' });
    await expect(lines.getByText('F000101')).toBeVisible();
    await expect(lines.getByText('Pizza Familiar')).toBeVisible();
  });

  test('table view is one click away and back', async ({ adminPage }) => {
    await mockApi(adminPage);
    await adminPage.goto('/analitica?tab=seguimiento');
    await expect(adminPage.getByRole('article', { name: 'Ana' })).toBeVisible({ timeout: 15_000 });
    await adminPage.getByRole('button', { name: 'Tabla' }).click();
    const table = adminPage.locator('table').first();
    await expect(table.getByRole('columnheader', { name: 'Proyección' })).toBeVisible();
    await expect(table.getByText('Ana')).toBeVisible();
    await adminPage.getByRole('button', { name: 'Tarjetas' }).click();
    await expect(adminPage.locator('table')).toHaveCount(0);
  });

  test('inline quota editing posts the full three-field row for the response month', async ({ adminPage }) => {
    const { posts } = await mockApi(adminPage);
    await adminPage.goto('/analitica?tab=seguimiento');
    const ana = adminPage.getByRole('article', { name: 'Ana' });
    await ana.getByRole('button', { name: 'Editar metas' }).click();
    await ana.getByRole('button', { name: 'Editar meta (100USD)' }).click();
    await ana.getByRole('spinbutton').fill('120');
    await ana.getByRole('button', { name: 'Guardar' }).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toEqual({ salesRepKey: '1', periodMonth: '2026-10', salesQuotaUsd: 120, weeklyVisitQuota: 2, newCustomerQuota: 1 });
  });

  test('consignment footnote lists the excluded invoices', async ({ adminPage }) => {
    await mockApi(adminPage);
    await adminPage.goto('/analitica?tab=seguimiento');
    await expect(adminPage.getByRole('heading', { name: 'Facturas excluidas — patrón de consignación' })).toBeVisible({ timeout: 15_000 });
    await adminPage.locator('button', { hasText: 'excluidos' }).first().click();
    await expect(adminPage.getByText('F9')).toBeVisible();
  });

  test('a server error shows the message instead of cards', async ({ adminPage }) => {
    await mockApi(adminPage, { fail: true });
    await adminPage.goto('/analitica?tab=seguimiento');
    await expect(adminPage.getByText('Error al consultar el Data Warehouse')).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByRole('article')).toHaveCount(0);
  });

  test('help panel documents Seguimiento', async ({ adminPage }) => {
    await mockApi(adminPage);
    await adminPage.goto('/analitica?tab=seguimiento');
    await adminPage.getByRole('button', { name: 'Ayuda de esta página' }).click();
    const dialog = adminPage.getByRole('dialog', { name: 'Panel de ayuda' });
    await expect(dialog.getByRole('heading', { name: 'Seguimiento', exact: true })).toBeVisible({ timeout: 10_000 });
  });
});

// @mssql: needs the migrated + loaded DWH (`bun run migrate:dwh` + `bun run dwh:incremental-load`,
// plan A's migration 0040 applied). Excluded from default CI; run with `bun run e2e:mssql`.
test.describe('seguimiento @mssql', () => {
  test('tab loads real roots, the month pace and the toggle works', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=seguimiento');
    await expect(adminPage.getByRole('heading', { name: 'Seguimiento de ventas' })).toBeVisible({ timeout: 30_000 });
    await expect(adminPage.getByText(/Día laborable \d+ de \d+/)).toBeVisible();
    await expect(adminPage.getByRole('article').first()).toBeVisible();
    await adminPage.getByRole('button', { name: 'Ruta', exact: true }).click();
    await expect(adminPage.getByRole('article').first()).toBeVisible({ timeout: 30_000 });
    await adminPage.getByRole('button', { name: 'Tabla' }).click();
    await expect(adminPage.locator('table').first()).toBeVisible();
  });

  test('a seller can be opened from the tab and returns to Seguimiento', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=seguimiento');
    await expect(adminPage.getByRole('article').first()).toBeVisible({ timeout: 30_000 });
    await adminPage.getByRole('button', { name: 'Ver perfil' }).first().click();
    await expect(adminPage.getByText('← Volver a Seguimiento')).toBeVisible();
    await adminPage.getByText('← Volver a Seguimiento').click();
    await expect(adminPage.getByRole('heading', { name: 'Seguimiento de ventas' })).toBeVisible();
  });
});
```

- [ ] **Step 3: Run the default e2e spec**

Run:
```bash
SQLITE_PATH=./e2e/.tmp bun run e2e:seed
bun run e2e -- e2e/seguimiento.spec.ts
```
Expected: the 8 `seguimiento (mocked API)` tests PASS; the `@mssql` describe is excluded by `--grep-invert @mssql`. (The first run builds the app: `next build --webpack`, up to ~3 minutes.) If `getByRole('button', { name: 'Ruta', exact: true })` is ambiguous with "Ruta 3" cards, it is not: card titles are `article`/`h3`, only toggle buttons are buttons named exactly "Ruta".
Where the real DWH is available, also run: `bun run e2e:mssql -- e2e/seguimiento.spec.ts` and expect the two `@mssql` tests to PASS (after `mapping:apply` has populated routes; before it, the Ruta toggle shows the single "Sin ruta" card, which still satisfies `getByRole('article').first()`).

- [ ] **Step 4: Update AGENTS.md**

In the `lib/` directory map add:
```
  seguimiento/             — pure helpers for the Seguimiento tab: iso-date.ts, month-pace.ts (monthPace/projectToMonth/resolveReferenceMonth),
                              iso-weeks.ts, visit-compliance.ts (visitCompliance/summarizeCompliance; shared with Clientes), quotas.ts (rollUpQuotas,
                              quotaBarGeometry), category-mix.ts, aggregate.ts (buildSeguimiento), queries.ts (DWH SQL), targets-repo.ts (seller_targets)
```
and under `app/api/`: `dwh/seguimiento/ — Seguimiento API (kind=vendedor|ruta|grupo, sections lines/excluded), gated on 'dwh'`; under `app/(app)/analitica/`: `tabs/tab-seguimiento.tsx + components/seguimiento/ — Seguimiento tab`. Add a short paragraph after "Recipes / Product Costing" titled "Seguimiento (Analítica tab)" stating: monthly scorecard; reference month rule (`resolveReferenceMonth`); customers attributed by the CURRENT `Dim_Customer` row by `CustomerCode`; activation = invoice that ISO week from an assigned customer; projection weekends-only; quotas from `seller_targets`, summed per distinct seller for route/group roots and flagged `quotaShared`; consignment-root codes excluded via `app/api/dwh/lib/consignment.ts`; `VisitIntervalDays` NULL = never overdue.

Run: `grep -n "seguimiento" AGENTS.md | head`
Expected: the new entries.

- [ ] **Step 5: Full verification**

Run each and confirm:
```bash
bun run test:unit                  # all unit tests (includes __tests__/unit/seguimiento, route tests)
bun run test:components            # all RTL tests
DW_NAME=DWH_AlimentosNY_Test bun test --isolate --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/seguimiento-queries.test.ts
bunx tsc --noEmit
bun run lint
git status --short                 # only intended files
```
Expected: all PASS / clean. `git diff --stat main -- app/api/dwh/vendedores app/(app)/analitica/tabs/tab-vendedores.tsx` must show only the one-line import change in `vendedores/route.ts` and the moves (no deletions of old tab/API/tests).

- [ ] **Step 6: Commit**

```bash
git add content/help/analitica-definiciones.md e2e/seguimiento.spec.ts AGENTS.md
git commit -m "docs+test(seguimiento): help section, Playwright e2e (mocked + @mssql) and AGENTS.md" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Handoff to plan C

Plan C (consolidation) must not need to reopen any decision here. State at the end of plan B:

**Left in place, untouched or minimally touched (plan C decides their fate):**
- `app/(app)/analitica/tabs/tab-vendedores.tsx`, `app/api/dwh/vendedores/route.ts` (+ `__tests__/route.test.ts`; only its `consignment` import path changed), `e2e/vendedores-seller-profile.spec.ts`, `e2e/vendedores-consignment.spec.ts`, and the `vendedores` entry in `TABS` (`analitica-client.tsx`). Seguimiento was added as a second tab right after Resumen, so both exist side by side.
- `tab-profundidad.tsx`, `tab-matriz-vendedor.tsx`, `tab-cadencia.tsx`, `e2e/cadencia.spec.ts`, `e2e/profundidad-linea*.spec.ts`, their routes (`profundidad-linea`, `matriz-vendedor`, `cadencia`) and tests.
- **Must survive plan C's deletions** because Seguimiento's seller drill-down depends on them: `app/(app)/analitica/tabs/seller-profile.tsx`, `app/api/dwh/vendedor-360/*` (route, `quota-resolution.ts`, `customer-classification.ts`, tests), `app/api/admin/seller-targets/route.ts`, `app/(app)/analitica/components/quota-editor.tsx`, and **`app/api/dwh/profundidad-linea/route.ts`**, which `vendedor-360/route.ts` imports directly (`getProfundidadLinea`). If plan C folds Profundidad into Productos it must keep that route (or move the leaderboard logic and update the import) until `vendedor-360` stops calling it.
- `app/api/dwh/lib/consignment.ts` (moved here by plan B; shared by `seguimiento`, `vendedores` and `vendedor-360` routes) must stay.

**Plan C must rewire / do:**
1. Remove the `vendedores` entry and its import from `TABS`; remove `?tab=vendedores|profundidad|matriz-vendedor|cadencia` handling so they fall back to `DEFAULT_TAB` (the existing `TABS.some(...) ? tabParam : DEFAULT_TAB` already does that once the entries are gone).
2. Delete `tab-vendedores.tsx`, `app/api/dwh/vendedores/*` and its tests, and replace `e2e/vendedores-seller-profile.spec.ts` / `e2e/vendedores-consignment.spec.ts` (they navigate `?tab=vendedores`; the seller-profile one expects "← Volver a Vendedores", the default `backLabel`). Equivalent coverage already exists in `e2e/seguimiento.spec.ts` (consignment footnote, "← Volver a Seguimiento"); once the Vendedores tab is gone, change `SellerProfile`'s default `backLabel` to `'Seguimiento'`.
3. Update `content/help/analitica-definiciones.md` sections that still mention the Vendedores tab ("Vendedores y consignación", and the sentence in `seller-profile.tsx` already changed to "pestaña Seguimiento").
4. **Resumen month-pace strip:** import `monthPace` from `@/lib/seguimiento/month-pace` and render `<MonthPaceStrip pace={...} />` from `app/(app)/analitica/components/seguimiento/visuals.tsx`. Reference month/as-of: `resolveReferenceMonth(dateRange, todayIso)` (same rule as Seguimiento) or `monthPace(month, asOf)` directly. Signature: `monthPace(month: string, asOf: string): MonthPace`.
5. **Clientes visit compliance:** use `visitCompliance({ lastInvoiceDate, intervalDays, asOf })` and `summarizeCompliance` from `@/lib/seguimiento/visit-compliance`, and `<VisitBadge visit={...} />` from `visuals.tsx`. Data: `fetchCustomers(pool, asOf)` from `@/lib/seguimiento/queries` already returns, per current customer, `visitIntervalDays`, `lastInvoiceDate` (on/before `asOf`, non-voided, `fact.Fact_Sales` only), `routeNumber`, `segmentCode`/`segmentName`, `salesRepKey/Name`, `isInactive`, so the Clientes overdue list and the group/route filters need no new SQL unless they want a different window. Customers with `status: 'no_interval'` must be listed as "Sin frecuencia", not overdue.
6. **Inactive-customer list** ("assigned customers with no invoice in the period"): derive from `fetchCustomers` + `fetchLineSales(pool, month)` (customers absent from the month's sales) or add a period-aware query; Seguimiento itself only shows per-customer sales for the reference month.
7. If Productos wants the same line palette/"Otros" logic, reuse `chooseVisibleLines`/`bucketCategoryMix` (`lib/seguimiento/category-mix.ts`) and `lineColor` (`components/seguimiento/colors.ts`); `tab-productos.tsx` still has its own private `lineaColor`.
8. Update `AGENTS.md` (remove Vendedores/Cadencia/Profundidad/Matriz mentions) and re-run `bun run e2e` and `bun run test` after deletions.

**Types/response contract plan C may rely on:** `SeguimientoResponse`, `SeguimientoRoot`, `SeguimientoCustomer`, `RootMetrics`, `WeekHeader`, `WeekCell` in `lib/seguimiento/types.ts`; route `GET /api/dwh/seguimiento` as specified in Task 6; component names `TabSeguimiento` (default export of `tabs/tab-seguimiento.tsx`), `RootCard`, `RootTable`, `CustomerList`, `InvoiceLines`, `WeekStrip`, `WeekDots`, `QuotaBar`, `MixBar`, `NewCustomersChip`, `MonthPaceStrip`, `VisitBadge`, `QuotaEditor`, `saveSellerTargetField`.

## Verify on production

Local DWH/ERP is a stale copy; check these before announcing the tab (none blocks merging):
1. **Reconciliation.** For one closed month, Seguimiento's `total.sales` (+ `total.excludedSales`) should equal `SUM(Fact_Sales.NetAmount)` for that month (Resumen's ventas brutas) and `total.sales` should match the old Vendedores tab's per-seller sum. A gap means sales on customer codes with no `IsCurrent = 1` row (they are dropped by the join to the current row) or a customer with two current rows (would double count; Plan A guarantees one).
2. **Dim_Customer columns populated.** `ErpSegmentCode` non-NULL for grouped customers, `Dim_Zone.RouteNumber` set for `CCS003..CCS022`, `VisitIntervalDays` set after `mapping:apply`. Before that the tab must show "Sin ruta"/"Sin grupo"/"Sin frecuencia" gracefully.
3. **Workbook parity.** Compare weeks 40-44 activation percentages and the projection for one seller against the hand-built workbook. The denominator here is assigned **active** customers excluding consignment-root codes; the workbook uses the customer-master count. Differences should be explainable by inactive customers.
4. **`Dim_Product.LineName` values.** Expect Panaderia/Pasteleria/Pizza (+ Navidad once created). Confirm there are no non-sales lines with sales (they would show as separate segments up to the 6-line cap, then "Otros"), and that `LineName` NULL rows are rare.
5. **Average price semantics.** `sales / units` mixes units of measure across lines; confirm with the business that this is the workbook's "precio promedio" definition.
6. **Seller with several routes.** The business has ~6 sellers and ~20 routes, so route quotas are mostly "compartida" (seller quota repeated on each route). Confirm with the business how the workbook assigns quotas to routes; if per-route quotas are wanted, that needs a new store (out of scope per the spec: "a view, not a new store").
7. **Time zone.** "Today" is `new Date().toISOString()` (UTC, as in sibling routes); in the evening in Caracas (UTC-4) the as-of day can run one day ahead. Confirm it is acceptable or switch all routes to a shared Caracas-date helper.
8. **Dim_Date.YearWeek vs `isoWeekOf`** on production (`SELECT TOP 5 FullDate, YearWeek FROM dim.Dim_Date WHERE FullDate BETWEEN '2026-09-28' AND '2026-11-01'`): both must give `2026-W40..W44`. Migration 0033 backfills it independent of `@@DATEFIRST`.
9. **Performance.** `fetchCustomers` computes `LastInvoice` over all of `fact.Fact_Sales`; time it on production (index `IX_Fact_Sales_CustomerKey` exists). The default response cache is 15 minutes.
10. **Holidays** are not modelled (weekends only), so the projection runs slightly low in months with national holidays.
11. **`seller_targets.sales_rep_key`** stores `Dim_SalesRep.SalesRepKey` as text; confirm production rows use the same key (the old Vendedor 360 profile wrote them that way).
12. **Seguimiento card vs. Vendedor 360 profile sales.** The card attributes each customer's sales to its CURRENT `Dim_Customer.DefaultSalesRepCode` (`lib/seguimiento/queries.ts`); the profile's "Cuota de ventas mensual — ventas facturadas por el vendedor" filters by the invoice's `fs.SalesRepKey` (`app/api/dwh/vendedor-360/route.ts`). For one seller and one closed month, compare both; any gap should be explained by customers reassigned between sellers (invoices issued under the old seller). Both are intended; the help page (Seguimiento section) documents the difference.
