# Pricing Plan 1/4 — Segments & Customer Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-table `/pricing` page with a segment-first master/detail workspace where customers are moved between segments (`saTipoCliente`), segments are repointed to price lists, and one-customer "special price" segments carry an expiry date.

**Architecture:** Segment = `saTipoCliente` row. A pure/testable service layer (`lib/pricing/segments-service.ts`) orchestrates ERP writes (through a `SegmentErp` interface) and SQLite metadata/audit; thin Next route handlers call it; a client workspace renders it. ERP writes go through stored procedures (existing `pActualizarCliente`, `pInsertarTipoCliente`; new wrapper `pApiActualizarTipoCliente`).

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle + `bun:sqlite`, `mssql`, Tailwind, `bun test`.

**Spec:** `docs/superpowers/specs/2026-10-01-pricing-segments-workspace-design.md`

## Dependency map (the four plans, in build order)

| Plan | Needs from earlier plans | Produces for later plans |
|---|---|---|
| **1 (this)** | — | `pricing_audit_log` + `appendAudit`; `lib/pricing/dates.ts`; `SegmentErp`/`segments-service`; special-segment metadata (`previousTipCli`, `fallbackTipCli`, `expiresAt`); `PricingShell` tab host (`TABS` array); `lib/pricing/http.ts`; `__tests__/helpers/memory-db.ts` |
| 2 | Plan 1: `appendAudit`, `AppDb`, `PricingShell`, `http.ts`, `dates.ts`, `requirePricingAccess` | `applyRatePeriod`, rates grid, list create/clone, `pricing_list_meta`, `lib/pricing/rates-*` |
| 3 | Plans 1+2: segments service (special segments), `applyRatePeriod`, list clone, grid components | `pricing_promotions`, sweep script, promotions tab |
| 4 | Plan 3: `pricing_promotions`, sweep script | health checks, digest, timeline |

**Do not start a plan before the previous one's final task (verification) is green.**

## Global Constraints

- Branch: `feat/pricing-redesign` (already created). Never commit to `main`.
- Commit style: Conventional Commits, one commit per task, ending with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Run tests with `bun test --isolate --env-file=.env.local <path>`; typecheck with `bunx tsc --noEmit`; lint with `bun run lint`.
- **Never** let a test touch `data/exporter.db`: unit tests use `__tests__/helpers/memory-db.ts` (in-memory SQLite + real migrations). ERP integration tests run only against the local mock (`DB_SERVER=localhost`, `Ncake_a`) — verify with `grep ^DB_SERVER .env.local` before running.
- Every API route: `requirePricingAccess(request, 'view'|'edit')` first; error bodies are `{ error: string }`; every ERP value through `.input()`; call `captureEvent` before the success return and `captureException` in catch blocks (`@/lib/analytics/posthog`).
- Pages re-check access server-side (`getPricingAccessLevel`), redirecting to `/inicio` on `'none'`.
- ERP writes only through stored procedures. `saCliente.co_seg` is never written.
- `tip_cli` is `char(6)`; codes read from the ERP are always `RTRIM`med; `des_tipo` ≤ 60 chars.
- Dates are `YYYY-MM-DD` strings; timestamps stored as unix ms integers (repo convention).
- Data-driven pickers use `lib/components/searchable-select.tsx`; dialogs use `components/modal.tsx`.
- Spanish UI copy (match existing strings).
- Existing mock ERP data contains codes like `000001`, `02`, `TP1151`: code allocation must tolerate non-numeric and short codes.

## Review Focus

1. A `tip_cli` set containing non-numeric/short codes (`02`, `TP1151`) → next code allocation never collides (Task 2).
2. 100-char customer name + long reason → `des_tipo` ≤ 60 with the `hasta dd/mm` suffix intact (Task 2).
3. Stale `validador` on repoint/rename → HTTP 409, nothing written to audit or metadata (Tasks 6, 8).
4. Special-price create where the customer move conflicts → segment exists, response flags the move outcome, a normal retry move works (Task 6).
5. Segment with 0 customers, and an expired special segment (past `expiresAt`) render sensibly (empty state, "vencida" badge) (Tasks 6, 10).

---

### Task 1: SQLite schema, migration, in-memory test helper

**Files:**
- Modify: `lib/db/schema.ts` (append)
- Create: `migrations/sqlite/0008_*.sql` (generated), update `migrations/sqlite/meta/*` (generated)
- Create: `__tests__/helpers/memory-db.ts`
- Test: `__tests__/unit/pricing/schema.test.ts`

**Interfaces:**
- Produces: `schema.pricingSegmentMeta`, `schema.pricingAuditLog`, types `SegmentMeta`, `NewSegmentMeta`, `AuditEntry`; helper `makeMemoryDb(): AppDb`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/pricing/schema.test.ts
import { describe, test, expect } from 'bun:test';
import { makeMemoryDb } from '../../helpers/memory-db';
import { pricingSegmentMeta, pricingAuditLog } from '@/lib/db/schema';

describe('pricing sqlite schema', () => {
  test('segment meta round-trips', () => {
    const db = makeMemoryDb();
    db.insert(pricingSegmentMeta).values({
      tipCli: '000010', kind: 'special', customerCoCli: 'C001', reason: 'promo oct',
      expiresAt: '2026-10-31', fallbackTipCli: '000001', previousTipCli: '000001',
      createdBy: '1', createdAt: 1,
    }).run();
    const row = db.select().from(pricingSegmentMeta).get()!;
    expect(row.kind).toBe('special');
    expect(row.expiresAt).toBe('2026-10-31');
  });
  test('audit log auto-increments and stores json text', () => {
    const db = makeMemoryDb();
    db.insert(pricingAuditLog).values({ at: 1, userId: '1', action: 'customer_move', target: 'C001', beforeJson: '{"a":1}', afterJson: null }).run();
    db.insert(pricingAuditLog).values({ at: 2, userId: '1', action: 'customer_move', target: 'C002' }).run();
    expect(db.select().from(pricingAuditLog).all().map(r => r.id)).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/pricing/schema.test.ts`
Expected: FAIL (module `../../helpers/memory-db` not found).

- [ ] **Step 3: Implement**

`__tests__/helpers/memory-db.ts`:

```ts
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from '@/lib/db/schema';
import type { AppDb } from '@/lib/geo/routes-repo';

/** Fresh in-memory SQLite with the project's real migrations applied. Never touches data/exporter.db. */
export function makeMemoryDb(): AppDb {
  const sqlite = new Database(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './migrations/sqlite' });
  return db;
}
```

Append to `lib/db/schema.ts`:

```ts
// ── Pricing workspace ─────────────────────────────────────────────────────
// `action` is a TypeScript-only enum (no CHECK constraint): later pricing
// plans add values without a migration.
export const PRICING_AUDIT_ACTIONS = [
  'segment_create', 'segment_repoint', 'segment_rename', 'customer_move',
  'list_create', 'list_clone', 'rates_apply',
  'promotion_create', 'promotion_cancel', 'promotion_extend', 'sweep_revert',
] as const;
export type PricingAuditAction = typeof PRICING_AUDIT_ACTIONS[number];

export const pricingSegmentMeta = sqliteTable('pricing_segment_meta', {
  tipCli:         text('tip_cli').primaryKey(),                 // saTipoCliente.tip_cli, trimmed
  kind:           text('kind', { enum: ['group', 'special'] }).notNull(),
  customerCoCli:  text('customer_co_cli'),                      // special only
  reason:         text('reason'),
  expiresAt:      text('expires_at'),                           // YYYY-MM-DD
  fallbackTipCli: text('fallback_tip_cli'),
  previousTipCli: text('previous_tip_cli'),
  createdBy:      text('created_by').notNull(),                 // session.sub
  createdAt:      integer('created_at').notNull(),              // unix ms
});

export type SegmentMeta    = typeof pricingSegmentMeta.$inferSelect;
export type NewSegmentMeta = typeof pricingSegmentMeta.$inferInsert;

export const pricingAuditLog = sqliteTable('pricing_audit_log', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  at:         integer('at').notNull(),                          // unix ms
  userId:     text('user_id').notNull(),
  action:     text('action', { enum: PRICING_AUDIT_ACTIONS }).notNull(),
  target:     text('target').notNull(),                         // tip_cli, co_cli, co_precio or promotion id
  beforeJson: text('before_json'),
  afterJson:  text('after_json'),
});

export type PricingAuditRow = typeof pricingAuditLog.$inferSelect;
```

Run: `bun run db:generate` (creates `migrations/sqlite/0008_<name>.sql` and updates `meta/`). Open the SQL and confirm it only creates the two tables.

- [ ] **Step 4: Run test to verify pass**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/pricing/schema.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts migrations/sqlite __tests__/helpers/memory-db.ts __tests__/unit/pricing/schema.test.ts
git commit -m "feat(pricing): sqlite schema for segment metadata and audit log"
```

---

### Task 2: Pure helpers — dates, segment name, code allocation

**Files:**
- Create: `lib/pricing/dates.ts`, `lib/pricing/segment-name.ts`
- Test: `__tests__/unit/pricing/dates.test.ts`, `__tests__/unit/pricing/segment-name.test.ts`

**Interfaces:**
- Produces:
  - `todayIso(now?: Date): string`; `isValidIsoDate(s: unknown): s is string`; `addDaysIso(iso: string, days: number): string`; `daysBetweenIso(fromIso: string, toIso: string): number` (to − from).
  - `buildSegmentName(i: { customerName: string; reason: string; endsOn: string; today: string }): string`; `formatShortDate(iso: string, today: string): string`; `nextTipCliCode(existing: string[]): string`.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/unit/pricing/dates.test.ts
import { describe, test, expect } from 'bun:test';
import { todayIso, isValidIsoDate, addDaysIso, daysBetweenIso } from '@/lib/pricing/dates';

describe('pricing dates', () => {
  test('todayIso uses local calendar date', () => {
    expect(todayIso(new Date(2026, 9, 1, 23, 59))).toBe('2026-10-01');
  });
  test('isValidIsoDate rejects bad shapes and impossible dates', () => {
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2026-2-9')).toBe(false);
    expect(isValidIsoDate(20261001)).toBe(false);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
  });
  test('addDaysIso crosses month and year boundaries', () => {
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
  });
  test('daysBetweenIso is signed', () => {
    expect(daysBetweenIso('2026-10-01', '2026-10-13')).toBe(12);
    expect(daysBetweenIso('2026-10-13', '2026-10-01')).toBe(-12);
  });
});
```

```ts
// __tests__/unit/pricing/segment-name.test.ts
import { describe, test, expect } from 'bun:test';
import { buildSegmentName, formatShortDate, nextTipCliCode } from '@/lib/pricing/segment-name';

const today = '2026-10-01';

describe('buildSegmentName', () => {
  test('short inputs are not truncated', () => {
    expect(buildSegmentName({ customerName: 'Bodega El Sol', reason: 'promo oct', endsOn: '2026-10-31', today }))
      .toBe('Bodega El Sol · promo oct · hasta 31/10');
  });
  test('other-year end date shows a 2-digit year', () => {
    expect(formatShortDate('2027-01-05', today)).toBe('05/01/27');
  });
  test('empty reason omits the reason segment', () => {
    expect(buildSegmentName({ customerName: 'Bodega El Sol', reason: '  ', endsOn: '2026-10-31', today }))
      .toBe('Bodega El Sol · hasta 31/10');
  });
  test('never exceeds 60 chars and always keeps the end date', () => {
    const customer = 'Distribuidora Comercial Internacional de Alimentos y Bebidas del Centro C.A.'.repeat(2);
    const reason = 'liquidación de inventario por cambio de presentación';
    for (const endsOn of ['2026-10-31', '2027-12-01']) {
      const name = buildSegmentName({ customerName: customer, reason, endsOn, today });
      expect(name.length).toBeLessThanOrEqual(60);
      expect(name.endsWith(`hasta ${formatShortDate(endsOn, today)}`)).toBe(true);
      expect(name).toContain('…');
    }
  });
  test('customer is shortened before the reason', () => {
    const name = buildSegmentName({ customerName: 'A'.repeat(80), reason: 'promo oct', endsOn: '2026-10-31', today });
    expect(name).toContain('promo oct');
  });
});

describe('nextTipCliCode', () => {
  test('starts at 000001 when empty', () => expect(nextTipCliCode([])).toBe('000001'));
  test('goes beyond the highest numeric code, ignoring non-numeric ones', () => {
    expect(nextTipCliCode(['000001', '000002', '02', 'TP1151'])).toBe('000003');
  });
  test('short numeric codes count (price-list-style codes from the old feature)', () => {
    expect(nextTipCliCode(['08', '10'])).toBe('000011');
  });
  test('trims padding', () => expect(nextTipCliCode(['000005  '])).toBe('000006'));
  test('throws when the space is exhausted', () => {
    expect(() => nextTipCliCode(['999999'])).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `bun test --isolate --env-file=.env.local __tests__/unit/pricing/` → FAIL (modules missing).

- [ ] **Step 3: Implement**

```ts
// lib/pricing/dates.ts
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isValidIsoDate(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = ISO.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function toUtcMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDaysIso(iso: string, days: number): string {
  const dt = new Date(toUtcMs(iso) + days * 86_400_000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
export function daysBetweenIso(fromIso: string, toIso: string): number {
  return Math.round((toUtcMs(toIso) - toUtcMs(fromIso)) / 86_400_000);
}
```

```ts
// lib/pricing/segment-name.ts
const MAX_LEN = 60;
const SEP = ' · ';

export function formatShortDate(iso: string, today: string): string {
  const [y, m, d] = iso.split('-');
  return y === today.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`;
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  if (max <= 1) return text.slice(0, Math.max(max, 0));
  return text.slice(0, max - 1).trimEnd() + '…';
}

export function buildSegmentName(i: { customerName: string; reason: string; endsOn: string; today: string }): string {
  const customer = i.customerName.trim().replace(/\s+/g, ' ');
  const reason = i.reason.trim().replace(/\s+/g, ' ');
  const suffix = `${SEP}hasta ${formatShortDate(i.endsOn, i.today)}`;
  const budget = MAX_LEN - suffix.length;

  if (!reason) return clip(customer, budget) + suffix;

  const room = budget - SEP.length;
  if (customer.length + reason.length <= room) return `${customer}${SEP}${reason}${suffix}`;

  // Shrink the customer first (floor 12), then the reason (floor 6).
  let c = customer.length;
  let r = reason.length;
  let over = c + r - room;
  const cutC = Math.min(over, Math.max(c - 12, 0)); c -= cutC; over -= cutC;
  const cutR = Math.min(over, Math.max(r - 6, 0)); r -= cutR; over -= cutR;
  if (over > 0) c = Math.max(c - over, 1);
  return `${clip(customer, c)}${SEP}${clip(reason, r)}${suffix}`;
}

/** Next free zero-padded numeric 6-digit tip_cli code. Non-numeric codes are ignored for the max but never collided with. */
export function nextTipCliCode(existing: string[]): string {
  const taken = new Set(existing.map(c => c.trim()));
  let max = 0;
  for (const c of taken) if (/^\d{1,6}$/.test(c)) max = Math.max(max, parseInt(c, 10));
  let n = max + 1;
  while (taken.has(String(n).padStart(6, '0'))) n++;
  if (n > 999_999) throw new Error('Sin códigos de segmento disponibles');
  return String(n).padStart(6, '0');
}
```

- [ ] **Step 4: Run tests** → all PASS. If the 60-char property test fails, fix `buildSegmentName` (not the test).
- [ ] **Step 5: Commit** — `git add lib/pricing/dates.ts lib/pricing/segment-name.ts __tests__/unit/pricing && git commit -m "feat(pricing): date helpers, segment naming, tip_cli allocation"`

---

### Task 3: Request validators

**Files:**
- Create: `lib/pricing/validators.ts`
- Test: `__tests__/unit/pricing/validators.test.ts`

**Interfaces:**
- Consumes: `isValidIsoDate`, `daysBetweenIso` (Task 2).
- Produces:
  - `type Valid<T> = { ok: true; value: T } | { ok: false; error: string }`
  - `CreateSegmentInput = { kind: 'group'; desTipo: string; coPrecio: string } | { kind: 'special'; customerCoCli: string; reason: string; expiresOn: string; coPrecio: string; fallbackTipCli?: string }`
  - `PatchSegmentInput = { desTipo?: string; coPrecio?: string; expiresOn?: string | null; validador?: string }`
  - `AssignmentInput = { customerCodes: string[]; targetTipCli: string }`
  - `validateCreateSegmentBody(body: unknown, today: string): Valid<CreateSegmentInput>`, `validatePatchSegmentBody(body: unknown, today: string): Valid<PatchSegmentInput>`, `validateAssignmentBody(body: unknown): Valid<AssignmentInput>`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/pricing/validators.test.ts
import { describe, test, expect } from 'bun:test';
import { validateCreateSegmentBody, validatePatchSegmentBody, validateAssignmentBody } from '@/lib/pricing/validators';

const today = '2026-10-01';
const hex = '0x00000000000A1B2C';

describe('validateCreateSegmentBody', () => {
  test('accepts a group', () => {
    expect(validateCreateSegmentBody({ kind: 'group', desTipo: ' Bodegones ', coPrecio: '07' }, today))
      .toEqual({ ok: true, value: { kind: 'group', desTipo: 'Bodegones', coPrecio: '07' } });
  });
  test('rejects a group name over 60 chars or empty', () => {
    expect(validateCreateSegmentBody({ kind: 'group', desTipo: 'x'.repeat(61), coPrecio: '07' }, today).ok).toBe(false);
    expect(validateCreateSegmentBody({ kind: 'group', desTipo: '  ', coPrecio: '07' }, today).ok).toBe(false);
  });
  test('special needs customer, reason, a FUTURE end date and a list', () => {
    const base = { kind: 'special', customerCoCli: 'C001', reason: 'promo oct', expiresOn: '2026-10-31', coPrecio: '07' };
    expect(validateCreateSegmentBody(base, today).ok).toBe(true);
    expect(validateCreateSegmentBody({ ...base, expiresOn: '2026-10-01' }, today).ok).toBe(false); // today is not future
    expect(validateCreateSegmentBody({ ...base, expiresOn: '2026-09-30' }, today).ok).toBe(false);
    expect(validateCreateSegmentBody({ ...base, expiresOn: '31/10/2026' }, today).ok).toBe(false);
    expect(validateCreateSegmentBody({ ...base, reason: '' }, today).ok).toBe(false);
    expect(validateCreateSegmentBody({ ...base, customerCoCli: '' }, today).ok).toBe(false);
  });
  test('rejects unknown kind and non-objects', () => {
    expect(validateCreateSegmentBody({ kind: 'x' }, today).ok).toBe(false);
    expect(validateCreateSegmentBody(null, today).ok).toBe(false);
  });
});

describe('validatePatchSegmentBody', () => {
  test('rename/repoint require a validador', () => {
    expect(validatePatchSegmentBody({ desTipo: 'Nuevo' }, today).ok).toBe(false);
    expect(validatePatchSegmentBody({ coPrecio: '08', validador: hex }, today).ok).toBe(true);
  });
  test('validador must look like 0x + 16 hex digits', () => {
    expect(validatePatchSegmentBody({ coPrecio: '08', validador: 'abc' }, today).ok).toBe(false);
  });
  test('expiry only change needs no validador; null clears; past rejected', () => {
    expect(validatePatchSegmentBody({ expiresOn: '2026-11-01' }, today).ok).toBe(true);
    expect(validatePatchSegmentBody({ expiresOn: null }, today).ok).toBe(true);
    expect(validatePatchSegmentBody({ expiresOn: '2026-09-01' }, today).ok).toBe(false);
  });
  test('empty body rejected', () => {
    expect(validatePatchSegmentBody({}, today).ok).toBe(false);
  });
});

describe('validateAssignmentBody', () => {
  test('accepts trimmed unique codes', () => {
    expect(validateAssignmentBody({ customerCodes: [' C1 ', 'C1', 'C2'], targetTipCli: '000003' }))
      .toEqual({ ok: true, value: { customerCodes: ['C1', 'C2'], targetTipCli: '000003' } });
  });
  test('rejects empty list, non-strings, >500 codes, missing target', () => {
    expect(validateAssignmentBody({ customerCodes: [], targetTipCli: 'x' }).ok).toBe(false);
    expect(validateAssignmentBody({ customerCodes: [1], targetTipCli: 'x' }).ok).toBe(false);
    expect(validateAssignmentBody({ customerCodes: Array.from({ length: 501 }, (_, i) => `C${i}`), targetTipCli: 'x' }).ok).toBe(false);
    expect(validateAssignmentBody({ customerCodes: ['C1'], targetTipCli: '' }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run** → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// lib/pricing/validators.ts
import { daysBetweenIso, isValidIsoDate } from './dates';

export type Valid<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export type CreateSegmentInput =
  | { kind: 'group'; desTipo: string; coPrecio: string }
  | { kind: 'special'; customerCoCli: string; reason: string; expiresOn: string; coPrecio: string; fallbackTipCli?: string };

export interface PatchSegmentInput { desTipo?: string; coPrecio?: string; expiresOn?: string | null; validador?: string }
export interface AssignmentInput { customerCodes: string[]; targetTipCli: string }

const VALIDADOR = /^0x[0-9a-fA-F]{16}$/;

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 && t.length <= max ? t : null;
}

function isObject(b: unknown): b is Record<string, unknown> {
  return typeof b === 'object' && b !== null && !Array.isArray(b);
}

function futureDate(v: unknown, today: string): string | null {
  return isValidIsoDate(v) && daysBetweenIso(today, v) > 0 ? v : null;
}

export function validateCreateSegmentBody(body: unknown, today: string): Valid<CreateSegmentInput> {
  if (!isObject(body)) return fail('Solicitud inválida');
  const coPrecio = str(body.coPrecio, 6);
  if (!coPrecio) return fail('Lista de precio requerida');

  if (body.kind === 'group') {
    const desTipo = str(body.desTipo, 60);
    if (!desTipo) return fail('El nombre del segmento es requerido (máx. 60 caracteres)');
    return { ok: true, value: { kind: 'group', desTipo, coPrecio } };
  }
  if (body.kind === 'special') {
    const customerCoCli = str(body.customerCoCli, 16);
    if (!customerCoCli) return fail('Cliente requerido');
    const reason = str(body.reason, 40);
    if (!reason) return fail('El motivo es requerido (máx. 40 caracteres)');
    const expiresOn = futureDate(body.expiresOn, today);
    if (!expiresOn) return fail('La fecha de fin debe ser una fecha futura (AAAA-MM-DD)');
    const fallback = body.fallbackTipCli === undefined ? undefined : str(body.fallbackTipCli, 6);
    if (body.fallbackTipCli !== undefined && !fallback) return fail('Segmento de respaldo inválido');
    return { ok: true, value: { kind: 'special', customerCoCli, reason, expiresOn, coPrecio, ...(fallback ? { fallbackTipCli: fallback } : {}) } };
  }
  return fail('Tipo de segmento inválido');
}

export function validatePatchSegmentBody(body: unknown, today: string): Valid<PatchSegmentInput> {
  if (!isObject(body)) return fail('Solicitud inválida');
  const out: PatchSegmentInput = {};
  if (body.desTipo !== undefined) {
    const d = str(body.desTipo, 60);
    if (!d) return fail('Nombre inválido (máx. 60 caracteres)');
    out.desTipo = d;
  }
  if (body.coPrecio !== undefined) {
    const p = str(body.coPrecio, 6);
    if (!p) return fail('Lista de precio inválida');
    out.coPrecio = p;
  }
  if (body.expiresOn !== undefined) {
    if (body.expiresOn === null) out.expiresOn = null;
    else {
      const e = futureDate(body.expiresOn, today);
      if (!e) return fail('La fecha de fin debe ser una fecha futura (AAAA-MM-DD)');
      out.expiresOn = e;
    }
  }
  if (body.validador !== undefined) {
    if (typeof body.validador !== 'string' || !VALIDADOR.test(body.validador)) return fail('Token de concurrencia inválido');
    out.validador = body.validador;
  }
  if (out.desTipo === undefined && out.coPrecio === undefined && out.expiresOn === undefined) return fail('Nada que actualizar');
  if ((out.desTipo !== undefined || out.coPrecio !== undefined) && !out.validador) return fail('Token de concurrencia requerido');
  return { ok: true, value: out };
}

export function validateAssignmentBody(body: unknown): Valid<AssignmentInput> {
  if (!isObject(body) || !Array.isArray(body.customerCodes) || body.customerCodes.length === 0) return fail('Se requiere al menos un cliente');
  if (body.customerCodes.length > 500) return fail('Demasiados clientes en una sola solicitud (máx. 500)');
  const codes: string[] = [];
  for (const c of body.customerCodes) {
    const t = str(c, 16);
    if (!t) return fail('Códigos de cliente inválidos');
    if (!codes.includes(t)) codes.push(t);
  }
  const targetTipCli = str(body.targetTipCli, 6);
  if (!targetTipCli) return fail('Segmento destino requerido');
  return { ok: true, value: { customerCodes: codes, targetTipCli } };
}
```

- [ ] **Step 4: Run** `bun test --isolate --env-file=.env.local __tests__/unit/pricing/validators.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git add lib/pricing/validators.ts __tests__/unit/pricing/validators.test.ts && git commit -m "feat(pricing): request validators for segments and assignments"`

---

### Task 4: SQLite repository (metadata + audit)

**Files:**
- Create: `lib/pricing/segments-repo.ts`
- Test: `__tests__/unit/pricing/segments-repo.test.ts`

**Interfaces:**
- Consumes: `AppDb` (`@/lib/geo/routes-repo`), `schema`.
- Produces:
  - `getSegmentMetaMap(db: AppDb): Map<string, SegmentMeta>`; `getSegmentMeta(db, tipCli): SegmentMeta | undefined`
  - `upsertSegmentMeta(db: AppDb, row: NewSegmentMeta): void`
  - `setSegmentExpiry(db: AppDb, tipCli: string, expiresAt: string | null): boolean`
  - `appendAudit(db: AppDb, e: { userId: string; action: PricingAuditAction; target: string; before?: unknown; after?: unknown; now?: number }): void`
  - `listAudit(db: AppDb, limit?: number): PricingAuditRow[]` (newest first)

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/pricing/segments-repo.test.ts
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
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**

```ts
// lib/pricing/segments-repo.ts
import { desc, eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import type { AppDb } from '@/lib/geo/routes-repo';
import type { NewSegmentMeta, PricingAuditAction, PricingAuditRow, SegmentMeta } from '@/lib/db/schema';

export function getSegmentMetaMap(db: AppDb): Map<string, SegmentMeta> {
  const rows = db.select().from(schema.pricingSegmentMeta).all();
  return new Map(rows.map(r => [r.tipCli, r]));
}

export function getSegmentMeta(db: AppDb, tipCli: string): SegmentMeta | undefined {
  return db.select().from(schema.pricingSegmentMeta).where(eq(schema.pricingSegmentMeta.tipCli, tipCli)).get();
}

export function upsertSegmentMeta(db: AppDb, row: NewSegmentMeta): void {
  const { tipCli, ...rest } = row;
  db.insert(schema.pricingSegmentMeta).values(row)
    .onConflictDoUpdate({ target: schema.pricingSegmentMeta.tipCli, set: rest })
    .run();
}

export function setSegmentExpiry(db: AppDb, tipCli: string, expiresAt: string | null): boolean {
  const res = db.update(schema.pricingSegmentMeta).set({ expiresAt })
    .where(eq(schema.pricingSegmentMeta.tipCli, tipCli)).returning({ tipCli: schema.pricingSegmentMeta.tipCli }).all();
  return res.length > 0;
}

export function appendAudit(
  db: AppDb,
  e: { userId: string; action: PricingAuditAction; target: string; before?: unknown; after?: unknown; now?: number },
): void {
  db.insert(schema.pricingAuditLog).values({
    at: e.now ?? Date.now(),
    userId: e.userId,
    action: e.action,
    target: e.target,
    beforeJson: e.before === undefined ? null : JSON.stringify(e.before),
    afterJson: e.after === undefined ? null : JSON.stringify(e.after),
  }).run();
}

export function listAudit(db: AppDb, limit = 100): PricingAuditRow[] {
  return db.select().from(schema.pricingAuditLog).orderBy(desc(schema.pricingAuditLog.at), desc(schema.pricingAuditLog.id)).limit(limit).all();
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git add lib/pricing/segments-repo.ts __tests__/unit/pricing/segments-repo.test.ts && git commit -m "feat(pricing): sqlite repo for segment metadata and audit log"`

---

### Task 5: MSSQL wrapper procedure + ERP segment module (+ mock-ERP integration test)

**Files:**
- Create: `migrations/mssql/0010_pApiActualizarTipoCliente.sql`, `lib/pricing/tipo-cliente.ts`
- Create: `scripts/dwh/__tests__/pricing-segments.test.ts`
- Modify: `package.json` (`test`, `test:unit` ignore the new file; `test:pricing-erp` runs both pricing ERP tests)

**Interfaces:**
- Produces (all take `pool: ConnectionPool`):
  - `listSegmentRows(pool): Promise<SegmentRow[]>`, `SegmentRow = { tipCli; desTipo; coPrecio; desPrecio: string | null; customerCount: number; validador: string /* '0x…' */ }`
  - `getSegmentRow(pool, tipCli): Promise<SegmentRow | null>`
  - `listTipCliCodes(pool): Promise<string[]>`
  - `createSegmentErp(pool, p: { tipCli; desTipo; coPrecio; user }): Promise<void>`
  - `updateSegmentErp(pool, p: { tipCli; desTipo: string | null; coPrecio: string | null; validador: string; user }): Promise<'success' | 'conflict'>`
  - `hexToBuffer(hex: string): Buffer`

- [ ] **Step 1: Write the integration test** (mirror the setup/teardown conventions of `scripts/dwh/__tests__/pricing-assignment.test.ts` — read it first; it builds the pool the same way and cleans up what it creates).

```ts
// scripts/dwh/__tests__/pricing-segments.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { getPool } from '@/lib/db/mssql';
import { nextTipCliCode } from '@/lib/pricing/segment-name';
import {
  listSegmentRows, getSegmentRow, listTipCliCodes, createSegmentErp, updateSegmentErp,
} from '@/lib/pricing/tipo-cliente';

// Writes to the ERP (creates and deletes a saTipoCliente row). Non-production only.
describe('pricing segments (ERP)', () => {
  let pool: sql.ConnectionPool;
  let tipCli = '';
  let priceA = '';
  let priceB = '';

  beforeAll(async () => {
    expect(process.env.DB_SERVER).toBe('localhost'); // refuse to run against anything but the local mock
    pool = await getPool();
    const lists = await pool.request().query(`SELECT TOP 2 RTRIM(co_precio) AS p FROM saTipoPrecio ORDER BY co_precio`);
    priceA = lists.recordset[0].p; priceB = lists.recordset[1].p;
    tipCli = nextTipCliCode(await listTipCliCodes(pool));
  });

  afterAll(async () => {
    if (tipCli) await pool.request().input('t', sql.Char(6), tipCli).query(`DELETE FROM saTipoCliente WHERE tip_cli = @t`);
  });

  test('create → list/get → rename+repoint → stale validador conflicts', async () => {
    await createSegmentErp(pool, { tipCli, desTipo: 'Prueba segmento', coPrecio: priceA, user: 'PROFIT' });

    const created = await getSegmentRow(pool, tipCli);
    expect(created).toMatchObject({ tipCli, desTipo: 'Prueba segmento', coPrecio: priceA, customerCount: 0 });
    expect(created!.validador).toMatch(/^0x[0-9A-F]{16}$/i);
    expect((await listSegmentRows(pool)).some(s => s.tipCli === tipCli)).toBe(true);

    const first = await updateSegmentErp(pool, { tipCli, desTipo: 'Prueba renombrada', coPrecio: priceB, validador: created!.validador, user: 'PROFIT' });
    expect(first).toBe('success');
    const after = await getSegmentRow(pool, tipCli);
    expect(after).toMatchObject({ desTipo: 'Prueba renombrada', coPrecio: priceB });

    const stale = await updateSegmentErp(pool, { tipCli, desTipo: 'Otra', coPrecio: null, validador: created!.validador, user: 'PROFIT' });
    expect(stale).toBe('conflict');
    expect((await getSegmentRow(pool, tipCli))!.desTipo).toBe('Prueba renombrada');
  });

  test('update of an unknown segment or list throws', async () => {
    await expect(updateSegmentErp(pool, { tipCli: 'ZZZZZZ', desTipo: 'x', coPrecio: null, validador: '0x0000000000000000', user: 'PROFIT' })).rejects.toThrow();
    const row = await getSegmentRow(pool, tipCli);
    await expect(updateSegmentErp(pool, { tipCli, desTipo: null, coPrecio: 'NOEXIS', validador: row!.validador, user: 'PROFIT' })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `grep ^DB_SERVER .env.local` (must print `localhost`), then `bun test --isolate --env-file=.env.local scripts/dwh/__tests__/pricing-segments.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

`migrations/mssql/0010_pApiActualizarTipoCliente.sql` (follow the style of `0009`):

```sql
-- migrations/mssql/0010_pApiActualizarTipoCliente.sql
-- Renames and/or repoints a customer type (segment): changes ONLY des_tipo and/or
-- co_precio of saTipoCliente. Optimistic concurrency on `validador`: returns
-- updated = 0 when the row changed since it was read. Stamps co_us_mo / fe_us_mo.
CREATE OR ALTER PROCEDURE [pApiActualizarTipoCliente]
    (
      @sTipCli      CHAR(6),
      @sDesTipo     VARCHAR(60) = NULL,
      @sCoPrecio    CHAR(6)     = NULL,
      @tsValidador  BINARY(8),
      @sCoUsMo      CHAR(6)
    )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;

        DECLARE @sTipCliTrim   VARCHAR(6) = RTRIM(@sTipCli);
        DECLARE @sCoPrecioTrim VARCHAR(6) = RTRIM(@sCoPrecio);
        DECLARE @n INT;

        IF NOT EXISTS (SELECT 1 FROM saTipoCliente WHERE tip_cli = @sTipCli)
            RAISERROR('Tipo de cliente %s no encontrado', 16, 1, @sTipCliTrim);

        IF @sCoPrecio IS NOT NULL AND NOT EXISTS (SELECT 1 FROM saTipoPrecio WHERE co_precio = @sCoPrecio)
            RAISERROR('Lista de precio %s no encontrada', 16, 1, @sCoPrecioTrim);

        UPDATE saTipoCliente
        SET des_tipo  = COALESCE(@sDesTipo, des_tipo),
            co_precio = COALESCE(@sCoPrecio, co_precio),
            co_us_mo  = @sCoUsMo,
            fe_us_mo  = GETDATE()
        WHERE tip_cli = @sTipCli AND validador = @tsValidador;
        SET @n = @@ROWCOUNT;

        COMMIT TRAN;
        SELECT @n AS updated;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRAN;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        RAISERROR(@ErrorMessage, 16, @ErrorNumber);
    END CATCH
END
GO
```

```ts
// lib/pricing/tipo-cliente.ts
import sql from 'mssql';
import type { ConnectionPool } from 'mssql';

export interface SegmentRow {
  tipCli: string;
  desTipo: string;
  coPrecio: string;
  desPrecio: string | null;
  customerCount: number;
  /** saTipoCliente.validador as '0x…' hex (16 digits). */
  validador: string;
}

const SEGMENT_SELECT = `
  SELECT RTRIM(t.tip_cli)    AS tipCli,
         RTRIM(t.des_tipo)   AS desTipo,
         RTRIM(t.co_precio)  AS coPrecio,
         RTRIM(p.des_precio) AS desPrecio,
         (SELECT COUNT(*) FROM saCliente c WHERE c.tip_cli = t.tip_cli) AS customerCount,
         CONVERT(VARCHAR(18), t.validador, 1) AS validador
  FROM saTipoCliente t
  LEFT JOIN saTipoPrecio p ON p.co_precio = t.co_precio`;

export function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex.replace(/^0x/i, ''), 'hex');
}

export async function listSegmentRows(pool: ConnectionPool): Promise<SegmentRow[]> {
  const r = await pool.request().query(`${SEGMENT_SELECT} ORDER BY t.des_tipo`);
  return r.recordset as SegmentRow[];
}

export async function getSegmentRow(pool: ConnectionPool, tipCli: string): Promise<SegmentRow | null> {
  const r = await pool.request()
    .input('tipCli', sql.Char(6), tipCli)
    .query(`${SEGMENT_SELECT} WHERE RTRIM(t.tip_cli) = RTRIM(@tipCli)`);
  return (r.recordset[0] as SegmentRow | undefined) ?? null;
}

export async function listTipCliCodes(pool: ConnectionPool): Promise<string[]> {
  const r = await pool.request().query(`SELECT RTRIM(tip_cli) AS tipCli FROM saTipoCliente`);
  return r.recordset.map((x: { tipCli: string }) => x.tipCli);
}

export async function createSegmentErp(
  pool: ConnectionPool,
  p: { tipCli: string; desTipo: string; coPrecio: string; user: string },
): Promise<void> {
  await pool.request()
    .input('sTip_Cli', sql.Char(6), p.tipCli)
    .input('sDes_Tipo', sql.VarChar(60), p.desTipo)
    .input('sCo_Precio', sql.Char(6), p.coPrecio)
    .input('sCo_Us_In', sql.Char(6), p.user.slice(0, 6))
    .input('sRevisado', sql.Char(1), null)
    .input('sTrasnfe', sql.Char(1), null)
    .input('sCo_Sucu_In', sql.Char(6), null)
    .execute('pInsertarTipoCliente');
}

export async function updateSegmentErp(
  pool: ConnectionPool,
  p: { tipCli: string; desTipo: string | null; coPrecio: string | null; validador: string; user: string },
): Promise<'success' | 'conflict'> {
  const r = await pool.request()
    .input('sTipCli', sql.Char(6), p.tipCli)
    .input('sDesTipo', sql.VarChar(60), p.desTipo)
    .input('sCoPrecio', sql.Char(6), p.coPrecio)
    .input('tsValidador', sql.Binary(8), hexToBuffer(p.validador))
    .input('sCoUsMo', sql.Char(6), p.user.slice(0, 6))
    .execute('pApiActualizarTipoCliente');
  return r.recordset?.[0]?.updated === 1 ? 'success' : 'conflict';
}
```

`package.json`: append `--path-ignore-patterns='**/pricing-segments.test.ts'` to the `test` and `test:unit` scripts (next to the existing `pricing-assignment.test.ts` pattern) and change `test:pricing-erp` to `bun test --isolate --env-file=.env.local scripts/dwh/__tests__/pricing-assignment.test.ts scripts/dwh/__tests__/pricing-segments.test.ts`.

- [ ] **Step 4: Apply migration and run**

Run: `bun run migrate:mssql` (applies `0010` to the local mock), then `bun test --isolate --env-file=.env.local scripts/dwh/__tests__/pricing-segments.test.ts` → PASS. If `pInsertarTipoCliente` rejects the parameter list, read `docs/procedures/pInsertarTipoCliente.md` via the `profit-plus-knowledge-base` MCP (`get_table_schema`/`search_profit_docs`) and fix the parameter names; the existing `ensureTipoClienteForPriceList` in `lib/pricing/sa-cliente-fields.ts` is a working reference.
- [ ] **Step 5: Commit** — `git add migrations/mssql/0010_pApiActualizarTipoCliente.sql lib/pricing/tipo-cliente.ts scripts/dwh/__tests__/pricing-segments.test.ts package.json && git commit -m "feat(pricing): ERP segment module and pApiActualizarTipoCliente"`

---

### Task 6: Segments service (orchestration) + real ERP adapter

**Files:**
- Create: `lib/pricing/segments-service.ts`, `lib/pricing/segment-erp.ts`
- Modify: `lib/pricing/sa-cliente-fields.ts` (append `assignCustomerToSegment`)
- Test: `__tests__/unit/pricing/segments-service.test.ts`

**Interfaces:**
- Consumes: Tasks 2–5 (`buildSegmentName`, `nextTipCliCode`, `todayIso`, `daysBetweenIso`, repo fns, `CreateSegmentInput`, `PatchSegmentInput`, `AssignmentInput`, `SegmentRow`).
- Produces:
  - Errors: `NotFoundError`, `ConflictError`, `ValidationError` (all `extends Error`, with `status: 404 | 409 | 400`).
  - `interface SegmentErp { listCodes(): Promise<string[]>; getSegment(tipCli: string): Promise<SegmentRow | null>; listSegments(): Promise<SegmentRow[]>; createSegment(p: { tipCli: string; desTipo: string; coPrecio: string; user: string }): Promise<void>; updateSegment(p: { tipCli: string; desTipo: string | null; coPrecio: string | null; validador: string; user: string }): Promise<'success' | 'conflict'>; getCustomer(coCli: string): Promise<{ coCli: string; cliDes: string; tipCli: string } | null>; moveCustomer(coCli: string, targetTipCli: string, user: string): Promise<SegmentMoveResult> }`
  - `type SegmentMoveResult = { coCli: string; outcome: 'success' | 'conflict' | 'error'; message?: string; previousTipCli?: string }`
  - `interface ServiceDeps { erp: SegmentErp; db: AppDb; now?: () => Date }`, `interface Actor { id: string; erpUser: string }`
  - `interface SegmentDto { tipCli; desTipo; coPrecio; desPrecio: string | null; customerCount: number; validador: string; kind: 'group' | 'special'; expiresAt: string | null; reason: string | null; customerCoCli: string | null; fallbackTipCli: string | null; daysLeft: number | null }`
  - `listSegmentDtos(deps): Promise<SegmentDto[]>`, `getSegmentDto(deps, tipCli): Promise<SegmentDto>`
  - `createSegment(deps, input: CreateSegmentInput, actor): Promise<{ segment: SegmentDto; move?: SegmentMoveResult }>`
  - `patchSegment(deps, tipCli, input: PatchSegmentInput, actor): Promise<SegmentDto>`
  - `assignCustomers(deps, input: AssignmentInput, actor): Promise<SegmentMoveResult[]>`
  - `realSegmentErp(pool: ConnectionPool): SegmentErp`

- [ ] **Step 1: Write the failing test** (fake `SegmentErp`, in-memory SQLite)

```ts
// __tests__/unit/pricing/segments-service.test.ts
import { describe, test, expect, beforeEach } from 'bun:test';
import { makeMemoryDb } from '../../helpers/memory-db';
import {
  createSegment, patchSegment, assignCustomers, listSegmentDtos,
  NotFoundError, ConflictError, ValidationError, type SegmentErp, type ServiceDeps,
} from '@/lib/pricing/segments-service';
import { listAudit, getSegmentMeta } from '@/lib/pricing/segments-repo';
import type { SegmentRow } from '@/lib/pricing/tipo-cliente';

const actor = { id: '7', erpUser: 'PROFIT' };
const now = () => new Date(2026, 9, 1);

function fakeErp(seed: { segments: SegmentRow[]; customers: Record<string, { cliDes: string; tipCli: string }> }) {
  const state = { segments: [...seed.segments], customers: { ...seed.customers }, conflictNext: false, moveConflict: false };
  const erp: SegmentErp = {
    listCodes: async () => state.segments.map(s => s.tipCli),
    listSegments: async () => state.segments,
    getSegment: async t => state.segments.find(s => s.tipCli === t) ?? null,
    createSegment: async p => { state.segments.push({ tipCli: p.tipCli, desTipo: p.desTipo, coPrecio: p.coPrecio, desPrecio: null, customerCount: 0, validador: '0x0000000000000001' }); },
    updateSegment: async p => {
      if (state.conflictNext) return 'conflict';
      const s = state.segments.find(x => x.tipCli === p.tipCli)!;
      if (p.desTipo) s.desTipo = p.desTipo;
      if (p.coPrecio) s.coPrecio = p.coPrecio;
      return 'success';
    },
    getCustomer: async c => state.customers[c] ? { coCli: c, ...state.customers[c] } : null,
    moveCustomer: async (c, target) => {
      const cur = state.customers[c];
      if (!cur) return { coCli: c, outcome: 'error', message: 'Cliente no encontrado' };
      if (state.moveConflict) return { coCli: c, outcome: 'conflict' };
      const previousTipCli = cur.tipCli;
      cur.tipCli = target;
      return { coCli: c, outcome: 'success', previousTipCli };
    },
  };
  return { erp, state };
}

const seg = (tipCli: string, desTipo: string, coPrecio = '01'): SegmentRow =>
  ({ tipCli, desTipo, coPrecio, desPrecio: null, customerCount: 0, validador: '0x0000000000000001' });

let deps: ServiceDeps;
let state: ReturnType<typeof fakeErp>['state'];

beforeEach(() => {
  const f = fakeErp({
    segments: [seg('000001', 'INDEPENDIENTE'), seg('TP1151', 'Test Price List TP1151', 'TP1151')],
    customers: { C1: { cliDes: 'Bodega El Sol', tipCli: '000001' }, C2: { cliDes: 'Otra', tipCli: '000001' } },
  });
  state = f.state;
  deps = { erp: f.erp, db: makeMemoryDb(), now };
});

describe('createSegment', () => {
  test('group: allocates next code, stores meta, audits', async () => {
    const { segment } = await createSegment(deps, { kind: 'group', desTipo: 'Bodegones', coPrecio: '07' }, actor);
    expect(segment.tipCli).toBe('000002');            // TP1151 ignored, 000001 is max
    expect(segment.kind).toBe('group');
    expect(listAudit(deps.db).map(a => a.action)).toEqual(['segment_create']);
  });

  test('special: generated name, previous/fallback recorded, customer moved', async () => {
    const { segment, move } = await createSegment(deps, {
      kind: 'special', customerCoCli: 'C1', reason: 'promo oct', expiresOn: '2026-10-31', coPrecio: '07',
    }, actor);
    expect(segment.desTipo).toBe('Bodega El Sol · promo oct · hasta 31/10');
    expect(segment.kind).toBe('special');
    expect(segment.daysLeft).toBe(30);
    expect(move?.outcome).toBe('success');
    const meta = getSegmentMeta(deps.db, segment.tipCli)!;
    expect(meta).toMatchObject({ previousTipCli: '000001', fallbackTipCli: '000001', customerCoCli: 'C1', createdBy: '7' });
    expect(state.customers.C1.tipCli).toBe(segment.tipCli);
    expect(listAudit(deps.db).map(a => a.action).sort()).toEqual(['customer_move', 'segment_create']);
  });

  test('special: move conflict leaves the segment created and flags the outcome', async () => {
    state.moveConflict = true;
    const { segment, move } = await createSegment(deps, {
      kind: 'special', customerCoCli: 'C1', reason: 'r', expiresOn: '2026-10-31', coPrecio: '07',
    }, actor);
    expect(move?.outcome).toBe('conflict');
    expect(await deps.erp.getSegment(segment.tipCli)).not.toBeNull();
    expect(listAudit(deps.db).map(a => a.action)).toEqual(['segment_create']);
    // a normal retry works
    state.moveConflict = false;
    const retry = await assignCustomers(deps, { customerCodes: ['C1'], targetTipCli: segment.tipCli }, actor);
    expect(retry[0].outcome).toBe('success');
  });

  test('special: unknown customer → NotFoundError and nothing created', async () => {
    await expect(createSegment(deps, { kind: 'special', customerCoCli: 'NOPE', reason: 'r', expiresOn: '2026-10-31', coPrecio: '07' }, actor))
      .rejects.toBeInstanceOf(NotFoundError);
    expect(state.segments.length).toBe(2);
  });
});

describe('patchSegment', () => {
  test('repoint updates ERP and audits before/after', async () => {
    await patchSegment(deps, '000001', { coPrecio: '08', validador: '0x0000000000000001' }, actor);
    const a = listAudit(deps.db)[0];
    expect(a.action).toBe('segment_repoint');
    expect(JSON.parse(a.beforeJson!)).toMatchObject({ coPrecio: '01' });
    expect(JSON.parse(a.afterJson!)).toMatchObject({ coPrecio: '08' });
  });
  test('stale validador → ConflictError, nothing audited', async () => {
    state.conflictNext = true;
    await expect(patchSegment(deps, '000001', { desTipo: 'Nuevo', validador: '0x0000000000000001' }, actor)).rejects.toBeInstanceOf(ConflictError);
    expect(listAudit(deps.db)).toEqual([]);
  });
  test('expiry on a group segment is a ValidationError; on a special it updates meta', async () => {
    await expect(patchSegment(deps, '000001', { expiresOn: '2026-12-01' }, actor)).rejects.toBeInstanceOf(ValidationError);
    const { segment } = await createSegment(deps, { kind: 'special', customerCoCli: 'C1', reason: 'r', expiresOn: '2026-10-31', coPrecio: '07' }, actor);
    const dto = await patchSegment(deps, segment.tipCli, { expiresOn: '2026-12-01' }, actor);
    expect(dto.expiresAt).toBe('2026-12-01');
  });
  test('unknown segment → NotFoundError', async () => {
    await expect(patchSegment(deps, 'NOPE', { desTipo: 'x', validador: '0x0000000000000001' }, actor)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('assignCustomers', () => {
  test('unknown target → NotFoundError', async () => {
    await expect(assignCustomers(deps, { customerCodes: ['C1'], targetTipCli: 'NOPE' }, actor)).rejects.toBeInstanceOf(NotFoundError);
  });
  test('audits only real moves (no-op into the same segment is not audited)', async () => {
    const r = await assignCustomers(deps, { customerCodes: ['C1', 'C2'], targetTipCli: 'TP1151' }, actor);
    expect(r.map(x => x.outcome)).toEqual(['success', 'success']);
    expect(listAudit(deps.db).length).toBe(2);
    const again = await assignCustomers(deps, { customerCodes: ['C1'], targetTipCli: 'TP1151' }, actor);
    expect(again[0].outcome).toBe('success');
    expect(listAudit(deps.db).length).toBe(2);
  });
});

describe('listSegmentDtos', () => {
  test('merges ERP rows with metadata; segments without metadata are groups; expired special has negative daysLeft', async () => {
    await createSegment(deps, { kind: 'special', customerCoCli: 'C1', reason: 'r', expiresOn: '2026-10-05', coPrecio: '07' }, actor);
    const later = { ...deps, now: () => new Date(2026, 9, 20) };
    const dtos = await listSegmentDtos(later);
    expect(dtos.find(d => d.tipCli === '000001')).toMatchObject({ kind: 'group', expiresAt: null, daysLeft: null });
    const special = dtos.find(d => d.kind === 'special')!;
    expect(special.daysLeft).toBe(-15);
  });
});
```

- [ ] **Step 2: Run** → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// lib/pricing/segments-service.ts
import type { AppDb } from '@/lib/geo/routes-repo';
import type { SegmentMeta } from '@/lib/db/schema';
import type { SegmentRow } from './tipo-cliente';
import type { CreateSegmentInput, PatchSegmentInput, AssignmentInput } from './validators';
import { buildSegmentName, nextTipCliCode } from './segment-name';
import { daysBetweenIso, todayIso } from './dates';
import { appendAudit, getSegmentMeta, getSegmentMetaMap, setSegmentExpiry, upsertSegmentMeta } from './segments-repo';

export class NotFoundError extends Error { status = 404 as const; constructor(m: string) { super(m); this.name = 'NotFoundError'; } }
export class ConflictError extends Error { status = 409 as const; constructor(m: string) { super(m); this.name = 'ConflictError'; } }
export class ValidationError extends Error { status = 400 as const; constructor(m: string) { super(m); this.name = 'ValidationError'; } }

export type SegmentMoveResult = { coCli: string; outcome: 'success' | 'conflict' | 'error'; message?: string; previousTipCli?: string };

export interface SegmentErp {
  listCodes(): Promise<string[]>;
  listSegments(): Promise<SegmentRow[]>;
  getSegment(tipCli: string): Promise<SegmentRow | null>;
  createSegment(p: { tipCli: string; desTipo: string; coPrecio: string; user: string }): Promise<void>;
  updateSegment(p: { tipCli: string; desTipo: string | null; coPrecio: string | null; validador: string; user: string }): Promise<'success' | 'conflict'>;
  getCustomer(coCli: string): Promise<{ coCli: string; cliDes: string; tipCli: string } | null>;
  moveCustomer(coCli: string, targetTipCli: string, user: string): Promise<SegmentMoveResult>;
}

export interface ServiceDeps { erp: SegmentErp; db: AppDb; now?: () => Date }
export interface Actor { id: string; erpUser: string }

export interface SegmentDto {
  tipCli: string; desTipo: string; coPrecio: string; desPrecio: string | null;
  customerCount: number; validador: string;
  kind: 'group' | 'special'; expiresAt: string | null; reason: string | null;
  customerCoCli: string | null; fallbackTipCli: string | null; daysLeft: number | null;
}

const today = (d: ServiceDeps) => todayIso((d.now ?? (() => new Date()))());

function toDto(row: SegmentRow, meta: SegmentMeta | undefined, todayStr: string): SegmentDto {
  const expiresAt = meta?.expiresAt ?? null;
  return {
    ...row,
    kind: meta?.kind ?? 'group',
    expiresAt,
    reason: meta?.reason ?? null,
    customerCoCli: meta?.customerCoCli ?? null,
    fallbackTipCli: meta?.fallbackTipCli ?? null,
    daysLeft: expiresAt ? daysBetweenIso(todayStr, expiresAt) : null,
  };
}

export async function listSegmentDtos(deps: ServiceDeps): Promise<SegmentDto[]> {
  const [rows, metas] = [await deps.erp.listSegments(), getSegmentMetaMap(deps.db)];
  const t = today(deps);
  return rows.map(r => toDto(r, metas.get(r.tipCli), t));
}

export async function getSegmentDto(deps: ServiceDeps, tipCli: string): Promise<SegmentDto> {
  const row = await deps.erp.getSegment(tipCli);
  if (!row) throw new NotFoundError('Segmento no encontrado');
  return toDto(row, getSegmentMeta(deps.db, tipCli), today(deps));
}

export async function createSegment(
  deps: ServiceDeps, input: CreateSegmentInput, actor: Actor,
): Promise<{ segment: SegmentDto; move?: SegmentMoveResult }> {
  const t = today(deps);
  const nowMs = (deps.now ?? (() => new Date()))().getTime();

  if (input.kind === 'group') {
    const tipCli = nextTipCliCode(await deps.erp.listCodes());
    await deps.erp.createSegment({ tipCli, desTipo: input.desTipo, coPrecio: input.coPrecio, user: actor.erpUser });
    upsertSegmentMeta(deps.db, { tipCli, kind: 'group', createdBy: actor.id, createdAt: nowMs });
    appendAudit(deps.db, { userId: actor.id, action: 'segment_create', target: tipCli, after: { desTipo: input.desTipo, coPrecio: input.coPrecio, kind: 'group' }, now: nowMs });
    return { segment: await getSegmentDto(deps, tipCli) };
  }

  const customer = await deps.erp.getCustomer(input.customerCoCli);
  if (!customer) throw new NotFoundError('Cliente no encontrado');
  const desTipo = buildSegmentName({ customerName: customer.cliDes, reason: input.reason, endsOn: input.expiresOn, today: t });
  const tipCli = nextTipCliCode(await deps.erp.listCodes());

  await deps.erp.createSegment({ tipCli, desTipo, coPrecio: input.coPrecio, user: actor.erpUser });
  upsertSegmentMeta(deps.db, {
    tipCli, kind: 'special', customerCoCli: customer.coCli, reason: input.reason, expiresAt: input.expiresOn,
    fallbackTipCli: input.fallbackTipCli ?? customer.tipCli, previousTipCli: customer.tipCli,
    createdBy: actor.id, createdAt: nowMs,
  });
  appendAudit(deps.db, { userId: actor.id, action: 'segment_create', target: tipCli, after: { desTipo, coPrecio: input.coPrecio, kind: 'special', expiresOn: input.expiresOn }, now: nowMs });

  const move = await deps.erp.moveCustomer(customer.coCli, tipCli, actor.erpUser);
  if (move.outcome === 'success') {
    appendAudit(deps.db, { userId: actor.id, action: 'customer_move', target: customer.coCli, before: { tipCli: customer.tipCli }, after: { tipCli }, now: nowMs });
  }
  return { segment: await getSegmentDto(deps, tipCli), move };
}

export async function patchSegment(deps: ServiceDeps, tipCli: string, input: PatchSegmentInput, actor: Actor): Promise<SegmentDto> {
  const current = await deps.erp.getSegment(tipCli);
  if (!current) throw new NotFoundError('Segmento no encontrado');
  const nowMs = (deps.now ?? (() => new Date()))().getTime();

  if (input.expiresOn !== undefined) {
    const meta = getSegmentMeta(deps.db, tipCli);
    if (!meta || meta.kind !== 'special') throw new ValidationError('Solo los segmentos especiales tienen vencimiento');
  }

  if (input.desTipo !== undefined || input.coPrecio !== undefined) {
    const outcome = await deps.erp.updateSegment({
      tipCli, desTipo: input.desTipo ?? null, coPrecio: input.coPrecio ?? null,
      validador: input.validador!, user: actor.erpUser,
    });
    if (outcome === 'conflict') throw new ConflictError('El segmento fue modificado por otro usuario; recargue e intente de nuevo');
    if (input.coPrecio !== undefined && input.coPrecio !== current.coPrecio) {
      appendAudit(deps.db, { userId: actor.id, action: 'segment_repoint', target: tipCli, before: { coPrecio: current.coPrecio }, after: { coPrecio: input.coPrecio }, now: nowMs });
    }
    if (input.desTipo !== undefined && input.desTipo !== current.desTipo) {
      appendAudit(deps.db, { userId: actor.id, action: 'segment_rename', target: tipCli, before: { desTipo: current.desTipo }, after: { desTipo: input.desTipo }, now: nowMs });
    }
  }

  if (input.expiresOn !== undefined) setSegmentExpiry(deps.db, tipCli, input.expiresOn);
  return getSegmentDto(deps, tipCli);
}

export async function assignCustomers(deps: ServiceDeps, input: AssignmentInput, actor: Actor): Promise<SegmentMoveResult[]> {
  const target = await deps.erp.getSegment(input.targetTipCli);
  if (!target) throw new NotFoundError('Segmento destino no encontrado');
  const nowMs = (deps.now ?? (() => new Date()))().getTime();

  const results: SegmentMoveResult[] = [];
  for (const coCli of input.customerCodes) {
    const r = await deps.erp.moveCustomer(coCli, input.targetTipCli, actor.erpUser);
    if (r.outcome === 'success' && r.previousTipCli && r.previousTipCli !== input.targetTipCli) {
      appendAudit(deps.db, { userId: actor.id, action: 'customer_move', target: coCli, before: { tipCli: r.previousTipCli }, after: { tipCli: input.targetTipCli }, now: nowMs });
    }
    results.push(r);
  }
  return results;
}
```

Append to `lib/pricing/sa-cliente-fields.ts` (leave existing exports untouched):

```ts
export type SegmentMoveOutcome =
  | { coCli: string; outcome: 'success'; previousTipCli: string }
  | { coCli: string; outcome: 'conflict'; previousTipCli: string }
  | { coCli: string; outcome: 'error'; message: string };

/** Moves one customer to an existing segment (tip_cli). No segment is created here. */
export async function assignCustomerToSegment(
  pool: ConnectionPool, coCli: string, targetTipCli: string, modifyingUser: string,
): Promise<SegmentMoveOutcome> {
  try {
    const current = await readFullCustomerRow(pool, coCli);
    if (!current) return { coCli, outcome: 'error', message: 'Cliente no encontrado' };
    const previousTipCli = current.tipCli.trim();
    if (previousTipCli === targetTipCli.trim()) return { coCli, outcome: 'success', previousTipCli };
    const outcome = await updateCustomerTipCli(pool, current, targetTipCli, modifyingUser);
    return { coCli, outcome, previousTipCli };
  } catch (error) {
    console.error(`Segment move error for ${coCli}:`, error);
    return { coCli, outcome: 'error', message: 'Error al actualizar el cliente' };
  }
}
```

```ts
// lib/pricing/segment-erp.ts
import sql from 'mssql';
import type { ConnectionPool } from 'mssql';
import type { SegmentErp } from './segments-service';
import {
  createSegmentErp, getSegmentRow, listSegmentRows, listTipCliCodes, updateSegmentErp,
} from './tipo-cliente';
import { assignCustomerToSegment } from './sa-cliente-fields';

export function realSegmentErp(pool: ConnectionPool): SegmentErp {
  return {
    listCodes: () => listTipCliCodes(pool),
    listSegments: () => listSegmentRows(pool),
    getSegment: tipCli => getSegmentRow(pool, tipCli),
    createSegment: p => createSegmentErp(pool, p),
    updateSegment: p => updateSegmentErp(pool, p),
    getCustomer: async coCli => {
      const r = await pool.request().input('coCli', sql.Char(16), coCli)
        .query(`SELECT RTRIM(co_cli) AS coCli, RTRIM(cli_des) AS cliDes, RTRIM(tip_cli) AS tipCli FROM saCliente WHERE RTRIM(co_cli) = RTRIM(@coCli)`);
      return r.recordset[0] ?? null;
    },
    moveCustomer: (coCli, target, user) => assignCustomerToSegment(pool, coCli, target, user),
  };
}
```

- [ ] **Step 4: Run** `bun test --isolate --env-file=.env.local __tests__/unit/pricing/segments-service.test.ts` → PASS; `bunx tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `git add lib/pricing __tests__/unit/pricing/segments-service.test.ts && git commit -m "feat(pricing): segments service and ERP adapter"`

---

### Task 7: Customer query builder and filter options

**Files:**
- Create: `lib/pricing/customers-query.ts`
- Test: `__tests__/unit/pricing/customers-query.test.ts`

**Interfaces:**
- Produces:
  - `type CustomerSortKey = 'cliDes' | 'coZon' | 'coVen' | 'ultimoPedido'`
  - `interface CustomerFilters { search: string; tipCli: string; zona: string; vendedor: string; sort: CustomerSortKey; dir: 'asc' | 'desc'; page: number; pageSize: number }`
  - `parseCustomerFilters(params: URLSearchParams): CustomerFilters` (defaults: sort `cliDes`, dir `asc`, page 1, pageSize 50, clamped to 1..200)
  - `buildCustomerQuery(f: CustomerFilters): { where: string; orderBy: string; offset: number; inputs: { name: string; type: 'VarChar'; length: number; value: string }[] }` (pure; sort key only from allowlist)
  - `interface CustomerDto { coCli; cliDes; coZon: string | null; zonDes: string | null; coVen: string | null; venDes: string | null; tipCli: string; ultimoPedido: string | null /* YYYY-MM-DD */ }`
  - `queryCustomers(pool, f): Promise<{ customers: CustomerDto[]; total: number; page: number; pageSize: number }>`
  - `listCustomerFilterOptions(pool): Promise<{ zonas: { value: string; label: string }[]; vendedores: { value: string; label: string }[] }>`

- [ ] **Step 1: Write the failing test** (pure parts only)

```ts
// __tests__/unit/pricing/customers-query.test.ts
import { describe, test, expect } from 'bun:test';
import { parseCustomerFilters, buildCustomerQuery } from '@/lib/pricing/customers-query';

describe('parseCustomerFilters', () => {
  test('defaults', () => {
    expect(parseCustomerFilters(new URLSearchParams())).toEqual({
      search: '', tipCli: '', zona: '', vendedor: '', sort: 'cliDes', dir: 'asc', page: 1, pageSize: 50,
    });
  });
  test('clamps and falls back on garbage', () => {
    const f = parseCustomerFilters(new URLSearchParams('page=0&pageSize=9999&sort=DROP TABLE&dir=sideways'));
    expect(f).toMatchObject({ page: 1, pageSize: 200, sort: 'cliDes', dir: 'asc' });
  });
  test('accepts allowlisted sort + dir', () => {
    expect(parseCustomerFilters(new URLSearchParams('sort=ultimoPedido&dir=desc'))).toMatchObject({ sort: 'ultimoPedido', dir: 'desc' });
  });
});

describe('buildCustomerQuery', () => {
  test('no filters → empty where, name order, offset 0', () => {
    const q = buildCustomerQuery(parseCustomerFilters(new URLSearchParams()));
    expect(q.where).toBe('');
    expect(q.orderBy).toBe('ORDER BY c.cli_des ASC');
    expect(q.offset).toBe(0);
    expect(q.inputs).toEqual([]);
  });
  test('filters are parameterised, never interpolated', () => {
    const q = buildCustomerQuery(parseCustomerFilters(new URLSearchParams("search=o'brien&tipCli=000003&zona=CCS&vendedor=V1&page=3&pageSize=20")));
    expect(q.where).toContain('@search');
    expect(q.where).toContain('@tipCli');
    expect(q.where).not.toContain("o'brien");
    expect(q.inputs.map(i => i.name).sort()).toEqual(['search', 'tipCli', 'vendedor', 'zona']);
    expect(q.offset).toBe(40);
  });
  test('ultimoPedido sorts nulls last in both directions', () => {
    const q = buildCustomerQuery(parseCustomerFilters(new URLSearchParams('sort=ultimoPedido&dir=desc')));
    expect(q.orderBy).toBe('ORDER BY CASE WHEN ult.ultimoPedido IS NULL THEN 1 ELSE 0 END, ult.ultimoPedido DESC, c.cli_des ASC');
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

```ts
// lib/pricing/customers-query.ts
import sql from 'mssql';
import type { ConnectionPool } from 'mssql';

export type CustomerSortKey = 'cliDes' | 'coZon' | 'coVen' | 'ultimoPedido';
const SORT_SQL: Record<CustomerSortKey, string> = {
  cliDes: 'c.cli_des',
  coZon: 'c.co_zon',
  coVen: 'c.co_ven',
  ultimoPedido: 'ult.ultimoPedido',
};

export interface CustomerFilters {
  search: string; tipCli: string; zona: string; vendedor: string;
  sort: CustomerSortKey; dir: 'asc' | 'desc'; page: number; pageSize: number;
}

export interface CustomerDto {
  coCli: string; cliDes: string; coZon: string | null; zonDes: string | null;
  coVen: string | null; venDes: string | null; tipCli: string; ultimoPedido: string | null;
}

export function parseCustomerFilters(p: URLSearchParams): CustomerFilters {
  const sortRaw = p.get('sort') ?? '';
  const sort = (Object.keys(SORT_SQL) as CustomerSortKey[]).includes(sortRaw as CustomerSortKey) ? (sortRaw as CustomerSortKey) : 'cliDes';
  const dir = p.get('dir') === 'desc' ? 'desc' : 'asc';
  const page = Math.max(parseInt(p.get('page') ?? '1', 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(p.get('pageSize') ?? '50', 10) || 50, 1), 200);
  return {
    search: (p.get('search') ?? '').trim(), tipCli: (p.get('tipCli') ?? '').trim(),
    zona: (p.get('zona') ?? '').trim(), vendedor: (p.get('vendedor') ?? '').trim(),
    sort, dir, page, pageSize,
  };
}

export function buildCustomerQuery(f: CustomerFilters) {
  const conditions: string[] = [];
  const inputs: { name: string; type: 'VarChar'; length: number; value: string }[] = [];
  if (f.search) {
    inputs.push({ name: 'search', type: 'VarChar', length: 120, value: `%${f.search}%` });
    conditions.push(`(c.cli_des LIKE @search OR RTRIM(c.co_cli) LIKE @search OR c.rif LIKE @search)`);
  }
  if (f.tipCli) { inputs.push({ name: 'tipCli', type: 'VarChar', length: 6, value: f.tipCli }); conditions.push(`RTRIM(c.tip_cli) = RTRIM(@tipCli)`); }
  if (f.zona) { inputs.push({ name: 'zona', type: 'VarChar', length: 6, value: f.zona }); conditions.push(`RTRIM(c.co_zon) = RTRIM(@zona)`); }
  if (f.vendedor) { inputs.push({ name: 'vendedor', type: 'VarChar', length: 6, value: f.vendedor }); conditions.push(`RTRIM(c.co_ven) = RTRIM(@vendedor)`); }

  const dir = f.dir.toUpperCase();
  const orderBy = f.sort === 'ultimoPedido'
    ? `ORDER BY CASE WHEN ult.ultimoPedido IS NULL THEN 1 ELSE 0 END, ult.ultimoPedido ${dir}, c.cli_des ASC`
    : `ORDER BY ${SORT_SQL[f.sort]} ${dir}${f.sort === 'cliDes' ? '' : ', c.cli_des ASC'}`;

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    orderBy,
    offset: (f.page - 1) * f.pageSize,
    inputs,
  };
}

const FROM = `
  FROM saCliente c
  LEFT JOIN saZona z ON z.co_zon = c.co_zon
  LEFT JOIN saVendedor v ON v.co_ven = c.co_ven
  LEFT JOIN (SELECT co_cli, MAX(fec_emis) AS ultimoPedido FROM saFacturaVenta WHERE anulado = 0 GROUP BY co_cli) ult
         ON ult.co_cli = c.co_cli`;

export async function queryCustomers(pool: ConnectionPool, f: CustomerFilters) {
  const q = buildCustomerQuery(f);
  const bind = (req: sql.Request) => {
    for (const i of q.inputs) req.input(i.name, sql.VarChar(i.length), i.value);
    return req;
  };
  const count = await bind(pool.request()).query(`SELECT COUNT(*) AS total ${FROM} ${q.where}`);
  const rows = await bind(pool.request())
    .input('offset', sql.Int, q.offset)
    .input('pageSize', sql.Int, f.pageSize)
    .query(`
      SELECT RTRIM(c.co_cli) AS coCli, RTRIM(c.cli_des) AS cliDes,
             RTRIM(c.co_zon) AS coZon, RTRIM(z.zon_des) AS zonDes,
             RTRIM(c.co_ven) AS coVen, RTRIM(v.ven_des) AS venDes,
             RTRIM(c.tip_cli) AS tipCli,
             CONVERT(VARCHAR(10), ult.ultimoPedido, 23) AS ultimoPedido
      ${FROM} ${q.where} ${q.orderBy}
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`);
  return { customers: rows.recordset as CustomerDto[], total: count.recordset[0].total as number, page: f.page, pageSize: f.pageSize };
}

export async function listCustomerFilterOptions(pool: ConnectionPool) {
  const [z, v] = await Promise.all([
    pool.request().query(`SELECT RTRIM(co_zon) AS value, RTRIM(zon_des) AS label FROM saZona ORDER BY zon_des`),
    pool.request().query(`SELECT RTRIM(co_ven) AS value, RTRIM(ven_des) AS label FROM saVendedor WHERE inactivo = 0 ORDER BY ven_des`),
  ]);
  return {
    zonas: z.recordset as { value: string; label: string }[],
    vendedores: v.recordset as { value: string; label: string }[],
  };
}
```

- [ ] **Step 4: Run** unit test → PASS. Then smoke the real SQL against the mock ERP: `bun --env-file=.env.local -e "import {getPool} from './lib/db/mssql'; import {queryCustomers,parseCustomerFilters} from './lib/pricing/customers-query'; const p=await getPool(); const r=await queryCustomers(p,parseCustomerFilters(new URLSearchParams('pageSize=3'))); console.log(r.total, r.customers); process.exit(0)"` → prints total ≈144 and 3 rows. Fix SQL if it errors (column names verified: `saZona.zon_des`, `saVendedor.ven_des`, `saFacturaVenta.co_cli/fec_emis/anulado`).
- [ ] **Step 5: Commit** — `git add lib/pricing/customers-query.ts __tests__/unit/pricing/customers-query.test.ts && git commit -m "feat(pricing): paginated customer query with allowlisted sorting"`

---

### Task 8: API routes

**Files:**
- Create: `lib/pricing/http.ts`, `app/api/pricing/segments/route.ts`, `app/api/pricing/segments/[tipCli]/route.ts`, `app/api/pricing/customer-filters/route.ts`
- Modify: `app/api/pricing/customers/route.ts`, `app/api/pricing/assignments/route.ts`
- Test: `__tests__/unit/pricing/http.test.ts`

**Interfaces:**
- Consumes: Task 3 validators, Task 6 service + `realSegmentErp`, Task 7 queries, `requirePricingAccess`, `getPool`, `getDb`, `todayIso`.
- Produces: `serviceErrorResponse(error: unknown): NextResponse | null` (maps `NotFoundError`/`ConflictError`/`ValidationError` to `{ error }` + status, returns `null` otherwise); `buildDeps(): Promise<ServiceDeps>`; `actorFrom(session: SessionPayload): Actor`. HTTP contracts:
  - `GET /api/pricing/segments` (view) → `{ segments: SegmentDto[] }`
  - `POST /api/pricing/segments` (edit) → `201 { segment, move? }`
  - `PATCH /api/pricing/segments/[tipCli]` (edit) → `{ segment }` (409 on conflict)
  - `GET /api/pricing/customers` (view) → `{ customers, total, page, pageSize }`
  - `GET /api/pricing/customer-filters` (view) → `{ zonas, vendedores }`
  - `POST /api/pricing/assignments` (edit) body `{ customerCodes, targetTipCli }` → `{ results: SegmentMoveResult[] }`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/pricing/http.test.ts
import { describe, test, expect } from 'bun:test';
import { serviceErrorResponse } from '@/lib/pricing/http';
import { NotFoundError, ConflictError, ValidationError } from '@/lib/pricing/segments-service';

describe('serviceErrorResponse', () => {
  test('maps typed errors to status + { error }', async () => {
    const r404 = serviceErrorResponse(new NotFoundError('no'))!;
    expect(r404.status).toBe(404);
    expect(await r404.json()).toEqual({ error: 'no' });
    expect(serviceErrorResponse(new ConflictError('c'))!.status).toBe(409);
    expect(serviceErrorResponse(new ValidationError('v'))!.status).toBe(400);
  });
  test('returns null for unknown errors', () => {
    expect(serviceErrorResponse(new Error('boom'))).toBeNull();
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

```ts
// lib/pricing/http.ts
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db/mssql';
import { getDb } from '@/lib/db/sqlite';
import type { SessionPayload } from '@/lib/auth/session';
import { ConflictError, NotFoundError, ValidationError, type Actor, type ServiceDeps } from './segments-service';
import { realSegmentErp } from './segment-erp';

export function serviceErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof NotFoundError || error instanceof ConflictError || error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export async function buildDeps(): Promise<ServiceDeps> {
  return { erp: realSegmentErp(await getPool()), db: getDb() };
}

export function actorFrom(session: SessionPayload): Actor {
  return { id: session.sub, erpUser: process.env.PRICING_ERP_SERVICE_USER ?? 'PROFIT' };
}
```

`app/api/pricing/segments/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { createSegment, listSegmentDtos } from '@/lib/pricing/segments-service';
import { validateCreateSegmentBody } from '@/lib/pricing/validators';
import { actorFrom, buildDeps, serviceErrorResponse } from '@/lib/pricing/http';
import { todayIso } from '@/lib/pricing/dates';
import { captureEvent, captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ segments: await listSegmentDtos(await buildDeps()) });
  } catch (error) {
    console.error('Pricing segments list error:', error);
    captureException(error, auth.session.sub);
    return NextResponse.json({ error: 'Error al consultar segmentos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'edit');
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null);
  const parsed = validateCreateSegmentBody(body, todayIso());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const result = await createSegment(await buildDeps(), parsed.value, actorFrom(auth.session));
    captureEvent(auth.session.sub, 'pricing_segment_created', { kind: parsed.value.kind, tipCli: result.segment.tipCli });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing segment create error:', error);
    captureException(error, auth.session.sub, { kind: parsed.value.kind });
    return NextResponse.json({ error: 'Error al crear el segmento' }, { status: 500 });
  }
}
```

`app/api/pricing/segments/[tipCli]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { patchSegment } from '@/lib/pricing/segments-service';
import { validatePatchSegmentBody } from '@/lib/pricing/validators';
import { actorFrom, buildDeps, serviceErrorResponse } from '@/lib/pricing/http';
import { todayIso } from '@/lib/pricing/dates';
import { captureEvent, captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ tipCli: string }> }) {
  const auth = await requirePricingAccess(request, 'edit');
  if (!auth.ok) return auth.response;
  const { tipCli } = await params;
  const body = await request.json().catch(() => null);
  const parsed = validatePatchSegmentBody(body, todayIso());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const segment = await patchSegment(await buildDeps(), tipCli, parsed.value, actorFrom(auth.session));
    captureEvent(auth.session.sub, 'pricing_segment_updated', { tipCli });
    return NextResponse.json({ segment });
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing segment patch error:', error);
    captureException(error, auth.session.sub, { tipCli });
    return NextResponse.json({ error: 'Error al actualizar el segmento' }, { status: 500 });
  }
}
```

`app/api/pricing/customer-filters/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/mssql';
import { requirePricingAccess } from '@/lib/pricing/access';
import { listCustomerFilterOptions } from '@/lib/pricing/customers-query';
import { captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await listCustomerFilterOptions(await getPool()));
  } catch (error) {
    console.error('Pricing customer filters error:', error);
    captureException(error, auth.session.sub);
    return NextResponse.json({ error: 'Error al consultar filtros' }, { status: 500 });
  }
}
```

Replace `app/api/pricing/customers/route.ts` body of `GET`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/mssql';
import { requirePricingAccess } from '@/lib/pricing/access';
import { parseCustomerFilters, queryCustomers } from '@/lib/pricing/customers-query';
import { captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth.response;
  try {
    const filters = parseCustomerFilters(new URL(request.url).searchParams);
    return NextResponse.json(await queryCustomers(await getPool(), filters));
  } catch (error) {
    console.error('Pricing customers list error:', error);
    captureException(error, auth.session.sub);
    return NextResponse.json({ error: 'Error al consultar clientes' }, { status: 500 });
  }
}
```

Replace `app/api/pricing/assignments/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { assignCustomers } from '@/lib/pricing/segments-service';
import { validateAssignmentBody } from '@/lib/pricing/validators';
import { actorFrom, buildDeps, serviceErrorResponse } from '@/lib/pricing/http';
import { captureEvent, captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'edit');
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null);
  const parsed = validateAssignmentBody(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const results = await assignCustomers(await buildDeps(), parsed.value, actorFrom(auth.session));
    captureEvent(auth.session.sub, 'pricing_assignment_applied', {
      targetTipCli: parsed.value.targetTipCli,
      customerCount: results.length,
      successCount: results.filter(r => r.outcome === 'success').length,
      conflictCount: results.filter(r => r.outcome === 'conflict').length,
      errorCount: results.filter(r => r.outcome === 'error').length,
    });
    return NextResponse.json({ results });
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing assignment route error:', error);
    captureException(error, auth.session.sub, { customerCount: parsed.value.customerCodes.length });
    return NextResponse.json({ error: 'Error al aplicar las asignaciones' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Verify** — `bun test --isolate --env-file=.env.local __tests__/unit/pricing/http.test.ts` → PASS; `bunx tsc --noEmit` clean. Smoke the routes against the mock ERP by starting `bun run dev` in the background, logging in as the seeded admin is non-trivial — instead call the services directly in a scratch script (as in Task 7 Step 4) with `realSegmentErp(await getPool())` for `listSegmentDtos` and confirm it returns the mock's segments with `kind: 'group'`.
- [ ] **Step 5: Commit** — `git add lib/pricing/http.ts app/api/pricing __tests__/unit/pricing/http.test.ts && git commit -m "feat(pricing): segment, customer and assignment API routes"`

---

### Task 9: Client types, shell, page wiring

**Files:**
- Create: `lib/pricing/client-types.ts`, `app/(app)/pricing/pricing-shell.tsx`, `app/(app)/pricing/api-client.ts`
- Modify: `app/(app)/pricing/page.tsx`
- Test: `__tests__/unit/pricing/api-client.test.ts`

**Interfaces:**
- Consumes: DTO shapes from Tasks 6–8.
- Produces:
  - `client-types.ts` re-exports shapes without server imports: `SegmentDto`, `CustomerDto`, `CustomerPage`, `SegmentMoveResult`, `PriceListDto = { coPrecio: string; desPrecio: string; assignedCustomerCount: number }`, `FilterOption = { value: string; label: string }`.
  - `api-client.ts`: `ApiError extends Error { status: number }`; `apiGet<T>(url): Promise<T>`; `apiSend<T>(url, method: 'POST' | 'PATCH', body: unknown): Promise<T>` — both throw `ApiError` carrying the server's `{ error }` message (fallback `'Error de red'`).
  - `PricingShell({ canEdit }: { canEdit: boolean })`; exported const `TABS: { id: string; label: string; helpPage: string }[]` (Plans 2–4 append to it).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/pricing/api-client.test.ts
import { describe, test, expect, afterEach } from 'bun:test';
import { apiGet, apiSend, ApiError } from '@/app/(app)/pricing/api-client';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const mockFetch = (status: number, body: unknown) => {
  globalThis.fetch = (async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;
};

describe('api-client', () => {
  test('apiGet returns parsed JSON', async () => {
    mockFetch(200, { a: 1 });
    expect(await apiGet<{ a: number }>('/x')).toEqual({ a: 1 });
  });
  test('non-2xx throws ApiError with the server message and status', async () => {
    mockFetch(409, { error: 'conflicto' });
    try { await apiSend('/x', 'PATCH', {}); throw new Error('no'); }
    catch (e) { expect(e).toBeInstanceOf(ApiError); expect((e as ApiError).status).toBe(409); expect((e as ApiError).message).toBe('conflicto'); }
  });
  test('network failure becomes ApiError(0)', async () => {
    globalThis.fetch = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    await expect(apiGet('/x')).rejects.toMatchObject({ status: 0, message: 'Error de red' });
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

```ts
// app/(app)/pricing/api-client.ts
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = 'ApiError'; }
}

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError((data && typeof data.error === 'string') ? data.error : 'Error de red', res.status);
  return data as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  try { return await parse<T>(await fetch(url)); }
  catch (e) { throw e instanceof ApiError ? e : new ApiError('Error de red', 0); }
}

export async function apiSend<T>(url: string, method: 'POST' | 'PATCH', body: unknown): Promise<T> {
  try {
    return await parse<T>(await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  } catch (e) { throw e instanceof ApiError ? e : new ApiError('Error de red', 0); }
}
```

```ts
// lib/pricing/client-types.ts  (type-only; safe to import from client components)
export type { SegmentDto, SegmentMoveResult } from './segments-service';
export type { CustomerDto } from './customers-query';
export interface CustomerPage { customers: import('./customers-query').CustomerDto[]; total: number; page: number; pageSize: number }
export interface PriceListDto { coPrecio: string; desPrecio: string; assignedCustomerCount: number }
export interface FilterOption { value: string; label: string }
```

`pricing-shell.tsx` — client component. Reads/writes `?tab=` via `useSearchParams` + `useRouter().replace`; renders a tab bar (`role="tablist"`, buttons `role="tab"` with `aria-selected`), the active tab body, and `<HelpPanel page={tab.helpPage} />` from `@/components/help-panel`:

```tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { HelpPanel } from '@/components/help-panel';
import SegmentsTab from './segments-tab';

export const TABS = [
  { id: 'segmentos', label: 'Segmentos', helpPage: 'pricing-segmentos' },
] as const;

export default function PricingShell({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const active = TABS.find(t => t.id === params.get('tab')) ?? TABS[0];

  function select(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set('tab', id);
    next.delete('segment');
    router.replace(`/pricing?${next.toString()}`);
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Precios</h1>
      <div role="tablist" aria-label="Secciones de precios" className="flex gap-1 border-b border-gray-200 mb-4">
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={t.id === active.id} onClick={() => select(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
              t.id === active.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {active.id === 'segmentos' && <SegmentsTab canEdit={canEdit} />}
      <HelpPanel page={active.helpPage} />
    </div>
  );
}
```

`page.tsx`: replace `import PricingClient …` / `return <PricingClient …/>` with `PricingShell` wrapped in `<Suspense>` (required for `useSearchParams`):

```tsx
import { Suspense } from 'react';
import PricingShell from './pricing-shell';
// …existing session/access checks unchanged…
return <Suspense fallback={null}><PricingShell canEdit={accessLevel === 'edit'} /></Suspense>;
```

Create a placeholder `app/(app)/pricing/segments-tab.tsx` exporting a default component that renders `<p>Cargando…</p>` so this task typechecks; Task 11 replaces it. Delete the old `pricing-client.tsx` in Task 12 (cleanup), not here.

- [ ] **Step 4: Verify** — `bun test --isolate --env-file=.env.local __tests__/unit/pricing/api-client.test.ts` → PASS; `bunx tsc --noEmit` clean; `bun run lint` clean for touched files.
- [ ] **Step 5: Commit** — `git add "app/(app)/pricing" lib/pricing/client-types.ts __tests__/unit/pricing/api-client.test.ts && git commit -m "feat(pricing): workspace shell, tabs and API client"`

---

### Task 10: Segment rail and customer panel components

**Files:**
- Create: `app/(app)/pricing/segment-rail.tsx`, `app/(app)/pricing/customer-panel.tsx`, `app/(app)/pricing/segment-badge.ts`
- Test: `__tests__/unit/pricing/segment-badge.test.ts`

**Interfaces:**
- Consumes: `SegmentDto`, `CustomerDto`, `CustomerPage`, `FilterOption`, `CustomerSortKey` (`@/lib/pricing/customers-query` — import the type only), `SearchableSelect` (`@/lib/components/searchable-select`).
- Produces:
  - `segmentBadge(s: Pick<SegmentDto, 'kind' | 'daysLeft'>): { label: string; tone: 'none' | 'ok' | 'warn' | 'expired' } ` — pure: group → `none`; `daysLeft < 0` → `{ label: 'vencida', tone: 'expired' }`; `0..7` → `{ label: '⏳ N d', tone: 'warn' }` (`'hoy'` when 0); otherwise `{ label: '⏳ N d', tone: 'ok' }`.
  - `SegmentRail({ segments, selected, onSelect, onNew, canEdit, loading }: …)`: searchable list (a text input filtering name/code; no `SearchableSelect` here since this is a rail), each item a `<button>` showing name, `coPrecio · customerCount`, badge; selected item `aria-current="true"`; `+ Nuevo` button (only if `canEdit`).
  - `CustomerPanel(props)` with props `{ segment: SegmentDto; page: CustomerPage | null; loading: boolean; error: string | null; filters: { search: string; zona: string; vendedor: string; sort: CustomerSortKey; dir: 'asc' | 'desc'; page: number }; onFiltersChange(patch): void; zonas: FilterOption[]; vendedores: FilterOption[]; selected: Set<string>; onToggle(coCli: string): void; onTogglePage(all: boolean): void; canEdit: boolean; onRepoint(): void; onMove(): void; onSpecial(): void }`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/pricing/segment-badge.test.ts
import { describe, test, expect } from 'bun:test';
import { segmentBadge } from '@/app/(app)/pricing/segment-badge';

describe('segmentBadge', () => {
  test('group segments have no badge', () => expect(segmentBadge({ kind: 'group', daysLeft: null }).tone).toBe('none'));
  test('expired special', () => expect(segmentBadge({ kind: 'special', daysLeft: -3 })).toEqual({ label: 'vencida', tone: 'expired' }));
  test('today / soon / later', () => {
    expect(segmentBadge({ kind: 'special', daysLeft: 0 })).toEqual({ label: '⏳ hoy', tone: 'warn' });
    expect(segmentBadge({ kind: 'special', daysLeft: 7 })).toEqual({ label: '⏳ 7 d', tone: 'warn' });
    expect(segmentBadge({ kind: 'special', daysLeft: 8 })).toEqual({ label: '⏳ 8 d', tone: 'ok' });
  });
  test('special without an expiry date has no badge', () => expect(segmentBadge({ kind: 'special', daysLeft: null }).tone).toBe('none'));
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

```ts
// app/(app)/pricing/segment-badge.ts
import type { SegmentDto } from '@/lib/pricing/client-types';

export type BadgeTone = 'none' | 'ok' | 'warn' | 'expired';

export function segmentBadge(s: Pick<SegmentDto, 'kind' | 'daysLeft'>): { label: string; tone: BadgeTone } {
  if (s.kind !== 'special' || s.daysLeft === null) return { label: '', tone: 'none' };
  if (s.daysLeft < 0) return { label: 'vencida', tone: 'expired' };
  if (s.daysLeft === 0) return { label: '⏳ hoy', tone: 'warn' };
  return { label: `⏳ ${s.daysLeft} d`, tone: s.daysLeft <= 7 ? 'warn' : 'ok' };
}
```

`SegmentRail` and `CustomerPanel` are presentational client components (`'use client'`). Requirements (the wireframe in the spec §4 is authoritative for layout; use Tailwind consistent with `components/*`):

SegmentRail:
- `<nav aria-label="Segmentos">` with a text `<input aria-label="Buscar segmento">` filtering `desTipo`/`tipCli` case-insensitively (client-side); group segments first, then specials sorted by `daysLeft` ascending (expired first).
- Loading → 4 skeleton rows (`animate-pulse`); no segments → "No hay segmentos".
- Badge tones: `warn` amber, `expired` red, `ok` gray; the label text is always rendered (not color-only).

CustomerPanel:
- Header: segment name, `→ <desPrecio ?? coPrecio>`, `N clientes`; for special segments also `Vence <expiresAt>` and `reason`; `Cambiar lista` button when `canEdit`.
- Filters row: debounced search input (parent debounces; panel calls `onFiltersChange({ search, page: 1 })` on every change), two `SearchableSelect`s (zona, vendedor; `allLabel="Todas"` / `"Todos"`), each calling `onFiltersChange({ zona|vendedor, page: 1 })`.
- Table: sortable headers (`<button>` inside `<th aria-sort=…>`) for Cliente (`cliDes`), Zona (`coZon`), Vendedor (`coVen`), Último pedido (`ultimoPedido`); clicking toggles `dir` when already sorted else sets `asc`; header checkbox "Seleccionar todos (página)" calls `onTogglePage`; each row checkbox has `aria-label={`Seleccionar ${cliDes}`}`; rows ≥ 44px tall touch target for the checkbox label.
- States: `loading` → skeleton rows; `error` → red banner with the message; `page.total === 0` → "Este segmento no tiene clientes" (or "Ningún cliente coincide con los filtros" when any filter is set).
- Pagination: "Página X de Y", prev/next buttons (disabled at the ends) calling `onFiltersChange({ page })`.
- Sticky action bar (`sticky bottom-0`, visible when `selected.size > 0 && canEdit`): `N seleccionados`, `Mover a segmento…` (`onMove`), `Precio especial` (`onSpecial`, **disabled unless exactly one selected**, with `title` explaining why), `Limpiar selección`.

- [ ] **Step 4: Verify** — badge test PASS; `bunx tsc --noEmit` clean; `bun run lint` clean.
- [ ] **Step 5: Commit** — `git add "app/(app)/pricing" __tests__/unit/pricing/segment-badge.test.ts && git commit -m "feat(pricing): segment rail and customer panel components"`

---

### Task 11: Dialogs, results, and the segments tab orchestrator

**Files:**
- Create: `app/(app)/pricing/move-dialog.tsx`, `app/(app)/pricing/repoint-dialog.tsx`, `app/(app)/pricing/new-segment-dialog.tsx`, `app/(app)/pricing/special-price-dialog.tsx`, `app/(app)/pricing/results-panel.tsx`, `app/(app)/pricing/use-debounced.ts`
- Modify: `app/(app)/pricing/segments-tab.tsx` (replace the placeholder)
- Test: `__tests__/unit/pricing/special-name-preview.test.ts` (reuses `buildSegmentName` for the live preview contract)

**Interfaces:**
- Consumes: `apiGet`/`apiSend`, all DTOs, `Modal` (`@/components/modal`), `SearchableSelect`, `buildSegmentName`/`todayIso` (client-safe, no server imports), `segmentBadge`.
- Produces (props):
  - `MoveDialog({ segments, currentTipCli, selectedCount, onConfirm(targetTipCli: string): Promise<void>, onClose })` — a `SearchableSelect` of segments (excluding `currentTipCli`); shows `Se moverán N clientes de «A» → «B»` and `Lista: X → Y`; confirm button disabled until a target is chosen and while submitting.
  - `RepointDialog({ segment, priceLists, onConfirm(coPrecio: string): Promise<void>, onClose })` — shows `N clientes cambiarán de «lista actual» a «nueva lista»`.
  - `NewSegmentDialog({ priceLists, onConfirm({ desTipo, coPrecio }): Promise<void>, onClose })` — name (≤ 60) + list.
  - `SpecialPriceDialog({ customer: { coCli; cliDes }, currentSegment: SegmentDto, segments, priceLists, onConfirm(input: { reason; expiresOn; coPrecio; fallbackTipCli }): Promise<void>, onClose })` — fields: reason (≤ 40), end date (`<input type="date" min={tomorrow}>`), price list, fallback segment (defaults to the customer's current segment); live preview line `Nombre en Profit: <buildSegmentName(...)>` using `todayIso()`.
  - `ResultsPanel({ results, nameByCode, onRetry(codes: string[]) , onDismiss })` — `role="status"` + `aria-live="polite"`; groups Éxito / Conflicto / Error with customer **names**; conflict group has `Reintentar` (calls `onRetry` with those codes).
  - `useDebounced<T>(value: T, ms: number): T`.

- [ ] **Step 1: Write the failing test** (pins the preview contract the dialog relies on)

```ts
// __tests__/unit/pricing/special-name-preview.test.ts
import { describe, test, expect } from 'bun:test';
import { buildSegmentName } from '@/lib/pricing/segment-name';

describe('special price name preview', () => {
  test('matches what the server will write', () => {
    expect(buildSegmentName({ customerName: 'Bodega El Sol', reason: 'promo oct', endsOn: '2026-10-31', today: '2026-10-01' }))
      .toBe('Bodega El Sol · promo oct · hasta 31/10');
  });
  test('a 100-char customer still previews within the ERP limit', () => {
    const name = buildSegmentName({ customerName: 'X'.repeat(100), reason: 'promo octubre larga', endsOn: '2027-01-15', today: '2026-10-01' });
    expect(name.length).toBeLessThanOrEqual(60);
  });
});
```

- [ ] **Step 2: Run** → passes immediately if Task 2 is correct (it is a contract pin); if it fails, fix `segment-name.ts`.
- [ ] **Step 3: Implement.** Dialog components follow `components/modal.tsx` (title + onClose, Escape closes). Each confirm handler: set `submitting`, `await onConfirm(...)`, on thrown `ApiError` show `error.message` in a red `role="alert"` box inside the dialog and keep it open; on success the parent closes it. `segments-tab.tsx` orchestrator (full behavior):

```tsx
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiGet, apiSend, ApiError } from './api-client';
import type { CustomerPage, FilterOption, PriceListDto, SegmentDto, SegmentMoveResult } from '@/lib/pricing/client-types';
import SegmentRail from './segment-rail';
import CustomerPanel from './customer-panel';
import MoveDialog from './move-dialog';
import RepointDialog from './repoint-dialog';
import NewSegmentDialog from './new-segment-dialog';
import SpecialPriceDialog from './special-price-dialog';
import ResultsPanel from './results-panel';
import { useDebounced } from './use-debounced';

type DialogState = null | 'move' | 'repoint' | 'new' | 'special';

export default function SegmentsTab({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [segments, setSegments] = useState<SegmentDto[]>([]);
  const [priceLists, setPriceLists] = useState<PriceListDto[]>([]);
  const [zonas, setZonas] = useState<FilterOption[]>([]);
  const [vendedores, setVendedores] = useState<FilterOption[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(true);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);
  const [page, setPage] = useState<CustomerPage | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ search: '', zona: '', vendedor: '', sort: 'cliDes' as const, dir: 'asc' as 'asc' | 'desc', page: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [results, setResults] = useState<SegmentMoveResult[] | null>(null);

  const debouncedSearch = useDebounced(filters.search, 300);
  const selectedTip = params.get('segment');
  const segment = useMemo(() => segments.find(s => s.tipCli === selectedTip) ?? null, [segments, selectedTip]);

  const loadSegments = useCallback(async () => {
    try {
      setSegments((await apiGet<{ segments: SegmentDto[] }>('/api/pricing/segments')).segments);
      setSegmentsError(null);
    } catch (e) { setSegmentsError(e instanceof ApiError ? e.message : 'Error'); }
    finally { setSegmentsLoading(false); }
  }, []);

  useEffect(() => {
    void loadSegments();
    apiGet<{ priceLists: PriceListDto[] }>('/api/pricing/price-lists').then(d => setPriceLists(d.priceLists)).catch(() => {});
    apiGet<{ zonas: FilterOption[]; vendedores: FilterOption[] }>('/api/pricing/customer-filters')
      .then(d => { setZonas(d.zonas); setVendedores(d.vendedores); }).catch(() => {});
  }, [loadSegments]);

  // default selection: first segment
  useEffect(() => {
    if (!selectedTip && segments.length > 0) selectSegment(segments[0].tipCli);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, selectedTip]);

  function selectSegment(tipCli: string) {
    const next = new URLSearchParams(params.toString());
    next.set('segment', tipCli);
    router.replace(`/pricing?${next.toString()}`);
    setSelected(new Set());
    setFilters(f => ({ ...f, page: 1 }));
  }

  const loadCustomers = useCallback(async () => {
    if (!selectedTip) return;
    setPageLoading(true);
    const q = new URLSearchParams({ tipCli: selectedTip, sort: filters.sort, dir: filters.dir, page: String(filters.page) });
    if (debouncedSearch) q.set('search', debouncedSearch);
    if (filters.zona) q.set('zona', filters.zona);
    if (filters.vendedor) q.set('vendedor', filters.vendedor);
    try { setPage(await apiGet<CustomerPage>(`/api/pricing/customers?${q}`)); setPageError(null); }
    catch (e) { setPageError(e instanceof ApiError ? e.message : 'Error'); }
    finally { setPageLoading(false); }
  }, [selectedTip, filters.sort, filters.dir, filters.page, filters.zona, filters.vendedor, debouncedSearch]);

  useEffect(() => { void loadCustomers(); }, [loadCustomers]);

  const nameByCode = useMemo(() => Object.fromEntries((page?.customers ?? []).map(c => [c.coCli, c.cliDes])), [page]);

  async function moveCustomers(codes: string[], targetTipCli: string) {
    const { results } = await apiSend<{ results: SegmentMoveResult[] }>('/api/pricing/assignments', 'POST', { customerCodes: codes, targetTipCli });
    setResults(results);
    setSelected(new Set());
    setDialog(null);
    await Promise.all([loadSegments(), loadCustomers()]);
  }

  // …render: 2-column layout (rail | panel); <ResultsPanel> above the panel when `results` is set;
  // dialogs rendered by `dialog` state. canEdit=false hides every write control.
  // Handlers:
  //  - onMove     → <MoveDialog … onConfirm={t => moveCustomers([...selected], t)} />
  //  - onRepoint  → <RepointDialog … onConfirm={coPrecio => apiSend(`/api/pricing/segments/${segment.tipCli}`, 'PATCH', { coPrecio, validador: segment.validador }).then(async () => { setDialog(null); await loadSegments(); })} />
  //  - onNew      → <NewSegmentDialog … onConfirm={b => apiSend('/api/pricing/segments', 'POST', { kind: 'group', ...b }).then(async r => { setDialog(null); await loadSegments(); selectSegment(r.segment.tipCli); })} />
  //  - onSpecial  → exactly one selected customer → <SpecialPriceDialog …
  //       onConfirm={i => apiSend<{ segment: SegmentDto; move?: SegmentMoveResult }>('/api/pricing/segments', 'POST',
  //          { kind: 'special', customerCoCli: [...selected][0], ...i }).then(async r => {
  //            setDialog(null); if (r.move && r.move.outcome !== 'success') setResults([r.move]);
  //            setSelected(new Set()); await Promise.all([loadSegments(), loadCustomers()]); })} />
  //  - ResultsPanel.onRetry(codes) → moveCustomers(codes, <target of the failed move; keep it in state: lastTarget>)
  // A 409 ApiError from RepointDialog shows its message; after it, the dialog's "Recargar" calls loadSegments().
  return null; // replace with the JSX described above
}
```

Replace the final `return null` with real JSX implementing the comments; keep `lastTarget` in state for retries.

- [ ] **Step 4: Verify** — `bunx tsc --noEmit` clean; `bun run lint` clean; manual check with `bun run dev` is **not required** here (covered in Task 12), but the page must compile: `bun run build` is deferred to Task 12.
- [ ] **Step 5: Commit** — `git add "app/(app)/pricing" __tests__/unit/pricing/special-name-preview.test.ts && git commit -m "feat(pricing): segment workspace dialogs and orchestration"`

---

### Task 12: Help content, e2e, cleanup, final verification

**Files:**
- Create: `content/help/pricing-segmentos.md`, `e2e/pricing-segments.spec.ts`
- Modify: `app/api/help/[page]/route.ts` (add slug), `package.json` only if the e2e needs a tag (no)
- Delete: `app/(app)/pricing/pricing-client.tsx`; remove now-unused `ensureTipoClienteForPriceList`/`assignCustomerPriceList` from `lib/pricing/sa-cliente-fields.ts` **only if** `grep -rn "assignCustomerPriceList\|ensureTipoClienteForPriceList" --include='*.ts' --include='*.tsx' .` shows no remaining references outside `scripts/dwh/__tests__/pricing-assignment.test.ts`; if that test references them, leave both functions in place.

**Interfaces:** none new.

- [ ] **Step 1: Help content.** Write `content/help/pricing-segmentos.md` in Spanish (style: see `content/help/dashboard.md`): what a segment is (a *tipo de cliente* that points to one price list), how moving a customer changes its price list, what "Cambiar lista" does to the whole segment, what a *precio especial* is (one-customer segment, generated name, end date), that expiry is shown but **not yet enforced automatically** (a later release adds the revert), and a short troubleshooting list (conflict message → reload). Add `'pricing-segmentos'` to `HELP_PAGES` in `app/api/help/[page]/route.ts`.
- [ ] **Step 2: e2e.** Write `e2e/pricing-segments.spec.ts` following `e2e/help-panel.spec.ts` / `e2e/fixtures.ts` conventions. Tag the describe `@mssql` (it needs the ERP). Cases: (a) a user without any pricing grant is redirected away from `/pricing`; (b) a `pricing_view` user sees the rail and customers but no "Mover a segmento"/"Precio especial" buttons; (c) the help panel on `/pricing` shows the "Segmentos" help heading. Reuse the grant-seeding helper used by `e2e/admin-users.spec.ts` or `e2e/inicio.spec.ts` (read them; do not invent helpers). Run only if the mock ERP is up: `bun run e2e:mssql -- pricing-segments` — if the e2e environment cannot start (see memory notes in `AGENTS.md`/`INSTRUCTIONS.md`), record that in the commit body and rely on the other verification below.
- [ ] **Step 3: Cleanup** as listed above, then run the full verification:

```bash
bunx tsc --noEmit
bun run lint
bun test --isolate --env-file=.env.local __tests__/unit/pricing __tests__/unit/geo __tests__/unit/services
bun run test:pricing-erp          # mock ERP only
bun run build                     # production build compiles the new pages and routes
```

Expected: all green. Fix anything red before committing; do not skip failing tests.
- [ ] **Step 4: Manual smoke (agent-run, headless).** Start the production server (`bun run build && bun run start` on a free port, with `SQLITE_PATH` pointed at a temp dir **and** `bun run migrate` run against that temp path first, per the dev-DB wipe hazard) — or, if that is impractical overnight, skip and note it. Hit `GET /api/pricing/segments` unauthenticated and confirm `401`.
- [ ] **Step 5: Commit** — `git add -A content app e2e lib && git commit -m "feat(pricing): segments workspace help, e2e and cleanup"`

**Plan 1 done criteria:** all Task 12 verification commands green; branch contains one commit per task; the `/pricing` page renders the shell with the Segmentos tab.
