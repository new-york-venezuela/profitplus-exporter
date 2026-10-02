# Pricing Plan 3/4 — Promotions & Discounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A **Promociones** tab to create, inspect, cancel, extend/shorten and duplicate time-boxed promotions of two kinds (dated rows inside an existing list; or a promo list assigned to customers through a special segment), plus a daily sweep script that reverts expired special segments, plus the in-app help docs.

**Architecture:** Promotions are named records in SQLite grouping ERP rate rows. All ERP rate changes go through Plan 2's rate planner and transactional adapter: this plan adds two more *pure planners* (cancel, change end date) and a generic "run a planner inside the per-article transaction" entry point. A `promotions-service` orchestrates (ERP rates + Plan 1 segments + SQLite) behind fakeable interfaces; a pure `sweep` reverts expired special segments; a script runs it under Windows Task Scheduler.

**Tech Stack:** as Plans 1–2.

**Spec:** `docs/superpowers/specs/2026-10-01-pricing-promotions-design.md`

## Dependency on Plans 1 and 2 (merged on this branch and green first)

From **Plan 1**: `appendAudit`, `AppDb`, `Actor`, `NotFoundError`/`ConflictError`/`ValidationError`, `SegmentErp` (+ `SegmentMoveResult`), `assignCustomers`, `createSegment` (special, one customer), `getSegmentMeta`/`upsertSegmentMeta`/`getSegmentMetaMap`, `pricingSegmentMeta`, `buildSegmentName`, `nextTipCliCode`, `todayIso`/`addDaysIso`/`daysBetweenIso`/`isValidIsoDate`, `serviceErrorResponse`/`actorFrom`, `Valid<T>`, `TABS`, `api-client`, `Modal`, `SearchableSelect`, `makeMemoryDb`.
From **Plan 2**: `RateRow`, `planRatePeriod` (bounded `to` already supported and tested), `RatesErp`, `lists-service` (`cloneList`, `getRatesGrid`, `listPriceListDtos`), `rates-erp.ts` (`applyRatePeriodErp`, `readListRates`, …), `rates-math.ts` (`priceFromPercent`, `percentFromPrice`, `parseDecimalInput`, `parsePercentInput`, `roundHalfUp`), `rates-staging.ts`, `rates-grid.tsx`, `fake-rates-erp.ts`, `PriceListDto`, `GridRow`.

Produces for Plan 4: `pricing_promotions` (+ items, customers), `promotionStatus`, the sweep (`runSweep`, `scripts/sweep-promotions.ts`), `listPromotionDtos`.

## Global Constraints

Plan 1 and Plan 2 *Global Constraints* apply unchanged. Plan-specific:

- **No overlapping periods** are ever created (planner guarantees it). A promo `[from, to]` always leaves the regular rate contiguous: regular → promo → regular-continuation. **Cancelling or shortening must never leave a gap with no active rate** (this corrects an earlier shortcut in the spec: deactivating the promo row would orphan the period).
- Promotion dates: `startsOn` ≥ today, `endsOn` > `startsOn`... precisely `endsOn ≥ startsOn`; a one-day promo is allowed.
- Promotion `status` is computed (`promotionStatus(p, today)`), except `cancelled`, which is stored (`cancelled_at`).
- Overlay promos keep the warehouse of the regular row they split (Plan 2 rule); an article with rows in two warehouses in the target list is rejected for that article.
- Segment promos: promo list = clone of the base list (starting today, open-ended) + bounded promo rows; the clone's open-ended rows are the "continuation at regular price". Customers move immediately (the promo list equals the regular prices until `startsOn`). The sweep, not the UI, reverts them after `endsOn`.
- Sweep is idempotent, never moves a customer who is no longer in the expired segment, and exits non-zero on any failure.
- Wizard/dialog confirmations use `Modal` (no `window.confirm/alert/prompt`).
- Task Scheduler instructions go in `INSTRUCTIONS.md` right after the invoice-reminders step.
- `HELP_PAGES` gets `'pricing-promociones'`; the content file is `content/help/pricing-promociones.md`.

## Review Focus

1. Cancel and end-date changes never leave a day without an active rate (Task 2 tests for before-start, active, shorten, extend, no-continuation cases).
2. Overlay promo on an article with no regular rate, or with a scheduled change inside the window → that article is rejected with a message; the others still apply and the promotion shows as partially applied with a working retry (Task 4).
3. Sweep skips customers already moved by hand, falls back to `fallback_tip_cli` when `previous_tip_cli` no longer exists, and a second run does nothing (Task 5).
4. Segment promo whose customer move conflicts: promotion exists, that customer is flagged `moved = 0`, retry moves only the failed ones (Task 4).
5. A promotion that starts today (`from == today`) on an article whose regular row also started today (same-day in-place branch) (Tasks 2, 4).

---

### Task 1: Preparatory refactors (small, mechanical)

**Files:** Modify `lib/pricing/lists-service.ts`, `lib/pricing/rates-erp.ts`, `lib/pricing/rates-erp-adapter.ts`, `app/(app)/pricing/rates-grid.tsx`; Create `app/(app)/pricing/rate-cells.tsx`, `__tests__/helpers/fake-segment-erp.ts`; Modify `__tests__/helpers/fake-rates-erp.ts`, `__tests__/unit/pricing/segments-service.test.ts` (use the extracted fake).

**Interfaces — Produces:**
- `lib/pricing/lists-service.ts`: `export function resolveArticleWarehouse(rowsOfArticleInList: RateRow[], listDominant: string | null, installDominant: string | null): { coAlma: string } | { ambiguous: true }` (rows empty → `listDominant ?? installDominant ?? 'TODOS'`; one distinct warehouse → that; several → ambiguous). `applyRates` now calls it (behavior unchanged).
- `lib/pricing/rates-erp.ts`: `export async function applyPlannedErp(pool, a: { coPrecio; coArt; coAlma; coMone: string | null; user: string }, plan: (rows: RateRow[]) => RatePlan): Promise<ApplyOutcome>` — the transaction body currently inside `applyRatePeriodErp` (begin → read rows with UPDLOCK → `plan(rows)` → rollback+`rejected`/`skipped` or execute ops → commit/`conflict`); `applyRatePeriodErp` becomes `applyPlannedErp(pool, a, rows => planRatePeriod(rows, { from, to, monto, today }))`.
- `RatesErp` gains `applyPlanned(a: { coPrecio; coArt; coAlma; coMone: string | null; user: string }, plan: (rows: RateRow[]) => RatePlan): Promise<ApplyOutcome>` (real adapter delegates; fake runs `plan` over its in-memory rows and applies the ops with the same insert/update semantics it already has for `applyRatePeriod`, which is re-expressed via `applyPlanned`).
- `app/(app)/pricing/rate-cells.tsx`: `PriceCell({ value, onCommit, disabled, ariaLabel })` and `PercentCell({ reference, price, onCommit(price: number | null), disabled, ariaLabel })` extracted verbatim from the editable cells in `rates-grid.tsx` (same parsing, same inline-error behavior); `rates-grid.tsx` imports them.
- `__tests__/helpers/fake-segment-erp.ts`: `makeFakeSegmentErp(seed)` extracted from Plan 1's `segments-service.test.ts` (identical behavior), extended with `listCustomersInSegment(tipCli): Promise<{ coCli: string; cliDes: string }[]>` (customers whose `tipCli` equals it) and a `customers` setter; `SegmentErp` (Plan 1) is **not** changed here — `listCustomersInSegment` belongs to `SweepErp` (Task 5), the fake simply offers both.

- [ ] **Step 1:** Run the full pricing unit suite first to record the green baseline: `bun test --isolate --env-file=.env.local __tests__/unit/pricing`.
- [ ] **Step 2:** Make the four mechanical changes above. No behavior changes.
- [ ] **Step 3:** Re-run the same suite + `bunx tsc --noEmit` + `bun run lint` → identical results (all green). Re-run `bun test --isolate --env-file=.env.local scripts/dwh/__tests__/pricing-rates.test.ts` against the mock ERP → green (the transaction was only moved).
- [ ] **Step 4: Commit** — `git add -A lib app __tests__ && git commit -m "refactor(pricing): expose warehouse resolution, planned-ops entry point and shared cells/fakes"`

---

### Task 2: Pure planners — cancel, change end date — and promotion status

**Files:** Create `lib/pricing/promo-planner.ts`, `lib/pricing/promo-status.ts`; Tests `__tests__/unit/pricing/promo-planner.test.ts`, `promo-status.test.ts`.

**Interfaces — Consumes:** `RateRow`, `RateOp`, `RatePlan` (Plan 2), `addDaysIso`.
**Produces:**
```ts
export function planCancelPromo(existing: RateRow[], p: { from: string; to: string; regularMonto: number; today: string }): RatePlan
export function planChangePromoEnd(existing: RateRow[], p: { from: string; to: string; newTo: string; regularMonto: number; today: string }): RatePlan
export type PromotionStatus = 'scheduled' | 'active' | 'ended' | 'cancelled'
export function promotionStatus(p: { startsOn: string; endsOn: string; cancelledAt: number | null }, today: string): PromotionStatus
```
`existing` = active rows of one `(article, list, warehouse)`; the promo row is the one with `desde === from && hasta === to`.

- [ ] **Step 1: Failing tests**

```ts
// promo-planner.test.ts
import { describe, test, expect } from 'bun:test';
import { planCancelPromo, planChangePromoEnd } from '@/lib/pricing/promo-planner';
import type { RateRow } from '@/lib/pricing/rate-planner';

const row = (desde: string, hasta: string | null, monto: number): RateRow =>
  ({ coArt: 'A', coPrecio: '08', coAlma: '000015', desde, hasta, monto, coMone: 'USD', validador: '0x01' });
const regularBefore = row('2026-03-15', '2026-10-04', 4);
const promo = row('2026-10-05', '2026-10-15', 3);
const cont = row('2026-10-16', null, 4);
const rows = [regularBefore, promo, cont];

describe('planCancelPromo', () => {
  test('before start → promo row is repriced to the regular amount (no gap)', () => {
    expect(planCancelPromo(rows, { from: '2026-10-05', to: '2026-10-15', regularMonto: 4, today: '2026-10-01' }))
      .toEqual({ ok: true, skipped: false, ops: [{ type: 'update', row: promo, set: { monto: 4 } }] });
  });
  test('starting today → same: reprice in place', () => {
    expect(planCancelPromo(rows, { from: '2026-10-05', to: '2026-10-15', regularMonto: 4, today: '2026-10-05' }).ok).toBe(true);
  });
  test('active → promo keeps elapsed days, remaining days at regular price', () => {
    expect(planCancelPromo(rows, { from: '2026-10-05', to: '2026-10-15', regularMonto: 4, today: '2026-10-09' }))
      .toEqual({ ok: true, skipped: false, ops: [
        { type: 'update', row: promo, set: { hasta: '2026-10-08' } },
        { type: 'insert', desde: '2026-10-09', hasta: '2026-10-15', monto: 4 },
      ] });
  });
  test('ended promo cannot be cancelled', () => {
    expect(planCancelPromo(rows, { from: '2026-10-05', to: '2026-10-15', regularMonto: 4, today: '2026-10-16' }).ok).toBe(false);
  });
  test('promo row not found (edited by hand) → error', () => {
    expect(planCancelPromo([regularBefore, cont], { from: '2026-10-05', to: '2026-10-15', regularMonto: 4, today: '2026-10-01' }).ok).toBe(false);
  });
});

describe('planChangePromoEnd', () => {
  const p = { from: '2026-10-05', to: '2026-10-15', regularMonto: 4 };
  test('extend: promo hasta moves and the continuation starts later', () => {
    expect(planChangePromoEnd(rows, { ...p, newTo: '2026-10-20', today: '2026-10-09' })).toEqual({ ok: true, skipped: false, ops: [
      { type: 'update', row: promo, set: { hasta: '2026-10-20' } },
      { type: 'update', row: cont, set: { desde: '2026-10-21' } },
    ] });
  });
  test('shorten: continuation starts earlier', () => {
    expect(planChangePromoEnd(rows, { ...p, newTo: '2026-10-12', today: '2026-10-09' })).toEqual({ ok: true, skipped: false, ops: [
      { type: 'update', row: promo, set: { hasta: '2026-10-12' } },
      { type: 'update', row: cont, set: { desde: '2026-10-13' } },
    ] });
  });
  test('shorten when the promo reached the end of its regular row (no continuation) → insert one at regular price', () => {
    expect(planChangePromoEnd([regularBefore, promo], { ...p, newTo: '2026-10-12', today: '2026-10-09' })).toEqual({ ok: true, skipped: false, ops: [
      { type: 'update', row: promo, set: { hasta: '2026-10-12' } },
      { type: 'insert', desde: '2026-10-13', hasta: '2026-10-15', monto: 4 },
    ] });
  });
  test('extend with no continuation row → error', () => {
    expect(planChangePromoEnd([regularBefore, promo], { ...p, newTo: '2026-10-20', today: '2026-10-09' }).ok).toBe(false);
  });
  test('extend past the continuation own end → error', () => {
    const boundedCont = row('2026-10-16', '2026-10-18', 4);
    expect(planChangePromoEnd([regularBefore, promo, boundedCont], { ...p, newTo: '2026-10-20', today: '2026-10-09' }).ok).toBe(false);
  });
  test('new end in the past, before from, equal to current, or promo already ended → error/skip', () => {
    expect(planChangePromoEnd(rows, { ...p, newTo: '2026-10-08', today: '2026-10-09' }).ok).toBe(false);
    expect(planChangePromoEnd(rows, { ...p, newTo: '2026-10-04', today: '2026-10-01' }).ok).toBe(false);
    expect(planChangePromoEnd(rows, { ...p, newTo: '2026-10-15', today: '2026-10-09' })).toEqual({ ok: true, skipped: true, ops: [] });
    expect(planChangePromoEnd(rows, { ...p, newTo: '2026-10-20', today: '2026-10-16' }).ok).toBe(false);
  });
});
```
```ts
// promo-status.test.ts
import { describe, test, expect } from 'bun:test';
import { promotionStatus } from '@/lib/pricing/promo-status';
const p = { startsOn: '2026-10-05', endsOn: '2026-10-15', cancelledAt: null };
describe('promotionStatus', () => {
  test('boundaries are inclusive', () => {
    expect(promotionStatus(p, '2026-10-04')).toBe('scheduled');
    expect(promotionStatus(p, '2026-10-05')).toBe('active');
    expect(promotionStatus(p, '2026-10-15')).toBe('active');
    expect(promotionStatus(p, '2026-10-16')).toBe('ended');
  });
  test('cancelled wins', () => expect(promotionStatus({ ...p, cancelledAt: 1 }, '2026-10-09')).toBe('cancelled'));
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

```ts
// lib/pricing/promo-status.ts
export type PromotionStatus = 'scheduled' | 'active' | 'ended' | 'cancelled';
export function promotionStatus(p: { startsOn: string; endsOn: string; cancelledAt: number | null }, today: string): PromotionStatus {
  if (p.cancelledAt !== null) return 'cancelled';
  if (today < p.startsOn) return 'scheduled';
  if (today <= p.endsOn) return 'active';
  return 'ended';
}
```
```ts
// lib/pricing/promo-planner.ts
import { addDaysIso } from './dates';
import type { RatePlan, RateRow } from './rate-planner';

const fail = (error: string): RatePlan => ({ ok: false, error });

export function planCancelPromo(existing: RateRow[], p: { from: string; to: string; regularMonto: number; today: string }): RatePlan {
  const promo = existing.find(r => r.desde === p.from && r.hasta === p.to);
  if (!promo) return fail('No se encontró la fila de la promoción (¿fue modificada manualmente?)');
  if (p.today > p.to) return fail('La promoción ya terminó');
  // Not started, or starting today: reprice the whole row to the regular amount (history stays in the app record).
  if (p.today <= p.from) return { ok: true, skipped: false, ops: [{ type: 'update', row: promo, set: { monto: p.regularMonto } }] };
  // Active: keep the elapsed days at the promo price, the rest at the regular price.
  return {
    ok: true, skipped: false, ops: [
      { type: 'update', row: promo, set: { hasta: addDaysIso(p.today, -1) } },
      { type: 'insert', desde: p.today, hasta: p.to, monto: p.regularMonto },
    ],
  };
}

export function planChangePromoEnd(existing: RateRow[], p: { from: string; to: string; newTo: string; regularMonto: number; today: string }): RatePlan {
  const promo = existing.find(r => r.desde === p.from && r.hasta === p.to);
  if (!promo) return fail('No se encontró la fila de la promoción (¿fue modificada manualmente?)');
  if (p.today > p.to) return fail('La promoción ya terminó');
  if (p.newTo === p.to) return { ok: true, skipped: true, ops: [] };
  if (p.newTo < p.from) return fail('La nueva fecha de fin no puede ser anterior al inicio');
  if (p.newTo < p.today) return fail('La nueva fecha de fin no puede ser anterior a hoy');

  const cont = existing.find(r => r.desde === addDaysIso(p.to, 1));
  const newContFrom = addDaysIso(p.newTo, 1);

  if (p.newTo > p.to) {
    if (!cont) return fail('No hay una tarifa regular posterior para extender la promoción');
    if (cont.hasta !== null && cont.hasta < newContFrom) return fail('La nueva fecha excede la vigencia de la tarifa regular');
    return { ok: true, skipped: false, ops: [
      { type: 'update', row: promo, set: { hasta: p.newTo } },
      { type: 'update', row: cont, set: { desde: newContFrom } },
    ] };
  }
  // shorten
  if (cont) {
    return { ok: true, skipped: false, ops: [
      { type: 'update', row: promo, set: { hasta: p.newTo } },
      { type: 'update', row: cont, set: { desde: newContFrom } },
    ] };
  }
  return { ok: true, skipped: false, ops: [
    { type: 'update', row: promo, set: { hasta: p.newTo } },
    { type: 'insert', desde: newContFrom, hasta: p.to, monto: p.regularMonto },
  ] };
}
```

- [ ] **Step 4: Run** tests → PASS. **Step 5: Commit** — `git add lib/pricing/promo-planner.ts lib/pricing/promo-status.ts __tests__/unit/pricing && git commit -m "feat(pricing): promotion cancel/end-date planners and computed status"`

---

### Task 3: Promotion schema, repository, validators

**Files:** Modify `lib/db/schema.ts` (append 3 tables); generate `migrations/sqlite/0010_*.sql`; Create `lib/pricing/promotions-repo.ts`, `lib/pricing/promo-validators.ts`; Tests `__tests__/unit/pricing/promotions-repo.test.ts`, `promo-validators.test.ts`.

**Interfaces — Produces:**
Schema:
```ts
export const pricingPromotions = sqliteTable('pricing_promotions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  reason: text('reason'),
  kind: text('kind', { enum: ['overlay', 'segment'] }).notNull(),
  coPrecio: text('co_precio').notNull(),          // overlay: target list; segment: the promo list
  baseCoPrecio: text('base_co_precio'),           // segment only
  tipCli: text('tip_cli'),                         // segment only: the special segment
  startsOn: text('starts_on').notNull(),
  endsOn: text('ends_on').notNull(),
  cancelledAt: integer('cancelled_at'),            // unix ms; null = not cancelled
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at').notNull(),
});
export const pricingPromotionItems = sqliteTable('pricing_promotion_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  promotionId: integer('promotion_id').notNull().references(() => pricingPromotions.id, { onDelete: 'cascade' }),
  coArt: text('co_art').notNull(),
  coAlma: text('co_alma'),                          // warehouse used (null until applied)
  promoMonto: real('promo_monto').notNull(),
  regularMonto: real('regular_monto'),              // regular price at creation (null if unknown/rejected)
  applied: integer('applied').notNull().default(0), // 0/1
  message: text('message'),                         // failure/skip reason
}, t => ({ uniq: unique('pricing_promotion_items_uniq').on(t.promotionId, t.coArt) }));
export const pricingPromotionCustomers = sqliteTable('pricing_promotion_customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  promotionId: integer('promotion_id').notNull().references(() => pricingPromotions.id, { onDelete: 'cascade' }),
  coCli: text('co_cli').notNull(),
  previousTipCli: text('previous_tip_cli').notNull(),
  moved: integer('moved').notNull().default(0),
}, t => ({ uniq: unique('pricing_promotion_customers_uniq').on(t.promotionId, t.coCli) }));
```
(`real` must be added to the existing `drizzle-orm/sqlite-core` import — it already is.)

Repo (`AppDb`): `insertPromotion(db, p: Omit<Promotion, 'id'>): number`; `getPromotion(db, id): Promotion | undefined`; `listPromotions(db): Promotion[]`; `insertItems(db, promotionId, items: { coArt; promoMonto }[]): void`; `listItems(db, promotionId): PromotionItem[]`; `updateItem(db, promotionId, coArt, patch: { coAlma?: string | null; regularMonto?: number | null; applied?: boolean; message?: string | null }): void`; `insertCustomers(db, promotionId, rows: { coCli; previousTipCli }[]): void`; `listCustomers(db, promotionId): PromotionCustomer[]`; `markCustomerMoved(db, promotionId, coCli, moved: boolean): void`; `setPromotionEnd(db, id, endsOn): void`; `cancelPromotion(db, id, at: number): void`; `setPromotionTipCli(db, id, tipCli: string): void`; `findPromotionCustomerPrevious(db, tipCli: string, coCli: string): string | undefined` (via promotion with that `tipCli`).

Validators (`promo-validators.ts`):
```ts
export type CreatePromotionInput =
  | { kind: 'overlay'; name: string; reason: string | null; coPrecio: string; startsOn: string; endsOn: string; items: { coArt: string; monto: number }[] }
  | { kind: 'segment'; name: string; reason: string | null; baseCoPrecio: string; customerCodes: string[]; startsOn: string; endsOn: string; items: { coArt: string; monto: number }[] };
export function validateCreatePromotionBody(body: unknown, today: string): Valid<CreatePromotionInput>
export function validatePatchPromotionBody(body: unknown, today: string): Valid<{ action: 'cancel' } | { action: 'change_end'; endsOn: string }>
```
Rules: name 1–40 chars (it becomes part of a ≤ 60-char ERP name), reason ≤ 200 optional; `startsOn` valid ISO ≥ today; `endsOn` valid ISO ≥ `startsOn`; items 1–200, unique `coArt`, monto > 0 with ≤ 5 decimals (same checks as Plan 2); segment: 1–500 unique customer codes ≤ 16 chars, `baseCoPrecio` ≤ 6 chars. Patch: `{ action: 'cancel' }` or `{ action: 'change_end', endsOn }` with `endsOn` valid ISO ≥ today.

- [ ] **Step 1: Failing tests** — repo: insert/get/list round trip; items unique per `(promotionId, coArt)`; `updateItem` merges; customers + `markCustomerMoved`; `cancelPromotion` sets `cancelledAt`; cascade delete removes items/customers; `findPromotionCustomerPrevious`. Validators: accept minimal overlay and segment; reject past start, `endsOn < startsOn`, empty items, duplicate items, name > 40, empty customers for segment, unknown kind; patch accepts `cancel`/`change_end`, rejects past `endsOn`, unknown action.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** schema (+ `bun run db:generate` → `0010_*.sql` creating only these three tables), repo, validators.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git add lib migrations/sqlite __tests__ && git commit -m "feat(pricing): promotion tables, repository and validators"`

---

### Task 4: Promotions service

**Files:** Create `lib/pricing/promotions-service.ts`; Tests `__tests__/unit/pricing/promotions-service.test.ts`.

**Interfaces — Consumes:** `RatesErp` (Plan 2 + Task 1 `applyPlanned`), `SegmentErp` (Plan 1), Tasks 2–3, Plan 2 `resolveArticleWarehouse`, `listRates` helpers (`getRatesGrid` not needed).
**Produces:**
```ts
export interface PromotionsDeps { rates: RatesErp; segments: SegmentErp; db: AppDb; now?: () => Date }
export interface PromotionItemDto { coArt: string; artDes: string; promoMonto: number; regularMonto: number | null; applied: boolean; message: string | null }
export interface PromotionDto {
  id: number; name: string; reason: string | null; kind: 'overlay' | 'segment'; coPrecio: string; desPrecio: string | null;
  baseCoPrecio: string | null; tipCli: string | null; startsOn: string; endsOn: string;
  status: PromotionStatus; daysLeft: number | null;            // days to endsOn while scheduled/active, else null
  itemCount: number; appliedCount: number; partial: boolean;   // partial = some items not applied or customers not moved (and not cancelled)
  customerCount: number; movedCount: number;
}
export interface PromotionDetailDto extends PromotionDto { items: PromotionItemDto[]; customers: { coCli: string; cliDes: string; previousTipCli: string; moved: boolean }[] }
export interface PreviewRow { coArt: string; artDes: string; regular: number | null; promo: number; status: 'ok' | 'rejected'; message: string | null }
listPromotionDtos(deps): Promise<PromotionDto[]>            // newest startsOn first
getPromotionDetail(deps, id): Promise<PromotionDetailDto>   // NotFoundError
previewPromotion(deps, input: CreatePromotionInput): Promise<{ rows: PreviewRow[]; customers: { coCli: string; cliDes: string; previousTipCli: string }[] }>
createPromotion(deps, input: CreatePromotionInput, actor: Actor): Promise<PromotionDetailDto>
patchPromotion(deps, id, input: { action: 'cancel' } | { action: 'change_end'; endsOn: string }, actor): Promise<PromotionDetailDto>
retryPromotion(deps, id, actor): Promise<PromotionDetailDto>   // re-apply unapplied items and move unmoved customers
```
Behavior:
- **preview**: overlay → for each item resolve the warehouse (Task 1 helper) and run `planRatePeriod` on that article's rows with `{ from: startsOn, to: endsOn, monto, today }` → `ok`/`rejected` + message; `regular` = the covering row's monto (null if none). Segment → same against the **base list** rows; also resolves `customers` (unknown customer → `NotFoundError`). No writes.
- **createPromotion (overlay)**: unknown list → `NotFoundError`; insert promotion + items; per item: resolve warehouse → capture `regularMonto` (covering row's monto) → `rates.applyPlanned(…, rows => planRatePeriod(rows, { from, to, monto, today }))`; `success`/`skipped` → `applied = 1`; `rejected` → `applied = 0, message`; `conflict`/thrown → `applied = 0, message = 'Conflicto…'/'Error…'`; store `coAlma`. Audit `promotion_create` (target = id, after = summary). Return detail.
- **createPromotion (segment)**: (1) base list must exist; customers resolved with `segments.getCustomer` (unknown → `NotFoundError`, nothing created); (2) `cloneList` via Plan 2 `lists-service.cloneList({ mode:'clone', sourceCoPrecio: base, desPrecio: 'PROMO ' + name (≤ 60), percent: null, effectiveFrom: today })` → promo list; (3) insert promotion (`coPrecio` = promo list) + items; (4) per item: same planner against the promo list (cloned rows start today ≤ startsOn); (5) create the special segment: `nextTipCliCode(await segments.listCodes())`, `segments.createSegment({ tipCli, desTipo: buildSegmentName({ customerName: name, reason: '', endsOn, today }), coPrecio: promoList, user })`, `upsertSegmentMeta` (`kind: 'special'`, `customerCoCli: null`, `reason: name`, `expiresAt: endsOn`, `fallbackTipCli`: the most common previous segment among the customers, `previousTipCli: null`), `setPromotionTipCli`; (6) insert `pricing_promotion_customers` (`previousTipCli` from step 1) then move each customer (`segments.moveCustomer`) → `markCustomerMoved(true)` on success + audit `customer_move`; failures stay `moved = 0`. Audit `promotion_create`.
- **patchPromotion cancel**: `ended`/`cancelled` → `ValidationError`. Overlay: for each applied item run `applyPlanned` with `planCancelPromo(rows, { from, to, regularMonto: item.regularMonto!, today })`. Segment: same on the promo list rows **and** move moved customers back to `previousTipCli` (target missing → promotion/segment `fallbackTipCli`), `markCustomerMoved(false)`. Then `cancelPromotion`. Segment meta `expiresAt` set to `today - 1` day so the sweep ignores nothing extra (no customers remain). Audit `promotion_cancel`. If any ERP step fails the promotion is **not** marked cancelled and the detail shows the failing items (`message`).
- **patchPromotion change_end**: `ended`/`cancelled` → `ValidationError`; `endsOn < startsOn` → `ValidationError`; per applied item `planChangePromoEnd`; success → `setPromotionEnd`, and for segment kind `setSegmentExpiry(db, tipCli, endsOn)`. Audit `promotion_extend`.
- **retryPromotion**: for items with `applied = 0` re-run the apply step; for customers with `moved = 0` retry the move; idempotent (planner `skipped`).
- Item names (`artDes`) come from `rates.listArticles({})`; customer names from `segments.getCustomer`.
- `partial` = not cancelled && (`appliedCount < itemCount` || (`kind === 'segment'` && `movedCount < customerCount`)).

- [ ] **Step 1: Failing tests** — use `makeFakeRatesErp`, `makeFakeSegmentErp` and `makeMemoryDb`; seed list `08` with `A1`@10 and `A2`@20 (open-ended from 2026-03-15, warehouse `000015`), `A3` with no rows, and customers `C1`, `C2` in segment `000001`. Clock `2026-10-01`. Cases (write each as its own `test`):
  1. **overlay create** `A1`→8, `A2`→15 from 2026-10-05 to 2026-10-15: rows for `A1` in the fake are `[03-15→10-04 @10, 10-05→10-15 @8, 10-16→∞ @10]`; both items `applied`; `regularMonto` captured (10/20); status `scheduled`; audit `promotion_create`.
  2. **partial**: `A3` (no regular rate) in the same promotion → that item `applied=false` with the planner message, others applied, `partial === true`; then add a regular row for `A3` in the fake and `retryPromotion` → `partial === false`; second `retryPromotion` changes nothing.
  3. **scheduled change inside the window** (fake has a row starting 2026-10-10 for `A2`) → rejected for `A2` only.
  4. **cancel before start**: `A1`/`A2` rows afterwards are contiguous with no day uncovered between `2026-03-15` and infinity (write a small helper `assertNoGaps(rows)` in the test), status `cancelled`.
  5. **cancel while active** (clock `2026-10-09`): elapsed days keep the promo price, remaining at regular, no gaps.
  6. **cancel ended** → `ValidationError`.
  7. **change_end** extend `10-15 → 10-20` and shorten `10-15 → 10-12`: continuation `desde` shifts, no gaps/overlaps; `endsOn` updated; audit `promotion_extend`.
  8. **segment create** with `C1`, `C2`, base `08`: promo list `PROMO <name>` exists (cloned rates), bounded rows applied, special segment created with meta (`expiresAt = endsOn`, `kind = 'special'`, `fallbackTipCli = '000001'`), both customers moved, `promotion_customers.previousTipCli = '000001'`.
  9. **segment move conflict** for `C2` (`fake.moveConflict` for that customer) → `moved = false` for `C2`, `partial === true`; retry after clearing the conflict moves only `C2`.
  10. **segment cancel** → customers back in `000001`, `moved = false`, promotion `cancelled`.
  11. **preview** returns `rejected` rows without writing anything (fake state unchanged).
  12. **same-day**: regular row for `A1` also starts `2026-10-01` and the promo starts `2026-10-01` → uses the in-place branch (no duplicate `desde`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** per the behavior block. Keep each public function < ~80 lines by extracting `applyItem(deps, promotion, item, actor)`, `moveCustomers(...)`, `revertCustomers(...)` helpers.
- [ ] **Step 4: Run** `bun test --isolate --env-file=.env.local __tests__/unit/pricing/promotions-service.test.ts` → PASS; `bunx tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `git add lib __tests__ && git commit -m "feat(pricing): promotions service (overlay and segment kinds, cancel, extend, retry)"`

---

### Task 5: Sweep (pure + service), script, scheduling docs

**Files:** Create `lib/pricing/sweep.ts`, `lib/pricing/sweep-erp.ts`, `scripts/sweep-promotions.ts`; Modify `package.json` (`"pricing:sweep-promotions": "bun --bun run scripts/sweep-promotions.ts"`), `INSTRUCTIONS.md`; Tests `__tests__/unit/pricing/sweep.test.ts`.

**Interfaces — Produces:**
```ts
export interface SweepErp {
  getSegment(tipCli: string): Promise<{ tipCli: string } | null>;
  listCustomersInSegment(tipCli: string): Promise<{ coCli: string; cliDes: string }[]>;
  moveCustomer(coCli: string, targetTipCli: string, user: string): Promise<SegmentMoveResult>;
}
export interface SweepSummary { segmentsChecked: number; moved: number; skipped: number; failed: number; errors: string[] }
export function pickRevertTarget(p: { promotionPrevious: string | undefined; metaPrevious: string | null; metaFallback: string | null }, exists: (tipCli: string) => boolean): string | null
export async function runSweep(deps: { erp: SweepErp; db: AppDb; now?: () => Date }, actor: { id: string; erpUser: string }): Promise<SweepSummary>
export function realSweepErp(pool: ConnectionPool): SweepErp
```
Behavior of `runSweep`: for every `pricing_segment_meta` row with `kind = 'special'` and `expiresAt < today` (string compare): list the customers still in that segment (`listCustomersInSegment`); for each customer compute the target = `pickRevertTarget` (order: `findPromotionCustomerPrevious(db, tipCli, coCli)` → `meta.previousTipCli` → `meta.fallbackTipCli`; each candidate is accepted only if `erp.getSegment` finds it; a candidate equal to the expired segment itself is rejected); no target → `failed++` + error message; `moveCustomer` success → `moved++` + audit `sweep_revert` (before `{ tipCli }`, after `{ tipCli: target }`); `conflict`/`error` → `failed++` + message. Customers not in the segment are never touched (that is how hand-moved customers are skipped); segments with zero customers count toward `segmentsChecked` only. Promotions' `status` is not written (it is computed).

- [ ] **Step 1: Failing tests** — fakes: in-memory `SweepErp` (customers map + segments set). Cases: (a) reverts every customer to its promotion `previousTipCli`; (b) one-customer special segment (Plan 1 style, no promotion row) reverts to `meta.previousTipCli`; (c) `previousTipCli` segment no longer exists → falls back to `fallbackTipCli`; (d) neither exists → `failed` with message, customer untouched; (e) customer already moved by hand (not listed in the segment) → untouched, not counted as moved; (f) second run immediately after → `moved === 0`; (g) segment not yet expired (`expiresAt === today`) → ignored; (h) a conflict result → `failed` counted, others continue; (i) `pickRevertTarget` unit cases (order of preference, rejects non-existing, rejects self).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `sweep.ts`, `sweep-erp.ts` (`listCustomersInSegment`: `SELECT RTRIM(co_cli) AS coCli, RTRIM(cli_des) AS cliDes FROM saCliente WHERE RTRIM(tip_cli) = RTRIM(@t)`; `getSegment` via Plan 1 `getSegmentRow`; `moveCustomer` via Plan 1 `assignCustomerToSegment`), and the script modeled on `scripts/send-invoice-reminders.ts`:

```ts
import { getPool } from '@/lib/db/mssql';
import { getDb } from '@/lib/db/sqlite';
import { realSweepErp, runSweep } from '@/lib/pricing/sweep';

async function main() {
  const pool = await getPool();
  try {
    const summary = await runSweep(
      { erp: realSweepErp(pool), db: getDb() },
      { id: 'sweep', erpUser: process.env.PRICING_ERP_SERVICE_USER ?? 'PROFIT' },
    );
    console.log(`[pricing:sweep-promotions] ${new Date().toISOString()} — segments=${summary.segmentsChecked} moved=${summary.moved} skipped=${summary.skipped} failed=${summary.failed}`);
    for (const e of summary.errors) console.warn(`[pricing:sweep-promotions] ${e}`);
    if (summary.failed > 0) process.exitCode = 1;
  } finally {
    await pool.close();
  }
}
main().catch(err => { console.error('[pricing:sweep-promotions] fatal error:', err instanceof Error ? err.message : err); process.exit(1); });
```
In `INSTRUCTIONS.md`, after the invoice-reminders step, add *Step 10: Scheduling the Pricing Promotion Sweep (Windows Task Scheduler)* mirroring Step 9's structure: command `bun run pricing:sweep-promotions`, working directory = app directory, daily at 00:30, "run whether user is logged on or not", note that it exits non-zero on any failure and that it is idempotent (safe to run twice).
- [ ] **Step 4: Run** sweep tests → PASS; run the script once against the mock ERP with a clean temp `SQLITE_PATH`... the script uses `getDb()` (the real `data/exporter.db`): run it only with `SQLITE_PATH` pointed at a temp directory that has had `bun run migrate` applied (dev-DB hazard). Expected: `segments=0 moved=0 failed=0`.
- [ ] **Step 5: Commit** — `git add lib scripts package.json INSTRUCTIONS.md __tests__ && git commit -m "feat(pricing): expired special-segment sweep script and scheduling docs"`

---

### Task 6: API routes

**Files:** Modify `lib/pricing/http.ts` (append `buildPromotionsDeps(): Promise<PromotionsDeps>`); Create `app/api/pricing/promotions/route.ts`, `app/api/pricing/promotions/preview/route.ts`, `app/api/pricing/promotions/[id]/route.ts`, `app/api/pricing/promotions/[id]/retry/route.ts`; Test `__tests__/unit/pricing/promo-routes-validation.test.ts` (validators only; routes are thin).

**Interfaces — Produces (gated by `requirePricingAccess`; `{ error }` bodies; PostHog `pricing_promotion_created` / `_updated` / `_retried`):**
- `GET /api/pricing/promotions` (view) → `{ promotions: PromotionDto[] }`
- `POST /api/pricing/promotions` (edit) → `201 { promotion: PromotionDetailDto }`
- `POST /api/pricing/promotions/preview` (view) → `{ rows, customers }` (read-only, hence `view`)
- `GET /api/pricing/promotions/[id]` (view) → `{ promotion: PromotionDetailDto }` (404 unknown)
- `PATCH /api/pricing/promotions/[id]` (edit) body `{ action: 'cancel' } | { action: 'change_end', endsOn }` → `{ promotion }`
- `POST /api/pricing/promotions/[id]/retry` (edit) → `{ promotion }`
- Also: add `'pricing-promociones'` to `HELP_PAGES` (Task 8 writes the content).

- [ ] **Step 1–5:** write the validation test cases first (reuse `validateCreatePromotionBody`/`validatePatchPromotionBody` failure paths as the route contract), implement the routes with the same handler template as Plan 2 Task 6, run `bunx tsc --noEmit`, smoke the service against the mock ERP in a scratch script (`previewPromotion` on list `08` for two real articles → plausible `regular` values; **no writes**), and commit: `git add lib app/api __tests__ && git commit -m "feat(pricing): promotion API routes"`.

---

### Task 7: Promotions tab — list, detail, dialogs

**Files:** Create `app/(app)/pricing/promotions-tab.tsx`, `app/(app)/pricing/promotion-list.tsx`, `app/(app)/pricing/promotion-detail.tsx`, `app/(app)/pricing/promo-status-badge.ts`, `app/(app)/pricing/cancel-promotion-dialog.tsx`, `app/(app)/pricing/change-end-dialog.tsx`; Modify `lib/pricing/client-types.ts` (re-export `PromotionDto`, `PromotionDetailDto`, `PreviewRow`); Test `__tests__/unit/pricing/promo-status-badge.test.ts`.

**Interfaces — Produces:**
- `promoStatusBadge(p: Pick<PromotionDto, 'status' | 'daysLeft' | 'partial'>): { label: string; tone: 'ok' | 'warn' | 'expired' | 'muted' | 'info' }` (pure): `scheduled` → `{ 'Programada', 'info' }`; `active` → `{ 'Activa · N d', daysLeft ≤ 7 ? 'warn' : 'ok' }` (`'Activa · termina hoy'` when 0); `ended` → `{ 'Terminada', 'muted' }`; `cancelled` → `{ 'Cancelada', 'muted' }`; `partial` appends `' · parcial'` and forces tone `'warn'` unless cancelled/ended.
- `PromotionList({ promotions, selectedId, onSelect, loading, error, onNew, canEdit })` — groups *Activas*, *Programadas*, *Terminadas*, *Canceladas*; each row: name, kind chip (`Lista` / `Segmento`), target (`coPrecio · desPrecio` or segment), dates (`dd/mm – dd/mm`), item count, badge; empty state "No hay promociones".
- `PromotionDetail({ detail, loading, error, canEdit, onCancel(), onChangeEnd(), onRetry(), onDuplicate() })` — header with badge and dates; timeline bar (`<div role="img" aria-label="Del 05/10 al 15/10, hoy día 4 de 11">` proportional fill, plain CSS); items table (Artículo · Regular · Promo · % · estado with `message` for failures); for segment kind a customers table (Cliente · Segmento previo · Movido); buttons: *Cancelar* (active/scheduled), *Cambiar fecha de fin* (active/scheduled), *Reintentar* (when `partial`), *Duplicar* (always).
- `CancelPromotionDialog({ detail, onConfirm(): Promise<void>, onClose })` — explains what happens ("los precios vuelven a la tarifa regular desde hoy" / "los clientes vuelven a su segmento anterior"); `ChangeEndDialog({ detail, onConfirm(endsOn: string): Promise<void>, onClose })` — date input `min=max(today, startsOn)`.
- `PromotionsTab({ canEdit })`: loads `/api/pricing/promotions` + selected detail (`?promo=<id>`), orchestrates dialogs, shows the wizard (Task 8) when `?new=1` or after `Duplicar` (prefill state).

- [ ] **Step 1: Failing test** for `promoStatusBadge` (all branches incl. partial, 0/1/7/8 days).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the files (status badge text is always shown, not color-only; skeletons while loading; error banners; focus-visible rings; buttons ≥ 44px).
- [ ] **Step 4: Verify** — test PASS; `bunx tsc --noEmit`; `bun run lint`.
- [ ] **Step 5: Commit** — `git add -A app lib __tests__ && git commit -m "feat(pricing): promotions list, detail and dialogs"`

---

### Task 8: Creation wizard, help content, wiring, verification

**Files:** Create `app/(app)/pricing/promotion-wizard.tsx`, `app/(app)/pricing/promo-items-grid.tsx`, `content/help/pricing-promociones.md`, `e2e/pricing-promotions.spec.ts`; Modify `app/(app)/pricing/pricing-shell.tsx` (append `{ id: 'promociones', label: 'Promociones', helpPage: 'pricing-promociones' }`, render `<PromotionsTab canEdit={canEdit} />`), `app/api/help/[page]/route.ts` (slug, if not added in Task 6).

**Interfaces — Produces:**
- `PromotionWizard({ initial?: Partial<WizardState>, priceLists: PriceListDto[], onDone(id: number): void, onCancel(): void })` with 4 steps and a step indicator (`aria-current="step"`):
  1. *Qué*: name (≤ 40), reason, kind radio (*Sobre una lista* / *Para un segmento o clientes*); kind 1: target list (`SearchableSelect`); kind 2: base list + customers (multi-select list built on `GET /api/pricing/customers?search=…` with checkboxes, chips for the picked ones, max 500).
  2. *Artículos y precio*: `PromoItemsGrid` over `GET /api/pricing/lists/<list>/rates` rows that have a current price (hides the rest behind "Mostrar artículos sin precio" but those are not selectable): checkbox per article, `PriceCell` + `PercentCell` (Plan 3 Task 1 shared cells; reference = current price), bulk "+/− %" and "Fijar precio" for selected rows (`bulkNewPrices`), counter "N artículos con precio promocional".
  3. *Fechas*: start (`min` today), end (`min` start), live summary "Termina en N días".
  4. *Revisión*: calls `POST /api/pricing/promotions/preview`; table Artículo · Regular → Promo · estado (`ok`/`rejected` + message); timeline bar; for kind 2 the customers that move and "volverán a su segmento anterior el dd/mm"; **Aplicar** disabled while any item is `rejected` unless the user ticks "Continuar sin los artículos rechazados" (rejected items are then dropped from the request); on success `onDone(id)`.
- `PromoItemsGrid`: props `{ rows: GridRow[]; staged: Staged; onStage(coArt, monto | null): void; selected: Set<string>; onToggle; onToggleAll; bulk bar props }` built on `rate-cells.tsx` and `rates-staging.ts` helpers.
- Duplicate: `initial` carries `name + ' (copia)'` (truncated to 40), kind, target/base list, customers, items; dates cleared.

- [ ] **Step 1: Help + e2e.** Write `content/help/pricing-promociones.md` (Spanish, `content/help/dashboard.md` style) explaining: the two kinds and when to pick each; what Profit does at expiry for each (kind 1: the date lookup returns to the regular row on its own; kind 2: the nightly task moves customers back — mention it must be scheduled, link to `INSTRUCTIONS.md` Step 10 by name); that cancelling/shortening never leaves a day without price; partial applications and *Reintentar*; the *Duplicar* shortcut; what to check if a customer still has the promo list after `ends_on + 1` (the sweep ran? see audit/logs). Write `e2e/pricing-promotions.spec.ts` tagged `@mssql`: a view-only user sees promotions but no *Nueva promoción*, and the help panel shows the Promociones heading.
- [ ] **Step 2: Implement** the wizard + grid + wiring. Validation messages inline; no browser dialogs.
- [ ] **Step 3: Final verification (Plan 3 done criteria)** — all green:

```bash
bunx tsc --noEmit
bun run lint
bun test --isolate --env-file=.env.local __tests__/unit
bun run test:pricing-erp
bun run build
```
Then an end-to-end scratch run through the **services** against the mock ERP (restore everything afterwards): preview + create an overlay promo on two articles of a throwaway list for a window next week; read the rows; shorten it; cancel it; verify no uncovered day via a query; create a segment promo for two customers; advance the injected clock past `endsOn`; run `runSweep`; verify both customers are back in their segment and a second run moves nothing; delete the scratch list/segments/rows. Record the outputs in the commit body.
- [ ] **Step 4: Commit** — `git add -A app content e2e lib && git commit -m "feat(pricing): promotion wizard, help content and Promociones tab"`
