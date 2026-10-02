# Pricing Plan 4/4 — Expiry Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A **Vencimientos** tab (health lists + timeline) and a daily email digest that surface what is about to end, what failed to revert, which articles lapsed without a price, and whether the nightly sweep is alive.

**Architecture:** Pure health functions (`lib/pricing/health.ts`) over data fetched by thin loaders; the API route and the digest share them, so page and email cannot disagree. The Plan 3 sweep script additionally writes a heartbeat row and then sends the digest through the existing `EmailService`. Everything runs live (the catalog is ~30 priced articles; no snapshot or cache).

**Tech Stack:** as Plans 1–3.

**Spec:** `docs/superpowers/specs/2026-10-01-pricing-expiry-tracking-design.md`

## Dependency on Plans 1–3 (merged on this branch and green first)

From **Plan 1**: `appendAudit`, `AppDb`, `todayIso`/`daysBetweenIso`/`addDaysIso`, `getSegmentMetaMap`, `pricingSegmentMeta`, `serviceErrorResponse`, `requirePricingAccess`, `PricingShell`/`TABS`, `api-client`, `makeMemoryDb`, `Valid<T>`.
From **Plan 2**: `RateRow`, `RatesErp` (`readListRates`, `listLists`), `listPriceListDtos`, `fake-rates-erp.ts`.
From **Plan 3**: `pricing_promotions` + `listPromotions`/`getPromotion` repo fns, `promotionStatus`, `PromotionDto`/`listPromotionDtos`, `scripts/sweep-promotions.ts` + `runSweep`/`SweepSummary`, `PromotionsTab` (deep link `?tab=promociones&promo=<id>`), `buildPromotionsDeps`.

Produces: nothing further (last plan).

## Global Constraints

Plan 1 *Global Constraints* apply unchanged. Plan-specific:

- All health checks are **read-only** and run live; no caching. The "sin precio vigente" check is limited to lists with at least one customer assigned (`customerCount > 0`).
- The digest is sent **only when there is something to report**. Ending-soon notices are deduplicated per `(promotion_id, kind)` in `pricing_alert_log` (kinds `ending_first` at `days_ahead` days, `ending_last` at 1 day); thresholds fire when `daysLeft ≤ threshold` and not yet logged, so a missed day cannot skip a notice. Failures and lapsed prices repeat daily until resolved.
- Recipients: `pricing_alert_settings.recipients` (JSON array of emails) when set, else every admin plus every user with a `pricing_edit` grant, restricted to users with a non-empty email.
- Email goes through `EmailService.send(to, 'pricing-expiry-digest', data)`; a failed send is logged, sets the script's exit code to 1, and **never** stops the sweep or the remaining recipients.
- Alert settings are admin-only (`session.role === 'admin'`), checked in the route and hidden in the UI.
- The sweep heartbeat is written even when the sweep throws (state `failed`, error text), so the dashboard can tell "never ran" from "ran and broke".
- Dates `YYYY-MM-DD`; timestamps unix ms; Spanish copy.
- **NEVER run `bun run test`, `bun run test:unit`, bare `bun test`, or any whole-folder run of `__tests__/integration` or `scripts/dwh`**: they load `.env.local` (SQLITE_PATH=./) and wipe the developer's real `data/exporter.db`. Run only the specific test files named in your task (unit tests use `makeMemoryDb()`); e2e only with `SQLITE_PATH=./e2e/.tmp` and Node 22 on PATH (see Plan 1's e2e-run-report.md). Two `scripts/dwh` tests (dim-customer, dim-legal-entity) fail on the mock ERP for unrelated pre-existing reasons.

## Review Focus

1. Heartbeat/stale logic: no run yet, last run ok 10 h ago, ok 40 h ago (stale), last run with failures (Task 2).
2. Digest never double-sends an ending-soon notice, and still sends it if a day was missed (Task 4).
3. A promotion that starts after the 30-day window or is cancelled/ended never appears in "terminan pronto" (Task 2).
4. Digest with zero reportable items sends nothing and logs nothing (Task 4).
5. Non-admin user cannot read or write alert settings via the API, even with `pricing_edit` (Task 5).

---

### Task 1: Schema and repository (heartbeat, alert log, settings)

**Files:** Modify `lib/db/schema.ts` (append 3 tables); generate `migrations/sqlite/0011_*.sql`; Create `lib/pricing/health-repo.ts`; Test `__tests__/unit/pricing/health-repo.test.ts`.

**Interfaces — Produces:**
```ts
export const pricingSweepRuns = sqliteTable('pricing_sweep_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runAt: integer('run_at').notNull(),             // unix ms
  ok: integer('ok').notNull(),                    // 0/1
  moved: integer('moved').notNull().default(0),
  failed: integer('failed').notNull().default(0),
  error: text('error'),
});
export const pricingAlertLog = sqliteTable('pricing_alert_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  promotionId: integer('promotion_id').notNull(),
  kind: text('kind', { enum: ['ending_first', 'ending_last'] }).notNull(),
  sentOn: text('sent_on').notNull(),              // YYYY-MM-DD
}, t => ({ uniq: unique('pricing_alert_log_uniq').on(t.promotionId, t.kind) }));
export const pricingAlertSettings = sqliteTable('pricing_alert_settings', {
  id: integer('id').primaryKey(),                  // always 1
  enabled: integer('enabled').notNull().default(1),
  daysAhead: integer('days_ahead').notNull().default(7),
  recipients: text('recipients'),                  // JSON string[] or null
});
```
`health-repo.ts` (all take `AppDb`): `recordSweepRun(db, r: { runAt: number; ok: boolean; moved: number; failed: number; error?: string | null }): void`; `getLastSweepRun(db): PricingSweepRun | undefined`; `hasAlertBeenSent(db, promotionId, kind): boolean`; `logAlertSent(db, promotionId, kind, sentOn): void` (idempotent: `onConflictDoNothing`); `getAlertSettings(db): { enabled: boolean; daysAhead: number; recipients: string[] | null }` (defaults when no row); `saveAlertSettings(db, s: { enabled: boolean; daysAhead: number; recipients: string[] | null }): void` (upsert id=1).

- [ ] **Step 1: Failing test** — `getAlertSettings` returns defaults `{ enabled: true, daysAhead: 7, recipients: null }` on an empty db; `saveAlertSettings` round-trips an array and `null`; `recordSweepRun` + `getLastSweepRun` returns the newest by `runAt`; `logAlertSent` twice for the same pair stores one row and `hasAlertBeenSent` reflects it; different `kind` for the same promotion is independent.
- [ ] **Step 2: Run** `bun test --isolate --env-file=.env.local __tests__/unit/pricing/health-repo.test.ts` → FAIL.
- [ ] **Step 3: Implement** schema (+ `bun run db:generate` → creates only the three tables) and repo (JSON-parse `recipients` defensively: invalid JSON → `null`).
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git add lib migrations/sqlite __tests__ && git commit -m "feat(pricing): sweep heartbeat, alert log and alert settings storage"`

---

### Task 2: Pure health functions

**Files:** Create `lib/pricing/health.ts`; Test `__tests__/unit/pricing/health.test.ts`.

**Interfaces — Consumes:** `RateRow` (Plan 2), `promotionStatus` (Plan 3), `daysBetweenIso`, `SegmentMeta`.
**Produces:**
```ts
export interface EndingSoonItem { promotionId: number; name: string; kind: 'overlay' | 'segment'; endsOn: string; daysLeft: number; coPrecio: string }
export interface UnrevertedItem { tipCli: string; label: string; expiresAt: string; daysOverdue: number; customerCount: number }
export interface LapsedItem { coPrecio: string; coArt: string; coAlma: string; lastHasta: string | null; nextDesde: string | null }
export type SweepState = 'never' | 'ok' | 'stale' | 'failed';
export interface SweepStatus { state: SweepState; lastRunAt: number | null; hoursSince: number | null; failed: number; error: string | null }
export function endingSoon(promotions: { id: number; name: string; kind: 'overlay' | 'segment'; coPrecio: string; startsOn: string; endsOn: string; cancelledAt: number | null }[], today: string, withinDays: number): EndingSoonItem[]
export function unrevertedSegments(meta: { tipCli: string; kind: 'group' | 'special'; reason: string | null; expiresAt: string | null }[], customerCountByTipCli: Record<string, number>, today: string): UnrevertedItem[]
export function lapsedPrices(rows: RateRow[], listsInUse: string[], today: string): LapsedItem[]
export function sweepStatus(last: { runAt: number; ok: boolean; failed: number; error: string | null } | undefined, nowMs: number): SweepStatus
```
Rules: `endingSoon` — only promotions whose computed status is `active` or `scheduled`... precisely: not cancelled, `endsOn ≥ today`, `startsOn ≤ today + withinDays`? **No**: only *active* ones (`startsOn ≤ today ≤ endsOn`) with `daysLeft = daysBetweenIso(today, endsOn) ≤ withinDays`; sorted by `endsOn` asc then name. `unrevertedSegments` — `kind === 'special'`, `expiresAt < today`, `customerCount > 0`; `label = reason ?? tipCli`; sorted by `daysOverdue` desc. `lapsedPrices` — for each `(coPrecio, coArt, coAlma)` group within `listsInUse`: has at least one row, but none covers `today` (`desde ≤ today ≤ (hasta ?? ∞)`); `lastHasta` = latest `hasta` among past rows, `nextDesde` = earliest `desde > today`; sorted by list then article. `sweepStatus` — `never` when `last` undefined; `failed` when `!ok || failed > 0`; `stale` when `hoursSince > 36`; else `ok`; `hoursSince = (nowMs − runAt)/3.6e6` rounded to 1 decimal.

- [ ] **Step 1: Failing tests** (write all of these):

```ts
import { describe, test, expect } from 'bun:test';
import { endingSoon, unrevertedSegments, lapsedPrices, sweepStatus } from '@/lib/pricing/health';
import type { RateRow } from '@/lib/pricing/rate-planner';

const today = '2026-10-01';
const promo = (id: number, startsOn: string, endsOn: string, cancelledAt: number | null = null) =>
  ({ id, name: `P${id}`, kind: 'overlay' as const, coPrecio: '08', startsOn, endsOn, cancelledAt });

describe('endingSoon', () => {
  test('only active promotions inside the window, soonest first', () => {
    const out = endingSoon([
      promo(1, '2026-09-20', '2026-10-05'), promo(2, '2026-09-20', '2026-10-03'),
      promo(3, '2026-10-02', '2026-10-04'),                 // scheduled → excluded
      promo(4, '2026-09-01', '2026-09-30'),                 // ended → excluded
      promo(5, '2026-09-20', '2026-10-04', 1),              // cancelled → excluded
      promo(6, '2026-09-20', '2026-12-01'),                 // beyond window
    ], today, 7);
    expect(out.map(i => [i.promotionId, i.daysLeft])).toEqual([[2, 2], [1, 4]]);
  });
  test('ends today counts (0 days)', () => {
    expect(endingSoon([promo(1, '2026-09-20', today)], today, 7)[0].daysLeft).toBe(0);
  });
});

describe('unrevertedSegments', () => {
  const meta = [
    { tipCli: 'A', kind: 'special' as const, reason: 'Promo A', expiresAt: '2026-09-25' },
    { tipCli: 'B', kind: 'special' as const, reason: null, expiresAt: '2026-09-30' },
    { tipCli: 'C', kind: 'special' as const, reason: 'No vence aún', expiresAt: '2026-10-01' },
    { tipCli: 'D', kind: 'group' as const, reason: null, expiresAt: null },
  ];
  test('expired specials that still have customers, most overdue first', () => {
    expect(unrevertedSegments(meta, { A: 2, B: 1, C: 5, D: 9 }, today).map(i => [i.tipCli, i.daysOverdue, i.customerCount, i.label]))
      .toEqual([['A', 6, 2, 'Promo A'], ['B', 1, 1, 'B']]);
  });
  test('expired segments with no customers are fine', () => {
    expect(unrevertedSegments(meta, { A: 0 }, today)).toEqual([]);
  });
});

describe('lapsedPrices', () => {
  const row = (coArt: string, coPrecio: string, desde: string, hasta: string | null): RateRow =>
    ({ coArt, coPrecio, coAlma: '000015', desde, hasta, monto: 1, coMone: 'USD', validador: '0x01' });
  test('flags articles whose rows exist but none covers today', () => {
    const out = lapsedPrices([
      row('A1', '08', '2026-01-01', '2026-09-15'),          // lapsed, no next
      row('A2', '08', '2026-01-01', '2026-09-15'), row('A2', '08', '2026-10-10', null),   // gap until a scheduled row
      row('A3', '08', '2026-01-01', null),                  // fine
      row('A4', '09', '2026-01-01', '2026-02-01'),          // list not in use → ignored
    ], ['08'], today);
    expect(out.map(i => [i.coArt, i.lastHasta, i.nextDesde])).toEqual([['A1', '2026-09-15', null], ['A2', '2026-09-15', '2026-10-10']]);
  });
  test('a row ending today still covers today', () => {
    expect(lapsedPrices([row('A1', '08', '2026-01-01', today)], ['08'], today)).toEqual([]);
  });
});

describe('sweepStatus', () => {
  const now = Date.UTC(2026, 9, 1, 12);
  const hoursAgo = (h: number) => now - h * 3_600_000;
  test('never', () => expect(sweepStatus(undefined, now).state).toBe('never'));
  test('ok within 36h', () => expect(sweepStatus({ runAt: hoursAgo(10), ok: true, failed: 0, error: null }, now)).toMatchObject({ state: 'ok', hoursSince: 10 }));
  test('stale after 36h', () => expect(sweepStatus({ runAt: hoursAgo(40), ok: true, failed: 0, error: null }, now).state).toBe('stale'));
  test('failed beats stale; failures count', () => {
    expect(sweepStatus({ runAt: hoursAgo(40), ok: true, failed: 2, error: null }, now).state).toBe('failed');
    expect(sweepStatus({ runAt: hoursAgo(1), ok: false, failed: 0, error: 'boom' }, now)).toMatchObject({ state: 'failed', error: 'boom' });
  });
});
```
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `health.ts` per the rules (use `daysBetweenIso`; sort with `localeCompare`).
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git add lib/pricing/health.ts __tests__/unit/pricing/health.test.ts && git commit -m "feat(pricing): pure health checks (ending soon, unreverted, lapsed, sweep status)"`

---

### Task 3: Health loaders and report

**Files:** Create `lib/pricing/health-loader.ts`; Modify `lib/pricing/rates-erp.ts` + `lib/pricing/rates-erp-adapter.ts` + `__tests__/helpers/fake-rates-erp.ts` (add `readAllActiveRates(listCodes: string[]): Promise<RateRow[]>`), `lib/pricing/segment-erp.ts`/`SegmentErp` is **not** changed — use a new `countCustomersByTipCli` on a small `HealthErp`; Test `__tests__/unit/pricing/health-loader.test.ts`.

**Interfaces — Produces:**
```ts
export interface HealthErp {
  listListsInUse(): Promise<string[]>;                       // coPrecio with customerCount > 0
  readAllActiveRates(listCodes: string[]): Promise<RateRow[]>;
  countCustomersByTipCli(tipClis: string[]): Promise<Record<string, number>>;
}
export interface HealthReport {
  today: string; withinDays: number;
  endingSoon: EndingSoonItem[]; unreverted: UnrevertedItem[]; lapsed: LapsedItem[]; sweep: SweepStatus;
}
export async function loadHealthReport(deps: { erp: HealthErp; db: AppDb; now?: () => Date }, withinDays: number): Promise<HealthReport>
export function realHealthErp(pool: ConnectionPool): HealthErp
```
`loadHealthReport`: promotions from `listPromotions(db)`, meta from `getSegmentMetaMap(db)` (specials with `expiresAt < today` → `countCustomersByTipCli`), `listListsInUse` → `readAllActiveRates` → `lapsedPrices`, last sweep from `getLastSweepRun` → `sweepStatus(last, now.getTime())`. Real SQL: `listListsInUse` = lists whose `saTipoCliente` rows have ≥ 1 `saCliente` (`SELECT DISTINCT RTRIM(k.co_precio) FROM saTipoCliente k WHERE EXISTS (SELECT 1 FROM saCliente c WHERE c.tip_cli = k.tip_cli)`); `countCustomersByTipCli` = parameterised `SELECT RTRIM(tip_cli) AS tipCli, COUNT(*) AS n FROM saCliente WHERE RTRIM(tip_cli) IN (…) GROUP BY RTRIM(tip_cli)` built with numbered `.input()` params (≤ 100 codes; empty array → `{}` without querying); `readAllActiveRates` = the Plan 2 `RATE_SELECT` filtered by `RTRIM(p.co_precio) IN (…)` and `Inactivo = 0`.

- [ ] **Step 1: Failing test** with a fake `HealthErp` + `makeMemoryDb()`: seed two promotions (one ending in 3 days active, one cancelled), one expired special meta row with 2 customers, a list in use with a lapsed article, and a recent ok sweep run → the report contains exactly: 1 ending-soon item, 1 unreverted item, 1 lapsed item, sweep `ok`. A second case with no data → all arrays empty and sweep `never`. A third: `countCustomersByTipCli` is called only with the expired special segments' codes (assert the fake's recorded argument), and not at all when there are none.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** Integration smoke on the mock ERP (scratch script): `realHealthErp(pool)` returns the lists in use (≥ 1) and `readAllActiveRates(['08'])` returns the ≈25 rows; print the timing — it must be well under a second; if it is not, note it in the commit body (spec open item 2).
- [ ] **Step 4: Run** unit test → PASS; `bunx tsc --noEmit` clean. **Step 5: Commit** — `git add lib __tests__ && git commit -m "feat(pricing): live health report loader"`

---

### Task 4: Digest (compose, dedupe, send) and sweep-script integration

**Files:** Create `lib/pricing/digest.ts`, `lib/email/templates/pricing-expiry-digest.hbs`; Modify `lib/services/email-service.ts` (add the subject), `scripts/sweep-promotions.ts`; Tests `__tests__/unit/pricing/digest.test.ts`, extend `__tests__/unit/services/email-service.test.ts` with a render test (read the existing test first and follow its mocking approach).

**Interfaces — Consumes:** `HealthReport`, `EndingSoonItem`, health-repo fns, `EmailService`.
**Produces:**
```ts
export interface DigestSection { title: string; lines: string[] }
export interface Digest { isEmpty: boolean; sections: DigestSection[]; toLog: { promotionId: number; kind: 'ending_first' | 'ending_last' }[]; subjectData: { today: string } }
export function composeDigest(report: HealthReport, opts: { daysAhead: number; hasBeenSent(promotionId: number, kind: 'ending_first' | 'ending_last'): boolean; sweepSummary: SweepSummary | null }): Digest
export function resolveRecipients(db: AppDb, settings: { recipients: string[] | null }): string[]
export async function sendDigest(deps: { db: AppDb; email: { send(to: string, template: string, data: Record<string, unknown>): Promise<void> }; now?: () => Date }, report: HealthReport, sweepSummary: SweepSummary | null): Promise<{ sent: number; failed: number; skipped: 'disabled' | 'empty' | 'no-recipients' | null }>
```
Rules for `composeDigest` (pure):
- *Ending soon*: items with `daysLeft ≤ daysAhead` and not `hasBeenSent(id,'ending_first')` → line `«name» termina en N días (dd/mm)` and `toLog` `ending_first`; items with `daysLeft ≤ 1` and not `hasBeenSent(id,'ending_last')` → `toLog` `ending_last` (a promotion due for both on the same run logs both but is listed once, using the "mañana/hoy" wording).
- *Fallos del barrido*: when `sweep.state` is `failed` or `stale` or `never`, one line describing it (plus `error` when present); when `sweepSummary?.failed > 0`, one line with the count.
- *Vencidas sin revertir*: one line per `unreverted` item (`«label»: N clientes siguen en el segmento (venció hace D días)`).
- *Sin precio vigente*: one line per lapsed item (`Lista X · artículo Y sin precio desde dd/mm`), capped at 20 lines then `y N más…`.
- `isEmpty` ⇔ no sections.
`resolveRecipients`: `settings.recipients` (non-empty) else query `users` joined with `user_modules` (`pricing_edit`) plus `role = 'admin'`, de-duplicated, lowercased, only non-empty emails.
`sendDigest`: `enabled === false` → `skipped: 'disabled'`; empty → `skipped: 'empty'`; no recipients → `'no-recipients'`; otherwise `email.send(to, 'pricing-expiry-digest', { today, sections })` per recipient with try/catch (failure → `failed++`, `console.error`); `logAlertSent` for every `toLog` **only if at least one send succeeded**.
Template `pricing-expiry-digest.hbs` (Spanish, same table/inline-style conventions as `invoice-reminder.hbs` — read it first): title "Resumen de vencimientos de precios — {{today}}", one block per section with `<ul>`; footer "Este correo se envía solo cuando hay algo que revisar." Add `'pricing-expiry-digest': 'Precios: resumen de vencimientos'` to `getSubjectForTemplate`.
Script change (`scripts/sweep-promotions.ts`): wrap the sweep in try/catch; **always** `recordSweepRun(db, { runAt: Date.now(), ok, moved, failed, error })` (on throw: `ok:false`, `error: message`); then `loadHealthReport` (`withinDays` = settings.daysAhead), `sendDigest`; log `digest sent=… failed=… skipped=…`; `process.exitCode = 1` if the sweep failed or any digest send failed. Digest failures never skip the heartbeat.

- [ ] **Step 1: Failing tests** (write all):
  - ending-first fires at `daysLeft ≤ daysAhead` once; a second compose with `hasBeenSent=true` drops it; a promotion with `daysLeft = 6` and no prior log still fires `ending_first` (missed day); `daysLeft = 1` adds `ending_last`.
  - sweep `never`/`stale`/`failed` produce the failure section; `ok` produces none; `sweepSummary.failed = 2` adds a line.
  - lapsed list is capped at 20 lines + "y N más…".
  - an all-clear report → `isEmpty = true`.
  - `resolveRecipients`: explicit list wins; default = admins ∪ `pricing_edit` users, excluding users with no email and `pricing_view`-only users, de-duplicated (use `makeMemoryDb` and insert users/modules like `scripts/dwh/__tests__/pricing-access.test.ts` does).
  - `sendDigest`: disabled → nothing sent; empty → nothing sent, nothing logged; two recipients, first throws → `sent 1 failed 1`, alerts logged; both throw → alerts **not** logged (so they retry tomorrow).
  - template render test: render `pricing-expiry-digest.hbs` with sample sections through Handlebars and assert the title, a section title and a line appear and HTML is escaped (`<script>` in a promotion name is not rendered raw).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.**
- [ ] **Step 4: Run** all new tests → PASS. Run the script once against the mock ERP with a temp migrated `SQLITE_PATH`: expect a heartbeat row and `digest ... skipped=empty` (no promotions/customers) — verify with `bun -e` reading the temp db. Set `SMTP_*` unset: nothing should try to send when empty.
- [ ] **Step 5: Commit** — `git add lib scripts __tests__ && git commit -m "feat(pricing): expiry digest and sweep heartbeat"`

---

### Task 5: API routes and alert-settings validator

**Files:** Create `lib/pricing/alert-validators.ts`, `app/api/pricing/health/route.ts`, `app/api/pricing/alert-settings/route.ts`; Modify `lib/pricing/http.ts` (append `buildHealthDeps()`); Tests `__tests__/unit/pricing/alert-validators.test.ts`, `__tests__/unit/pricing/admin-gate.test.ts`.

**Interfaces — Produces:**
- `validateAlertSettingsBody(body: unknown): Valid<{ enabled: boolean; daysAhead: number; recipients: string[] | null }>` — `enabled` boolean; `daysAhead` integer 1..60; `recipients` `null` or array (≤ 50) of strings that look like emails (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`), trimmed, lowercased, de-duplicated, ≤ 120 chars each.
- `isAdminSession(session: SessionPayload): boolean` in `lib/pricing/http.ts` (`session.role === 'admin'`) and a helper `requirePricingAdmin(request): Promise<PricingAccessResult>` that calls `requirePricingAccess(request, 'view')` then returns `403 { error: 'Prohibido' }` unless admin.
- `GET /api/pricing/health?days=7|14|30` (view; any other `days` value → default 7) → `{ report: HealthReport }`.
- `GET /api/pricing/alert-settings` (admin) → `{ settings }`; `PUT` (admin) → `{ settings }`.

- [ ] **Step 1: Failing tests** — validator accepts/normalises; rejects bad email, `daysAhead` 0/61/1.5, non-boolean `enabled`; `requirePricingAdmin` unit test with a stubbed `requirePricingAccess`... (since it composes an existing function, test `isAdminSession` plus the pure decision function `decideAdmin(level: PricingAccessLevel, role): 'ok' | 'forbidden'` extracted for testability: a `pricing_edit` user with `role: 'user'` → `'forbidden'`; admin → `'ok'`).
- [ ] **Step 2–5:** run (FAIL) → implement → run (PASS) → `bunx tsc --noEmit` → commit: `git add lib app/api __tests__ && git commit -m "feat(pricing): health and alert-settings API routes"`.

---

### Task 6: Vencimientos tab, timeline, settings dialog, help, final verification

**Files:** Create `lib/pricing/timeline.ts`, `app/(app)/pricing/expiry-tab.tsx`, `app/(app)/pricing/health-section.tsx`, `app/(app)/pricing/promo-timeline.tsx`, `app/(app)/pricing/alert-settings-dialog.tsx`, `content/help/pricing-vencimientos.md`, `e2e/pricing-expiry.spec.ts`; Modify `app/(app)/pricing/page.tsx` (pass `isAdmin={session.role === 'admin'}`), `app/(app)/pricing/pricing-shell.tsx` (prop `isAdmin`, append `{ id: 'vencimientos', label: 'Vencimientos', helpPage: 'pricing-vencimientos' }`, render `<ExpiryTab isAdmin={isAdmin} />`), `app/api/help/[page]/route.ts` (slug); Tests `__tests__/unit/pricing/timeline.test.ts`.

**Interfaces — Produces:**
- `lib/pricing/timeline.ts` (pure): `monthDays(monthStartIso: string): number`; `timelineBars(promotions: { id: number; name: string; startsOn: string; endsOn: string; status: PromotionStatus }[], monthStartIso: string): { id: number; name: string; status: PromotionStatus; startDay: number; endDay: number; clippedStart: boolean; clippedEnd: boolean; lane: number }[]` — only promotions overlapping the month; days are 1-based within the month; overlapping bars are assigned increasing `lane`s greedily by start date; `shiftMonth(monthStartIso, delta: number): string`.
- `HealthSection({ title, count, emptyText, children })` — `<section aria-labelledby>`, count badge, "Todo en orden" empty state.
- `PromoTimeline({ promotions, month, onMonthChange, onSelect(id) })` — CSS grid with one column per day, bars `<button>` with `aria-label="«name», del 05/10 al 15/10, activa"`, status text + color, today marker; an accessible `<ul>` fallback listing the same promotions beneath; month navigation buttons (`‹ ›` with labels).
- `AlertSettingsDialog({ onClose })` — loads `/api/pricing/alert-settings`; fields: enabled toggle, `daysAhead` number (1–60), recipients textarea (one email per line; empty = "usar administradores y editores de precios"); saves with `PUT`; shows validation errors from the API.
- `ExpiryTab({ isAdmin })` — toggle `Listas | Línea de tiempo` (segmented control with `role="tablist"`), window selector `7 | 14 | 30` days, four `HealthSection`s (*Terminan pronto*, *Vencidas sin revertir*, *Sin precio vigente*, *Estado del barrido*) from `/api/pricing/health?days=`, with deep links: promotion → `/pricing?tab=promociones&promo=<id>`; unreverted segment → `/pricing?tab=segmentos&segment=<tipCli>`; lapsed → `/pricing?tab=listas&list=<coPrecio>`; sweep card text by state (`Último barrido hace N h`, `El barrido no se ha ejecutado nunca — revisa el programador de tareas`, `Barrido atrasado: último hace N h`, `El último barrido falló: …`); admins see an `Alertas por correo` button opening the dialog; timeline view reads `/api/pricing/promotions` (Plan 3).

- [ ] **Step 1: Failing test** for `timeline.ts`: bars for a promotion fully inside the month (start/end days, no clipping), starting before the month (`clippedStart`, `startDay = 1`), ending after (`clippedEnd`, `endDay = monthDays`), not overlapping (excluded), two overlapping promotions get lanes 0 and 1 while a later non-overlapping one reuses lane 0, February of a leap year (`2028-02-01` → 29 days), `shiftMonth('2026-12-01', 1) === '2027-01-01'` and `-1` from January.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `timeline.ts` and the components (skeletons, error banners, no browser dialogs, focus-visible rings, ≥ 44px targets, status never color-only).
- [ ] **Step 4: Help + e2e.** `content/help/pricing-vencimientos.md` (Spanish): what each section means and what to do about it; how the nightly task and the email digest relate; what "barrido atrasado" implies (check Windows Task Scheduler, Step 10 of `INSTRUCTIONS.md`); who receives emails and how to change it. `e2e/pricing-expiry.spec.ts` tagged `@mssql`: non-admin does not see `Alertas por correo`; the health sections render for a `pricing_view` user; help panel shows the Vencimientos heading.
- [ ] **Step 5: Final verification (Plan 4 and whole-feature done criteria)** — all green:

```bash
bunx tsc --noEmit
bun run lint
bun test --isolate --env-file=.env.local __tests__/unit
bun run test:pricing-erp
bun run build
```
Then, against the mock ERP with a temp migrated `SQLITE_PATH`: create an overlay promotion ending in 2 days through the promotions service, run `bun run pricing:sweep-promotions` with a stub SMTP (set `SMTP_HOST` to an unreachable host so the send fails): expect exit code 1, a heartbeat row, the failed send logged and `pricing_alert_log` **empty**; then rerun with the send stubbed to succeed (inject via a tiny `--dry-run-email` env flag **only if** it can be done without touching production code paths; otherwise unit tests already cover it) and confirm one alert row per kind. Clean up all scratch data. Finally run `git log --oneline main..HEAD` and confirm one commit per task across the four plans.
- [ ] **Step 6: Commit** — `git add -A app content e2e lib && git commit -m "feat(pricing): Vencimientos tab with health lists, timeline and alert settings"`

---

## Whole-feature wrap-up (after Plan 4's final commit)

- [ ] Update `AGENTS.md`: in "Directory Map" add `lib/pricing/` (segments, lists, rates, promotions, health, sweep), `app/api/pricing/*`, `scripts/sweep-promotions.ts`, `content/help/pricing-*.md`, `migrations/mssql/0010–0012`; in "Module-Based Permissions" mention `pricing_view`/`pricing_edit` semantics for the new tabs; add the "ERP writes for pricing go through `pApi…` wrappers; rate rows are never overlapped" convention.
- [ ] Run the **complete** suite once more and the production build; summarise any e2e that could not run and why.
- [ ] Commit: `git add AGENTS.md && git commit -m "docs: document the pricing workspace architecture"`.
