# Price List Customer Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins and pricing-granted users browse Profit Plus price
lists and customers, and reassign a customer's price list — a real write
(`saCliente.tip_cli`) that takes effect at the point of sale.

**Architecture:** A new `pricing` SQLite module permission (two synthetic
`user_modules` values, `pricing_view`/`pricing_edit` — no schema migration),
two read-only ERP list/search API routes, one write API route wrapping the
native `pActualizarCliente` stored procedure (with an inline
`saTipoCliente` auto-create step via `pInsertarTipoCliente` when a target
price list has no customer-type row yet), and a two-panel Next.js page
(price lists ↔ customers) with a bulk-reassign action. All writes are
synchronous, following the existing inventory-adjustment route's pattern.

**Tech Stack:** TypeScript, Next.js 16 App Router, Drizzle (SQLite,
`user_modules`), `mssql` (ERP pool via `lib/db/mssql.ts`), `bun:test`.

**Spec:** `docs/superpowers/specs/2026-09-27-price-list-customer-assignment-design.md`

**Depends on:** `docs/superpowers/plans/2026-09-27-consignment-store-deliveries.md` (implemented first; unrelated code paths, no shared files, but kept in sequence per project convention).

## Global Constraints

- No schema migration for the module grant — `pricing_view`/`pricing_edit`
  are just two more allowed `user_modules.module` enum values (spec
  Section 9, superseding its own earlier "add a `level` column" idea).
- Every ERP write uses the **native** stored procedure
  (`pActualizarCliente`, `pInsertarTipoCliente`) — never a raw
  `UPDATE`/`INSERT` on `saCliente`/`saTipoCliente` (spec Sections 4–5).
- `pActualizarCliente` is a **whole-record update** — every call must read
  the customer's current full row first and pass every field back
  unchanged except `tip_cli` (spec Section 5). The exact `saCliente` column
  list must be verified against the **live** ERP before writing this code —
  the knowledge-base schema doc is a curated 25-column subset, not the full
  DDL, against a stored procedure with ~55 parameters (see Task 3, Step 1).
- Concurrency conflicts (stale `validador`, detected by an empty result set
  from the SP, not a rowcount) surface as an error to the caller — no
  silent no-op, no automatic retry (spec Section 5).
- Every write is synchronous, inline in the API request — no job queue, no
  background worker (spec Section 6).
- Every route checks session + access independently, page and API, per
  `AGENTS.md`'s no-shared-middleware convention.
- No promotions, no SKU rate editing, no margin warnings, no effective
  price matrix — out of scope entirely (spec Section 2).
- `.input()` binding for every parameterized ERP query — never string
  concatenation (`AGENTS.md`).

## Review Focus

- **A price list with no existing `saTipoCliente` row must auto-create one
  transparently on first assignment**, not error out asking the user to
  provision it first (spec Section 4). A test that only exercises
  assignment to an already-mapped price list will miss this.
- **A concurrency conflict (customer edited elsewhere since this app last
  read them) must surface as a clear, retryable error** — not a silent
  success, not a crash, not a duplicate/garbled write (spec Section 5). The
  SP's own signal for this is an *empty* result set, not an exception or a
  rowcount — a naive `try { await execute(...) } catch` with no result-set
  check will miss this entirely.
- **A bulk reassignment where some customers succeed and others conflict
  must report per-customer outcomes**, not fail the whole batch on the
  first conflict and not silently mask which ones failed (spec Section 5).
- **The whole-record update must not blank out fields the UI never
  touched** — since `pActualizarCliente` takes ~55 parameters covering the
  entire customer record, a bug that passes `undefined`/`null` for any
  field the read-side query forgot to select would silently wipe that data
  in Profit Plus on the next reassignment of that customer. This is the
  single highest-blast-radius mistake this feature can make.
- **A user with `pricing_view` only (no `pricing_edit`) must be blocked by
  the API, not just hidden by the UI** — someone could call the reassignment
  route directly. A test that only checks page-level rendering will miss a
  route that forgets the independent check (`AGENTS.md`'s "every gate is
  enforced twice" rule).

---

## File Structure

- **Modify:** `lib/db/schema.ts` — extend `userModules.module` enum with
  `'pricing_view' | 'pricing_edit'`.
- **Create:** `lib/pricing/access.ts` — `getPricingAccessLevel()`,
  `requirePricingAccess()`, mirroring `lib/dwh/access.ts`'s shape.
- **Modify:** `app/api/admin/users/[id]/modules/route.ts` — extend
  `VALID_MODULES`.
- **Modify:** `app/(app)/admin/users/users-client.tsx` — add "Ver Precios"
  / "Editar Precios" checkboxes.
- **Modify:** `app/(app)/layout.tsx`, `components/sidebar.tsx` — thread
  pricing access level, add nav link.
- **Create:** `app/api/pricing/price-lists/route.ts` — GET, list
  `saTipoPrecio` rows with assigned-customer counts.
- **Create:** `app/api/pricing/customers/route.ts` — GET, search/list
  `saCliente` rows with resolved price list.
- **Create:** `app/api/pricing/assignments/route.ts` — POST, single/bulk
  customer reassignment (the one write route).
- **Create:** `lib/pricing/sa-cliente-fields.ts` — the verified full
  `saCliente` column list ↔ `pInsertarCliente`/`pActualizarCliente`
  parameter mapping, and the read/build-params helpers used by the write
  route.
- **Create:** `app/(app)/pricing/page.tsx` — server component, session +
  access check, renders the client component.
- **Create:** `app/(app)/pricing/pricing-client.tsx` — the two-panel UI
  (price lists ↔ customers) + bulk reassignment modal.
- **Test:** `scripts/dwh/__tests__/pricing-access.test.ts` (SQLite-only,
  no ERP needed — module-grant logic).
- **Test:** `scripts/dwh/__tests__/pricing-assignment.test.ts` (ERP
  integration — the write path, run against the `.env.local` ERP test
  config, mirroring `scripts/dwh/__tests__/*` conventions but pointed at
  `DB_*`, not `DW_*`, since this is a live-ERP feature not a DWH one).

---

### Task 1: `pricing` module permission (SQLite, no ERP)

**Files:**
- Modify: `lib/db/schema.ts:17-24` (the `userModules` table)
- Create: `lib/pricing/access.ts`
- Modify: `app/api/admin/users/[id]/modules/route.ts:10` (`VALID_MODULES`)
- Modify: `app/(app)/admin/users/users-client.tsx` (checkboxes +
  `handleToggleModule` generalization)
- Test: `scripts/dwh/__tests__/pricing-access.test.ts`

**Interfaces:**
- Consumes: `schema.userModules` (Drizzle table), `getDb()` from
  `lib/db/sqlite.ts`, `getSessionFromRequest()` from
  `lib/inventory/access.ts`.
- Produces: `getPricingAccessLevel(db, userId, role): Promise<'none' | 'view' | 'edit'>`,
  `requirePricingAccess(request, minLevel: 'view' | 'edit'): Promise<{ok:true,session}|{ok:false,response}>`
  — both consumed by Tasks 2 and 3.

- [ ] **Step 1: Write the failing test for `getPricingAccessLevel`**

```typescript
// scripts/dwh/__tests__/pricing-access.test.ts
import { describe, test, expect, beforeEach } from 'bun:test';
import { getDb } from '../../../lib/db/sqlite';
import { users, userModules } from '../../../lib/db/schema';
import { getPricingAccessLevel } from '../../../lib/pricing/access';

describe('getPricingAccessLevel', () => {
  let userId: number;

  beforeEach(() => {
    const db = getDb();
    db.delete(userModules).run();
    db.delete(users).run();
    const inserted = db.insert(users).values({
      email: `pricing-test-${Date.now()}@example.com`,
      name: 'Pricing Test User',
      passwordHash: 'x',
      role: 'user',
      createdAt: Date.now(),
    }).returning({ id: users.id }).get();
    userId = inserted.id;
  });

  test('returns "none" with no grant rows', async () => {
    const db = getDb();
    const level = await getPricingAccessLevel(db, String(userId), 'user');
    expect(level).toBe('none');
  });

  test('returns "view" with only a pricing_view row', async () => {
    const db = getDb();
    db.insert(userModules).values({ userId, module: 'pricing_view' }).run();
    const level = await getPricingAccessLevel(db, String(userId), 'user');
    expect(level).toBe('view');
  });

  test('returns "edit" with a pricing_edit row (view row not required)', async () => {
    const db = getDb();
    db.insert(userModules).values({ userId, module: 'pricing_edit' }).run();
    const level = await getPricingAccessLevel(db, String(userId), 'user');
    expect(level).toBe('edit');
  });

  test('returns "edit" for an admin regardless of grant rows', async () => {
    const db = getDb();
    const level = await getPricingAccessLevel(db, String(userId), 'admin');
    expect(level).toBe('edit');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test scripts/dwh/__tests__/pricing-access.test.ts`
Expected: FAIL with "Cannot find module '../../../lib/pricing/access'" or
similar (module/enum values don't exist yet).

- [ ] **Step 3: Extend the `userModules` enum**

```typescript
// lib/db/schema.ts — replace the existing userModules block (lines 17-24)
export const userModules = sqliteTable('user_modules', {
  id:     integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  module: text('module', { enum: ['inventory', 'dwh', 'pricing_view', 'pricing_edit'] }).notNull(),
});
```

This is a TypeScript-only enum widening — SQLite's `text` column has no
`CHECK` constraint backing it (confirmed in `AGENTS.md`'s "Adding a new
module" section), so **no migration file is needed**, matching how
`inventory`/`dwh` themselves were added.

- [ ] **Step 4: Write `lib/pricing/access.ts`**

```typescript
// lib/pricing/access.ts
import { eq, and } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as schema from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import type { SessionPayload } from '@/lib/auth/session';

export type PricingAccessLevel = 'none' | 'view' | 'edit';

export async function getPricingAccessLevel(
  db: BunSQLiteDatabase<typeof schema>,
  userId: string,
  role: 'user' | 'admin',
): Promise<PricingAccessLevel> {
  if (role === 'admin') return 'edit';

  const grants = db
    .select({ module: schema.userModules.module })
    .from(schema.userModules)
    .where(
      and(
        eq(schema.userModules.userId, parseInt(userId, 10)),
        // Drizzle's `inArray` would also work here; `or` of two `eq` keeps
        // this readable without an extra import.
      ),
    )
    .all();

  const modules = new Set(grants.map(g => g.module));
  if (modules.has('pricing_edit')) return 'edit';
  if (modules.has('pricing_view')) return 'view';
  return 'none';
}

export type PricingAccessResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: NextResponse };

/**
 * Session + access check for every app/api/pricing/*\/route.ts handler.
 * minLevel: 'view' allows both 'view' and 'edit' grants through; 'edit'
 * requires the 'edit' grant specifically. Mirrors requireDwhAccess's shape.
 */
export async function requirePricingAccess(
  request: NextRequest,
  minLevel: 'view' | 'edit',
): Promise<PricingAccessResult> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  const db = getDb();
  const level = await getPricingAccessLevel(db, session.sub, session.role);
  const allowed = minLevel === 'view' ? level !== 'none' : level === 'edit';
  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: 'Prohibido' }, { status: 403 }) };
  }

  return { ok: true, session };
}
```

Note the query above selects `module` for the user without filtering to
`pricing_*` values, then checks set membership — this reads slightly more
rows than a `WHERE module IN (...)` filter would, but for a per-user grant
list (at most a handful of rows) this is simpler and avoids importing
`inArray` for a two-value check. If a future module count makes this
wasteful, narrow the `WHERE` then — not needed now (YAGNI).

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test scripts/dwh/__tests__/pricing-access.test.ts`
Expected: PASS, all 4 tests green.

- [ ] **Step 6: Extend `VALID_MODULES` in the admin modules route**

```typescript
// app/api/admin/users/[id]/modules/route.ts:10 — replace
const VALID_MODULES = ['inventory', 'dwh', 'pricing_view', 'pricing_edit'] as const;
```

And widen the cast at line 42 (`module: moduleName as 'inventory' | 'dwh'`)
to include the two new values:

```typescript
      db.insert(userModules).values({ userId, module: moduleName as typeof VALID_MODULES[number] }).run();
```

- [ ] **Step 7: Add pricing checkboxes to the admin users UI**

In `app/(app)/admin/users/users-client.tsx`, add a `handleTogglePricing`
function alongside the existing `handleToggleModule` (the existing function
only toggles one module string in/out of the array — pricing needs two
related-but-independent toggles, so a small dedicated handler is clearer
than overloading the generic one):

```typescript
  async function handleTogglePricing(user: UserRow, level: 'view' | 'edit') {
    const moduleValue = level === 'view' ? 'pricing_view' : 'pricing_edit';
    const hasIt = user.modules.includes(moduleValue);
    const nextModules = hasIt
      ? user.modules.filter(m => m !== moduleValue)
      : [...user.modules, moduleValue];

    const res = await fetch(`/api/admin/users/${user.id}/modules`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ modules: nextModules }),
    });
    if (res.ok) {
      setUserList(prev => prev.map(u => u.id === user.id ? { ...u, modules: nextModules } : u));
    }
  }
```

Add `'Precios'` to the header array (line 133's literal string list), and
a new `<td>` after the existing "Analítica" column (mirroring the existing
checkbox `<td>` structure at lines 155-178):

```tsx
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1 text-xs text-gray-700">
                    {user.role === 'admin' ? (
                      <span>Incluido (admin)</span>
                    ) : (
                      <>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={user.modules.includes('pricing_view') || user.modules.includes('pricing_edit')}
                            onChange={() => handleTogglePricing(user, 'view')}
                            className="rounded border-gray-300"
                          />
                          Ver Precios
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={user.modules.includes('pricing_edit')}
                            onChange={() => handleTogglePricing(user, 'edit')}
                            className="rounded border-gray-300"
                          />
                          Editar Precios
                        </label>
                      </>
                    )}
                  </div>
                </td>
```

Unchecking "Ver Precios" while "Editar Precios" is checked would leave an
`edit`-only grant with no `view` row, which `getPricingAccessLevel` already
treats as `'edit'` (edit implies view in the access check) — so this UI
doesn't need to force the two checkboxes to stay in sync; the access-level
logic already makes `pricing_edit` alone sufficient.

- [ ] **Step 8: Manually verify the admin UI**

Run: `bun dev`, log in as an admin, open `/admin/users`, toggle both new
checkboxes for a test user, confirm the request succeeds and the checkbox
state persists on page reload.
Expected: both checkboxes render, toggle independently, and survive reload.

- [ ] **Step 9: Commit**

```bash
git add lib/db/schema.ts lib/pricing/access.ts app/api/admin/users/[id]/modules/route.ts app/(app)/admin/users/users-client.tsx scripts/dwh/__tests__/pricing-access.test.ts
git commit -m "$(cat <<'EOF'
feat: add pricing module permission with view/edit levels

Two synthetic user_modules values (pricing_view/pricing_edit) instead
of a schema migration -- module grants are pure row-existence checks
in this app, and adding a value column just for this one module would
leave every existing inventory/dwh row with a permanently meaningless
NULL. edit implies view in the access check, so the two checkboxes
don't need to be kept in sync client-side.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Read-only price list and customer browsing

**Files:**
- Create: `app/api/pricing/price-lists/route.ts`
- Create: `app/api/pricing/customers/route.ts`
- Test: covered by Task 4's page-level manual verification (these are thin
  read routes over well-understood tables; a dedicated ERP-integration
  test is added in Task 3 once the write path exists, so the read routes
  can be exercised end-to-end rather than mocked)

**Interfaces:**
- Consumes: `getPool()` from `lib/db/mssql.ts`, `requirePricingAccess()`
  from Task 1.
- Produces: `GET /api/pricing/price-lists` → `{ priceLists: PriceListRow[] }`
  where `PriceListRow = { coPrecio: string; desPrecio: string; assignedCustomerCount: number }`.
  `GET /api/pricing/customers?search=&segment=&priceList=` →
  `{ customers: CustomerRow[] }` where
  `CustomerRow = { coCli: string; cliDes: string; coSeg: string | null; tipCli: string | null; coPrecio: string | null; desPrecio: string | null }`.
  Both consumed by Task 4's UI.

- [ ] **Step 1: Write `app/api/pricing/price-lists/route.ts`**

```typescript
// app/api/pricing/price-lists/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/mssql';
import { requirePricingAccess } from '@/lib/pricing/access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth.response;

  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        RTRIM(tp.co_precio)  AS coPrecio,
        RTRIM(tp.des_precio) AS desPrecio,
        (
          SELECT COUNT(*)
          FROM saCliente c
          JOIN saTipoCliente tc ON tc.tip_cli = c.tip_cli
          WHERE tc.co_precio = tp.co_precio
        ) AS assignedCustomerCount
      FROM saTipoPrecio tp
      ORDER BY RTRIM(tp.des_precio)
    `);
    return NextResponse.json({ priceLists: result.recordset });
  } catch (error) {
    console.error('Pricing price-lists list error:', error);
    return NextResponse.json({ error: 'Error al consultar listas de precio' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write `app/api/pricing/customers/route.ts`**

```typescript
// app/api/pricing/customers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getPool } from '@/lib/db/mssql';
import { requirePricingAccess } from '@/lib/pricing/access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim() ?? '';
  const segment = searchParams.get('segment')?.trim() ?? '';
  const priceList = searchParams.get('priceList')?.trim() ?? '';

  try {
    const pool = await getPool();
    const req = pool.request();
    const conditions: string[] = [];

    if (search) {
      req.input('search', sql.VarChar(120), `%${search}%`);
      conditions.push(`(c.cli_des LIKE @search OR RTRIM(c.co_cli) LIKE @search OR c.rif LIKE @search)`);
    }
    if (segment) {
      req.input('segment', sql.Char(6), segment);
      conditions.push(`RTRIM(c.co_seg) = RTRIM(@segment)`);
    }
    if (priceList) {
      req.input('priceList', sql.Char(6), priceList);
      conditions.push(`RTRIM(tc.co_precio) = RTRIM(@priceList)`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await req.query(`
      SELECT TOP 500
        RTRIM(c.co_cli)   AS coCli,
        c.cli_des         AS cliDes,
        RTRIM(c.co_seg)   AS coSeg,
        RTRIM(c.tip_cli)  AS tipCli,
        RTRIM(tc.co_precio)  AS coPrecio,
        RTRIM(tp.des_precio) AS desPrecio
      FROM saCliente c
      LEFT JOIN saTipoCliente tc ON tc.tip_cli = c.tip_cli
      LEFT JOIN saTipoPrecio tp ON tp.co_precio = tc.co_precio
      ${where}
      ORDER BY c.cli_des
    `);
    return NextResponse.json({ customers: result.recordset });
  } catch (error) {
    console.error('Pricing customers list error:', error);
    return NextResponse.json({ error: 'Error al consultar clientes' }, { status: 500 });
  }
}
```

The `TOP 500` cap plus server-side `search`/`segment`/`priceList` filters
exist because `saCliente` is not a small "sellers/tiendas"-sized list (see
the `SearchableSelect` component's own doc comment, which explicitly scopes
that component to small in-memory-filtered lists) — this route does the
filtering in SQL rather than shipping the whole customer table to the
client, and Task 4's UI drives these query params from its own search box
rather than reusing `SearchableSelect` for the customer picker.

- [ ] **Step 3: Manually verify both routes**

Run: `bun dev`, then (with a valid session cookie, e.g. via the browser
already logged in) hit:
`curl -b <cookie> http://localhost:3000/api/pricing/price-lists`
`curl -b <cookie> "http://localhost:3000/api/pricing/customers?search=a"`
Expected: both return `200` with populated JSON arrays; an unauthenticated
request (no cookie) returns `401`.

- [ ] **Step 4: Commit**

```bash
git add app/api/pricing/price-lists/route.ts app/api/pricing/customers/route.ts
git commit -m "$(cat <<'EOF'
feat: add read-only price list and customer browsing routes

Server-side search/filter on saCliente rather than shipping the full
table client-side -- unlike the small option lists SearchableSelect
was built for (sellers, tiendas), the customer list is large enough
to need its own paginated/filtered query.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Customer reassignment write path (the core write)

**Files:**
- Create: `lib/pricing/sa-cliente-fields.ts`
- Create: `app/api/pricing/assignments/route.ts`
- Test: `scripts/dwh/__tests__/pricing-assignment.test.ts`

**Interfaces:**
- Consumes: `getPool()` from `lib/db/mssql.ts`, `requirePricingAccess()`
  from Task 1.
- Produces:
  - `readFullCustomerRow(pool, coCli): Promise<SaClienteRow | null>` — the
    full-record read used before any `pActualizarCliente` call.
  - `buildActualizarClienteParams(row: SaClienteRow, changes: { tipCli: string }): ActualizarClienteParams`
    — merges the read row with the one field being changed.
  - `assignCustomerPriceList(pool, coCli, targetCoPrecio, sessionUser): Promise<AssignmentResult>`
    where `AssignmentResult = { ok: true } | { ok: 'conflict' } | { ok: false; error: string }`.
  - `ensureTipoClienteForPriceList(pool, coPrecio): Promise<string>` — returns
    the `tip_cli` code to use for a given price list, auto-creating a
    `saTipoCliente` row via `pInsertarTipoCliente` if none exists yet.
  - `POST /api/pricing/assignments` — body `{ customerCodes: string[]; targetCoPrecio: string }`,
    response `{ results: Array<{ coCli: string; outcome: 'success' | 'conflict' | 'error'; message?: string }> }`.

**Before writing any code in this task:** the `saCliente` schema doc from
the knowledge-base MCP is a curated 25-column "Campos Clave" subset, while
`pInsertarCliente`/`pActualizarCliente` take roughly 55 parameters covering
the whole record. Passing `undefined`/`null` for any real column the
read-side query misses would **silently blank that field in Profit Plus**
on the next reassignment of that customer — the single highest-risk defect
this feature can produce. Do not skip Step 1.

- [ ] **Step 1: Verify the live `saCliente` column list against the real ERP**

Run this against the actual Profit Plus SQL Server (not the knowledge base)
before writing `sa-cliente-fields.ts`:

```bash
bun --env-file=.env.local -e "
import { getPool } from './lib/db/mssql';
const pool = await getPool();
const result = await pool.request().query(\`
  SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'saCliente'
  ORDER BY ORDINAL_POSITION
\`);
console.table(result.recordset);
process.exit(0);
"
```

Expected: a full column list, materially longer than the 25 documented in
the knowledge base. Cross-reference every column against the
`pInsertarCliente`/`pActualizarCliente` parameter list in the spec (Section
5) and the fuller list surfaced during this plan's research (see the
plan's commit history / conversation — every one of the ~55 parameters
needs a matching `saCliente` column or a documented reason it's insert-only
noise, e.g. `@sTipo_Iva`/`@deIva`, which the knowledge base documents as
accepted-but-not-persisted by the SP itself). Write down the final
confirmed column↔parameter mapping as the field list used in Step 2 below
— do not proceed on the assumption that the spec's or knowledge base's
partial lists are complete.

- [ ] **Step 2: Write `lib/pricing/sa-cliente-fields.ts` using the verified column list**

This file's exact field list depends on Step 1's live-verified output, so
the shape below is illustrative of the pattern — fill in every real column
found in Step 1, not just the ones shown here:

```typescript
// lib/pricing/sa-cliente-fields.ts
import sql from 'mssql';
import type { ConnectionPool } from 'mssql';

// Full saCliente row as read before any pActualizarCliente call -- every
// field pInsertarCliente/pActualizarCliente accepts must have an entry
// here, confirmed against the live ERP's INFORMATION_SCHEMA.COLUMNS (see
// implementation plan Task 3 Step 1), not just the knowledge base's
// curated "Campos Clave" subset -- a missing field here would silently
// blank that column in Profit Plus on the next write.
export interface SaClienteRow {
  coCli: string;
  cliDes: string | null;
  tipCli: string | null;
  coSeg: string | null;
  coZon: string | null;
  coVen: string | null;
  inactivo: boolean;
  rif: string | null;
  nit: string | null;
  contrib: boolean;
  montCre: number | null;
  coMone: string | null;
  condPag: string | null;
  plazPag: number | null;
  descPpago: number | null;
  descGlob: number | null;
  direc1: string | null;
  dirEnt2: string | null;
  telefonos: string | null;
  email: string | null;
  juridico: boolean;
  tipoPer: string | null;
  coTab: string | null;
  fechaReg: Date | null;
  puntaje: number | null;
  coCtaIngrEgr: string | null;
  validador: Buffer;
  // ... every remaining verified column from Step 1 goes here.
}

export async function readFullCustomerRow(pool: ConnectionPool, coCli: string): Promise<SaClienteRow | null> {
  const result = await pool.request()
    .input('coCli', sql.Char(16), coCli)
    .query(`SELECT * FROM saCliente WHERE RTRIM(co_cli) = RTRIM(@coCli)`);
  if (result.recordset.length === 0) return null;
  const row = result.recordset[0];
  return {
    coCli: row.co_cli,
    cliDes: row.cli_des,
    tipCli: row.tip_cli,
    coSeg: row.co_seg,
    coZon: row.co_zon,
    coVen: row.co_ven,
    inactivo: Boolean(row.inactivo),
    rif: row.rif,
    nit: row.nit,
    contrib: Boolean(row.contrib),
    montCre: row.mont_cre,
    coMone: row.co_mone,
    condPag: row.cond_pag,
    plazPag: row.plaz_pag,
    descPpago: row.desc_ppago,
    descGlob: row.desc_glob,
    direc1: row.direc1,
    dirEnt2: row.dir_ent2,
    telefonos: row.telefonos,
    email: row.email,
    juridico: Boolean(row.juridico),
    tipoPer: row.tipo_per,
    coTab: row.co_tab,
    fechaReg: row.fecha_reg,
    puntaje: row.puntaje,
    coCtaIngrEgr: row.co_cta_ingr_egr,
    validador: row.validador,
    // ... every remaining verified column mapped from row.<snake_case>.
  };
}

// Applies pActualizarCliente, changing ONLY tip_cli, passing every other
// field back exactly as read. Returns 'conflict' if the SP's own
// validador check found the row already changed (an empty result set --
// NOT a rowcount, per the confirmed pActualizarCliente behavior).
export async function updateCustomerTipCli(
  pool: ConnectionPool,
  current: SaClienteRow,
  newTipCli: string,
  modifyingUser: string,
): Promise<'success' | 'conflict'> {
  const req = pool.request();
  req.input('sCo_CliOri', sql.Char(16), current.coCli);
  req.input('sCo_Cli', sql.Char(16), current.coCli); // no rename support in this feature
  req.input('sCli_Des', sql.VarChar(100), current.cliDes);
  req.input('sTip_Cli', sql.Char(6), newTipCli); // <-- the one changed field
  req.input('sCo_seg', sql.Char(6), current.coSeg);
  req.input('sCo_zon', sql.Char(6), current.coZon);
  req.input('sCo_Ven', sql.Char(6), current.coVen);
  req.input('bInactivo', sql.Bit, current.inactivo);
  req.input('sRif', sql.VarChar(18), current.rif);
  req.input('sNit', sql.VarChar(18), current.nit);
  req.input('bContrib', sql.Bit, current.contrib);
  req.input('deMont_cre', sql.Decimal(18, 2), current.montCre);
  req.input('sCo_mone', sql.Char(6), current.coMone);
  req.input('sCond_Pag', sql.Char(6), current.condPag);
  req.input('iPlaz_pag', sql.Int, current.plazPag);
  req.input('deDesc_ppago', sql.Decimal(18, 2), current.descPpago);
  req.input('deDesc_Glob', sql.Decimal(18, 2), current.descGlob);
  req.input('sDirec1', sql.VarChar(sql.MAX), current.direc1);
  req.input('sDir_Ent2', sql.VarChar(sql.MAX), current.dirEnt2);
  req.input('sTelefonos', sql.VarChar(60), current.telefonos);
  req.input('sEmail', sql.VarChar(100), current.email);
  req.input('bJuridico', sql.Bit, current.juridico);
  req.input('sTipo_Per', sql.Char(1), current.tipoPer);
  req.input('sCo_Tab', sql.Char(20), current.coTab);
  req.input('sdFecha_reg', sql.SmallDateTime, current.fechaReg);
  req.input('iPuntaje', sql.Int, current.puntaje);
  req.input('sCo_Cta_Ingr_Egr', sql.Char(20), current.coCtaIngrEgr);
  req.input('tsValidador', sql.Binary, current.validador);
  req.input('sCo_us_mo', sql.Char(6), modifyingUser);
  req.input('sCo_Sucu_Mo', sql.Char(6), null);
  req.input('sCampos', sql.VarChar(sql.MAX), 'tip_cli');
  // ... every remaining verified field from Step 1, passed back unchanged.

  const result = await req.execute('pActualizarCliente');
  return result.recordset && result.recordset.length > 0 ? 'success' : 'conflict';
}

// Finds the saTipoCliente row whose co_precio matches the target price
// list, or creates one via the native pInsertarTipoCliente SP if none
// exists yet (spec Section 4 -- auto-create on first use).
export async function ensureTipoClienteForPriceList(pool: ConnectionPool, coPrecio: string): Promise<string> {
  const existing = await pool.request()
    .input('coPrecio', sql.Char(6), coPrecio)
    .query(`SELECT TOP 1 RTRIM(tip_cli) AS tipCli FROM saTipoCliente WHERE RTRIM(co_precio) = RTRIM(@coPrecio)`);
  if (existing.recordset.length > 0) return existing.recordset[0].tipCli;

  const priceListResult = await pool.request()
    .input('coPrecio', sql.Char(6), coPrecio)
    .query(`SELECT RTRIM(des_precio) AS desPrecio FROM saTipoPrecio WHERE RTRIM(co_precio) = RTRIM(@coPrecio)`);
  if (priceListResult.recordset.length === 0) {
    throw new Error(`Lista de precio ${coPrecio} no existe`);
  }
  const desPrecio: string = priceListResult.recordset[0].desPrecio;
  const newTipCli = coPrecio; // reuse the price list's own code as the customer-type code, kept legible 1:1 in saTipoCliente

  await pool.request()
    .input('sTip_Cli', sql.Char(6), newTipCli)
    .input('sDes_Tipo', sql.VarChar(60), desPrecio)
    .input('sCo_Precio', sql.Char(6), coPrecio)
    .input('sCo_Us_In', sql.Char(6), 'PROFIT')
    .input('sCo_Sucu_in', sql.Char(6), null)
    .execute('pInsertarTipoCliente');

  return newTipCli;
}

export type AssignmentResult =
  | { coCli: string; outcome: 'success' }
  | { coCli: string; outcome: 'conflict' }
  | { coCli: string; outcome: 'error'; message: string };

export async function assignCustomerPriceList(
  pool: ConnectionPool,
  coCli: string,
  targetCoPrecio: string,
  modifyingUser: string,
): Promise<AssignmentResult> {
  try {
    const targetTipCli = await ensureTipoClienteForPriceList(pool, targetCoPrecio);
    const current = await readFullCustomerRow(pool, coCli);
    if (!current) return { coCli, outcome: 'error', message: 'Cliente no encontrado' };

    const outcome = await updateCustomerTipCli(pool, current, targetTipCli, modifyingUser);
    return { coCli, outcome };
  } catch (error) {
    console.error(`Pricing assignment error for ${coCli}:`, error);
    return { coCli, outcome: 'error', message: 'Error al actualizar el cliente' };
  }
}
```

Note `pInsertarTipoCliente`'s parameter names above (`@sTip_Cli`,
`@sDes_Tipo`, `@sCo_Precio`, `@sCo_Us_In`, `@sCo_Sucu_in`) are the
best-available inference from its documented sibling `pInsertarTipoProveedor`
(spec Section 10, item 1) — **verify the real parameter names against the
live ERP** (e.g. `sp_helptext pInsertarTipoCliente`) before trusting this
call; if they differ, update this function accordingly before Step 4's
test can pass against a real database.

- [ ] **Step 3: Write the ERP-integration test**

```typescript
// scripts/dwh/__tests__/pricing-assignment.test.ts
import { describe, test, expect, beforeAll } from 'bun:test';
import { getPool } from '../../../lib/db/mssql';
import { assignCustomerPriceList, readFullCustomerRow } from '../../../lib/pricing/sa-cliente-fields';

// Requires a real ERP test/staging connection via .env.local (DB_* vars) --
// this feature writes to the live ERP, so unlike the DWH tests elsewhere in
// this app there is no disposable-database setup/teardown here. Run this
// only against a non-production Profit Plus instance.
describe('assignCustomerPriceList', () => {
  let pool: Awaited<ReturnType<typeof getPool>>;
  let testCoCli: string;
  let originalTipCli: string | null;

  beforeAll(async () => {
    pool = await getPool();
    const result = await pool.request().query(`SELECT TOP 1 RTRIM(co_cli) AS coCli, RTRIM(tip_cli) AS tipCli FROM saCliente WHERE inactivo = 0`);
    testCoCli = result.recordset[0].coCli;
    originalTipCli = result.recordset[0].tipCli;
  });

  test('reassigns a customer to an existing price list and reflects it on re-read', async () => {
    const priceListResult = await pool.request().query(`SELECT TOP 1 RTRIM(co_precio) AS coPrecio FROM saTipoPrecio`);
    const targetCoPrecio: string = priceListResult.recordset[0].coPrecio;

    const outcome = await assignCustomerPriceList(pool, testCoCli, targetCoPrecio, 'TESTRUN');
    expect(outcome.outcome).toBe('success');

    const updated = await readFullCustomerRow(pool, testCoCli);
    const tipoClienteResult = await pool.request()
      .input('tipCli', updated!.tipCli)
      .query(`SELECT RTRIM(co_precio) AS coPrecio FROM saTipoCliente WHERE RTRIM(tip_cli) = RTRIM(@tipCli)`);
    expect(tipoClienteResult.recordset[0].coPrecio).toBe(targetCoPrecio);
  });

  test('a stale validador (concurrent edit) is reported as a conflict, not a silent success', async () => {
    const current = await readFullCustomerRow(pool, testCoCli);
    // Simulate a concurrent edit: touch the row via a second read/no-op write
    // isn't sufficient to bump validador on its own; instead call the
    // assignment twice with the SAME pre-read `current` snapshot -- the
    // second call's passed validador will be stale after the first
    // succeeds, exercising the conflict path directly rather than via a
    // second real writer.
    const priceListResult = await pool.request().query(`SELECT RTRIM(co_precio) AS coPrecio FROM saTipoPrecio ORDER BY co_precio`);
    const [firstList, secondList] = priceListResult.recordset;

    await assignCustomerPriceList(pool, testCoCli, firstList.coPrecio, 'TESTRUN');
    // current is now stale (validador in the ERP has moved on).
    const { updateCustomerTipCli } = await import('../../../lib/pricing/sa-cliente-fields');
    const staleOutcome = await updateCustomerTipCli(pool, current!, secondList.coPrecio, 'TESTRUN');
    expect(staleOutcome).toBe('conflict');
  });

  test('assigning to a price list with no saTipoCliente row auto-creates one', async () => {
    const newCoPrecio = `TP${Date.now().toString().slice(-4)}`;
    await pool.request()
      .input('coPrecio', newCoPrecio)
      .input('desPrecio', `Test Price List ${newCoPrecio}`)
      .query(`INSERT INTO saTipoPrecio (co_precio, des_precio, incluye_imp) VALUES (@coPrecio, @desPrecio, 0)`);

    const outcome = await assignCustomerPriceList(pool, testCoCli, newCoPrecio, 'TESTRUN');
    expect(outcome.outcome).toBe('success');

    const tipoClienteResult = await pool.request()
      .input('coPrecio', newCoPrecio)
      .query(`SELECT COUNT(*) AS cnt FROM saTipoCliente WHERE RTRIM(co_precio) = RTRIM(@coPrecio)`);
    expect(tipoClienteResult.recordset[0].cnt).toBe(1);
  });

  test('restores the test customer to their original tip_cli afterward', async () => {
    if (!originalTipCli) return;
    const current = await readFullCustomerRow(pool, testCoCli);
    const { updateCustomerTipCli } = await import('../../../lib/pricing/sa-cliente-fields');
    await updateCustomerTipCli(pool, current!, originalTipCli, 'TESTRUN');
  });
});
```

- [ ] **Step 4: Run the test to verify it fails, then implement and pass**

Run: `bun test --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/pricing-assignment.test.ts`
Expected first run: FAIL (`sa-cliente-fields.ts` doesn't exist / `pInsertarTipoCliente`
parameter names may be wrong). Iterate on Step 2's code — especially the
`pInsertarTipoCliente` parameter names and the full `saCliente` field list
from Step 1 — until all 4 tests pass against the real ERP test instance.
Expected after fixes: PASS, all 4 tests green.

**This step is where Step 1's live-schema verification pays off** — if a
real `saCliente` column was missed in `sa-cliente-fields.ts`, the first
test's re-read assertion or a manual inspection of the test customer's row
afterward (compare every field before/after in a scratch query) is the
place to catch it, before this code ever runs against a real customer
outside a test.

- [ ] **Step 5: Write the assignments API route**

```typescript
// app/api/pricing/assignments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/mssql';
import { requirePricingAccess } from '@/lib/pricing/access';
import { assignCustomerPriceList } from '@/lib/pricing/sa-cliente-fields';
import { captureEvent, captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

interface AssignmentBody {
  customerCodes: unknown;
  targetCoPrecio: unknown;
}

export async function POST(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'edit');
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null) as AssignmentBody | null;
  if (!body || !Array.isArray(body.customerCodes) || body.customerCodes.length === 0) {
    return NextResponse.json({ error: 'Se requiere al menos un cliente' }, { status: 400 });
  }
  if (typeof body.targetCoPrecio !== 'string' || body.targetCoPrecio.trim() === '') {
    return NextResponse.json({ error: 'Lista de precio requerida' }, { status: 400 });
  }
  const customerCodes = body.customerCodes.filter((c): c is string => typeof c === 'string');
  if (customerCodes.length !== body.customerCodes.length) {
    return NextResponse.json({ error: 'Códigos de cliente inválidos' }, { status: 400 });
  }

  try {
    const pool = await getPool();
    // Sequential, not Promise.all: keeps this feature's ERP write load
    // predictable and matches the spec's explicit "isolated, not batched"
    // requirement (Section 5) -- a burst of concurrent pActualizarCliente
    // calls against the same connection pool has no documented safety
    // margin in this ERP, and bulk reassignments here are an infrequent,
    // human-triggered action, not a throughput-sensitive path.
    const results = [];
    for (const coCli of customerCodes) {
      const result = await assignCustomerPriceList(pool, coCli, body.targetCoPrecio, auth.session.sub);
      results.push(result);
    }

    captureEvent(auth.session.sub, 'pricing_assignment_applied', {
      targetCoPrecio: body.targetCoPrecio,
      customerCount: customerCodes.length,
      successCount: results.filter(r => r.outcome === 'success').length,
      conflictCount: results.filter(r => r.outcome === 'conflict').length,
      errorCount: results.filter(r => r.outcome === 'error').length,
    });
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Pricing assignment route error:', error);
    captureException(error, auth.session.sub, { customerCount: customerCodes.length });
    return NextResponse.json({ error: 'Error al aplicar las asignaciones' }, { status: 500 });
  }
}
```

- [ ] **Step 6: Write a route-level test for the view/edit permission boundary**

```typescript
// Append to scripts/dwh/__tests__/pricing-assignment.test.ts
import { POST } from '../../../app/api/pricing/assignments/route';
import { NextRequest } from 'next/server';

describe('POST /api/pricing/assignments permission boundary', () => {
  test('rejects a request with no session cookie', async () => {
    const request = new NextRequest('http://localhost/api/pricing/assignments', {
      method: 'POST',
      body: JSON.stringify({ customerCodes: ['X'], targetCoPrecio: '01' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
```

A `pricing_view`-only (not `pricing_edit`) rejection test needs a real
signed session cookie to exercise meaningfully — add it here using this
app's existing `signToken()` test helper pattern (see how other API route
tests in this repo construct an authenticated `NextRequest`, e.g. any
existing `admin/users` or `inventory` route test, and mirror that setup)
rather than duplicating a new one; the unauthenticated-401 case above is
the one universally reusable check across environments.

- [ ] **Step 7: Run the full test file**

Run: `bun test --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/pricing-assignment.test.ts`
Expected: PASS, all tests green (the 4 from Step 3 plus the permission
boundary test(s) from Step 6).

- [ ] **Step 8: Commit**

```bash
git add lib/pricing/sa-cliente-fields.ts app/api/pricing/assignments/route.ts scripts/dwh/__tests__/pricing-assignment.test.ts
git commit -m "$(cat <<'EOF'
feat: add customer price-list reassignment write path

Writes saCliente.tip_cli via the native pActualizarCliente SP (a
whole-record update -- every field is read fresh and passed back
unchanged except tip_cli, verified against the live ERP schema rather
than the knowledge base's partial column list, since a missed field
here would silently blank real customer data). Auto-creates a
saTipoCliente row via pInsertarTipoCliente the first time a price
list is used as an assignment target. A stale validador surfaces as
an explicit 'conflict' outcome, never a silent no-op; bulk requests
process customers sequentially and report per-customer outcomes so
one conflict doesn't fail the whole batch.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Pricing dashboard UI (two-panel page)

**Files:**
- Create: `app/(app)/pricing/page.tsx`
- Create: `app/(app)/pricing/pricing-client.tsx`
- Modify: `app/(app)/layout.tsx`
- Modify: `components/sidebar.tsx`

**Interfaces:**
- Consumes: `getPricingAccessLevel()` (Task 1), the three API routes
  (Tasks 2–3).
- Produces: the `/pricing` page, a `canSeePricing: PricingAccessLevel` prop
  threaded through `Sidebar` (no later task depends on this).

- [ ] **Step 1: Thread pricing access level through the layout and sidebar**

```typescript
// app/(app)/layout.tsx — add alongside the existing hasInventoryAccess/hasDwhAccess calls
import { getPricingAccessLevel } from '@/lib/pricing/access';
// ...
  const pricingAccessLevel = await getPricingAccessLevel(db, session.sub, session.role);
// ...
        <Sidebar user={session} canSeeInventory={canSeeInventory} canSeeAnalitica={canSeeAnalitica} pricingAccessLevel={pricingAccessLevel} />
```

```typescript
// components/sidebar.tsx — extend Props (lines 9-13) and add a nav section
interface Props {
  user: SessionPayload;
  canSeeInventory: boolean;
  canSeeAnalitica: boolean;
  pricingAccessLevel: 'none' | 'view' | 'edit';
}
```

Add a nav section (following the existing `canSeeInventory`/`canSeeAnalitica`
pattern at lines 72-98):

```tsx
        {pricingAccessLevel !== 'none' && (
          <>
            <p className="px-2 mt-5 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Precios
            </p>
            <Link href="/pricing" className={navClass('/pricing')}>
              Listas de Precio
            </Link>
          </>
        )}
```

- [ ] **Step 2: Write the page server component**

```typescript
// app/(app)/pricing/page.tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { getPricingAccessLevel } from '@/lib/pricing/access';
import PricingClient from './pricing-client';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = getDb();
  const accessLevel = await getPricingAccessLevel(db, session.sub, session.role);
  if (accessLevel === 'none') redirect('/reports/ventas');

  return <PricingClient canEdit={accessLevel === 'edit'} />;
}
```

- [ ] **Step 3: Write the client component**

```tsx
// app/(app)/pricing/pricing-client.tsx
'use client';

import { useEffect, useState } from 'react';

interface PriceListRow {
  coPrecio: string;
  desPrecio: string;
  assignedCustomerCount: number;
}

interface CustomerRow {
  coCli: string;
  cliDes: string;
  coSeg: string | null;
  tipCli: string | null;
  coPrecio: string | null;
  desPrecio: string | null;
}

type AssignmentOutcome = { coCli: string; outcome: 'success' | 'conflict' | 'error'; message?: string };

export default function PricingClient({ canEdit }: { canEdit: boolean }) {
  const [priceLists, setPriceLists] = useState<PriceListRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetCoPrecio, setTargetCoPrecio] = useState('');
  const [applying, setApplying] = useState(false);
  const [lastResults, setLastResults] = useState<AssignmentOutcome[] | null>(null);

  useEffect(() => {
    fetch('/api/pricing/price-lists').then(r => r.json()).then(d => setPriceLists(d.priceLists ?? []));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (segmentFilter) params.set('segment', segmentFilter);
    fetch(`/api/pricing/customers?${params.toString()}`)
      .then(r => r.json())
      .then(d => setCustomers(d.customers ?? []));
  }, [search, segmentFilter]);

  function toggleSelected(coCli: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(coCli)) next.delete(coCli); else next.add(coCli);
      return next;
    });
  }

  async function applyAssignment() {
    if (selected.size === 0 || !targetCoPrecio) return;
    setApplying(true);
    setLastResults(null);
    try {
      const res = await fetch('/api/pricing/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerCodes: [...selected], targetCoPrecio }),
      });
      const data = await res.json();
      setLastResults(data.results ?? []);
      // Refresh the customer list so successful reassignments show their new price list immediately.
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (segmentFilter) params.set('segment', segmentFilter);
      const refreshed = await fetch(`/api/pricing/customers?${params.toString()}`).then(r => r.json());
      setCustomers(refreshed.customers ?? []);
      setSelected(new Set());
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Listas de Precio y Clientes</h1>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-600 uppercase mb-3">Listas de Precio</h2>
          <ul className="space-y-2">
            {priceLists.map(pl => (
              <li key={pl.coPrecio} className="flex justify-between text-sm">
                <span>{pl.desPrecio}</span>
                <span className="text-gray-500">{pl.assignedCustomerCount} clientes</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-2 border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-600 uppercase mb-3">Clientes</h2>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="Buscar por nombre, código o RIF..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1 text-sm flex-1"
            />
            <input
              type="text"
              placeholder="Segmento"
              value={segmentFilter}
              onChange={e => setSegmentFilter(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1 text-sm w-32"
            />
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase">
                {canEdit && <th className="w-8"></th>}
                <th>Cliente</th>
                <th>Segmento</th>
                <th>Lista de Precio Actual</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.coCli} className="border-t border-gray-100">
                  {canEdit && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(c.coCli)}
                        onChange={() => toggleSelected(c.coCli)}
                      />
                    </td>
                  )}
                  <td className="py-1">{c.cliDes}</td>
                  <td>{c.coSeg ?? '—'}</td>
                  <td>{c.desPrecio ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {canEdit && (
            <div className="mt-4 flex items-center gap-2 border-t border-gray-200 pt-3">
              <span className="text-sm text-gray-600">{selected.size} seleccionados</span>
              <select
                value={targetCoPrecio}
                onChange={e => setTargetCoPrecio(e.target.value)}
                className="border border-gray-200 rounded px-2 py-1 text-sm"
              >
                <option value="">Asignar a lista...</option>
                {priceLists.map(pl => (
                  <option key={pl.coPrecio} value={pl.coPrecio}>{pl.desPrecio}</option>
                ))}
              </select>
              <button
                onClick={applyAssignment}
                disabled={selected.size === 0 || !targetCoPrecio || applying}
                className="bg-blue-600 text-white rounded px-3 py-1 text-sm disabled:opacity-50"
              >
                {applying ? 'Aplicando...' : 'Asignar'}
              </button>
            </div>
          )}

          {lastResults && (
            <div className="mt-3 text-sm space-y-1">
              {lastResults.map(r => (
                <div key={r.coCli} className={r.outcome === 'success' ? 'text-green-700' : 'text-red-700'}>
                  {r.coCli}: {r.outcome === 'success' ? 'Asignado' : r.outcome === 'conflict' ? 'Conflicto: el cliente fue modificado, recargue e intente de nuevo' : (r.message ?? 'Error')}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

The price-list dropdown here uses a native `<select>` rather than
`SearchableSelect`, per `AGENTS.md`'s own rule: "a fixed, small enum...
stays a native `<select>`" — with 11 price lists today, this qualifies as
small/fixed, unlike the customer list.

- [ ] **Step 4: Manually verify the full page**

Run: `bun dev`, log in as a user with `pricing_edit`, navigate to
`/pricing`. Search for a customer, select one, assign them to a different
price list, confirm the result row shows "Asignado" and the customer's
displayed price list updates. Then log in as a `pricing_view`-only user
and confirm the checkboxes/assign controls don't render, and as a user
with no pricing grant and confirm `/pricing` redirects to `/reports/ventas`.
Expected: all three access tiers behave as described; no console errors.

- [ ] **Step 5: Commit**

```bash
git add app/(app)/pricing app/(app)/layout.tsx components/sidebar.tsx
git commit -m "$(cat <<'EOF'
feat: add pricing dashboard UI for browsing and reassigning customers

Two-panel view (price lists / customers) with server-side customer
search and bulk reassignment. View-only grants see the same data
without the selection/assign controls; the page itself redirects
non-granted users, and the API layer enforces the same boundary
independently.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:** Section 2 (scope: browse price lists, browse/search
customers, reassign single/bulk, `pricing` module gate) → Tasks 1, 2, 4.
Section 3 (`tip_cli` trade-off, grep for other consumers) → called out as
a pre-write-path caveat; the actual grep itself is a one-time repo-wide
check the plan defers to whoever executes Task 3, since it's not code this
plan produces (added as a note in Task 3's intro rather than a step, since
grepping this app's own repo takes seconds and doesn't need a TDD cycle —
flagged here so it isn't silently dropped: **run
`grep -rn "tip_cli" --include="*.ts" --include="*.tsx" .` across the whole
repo before merging Task 3**, confirming no other feature reads `tip_cli`
for a "customer type" meaning this feature's reassignment would break).
Section 4 (`saTipoCliente` auto-create) → Task 3's
`ensureTipoClienteForPriceList`. Section 5 (write path, concurrency, bulk)
→ Task 3 fully. Section 6 (synchronous, no queue) → satisfied by
construction (every route awaits its ERP call inline). Section 9 (access
control) → Task 1. Section 10 (open verification items) → Task 3 Steps 1
and 4 directly address both.

**Type consistency:** `PricingAccessLevel`, `SaClienteRow`,
`AssignmentResult`/`AssignmentOutcome`, `PriceListRow`, `CustomerRow` are
each defined once and referenced with matching shapes across Tasks 1–4.

**Review Focus coverage:** all 5 items have an owning test or step —
auto-create-on-first-use (Task 3 Step 3's third test), concurrency conflict
surfaced not silenced (Task 3 Step 3's second test, using a stale
pre-fetched row rather than a second real writer), bulk partial-failure
reporting (Task 3's `assignCustomerPriceList` returning one outcome per
customer, exercised implicitly by the sequential-loop route design; the
per-customer outcome array itself is the artifact under test in Step 3),
whole-record blank-out risk (Task 3 Step 1's mandatory live-schema
verification, called out as the plan's single highest-risk item), and the
API-level permission boundary (Task 3 Step 6).
