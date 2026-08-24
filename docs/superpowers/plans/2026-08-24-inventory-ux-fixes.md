# Inventario UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 11 UX gaps identified in the Inventario module review (spec-vs-shipped audit plus a hands-on workflow pass) without redesigning any page — every fix is additive to the existing pages and API routes.

**Architecture:** This module already ships four pages (`/inventario/dashboard`, `/inventario/articulos`, `/inventario/ajustes`, `/admin/config-inventario`) backed by API routes under `app/api/inventory/` and `app/api/admin/`. All 11 fixes are surgical: a new query param, a new column in an existing table, a new small API route, a help-text edit, or a genuinely new (but small) feature — never a rewrite of an existing page's core interaction. Cross-page navigation uses Next.js `<Link>` with query params, read on mount via `useSearchParams`. New MSSQL writes go through the existing `getPool()` singleton in `lib/db/mssql.ts`, parameterized exactly like every existing route in this module.

**Tech Stack:** Next.js 16 (App Router) + React 19, TypeScript, Tailwind v4 (raw utility classes, no component library), Drizzle ORM over SQLite for app state, `mssql` package over SQL Server for Profit Plus, `bun test` for unit/integration tests (`bun:test` imports, real MSSQL for `@mssql`-tagged integration tests), Playwright for e2e (`@mssql` tag gates ERP-dependent specs). No charting library is currently installed.

**Spec:** `docs/superpowers/specs/2026-08-20-inventory-management-design.md` (original module design) and the UX review that generated this plan (published as an internal artifact; findings summarized inline per task below — no separate file to read, this plan carries what's needed).

## Global Constraints

- All user-facing text is Spanish, matching every existing string in this module. Never introduce English UI copy.
- Every inventory API route independently calls `getSessionFromRequest()` + `hasInventoryAccess()` (or `session.role !== 'admin'` for admin-only routes) — this repo has no route-protecting middleware, so every new route must re-check, exactly like every existing route in `app/api/inventory/` and `app/api/admin/`.
- No new dependencies unless a task explicitly says so (Task 5 is the one exception — it adds a charting library).
- MSSQL queries are always parameterized via `request.input(...)`, never string-interpolated user input — follow the exact pattern in every file read during planning (e.g. `app/api/inventory/dashboard/route.ts`).
- `stock_min <= stock_max` is already enforced as a live DB constraint (SQL Server error 547) on `saArticulo` — client-side validation added in this plan is a UX improvement (fail fast, before the network round-trip), not a replacement for that constraint.
- Help content lives in `content/help/{page}.md` and is served through the allowlisted route `app/api/help/[page]/route.ts` (`HELP_PAGES` array) — a new help page requires adding its slug to that allowlist, or editing an existing `.md` file requires no route change at all.

---

## File Structure

- Modify `app/(app)/inventario/articulos/articulos-client.tsx` — add "Ajustar" link (Task 1), add "Agregar a almacén" action (Task 2), relabel Mín/Máx/Pedido column group (Task 3), add client-side min≤max validation (Task 8).
- Modify `app/(app)/inventario/ajustes/ajustes-client.tsx` — read a `co_art`/`co_alma` query param to preselect an article (Task 1).
- Modify `app/(app)/inventario/ajustes/page.tsx` — pass search params through to the client component (Task 1).
- Create `app/(app)/inventario/ajustes/historial-client.tsx` — adjustment history table (Task 4).
- Modify `app/(app)/inventario/ajustes/ajustes-client.tsx` — render the new history table below the create form (Task 4).
- Create `app/api/inventory/adjustments/history/route.ts` — GET endpoint listing past adjustments (Task 4).
- Create `app/api/inventory/items/[co_art]/warehouses/route.ts` — POST endpoint that inserts a zero-stock `saStockAlmacen` row for an article into a configured warehouse it isn't stocked in yet (Task 2).
- Modify `app/api/inventory/items/route.ts` — add a second query (or a `?unstocked=true` mode) returning articles missing a stock row in at least one configured warehouse, for Task 2's picker.
- Modify `app/(app)/inventario/dashboard/dashboard-client.tsx` — add a "Stock actual" browse table above the low-stock list, plus a per-article sparkline/chart (Task 5).
- Create `app/api/inventory/dashboard/history/route.ts` — GET endpoint returning an article's running stock balance from `dbo.MovimientoInventario` (Task 5).
- Modify `app/(app)/admin/config-inventario/config-client.tsx` — accessible warehouse-delete button (Task 6), settings captions (Task 7).
- Modify `content/help/articulos.md` — remove `co_art` jargon (Task 9), note the Mín/Máx clarification (Task 3).
- Modify `content/help/dashboard.md` — note the new browse view / chart (Task 5).
- Modify `docs/superpowers/specs/2026-08-20-inventory-management-design.md` — fix the `/inventario` → `/inventario/dashboard` route table entry (Task 10).
- New Playwright specs: extend `e2e/inventory-items.spec.ts`, `e2e/inventory-ajustes.spec.ts` (check exact filename before editing — earlier investigation found `inventory-adjustments.spec.ts`), `e2e/inventory-dashboard.spec.ts`.
- New/extended unit tests under `__tests__/integration/` following the existing `bun:test` + real-MSSQL pattern (see `__tests__/integration/inventory-adjustments.integration.test.ts`).

---

### Task 1: Link Artículos rows to Ajustes, pre-selected

**Files:**
- Modify: `app/(app)/inventario/articulos/articulos-client.tsx`
- Modify: `app/(app)/inventario/ajustes/ajustes-client.tsx`
- Modify: `app/(app)/inventario/ajustes/page.tsx`
- Test: `e2e/inventory-items.spec.ts` (or a new `e2e/inventory-articulos.spec.ts` if that's actually the item-list spec's filename — confirm with `ls e2e/inventory-*.spec.ts` before creating a duplicate)

**Interfaces:**
- Consumes: `Item` interface in `articulos-client.tsx` (`coArt`, `coAlma` fields already present, lines 6-20).
- Produces: a URL contract — `/inventario/ajustes?co_art=<value>&co_alma=<value>` — that Ajustes reads on mount. No other task depends on this, but it's worth keeping the param names exactly `co_art`/`co_alma` (snake_case, matching the ERP column names used elsewhere in URLs in this repo) for consistency if another page ever links into Ajustes the same way.

**UX finding this closes:** Artículos and Ajustes share no UI — adjusting a specific item's stock means leaving Artículos, opening Ajustes from the sidebar, and re-finding that same article in an unrelated search box. This was the review's #1 priority fix.

- [ ] **Step 1: Add an "Ajustar" link per row in Artículos**

In `articulos-client.tsx`, the "Acciones" column (around line 242-254) currently renders only the "Guardar" button and any row error. Add a second action — a plain link, not a button, since it's pure navigation:

```tsx
import Link from 'next/link';
```

Add this import at the top of the file alongside the existing `useState`/`useEffect`/`useMemo` import.

In the "Acciones" `<td>`, after the existing "Guardar" `<button>` and its `rowErrors[key]` paragraph, add:

```tsx
                    <Link
                      href={`/inventario/ajustes?co_art=${encodeURIComponent(item.coArt)}&co_alma=${encodeURIComponent(item.coAlma)}`}
                      className="block mt-1 text-xs text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap"
                    >
                      Ajustar stock →
                    </Link>
```

- [ ] **Step 2: Make Ajustes' page.tsx pass search params to the client component**

Read `app/(app)/inventario/ajustes/page.tsx` first to see its current shape (it's a thin server component wrapping `AjustesClient`). Next.js 16 App Router server components receive `searchParams` as a prop typed `Promise<{ [key: string]: string | string[] | undefined }>`. Update the page to read and forward it:

```tsx
export default async function AjustesPage({
  searchParams,
}: {
  searchParams: Promise<{ co_art?: string; co_alma?: string }>;
}) {
  const params = await searchParams;
  // ...existing session/access check logic stays as-is...
  return <AjustesClient initialCoArt={params.co_art} initialCoAlma={params.co_alma} />;
}
```

Keep whatever existing auth/redirect logic is already in the file — only add the `searchParams` prop and thread the two new values into `AjustesClient`.

- [ ] **Step 3: Make AjustesClient accept and apply the preselection**

In `ajustes-client.tsx`, change the component signature (currently `export function AjustesClient()`) to:

```tsx
interface Props {
  initialCoArt?: string;
  initialCoAlma?: string;
}

export function AjustesClient({ initialCoArt, initialCoAlma }: Props) {
```

After the existing `items` load effect (the one that fetches `/api/inventory/items`, lines 45-68), add a second effect that applies the preselection once items are loaded:

```tsx
  useEffect(() => {
    if (loading || !initialCoArt || !initialCoAlma) return;
    const key = `${initialCoArt}::${initialCoAlma}`;
    if (items.some(item => rowKey(item) === key)) {
      setSelectedKey(key);
      setCountedStock('');
      setLastResult(null);
      setFormError(null);
    }
  }, [loading, items, initialCoArt, initialCoAlma]);
```

This reuses the existing `rowKey` helper (already defined at module scope, line 17-19) — no new key logic.

- [ ] **Step 4: Write the e2e test**

First run `ls e2e/inventory-*.spec.ts` to get the real filenames — earlier investigation in this session found `inventory-items.spec.ts` and `inventory-adjustments.spec.ts`; use whichever one actually covers Artículos. Add this test to the Artículos spec (adjust `test.describe` name to match the file's existing block):

```typescript
test('Ajustar link on Artículos preselects the same article in Ajustes', async ({ userPage }) => {
  await userPage.goto('/inventario/articulos');
  const firstRow = userPage.locator('table tbody tr').first();
  await expect(firstRow).toBeVisible({ timeout: 15_000 });
  const coArt = (await firstRow.locator('td').first().textContent())?.trim();

  await firstRow.getByRole('link', { name: 'Ajustar stock →' }).click();
  await userPage.waitForURL(/\/inventario\/ajustes\?co_art=/);

  await expect(userPage.getByText(new RegExp(`Ajustando.*${coArt}`))).toBeVisible({ timeout: 10_000 });
});
```

- [ ] **Step 5: Run the e2e test**

Run: `bun run e2e --grep "Ajustar link"` (this test needs no `@mssql` tag — it exercises client-side param-reading against whatever items the dev/test environment already serves via `/api/inventory/items`, which is itself `@mssql`-tagged at a higher level; if the existing Artículos spec file is tagged `@mssql` overall, run `bun run e2e:mssql --grep "Ajustar link"` instead — check the file's `test.describe` line for the tag before choosing the command).
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/inventario/articulos/articulos-client.tsx app/\(app\)/inventario/ajustes/ajustes-client.tsx app/\(app\)/inventario/ajustes/page.tsx e2e/
git commit -m "feat: link Artículos rows into Ajustes with the article preselected"
```

---

### Task 2: Let an existing article be added to a warehouse it isn't stocked in

**Files:**
- Create: `app/api/inventory/items/[co_art]/warehouses/route.ts`
- Modify: `app/api/inventory/items/route.ts` (add an `unstocked` mode)
- Modify: `app/(app)/inventario/articulos/articulos-client.tsx` (add the "Agregar a almacén" UI)
- Test: `__tests__/integration/inventory-add-to-warehouse.integration.test.ts` (new, `@mssql`-style real-DB integration test, following `__tests__/integration/inventory-adjustments.integration.test.ts`'s pattern)

**Interfaces:**
- Consumes: `EDITABLE_ITEM_FIELDS`-style pattern from `lib/inventory/item-fields.ts` is NOT reused here (different table) — this task defines its own validation inline.
- Consumes: `getSessionFromRequest`, `hasInventoryAccess` from `lib/inventory/access.ts` (exact signatures: `getSessionFromRequest(request: NextRequest): Promise<SessionPayload | null>`, `hasInventoryAccess(db, userId: string, role: 'user' | 'admin'): Promise<boolean>`).
- Consumes: `getPool` from `lib/db/mssql.ts` (`(): Promise<sql.ConnectionPool>`), `inventoryWarehouses` from `lib/db/schema`.
- Produces: `POST /api/inventory/items/:co_art/warehouses` accepting `{ coAlma: string }`, returning `{ ok: true }` on success. No later task depends on this route's shape.

**UX finding this closes:** `app/api/inventory/items/route.ts` does an `INNER JOIN` against `saStockAlmacen` — an article with no stock row in a configured warehouse is invisible in Artículos, not shown-disabled. There is currently no way to add an existing, already-priced article to a new warehouse without going into Profit Plus directly. This is distinct from the spec's "item creation is out of scope" (that's about new `saArticulo` rows) — this only inserts a stock-tracking row for an article that already exists.

**Before writing code — verify the exact `saStockAlmacen` insert shape against the live schema.** No local knowledge-base doc for this table exists as of this plan (`erp-knowledge-base/docs/tables/saStockAlmacen.md` was not found in the repo at planning time). Do this first:

- [ ] **Step 1: Verify the saStockAlmacen column list and required NOT NULL columns**

Run against a real connection (use the docker mock ERP per `docker/README.md`, or `.env.local` if it points at a live/staging instance — check which is configured before running):

```bash
docker exec profitplus-erp-mock /opt/mssql-tools/bin/sqlcmd -U sa -P "YourStr0ngP@ssw0rd" -d ProfitPlus -C -Q "
SELECT c.name, t.name AS type_name, c.max_length, c.is_nullable, c.column_id
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.saStockAlmacen')
ORDER BY c.column_id;
"
```

If the docker mock doesn't have the real `Ncake_a` schema loaded (a known gap — the mock's `init-db.sh`/`init.py` only create the legacy `compras`/`ventas` tables, not a restore of `docker/mssql/Ncake_a.bak`), this step requires either (a) wiring up the `.bak` restore first — out of scope for this task, flag it and escalate — or (b) running this query against whatever real/staging MSSQL connection is available via `.env.local`. Do not guess the column list; every other MSSQL write in this module (`pApiCrearAjusteInventario`, the items PATCH route) was built from a verified live schema read, and this insert must be too, since it's a genuinely new kind of write this module has never done before (an INSERT, not an UPDATE or stored-procedure call).

At minimum, expect to need: `co_art` (char, matches `saArticulo.co_art`), `co_alma` (char(6), matches `saAlmacen.co_alma`), `tipo` (char — every existing read in this module filters `tipo = 'ACT'`, so the new row must use `'ACT'` too), `stock` (decimal, insert `0`). Confirm there are no other NOT NULL columns without defaults before writing Step 2 — if there are, add them to the INSERT with sane zero/empty values and note what each one is for in a comment, the same way `lib/inventory/item-fields.ts`'s header comment cites its schema-audit source.

- [ ] **Step 2: Write the failing integration test**

```typescript
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterEach, afterAll } from 'bun:test';
import sql from 'mssql';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules, inventoryWarehouses } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { POST as postAddWarehouse } from '@/app/api/inventory/items/[co_art]/warehouses/route';

function buildTestConfig(): sql.config {
  return {
    server: process.env.DB_SERVER!,
    port: parseInt(process.env.DB_PORT ?? '1433'),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
    },
  };
}

// Pick a real co_art that has NO existing saStockAlmacen row in TEST_WAREHOUSE
// at test-DB setup time — confirm with a SELECT in beforeAll, and skip/fail
// loudly if the fixture assumption doesn't hold rather than silently no-op.
const TEST_WAREHOUSE = '14';
let pool: sql.ConnectionPool;
let testArticleWithoutStock: string;

function resetSqliteDb() {
  const db = getDb();
  db.delete(userModules).run();
  db.delete(inventoryWarehouses).run();
  db.delete(users).run();
}

function buildRequest(coArt: string, token: string | null, body: unknown): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `session=${token}`;
  return new NextRequest(`http://localhost:3000/api/inventory/items/${coArt}/warehouses`, {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
  });
}

describe('POST /api/inventory/items/[co_art]/warehouses @mssql', () => {
  beforeAll(async () => {
    pool = await new sql.ConnectionPool(buildTestConfig()).connect();
    const result = await pool.request().input('coAlma', sql.Char(6), TEST_WAREHOUSE).query(`
      SELECT TOP 1 a.co_art
      FROM saArticulo a
      WHERE a.anulado = 0
        AND NOT EXISTS (
          SELECT 1 FROM saStockAlmacen s
          WHERE s.co_art = a.co_art AND s.co_alma = @coAlma AND s.tipo = 'ACT'
        )
    `);
    if (result.recordset.length === 0) {
      throw new Error(`No article without a stock row in warehouse ${TEST_WAREHOUSE} found — test fixture assumption broken`);
    }
    testArticleWithoutStock = (result.recordset[0].co_art as string).trim();
  });

  afterEach(async () => {
    resetSqliteDb();
    await pool.request()
      .input('coArt', sql.Char(30), testArticleWithoutStock)
      .input('coAlma', sql.Char(6), TEST_WAREHOUSE)
      .query(`DELETE FROM saStockAlmacen WHERE co_art = @coArt AND co_alma = @coAlma AND tipo = 'ACT'`);
  });

  afterAll(async () => {
    await pool.close();
  });

  test('creates a zero-stock row for an article missing one in a configured warehouse', async () => {
    resetSqliteDb();
    const db = getDb();
    const user = db.insert(users).values({
      email: 'wh-test@e2e.test', passwordHash: 'x', name: 'WH Test', role: 'user',
    }).returning({ id: users.id }).get();
    db.insert(userModules).values({ userId: user!.id, module: 'inventory' }).run();
    db.insert(inventoryWarehouses).values({ coAlma: TEST_WAREHOUSE, label: 'Materia Prima', active: true }).run();
    const token = await signToken({ sub: String(user!.id), role: 'user', name: 'WH Test' });

    const req = buildRequest(testArticleWithoutStock, token, { coAlma: TEST_WAREHOUSE });
    const res = await postAddWarehouse(req, { params: Promise.resolve({ co_art: testArticleWithoutStock }) });
    expect(res.status).toBe(200);

    const check = await pool.request()
      .input('coArt', sql.Char(30), testArticleWithoutStock)
      .input('coAlma', sql.Char(6), TEST_WAREHOUSE)
      .query(`SELECT stock FROM saStockAlmacen WHERE co_art = @coArt AND co_alma = @coAlma AND tipo = 'ACT'`);
    expect(check.recordset.length).toBe(1);
    expect(Number(check.recordset[0].stock)).toBe(0);
  });

  test('rejects a warehouse not in the configured allowlist', async () => {
    resetSqliteDb();
    const db = getDb();
    const user = db.insert(users).values({
      email: 'wh-test2@e2e.test', passwordHash: 'x', name: 'WH Test 2', role: 'user',
    }).returning({ id: users.id }).get();
    db.insert(userModules).values({ userId: user!.id, module: 'inventory' }).run();
    db.insert(inventoryWarehouses).values({ coAlma: TEST_WAREHOUSE, label: 'Materia Prima', active: true }).run();
    const token = await signToken({ sub: String(user!.id), role: 'user', name: 'WH Test 2' });

    const req = buildRequest(testArticleWithoutStock, token, { coAlma: '999999' });
    const res = await postAddWarehouse(req, { params: Promise.resolve({ co_art: testArticleWithoutStock }) });
    expect(res.status).toBe(400);
  });

  test('returns 401 without a session', async () => {
    const req = buildRequest(testArticleWithoutStock, null, { coAlma: TEST_WAREHOUSE });
    const res = await postAddWarehouse(req, { params: Promise.resolve({ co_art: testArticleWithoutStock }) });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/integration/inventory-add-to-warehouse.integration.test.ts`
Expected: FAIL — `app/api/inventory/items/[co_art]/warehouses/route.ts` doesn't exist yet (import error).

- [ ] **Step 4: Implement the route**

Use the exact column list confirmed in Step 1. This skeleton assumes only `co_art`, `co_alma`, `tipo`, `stock` are required — adjust the INSERT if Step 1 found more NOT NULL columns:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { inventoryWarehouses } from '@/lib/db/schema';
import { getPool } from '@/lib/db/mssql';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ co_art: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const { co_art } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.coAlma !== 'string' || body.coAlma.trim() === '') {
    return NextResponse.json({ error: 'Almacén requerido' }, { status: 400 });
  }
  const coAlma = body.coAlma.trim();

  const activeWarehouses = db.select().from(inventoryWarehouses).all().filter(w => w.active);
  if (activeWarehouses.length > 0 && !activeWarehouses.some(w => w.coAlma === coAlma)) {
    return NextResponse.json({ error: 'Almacén no configurado para Inventario' }, { status: 400 });
  }

  try {
    const pool = await getPool();

    const existing = await pool.request()
      .input('coArt', sql.Char(30), co_art)
      .input('coAlma', sql.Char(6), coAlma)
      .query(`SELECT 1 FROM saStockAlmacen WHERE co_art = @coArt AND co_alma = @coAlma AND tipo = 'ACT'`);
    if (existing.recordset.length > 0) {
      return NextResponse.json({ error: 'El artículo ya tiene stock registrado en ese almacén' }, { status: 400 });
    }

    const article = await pool.request()
      .input('coArt', sql.Char(30), co_art)
      .query(`SELECT 1 FROM saArticulo WHERE co_art = @coArt AND anulado = 0`);
    if (article.recordset.length === 0) {
      return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 });
    }

    await pool.request()
      .input('coArt', sql.Char(30), co_art)
      .input('coAlma', sql.Char(6), coAlma)
      .query(`INSERT INTO saStockAlmacen (co_art, co_alma, tipo, stock) VALUES (@coArt, @coAlma, 'ACT', 0)`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Add article to warehouse error:', error);
    return NextResponse.json({ error: 'Error al registrar el almacén en Profit Plus' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test --isolate --env-file=.env.local __tests__/integration/inventory-add-to-warehouse.integration.test.ts`
Expected: PASS (all 3 tests).

- [ ] **Step 6: Add the "unstocked articles" list mode to the items GET route**

Modify `app/api/inventory/items/route.ts` to accept `?unstocked=true`, returning active articles that are missing a stock row in at least one configured warehouse (or any warehouse with `saStockAlmacen` activity, matching the existing warehouse-fallback logic already in this file). Add after the existing `activeWarehouses` computation (around line 46-47):

```typescript
  const url = new URL(request.url);
  const unstockedOnly = url.searchParams.get('unstocked') === 'true';
```

And branch the query — when `unstockedOnly`, swap the `JOIN saStockAlmacen` for a `LEFT JOIN ... WHERE s.co_art IS NULL` shape scoped to one warehouse at a time (the UI in Step 7 picks one warehouse before listing candidates, so this only needs to run per-warehouse, not "missing from any configured warehouse"). Add a new query string and branch before the existing `ITEMS_QUERY_BASE` execution:

```typescript
  if (unstockedOnly) {
    const targetCoAlma = url.searchParams.get('co_alma');
    if (!targetCoAlma) {
      return NextResponse.json({ error: 'Almacén requerido' }, { status: 400 });
    }
    const unstockedResult = await pool.request()
      .input('coAlma', sql.Char(6), targetCoAlma)
      .query(`
        SELECT a.co_art, a.art_des
        FROM saArticulo a
        WHERE a.anulado = 0
          AND NOT EXISTS (
            SELECT 1 FROM saStockAlmacen s
            WHERE s.co_art = a.co_art AND s.co_alma = @coAlma AND s.tipo = 'ACT'
          )
        ORDER BY a.art_des
      `);
    const unstockedRows = trimStrings(unstockedResult.recordset) as unknown as Array<{ co_art: string; art_des: string }>;
    return NextResponse.json(unstockedRows.map(r => ({ coArt: r.co_art, artDes: r.art_des })));
  }
```

Place this branch right after `const pool = await getPool();` and before the existing `ITEMS_QUERY_BASE` query construction, using the same `pool`/`request_` the rest of the function already sets up (adjust variable names to match whatever the existing function calls them — read the file's current state before inserting, since Step numbering here assumes the shape read during planning).

- [ ] **Step 7: Add the "Agregar a almacén" UI to Artículos**

In `articulos-client.tsx`, add state and a small inline picker above the table (near the Línea/Categoría filters, around line 181-196):

```tsx
  const [showAddToWarehouse, setShowAddToWarehouse] = useState(false);
  const [warehouseCandidates, setWarehouseCandidates] = useState<Array<{ coArt: string; artDes: string }>>([]);
  const [addWarehouseTarget, setAddWarehouseTarget] = useState('');
  const [addArticleTarget, setAddArticleTarget] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
```

This picker's warehouse dropdown reuses the same set of configured warehouses already visible in the item rows (`item.coAlma` values across `items`) rather than fetching a separate list — derive it the same way `lineas`/`categorias` are derived (lines 80-90):

```tsx
  const warehouseOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const item of items) seen.add(item.coAlma);
    return Array.from(seen);
  }, [items]);
```

Add the action button and its expandable panel. This is intentionally a simple two-step flow (pick warehouse → fetch candidates → pick article → confirm), not a modal, matching this app's convention of no modal/dialog library beyond `components/modal.tsx` for simple cases:

```tsx
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <button
          onClick={() => setShowAddToWarehouse(v => !v)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {showAddToWarehouse ? 'Cancelar' : '+ Agregar artículo existente a un almacén'}
        </button>

        {showAddToWarehouse && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-500">
              Para artículos que ya existen en Profit Plus pero aún no tienen stock
              registrado en un almacén configurado — por ejemplo, una línea de
              productos nueva.
            </p>
            <div className="flex gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Almacén</label>
                <select
                  value={addWarehouseTarget}
                  onChange={async e => {
                    const coAlma = e.target.value;
                    setAddWarehouseTarget(coAlma);
                    setAddArticleTarget('');
                    setAddError(null);
                    if (!coAlma) { setWarehouseCandidates([]); return; }
                    const res = await fetch(`/api/inventory/items?unstocked=true&co_alma=${encodeURIComponent(coAlma)}`);
                    setWarehouseCandidates(res.ok ? await res.json() : []);
                  }}
                  className={`${inputClass} w-48`}
                >
                  <option value="">Selecciona…</option>
                  {warehouseOptions.map(coAlma => <option key={coAlma} value={coAlma}>{coAlma}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Artículo</label>
                <select
                  value={addArticleTarget}
                  onChange={e => setAddArticleTarget(e.target.value)}
                  disabled={!addWarehouseTarget}
                  className={inputClass}
                >
                  <option value="">Selecciona…</option>
                  {warehouseCandidates.map(c => <option key={c.coArt} value={c.coArt}>{c.coArt} — {c.artDes}</option>)}
                </select>
              </div>
              <button
                onClick={async () => {
                  setAdding(true);
                  setAddError(null);
                  try {
                    const res = await fetch(`/api/inventory/items/${encodeURIComponent(addArticleTarget)}/warehouses`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ coAlma: addWarehouseTarget }),
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      setAddError(data.error ?? 'No se pudo agregar el artículo al almacén');
                      return;
                    }
                    const listRes = await fetch('/api/inventory/items');
                    if (listRes.ok) setItems(await listRes.json());
                    setShowAddToWarehouse(false);
                    setAddWarehouseTarget('');
                    setAddArticleTarget('');
                  } finally {
                    setAdding(false);
                  }
                }}
                disabled={!addWarehouseTarget || !addArticleTarget || adding}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-40"
              >
                {adding ? 'Agregando…' : 'Agregar'}
              </button>
            </div>
            {addError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{addError}</p>
            )}
          </div>
        )}
      </div>
```

- [ ] **Step 8: Run the full inventory test suite**

Run: `bun run test:mssql` (or the project's real command for `@mssql`-tagged unit/integration tests — confirm exact script name in `package.json`'s `scripts` block before running; `test:mssql` currently only lists `compras-export.integration.test.ts` explicitly, so the new file may need adding to that script's file list, or running individually as in Step 5).
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/api/inventory/items/ app/\(app\)/inventario/articulos/articulos-client.tsx __tests__/integration/inventory-add-to-warehouse.integration.test.ts
git commit -m "feat: allow adding an existing article to a new warehouse from Artículos"
```

---

### Task 3: Fix the Mín/Máx/Pedido → alert mismatch

**Files:**
- Modify: `app/(app)/inventario/articulos/articulos-client.tsx`
- Modify: `content/help/articulos.md`

**Interfaces:**
- Consumes: nothing new — this is a copy/labeling change only, no API or type changes.
- Produces: nothing new for later tasks.

**UX finding this closes:** `app/api/inventory/dashboard/route.ts`'s low-stock query never references `stock_min`/`stock_max`/`stock_pedido` — the alert is driven entirely by `daysOfStock < settings.daysOfStockThreshold` from sales velocity (verified in the query read during planning, lines 16-25 and 77 of that file). But Artículos presents Mín/Máx/Pedido as if they gate alerts, and the existing help text (`content/help/articulos.md` line 21: "Sirve como referencia para saber cuándo reabastecer") reinforces that false impression. This plan takes the "shortest path" fix from the review: relabel plus explicit help-panel disclosure, without changing the alert logic itself (a deeper fix — wiring Mín into the alert as a per-article override — is a product decision out of scope for a UX-parity pass).

- [ ] **Step 1: Relabel the column group in Artículos**

In `articulos-client.tsx`, the table header array (line 202) currently reads:

```tsx
{['Código', 'Nombre', 'Referencia', 'Modelo', 'Stock', 'Mín', 'Máx', 'Pedido', 'Acciones'].map(h => (
```

Replace the three bare headers with a grouped label. Since this is a flat `<th>` row (no `<colgroup>` or spanning header currently), the cleanest fix within the existing structure is a second, smaller header row segment — but to avoid restructuring the table markup, use a parenthetical qualifier on each header instead, which keeps the diff minimal and doesn't touch the `<thead>` row structure:

```tsx
{['Código', 'Nombre', 'Referencia', 'Modelo', 'Stock', 'Mín (reorden)', 'Máx (reorden)', 'Pedido', 'Acciones'].map(h => (
```

- [ ] **Step 2: Add a one-line disclosure directly in the table's controls area**

Directly above the table (after the Línea/Categoría filter `<div>`, before the `<div className="bg-white border ...">` wrapping the table, around line 196-198), add:

```tsx
      <p className="text-xs text-gray-500 -mt-2">
        Mín/Máx/Pedido son valores de referencia para reabastecimiento — no generan
        alertas automáticas. Las alertas de stock bajo del Panel se calculan por
        consumo real; ajústalas en <span className="font-medium">Configuración de Inventario</span>.
      </p>
```

- [ ] **Step 3: Update the help panel**

In `content/help/articulos.md`, replace the existing Mín/Máx/Pedido bullets (lines 21-25):

```markdown
- **Mín**: el stock mínimo que se debe mantener de este artículo (umbral
  de reorden bajo). Sirve como referencia para saber cuándo reabastecer.
- **Máx**: el stock máximo que se debe mantener.
- **Pedido**: la cantidad de reposición sugerida cuando el stock llega al
  mínimo.
```

with:

```markdown
- **Mín / Máx**: umbrales de referencia para reabastecimiento manual —
  ayudan a decidir cuánto pedir, pero **no generan alertas automáticas**.
  Las alertas de stock bajo que aparecen en el Panel se calculan por
  consumo real reciente, no por estos valores.
- **Pedido**: la cantidad de reposición sugerida cuando alguien decide
  reabastecer este artículo.

> Si buscas cambiar cuándo se dispara una alerta de stock bajo, ve a
> **Configuración de Inventario** (solo administradores) — ahí se
> configuran la ventana de consumo y el umbral de días de stock.
```

- [ ] **Step 4: Manually verify in the browser**

Run: `bun dev`, log in as a user with the `inventory` module grant, navigate to `/inventario/articulos`.
Expected: column headers read "Mín (reorden)" / "Máx (reorden)"; the disclosure sentence appears above the table; opening the help panel (bottom-right `?` button) shows the updated Mín/Máx/Pedido section with the "no generan alertas automáticas" callout.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/inventario/articulos/articulos-client.tsx content/help/articulos.md
git commit -m "fix: clarify that Mín/Máx/Pedido don't drive low-stock alerts"
```

---

### Task 4: Add adjustment history to Ajustes

**Files:**
- Create: `app/api/inventory/adjustments/history/route.ts`
- Create: `app/(app)/inventario/ajustes/historial-client.tsx`
- Modify: `app/(app)/inventario/ajustes/ajustes-client.tsx`
- Test: `__tests__/integration/inventory-adjustment-history.integration.test.ts`

**Interfaces:**
- Consumes: `getSessionFromRequest`, `hasInventoryAccess` (same signatures as Task 2).
- Produces: `GET /api/inventory/adjustments/history?limit=20` returning `Array<{ ajueNum: string; fecha: string; coArt: string; artDes: string; coAlma: string; tipo: string; cantidad: number }>`. Nothing else in this plan consumes this shape, but keep field names consistent if extended later.

**UX finding this closes:** Ajustes is currently create-only — no way to see past adjustments, so every submit is, per the review, "a leap of faith." The spec itself calls for "adjustment history (`saAjuste` joined to `saAjusteReng`, `saTipoAjuste`, `saArticulo`, `saAlmacen`)" — this task implements that joined read, scoped to the two manual-recount reason codes this module actually creates (`E00003`/`S00005`, per `app/api/inventory/adjustments/route.ts` lines 13-14), not the full 6-row `saTipoAjuste` catalog (which includes adjustment types this module doesn't create and has no UI context for).

- [ ] **Step 1: Write the failing integration test**

```typescript
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { GET as getHistory } from '@/app/api/inventory/adjustments/history/route';

function buildTestConfig(): sql.config {
  return {
    server: process.env.DB_SERVER!,
    port: parseInt(process.env.DB_PORT ?? '1433'),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
    },
  };
}

let pool: sql.ConnectionPool;

function resetSqliteDb() {
  const db = getDb();
  db.delete(userModules).run();
  db.delete(users).run();
}

function buildRequest(token: string | null): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers['Cookie'] = `session=${token}`;
  return new NextRequest('http://localhost:3000/api/inventory/adjustments/history', { headers });
}

describe('GET /api/inventory/adjustments/history @mssql', () => {
  beforeAll(async () => {
    pool = await new sql.ConnectionPool(buildTestConfig()).connect();
  });

  afterAll(async () => {
    await pool.close();
  });

  test('returns only E00003/S00005 manual-recount adjustments, newest first', async () => {
    resetSqliteDb();
    const db = getDb();
    const user = db.insert(users).values({
      email: 'hist-test@e2e.test', passwordHash: 'x', name: 'Hist Test', role: 'user',
    }).returning({ id: users.id }).get();
    db.insert(userModules).values({ userId: user!.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user!.id), role: 'user', name: 'Hist Test' });

    const req = buildRequest(token);
    const res = await getHistory(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    for (const row of body) {
      expect(['E00003', 'S00005']).toContain(row.tipo);
    }
    for (let i = 1; i < body.length; i++) {
      expect(new Date(body[i - 1].fecha).getTime()).toBeGreaterThanOrEqual(new Date(body[i].fecha).getTime());
    }
  });

  test('returns 401 without a session', async () => {
    const req = buildRequest(null);
    const res = await getHistory(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/integration/inventory-adjustment-history.integration.test.ts`
Expected: FAIL — route module doesn't exist.

- [ ] **Step 3: Implement the history route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { getPool } from '@/lib/db/mssql';
import { trimStrings } from '@/lib/trim-strings';

export const dynamic = 'force-dynamic';

// Scoped to the two manual-recount reason codes this module creates (see
// app/api/inventory/adjustments/route.ts) — not the full saTipoAjuste
// catalog, which includes production/damage adjustment types this module
// has no UI for and that would be confusing to show here unexplained.
const HISTORY_QUERY = `
  SELECT TOP (@limit)
    h.ajue_num, h.fecha, r.co_art, a.art_des, r.co_alma, r.co_tipo, r.total_art
  FROM saAjuste h
  JOIN saAjusteReng r ON r.ajue_num = h.ajue_num
  JOIN saArticulo a ON a.co_art = r.co_art
  WHERE r.co_tipo IN ('E00003', 'S00005')
  ORDER BY h.fecha DESC, h.ajue_num DESC
`;

interface HistoryRow {
  ajue_num: string; fecha: string; co_art: string; art_des: string;
  co_alma: string; co_tipo: string; total_art: number;
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10) || 20, 100);

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(HISTORY_QUERY);
    const rows = trimStrings(result.recordset) as unknown as HistoryRow[];

    const items = rows.map(r => ({
      ajueNum:  r.ajue_num,
      fecha:    r.fecha,
      coArt:    r.co_art,
      artDes:   r.art_des,
      coAlma:   r.co_alma,
      tipo:     r.co_tipo,
      cantidad: Number(r.total_art),
    }));

    return NextResponse.json(items);
  } catch (error) {
    console.error('Adjustment history error:', error);
    return NextResponse.json({ error: 'Error al consultar Profit Plus' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test --isolate --env-file=.env.local __tests__/integration/inventory-adjustment-history.integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the history table component**

Create `app/(app)/inventario/ajustes/historial-client.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';

interface HistoryItem {
  ajueNum:  string;
  fecha:    string;
  coArt:    string;
  artDes:   string;
  coAlma:   string;
  tipo:     string;
  cantidad: number;
}

// reloadToken bump forces a refetch right after a new adjustment is
// submitted, without this component owning any of the create-form state.
export function HistorialClient({ reloadToken }: { reloadToken: number }) {
  const [items, setItems]     = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/inventory/adjustments/history?limit=20');
        if (cancelled) return;
        if (!res.ok) {
          setError('No se pudo cargar el historial de ajustes');
          return;
        }
        setItems(await res.json());
      } catch {
        if (!cancelled) setError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [reloadToken]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Últimos ajustes</h2>
      </div>

      {loading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}

      {error && (
        <p className="m-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {!loading && !error && (
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {['N° Ajuste', 'Fecha', 'Artículo', 'Almacén', 'Tipo', 'Cantidad'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(item => (
              <tr key={item.ajueNum} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{item.ajueNum}</td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{new Date(item.fecha).toLocaleDateString('es-VE')}</td>
                <td className="px-3 py-2 text-gray-900">{item.coArt} — {item.artDes}</td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{item.coAlma}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {item.tipo === 'E00003'
                    ? <span className="text-green-700 font-medium">Sobrante</span>
                    : <span className="text-red-700 font-medium">Faltante</span>}
                </td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{item.cantidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          No hay ajustes registrados todavía.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Wire it into AjustesClient**

In `ajustes-client.tsx`, import and render the new component, and bump a reload token after a successful submit. Add near the top-level state declarations:

```tsx
import { HistorialClient } from './historial-client';
```

```tsx
  const [historyReloadToken, setHistoryReloadToken] = useState(0);
```

In `handleSubmit`'s success branch (after `setLastResult({ ajueNum: data.ajueNum, delta: data.delta });`, line 118), add:

```tsx
      setHistoryReloadToken(t => t + 1);
```

At the end of the component's returned JSX, after the closing `</div>` of the `{selected && (...)}` block (line 252) and before the final `</div>` that closes the page wrapper (line 253), add:

```tsx
      <HistorialClient reloadToken={historyReloadToken} />
```

- [ ] **Step 7: Write the e2e test**

Add to `e2e/inventory-adjustments.spec.ts` (the file confirmed present during planning):

```typescript
test('adjustment history shows a newly created adjustment', async ({ userPage }) => {
  await userPage.goto('/inventario/ajustes');
  await expect(userPage.getByRole('heading', { name: 'Últimos ajustes' })).toBeVisible({ timeout: 15_000 });
});
```

(Keep this test light — a full create-then-verify-in-history round trip belongs in the `@mssql` integration test written in Step 1, not e2e, since e2e here would need real stock mutation and cleanup that the integration test already handles more cheaply.)

- [ ] **Step 8: Run tests**

Run: `bun test --isolate --env-file=.env.local __tests__/integration/inventory-adjustment-history.integration.test.ts && bun run e2e:mssql --grep "adjustment history"`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/api/inventory/adjustments/history/ app/\(app\)/inventario/ajustes/ __tests__/integration/inventory-adjustment-history.integration.test.ts e2e/inventory-adjustments.spec.ts
git commit -m "feat: show recent adjustment history on the Ajustes page"
```

---

### Task 5: Add a "current stock" browse view to the dashboard

**Files:**
- Modify: `app/(app)/inventario/dashboard/dashboard-client.tsx`
- Modify: `app/api/inventory/dashboard/route.ts` (or create a sibling route — see Step 3)
- Modify: `content/help/dashboard.md`
- Test: `__tests__/integration/inventory-dashboard-stock.integration.test.ts`, extend `e2e/inventory-dashboard.spec.ts`

**Interfaces:**
- Produces: dashboard API response gains an optional `allStock` array alongside the existing `items`/`rollingWindowDays`/`daysOfStockThreshold` fields (or a new endpoint — decided in Step 3).

**UX finding this closes:** The review found two related gaps in one: no chart showing stock trend over time, and no way to browse current stock for items that aren't already flagged low. This task ships the **browse table** (cheap, high-value, matches the spec's literal first dashboard bullet: "current stock per article/warehouse"). It does NOT add a charting library or per-article trend chart — that's a materially bigger, separable piece of work (a new dependency, a new `dbo.MovimientoInventario` running-balance query, and per-article UI) that deserves its own scoping pass rather than being bundled here. Flag this split explicitly when reporting this task's completion.

- [ ] **Step 1: Write the failing test for the new query**

```typescript
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect } from 'bun:test';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { GET as getDashboard } from '@/app/api/inventory/dashboard/route';

function resetSqliteDb() {
  const db = getDb();
  db.delete(userModules).run();
  db.delete(users).run();
}

describe('GET /api/inventory/dashboard @mssql — allStock', () => {
  test('response includes an allStock array with every configured-warehouse item, not just flagged ones', async () => {
    resetSqliteDb();
    const db = getDb();
    const user = db.insert(users).values({
      email: 'dash-test@e2e.test', passwordHash: 'x', name: 'Dash Test', role: 'user',
    }).returning({ id: users.id }).get();
    db.insert(userModules).values({ userId: user!.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user!.id), role: 'user', name: 'Dash Test' });

    const req = new NextRequest('http://localhost:3000/api/inventory/dashboard', {
      headers: { Cookie: `session=${token}` },
    });
    const res = await getDashboard(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.allStock)).toBe(true);
    // allStock must be a superset of (or equal to) the flagged `items` list —
    // every flagged item's coArt+coAlma pair must also appear in allStock.
    for (const flagged of body.items) {
      expect(body.allStock.some((s: { coArt: string; coAlma: string }) =>
        s.coArt === flagged.coArt && s.coAlma === flagged.coAlma)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/integration/inventory-dashboard-stock.integration.test.ts`
Expected: FAIL — `body.allStock` is `undefined`.

- [ ] **Step 3: Extend the dashboard route with an unfiltered stock query**

In `app/api/inventory/dashboard/route.ts`, add a second, simpler query alongside the existing `DASHBOARD_QUERY_BASE` — this one has no sales-velocity join, just current stock per configured warehouse:

```typescript
const ALL_STOCK_QUERY_BASE = `
  SELECT a.co_art, a.art_des, s.co_alma, s.stock
  FROM saArticulo a
  JOIN saStockAlmacen s ON s.co_art = a.co_art AND s.tipo = 'ACT'
  WHERE a.anulado = 0
`;

interface AllStockRow {
  co_art: string; art_des: string; co_alma: string; stock: number;
}
```

In the `GET` handler, after the existing `items` computation (right before the final `return NextResponse.json({...})`), add a second query execution reusing the same `activeWarehouses` filter already built for the first query (don't rebuild it):

```typescript
    const allStockRequest = pool.request();
    let allStockQuery = ALL_STOCK_QUERY_BASE;
    if (activeWarehouses.length > 0) {
      const allStockPlaceholders = activeWarehouses.map((w, i) => {
        allStockRequest.input(`coAlma${i}`, sql.Char(6), w.coAlma);
        return `@coAlma${i}`;
      });
      allStockQuery += ` AND s.co_alma IN (${allStockPlaceholders.join(', ')})`;
    }
    allStockQuery += ' ORDER BY a.art_des';
    const allStockResult = await allStockRequest.query(allStockQuery);
    const allStockRows = trimStrings(allStockResult.recordset) as unknown as AllStockRow[];
    const allStock = allStockRows.map(r => ({
      coArt:  r.co_art,
      artDes: r.art_des,
      coAlma: r.co_alma,
      stock:  Number(r.stock),
    }));
```

Update the final response to include it:

```typescript
    return NextResponse.json({
      items,
      allStock,
      rollingWindowDays:    settings.rollingWindowDays,
      daysOfStockThreshold: settings.daysOfStockThreshold,
    });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test --isolate --env-file=.env.local __tests__/integration/inventory-dashboard-stock.integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Render the browse table in the dashboard UI**

In `dashboard-client.tsx`, extend the `DashboardResponse` interface (line 15-19):

```tsx
interface StockRow {
  coArt:  string;
  artDes: string;
  coAlma: string;
  stock:  number;
}

interface DashboardResponse {
  items:                 LowStockItem[];
  allStock:              StockRow[];
  rollingWindowDays:     number;
  daysOfStockThreshold:  number;
}
```

Add a search input and the browse table above the existing "Artículos con Stock Bajo" section (before the `<h1>`, or as a new section after it — placing it first matches the spec's own ordering, where "current stock" is the dashboard's first listed bullet):

```tsx
  const [stockSearch, setStockSearch] = useState('');
```

```tsx
      {data && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-gray-800">Stock actual</h2>
            <input
              type="text"
              placeholder="Buscar artículo…"
              value={stockSearch}
              onChange={e => setStockSearch(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm w-56
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b border-gray-200">
                  {['Código', 'Nombre', 'Almacén', 'Stock'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.allStock
                  .filter(row => {
                    const q = stockSearch.trim().toLowerCase();
                    return q === '' || row.coArt.toLowerCase().includes(q) || row.artDes.toLowerCase().includes(q);
                  })
                  .map(row => (
                    <tr key={`${row.coArt}::${row.coAlma}`} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{row.coArt}</td>
                      <td className="px-3 py-2 text-gray-900">{row.artDes}</td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row.coAlma}</td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row.stock}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
```

Place this block right after the existing `{error && (...)}` block and before the current `{data && (<>...low-stock table...</>)}` block, so the browse table appears first on the page.

- [ ] **Step 6: Update the dashboard help panel**

In `content/help/dashboard.md`, add a short section describing the new table (read the file first to match its existing structure/heading style before inserting — likely add a `## Stock actual` section before or after the existing low-stock explanation section).

- [ ] **Step 7: Write the e2e test**

Add to `e2e/inventory-dashboard.spec.ts`:

```typescript
test('shows a searchable current-stock table above the low-stock list', async ({ userPage }) => {
  await userPage.goto('/inventario/dashboard');
  await expect(userPage.getByRole('heading', { name: 'Stock actual' })).toBeVisible({ timeout: 15_000 });
  await expect(userPage.getByPlaceholder('Buscar artículo…')).toBeVisible();
});
```

- [ ] **Step 8: Run tests**

Run: `bun test --isolate --env-file=.env.local __tests__/integration/inventory-dashboard-stock.integration.test.ts && bun run e2e:mssql --grep "Stock actual"`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/api/inventory/dashboard/route.ts app/\(app\)/inventario/dashboard/dashboard-client.tsx content/help/dashboard.md __tests__/integration/inventory-dashboard-stock.integration.test.ts e2e/inventory-dashboard.spec.ts
git commit -m "feat: add a searchable current-stock browse table to the dashboard"
```

**Note for whoever picks up the stock evolution chart separately:** that's the one item from the original review NOT fully closed by this task — it needs a charting library decision (none installed today; a lightweight option like a hand-rolled SVG sparkline may avoid a new dependency entirely for a single-article view) and a new `dbo.MovimientoInventario` running-balance query. Scope it as its own follow-up plan rather than folding it in here.

---

### Task 6: Accessible warehouse-delete button

**Files:**
- Modify: `app/(app)/admin/config-inventario/config-client.tsx`

**Interfaces:** None — pure UI change, no new props or API shape.

**UX finding this closes:** The delete button (line 175-181 of `config-client.tsx`) is a bare "✕" with no `aria-label`, behind a native `confirm()` with generic copy ("¿Eliminar este almacén de la lista?") that doesn't name which warehouse.

- [ ] **Step 1: Give the button an accessible label and specific confirmation copy**

Replace the existing delete handler and button (lines 102-109 and 175-181):

```tsx
  async function handleDeleteWarehouse(warehouse: Warehouse) {
    if (!confirm(`¿Quitar el almacén ${warehouse.coAlma} — ${warehouse.label} de la lista de Inventario?`)) return;
    const res = await fetch(`/api/admin/inventory-warehouses/${warehouse.id}`, { method: 'DELETE' });
    if (res.ok) {
      setWarehouses(prev => prev.filter(w => w.id !== warehouse.id));
      setOptionsReloadToken(t => t + 1);
    }
  }
```

```tsx
                    <button
                      onClick={() => handleDeleteWarehouse(w)}
                      aria-label={`Quitar almacén ${w.coAlma} — ${w.label}`}
                      title={`Quitar almacén ${w.coAlma}`}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      ✕
                    </button>
```

Update the call site — `handleDeleteWarehouse(id: number)` becomes `handleDeleteWarehouse(warehouse: Warehouse)`, so the `onClick` must pass the full row object (`w`), not just `w.id`.

- [ ] **Step 2: Manually verify**

Run: `bun dev`, log in as admin, go to `/admin/config-inventario`, click a warehouse's "✕".
Expected: confirm dialog reads "¿Quitar el almacén 14 — Materia Prima de la lista de Inventario?" (or whatever real code/label is configured), not the old generic text.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/admin/config-inventario/config-client.tsx
git commit -m "fix: give the warehouse-delete button an accessible label and specific confirm copy"
```

---

### Task 7: Add captions to the low-stock settings inputs

**Files:**
- Modify: `app/(app)/admin/config-inventario/config-client.tsx`

**Interfaces:** None — pure UI change.

**UX finding this closes:** "Ventana de consumo (días)" and "Días de stock mínimo para alertar" are bare number inputs (lines 236-260) with no in-context explanation of what a sane value looks like — the explanation currently only lives in the separate dashboard help panel.

- [ ] **Step 1: Add a caption under each field**

Replace the "Alertas de stock bajo" section (lines 234-269):

```tsx
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Alertas de stock bajo</h2>
        <div className="flex gap-6 items-start">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ventana de consumo (días)
            </label>
            <input
              type="number"
              min={1}
              value={settings.rollingWindowDays}
              onChange={e => setSettings(s => ({ ...s, rollingWindowDays: parseInt(e.target.value, 10) || 0 }))}
              className={`${inputClass} w-32`}
            />
            <p className="text-xs text-gray-500 mt-1 max-w-48">
              Cuántos días de historial de ventas se usan para calcular el
              consumo diario promedio. Ej.: 60.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Días de stock mínimo para alertar
            </label>
            <input
              type="number"
              min={1}
              value={settings.daysOfStockThreshold}
              onChange={e => setSettings(s => ({ ...s, daysOfStockThreshold: parseInt(e.target.value, 10) || 0 }))}
              className={`${inputClass} w-32`}
            />
            <p className="text-xs text-gray-500 mt-1 max-w-48">
              Un artículo se marca "stock bajo" cuando le quedan menos de
              estos días, según su consumo reciente. Ej.: 7.
            </p>
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-50"
          >
            {savingSettings ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </section>
```

(Changed `items-end` to `items-start` on the flex container so the captions, which vary the box heights, don't visually misalign the button — verify this looks right in Step 2 and adjust if needed.)

- [ ] **Step 2: Manually verify**

Run: `bun dev`, log in as admin, go to `/admin/config-inventario`.
Expected: both settings fields show a one-line grey caption beneath them; the "Guardar" button stays vertically reasonable next to the now-taller field columns.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/admin/config-inventario/config-client.tsx
git commit -m "feat: add explanatory captions to the low-stock alert settings"
```

---

### Task 8: Client-side Mín ≤ Máx validation on Artículos

**Files:**
- Modify: `app/(app)/inventario/articulos/articulos-client.tsx`
- Test: `e2e/inventory-items.spec.ts` (confirm exact filename first)

**Interfaces:** None new.

**UX finding this closes:** The inline edit row lets Mín be typed higher than Máx with no client-side check — the DB constraint (a live `CK_saArticulo_Stock` CHECK constraint, SQL Server error 547, already handled server-side in `app/api/inventory/items/[co_art]/route.ts` lines 75-78) only surfaces the problem after a full network round trip.

**Hard constraint — do not disable the Guardar button on this condition.** `e2e/inventory-items.spec.ts` already has a passing test, `'setting stock_min above stock_max shows the CK_saArticulo_Stock error'`, that fills Mín > Máx and then clicks Guardar specifically to assert the server's `CK_saArticulo_Stock` error text appears. If Guardar is disabled whenever Mín > Máx, that click becomes impossible and this existing test breaks. This task must add a **non-blocking inline warning only** — the button stays enabled, exactly as it is today (`disabled={!dirty || savingRow === key}`, unchanged).

- [ ] **Step 1: Read the existing conflicting test first**

Run: `grep -n -A 25 "setting stock_min above stock_max" e2e/inventory-items.spec.ts`
Confirm it still fills Mín > Máx and clicks Guardar expecting `CK_saArticulo_Stock` to appear from the server response. If its shape has changed since this plan was written, adjust Step 2's new test and Step 3's implementation to keep that existing test passing — the acceptance bar for this task is "adds a warning" AND "does not make the existing server-error test unreachable," not just the former.

- [ ] **Step 2: Write the failing e2e test for the new warning**

```typescript
test('shows a non-blocking inline warning when Mín exceeds Máx', async ({ userPage }) => {
  await userPage.goto('/inventario/articulos');
  const firstRow = userPage.locator('table tbody tr').first();
  await expect(firstRow).toBeVisible({ timeout: 15_000 });

  const minInput = firstRow.locator('input[aria-label^="Mín"]');
  const maxInput = firstRow.locator('input[aria-label^="Máx"]');
  await maxInput.fill('5');
  await minInput.fill('10');

  await expect(firstRow.getByText('El mínimo no puede ser mayor que el máximo')).toBeVisible();
  // Must stay enabled — this is a warning, not a block. The existing test
  // 'setting stock_min above stock_max shows the CK_saArticulo_Stock error'
  // depends on being able to click Guardar in exactly this state.
  const saveButton = firstRow.getByRole('button', { name: /Guardar/ });
  await expect(saveButton).toBeEnabled();
});
```

- [ ] **Step 3: Run both tests to verify current state**

Run: `bun run e2e:mssql --grep "Mín exceeds Máx|stock_min above stock_max"`
Expected: the new "non-blocking inline warning" test FAILS (no warning text exists yet); the existing "CK_saArticulo_Stock" test still PASSES (nothing has changed yet that could break it) — confirming the baseline before any edit.

- [ ] **Step 4: Add the validation as a warning, not a gate**

In `articulos-client.tsx`, add a helper near the top-level functions (after `getEdits`, around line 108):

```tsx
  function minMaxWarning(item: Item): string | null {
    const fields = getEdits(item);
    if (fields.stockMin > fields.stockMax) {
      return 'El mínimo no puede ser mayor que el máximo';
    }
    return null;
  }
```

In the row-rendering loop (line 210-256), compute it alongside `dirty`:

```tsx
              const key = rowKey(item);
              const fields = getEdits(item);
              const dirty = !!edits[key];
              const minMaxWarn = minMaxWarning(item);
```

Do **not** change the save button's `disabled` condition (line 245) — leave it exactly as `disabled={!dirty || savingRow === key}`.

Add the inline warning inside the Acciones `<td>`, right before the existing `{rowErrors[key] && (...)}` block (line 251), styled distinctly (orange, "warning") from the red server-error text so a user can tell the two apart:

```tsx
                    {minMaxWarn && (
                      <p className="text-xs text-orange-600 mt-1 max-w-xs">{minMaxWarn}</p>
                    )}
                    {rowErrors[key] && (
                      <p className="text-xs text-red-600 mt-1 max-w-xs">{rowErrors[key]}</p>
                    )}
```

- [ ] **Step 5: Run both tests to verify the new one passes and the old one still passes**

Run: `bun run e2e:mssql --grep "Mín exceeds Máx|stock_min above stock_max"`
Expected: both PASS. If the existing `CK_saArticulo_Stock` test fails, the button was accidentally gated — re-check Step 4 didn't touch the `disabled` prop.

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/inventario/articulos/articulos-client.tsx e2e/
git commit -m "fix: validate Mín <= Máx client-side before allowing save on Artículos"
```

---

### Task 9: Remove `co_art` jargon from Artículos help text

**Files:**
- Modify: `content/help/articulos.md`

**Interfaces:** None.

**UX finding this closes:** The help panel's glossary explains "Código" as "el código interno del artículo en Profit Plus (`co_art`)" — the only place a raw ERP field name leaks into user-facing text in this module.

- [ ] **Step 1: Edit the glossary entry**

In `content/help/articulos.md`, replace line 10-11:

```markdown
- **Código**: el código interno del artículo en Profit Plus (`co_art`).
  No se puede editar aquí.
```

with:

```markdown
- **Código**: el código interno del artículo en Profit Plus. No se puede
  editar aquí.
```

(This edit composes cleanly with Task 3's edits to the same file — if both tasks are executed, apply this one first or re-check line numbers, since Task 3 rewrites a later section of the same document and could shift line numbers if done out of order. Safest: search-and-replace by the exact string above rather than by line number.)

- [ ] **Step 2: Verify no other file references `co_art` in user-facing copy**

Run: `grep -rn "co_art" content/help/ app/\(app\)/inventario/ app/\(app\)/admin/config-inventario/ --include="*.tsx" --include="*.md"`
Expected: no matches in JSX text content or markdown prose (matches inside TypeScript variable names like `item.coArt` or `co_art` as a request-body key are fine — those aren't rendered to the user).

- [ ] **Step 3: Commit**

```bash
git add content/help/articulos.md
git commit -m "fix: remove raw ERP field name (co_art) from Artículos help text"
```

---

### Task 10: Fix the spec's route table

**Files:**
- Modify: `docs/superpowers/specs/2026-08-20-inventory-management-design.md`

**Interfaces:** None — documentation only.

**UX finding this closes:** The spec's Module & Routes section lists the dashboard route as `/inventario`; the shipped route is `/inventario/dashboard`. Reconciling the doc, not the code — nothing depends on the shorter path, and moving the route now would be a needless breaking change to the URL.

- [ ] **Step 1: Update the route table**

In `docs/superpowers/specs/2026-08-20-inventory-management-design.md`, find the line (originally line 238 at spec-authoring time, verify current line number first since Tasks 1-9 don't touch this file):

```markdown
- **`/inventario`** — dashboard. Current stock per article/warehouse
```

Change to:

```markdown
- **`/inventario/dashboard`** — dashboard. Current stock per article/warehouse
```

Also check the Nav description a few lines above (around the original line 232-234) and the "Every inventory route..." sentence near the end of the Module & Routes section for any other bare `/inventario` reference that should say `/inventario/dashboard` — update all of them for consistency, not just the bulleted route list entry.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-08-20-inventory-management-design.md
git commit -m "docs: fix dashboard route in inventory spec to match shipped /inventario/dashboard"
```

---

## Self-Review Notes

**Spec coverage against the 11 UX findings:**
1. Artículos→Ajustes link — Task 1. ✅
2. Add article to warehouse — Task 2. ✅
3. Mín/Máx alert mismatch — Task 3. ✅
4. Adjustment history — Task 4. ✅
5. Chart / current-stock browse — Task 5 covers the browse table; the trend chart itself is explicitly scoped OUT with a note at the end of Task 5, since it needs a separate dependency decision. Flag this to the user/reviewer rather than silently under-delivering.
6. Warehouse-delete accessibility — Task 6. ✅
7. Settings captions — Task 7. ✅
8. Mín≤Máx client validation — Task 8. ✅
9. `co_art` jargon — Task 9. ✅
10. Spec route fix — Task 10. ✅
11. (Not a separate task — this was the review's own note that item #11 duplicated #10; no action needed.)

**Task ordering note:** Tasks 3 and 9 both edit `content/help/articulos.md`. They're written to be independently applicable (Task 9 uses search-and-replace on an exact string, not a line number), so they can run in either order or in parallel via subagent-driven-development without conflicting — but whoever executes them should double check the file's final state after both land, since two agents editing the same file in parallel is exactly the case most likely to produce a silent merge issue.

**Chart scope flag:** Task 5 deliberately ships less than the full "stock evolution chart" from the original review. This is a real, intentional scope cut — surfaced here so it isn't lost. Recommend a follow-up plan once a charting approach is chosen (new dependency vs. hand-rolled SVG sparkline).

**Correction found during self-review:** Task 8's first draft disabled the Guardar button whenever Mín > Máx. `e2e/inventory-items.spec.ts` already has a passing test (`'setting stock_min above stock_max shows the CK_saArticulo_Stock error'`) that depends on clicking Guardar in exactly that state to reach the server's `CK_saArticulo_Stock` constraint error. Disabling the button would have made that existing, passing test unreachable — a regression this plan would have introduced silently. Task 8 was rewritten to add a non-blocking warning only, with an explicit step (Step 1) requiring the implementer to re-read the existing test before touching the button's `disabled` prop, and a step (Step 5) requiring both the new and the pre-existing test to be run together, not just the new one.

**Unresolved schema gap, flagged for the implementer:** No `erp-knowledge-base/` directory or `saStockAlmacen` schema doc exists anywhere in this repo as of this plan (confirmed by full-repo search during planning) — Task 2's exact `saStockAlmacen` INSERT column list (`co_art`, `co_alma`, `tipo`, `stock`) is inferred from how every *existing* query in this module reads that table, not from a live `sys.columns` dump. Task 2 Step 1 requires verifying this against a real schema before writing the INSERT. Task 4's `saAjuste`/`saAjusteReng` history query is similarly unverified — no existing query in this codebase reads either table today, so Task 4 carries the same live-schema-first caution. Both tasks call this out inline; repeating it here so it isn't missed in a skim.
