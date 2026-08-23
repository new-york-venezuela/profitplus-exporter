# Inventory Module — Access Control + Admin Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-module access control (`user_modules`) on top of the
existing `role` enum, and an admin-managed warehouse allowlist +
low-stock thresholds (`inventory_warehouses`, `inventory_settings`),
so every later inventory-module plan has somewhere to check "can this
user see Inventario" and "which Profit Plus warehouses does this
install care about." Also fixes a discovered pre-existing test-suite
bug (Task 0) that silently breaks any integration test relying on the
real SQLite DB when run after `password-reset-routes.integration.test.ts`
in the same `bun test` invocation.

**Architecture:** Three new Drizzle/SQLite tables alongside the
existing `users` table. A small `lib/inventory/access.ts` helper
(`hasInventoryAccess(db, userId, role)`) other plans' routes/pages will
import. Admin UI: extend `/admin/users` to assign modules per user, and
add a new `/admin/config-inventario` page for warehouses + thresholds,
both following the existing admin page conventions (`page.tsx` Server
Component redirect-gate + a `'use client'` companion + one API route
file per resource).

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (SQLite,
`bun:sqlite`), Tailwind CSS v4, TypeScript, `bun test`.

**Spec:** `docs/superpowers/specs/2026-08-20-inventory-management-design.md`

## Global Constraints

- Page URIs are Spanish; API routes are English/technical (spec,
  "Module & Routes").
- Every route calls session-checking logic and checks access
  independently — there is no shared middleware (`AGENTS.md`, corrected
  2026-08-20).
- Admin check pattern: `if (session.role !== 'admin') return 403/redirect`
  — copy the exact pattern already in `app/api/admin/users/route.ts`
  and `app/(app)/admin/users/page.tsx`.
- Error responses are always `{ error: string }` with the right HTTP
  status (`AGENTS.md`).
- `inventory_warehouses` empty ⇒ fall back to "every warehouse with a
  `saStockAlmacen` row" (spec, Data Model) — this plan only builds the
  allowlist storage + admin UI; the fallback query itself belongs to
  whichever later plan first needs to read warehouses (dashboard/items/
  adjustments), not here. This plan just needs to leave the table in a
  state where "empty" is a valid, meaningful value.
- Module value used everywhere in this plan: the literal string
  `'inventory'`.
- **Testability constraint discovered while writing this plan (real,
  verified, not hypothetical):** `getSession()`
  (`lib/auth/get-session.ts`) calls `next/headers`'s `cookies()`,
  which throws `` `cookies` was called outside a request scope `` when
  a Route Handler is invoked directly (e.g. from a `bun test` file)
  rather than through a live Next.js server. This affects every route
  in the app today, not just new ones — confirmed by directly calling
  the existing `GET` in `app/api/admin/users/route.ts` from a test,
  which returns 500 instead of 401. Pages (Server Components) are
  unaffected — they only ever render inside a real request, so
  `page.tsx` files keep using `getSession()` unchanged. **All new API
  routes in this plan instead extract the session from the
  `NextRequest` object directly**, via a new `getSessionFromRequest()`
  helper (Task 2), which makes them both correct in production and
  directly testable. This means every `GET` handler in this plan takes
  a `request: NextRequest` parameter even where the existing
  `/admin/users` convention omits it for `GET` — that omission is what
  makes the existing route untestable; do not copy it.
- **The dev SQLite database must have migrations applied before running
  any integration test in Tasks 3–4** (`bun run migrate` — this repo's
  `bun test` does not run migrations itself, and neither does any
  existing test file; verified directly). If `bun test` on Task 3/4's
  integration test fails with `SQLiteError: no such table: ...`, run
  `bun run migrate` first, then re-run the test.
- **Cross-file test pollution bug discovered and fixed by Task 0:**
  `__tests__/integration/password-reset-routes.integration.test.ts`
  calls Bun's `mock.module('@/lib/db/sqlite', ...)` twice, inside
  helper functions. Bun's `mock.module()` permanently replaces that
  module for the rest of the `bun test` process — confirmed directly:
  `mock.restore()` does NOT undo it (verified empirically, despite its
  type-doc description sounding like it should), and there is no
  working per-file undo in this Bun version (1.3.14). Any test file
  that runs later in the same `bun test` invocation and calls the real
  `getDb()` gets a broken fake object with no `.delete`/`.select`/etc.
  methods instead. This is pre-existing and affects any future test
  touching the real SQLite DB, not just this plan's — confirmed it
  also silently breaks the previously-passing
  `Compras Export Integration` test today, undetected until now because
  nobody had added a second real-DB integration test file after it.
  Task 0 fixes this at the `bun test` invocation level via Bun's
  `--isolate` flag (confirmed fix: reduces the corrupted 20-failure run
  down to exactly the 7 pre-existing, unrelated failures already on
  `main`), not by rewriting the offending test file.

---

## File Structure

```
lib/db/schema.ts                          — MODIFY: add 3 new tables
lib/inventory/access.ts                   — NEW: hasInventoryAccess(), getSessionFromRequest()
drizzle/migrations/0001_*.sql             — NEW (generated): schema migration

app/(app)/admin/users/users-client.tsx    — MODIFY: module checkbox per user
app/api/admin/users/[id]/modules/route.ts — NEW: PUT module list for a user
app/api/admin/users/route.ts              — MODIFY: GET includes modules, uses getSessionFromRequest

app/(app)/admin/config-inventario/page.tsx        — NEW: Server Component gate
app/(app)/admin/config-inventario/config-client.tsx — NEW: 'use client' UI
app/api/admin/inventory-settings/route.ts         — NEW: GET/PATCH thresholds
app/api/admin/inventory-warehouses/route.ts       — NEW: GET/POST warehouses
app/api/admin/inventory-warehouses/[id]/route.ts  — NEW: PATCH/DELETE one warehouse

components/sidebar.tsx                    — MODIFY: add admin nav link

package.json                              — MODIFY: "test" script gains --isolate
```

---

### Task 0: Fix cross-file test pollution in `bun test`

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: a `bun test` invocation (via `bun run test`) that is safe
  to run as the full suite without one file's `mock.module()` calls
  corrupting every later file's real-module imports. Every later task
  in this plan (and future plans) that adds a real-DB integration test
  depends on this being fixed first — otherwise `bun test` (full suite)
  will show failures in tests that pass individually, which is
  confusing to debug and easy to misdiagnose as a bug in the new code
  instead of the test runner invocation.

This is a pre-existing bug, not something this plan's new code causes
— but this plan is the first to add a second integration test file
that touches the real SQLite DB after
`password-reset-routes.integration.test.ts`, which is what exposes it.
Fixing the invocation (not the offending test file) is the smallest
correct fix: Bun's `--isolate` flag runs each test file in a fresh
global object specifically to prevent exactly this kind of leak.

- [ ] **Step 1: Confirm the bug exists (reproduce before fixing)**

Run: `bun test 2>&1 | tail -30`

Expected: alongside the pre-existing ~7 unrelated failures already on
`main` (a couple of `comprasMapper` assertions and `ForgotPasswordService`
signature checks — leave those alone, they are out of scope), you
should NOT yet see any inventory-related failures, since Tasks 1-4
haven't been implemented yet at this point. This step is really about
getting a baseline `tail` count to compare against later — the actual
regression only becomes visible once Task 3's integration test file
exists. Skip re-verifying this step once Task 3/4 are done; just keep
it in mind as the reason Task 0 exists.

- [ ] **Step 2: Add `--isolate` to the test script**

Edit `package.json` — change:

```json
"test": "bun test",
```

to:

```json
"test": "bun test --isolate",
```

- [ ] **Step 3: Verify the fix**

Run: `bun run test`

Expected: same ~7 pre-existing failures as before (unrelated to this
plan — `comprasMapper` and `ForgotPasswordService` tests), and nothing
else. If you're running this step before Task 3 exists, there's
nothing new to verify yet; re-run this exact command after Task 3 and
Task 4 are both done as your real confirmation that the fix holds with
this plan's new integration tests in place.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "fix: isolate test files to prevent mock.module() cross-file pollution"
```

---

### Task 1: Add `user_modules`, `inventory_warehouses`, `inventory_settings` to the schema

**Files:**
- Modify: `lib/db/schema.ts`
- Create (generated by drizzle-kit, then hand-edited): `drizzle/migrations/0001_*.sql`
- Test: `__tests__/unit/db/inventory-schema.test.ts`

**Interfaces:**
- Produces: `userModules`, `inventoryWarehouses`, `inventorySettings`
  Drizzle table objects, importable from `@/lib/db/schema`, plus their
  inferred types `UserModule`, `NewUserModule`, `InventoryWarehouse`,
  `NewInventoryWarehouse`, `InventorySettings`, `NewInventorySettings`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/db/inventory-schema.test.ts`:

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';

let sqlite: Database;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(() => {
  sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle/migrations' });
});

afterAll(() => {
  sqlite.close();
});

describe('user_modules', () => {
  test('stores a module grant for a user and can be queried back', () => {
    const user = db.insert(schema.users).values({
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: 'x',
      role: 'user',
      createdAt: Date.now(),
    }).returning({ id: schema.users.id }).get();

    db.insert(schema.userModules).values({
      userId: user!.id,
      module: 'inventory',
    }).run();

    const grants = db.select().from(schema.userModules)
      .where(eq(schema.userModules.userId, user!.id)).all();

    expect(grants).toHaveLength(1);
    expect(grants[0]!.module).toBe('inventory');
  });
});

describe('inventory_warehouses', () => {
  test('stores an admin-configured warehouse with active flag', () => {
    db.insert(schema.inventoryWarehouses).values({
      coAlma: '14',
      label: 'Materia Prima',
      active: true,
    }).run();

    const rows = db.select().from(schema.inventoryWarehouses).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.coAlma).toBe('14');
    expect(rows[0]!.active).toBe(true);
  });
});

describe('inventory_settings', () => {
  test('has exactly one row with sane defaults after migration', () => {
    const rows = db.select().from(schema.inventorySettings).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rollingWindowDays).toBeGreaterThan(0);
    expect(rows[0]!.daysOfStockThreshold).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test __tests__/unit/db/inventory-schema.test.ts`
Expected: FAIL — `schema.userModules` (etc.) is `undefined`, or the
migration folder doesn't yet produce these tables.

- [ ] **Step 3: Add the tables to the schema**

Edit `lib/db/schema.ts` — replace the whole file with:

```typescript
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  email:        text('email').notNull().unique(),
  name:         text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role:         text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  createdAt:    integer('created_at').notNull(),                // unix ms; use Date.now() on insert
});

export type User    = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ── Inventory module ────────────────────────────────────────────────

export const userModules = sqliteTable('user_modules', {
  id:     integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  module: text('module', { enum: ['inventory'] }).notNull(),
});

export type UserModule    = typeof userModules.$inferSelect;
export type NewUserModule = typeof userModules.$inferInsert;

export const inventoryWarehouses = sqliteTable('inventory_warehouses', {
  id:     integer('id').primaryKey({ autoIncrement: true }),
  coAlma: text('co_alma').notNull().unique(),   // matches Profit Plus saAlmacen.co_alma (char(6), untrimmed)
  label:  text('label').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

export type InventoryWarehouse    = typeof inventoryWarehouses.$inferSelect;
export type NewInventoryWarehouse = typeof inventoryWarehouses.$inferInsert;

export const inventorySettings = sqliteTable('inventory_settings', {
  id:                   integer('id').primaryKey({ autoIncrement: true }),
  rollingWindowDays:    integer('rolling_window_days').notNull().default(60),
  daysOfStockThreshold: integer('days_of_stock_threshold').notNull().default(7),
});

export type InventorySettings    = typeof inventorySettings.$inferSelect;
export type NewInventorySettings = typeof inventorySettings.$inferInsert;
```

Note: `inventorySettings` is a single-row table (no natural key to
scope by) — Step 5 below seeds the one default row; application code
always reads/updates the row with the lowest `id` (in practice the
only row).

- [ ] **Step 4: Generate the migration**

Run: `bun run db:generate`

This creates `drizzle/migrations/0001_<name>.sql` (drizzle-kit picks
the name) plus a matching `meta/000X_snapshot.json` entry. Open the
generated `.sql` file and confirm it contains `CREATE TABLE
user_modules`, `CREATE TABLE inventory_warehouses`, `CREATE TABLE
inventory_settings`, and a foreign key from `user_modules.user_id` to
`users.id`.

- [ ] **Step 5: Seed the one `inventory_settings` default row**

Append to the generated migration SQL file (edit it directly — this is
still an unapplied, freshly-generated migration, safe to hand-edit
before it's ever run):

```sql
--> statement-breakpoint
INSERT INTO inventory_settings (rolling_window_days, days_of_stock_threshold) VALUES (60, 7);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test __tests__/unit/db/inventory-schema.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Apply the migration to the real dev SQLite DB**

Run: `bun run migrate`
Expected: `✓ Migraciones aplicadas`

- [ ] **Step 8: Commit**

```bash
git add lib/db/schema.ts drizzle/migrations __tests__/unit/db/inventory-schema.test.ts
git commit -m "feat: add user_modules, inventory_warehouses, inventory_settings tables"
```

---

### Task 2: `hasInventoryAccess()` and `getSessionFromRequest()` helpers

**Files:**
- Create: `lib/inventory/access.ts`
- Test: `__tests__/unit/inventory/access.test.ts`

**Interfaces:**
- Consumes: `SessionPayload`, `verifyToken` from `@/lib/auth/session`;
  the Drizzle `db` type from `@/lib/db/schema`.
- Produces:
  - `hasInventoryAccess(db, userId: string, role: 'user' | 'admin'): Promise<boolean>`
    — every later plan's routes/pages call this to decide 403/redirect.
  - `getSessionFromRequest(request: NextRequest): Promise<SessionPayload | null>`
    — reads the `session` cookie directly off the `NextRequest` object
    (via `request.cookies.get('session')`) and verifies it with
    `verifyToken()`, bypassing `next/headers`'s `cookies()`. Every new
    API route in this and later plans uses this instead of
    `getSession()` — see the Global Constraints note on why.

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/inventory/access.test.ts`:

```typescript
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { NextRequest } from 'next/server';
import * as schema from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { hasInventoryAccess, getSessionFromRequest } from '@/lib/inventory/access';

const sqlite = new Database(':memory:');
const db = drizzle(sqlite, { schema });

beforeAll(() => {
  migrate(db, { migrationsFolder: './drizzle/migrations' });
});

afterEach(() => {
  sqlite.exec('DELETE FROM user_modules');
  sqlite.exec('DELETE FROM users');
});

describe('hasInventoryAccess', () => {
  test('admin always has access, even with no module grant', async () => {
    const admin = db.insert(schema.users).values({
      email: 'admin@example.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: schema.users.id }).get();

    const result = await hasInventoryAccess(db, String(admin!.id), 'admin');
    expect(result).toBe(true);
  });

  test('regular user without a grant has no access', async () => {
    const user = db.insert(schema.users).values({
      email: 'user@example.com', name: 'User', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: schema.users.id }).get();

    const result = await hasInventoryAccess(db, String(user!.id), 'user');
    expect(result).toBe(false);
  });

  test('regular user with an inventory grant has access', async () => {
    const user = db.insert(schema.users).values({
      email: 'user2@example.com', name: 'User Two', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: schema.users.id }).get();

    db.insert(schema.userModules).values({
      userId: user!.id, module: 'inventory',
    }).run();

    const result = await hasInventoryAccess(db, String(user!.id), 'user');
    expect(result).toBe(true);
  });
});

describe('getSessionFromRequest', () => {
  test('reads and verifies a valid session cookie', async () => {
    const token = await signToken({ sub: '7', role: 'admin', name: 'Test Admin' });
    const request = new NextRequest('http://localhost:3000/api/test', {
      headers: { Cookie: `session=${token}` },
    });

    const session = await getSessionFromRequest(request);
    expect(session?.sub).toBe('7');
    expect(session?.role).toBe('admin');
  });

  test('returns null when there is no session cookie', async () => {
    const request = new NextRequest('http://localhost:3000/api/test');
    const session = await getSessionFromRequest(request);
    expect(session).toBeNull();
  });

  test('returns null for a garbage/invalid token', async () => {
    const request = new NextRequest('http://localhost:3000/api/test', {
      headers: { Cookie: 'session=not-a-real-jwt' },
    });
    const session = await getSessionFromRequest(request);
    expect(session).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test __tests__/unit/inventory/access.test.ts`
Expected: FAIL — cannot find module `@/lib/inventory/access`

- [ ] **Step 3: Implement `lib/inventory/access.ts`**

```typescript
import { eq, and } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type { NextRequest } from 'next/server';
import { verifyToken, type SessionPayload } from '@/lib/auth/session';
import * as schema from '@/lib/db/schema';

export async function hasInventoryAccess(
  db: BunSQLiteDatabase<typeof schema>,
  userId: string,
  role: 'user' | 'admin',
): Promise<boolean> {
  if (role === 'admin') return true;

  const grant = db
    .select({ id: schema.userModules.id })
    .from(schema.userModules)
    .where(
      and(
        eq(schema.userModules.userId, parseInt(userId, 10)),
        eq(schema.userModules.module, 'inventory'),
      ),
    )
    .get();

  return grant !== undefined;
}

export async function getSessionFromRequest(
  request: NextRequest,
): Promise<SessionPayload | null> {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  return verifyToken(token);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test __tests__/unit/inventory/access.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/inventory/access.ts __tests__/unit/inventory/access.test.ts
git commit -m "feat: add hasInventoryAccess() and getSessionFromRequest() helpers"
```

---

### Task 3: Module assignment on `/admin/users`

**Files:**
- Modify: `app/api/admin/users/route.ts` (GET includes modules, GET/POST use `getSessionFromRequest`)
- Create: `app/api/admin/users/[id]/modules/route.ts`
- Modify: `app/(app)/admin/users/users-client.tsx`
- Modify: `app/(app)/admin/users/page.tsx` (query must also select each
  user's modules — the existing query only selects
  `id, email, name, role, createdAt`, and the existing `as` type cast
  passed to `<UsersClient>` would silently bypass the type checker if
  left unchanged, causing a runtime crash on `user.modules.includes(...)`
  the moment the page renders)
- Test: `__tests__/integration/admin-user-modules.integration.test.ts`

**Interfaces:**
- Consumes: `getDb()` from `@/lib/db/sqlite`, `getSessionFromRequest()`
  from `@/lib/inventory/access` (Task 2), `userModules` table (Task 1).
- Produces: `PUT /api/admin/users/:id/modules` accepting
  `{ modules: string[] }`, replacing that user's full module set
  (empty array = revoke everything). `GET /api/admin/users` response
  rows gain a `modules: string[]` field.

This task also switches `app/api/admin/users/route.ts`'s `GET`/`POST`
from `getSession()` to `getSessionFromRequest(request)` so the whole
file is directly testable — the untested 500-instead-of-401 bug this
plan discovered (see Global Constraints) gets fixed as a side effect,
since it's the same file this task is already modifying.

- [ ] **Step 1: Write the failing integration test**

Create `__tests__/integration/admin-user-modules.integration.test.ts`.
This is a real-DB integration test (not the mock-heavy style of
`password-reset-routes.integration.test.ts` — that file mocks around
`getSession()`'s request-scope requirement; this plan avoids the
problem entirely by not using `getSession()` in these routes, so a
real SQLite DB + real `NextRequest` objects work directly):

```typescript
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { PUT } from '@/app/api/admin/users/[id]/modules/route';
import { GET as getUsers } from '@/app/api/admin/users/route';

function buildRequest(token: string | null, init: { method: string; body?: string }): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `session=${token}`;
  return new NextRequest('http://localhost:3000/api/test', {
    method: init.method,
    body: init.body,
    headers,
  });
}

function resetDb() {
  const db = getDb();
  db.delete(userModules).run();
  db.delete(users).run();
}

describe('PUT /api/admin/users/:id/modules', () => {
  beforeEach(() => {
    resetDb();
  });

  test('admin can grant the inventory module to a user', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const target = db.insert(users).values({
      email: 'target@x.com', name: 'Target', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;

    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });
    const request = buildRequest(token, {
      method: 'PUT',
      body: JSON.stringify({ modules: ['inventory'] }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: String(target.id) }) });
    expect(response.status).toBe(200);

    const grants = db.select().from(userModules).where(eq(userModules.userId, target.id)).all();
    expect(grants.map(g => g.module)).toEqual(['inventory']);
  });

  test('non-admin gets 403', async () => {
    const db = getDb();
    const nonAdmin = db.insert(users).values({
      email: 'user@x.com', name: 'User', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;

    const token = await signToken({ sub: String(nonAdmin.id), role: 'user', name: 'User' });
    const request = buildRequest(token, {
      method: 'PUT',
      body: JSON.stringify({ modules: ['inventory'] }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: String(nonAdmin.id) }) });
    expect(response.status).toBe(403);
  });

  test('no session cookie gets 401', async () => {
    const db = getDb();
    const target = db.insert(users).values({
      email: 'target3@x.com', name: 'Target', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;

    const request = buildRequest(null, {
      method: 'PUT',
      body: JSON.stringify({ modules: ['inventory'] }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: String(target.id) }) });
    expect(response.status).toBe(401);
  });

  test('PUT with an empty array revokes all modules', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin2@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const target = db.insert(users).values({
      email: 'target2@x.com', name: 'Target', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: target.id, module: 'inventory' }).run();

    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });
    const request = buildRequest(token, {
      method: 'PUT',
      body: JSON.stringify({ modules: [] }),
    });

    await PUT(request, { params: Promise.resolve({ id: String(target.id) }) });

    const grants = db.select().from(userModules).where(eq(userModules.userId, target.id)).all();
    expect(grants).toHaveLength(0);
  });

  test('rejects an unknown module name', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin4@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const target = db.insert(users).values({
      email: 'target4@x.com', name: 'Target', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;

    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });
    const request = buildRequest(token, {
      method: 'PUT',
      body: JSON.stringify({ modules: ['not-a-real-module'] }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: String(target.id) }) });
    expect(response.status).toBe(400);
  });
});

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    resetDb();
  });

  test('includes each user\'s modules array', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin3@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: admin.id, module: 'inventory' }).run();

    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });
    const request = buildRequest(token, { method: 'GET' });

    const response = await getUsers(request);
    const body = await response.json() as Array<{ id: number; modules: string[] }>;
    const row = body.find(u => u.id === admin.id);
    expect(row?.modules).toEqual(['inventory']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test __tests__/integration/admin-user-modules.integration.test.ts`
Expected: FAIL — route module doesn't exist yet, `modules` field
missing from GET response, `GET`/`PUT` don't yet accept `request`.

- [ ] **Step 3: Implement `PUT /api/admin/users/[id]/modules`**

Create `app/api/admin/users/[id]/modules/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

const VALID_MODULES = ['inventory'] as const;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.modules)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    const modules: string[] = body.modules;
    if (modules.some(m => !VALID_MODULES.includes(m as typeof VALID_MODULES[number]))) {
      return NextResponse.json({ error: 'Módulo inválido' }, { status: 400 });
    }

    const db = getDb();
    const user = db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    db.delete(userModules).where(eq(userModules.userId, userId)).run();
    for (const moduleName of modules) {
      db.insert(userModules).values({ userId, module: moduleName as 'inventory' }).run();
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Switch `app/api/admin/users/route.ts` to `getSessionFromRequest` and include `modules`**

Replace the entire contents of `app/api/admin/users/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return { error: 'No autorizado', status: 401 } as const;
  if (session.role !== 'admin') return { error: 'Prohibido', status: 403 } as const;
  return { session };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const db = getDb();
    const list = db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .all();

    const allModuleGrants = db.select().from(userModules).all();
    const modulesByUser = new Map<number, string[]>();
    for (const grant of allModuleGrants) {
      const existing = modulesByUser.get(grant.userId) ?? [];
      existing.push(grant.module);
      modulesByUser.set(grant.userId, existing);
    }

    const withModules = list.map(u => ({
      ...u,
      modules: modulesByUser.get(u.id) ?? [],
    }));

    return NextResponse.json(withModules);
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => null);
    if (!body || !body.email || !body.name || !body.password || !body.role) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    if (!['user', 'admin'].includes(body.role as string)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    if (!body.password || (body.password as string).length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
    }

    const email = (body.email as string).trim().toLowerCase();

    const db = getDb();
    const existing = db.select().from(users).where(eq(users.email, email)).get();
    if (existing) {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(body.password as string, 10);
    const result = db
      .insert(users)
      .values({
        email,
        name: (body.name as string).trim(),
        passwordHash,
        role: body.role as 'user' | 'admin',
        createdAt: Date.now(),
      })
      .returning({ id: users.id })
      .get();

    return NextResponse.json({ id: result?.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
```

This is a straight port of the existing file's logic — only the
`requireAdmin` signature (now takes `request`) and the added `modules`
field in `GET`'s response changed. `POST`'s behavior is unchanged.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test __tests__/integration/admin-user-modules.integration.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Add the module checkbox to the admin users UI**

Edit `app/(app)/admin/users/users-client.tsx`. Update the `UserRow`
interface:

```typescript
interface UserRow {
  id:        number;
  email:     string;
  name:      string;
  role:      'user' | 'admin';
  createdAt: number;
  modules:   string[];
}
```

Add a handler function alongside `handleDelete`:

```typescript
async function handleToggleInventoryModule(user: UserRow) {
  const hasIt = user.modules.includes('inventory');
  const nextModules = hasIt
    ? user.modules.filter(m => m !== 'inventory')
    : [...user.modules, 'inventory'];

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

Add a new `'Inventario'` entry to the header array (currently
`['Nombre', 'Email', 'Rol', 'Creado', 'Acciones']` — insert it right
after `'Rol'`), and a corresponding `<td>` in the row rendering, right
after the existing role `<td>` and before the "Creado" `<td>`:

```tsx
<td className="px-4 py-3">
  <label className="inline-flex items-center gap-2 text-xs text-gray-700">
    <input
      type="checkbox"
      checked={user.modules.includes('inventory')}
      onChange={() => handleToggleInventoryModule(user)}
      disabled={user.role === 'admin'}
      className="rounded border-gray-300"
    />
    {user.role === 'admin' ? 'Incluido (admin)' : 'Inventario'}
  </label>
</td>
```

(`disabled` when `role === 'admin'` because admins always have access
per `hasInventoryAccess` — the checkbox would be misleading to show as
editable.)

- [ ] **Step 7: Update `page.tsx` to fetch modules alongside each user**

Edit `app/(app)/admin/users/page.tsx` — replace its entire contents:

```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb }    from '@/lib/db/sqlite';
import { users, userModules } from '@/lib/db/schema';
import { UsersClient } from './users-client';

export default async function UsersPage() {
  const session = await getSession();
  if (!session)               redirect('/login');
  if (session.role !== 'admin') redirect('/reports/ventas');

  const db = getDb();
  const userList = db.select({
    id:        users.id,
    email:     users.email,
    name:      users.name,
    role:      users.role,
    createdAt: users.createdAt,
  }).from(users).all();

  const allModuleGrants = db.select().from(userModules).all();
  const modulesByUser = new Map<number, string[]>();
  for (const grant of allModuleGrants) {
    const existing = modulesByUser.get(grant.userId) ?? [];
    existing.push(grant.module);
    modulesByUser.set(grant.userId, existing);
  }

  const withModules = userList.map(u => ({
    ...u,
    modules: modulesByUser.get(u.id) ?? [],
  }));

  return (
    <UsersClient
      initialUsers={withModules}
      currentUserId={parseInt(session.sub)}
    />
  );
}
```

This drops the old `as Parameters<typeof UsersClient>[0]['initialUsers']`
cast entirely — `withModules` now genuinely matches `UserRow[]`, so
TypeScript actually verifies the shape instead of trusting a cast that
would have silently hidden this exact bug.

- [ ] **Step 8: Run the full test suite**

Run: `bun run test`
Expected: all new tests from Tasks 1-3 PASS. The only failures should
be the ~7 pre-existing ones already on `main` before this plan
(`comprasMapper` assertions, `ForgotPasswordService` signature checks)
— unrelated to this plan, do not attempt to fix them here. If you see
inventory-related failures alongside them, or a much larger number of
unrelated-looking failures, re-check that Task 0 was actually applied
(`package.json`'s `"test"` script should read
`"bun test --isolate"`) — running plain `bun test` instead of
`bun run test` skips the fix and reintroduces cross-file pollution.

- [ ] **Step 9: Commit**

```bash
git add app/api/admin/users/route.ts app/api/admin/users/[id]/modules/route.ts "app/(app)/admin/users/users-client.tsx" "app/(app)/admin/users/page.tsx" __tests__/integration/admin-user-modules.integration.test.ts
git commit -m "feat: add inventory module assignment to admin user management"
```

---

### Task 4: Admin warehouse + threshold configuration page

**Files:**
- Create: `app/api/admin/inventory-warehouses/route.ts` (GET, POST)
- Create: `app/api/admin/inventory-warehouses/[id]/route.ts` (PATCH, DELETE)
- Create: `app/api/admin/inventory-settings/route.ts` (GET, PATCH)
- Create: `app/(app)/admin/config-inventario/page.tsx`
- Create: `app/(app)/admin/config-inventario/config-client.tsx`
- Test: `__tests__/integration/admin-inventory-config.integration.test.ts`

**Interfaces:**
- Consumes: `getSessionFromRequest()` from `@/lib/inventory/access`
  (Task 2) — this page is admin-only (`role === 'admin'`), same as
  `/admin/users`, not module-gated (an inventory manager should not be
  able to reconfigure which warehouses exist).
- Produces: the `inventory_warehouses` and `inventory_settings` rows
  that later plans (dashboard/items/adjustments) will read.

- [ ] **Step 1: Write the failing integration test**

Create `__tests__/integration/admin-inventory-config.integration.test.ts`:

```typescript
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, inventoryWarehouses, inventorySettings } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { GET as getWarehouses, POST as postWarehouse } from '@/app/api/admin/inventory-warehouses/route';
import { PATCH as patchWarehouse, DELETE as deleteWarehouse } from '@/app/api/admin/inventory-warehouses/[id]/route';
import { GET as getSettings, PATCH as patchSettings } from '@/app/api/admin/inventory-settings/route';

function buildRequest(token: string | null, init: { method: string; body?: string }): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `session=${token}`;
  return new NextRequest('http://localhost:3000/api/test', {
    method: init.method,
    body: init.body,
    headers,
  });
}

function resetDb() {
  const db = getDb();
  db.delete(inventoryWarehouses).run();
  db.delete(users).run();
}

describe('inventory-warehouses admin API', () => {
  beforeEach(() => {
    resetDb();
  });

  test('admin can add a warehouse', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const request = buildRequest(token, {
      method: 'POST',
      body: JSON.stringify({ coAlma: '14', label: 'Materia Prima' }),
    });
    const response = await postWarehouse(request);
    expect(response.status).toBe(201);

    const rows = db.select().from(inventoryWarehouses).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.coAlma).toBe('14');
    expect(rows[0]!.active).toBe(true);
  });

  test('non-admin cannot add a warehouse', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'user@x.com', name: 'User', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'User' });

    const request = buildRequest(token, {
      method: 'POST',
      body: JSON.stringify({ coAlma: '14', label: 'Materia Prima' }),
    });
    const response = await postWarehouse(request);
    expect(response.status).toBe(403);
  });

  test('GET lists all configured warehouses', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin1b@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(inventoryWarehouses).values({ coAlma: '13', label: 'Insumos', active: true }).run();

    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });
    const request = buildRequest(token, { method: 'GET' });
    const response = await getWarehouses(request);
    const body = await response.json() as Array<{ coAlma: string }>;
    expect(body).toHaveLength(1);
    expect(body[0]!.coAlma).toBe('13');
  });

  test('admin can deactivate a warehouse via PATCH', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin2@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const wh = db.insert(inventoryWarehouses).values({
      coAlma: '13', label: 'Insumos', active: true,
    }).returning({ id: inventoryWarehouses.id }).get()!;

    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });
    const request = buildRequest(token, {
      method: 'PATCH',
      body: JSON.stringify({ active: false }),
    });
    const response = await patchWarehouse(request, { params: Promise.resolve({ id: String(wh.id) }) });
    expect(response.status).toBe(200);

    const updated = db.select().from(inventoryWarehouses).all();
    expect(updated[0]!.active).toBe(false);
  });

  test('admin can delete a warehouse', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin3@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const wh = db.insert(inventoryWarehouses).values({
      coAlma: '99', label: 'Temporal', active: true,
    }).returning({ id: inventoryWarehouses.id }).get()!;

    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });
    const request = buildRequest(token, { method: 'DELETE' });
    const response = await deleteWarehouse(request, { params: Promise.resolve({ id: String(wh.id) }) });
    expect(response.status).toBe(200);

    const rows = db.select().from(inventoryWarehouses).all();
    expect(rows).toHaveLength(0);
  });
});

describe('inventory-settings admin API', () => {
  test('GET returns the seeded defaults', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin4@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const request = buildRequest(token, { method: 'GET' });
    const response = await getSettings(request);
    const body = await response.json() as { rollingWindowDays: number; daysOfStockThreshold: number };
    expect(body.rollingWindowDays).toBe(60);
    expect(body.daysOfStockThreshold).toBe(7);
  });

  test('PATCH updates the threshold', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin5@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const request = buildRequest(token, {
      method: 'PATCH',
      body: JSON.stringify({ daysOfStockThreshold: 14 }),
    });
    await patchSettings(request);

    const rows = db.select().from(inventorySettings).all();
    expect(rows[0]!.daysOfStockThreshold).toBe(14);

    // restore the default so later tests in this file aren't affected
    db.update(inventorySettings).set({ daysOfStockThreshold: 7 }).run();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test __tests__/integration/admin-inventory-config.integration.test.ts`
Expected: FAIL — none of the route files exist yet.

- [ ] **Step 3: Implement `app/api/admin/inventory-warehouses/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { inventoryWarehouses } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return { error: 'No autorizado', status: 401 } as const;
  if (session.role !== 'admin') return { error: 'Prohibido', status: 403 } as const;
  return { session };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getDb();
  const rows = db.select().from(inventoryWarehouses).all();
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => null);
    if (!body || typeof body.coAlma !== 'string' || typeof body.label !== 'string') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    if (body.coAlma.trim().length === 0 || body.label.trim().length === 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const db = getDb();
    const result = db.insert(inventoryWarehouses).values({
      coAlma: body.coAlma.trim(),
      label:  body.label.trim(),
      active: true,
    }).returning({ id: inventoryWarehouses.id }).get();

    return NextResponse.json({ id: result?.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Implement `app/api/admin/inventory-warehouses/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { inventoryWarehouses } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return { error: 'No autorizado', status: 401 } as const;
  if (session.role !== 'admin') return { error: 'Prohibido', status: 403 } as const;
  return { session };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    const warehouseId = parseInt(id, 10);
    if (isNaN(warehouseId)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body.active !== 'boolean') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.select().from(inventoryWarehouses).where(eq(inventoryWarehouses.id, warehouseId)).get();
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    db.update(inventoryWarehouses).set({ active: body.active }).where(eq(inventoryWarehouses.id, warehouseId)).run();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    const warehouseId = parseInt(id, 10);
    if (isNaN(warehouseId)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const db = getDb();
    const existing = db.select().from(inventoryWarehouses).where(eq(inventoryWarehouses.id, warehouseId)).get();
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    db.delete(inventoryWarehouses).where(eq(inventoryWarehouses.id, warehouseId)).run();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Implement `app/api/admin/inventory-settings/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { inventorySettings } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return { error: 'No autorizado', status: 401 } as const;
  if (session.role !== 'admin') return { error: 'Prohibido', status: 403 } as const;
  return { session };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getDb();
  const row = db.select().from(inventorySettings).get();
  // The migration seeds exactly one row; this is a defensive fallback
  // in case a fresh DB somehow skipped it.
  return NextResponse.json(row ?? { rollingWindowDays: 60, daysOfStockThreshold: 7 });
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    const updates: Partial<{ rollingWindowDays: number; daysOfStockThreshold: number }> = {};
    if ('rollingWindowDays' in body) {
      if (typeof body.rollingWindowDays !== 'number' || body.rollingWindowDays <= 0) {
        return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
      }
      updates.rollingWindowDays = body.rollingWindowDays;
    }
    if ('daysOfStockThreshold' in body) {
      if (typeof body.daysOfStockThreshold !== 'number' || body.daysOfStockThreshold <= 0) {
        return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
      }
      updates.daysOfStockThreshold = body.daysOfStockThreshold;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const db = getDb();
    const row = db.select().from(inventorySettings).get();
    if (!row) return NextResponse.json({ error: 'Error interno' }, { status: 500 });

    db.update(inventorySettings).set(updates).where(eq(inventorySettings.id, row.id)).run();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test __tests__/integration/admin-inventory-config.integration.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 7: Build the admin config page**

Create `app/(app)/admin/config-inventario/page.tsx`. This is a Server
Component — it runs inside a real request scope, so `getSession()` is
correct here (unlike the API routes above):

```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { inventoryWarehouses, inventorySettings } from '@/lib/db/schema';
import { ConfigInventarioClient } from './config-client';

export default async function ConfigInventarioPage() {
  const session = await getSession();
  if (!session)                 redirect('/login');
  if (session.role !== 'admin') redirect('/reports/ventas');

  const db = getDb();
  const warehouses = db.select().from(inventoryWarehouses).all();
  const settingsRow = db.select().from(inventorySettings).get();

  return (
    <ConfigInventarioClient
      initialWarehouses={warehouses}
      initialSettings={settingsRow ?? { id: 0, rollingWindowDays: 60, daysOfStockThreshold: 7 }}
    />
  );
}
```

Create `app/(app)/admin/config-inventario/config-client.tsx`:

```tsx
'use client';

import { useState } from 'react';

interface Warehouse {
  id:     number;
  coAlma: string;
  label:  string;
  active: boolean;
}

interface Settings {
  id:                   number;
  rollingWindowDays:    number;
  daysOfStockThreshold: number;
}

interface Props {
  initialWarehouses: Warehouse[];
  initialSettings:   Settings;
}

export function ConfigInventarioClient({ initialWarehouses, initialSettings }: Props) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);
  const [settings, setSettings]     = useState<Settings>(initialSettings);
  const [newCoAlma, setNewCoAlma]   = useState('');
  const [newLabel, setNewLabel]     = useState('');
  const [error, setError]           = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const inputClass = `w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500`;

  async function handleAddWarehouse() {
    setError(null);
    const res = await fetch('/api/admin/inventory-warehouses', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ coAlma: newCoAlma, label: newLabel }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    const listRes = await fetch('/api/admin/inventory-warehouses');
    if (listRes.ok) setWarehouses(await listRes.json());
    setNewCoAlma(''); setNewLabel('');
  }

  async function handleToggleActive(warehouse: Warehouse) {
    await fetch(`/api/admin/inventory-warehouses/${warehouse.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ active: !warehouse.active }),
    });
    setWarehouses(prev => prev.map(w => w.id === warehouse.id ? { ...w, active: !w.active } : w));
  }

  async function handleDeleteWarehouse(id: number) {
    if (!confirm('¿Eliminar este almacén de la lista?')) return;
    const res = await fetch(`/api/admin/inventory-warehouses/${id}`, { method: 'DELETE' });
    if (res.ok) setWarehouses(prev => prev.filter(w => w.id !== id));
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/inventory-settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          rollingWindowDays: settings.rollingWindowDays,
          daysOfStockThreshold: settings.daysOfStockThreshold,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
      }
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Configuración de Inventario</h1>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Almacenes</h2>
        <p className="text-sm text-gray-500 mb-4">
          Almacenes de Profit Plus que el módulo de Inventario debe mostrar.
          Si esta lista está vacía, el módulo muestra todos los almacenes con
          stock registrado.
        </p>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Código', 'Nombre', 'Activo', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {warehouses.map(w => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-900">{w.coAlma}</td>
                  <td className="px-4 py-3 text-gray-700">{w.label}</td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={w.active}
                      onChange={() => handleToggleActive(w)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDeleteWarehouse(w.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {warehouses.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">
              No hay almacenes configurados — se mostrarán todos los almacenes con stock.
            </div>
          )}
        </div>

        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código (co_alma)</label>
            <input value={newCoAlma} onChange={e => setNewCoAlma(e.target.value)} className={inputClass} />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} className={inputClass} />
          </div>
          <button
            onClick={handleAddWarehouse}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
          >
            + Agregar
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Alertas de stock bajo</h2>
        <div className="flex gap-6 items-end">
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
    </div>
  );
}
```

- [ ] **Step 8: Add sidebar nav link**

Edit `components/sidebar.tsx`. Inside the `{user.role === 'admin' &&
(...)}` block, after the existing `/admin/users` link, add:

```tsx
<Link href="/admin/config-inventario" className={navClass('/admin/config-inventario')}>
  Config. Inventario
</Link>
```

- [ ] **Step 9: Manual verification**

Run: `bun dev`

1. Log in as an admin (seed one via `bun run seed` if needed).
2. Navigate to `/admin/config-inventario`.
3. Add a warehouse with `coAlma=14`, `label=Materia Prima` — confirm
   it appears in the table.
4. Toggle its active checkbox off and on — confirm it persists on
   page reload.
5. Change the days-of-stock threshold and save — confirm it persists
   on reload.
6. Log in (or switch) as a non-admin `user` and confirm
   `/admin/config-inventario` redirects to `/reports/ventas`.
7. On `/admin/users`, confirm the new "Inventario" checkbox column
   appears, toggling it works, and it's disabled+checked-looking for
   admin rows (shows "Incluido (admin)").

- [ ] **Step 10: Run the full test suite one more time**

Run: `bun run test`
Expected: same as Task 3 Step 7 — all new tests pass, only the ~7
pre-existing unrelated failures remain. This is the final check that
Task 0's `--isolate` fix holds with all four inventory test files
(Tasks 1-4) present together.

- [ ] **Step 11: Commit**

```bash
git add app/api/admin/inventory-warehouses app/api/admin/inventory-settings \
        "app/(app)/admin/config-inventario" components/sidebar.tsx \
        __tests__/integration/admin-inventory-config.integration.test.ts
git commit -m "feat: add admin inventory warehouse and threshold configuration"
```

---

## Out of Scope (this plan)

- The "Inventario" sidebar section for non-admin inventory managers
  (dashboard/items/adjustments nav links) — added by the plans that
  build those pages, since this plan has no pages for them to link to
  yet.
- The warehouse-list fallback query ("all warehouses with stock when
  unconfigured") — implemented by whichever plan first queries
  warehouses (dashboard, items, or adjustments).
- Any Profit Plus (MSSQL) changes — this plan only touches the app's
  own SQLite database.
- Retrofitting `getSession()` → `getSessionFromRequest()` in *other*
  existing routes not touched by this plan (e.g.
  `/api/admin/users/[id]/route.ts`, `/api/admin/users/[id]/reset-password/route.ts`).
  They remain correct in production (real request scope) but stay
  untestable-by-direct-import; only the files this plan already
  modifies got fixed as a side effect. Worth a dedicated follow-up if
  the team wants full route test coverage app-wide.
