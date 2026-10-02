# Pricing Plan 2/4 — Price Lists & Rates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a **Listas** tab where staff create and clone price lists, edit article rates inline or in bulk with linked price↔% inputs and full history (close-and-insert), and look up an article's price across every list.

**Architecture:** A pure, heavily tested rate planner (`planRatePeriod`) decides insert/update operations from the existing `saArtPrecio` rows; a thin ERP adapter executes them in one SQL transaction per article through new `pApi…` wrapper procedures; a `lists-service` (behind a `RatesErp` interface, like Plan 1's `SegmentErp`) orchestrates, audits, and is unit-tested with an in-memory fake; routes and a staged-edit grid UI sit on top.

**Tech Stack:** as Plan 1.

**Spec:** `docs/superpowers/specs/2026-10-01-pricing-lists-and-rates-design.md`

## Dependency on Plan 1 (must be merged on this branch and green first)

Consumes from Plan 1, exactly:
- `lib/db/schema.ts`: `pricingAuditLog`, `PRICING_AUDIT_ACTIONS` (already contains `list_create`, `list_clone`, `rates_apply`).
- `lib/pricing/segments-repo.ts`: `appendAudit(db, { userId, action, target, before?, after?, now? })`.
- `lib/pricing/dates.ts`: `todayIso`, `isValidIsoDate`, `addDaysIso`, `daysBetweenIso`.
- `lib/pricing/segments-service.ts`: `NotFoundError`, `ConflictError`, `ValidationError`, `Actor`.
- `lib/pricing/segment-name.ts`: `nextTipCliCode` (not reused; list codes have their own allocator).
- `lib/pricing/http.ts`: `serviceErrorResponse`, `actorFrom`.
- `lib/pricing/validators.ts`: the `Valid<T>` type.
- `app/(app)/pricing/pricing-shell.tsx`: the `TABS` array; `app/(app)/pricing/api-client.ts`: `apiGet`, `apiSend`, `ApiError`.
- `__tests__/helpers/memory-db.ts`: `makeMemoryDb()`.
- `lib/pricing/client-types.ts`: `PriceListDto`, `FilterOption` (this plan **extends** `PriceListDto`).

Produces for Plan 3: `planRatePeriod` (supports bounded `to`), `RatesErp.applyRatePeriod`, `RatesErp.cloneList`, `lists-service` (`createList`, `cloneList`, `applyRates`), `lib/pricing/rates-staging.ts` helpers, the grid components (`rates-grid.tsx`, `list-rail.tsx`), `pricing_list_meta`.

## Global Constraints

Everything in Plan 1's *Global Constraints* applies unchanged (branch `feat/pricing-redesign`, commit style, test commands, never touch `data/exporter.db`, route rules, ERP-only-through-procedures, spanish copy, `SearchableSelect`/`Modal` usage). Plan-specific:

- Rate dates are `YYYY-MM-DD` strings in code; the ERP wrappers take `CHAR(10)` strings and convert with `CONVERT(DATETIME, x, 23)` (avoids timezone shifts). Read dates with `CONVERT(VARCHAR(10), col, 23)`.
- Money: rates stored with 5 decimals, displayed/entered with 2; rounding is **half-up** via `roundHalfUp` (Task 1). Spanish input accepts `12,40` and `12.40`.
- `saArtPrecio` row key is `(co_art, co_precio, co_alma_calculado, desde)`. Live data has **every row in warehouse `000015`** (none "TODOS"): a rate change keeps the warehouse of the row it replaces; new articles use the list's dominant warehouse; empty lists use the install-wide dominant warehouse; fallback `'TODOS'` (= `co_alma` NULL). An article with rows in two warehouses inside one list is read-only (`ambiguous`).
- The app never creates overlapping periods for one `(article, list, warehouse)`.
- Rate procedures have **no inner `BEGIN TRAN`**: the adapter owns the transaction (`sql.Transaction`).
- Past `effectiveFrom` (< today) is rejected. Active rows only (`Inactivo = 0`) are read.
- List codes: next free 2-digit numeric (`01`..`99`), else 6-digit numeric; non-numeric codes (`TP1151`, `2023`) are ignored for allocation but never collided with.
- Catalog is small (~30 priced articles of 167): the rates endpoint returns the full list and the client filters; no pagination.

## Review Focus

1. Same-day re-edit (second apply on the same `effectiveFrom`) updates in place, never collides on the unique key (Tasks 2, 4).
2. Scheduled-change interplay: editing from a date before an already-scheduled later row sets `hasta = next.desde − 1` (Task 2).
3. An article whose list rows span two warehouses is rejected, not guessed (Task 5).
4. Clone failing midway leaves **no** new list behind (single transaction) (Tasks 4, 5).
5. Typed % rounds the price; the derived Δ% is recomputed from the rounded price (Task 1); bulk "+%" on rows without a reference price skips them instead of writing garbage (Tasks 1, 7).

---

### Task 1: Rate math and input parsing (pure)

**Files:** Create `lib/pricing/rates-math.ts`; Test `__tests__/unit/pricing/rates-math.test.ts`.

**Interfaces — Produces:**
`roundHalfUp(n: number, dp?: number): number`; `priceFromPercent(ref: number, pct: number): number`; `percentFromPrice(ref: number | null, price: number): number | null` (2 dp, `null` when ref ≤ 0 or null); `parseDecimalInput(text: string): number | null`; `parsePercentInput(text: string): number | null`; `bulkNewPrices(rows: { coArt: string; reference: number | null }[], op: { type: 'percent'; pct: number } | { type: 'set'; monto: number }): Record<string, number>`.

- [ ] **Step 1: Failing test**

```ts
import { describe, test, expect } from 'bun:test';
import { roundHalfUp, priceFromPercent, percentFromPrice, parseDecimalInput, parsePercentInput, bulkNewPrices } from '@/lib/pricing/rates-math';

describe('roundHalfUp', () => {
  test('rounds .5 up even where binary floats misbehave', () => {
    expect(roundHalfUp(1.005)).toBe(1.01);
    expect(roundHalfUp(2.675)).toBe(2.68);
    expect(roundHalfUp(12.9952)).toBe(13);
    expect(roundHalfUp(0.125, 2)).toBe(0.13);
  });
});

describe('price <-> percent', () => {
  test('priceFromPercent', () => {
    expect(priceFromPercent(12.4, 4.8)).toBe(13);
    expect(priceFromPercent(100, -8)).toBe(92);
  });
  test('percentFromPrice is derived from the rounded price', () => {
    expect(percentFromPrice(12.4, 13)).toBe(4.84);
    const price = priceFromPercent(10, 5.01);   // 10.501 -> 10.5
    expect(price).toBe(10.5);
    expect(percentFromPrice(10, price)).toBe(5);
  });
  test('null/zero reference gives null', () => {
    expect(percentFromPrice(null, 5)).toBeNull();
    expect(percentFromPrice(0, 5)).toBeNull();
  });
});

describe('parsing', () => {
  test('decimal comma, decimal point, thousands dots', () => {
    expect(parseDecimalInput('12,40')).toBe(12.4);
    expect(parseDecimalInput('12.40')).toBe(12.4);
    expect(parseDecimalInput('1.234,50')).toBe(1234.5);
    expect(parseDecimalInput(' 7 ')).toBe(7);
  });
  test('garbage and empty are null', () => {
    expect(parseDecimalInput('')).toBeNull();
    expect(parseDecimalInput('abc')).toBeNull();
    expect(parseDecimalInput('1,2,3')).toBeNull();
  });
  test('percent accepts sign and % symbol', () => {
    expect(parsePercentInput('+4,8%')).toBe(4.8);
    expect(parsePercentInput('-3')).toBe(-3);
    expect(parsePercentInput('4.8 %')).toBe(4.8);
    expect(parsePercentInput('x')).toBeNull();
  });
});

describe('bulkNewPrices', () => {
  test('percent applies to each row reference and skips rows without one', () => {
    const out = bulkNewPrices([{ coArt: 'A', reference: 10 }, { coArt: 'B', reference: null }, { coArt: 'C', reference: 20 }], { type: 'percent', pct: 10 });
    expect(out).toEqual({ A: 11, C: 22 });
  });
  test('set applies one price to every row', () => {
    expect(bulkNewPrices([{ coArt: 'A', reference: null }, { coArt: 'B', reference: 3 }], { type: 'set', monto: 5 })).toEqual({ A: 5, B: 5 });
  });
  test('results that would be ≤ 0 are dropped', () => {
    expect(bulkNewPrices([{ coArt: 'A', reference: 10 }], { type: 'percent', pct: -100 })).toEqual({});
  });
});
```

- [ ] **Step 2: Run** `bun test --isolate --env-file=.env.local __tests__/unit/pricing/rates-math.test.ts` → FAIL.
- [ ] **Step 3: Implement**

```ts
// lib/pricing/rates-math.ts
export function roundHalfUp(n: number, dp = 2): number {
  if (!Number.isFinite(n)) return n;
  const shifted = Math.round(Number(`${n.toFixed(10)}e${dp}`));
  return Number(`${shifted}e-${dp}`);
}

export function priceFromPercent(ref: number, pct: number): number {
  return roundHalfUp(ref * (1 + pct / 100), 2);
}

export function percentFromPrice(ref: number | null, price: number): number | null {
  if (ref === null || !(ref > 0)) return null;
  return roundHalfUp((price / ref - 1) * 100, 2);
}

export function parseDecimalInput(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  let normalized: string;
  if (t.includes(',')) {
    if ((t.match(/,/g) ?? []).length > 1) return null;
    normalized = t.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = t;
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function parsePercentInput(text: string): number | null {
  return parseDecimalInput(text.replace(/%/g, '').replace(/^\+/, '').trim());
}

export function bulkNewPrices(
  rows: { coArt: string; reference: number | null }[],
  op: { type: 'percent'; pct: number } | { type: 'set'; monto: number },
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const price = op.type === 'set' ? roundHalfUp(op.monto, 2) : r.reference === null ? null : priceFromPercent(r.reference, op.pct);
    if (price !== null && price > 0) out[r.coArt] = price;
  }
  return out;
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git add lib/pricing/rates-math.ts __tests__/unit/pricing/rates-math.test.ts && git commit -m "feat(pricing): rate rounding, linking and input parsing"`

---

### Task 2: Rate period planner (pure, shared with Plan 3)

**Files:** Create `lib/pricing/rate-planner.ts`; Test `__tests__/unit/pricing/rate-planner.test.ts`.

**Interfaces — Consumes:** `addDaysIso` (Plan 1).
**Produces:**
```ts
export interface RateRow { coArt: string; coPrecio: string; coAlma: string /* 'TODOS' or code */; desde: string; hasta: string | null; monto: number; coMone: string | null; validador: string /* '0x…' */ }
export type RateOp =
  | { type: 'insert'; desde: string; hasta: string | null; monto: number }
  | { type: 'update'; row: RateRow; set: { desde?: string; hasta?: string | null; monto?: number } };
export type RatePlan = { ok: true; skipped: boolean; ops: RateOp[] } | { ok: false; error: string };
export function planRatePeriod(existing: RateRow[], p: { from: string; to: string | null; monto: number; today: string }): RatePlan;
```
`existing` = active rows of exactly one `(article, list, warehouse)`.

- [ ] **Step 1: Failing test**

```ts
import { describe, test, expect } from 'bun:test';
import { planRatePeriod, type RateRow } from '@/lib/pricing/rate-planner';

const row = (desde: string, hasta: string | null, monto: number): RateRow =>
  ({ coArt: 'A', coPrecio: '08', coAlma: '000015', desde, hasta, monto, coMone: 'USD', validador: '0x0000000000000001' });
const today = '2026-10-01';

describe('unbounded change (Plan 2)', () => {
  test('1. no current row → insert open-ended', () => {
    expect(planRatePeriod([], { from: '2026-10-01', to: null, monto: 5, today })).toEqual({ ok: true, skipped: false, ops: [{ type: 'insert', desde: '2026-10-01', hasta: null, monto: 5 }] });
  });
  test('2. current started earlier → close it the day before and insert', () => {
    const cur = row('2026-03-15', null, 4);
    const plan = planRatePeriod([cur], { from: '2026-10-05', to: null, monto: 5, today });
    expect(plan).toEqual({ ok: true, skipped: false, ops: [
      { type: 'update', row: cur, set: { hasta: '2026-10-04' } },
      { type: 'insert', desde: '2026-10-05', hasta: null, monto: 5 },
    ] });
  });
  test('3. current started exactly on from → update monto in place (same-day re-edit)', () => {
    const cur = row('2026-10-01', null, 4);
    expect(planRatePeriod([cur], { from: '2026-10-01', to: null, monto: 5, today })).toEqual({ ok: true, skipped: false, ops: [{ type: 'update', row: cur, set: { monto: 5 } }] });
  });
  test('4. later scheduled row bounds the new one', () => {
    const cur = row('2026-03-15', '2026-10-31', 4);
    const later = row('2026-11-01', null, 6);
    const plan = planRatePeriod([later, cur], { from: '2026-10-05', to: null, monto: 5, today });
    expect(plan).toEqual({ ok: true, skipped: false, ops: [
      { type: 'update', row: cur, set: { hasta: '2026-10-04' } },
      { type: 'insert', desde: '2026-10-05', hasta: '2026-10-31', monto: 5 },
    ] });
  });
  test('4b. no covering row but a later row exists → insert ends the day before it', () => {
    const later = row('2026-11-01', null, 6);
    expect(planRatePeriod([later], { from: '2026-10-05', to: null, monto: 5, today }))
      .toEqual({ ok: true, skipped: false, ops: [{ type: 'insert', desde: '2026-10-05', hasta: '2026-10-31', monto: 5 }] });
  });
  test('5. same price → skipped', () => {
    expect(planRatePeriod([row('2026-03-15', null, 5)], { from: '2026-10-05', to: null, monto: 5, today })).toEqual({ ok: true, skipped: true, ops: [] });
  });
  test('ended rows are not "covering"', () => {
    const old = row('2026-01-01', '2026-02-28', 3);
    expect(planRatePeriod([old], { from: '2026-10-01', to: null, monto: 5, today }).ok).toBe(true);
  });
});

describe('validation', () => {
  test('past start rejected', () => expect(planRatePeriod([], { from: '2026-09-30', to: null, monto: 5, today }).ok).toBe(false));
  test('non-positive monto rejected', () => expect(planRatePeriod([], { from: '2026-10-01', to: null, monto: 0, today }).ok).toBe(false));
  test('end before start rejected', () => expect(planRatePeriod([row('2026-01-01', null, 4)], { from: '2026-10-10', to: '2026-10-09', monto: 5, today }).ok).toBe(false));
});

describe('bounded period (promotions, Plan 3)', () => {
  test('promo inside an open-ended regular row → close, promo, continuation', () => {
    const cur = row('2026-03-15', null, 4);
    expect(planRatePeriod([cur], { from: '2026-10-05', to: '2026-10-15', monto: 3, today })).toEqual({ ok: true, skipped: false, ops: [
      { type: 'update', row: cur, set: { hasta: '2026-10-04' } },
      { type: 'insert', desde: '2026-10-05', hasta: '2026-10-15', monto: 3 },
      { type: 'insert', desde: '2026-10-16', hasta: null, monto: 4 },
    ] });
  });
  test('promo starting on the covering row start → that row becomes the promo, continuation after', () => {
    const cur = row('2026-10-01', null, 4);
    expect(planRatePeriod([cur], { from: '2026-10-01', to: '2026-10-15', monto: 3, today })).toEqual({ ok: true, skipped: false, ops: [
      { type: 'update', row: cur, set: { monto: 3, hasta: '2026-10-15' } },
      { type: 'insert', desde: '2026-10-16', hasta: null, monto: 4 },
    ] });
  });
  test('promo reaching the end of a bounded covering row needs no continuation', () => {
    const cur = row('2026-03-15', '2026-10-15', 4);
    const plan = planRatePeriod([cur, row('2026-10-16', null, 6)], { from: '2026-10-05', to: '2026-10-15', monto: 3, today });
    expect(plan).toEqual({ ok: true, skipped: false, ops: [
      { type: 'update', row: cur, set: { hasta: '2026-10-04' } },
      { type: 'insert', desde: '2026-10-05', hasta: '2026-10-15', monto: 3 },
    ] });
  });
  test('continuation keeps the covering row original hasta', () => {
    const cur = row('2026-03-15', '2026-12-31', 4);
    const plan = planRatePeriod([cur], { from: '2026-10-05', to: '2026-10-15', monto: 3, today });
    expect(plan.ok && plan.ops[2]).toEqual({ type: 'insert', desde: '2026-10-16', hasta: '2026-12-31', monto: 4 });
  });
  test('rejects when a later row starts inside the window', () => {
    const plan = planRatePeriod([row('2026-03-15', '2026-10-09', 4), row('2026-10-10', null, 6)], { from: '2026-10-05', to: '2026-10-15', monto: 3, today });
    expect(plan.ok).toBe(false);
  });
  test('rejects when there is no regular rate to split', () => {
    expect(planRatePeriod([], { from: '2026-10-05', to: '2026-10-15', monto: 3, today }).ok).toBe(false);
  });
  test('identical promo already present → skipped', () => {
    const promo = row('2026-10-05', '2026-10-15', 3);
    expect(planRatePeriod([row('2026-03-15', '2026-10-04', 4), promo, row('2026-10-16', null, 4)], { from: '2026-10-05', to: '2026-10-15', monto: 3, today }))
      .toEqual({ ok: true, skipped: true, ops: [] });
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

```ts
// lib/pricing/rate-planner.ts
import { addDaysIso } from './dates';

export interface RateRow {
  coArt: string; coPrecio: string; coAlma: string;
  desde: string; hasta: string | null; monto: number; coMone: string | null; validador: string;
}
export type RateOp =
  | { type: 'insert'; desde: string; hasta: string | null; monto: number }
  | { type: 'update'; row: RateRow; set: { desde?: string; hasta?: string | null; monto?: number } };
export type RatePlan = { ok: true; skipped: boolean; ops: RateOp[] } | { ok: false; error: string };

const fail = (error: string): RatePlan => ({ ok: false, error });
const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;

export function planRatePeriod(
  existing: RateRow[],
  p: { from: string; to: string | null; monto: number; today: string },
): RatePlan {
  if (!(p.monto > 0)) return fail('El precio debe ser mayor que cero');
  if (p.from < p.today) return fail('La fecha de inicio no puede ser anterior a hoy');
  if (p.to !== null && p.to < p.from) return fail('La fecha de fin no puede ser anterior a la de inicio');

  const rows = [...existing].sort((a, b) => a.desde.localeCompare(b.desde));
  const covering = rows.find(r => r.desde <= p.from && (r.hasta === null || r.hasta >= p.from));
  const later = rows.filter(r => r.desde > p.from);

  if (p.to === null) {
    if (covering) {
      if (same(covering.monto, p.monto)) return { ok: true, skipped: true, ops: [] };
      if (covering.desde === p.from) return { ok: true, skipped: false, ops: [{ type: 'update', row: covering, set: { monto: p.monto } }] };
      return {
        ok: true, skipped: false, ops: [
          { type: 'update', row: covering, set: { hasta: addDaysIso(p.from, -1) } },
          { type: 'insert', desde: p.from, hasta: covering.hasta, monto: p.monto },
        ],
      };
    }
    return { ok: true, skipped: false, ops: [{ type: 'insert', desde: p.from, hasta: later[0] ? addDaysIso(later[0].desde, -1) : null, monto: p.monto }] };
  }

  // Bounded period: split the regular rate into regular → promo → regular-continuation.
  if (!covering) return fail('No hay una tarifa regular vigente para esa fecha');
  if (later.some(r => r.desde <= p.to!)) return fail('Hay un cambio programado dentro del período');
  if (covering.hasta !== null && covering.hasta < p.to) return fail('El período excede la vigencia de la tarifa actual');

  if (covering.desde === p.from && same(covering.monto, p.monto) && covering.hasta === p.to) {
    return { ok: true, skipped: true, ops: [] };
  }
  // Same promo already materialised as its own row (previous apply)?
  const exact = rows.find(r => r.desde === p.from && r.hasta === p.to && same(r.monto, p.monto));
  if (exact) return { ok: true, skipped: true, ops: [] };

  const ops: RateOp[] = [];
  const needsContinuation = covering.hasta === null || covering.hasta > p.to;
  if (covering.desde === p.from) {
    ops.push({ type: 'update', row: covering, set: { monto: p.monto, hasta: p.to } });
  } else {
    ops.push({ type: 'update', row: covering, set: { hasta: addDaysIso(p.from, -1) } });
    ops.push({ type: 'insert', desde: p.from, hasta: p.to, monto: p.monto });
  }
  if (needsContinuation) ops.push({ type: 'insert', desde: addDaysIso(p.to, 1), hasta: covering.hasta, monto: covering.monto });
  return { ok: true, skipped: false, ops };
}
```

Note for the "identical promo already present" test: rows are `[ended regular, promo, continuation]`; with `from = promo.desde` the `covering` is the promo row itself (desde ≤ from ≤ hasta). The first `if` (covering.desde === from && same monto && hasta === to) returns skipped. Keep both guards.

- [ ] **Step 4: Run** → all PASS (fix the implementation, not the tests, if any fail).
- [ ] **Step 5: Commit** — `git add lib/pricing/rate-planner.ts __tests__/unit/pricing/rate-planner.test.ts && git commit -m "feat(pricing): pure rate period planner with bounded-period support"`

---

### Task 3: List metadata schema, code allocation, validators

**Files:** Modify `lib/db/schema.ts` (append `pricingListMeta`); generate migration `migrations/sqlite/0009_*.sql`; Create `lib/pricing/list-code.ts`, `lib/pricing/list-validators.ts`, `lib/pricing/lists-repo.ts`; Tests `__tests__/unit/pricing/list-code.test.ts`, `list-validators.test.ts`, `lists-repo.test.ts`.

**Interfaces — Produces:**
- schema `pricingListMeta` (`coPrecio` text PK, `coMone` text not null, `createdBy` text not null, `createdAt` integer ms not null); types `ListMeta`.
- `nextPriceListCode(existing: string[]): string`.
- `lists-repo.ts`: `getListMeta(db: AppDb, coPrecio: string): ListMeta | undefined`; `setListMeta(db: AppDb, row: ListMeta): void` (upsert); `getListMetaMap(db): Map<string, ListMeta>`.
- Validators (using `Valid<T>` from Plan 1's `validators.ts`):
  - `CreateListInput = { mode: 'create'; desPrecio: string; coMone: string } | { mode: 'clone'; sourceCoPrecio: string; desPrecio: string; percent: number | null; effectiveFrom: string }`
  - `ApplyRatesInput = { effectiveFrom: string; changes: { coArt: string; monto: number }[] }`
  - `RenameListInput = { desPrecio: string; validador: string }`
  - `validateCreateListBody(body, today)`, `validateApplyRatesBody(body, today)`, `validateRenameListBody(body)`.

- [ ] **Step 1: Failing tests**

```ts
// list-code.test.ts
import { describe, test, expect } from 'bun:test';
import { nextPriceListCode } from '@/lib/pricing/list-code';
describe('nextPriceListCode', () => {
  test('next free 2-digit code, ignoring non-numeric and 4-digit codes', () => {
    expect(nextPriceListCode(['01','02','05','10','2023','TP1151'])).toBe('11');
  });
  test('first code is 01', () => expect(nextPriceListCode([])).toBe('01'));
  test('falls back to 6-digit when 99 is taken', () => expect(nextPriceListCode(['99'])).toBe('000100'));
  test('trims padding', () => expect(nextPriceListCode(['10  '])).toBe('11'));
});
```
```ts
// list-validators.test.ts
import { describe, test, expect } from 'bun:test';
import { validateCreateListBody, validateApplyRatesBody, validateRenameListBody } from '@/lib/pricing/list-validators';
const today = '2026-10-01';
describe('validateCreateListBody', () => {
  test('create needs name ≤ 60 and a currency code', () => {
    expect(validateCreateListBody({ mode: 'create', desPrecio: 'Nueva', coMone: 'USD' }, today).ok).toBe(true);
    expect(validateCreateListBody({ mode: 'create', desPrecio: '', coMone: 'USD' }, today).ok).toBe(false);
    expect(validateCreateListBody({ mode: 'create', desPrecio: 'x', coMone: '' }, today).ok).toBe(false);
  });
  test('clone needs source, name, valid percent (−99..1000 or null) and a non-past start', () => {
    const ok = { mode: 'clone', sourceCoPrecio: '08', desPrecio: 'Copia', percent: -8, effectiveFrom: '2026-10-01' };
    expect(validateCreateListBody(ok, today).ok).toBe(true);
    expect(validateCreateListBody({ ...ok, percent: null }, today).ok).toBe(true);
    expect(validateCreateListBody({ ...ok, percent: -100 }, today).ok).toBe(false);
    expect(validateCreateListBody({ ...ok, effectiveFrom: '2026-09-30' }, today).ok).toBe(false);
  });
});
describe('validateApplyRatesBody', () => {
  const ok = { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A1', monto: 12.4 }] };
  test('accepts', () => expect(validateApplyRatesBody(ok, today).ok).toBe(true));
  test('rejects past date, empty, duplicates, non-positive, >5 decimals, >500', () => {
    expect(validateApplyRatesBody({ ...ok, effectiveFrom: '2026-09-01' }, today).ok).toBe(false);
    expect(validateApplyRatesBody({ ...ok, changes: [] }, today).ok).toBe(false);
    expect(validateApplyRatesBody({ ...ok, changes: [{ coArt: 'A', monto: 1 }, { coArt: 'A', monto: 2 }] }, today).ok).toBe(false);
    expect(validateApplyRatesBody({ ...ok, changes: [{ coArt: 'A', monto: 0 }] }, today).ok).toBe(false);
    expect(validateApplyRatesBody({ ...ok, changes: [{ coArt: 'A', monto: 1.123456 }] }, today).ok).toBe(false);
    expect(validateApplyRatesBody({ ...ok, changes: Array.from({ length: 501 }, (_, i) => ({ coArt: `A${i}`, monto: 1 })) }, today).ok).toBe(false);
  });
});
describe('validateRenameListBody', () => {
  test('name + validador', () => {
    expect(validateRenameListBody({ desPrecio: 'Nuevo', validador: '0x00000000000A1B2C' }).ok).toBe(true);
    expect(validateRenameListBody({ desPrecio: 'Nuevo', validador: 'x' }).ok).toBe(false);
  });
});
```
```ts
// lists-repo.test.ts
import { describe, test, expect } from 'bun:test';
import { makeMemoryDb } from '../../helpers/memory-db';
import { getListMeta, setListMeta, getListMetaMap } from '@/lib/pricing/lists-repo';
describe('lists repo', () => {
  test('upsert round-trip', () => {
    const db = makeMemoryDb();
    setListMeta(db, { coPrecio: '11', coMone: 'USD', createdBy: '1', createdAt: 1 });
    setListMeta(db, { coPrecio: '11', coMone: 'BSD', createdBy: '1', createdAt: 1 });
    expect(getListMeta(db, '11')?.coMone).toBe('BSD');
    expect(getListMetaMap(db).size).toBe(1);
    expect(getListMeta(db, '99')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

Schema (append to `lib/db/schema.ts`):
```ts
export const pricingListMeta = sqliteTable('pricing_list_meta', {
  coPrecio:  text('co_precio').primaryKey(),     // saTipoPrecio.co_precio, trimmed
  coMone:    text('co_mone').notNull(),          // currency chosen at creation (used until the list has rate rows)
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at').notNull(),    // unix ms
});
export type ListMeta = typeof pricingListMeta.$inferSelect;
```
Run `bun run db:generate` → `0009_*.sql` creating only `pricing_list_meta`.

```ts
// lib/pricing/list-code.ts
export function nextPriceListCode(existing: string[]): string {
  const taken = new Set(existing.map(c => c.trim()));
  // Only look past the current max so a freed low code is never silently reused.
  let max = 0;
  for (const c of taken) if (/^\d{1,2}$/.test(c)) max = Math.max(max, parseInt(c, 10));
  let n = max + 1;
  while (n <= 99 && taken.has(String(n).padStart(2, '0'))) n++;
  if (n <= 99) return String(n).padStart(2, '0');

  let big = 100;
  for (const c of taken) if (/^\d{3,6}$/.test(c)) big = Math.max(big, parseInt(c, 10) + 1);
  while (taken.has(String(big).padStart(6, '0'))) big++;
  return String(big).padStart(6, '0');
}
```
For `['99']` the 6-digit path yields `'000100'`. A 4-digit code such as `2023` only influences the 6-digit path (it never matters until `99` is reached).

```ts
// lib/pricing/lists-repo.ts
import { eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import type { ListMeta } from '@/lib/db/schema';
import type { AppDb } from '@/lib/geo/routes-repo';

export function getListMeta(db: AppDb, coPrecio: string): ListMeta | undefined {
  return db.select().from(schema.pricingListMeta).where(eq(schema.pricingListMeta.coPrecio, coPrecio)).get();
}
export function setListMeta(db: AppDb, row: ListMeta): void {
  const { coPrecio, ...rest } = row;
  db.insert(schema.pricingListMeta).values(row).onConflictDoUpdate({ target: schema.pricingListMeta.coPrecio, set: rest }).run();
}
export function getListMetaMap(db: AppDb): Map<string, ListMeta> {
  return new Map(db.select().from(schema.pricingListMeta).all().map(r => [r.coPrecio, r]));
}
```

```ts
// lib/pricing/list-validators.ts
import { isValidIsoDate } from './dates';
import type { Valid } from './validators';

export type CreateListInput =
  | { mode: 'create'; desPrecio: string; coMone: string }
  | { mode: 'clone'; sourceCoPrecio: string; desPrecio: string; percent: number | null; effectiveFrom: string };
export interface ApplyRatesInput { effectiveFrom: string; changes: { coArt: string; monto: number }[] }
export interface RenameListInput { desPrecio: string; validador: string }

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const obj = (b: unknown): b is Record<string, unknown> => typeof b === 'object' && b !== null && !Array.isArray(b);
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null);
const VALIDADOR = /^0x[0-9a-fA-F]{16}$/;

export function validateCreateListBody(body: unknown, today: string): Valid<CreateListInput> {
  if (!obj(body)) return fail('Solicitud inválida');
  const desPrecio = str(body.desPrecio, 60);
  if (!desPrecio) return fail('El nombre de la lista es requerido (máx. 60 caracteres)');
  if (body.mode === 'create') {
    const coMone = str(body.coMone, 6);
    if (!coMone) return fail('Moneda requerida');
    return { ok: true, value: { mode: 'create', desPrecio, coMone } };
  }
  if (body.mode === 'clone') {
    const sourceCoPrecio = str(body.sourceCoPrecio, 6);
    if (!sourceCoPrecio) return fail('Lista de origen requerida');
    let percent: number | null = null;
    if (body.percent !== null && body.percent !== undefined) {
      if (typeof body.percent !== 'number' || !Number.isFinite(body.percent) || body.percent <= -100 || body.percent > 1000) return fail('Porcentaje inválido');
      percent = body.percent;
    }
    if (!isValidIsoDate(body.effectiveFrom) || body.effectiveFrom < today) return fail('La fecha de inicio no puede ser anterior a hoy');
    return { ok: true, value: { mode: 'clone', sourceCoPrecio, desPrecio, percent, effectiveFrom: body.effectiveFrom } };
  }
  return fail('Modo inválido');
}

export function validateApplyRatesBody(body: unknown, today: string): Valid<ApplyRatesInput> {
  if (!obj(body)) return fail('Solicitud inválida');
  if (!isValidIsoDate(body.effectiveFrom) || body.effectiveFrom < today) return fail('La fecha de vigencia no puede ser anterior a hoy');
  if (!Array.isArray(body.changes) || body.changes.length === 0) return fail('No hay cambios para aplicar');
  if (body.changes.length > 500) return fail('Demasiados cambios en una sola solicitud (máx. 500)');
  const seen = new Set<string>();
  const changes: { coArt: string; monto: number }[] = [];
  for (const c of body.changes) {
    if (!obj(c)) return fail('Cambio inválido');
    const coArt = str(c.coArt, 30);
    if (!coArt) return fail('Código de artículo inválido');
    if (seen.has(coArt)) return fail(`Artículo repetido: ${coArt}`);
    seen.add(coArt);
    if (typeof c.monto !== 'number' || !Number.isFinite(c.monto) || c.monto <= 0 || c.monto > 1e9) return fail(`Precio inválido para ${coArt}`);
    if (Math.abs(Math.round(c.monto * 1e5) / 1e5 - c.monto) > 1e-9) return fail(`Demasiados decimales para ${coArt} (máx. 5)`);
    changes.push({ coArt, monto: c.monto });
  }
  return { ok: true, value: { effectiveFrom: body.effectiveFrom, changes } };
}

export function validateRenameListBody(body: unknown): Valid<RenameListInput> {
  if (!obj(body)) return fail('Solicitud inválida');
  const desPrecio = str(body.desPrecio, 60);
  if (!desPrecio) return fail('Nombre inválido (máx. 60 caracteres)');
  if (typeof body.validador !== 'string' || !VALIDADOR.test(body.validador)) return fail('Token de concurrencia inválido');
  return { ok: true, value: { desPrecio, validador: body.validador } };
}
```

- [ ] **Step 4: Run** `bun test --isolate --env-file=.env.local __tests__/unit/pricing` → PASS. **Step 5: Commit** — `git add lib migrations/sqlite __tests__/unit/pricing && git commit -m "feat(pricing): list metadata, code allocation and list/rate validators"`

---

### Task 4: MSSQL wrapper procedures, ERP rates adapter, integration test

**Files:** Create `migrations/mssql/0011_pApiPrecioArticulo.sql`, `migrations/mssql/0012_pApiTipoPrecio.sql`, `lib/pricing/rates-erp.ts`, `scripts/dwh/__tests__/pricing-rates.test.ts`; Modify `package.json` (ignore the new test in `test`/`test:unit`; add it to `test:pricing-erp`).

**Interfaces — Consumes:** `RateRow`, `RateOp`, `planRatePeriod` (Task 2), `hexToBuffer` (Plan 1 `tipo-cliente.ts`).
**Produces (`rates-erp.ts`, all take `pool: ConnectionPool`):**
```ts
export interface PriceListRow { coPrecio: string; desPrecio: string; coMone: string | null; rateCount: number; segmentCount: number; customerCount: number; validador: string }
export interface ArticleRow { coArt: string; artDes: string; coCat: string | null; catDes: string | null }
export type ApplyOutcome = { outcome: 'success' | 'skipped' | 'conflict' } | { outcome: 'rejected'; message: string };
listPriceLists(pool): Promise<PriceListRow[]>
getPriceList(pool, coPrecio): Promise<PriceListRow | null>
listPriceListCodes(pool): Promise<string[]>
listCurrencies(pool): Promise<string[]>                       // distinct co_mone in saArtPrecio ∪ ['BSD','USD']
readListRates(pool, coPrecio): Promise<RateRow[]>              // all ACTIVE rows of the list (any warehouse, any period)
readArticleRates(pool, coArt): Promise<RateRow[]>              // all ACTIVE rows of one article across lists
dominantWarehouse(pool, coPrecio?: string): Promise<string | null>
listArticles(pool, p: { search?: string }): Promise<ArticleRow[]>   // anulado = 0
getCustomerPriceList(pool, coCli): Promise<{ coCli: string; cliDes: string; tipCli: string; coPrecio: string | null } | null>
applyRatePeriodErp(pool, a: { coPrecio; coArt; coAlma: string; coMone: string | null; from: string; to: string | null; monto: number; today: string; user: string }): Promise<ApplyOutcome>
createListErp(pool, p: { coPrecio; desPrecio; user }): Promise<void>
updateListErp(pool, p: { coPrecio; desPrecio; validador: string; user }): Promise<'success' | 'conflict'>
cloneListErp(pool, p: { coPrecio; desPrecio; coMone: string | null; from: string; rows: { coArt: string; coAlma: string; monto: number }[]; user }): Promise<void>   // ONE transaction; any failure rolls back everything
```

- [ ] **Step 1: Write the integration test** (mock ERP only; read `scripts/dwh/__tests__/pricing-assignment.test.ts` first and mirror its pool setup/cleanup). It creates a throwaway list and an article-rate scenario, and removes everything it created (direct `DELETE` is allowed in test teardown only).

```ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { getPool } from '@/lib/db/mssql';
import { addDaysIso, todayIso } from '@/lib/pricing/dates';
import { nextPriceListCode } from '@/lib/pricing/list-code';
import {
  applyRatePeriodErp, cloneListErp, createListErp, getPriceList, listPriceListCodes, listPriceLists,
  readListRates, updateListErp, dominantWarehouse,
} from '@/lib/pricing/rates-erp';

describe('pricing rates (ERP)', () => {
  let pool: sql.ConnectionPool;
  let list = ''; let clone = '';
  let art = ''; let alma = '';
  const today = todayIso();
  const user = 'PROFIT';

  beforeAll(async () => {
    expect(process.env.DB_SERVER).toBe('localhost');
    pool = await getPool();
    const codes = await listPriceListCodes(pool);
    list = nextPriceListCode(codes);
    clone = nextPriceListCode([...codes, list]);
    const a = await pool.request().query(`SELECT TOP 1 RTRIM(co_art) AS a FROM saArticulo WHERE anulado = 0 ORDER BY co_art`);
    art = a.recordset[0].a;
    alma = (await dominantWarehouse(pool)) ?? 'TODOS';
  });

  afterAll(async () => {
    for (const l of [list, clone]) {
      if (!l) continue;
      await pool.request().input('l', sql.Char(6), l).query(`DELETE FROM saArtPrecio WHERE co_precio = @l; DELETE FROM saTipoPrecio WHERE co_precio = @l`);
    }
  });

  test('create list, rename with validador, stale rename conflicts', async () => {
    await createListErp(pool, { coPrecio: list, desPrecio: 'Prueba lista', user });
    const row = await getPriceList(pool, list);
    expect(row).toMatchObject({ coPrecio: list, desPrecio: 'Prueba lista', rateCount: 0 });
    expect(await updateListErp(pool, { coPrecio: list, desPrecio: 'Prueba renombrada', validador: row!.validador, user })).toBe('success');
    expect(await updateListErp(pool, { coPrecio: list, desPrecio: 'Otra', validador: row!.validador, user })).toBe('conflict');
    expect((await listPriceLists(pool)).some(l => l.coPrecio === list)).toBe(true);
  });

  test('first rate inserts; same-day re-edit updates in place; later date closes and inserts', async () => {
    const base = { coPrecio: list, coArt: art, coAlma: alma, coMone: 'USD', to: null as string | null, today, user };
    expect((await applyRatePeriodErp(pool, { ...base, from: today, monto: 5 })).outcome).toBe('success');
    expect((await applyRatePeriodErp(pool, { ...base, from: today, monto: 6 })).outcome).toBe('success');   // same-day edit
    let rows = (await readListRates(pool, list)).filter(r => r.coArt === art);
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ desde: today, hasta: null, monto: 6, coMone: 'USD' });

    const later = addDaysIso(today, 10);
    expect((await applyRatePeriodErp(pool, { ...base, from: later, monto: 7 })).outcome).toBe('success');
    rows = (await readListRates(pool, list)).filter(r => r.coArt === art).sort((a, b) => a.desde.localeCompare(b.desde));
    expect(rows.map(r => [r.desde, r.hasta, r.monto])).toEqual([[today, addDaysIso(later, -1), 6], [later, null, 7]]);

    expect((await applyRatePeriodErp(pool, { ...base, from: later, monto: 7 })).outcome).toBe('skipped');
  });

  test('bounded promo splits the regular row (regular → promo → continuation)', async () => {
    const base = { coPrecio: list, coArt: art, coAlma: alma, coMone: 'USD', today, user };
    const from = addDaysIso(today, 20); const to = addDaysIso(today, 25);
    const r = await applyRatePeriodErp(pool, { ...base, from, to, monto: 4 });
    expect(r.outcome).toBe('success');
    const rows = (await readListRates(pool, list)).filter(x => x.coArt === art).sort((a, b) => a.desde.localeCompare(b.desde));
    expect(rows.map(x => [x.desde, x.hasta, x.monto]).slice(-3)).toEqual([
      [addDaysIso(today, 10), addDaysIso(from, -1), 7],
      [from, to, 4],
      [addDaysIso(to, 1), null, 7],
    ]);
  });

  test('a rejected plan reports a message and writes nothing', async () => {
    const before = (await readListRates(pool, list)).length;
    const r = await applyRatePeriodErp(pool, { coPrecio: list, coArt: art, coAlma: alma, coMone: 'USD', from: addDaysIso(today, -1), to: null, monto: 9, today, user });
    expect(r).toMatchObject({ outcome: 'rejected' });
    expect((await readListRates(pool, list)).length).toBe(before);
  });

  test('clone is all-or-nothing', async () => {
    await expect(cloneListErp(pool, { coPrecio: clone, desPrecio: 'Copia', coMone: 'USD', from: today, rows: [{ coArt: art, coAlma: alma, monto: 3 }, { coArt: 'NO-EXISTE', coAlma: alma, monto: 3 }], user })).rejects.toThrow();
    expect(await getPriceList(pool, clone)).toBeNull();           // rolled back, no list left behind

    await cloneListErp(pool, { coPrecio: clone, desPrecio: 'Copia', coMone: 'USD', from: today, rows: [{ coArt: art, coAlma: alma, monto: 3 }], user });
    expect((await readListRates(pool, clone)).map(r => r.monto)).toEqual([3]);
  });
});
```

- [ ] **Step 2: Run to verify failure** (`grep ^DB_SERVER .env.local` must be `localhost`): `bun test --isolate --env-file=.env.local scripts/dwh/__tests__/pricing-rates.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement**

`migrations/mssql/0011_pApiPrecioArticulo.sql` (two procedures; no inner transaction):

```sql
-- migrations/mssql/0011_pApiPrecioArticulo.sql
-- Insert / update ONE saArtPrecio row. The caller (the app) owns the transaction.
-- Dates arrive as 'YYYY-MM-DD' strings. co_alma_calculado is a computed column
-- ('TODOS' when co_alma IS NULL), so rows are located by COALESCE(@sCoAlma,'TODOS').
CREATE OR ALTER PROCEDURE [pApiInsertarPrecioArticulo]
    (
      @sCoArt    CHAR(30),
      @sCoPrecio CHAR(6),
      @sCoAlma   CHAR(6)       = NULL,
      @sDesde    CHAR(10),
      @sHasta    CHAR(10)      = NULL,
      @deMonto   DECIMAL(18,5),
      @sCoMone   CHAR(6)       = NULL,
      @sCoUsIn   CHAR(6)
    )
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @sArtTrim VARCHAR(30) = RTRIM(@sCoArt);
    DECLARE @sPrecioTrim VARCHAR(6) = RTRIM(@sCoPrecio);
    DECLARE @sAlmaTrim VARCHAR(6) = RTRIM(@sCoAlma);

    IF NOT EXISTS (SELECT 1 FROM saArticulo WHERE co_art = @sCoArt)
        RAISERROR('Artículo %s no encontrado', 16, 1, @sArtTrim);
    IF NOT EXISTS (SELECT 1 FROM saTipoPrecio WHERE co_precio = @sCoPrecio)
        RAISERROR('Lista de precio %s no encontrada', 16, 1, @sPrecioTrim);
    IF @sCoAlma IS NOT NULL AND NOT EXISTS (SELECT 1 FROM saAlmacen WHERE co_alma = @sCoAlma)
        RAISERROR('Almacén %s no encontrado', 16, 1, @sAlmaTrim);
    IF @deMonto <= 0
        RAISERROR('El monto debe ser mayor que cero', 16, 1);

    DECLARE @dDesde DATETIME = CONVERT(DATETIME, @sDesde, 23);
    DECLARE @dHasta DATETIME = CASE WHEN @sHasta IS NULL THEN NULL ELSE CONVERT(DATETIME, @sHasta, 23) END;
    IF @dHasta IS NOT NULL AND @dHasta < @dDesde
        RAISERROR('La fecha final no puede ser anterior a la inicial', 16, 1);

    IF EXISTS (SELECT 1 FROM saArtPrecio
               WHERE co_art = @sCoArt AND co_precio = @sCoPrecio
                 AND co_alma_calculado = COALESCE(@sCoAlma, 'TODOS') AND desde = @dDesde)
        RAISERROR('Ya existe una tarifa que inicia en esa fecha', 16, 1);

    INSERT INTO saArtPrecio (co_art, co_precio, desde, hasta, co_alma, monto, precioOm, co_us_in, fe_us_in, co_us_mo, fe_us_mo, co_mone)
    VALUES (@sCoArt, @sCoPrecio, @dDesde, @dHasta, @sCoAlma, @deMonto, 0, @sCoUsIn, GETDATE(), @sCoUsIn, GETDATE(), @sCoMone);
END
GO

CREATE OR ALTER PROCEDURE [pApiActualizarPrecioArticulo]
    (
      @sCoArt      CHAR(30),
      @sCoPrecio   CHAR(6),
      @sCoAlma     CHAR(6)       = NULL,
      @sDesdeOri   CHAR(10),
      @sDesde      CHAR(10)      = NULL,
      @sHasta      CHAR(10)      = NULL,
      @bSetHasta   BIT           = 0,
      @deMonto     DECIMAL(18,5) = NULL,
      @tsValidador BINARY(8),
      @sCoUsMo     CHAR(6)
    )
AS
BEGIN
    SET NOCOUNT ON;
    IF @deMonto IS NOT NULL AND @deMonto <= 0
        RAISERROR('El monto debe ser mayor que cero', 16, 1);

    UPDATE saArtPrecio
    SET desde    = COALESCE(CASE WHEN @sDesde IS NULL THEN NULL ELSE CONVERT(DATETIME, @sDesde, 23) END, desde),
        hasta    = CASE WHEN @bSetHasta = 1 THEN (CASE WHEN @sHasta IS NULL THEN NULL ELSE CONVERT(DATETIME, @sHasta, 23) END) ELSE hasta END,
        monto    = COALESCE(@deMonto, monto),
        co_us_mo = @sCoUsMo,
        fe_us_mo = GETDATE()
    WHERE co_art = @sCoArt AND co_precio = @sCoPrecio
      AND co_alma_calculado = COALESCE(@sCoAlma, 'TODOS')
      AND desde = CONVERT(DATETIME, @sDesdeOri, 23)
      AND validador = @tsValidador;

    SELECT @@ROWCOUNT AS updated;
END
GO
```

`migrations/mssql/0012_pApiTipoPrecio.sql`:

```sql
-- migrations/mssql/0012_pApiTipoPrecio.sql
CREATE OR ALTER PROCEDURE [pApiInsertarTipoPrecio]
    ( @sCoPrecio CHAR(6), @sDesPrecio VARCHAR(60), @sCoUsIn CHAR(6) )
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @sTrim VARCHAR(6) = RTRIM(@sCoPrecio);
    IF EXISTS (SELECT 1 FROM saTipoPrecio WHERE co_precio = @sCoPrecio)
        RAISERROR('La lista de precio %s ya existe', 16, 1, @sTrim);
    INSERT INTO saTipoPrecio (co_precio, des_precio, incluye_imp, co_us_in, fe_us_in, co_us_mo, fe_us_mo, rowguid)
    VALUES (@sCoPrecio, @sDesPrecio, 0, @sCoUsIn, GETDATE(), @sCoUsIn, GETDATE(), NEWID());
END
GO

CREATE OR ALTER PROCEDURE [pApiActualizarTipoPrecio]
    ( @sCoPrecio CHAR(6), @sDesPrecio VARCHAR(60), @tsValidador BINARY(8), @sCoUsMo CHAR(6) )
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @sTrim VARCHAR(6) = RTRIM(@sCoPrecio);
    IF NOT EXISTS (SELECT 1 FROM saTipoPrecio WHERE co_precio = @sCoPrecio)
        RAISERROR('Lista de precio %s no encontrada', 16, 1, @sTrim);
    UPDATE saTipoPrecio
    SET des_precio = @sDesPrecio, co_us_mo = @sCoUsMo, fe_us_mo = GETDATE()
    WHERE co_precio = @sCoPrecio AND validador = @tsValidador;
    SELECT @@ROWCOUNT AS updated;
END
GO
```
If `saTipoPrecio.rowguid` has a default, the explicit `NEWID()` is harmless; if the table lacks that column the insert fails — then drop the column from the statement (check with `INFORMATION_SCHEMA`).

`lib/pricing/rates-erp.ts`:

```ts
import sql from 'mssql';
import type { ConnectionPool, Transaction } from 'mssql';
import { hexToBuffer } from './tipo-cliente';
import { planRatePeriod, type RateRow } from './rate-planner';

export interface PriceListRow { coPrecio: string; desPrecio: string; coMone: string | null; rateCount: number; segmentCount: number; customerCount: number; validador: string }
export interface ArticleRow { coArt: string; artDes: string; coCat: string | null; catDes: string | null }
export type ApplyOutcome = { outcome: 'success' | 'skipped' | 'conflict' } | { outcome: 'rejected'; message: string };

const RATE_SELECT = `
  SELECT RTRIM(p.co_art) AS coArt, RTRIM(p.co_precio) AS coPrecio, RTRIM(p.co_alma_calculado) AS coAlma,
         CONVERT(VARCHAR(10), p.desde, 23) AS desde, CONVERT(VARCHAR(10), p.hasta, 23) AS hasta,
         CAST(p.monto AS FLOAT) AS monto, RTRIM(p.co_mone) AS coMone,
         CONVERT(VARCHAR(18), p.validador, 1) AS validador
  FROM saArtPrecio p`;

const LIST_SELECT = `
  SELECT RTRIM(t.co_precio) AS coPrecio, RTRIM(t.des_precio) AS desPrecio,
         (SELECT TOP 1 RTRIM(co_mone) FROM saArtPrecio r WHERE r.co_precio = t.co_precio AND r.Inactivo = 0 AND r.co_mone IS NOT NULL
          GROUP BY co_mone ORDER BY COUNT(*) DESC) AS coMone,
         (SELECT COUNT(*) FROM saArtPrecio r WHERE r.co_precio = t.co_precio AND r.Inactivo = 0) AS rateCount,
         (SELECT COUNT(*) FROM saTipoCliente k WHERE k.co_precio = t.co_precio) AS segmentCount,
         (SELECT COUNT(*) FROM saCliente c JOIN saTipoCliente k ON k.tip_cli = c.tip_cli WHERE k.co_precio = t.co_precio) AS customerCount,
         CONVERT(VARCHAR(18), t.validador, 1) AS validador
  FROM saTipoPrecio t`;

export async function listPriceLists(pool: ConnectionPool): Promise<PriceListRow[]> {
  return (await pool.request().query(`${LIST_SELECT} ORDER BY t.co_precio`)).recordset as PriceListRow[];
}
export async function getPriceList(pool: ConnectionPool, coPrecio: string): Promise<PriceListRow | null> {
  const r = await pool.request().input('p', sql.Char(6), coPrecio).query(`${LIST_SELECT} WHERE RTRIM(t.co_precio) = RTRIM(@p)`);
  return (r.recordset[0] as PriceListRow | undefined) ?? null;
}
export async function listPriceListCodes(pool: ConnectionPool): Promise<string[]> {
  return (await pool.request().query(`SELECT RTRIM(co_precio) AS c FROM saTipoPrecio`)).recordset.map((r: { c: string }) => r.c);
}
export async function listCurrencies(pool: ConnectionPool): Promise<string[]> {
  const r = await pool.request().query(`SELECT DISTINCT RTRIM(co_mone) AS m FROM saArtPrecio WHERE co_mone IS NOT NULL`);
  return [...new Set<string>([...r.recordset.map((x: { m: string }) => x.m), 'BSD', 'USD'])].sort();
}
export async function readListRates(pool: ConnectionPool, coPrecio: string): Promise<RateRow[]> {
  const r = await pool.request().input('p', sql.Char(6), coPrecio)
    .query(`${RATE_SELECT} WHERE RTRIM(p.co_precio) = RTRIM(@p) AND p.Inactivo = 0 ORDER BY p.co_art, p.desde`);
  return r.recordset as RateRow[];
}
export async function readArticleRates(pool: ConnectionPool, coArt: string): Promise<RateRow[]> {
  const r = await pool.request().input('a', sql.Char(30), coArt)
    .query(`${RATE_SELECT} WHERE RTRIM(p.co_art) = RTRIM(@a) AND p.Inactivo = 0 ORDER BY p.co_precio, p.desde`);
  return r.recordset as RateRow[];
}
export async function dominantWarehouse(pool: ConnectionPool, coPrecio?: string): Promise<string | null> {
  const req = pool.request();
  let where = 'WHERE Inactivo = 0';
  if (coPrecio) { req.input('p', sql.Char(6), coPrecio); where += ' AND RTRIM(co_precio) = RTRIM(@p)'; }
  const r = await req.query(`SELECT TOP 1 RTRIM(co_alma_calculado) AS w FROM saArtPrecio ${where} GROUP BY co_alma_calculado ORDER BY COUNT(*) DESC`);
  return r.recordset[0]?.w ?? null;
}
export async function listArticles(pool: ConnectionPool, p: { search?: string }): Promise<ArticleRow[]> {
  const req = pool.request();
  let where = 'WHERE a.anulado = 0';
  if (p.search) { req.input('s', sql.VarChar(120), `%${p.search}%`); where += ' AND (a.art_des LIKE @s OR RTRIM(a.co_art) LIKE @s)'; }
  const r = await req.query(`
    SELECT TOP 200 RTRIM(a.co_art) AS coArt, RTRIM(a.art_des) AS artDes, RTRIM(a.co_cat) AS coCat, RTRIM(c.cat_des) AS catDes
    FROM saArticulo a LEFT JOIN saCatArticulo c ON c.co_cat = a.co_cat ${where} ORDER BY a.art_des`);
  return r.recordset as ArticleRow[];
}
export async function getCustomerPriceList(pool: ConnectionPool, coCli: string) {
  const r = await pool.request().input('c', sql.Char(16), coCli).query(`
    SELECT RTRIM(c.co_cli) AS coCli, RTRIM(c.cli_des) AS cliDes, RTRIM(c.tip_cli) AS tipCli, RTRIM(k.co_precio) AS coPrecio
    FROM saCliente c LEFT JOIN saTipoCliente k ON k.tip_cli = c.tip_cli WHERE RTRIM(c.co_cli) = RTRIM(@c)`);
  return (r.recordset[0] as { coCli: string; cliDes: string; tipCli: string; coPrecio: string | null } | undefined) ?? null;
}

const almaParam = (a: string) => (a === 'TODOS' ? null : a);

async function readRowsTx(tx: Transaction, p: { coPrecio: string; coArt: string; coAlma: string }): Promise<RateRow[]> {
  const r = await new sql.Request(tx)
    .input('p', sql.Char(6), p.coPrecio).input('a', sql.Char(30), p.coArt).input('w', sql.Char(6), p.coAlma)
    .query(`${RATE_SELECT.replace('FROM saArtPrecio p', 'FROM saArtPrecio p WITH (UPDLOCK, HOLDLOCK)')}
            WHERE RTRIM(p.co_precio) = RTRIM(@p) AND RTRIM(p.co_art) = RTRIM(@a) AND RTRIM(p.co_alma_calculado) = RTRIM(@w) AND p.Inactivo = 0`);
  return r.recordset as RateRow[];
}

async function insertRowTx(tx: Transaction, p: { coArt: string; coPrecio: string; coAlma: string; desde: string; hasta: string | null; monto: number; coMone: string | null; user: string }) {
  await new sql.Request(tx)
    .input('sCoArt', sql.Char(30), p.coArt).input('sCoPrecio', sql.Char(6), p.coPrecio)
    .input('sCoAlma', sql.Char(6), almaParam(p.coAlma))
    .input('sDesde', sql.Char(10), p.desde).input('sHasta', sql.Char(10), p.hasta)
    .input('deMonto', sql.Decimal(18, 5), p.monto).input('sCoMone', sql.Char(6), p.coMone)
    .input('sCoUsIn', sql.Char(6), p.user.slice(0, 6))
    .execute('pApiInsertarPrecioArticulo');
}

async function updateRowTx(tx: Transaction, row: RateRow, set: { desde?: string; hasta?: string | null; monto?: number }, user: string): Promise<'success' | 'conflict'> {
  const r = await new sql.Request(tx)
    .input('sCoArt', sql.Char(30), row.coArt).input('sCoPrecio', sql.Char(6), row.coPrecio)
    .input('sCoAlma', sql.Char(6), almaParam(row.coAlma))
    .input('sDesdeOri', sql.Char(10), row.desde)
    .input('sDesde', sql.Char(10), set.desde ?? null)
    .input('sHasta', sql.Char(10), set.hasta ?? null)
    .input('bSetHasta', sql.Bit, 'hasta' in set ? 1 : 0)
    .input('deMonto', sql.Decimal(18, 5), set.monto ?? null)
    .input('tsValidador', sql.Binary(8), hexToBuffer(row.validador))
    .input('sCoUsMo', sql.Char(6), user.slice(0, 6))
    .execute('pApiActualizarPrecioArticulo');
  return r.recordset?.[0]?.updated === 1 ? 'success' : 'conflict';
}

export async function applyRatePeriodErp(
  pool: ConnectionPool,
  a: { coPrecio: string; coArt: string; coAlma: string; coMone: string | null; from: string; to: string | null; monto: number; today: string; user: string },
): Promise<ApplyOutcome> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const rows = await readRowsTx(tx, a);
    const plan = planRatePeriod(rows, { from: a.from, to: a.to, monto: a.monto, today: a.today });
    if (!plan.ok) { await tx.rollback(); return { outcome: 'rejected', message: plan.error }; }
    if (plan.skipped) { await tx.rollback(); return { outcome: 'skipped' }; }
    for (const op of plan.ops) {
      if (op.type === 'insert') {
        await insertRowTx(tx, { coArt: a.coArt, coPrecio: a.coPrecio, coAlma: a.coAlma, desde: op.desde, hasta: op.hasta, monto: op.monto, coMone: a.coMone, user: a.user });
      } else if ((await updateRowTx(tx, op.row, op.set, a.user)) === 'conflict') {
        await tx.rollback();
        return { outcome: 'conflict' };
      }
    }
    await tx.commit();
    return { outcome: 'success' };
  } catch (error) {
    try { await tx.rollback(); } catch { /* already rolled back */ }
    throw error;
  }
}

export async function createListErp(pool: ConnectionPool, p: { coPrecio: string; desPrecio: string; user: string }): Promise<void> {
  await pool.request()
    .input('sCoPrecio', sql.Char(6), p.coPrecio).input('sDesPrecio', sql.VarChar(60), p.desPrecio)
    .input('sCoUsIn', sql.Char(6), p.user.slice(0, 6))
    .execute('pApiInsertarTipoPrecio');
}

export async function updateListErp(pool: ConnectionPool, p: { coPrecio: string; desPrecio: string; validador: string; user: string }): Promise<'success' | 'conflict'> {
  const r = await pool.request()
    .input('sCoPrecio', sql.Char(6), p.coPrecio).input('sDesPrecio', sql.VarChar(60), p.desPrecio)
    .input('tsValidador', sql.Binary(8), hexToBuffer(p.validador)).input('sCoUsMo', sql.Char(6), p.user.slice(0, 6))
    .execute('pApiActualizarTipoPrecio');
  return r.recordset?.[0]?.updated === 1 ? 'success' : 'conflict';
}

export async function cloneListErp(
  pool: ConnectionPool,
  p: { coPrecio: string; desPrecio: string; coMone: string | null; from: string; rows: { coArt: string; coAlma: string; monto: number }[]; user: string },
): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx)
      .input('sCoPrecio', sql.Char(6), p.coPrecio).input('sDesPrecio', sql.VarChar(60), p.desPrecio)
      .input('sCoUsIn', sql.Char(6), p.user.slice(0, 6))
      .execute('pApiInsertarTipoPrecio');
    for (const r of p.rows) {
      await insertRowTx(tx, { coArt: r.coArt, coPrecio: p.coPrecio, coAlma: r.coAlma, desde: p.from, hasta: null, monto: r.monto, coMone: p.coMone, user: p.user });
    }
    await tx.commit();
  } catch (error) {
    try { await tx.rollback(); } catch { /* already rolled back */ }
    throw error;
  }
}
```

`package.json`: add `--path-ignore-patterns='**/pricing-rates.test.ts'` to `test` and `test:unit`; make `test:pricing-erp` run `pricing-assignment.test.ts`, `pricing-segments.test.ts` and `pricing-rates.test.ts`.

- [ ] **Step 4: Apply migrations and run.** `bun run migrate:mssql` then `bun test --isolate --env-file=.env.local scripts/dwh/__tests__/pricing-rates.test.ts` → PASS. If `RAISERROR` inside the wrapper (no TRY/CATCH) leaves `tx` unusable, that is expected: the adapter rolls back in `catch`. If `saTipoPrecio.rowguid` insert fails, adapt `0012` as noted.
- [ ] **Step 5: Commit** — `git add migrations/mssql lib/pricing/rates-erp.ts scripts/dwh/__tests__/pricing-rates.test.ts package.json && git commit -m "feat(pricing): rate/list wrapper procedures and ERP rates adapter"`

---

### Task 5: Lists service (orchestration) with fake ERP

**Files:** Create `lib/pricing/lists-service.ts`, `lib/pricing/rates-erp-adapter.ts`, `__tests__/helpers/fake-rates-erp.ts`; Test `__tests__/unit/pricing/lists-service.test.ts`.

**Interfaces — Consumes:** Tasks 1–4; Plan 1 `Actor`, errors, `appendAudit`.
**Produces:**
```ts
export interface RatesErp {
  listLists(): Promise<PriceListRow[]>;
  getList(coPrecio: string): Promise<PriceListRow | null>;
  listCodes(): Promise<string[]>;
  listCurrencies(): Promise<string[]>;
  readListRates(coPrecio: string): Promise<RateRow[]>;
  readArticleRates(coArt: string): Promise<RateRow[]>;
  dominantWarehouse(coPrecio?: string): Promise<string | null>;
  listArticles(p: { search?: string }): Promise<ArticleRow[]>;
  getCustomerPriceList(coCli: string): Promise<{ coCli: string; cliDes: string; tipCli: string; coPrecio: string | null } | null>;
  applyRatePeriod(a: { coPrecio: string; coArt: string; coAlma: string; coMone: string | null; from: string; to: string | null; monto: number; today: string; user: string }): Promise<ApplyOutcome>;
  createList(p: { coPrecio: string; desPrecio: string; user: string }): Promise<void>;
  updateList(p: { coPrecio: string; desPrecio: string; validador: string; user: string }): Promise<'success' | 'conflict'>;
  cloneList(p: { coPrecio: string; desPrecio: string; coMone: string | null; from: string; rows: { coArt: string; coAlma: string; monto: number }[]; user: string }): Promise<void>;
}
export interface ListsDeps { erp: RatesErp; db: AppDb; now?: () => Date }
export interface PriceListDto extends PriceListRow { coMone: string | null; isEmpty: boolean }
export interface GridRow { coArt: string; artDes: string; catDes: string | null; coAlma: string | null; ambiguous: boolean;
  current: { monto: number; desde: string; hasta: string | null } | null; next: { monto: number; desde: string } | null; referenceMonto: number | null }
export interface GridData { list: PriceListDto; rows: GridRow[]; referenceCoPrecio: string | null }
export type ApplyResult = { coArt: string; outcome: 'success' | 'skipped' | 'conflict' | 'rejected' | 'error'; message?: string };
listPriceListDtos(deps): Promise<{ priceLists: PriceListDto[]; currencies: string[] }>
getRatesGrid(deps, coPrecio: string, compareTo: string | null): Promise<GridData>
applyRates(deps, coPrecio: string, input: ApplyRatesInput, actor: Actor): Promise<ApplyResult[]>
createList(deps, input: Extract<CreateListInput, { mode: 'create' }>, actor): Promise<PriceListDto>
cloneList(deps, input: Extract<CreateListInput, { mode: 'clone' }>, actor): Promise<PriceListDto>
renameList(deps, coPrecio: string, input: RenameListInput, actor): Promise<PriceListDto>
searchArticles(deps, search: string): Promise<ArticleRow[]>
getArticlePrices(deps, coArt: string, customerCoCli: string | null): Promise<ArticlePrices>
 // ArticlePrices = { coArt: string; lists: { coPrecio: string; desPrecio: string; coMone: string | null; current: {monto,desde,hasta}|null; next: {monto,desde}|null; history: {monto,desde,hasta}[] }[]; effective: { coCli: string; cliDes: string; coPrecio: string; desPrecio: string; monto: number } | null }
realRatesErp(pool: ConnectionPool): RatesErp   // in rates-erp-adapter.ts, one-line delegations to rates-erp.ts
```
Behavior:
- `isEmpty` = `rateCount === 0 && segmentCount === 0` (the UI hides these behind a toggle; this is how voided lists such as `05 ANUL` are handled).
- `current(rows, today)` = row with `desde ≤ today ≤ (hasta ?? ∞)`; `next` = earliest row with `desde > today`; for the grid group rows by `(coArt)`; if an article has rows in >1 distinct `coAlma` → `ambiguous: true`, `coAlma: null`, `current: null`.
- Reference: `compareTo === null` → `referenceMonto = current?.monto ?? null`; else the `compareTo` list's current monto for the same article (`null` if none).
- Warehouse for a change: article's single warehouse in the list; if none → `dominantWarehouse(coPrecio) ?? dominantWarehouse() ?? 'TODOS'`; ambiguous → result `rejected` with message `El artículo tiene tarifas en varios almacenes en esta lista`.
- Currency for writes: the list's `coMone` (from rows) ?? `pricing_list_meta` ?? throw `ValidationError('La lista no tiene moneda definida')`.
- `applyRates` runs per article (sequentially), maps `ApplyOutcome` to `ApplyResult`, catches thrown errors per article as `error`, and appends **one** audit row `rates_apply` for the batch (target = coPrecio; `after` = `{ effectiveFrom, changes: [{coArt, before: oldMonto|null, after: monto}] }` of successes only) if at least one succeeded.
- `createList`: `nextPriceListCode(await erp.listCodes())` → `erp.createList` → `setListMeta` → audit `list_create`.
- `cloneList`: source rows' *current* rate per article (and warehouse) → `monto' = percent === null ? monto : priceFromPercent(monto, percent)` → code allocation → `erp.cloneList` in one go (throws → nothing created) → meta (currency of source) → audit `list_clone` (before = source coPrecio, after = new coPrecio + percent + from + count). Articles with ambiguous warehouses are copied per warehouse (the clone keeps each row's warehouse).
- `renameList`: `erp.updateList`; `'conflict'` → `ConflictError('La lista fue modificada por otro usuario; recargue e intente de nuevo')`; unknown → `NotFoundError`.
- `getArticlePrices`: per list from `readArticleRates(coArt)`; `history` = rows with `hasta < today` (newest first); `effective` only when `customerCoCli` given and the customer has a list with a current rate (otherwise `null`; unknown customer → `NotFoundError`).

- [ ] **Step 1: Failing test** — write `__tests__/helpers/fake-rates-erp.ts` (in-memory rows; `applyRatePeriod` runs `planRatePeriod` and applies ops to the array, returning the same outcome shapes; `cloneList` throws if any row's `coArt` is not in its article set and does not create the list; `listLists` derives `rateCount` etc.) and then:

```ts
// __tests__/unit/pricing/lists-service.test.ts  (key cases; add more in the same style)
import { describe, test, expect, beforeEach } from 'bun:test';
import { makeMemoryDb } from '../../helpers/memory-db';
import { makeFakeRatesErp, type FakeRatesState } from '../../helpers/fake-rates-erp';
import { applyRates, cloneList, createList, getRatesGrid, renameList, getArticlePrices, listPriceListDtos } from '@/lib/pricing/lists-service';
import { listAudit } from '@/lib/pricing/segments-repo';
import { getListMeta } from '@/lib/pricing/lists-repo';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/pricing/segments-service';

const actor = { id: '7', erpUser: 'PROFIT' };
const now = () => new Date(2026, 9, 1);           // 2026-10-01
let deps: Parameters<typeof applyRates>[0];
let state: FakeRatesState;

beforeEach(() => {
  const f = makeFakeRatesErp({
    lists: [{ coPrecio: '08', desPrecio: 'INDEPENDIENTES' }, { coPrecio: '01', desPrecio: 'CONTADO BS' }, { coPrecio: '05', desPrecio: 'ANUL' }],
    articles: [{ coArt: 'A1', artDes: 'Harina 1kg' }, { coArt: 'A2', artDes: 'Aceite 1L' }, { coArt: 'A3', artDes: 'Sal' }],
    rates: [
      { coArt: 'A1', coPrecio: '08', coAlma: '000015', desde: '2026-03-15', hasta: null, monto: 12.4, coMone: 'USD', validador: '0x01' },
      { coArt: 'A2', coPrecio: '08', coAlma: '000015', desde: '2026-03-15', hasta: null, monto: 21.1, coMone: 'USD', validador: '0x02' },
      { coArt: 'A1', coPrecio: '01', coAlma: '000015', desde: '2026-03-15', hasta: null, monto: 14, coMone: 'USD', validador: '0x03' },
      // A3 has rows in two warehouses inside list 08 → ambiguous
      { coArt: 'A3', coPrecio: '08', coAlma: '000015', desde: '2026-03-15', hasta: null, monto: 1, coMone: 'USD', validador: '0x04' },
      { coArt: 'A3', coPrecio: '08', coAlma: '000002', desde: '2026-03-15', hasta: null, monto: 1, coMone: 'USD', validador: '0x05' },
    ],
  });
  state = f.state;
  deps = { erp: f.erp, db: makeMemoryDb(), now };
});

describe('getRatesGrid', () => {
  test('current/next per article, ambiguity flagged, reference = current when no compareTo', async () => {
    const g = await getRatesGrid(deps, '08', null);
    const a1 = g.rows.find(r => r.coArt === 'A1')!;
    expect(a1.current).toMatchObject({ monto: 12.4, desde: '2026-03-15' });
    expect(a1.referenceMonto).toBe(12.4);
    expect(g.rows.find(r => r.coArt === 'A3')).toMatchObject({ ambiguous: true, current: null });
  });
  test('compareTo another list uses that list current price for the same article', async () => {
    const g = await getRatesGrid(deps, '08', '01');
    expect(g.rows.find(r => r.coArt === 'A1')!.referenceMonto).toBe(14);
    expect(g.rows.find(r => r.coArt === 'A2')!.referenceMonto).toBeNull();
  });
  test('unknown list → NotFoundError', async () => {
    await expect(getRatesGrid(deps, 'ZZ', null)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('applyRates', () => {
  test('writes, skips unchanged, rejects ambiguous, audits the batch once', async () => {
    const res = await applyRates(deps, '08', { effectiveFrom: '2026-10-01', changes: [
      { coArt: 'A1', monto: 13 }, { coArt: 'A2', monto: 21.1 }, { coArt: 'A3', monto: 2 },
    ] }, actor);
    expect(res.map(r => [r.coArt, r.outcome])).toEqual([['A1', 'success'], ['A2', 'skipped'], ['A3', 'rejected']]);
    const audit = listAudit(deps.db);
    expect(audit.length).toBe(1);
    expect(audit[0].action).toBe('rates_apply');
    expect(JSON.parse(audit[0].afterJson!).changes).toEqual([{ coArt: 'A1', before: 12.4, after: 13 }]);
  });
  test('a brand-new article uses the list dominant warehouse', async () => {
    await applyRates(deps, '08', { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A4', monto: 3 }] }, actor);
    expect(state.rates.find(r => r.coArt === 'A4' && r.coPrecio === '08')!.coAlma).toBe('000015');
  });
  test('same-day second apply updates in place', async () => {
    await applyRates(deps, '08', { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A1', monto: 13 }] }, actor);
    await applyRates(deps, '08', { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A1', monto: 14 }] }, actor);
    const rows = state.rates.filter(r => r.coArt === 'A1' && r.coPrecio === '08');
    expect(rows.map(r => r.monto).sort()).toEqual([12.4, 14]);        // original (closed) + today's row, no duplicate
  });
  test('a past date is rejected per article', async () => {
    const res = await applyRates(deps, '08', { effectiveFrom: '2026-09-01', changes: [{ coArt: 'A1', monto: 13 }] }, actor);
    expect(res[0].outcome).toBe('rejected');
  });
  test('list without a currency → ValidationError', async () => {
    state.lists.push({ coPrecio: '11', desPrecio: 'Vacía' });
    await expect(applyRates(deps, '11', { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A1', monto: 1 }] }, actor)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('createList / cloneList / renameList', () => {
  test('createList allocates the next code, stores currency meta, audits', async () => {
    const dto = await createList(deps, { mode: 'create', desPrecio: 'Nueva', coMone: 'USD' }, actor);
    expect(dto.coPrecio).toBe('09');                                  // existing 01,05,08 → max 8 → '09'
    expect(getListMeta(deps.db, dto.coPrecio)?.coMone).toBe('USD');
    expect(listAudit(deps.db)[0].action).toBe('list_create');
  });
  test('cloneList copies current rates with the percent adjustment, keeping warehouses', async () => {
    const dto = await cloneList(deps, { mode: 'clone', sourceCoPrecio: '08', desPrecio: 'Copia', percent: -10, effectiveFrom: '2026-10-01' }, actor);
    const rows = state.rates.filter(r => r.coPrecio === dto.coPrecio);
    expect(rows.find(r => r.coArt === 'A1')).toMatchObject({ monto: 11.16, coAlma: '000015', coMone: 'USD', desde: '2026-10-01', hasta: null });
    expect(listAudit(deps.db)[0].action).toBe('list_clone');
  });
  test('cloneList failure leaves no list and no audit', async () => {
    state.failCloneOnce = true;
    await expect(cloneList(deps, { mode: 'clone', sourceCoPrecio: '08', desPrecio: 'Copia', percent: null, effectiveFrom: '2026-10-01' }, actor)).rejects.toThrow();
    expect(state.lists.length).toBe(3);
    expect(listAudit(deps.db)).toEqual([]);
  });
  test('renameList conflict → ConflictError; unknown → NotFoundError', async () => {
    state.conflictNext = true;
    await expect(renameList(deps, '08', { desPrecio: 'X', validador: '0x00000000000000AA' }, actor)).rejects.toBeInstanceOf(ConflictError);
    await expect(renameList(deps, 'ZZ', { desPrecio: 'X', validador: '0x00000000000000AA' }, actor)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('listPriceListDtos', () => {
  test('flags empty lists (voided) and exposes currencies', async () => {
    const { priceLists, currencies } = await listPriceListDtos(deps);
    expect(priceLists.find(l => l.coPrecio === '05')!.isEmpty).toBe(true);
    expect(priceLists.find(l => l.coPrecio === '08')!.isEmpty).toBe(false);
    expect(currencies).toContain('USD');
  });
});

describe('getArticlePrices', () => {
  test('per-list current/next/history and effective price for a customer', async () => {
    state.customers['C1'] = { cliDes: 'Bodega', tipCli: '000003', coPrecio: '08' };
    const p = await getArticlePrices(deps, 'A1', 'C1');
    expect(p.lists.find(l => l.coPrecio === '08')!.current?.monto).toBe(12.4);
    expect(p.effective).toMatchObject({ coCli: 'C1', coPrecio: '08', monto: 12.4 });
  });
  test('unknown customer → NotFoundError', async () => {
    await expect(getArticlePrices(deps, 'A1', 'NOPE')).rejects.toBeInstanceOf(NotFoundError);
  });
});
```
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `lists-service.ts` per the interface/behavior block above (reuse Plan 1 errors and `appendAudit`, `setListMeta`, `getListMeta`, `nextPriceListCode`, `priceFromPercent`, `planRatePeriod` is **not** called here — the ERP adapter owns planning) and `rates-erp-adapter.ts` (`realRatesErp(pool)` delegating one-to-one to `rates-erp.ts`).
- [ ] **Step 4: Run** `bun test --isolate --env-file=.env.local __tests__/unit/pricing/lists-service.test.ts` → PASS; `bunx tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `git add lib/pricing __tests__ && git commit -m "feat(pricing): lists service with rates grid, apply, create, clone, rename, article lookup"`

---

### Task 6: API routes

**Files:** Modify `lib/pricing/http.ts` (append `buildListsDeps`), `app/api/pricing/price-lists/route.ts` (replace); Create `app/api/pricing/lists/route.ts`, `app/api/pricing/lists/[coPrecio]/route.ts`, `app/api/pricing/lists/[coPrecio]/rates/route.ts`, `app/api/pricing/lists/[coPrecio]/rates/apply/route.ts`, `app/api/pricing/lists/[coPrecio]/export/route.ts`, `app/api/pricing/articles/route.ts`, `app/api/pricing/articles/[coArt]/prices/route.ts`.

**Interfaces — Produces (all gated by `requirePricingAccess`; `{ error }` on failure; PostHog events `pricing_list_created`, `pricing_list_cloned`, `pricing_rates_applied` with counts):**
- `GET /api/pricing/price-lists` (view) → `{ priceLists: PriceListDto[]; currencies: string[] }` (extends the old shape; old fields `coPrecio`, `desPrecio`, `assignedCustomerCount` are still present — set `assignedCustomerCount = customerCount`).
- `POST /api/pricing/lists` (edit) body per `validateCreateListBody` → `201 { priceList }`.
- `PATCH /api/pricing/lists/[coPrecio]` (edit) → `{ priceList }` (409 on conflict).
- `GET /api/pricing/lists/[coPrecio]/rates?compareTo=` (view) → `GridData`.
- `POST /api/pricing/lists/[coPrecio]/rates/apply` (edit) → `{ results: ApplyResult[] }`.
- `GET /api/pricing/lists/[coPrecio]/export` (view) → CSV (`buildCsv` from `lib/csv.ts`, UTF-8 BOM), `Content-Disposition: attachment; filename="lista-<coPrecio>.csv"`; columns Código, Artículo, Precio vigente, Vigente desde, Próximo precio, Próximo desde.
- `GET /api/pricing/articles?search=` (view) → `{ articles: ArticleRow[] }`; `GET /api/pricing/articles/[coArt]/prices?customer=` (view) → `ArticlePrices`.

- [ ] **Step 1: Failing test** (`__tests__/unit/pricing/export-csv.test.ts`): a pure helper `buildListCsv(rows: GridRow[]): string` in `lib/pricing/list-export.ts` — expect a BOM, the header line, `12,40`-style Spanish decimals are **not** used (use `.` decimals so Excel imports numerics via the BOM CSV the same way other exports do — read `lib/csv.ts` and an existing export route first and match their conventions), and commas/quotes in article names are escaped by `buildCsv`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `list-export.ts`, `buildListsDeps()` (`{ erp: realRatesErp(await getPool()), db: getDb() }`) and the routes. Handler template (same for every route; adapt validator/service):

```ts
export async function POST(request: NextRequest, { params }: { params: Promise<{ coPrecio: string }> }) {
  const auth = await requirePricingAccess(request, 'edit');
  if (!auth.ok) return auth.response;
  const { coPrecio } = await params;
  const parsed = validateApplyRatesBody(await request.json().catch(() => null), todayIso());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const results = await applyRates(await buildListsDeps(), coPrecio, parsed.value, actorFrom(auth.session));
    captureEvent(auth.session.sub, 'pricing_rates_applied', { coPrecio, changeCount: parsed.value.changes.length, successCount: results.filter(r => r.outcome === 'success').length });
    return NextResponse.json({ results });
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing rates apply error:', error);
    captureException(error, auth.session.sub, { coPrecio });
    return NextResponse.json({ error: 'Error al aplicar los precios' }, { status: 500 });
  }
}
```
- [ ] **Step 4: Verify** — unit test PASS; `bunx tsc --noEmit` clean; direct-call smoke against the mock ERP in a scratch script: `getRatesGrid({ erp: realRatesErp(pool), db: makeMemoryDb() }, '08', null)` returns ≈25 priced rows, `listPriceListDtos` marks `05` as empty.
- [ ] **Step 5: Commit** — `git add lib app/api __tests__ && git commit -m "feat(pricing): list, rates, export and article API routes"`

---

### Task 7: Staging logic and rates grid components

**Files:** Create `lib/pricing/rates-staging.ts`, `app/(app)/pricing/list-rail.tsx`, `app/(app)/pricing/rates-grid.tsx`; Modify `lib/pricing/client-types.ts` (re-export `PriceListDto`, `GridRow`, `GridData`, `ApplyResult`, `ArticlePrices`, `ArticleRow` types from the service — type-only); Test `__tests__/unit/pricing/rates-staging.test.ts`.

**Interfaces — Produces (`rates-staging.ts`, pure):**
```ts
export type Staged = Record<string, number>;                         // coArt → new monto
export function stageEdit(staged: Staged, coArt: string, monto: number | null): Staged   // null removes; ≤ 0 removes
export function pendingChanges(staged: Staged, rows: GridRow[]): { coArt: string; artDes: string; before: number | null; after: number }[]   // drops rows whose staged price equals current, and ambiguous rows
export function referenceFor(row: GridRow): number | null           // row.referenceMonto
export function newDeltaPct(row: GridRow, staged: Staged): number | null    // percentFromPrice(reference, staged price) or null
export function visibleRows(rows: GridRow[], opts: { search: string; category: string; showUnpriced: boolean; staged: Staged }): GridRow[]
```
`visibleRows` hides articles with `current === null && !ambiguous && no staged price` unless `showUnpriced`; search matches code/description case-insensitively; category matches `catDes`.

- [ ] **Step 1: Failing test** — cases: `stageEdit` removes on null/0/negative; `pendingChanges` omits unchanged and ambiguous; `newDeltaPct` uses the reference (previous rate or compare list) and returns `null` without one; `visibleRows` filters by search/category and honors `showUnpriced` and staged-forces-visible.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `rates-staging.ts` using `percentFromPrice` from Task 1, then the two components.

`ListRail` (props `{ lists: PriceListDto[]; selected: string | null; onSelect(coPrecio): void; onNew(): void; canEdit: boolean; loading: boolean; showEmpty: boolean; onToggleEmpty(v: boolean): void }`): `<nav aria-label="Listas de precio">`; items show `coPrecio · desPrecio`, `coMone`, `rateCount` tarifas, `segmentCount` segmentos / `customerCount` clientes; empty lists hidden unless `showEmpty` (checkbox "Mostrar listas vacías o anuladas"); `+ Nueva lista` (edit only).

`RatesGrid` (props `{ data: GridData | null; loading: boolean; error: string | null; staged: Staged; onStage(coArt, monto | null): void; selected: Set<string>; onToggle(coArt): void; onToggleAll(visible: string[], all: boolean): void; compareTo: string | null; compareOptions: FilterOption[]; onCompareChange(v: string | null): void; effectiveFrom: string; onEffectiveFromChange(v: string): void; canEdit: boolean; search/category/showUnpriced state + setters; onBulk(op); onClear(); onApply(); onClone(); onExport() }`):
- Header: `coPrecio · desPrecio · coMone`, `Clonar` and `Exportar` buttons, `Comparar con:` `SearchableSelect` (options: "Tarifa anterior" + every other list), `Vigente desde:` date input (`min` = today).
- Filters: article search, category `SearchableSelect`, checkbox `Mostrar artículos sin precio en esta lista`.
- Table columns: ☐ · Artículo (`coArt` muted + `artDes`; `badge` "varios almacenes" if `ambiguous`; "próximo: $x desde dd/mm" if `next`) · Vigente · Δ% · Nuevo (editable input) · Nuevo Δ% (editable input).
- Editing: **Nuevo** `onBlur`/Enter → `parseDecimalInput`; invalid → inline error under the cell (`aria-invalid`, text "Precio inválido") and not staged. **Nuevo Δ%** `onBlur`/Enter → `parsePercentInput` → `priceFromPercent(reference, pct)` → `onStage`; if `reference === null` the % input is `disabled` with `title="Sin precio de referencia"`. After either edit, the *other* cell shows the derived value (price from staging; % from `newDeltaPct`), and the Δ% cell is labelled `(derivado)` via `aria-describedby`.
- Δ% column (Vigente vs reference): shows `—` when `compareTo === null`; otherwise `percentFromPrice(reference, current.monto)`.
- Highlight edited cells (`bg-amber-50`) and ambiguous rows are read-only (inputs disabled).
- Bulk bar (edit only; visible when `selected.size > 0`): buttons `+ %`, `− %`, `Fijar precio`; each opens a small inline popover/input; calls `onBulk({ type: 'percent', pct } | { type: 'set', monto })` (the tab runs `bulkNewPrices` over selected rows' references and stages the result; rows skipped because they have no reference are counted and reported: "N filas sin precio de referencia omitidas").
- Footer (sticky): `N cambios pendientes`, `Descartar` (`onClear`), `Aplicar` (`onApply`, disabled when 0).
- States: skeleton rows while loading, error banner, empty state "Esta lista no tiene tarifas", numbers formatted with `Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.

- [ ] **Step 4: Verify** — staging tests PASS; `bunx tsc --noEmit` and `bun run lint` clean.
- [ ] **Step 5: Commit** — `git add lib/pricing/rates-staging.ts "app/(app)/pricing" __tests__ && git commit -m "feat(pricing): rates grid with staged price/percent editing"`

---

### Task 8: Dialogs, Listas tab, article lookup, wiring, help, verification

**Files:** Create `app/(app)/pricing/lists-tab.tsx`, `app/(app)/pricing/apply-dialog.tsx`, `app/(app)/pricing/new-list-dialog.tsx`, `app/(app)/pricing/article-lookup.tsx`, `content/help/pricing-listas.md`, `e2e/pricing-lists.spec.ts`; Modify `app/(app)/pricing/pricing-shell.tsx` (append `{ id: 'listas', label: 'Listas', helpPage: 'pricing-listas' }` to `TABS` and render `<ListsTab canEdit={canEdit} />` for it), `app/api/help/[page]/route.ts` (add `'pricing-listas'`).

**Interfaces — Consumes:** Task 6 endpoints, Task 7 components, Plan 1 `apiGet`/`apiSend`/`Modal`/`SearchableSelect`.
**Produces (props):**
- `ApplyDialog({ changes: { coArt; artDes; before: number | null; after: number }[]; effectiveFrom: string; onConfirm(): Promise<ApplyResult[]>; onClose(): void })` — table of before → after (with Δ%), the date (marked "Programado" when > today), confirm button; after confirming shows per-article results (success/omitido/conflicto/rechazado with messages) and a `Cerrar` button; conflicts list offers `Reintentar` (re-runs only those).
- `NewListDialog({ lists: PriceListDto[]; currencies: string[]; mode: 'create' | 'clone'; sourceCoPrecio?: string; onConfirm(body): Promise<PriceListDto>; onClose })` — create: name + currency (`<select>` fixed small enum); clone: source (preselected), name, optional % (`parsePercentInput`), start date.
- `ArticleLookup({ lists: PriceListDto[] })` — a search box (`GET /api/pricing/articles?search=`, debounced), result list; selecting shows a table per list: Lista · Moneda · Vigente · Próximo · historial (collapsible `<details>`); optional customer picker (`SearchableSelect` over `GET /api/pricing/customers?search=…` results, 1 result page) showing "Precio efectivo para <cliente>: <monto> (lista …)".
- `ListsTab({ canEdit })`: two sub-views toggled by a small segmented control `Tarifas | Artículos`; state: `lists`, `currencies`, `selected` (URL `?list=`), `grid`, `compareTo`, `effectiveFrom` (default `todayIso()`), `staged`, `selected` rows, filters; `loadGrid` re-fetches `/api/pricing/lists/<co>/rates?compareTo=`; `onApply` opens `ApplyDialog` with `pendingChanges(...)`; on success clear staged and `loadGrid`; switching lists with pending edits asks for confirmation (`window.confirm` is **not** allowed — use a `Modal` "Hay cambios sin aplicar. ¿Descartar?"); `onExport` navigates to the export URL; `onBulk` runs `bulkNewPrices` over the selected rows' `referenceMonto` and `stageEdit`s each result.

- [ ] **Step 1: Help + e2e.** Write `content/help/pricing-listas.md` (Spanish): what a list is; how a price change works (close-and-insert, history preserved, "Vigente desde" in the future = scheduled); price↔% linking and rounding ("5 % puede mostrarse como 5,02 %"); "Comparar con"; clone; the *varios almacenes* badge; article lookup. Write `e2e/pricing-lists.spec.ts` tagged `@mssql` following `e2e/help-panel.spec.ts` conventions: view-only user sees the grid read-only (no `Aplicar`), help panel shows the Listas content.
- [ ] **Step 2: Implement** the files above. `ListsTab` must never call `window.confirm/alert/prompt`.
- [ ] **Step 3: Final verification (Plan 2 done criteria)** — all green:

```bash
bunx tsc --noEmit
bun run lint
bun test --isolate --env-file=.env.local __tests__/unit
bun run test:pricing-erp
bun run build
```
Then manual API smoke through the services (scratch script against the mock ERP, **restoring** anything created): create a list, apply two rate changes, apply a same-day second change, clone with −10 %, read the article lookup, delete the scratch rows. Record the output in the commit body.
- [ ] **Step 4: Commit** — `git add -A app content e2e lib && git commit -m "feat(pricing): Listas tab with rates editing, clone and article lookup"`
