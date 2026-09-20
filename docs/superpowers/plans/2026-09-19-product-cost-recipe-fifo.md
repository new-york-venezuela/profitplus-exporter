# Product Cost via Recipes + FIFO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user define a recipe (bill of materials) for a finished product and see its live manufacturing cost in USD, computed via FIFO from ProfitPlus's real cost-layer data.

**Architecture:** Recipes live in this app's own SQLite DB (new `recipes`/`recipe_lines` tables), each line referencing either a ProfitPlus article (`co_art`) or a manual (non-ERP) ingredient. A new `lib/costing/` module reads `saCostoHistoricoEntrada` (FIFO cost layers) and `saTasa` (USD rate) read-only from the ERP, computes cost on demand — no writes to ERP, no dependency on the unused `saArtCompuesto*` BOM tables. A new `recipes` module gate follows the existing `inventory`/`dwh` pattern.

**Tech Stack:** Next.js 16 App Router, Drizzle + `bun:sqlite` (app DB), `mssql` (ERP, read-only), Bun test, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-19-product-cost-recipe-fifo-design.md`

## Global Constraints

- Base ERP currency is `BSD`, not `BS` — always convert `saCostoHistoricoEntrada.costo` to USD via `saTasa` (`co_mone='USD'`), never assume a fixed rate.
- Never write to `saArtCompuesto*` or any other ERP table from this feature — read-only against ERP throughout v1.
- Every route: `getSessionFromRequest` → module-access check → 403, independently of the page-level check, per this repo's existing double-gate convention.
- `mssql` queries use `.input()` for every value — never string-concatenate into SQL.
- No caching of computed cost — it's a plain read, re-run on every request, by design (that's what makes it "live").

---

### Task 1: SQLite schema — `recipes`, `recipe_lines`, `recipes` module grant

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `drizzle/migrations/0003_<generated_name>.sql` (via `bun run db:generate`, not hand-written)
- Test: `__tests__/unit/db/recipes-schema.test.ts`

**Interfaces:**
- Produces: `recipes` table (`id`, `coArt` unique, `label`, `active`, `createdAt`, `updatedAt`), `recipeLines` table (`id`, `recipeId` FK cascade, `lineType: 'erp_article' | 'manual'`, `coArt` nullable, `manualLabel` nullable, `quantity: real`, `unit: text`, `manualUnitCostUsd` nullable real, `sortOrder`), and `userModules.module` enum extended with `'recipes'`. All later tasks import these from `@/lib/db/schema`.

- [ ] **Step 1: Add the schema to `lib/db/schema.ts`**

Change the `userModules` enum:

```ts
export const userModules = sqliteTable('user_modules', {
  id:     integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  module: text('module', { enum: ['inventory', 'dwh', 'recipes'] }).notNull(),
});
```

Append at the end of the file:

```ts
// ── Recipes / product costing module ───────────────────────────────

export const recipes = sqliteTable('recipes', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  coArt:     text('co_art').notNull().unique(),   // finished-good article this recipe produces (Profit Plus saArticulo.co_art)
  label:     text('label').notNull(),              // denormalized art_des snapshot, avoids a live ERP join on every list render
  active:    integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type Recipe    = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;

export const recipeLines = sqliteTable('recipe_lines', {
  id:                integer('id').primaryKey({ autoIncrement: true }),
  recipeId:          integer('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  lineType:          text('line_type', { enum: ['erp_article', 'manual'] }).notNull(),
  coArt:             text('co_art'),                // set iff lineType === 'erp_article'
  manualLabel:       text('manual_label'),           // set iff lineType === 'manual', e.g. "Agua"
  quantity:          real('quantity').notNull(),     // amount of this ingredient per 1 unit of the recipe's finished good
  unit:              text('unit').notNull(),         // free-text display label (KG, LTS, UNID, ...) — no conversion engine in v1
  manualUnitCostUsd: real('manual_unit_cost_usd'),    // set iff lineType === 'manual'; USD cost per `unit`, defaults to 0 until the user sets a real figure
  sortOrder:         integer('sort_order').notNull().default(0),
});

export type RecipeLine    = typeof recipeLines.$inferSelect;
export type NewRecipeLine = typeof recipeLines.$inferInsert;
```

- [ ] **Step 2: Generate the migration**

Run: `bun run db:generate`
Expected: a new file appears under `drizzle/migrations/`, e.g. `0003_<name>.sql`, containing `CREATE TABLE recipes ...` and `CREATE TABLE recipe_lines ...`. Open it and confirm both tables and the FK/cascade are present. The `module` enum change requires no migration (SQLite `text` column, TypeScript-only enum — same as the existing `AGENTS.md` note for adding a module).

- [ ] **Step 3: Write the failing test**

```ts
// __tests__/unit/db/recipes-schema.test.ts
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

describe('recipes', () => {
  test('stores a recipe with an erp_article line and a manual line, cascades on delete', () => {
    const now = Date.now();
    const recipe = db.insert(schema.recipes).values({
      coArt: '0000005', label: 'Baguette 4 Granos 220gr', active: true,
      createdAt: now, updatedAt: now,
    }).returning({ id: schema.recipes.id }).get();

    db.insert(schema.recipeLines).values([
      {
        recipeId: recipe!.id, lineType: 'erp_article', coArt: '0000083',
        manualLabel: null, quantity: 0.2, unit: 'KG', manualUnitCostUsd: null, sortOrder: 0,
      },
      {
        recipeId: recipe!.id, lineType: 'manual', coArt: null,
        manualLabel: 'Agua', quantity: 0.15, unit: 'LTS', manualUnitCostUsd: 0, sortOrder: 1,
      },
    ]).run();

    const lines = db.select().from(schema.recipeLines)
      .where(eq(schema.recipeLines.recipeId, recipe!.id)).all();
    expect(lines).toHaveLength(2);
    expect(lines.find(l => l.lineType === 'erp_article')?.coArt).toBe('0000083');
    expect(lines.find(l => l.lineType === 'manual')?.manualLabel).toBe('Agua');

    db.delete(schema.recipes).where(eq(schema.recipes.id, recipe!.id)).run();
    const afterDelete = db.select().from(schema.recipeLines)
      .where(eq(schema.recipeLines.recipeId, recipe!.id)).all();
    expect(afterDelete).toHaveLength(0);
  });

  test('coArt is unique across recipes', () => {
    const now = Date.now();
    db.insert(schema.recipes).values({
      coArt: '0000043', label: 'Demi Baguette', active: true, createdAt: now, updatedAt: now,
    }).run();

    expect(() => {
      db.insert(schema.recipes).values({
        coArt: '0000043', label: 'Duplicado', active: true, createdAt: now, updatedAt: now,
      }).run();
    }).toThrow();
  });
});

describe('user_modules recipes grant', () => {
  test('accepts the recipes module value', () => {
    const user = db.insert(schema.users).values({
      email: 'recetas@example.com', name: 'Recetas User', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: schema.users.id }).get();

    db.insert(schema.userModules).values({ userId: user!.id, module: 'recipes' }).run();

    const grants = db.select().from(schema.userModules)
      .where(eq(schema.userModules.userId, user!.id)).all();
    expect(grants[0]!.module).toBe('recipes');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/db/recipes-schema.test.ts`
Expected: FAIL — `schema.recipes` is undefined (before Step 1/2) or table doesn't exist (before Step 2).

- [ ] **Step 5: Apply Steps 1–2, run again**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/db/recipes-schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts drizzle/migrations __tests__/unit/db/recipes-schema.test.ts
git commit -m "feat: add recipes/recipe_lines tables and recipes module grant"
```

---

### Task 2: `hasRecipesAccess` module-gate helper

**Files:**
- Create: `lib/recipes/access.ts`
- Test: `__tests__/unit/recipes/access.test.ts`

**Interfaces:**
- Consumes: `schema.userModules`, `schema.users` from Task 1.
- Produces: `hasRecipesAccess(db, userId, role): Promise<boolean>` — used by every `/api/recetas/*` route and the `/recetas/*` pages (Tasks 8–12).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/recipes/access.test.ts
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from '@/lib/db/schema';
import { hasRecipesAccess } from '@/lib/recipes/access';

const sqlite = new Database(':memory:');
const db = drizzle(sqlite, { schema });

beforeAll(() => {
  migrate(db, { migrationsFolder: './drizzle/migrations' });
});

afterEach(() => {
  sqlite.exec('DELETE FROM user_modules');
  sqlite.exec('DELETE FROM users');
});

describe('hasRecipesAccess', () => {
  test('admin always has access, even with no module grant', async () => {
    const admin = db.insert(schema.users).values({
      email: 'admin@example.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: schema.users.id }).get();

    expect(await hasRecipesAccess(db, String(admin!.id), 'admin')).toBe(true);
  });

  test('regular user without a grant has no access', async () => {
    const user = db.insert(schema.users).values({
      email: 'user@example.com', name: 'User', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: schema.users.id }).get();

    expect(await hasRecipesAccess(db, String(user!.id), 'user')).toBe(false);
  });

  test('regular user with a recipes grant has access', async () => {
    const user = db.insert(schema.users).values({
      email: 'user2@example.com', name: 'User Two', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: schema.users.id }).get();

    db.insert(schema.userModules).values({ userId: user!.id, module: 'recipes' }).run();

    expect(await hasRecipesAccess(db, String(user!.id), 'user')).toBe(true);
  });

  test('a grant for a different module does not grant recipes access', async () => {
    const user = db.insert(schema.users).values({
      email: 'user3@example.com', name: 'User Three', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: schema.users.id }).get();

    db.insert(schema.userModules).values({ userId: user!.id, module: 'inventory' }).run();

    expect(await hasRecipesAccess(db, String(user!.id), 'user')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/recipes/access.test.ts`
Expected: FAIL — cannot find module `@/lib/recipes/access`.

- [ ] **Step 3: Implement**

```ts
// lib/recipes/access.ts
import { eq, and } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from '@/lib/db/schema';

export async function hasRecipesAccess(
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
        eq(schema.userModules.module, 'recipes'),
      ),
    )
    .get();

  return grant !== undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/recipes/access.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/recipes/access.ts __tests__/unit/recipes/access.test.ts
git commit -m "feat: add hasRecipesAccess module gate"
```

---

### Task 3: Admin module grant — `VALID_MODULES` + users UI checkbox

**Files:**
- Modify: `app/api/admin/users/[id]/modules/route.ts`
- Modify: `app/(app)/admin/users/users-client.tsx`
- Test: `__tests__/integration/admin-user-modules.integration.test.ts`

**Interfaces:**
- Consumes: nothing new — `'recipes'` is now a valid value of the same `module` enum from Task 1.
- Produces: admins can grant/revoke the `recipes` module the same way they already do `inventory`/`dwh`.

- [ ] **Step 1: Add a failing test case to the existing file**

This file only touches the SQLite admin DB (no ERP pool), so it runs with the
plain `test` command, not `test:mssql`. Insert this test into the existing
`describe('PUT /api/admin/users/:id/modules', ...)` block in
`__tests__/integration/admin-user-modules.integration.test.ts`, right after
the `'admin can grant the inventory module to a user'` test:

```ts
  test('admin can grant the recipes module to a user', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin5@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const target = db.insert(users).values({
      email: 'target5@x.com', name: 'Target', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;

    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });
    const request = buildRequest(token, {
      method: 'PUT',
      body: JSON.stringify({ modules: ['recipes'] }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: String(target.id) }) });
    expect(response.status).toBe(200);

    const grants = db.select().from(userModules).where(eq(userModules.userId, target.id)).all();
    expect(grants.map(g => g.module)).toEqual(['recipes']);
  });
```

- [ ] **Step 2: Run the test suite to confirm the new case fails**

Run: `bun test --isolate --env-file=.env.local __tests__/integration/admin-user-modules.integration.test.ts`
Expected: FAIL — `'recipes'` rejected as an invalid module (400 instead of 200).

- [ ] **Step 3: Update `VALID_MODULES`**

```ts
// app/api/admin/users/[id]/modules/route.ts
const VALID_MODULES = ['inventory', 'dwh', 'recipes'] as const;
```

- [ ] **Step 4: Add the checkbox column in `users-client.tsx`**

Generalize `handleToggleModule`'s type (it's already parameterized per `AGENTS.md`) and add a third `<th>`/`<td>` pair mirroring the existing `inventory`/`dwh` columns exactly — same `type="checkbox"`, `checked={user.modules.includes('recipes')}`, `onChange={() => handleToggleModule(user, 'recipes')}`. Update the function signature:

```ts
async function handleToggleModule(user: UserRow, moduleName: 'inventory' | 'dwh' | 'recipes') {
```

- [ ] **Step 5: Run the test to verify it passes**

Run the same command as Step 2.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/users/[id]/modules/route.ts "app/(app)/admin/users/users-client.tsx" __tests__/integration/admin-user-modules.integration.test.ts
git commit -m "feat: add recipes module to admin user-grant management"
```

---

### Task 4: FIFO layer-walk algorithm (pure function)

**Files:**
- Create: `lib/costing/fifo.ts`
- Test: `__tests__/unit/costing/fifo.test.ts`

**Interfaces:**
- Produces: `CostLayer { remaining: number; costBsd: number }` and `computeFifoCost(layers: CostLayer[], quantity: number): { costBsd: number; estimated: boolean; hasData: boolean }`. `layers` must already be sorted oldest-first by the caller (Task 6 does this via `ORDER BY fecha_emision ASC` and pre-filters `remaining > 0`). Consumed directly by Task 7.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/unit/costing/fifo.test.ts
import { describe, test, expect } from 'bun:test';
import { computeFifoCost, type CostLayer } from '@/lib/costing/fifo';

describe('computeFifoCost', () => {
  test('a single layer fully covers the needed quantity', () => {
    const layers: CostLayer[] = [{ remaining: 100, costBsd: 10 }];
    const result = computeFifoCost(layers, 40);
    expect(result).toEqual({ costBsd: 400, estimated: false, hasData: true });
  });

  test('needed quantity spans two layers, oldest first', () => {
    const layers: CostLayer[] = [
      { remaining: 10, costBsd: 100 },  // oldest
      { remaining: 50, costBsd: 200 },  // newer
    ];
    // 10 units @ 100 + 5 units @ 200 = 1000 + 1000 = 2000
    const result = computeFifoCost(layers, 15);
    expect(result).toEqual({ costBsd: 2000, estimated: false, hasData: true });
  });

  test('needed quantity exceeds all remaining layers: shortfall priced at the most recent layer, flagged estimated', () => {
    const layers: CostLayer[] = [
      { remaining: 10, costBsd: 100 },
      { remaining: 5, costBsd: 200 },
    ];
    // covers 15 fully (10*100 + 5*200 = 2000), shortfall of 5 priced at the most recent layer's cost (200) = 1000
    const result = computeFifoCost(layers, 20);
    expect(result).toEqual({ costBsd: 3000, estimated: true, hasData: true });
  });

  test('zero layers: no cost data at all', () => {
    const result = computeFifoCost([], 10);
    expect(result).toEqual({ costBsd: 0, estimated: false, hasData: false });
  });

  test('quantity of zero costs nothing even with layers present', () => {
    const layers: CostLayer[] = [{ remaining: 10, costBsd: 100 }];
    const result = computeFifoCost(layers, 0);
    expect(result).toEqual({ costBsd: 0, estimated: false, hasData: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/costing/fifo.test.ts`
Expected: FAIL — cannot find module `@/lib/costing/fifo`.

- [ ] **Step 3: Implement**

```ts
// lib/costing/fifo.ts
export interface CostLayer {
  remaining: number;   // cantidad - cantidad_usada, already computed and pre-filtered (> 0) by the caller
  costBsd:   number;   // saCostoHistoricoEntrada.costo for this layer
}

export interface FifoCostResult {
  costBsd:   number;
  estimated: boolean;  // true if the requested quantity exceeded total remaining stock (shortfall priced at the most recent layer)
  hasData:   boolean;  // false only when `layers` is empty — no purchase history at all for this article
}

/**
 * Walks cost layers oldest-first, consuming `quantity` from each layer's
 * remaining balance until covered. `layers` must already be sorted
 * oldest-first (ascending fecha_emision).
 */
export function computeFifoCost(layers: CostLayer[], quantity: number): FifoCostResult {
  if (layers.length === 0) {
    return { costBsd: 0, estimated: false, hasData: false };
  }

  let remainingNeeded = quantity;
  let totalCostBsd = 0;

  for (const layer of layers) {
    if (remainingNeeded <= 0) break;
    const take = Math.min(layer.remaining, remainingNeeded);
    totalCostBsd += take * layer.costBsd;
    remainingNeeded -= take;
  }

  if (remainingNeeded > 0) {
    const mostRecentLayer = layers[layers.length - 1]!;
    totalCostBsd += remainingNeeded * mostRecentLayer.costBsd;
    return { costBsd: totalCostBsd, estimated: true, hasData: true };
  }

  return { costBsd: totalCostBsd, estimated: false, hasData: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/costing/fifo.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/costing/fifo.ts __tests__/unit/costing/fifo.test.ts
git commit -m "feat: add pure FIFO cost-layer walk algorithm"
```

---

### Task 5: USD rate lookup (`saTasa`)

**Files:**
- Create: `lib/costing/currency.ts`
- Test: `__tests__/integration/costing-currency.integration.test.ts`

**Interfaces:**
- Consumes: `sql.ConnectionPool` from `mssql` (via `getPool()` in `lib/db/mssql.ts`, same as every other ERP query in this repo).
- Produces: `getUsdRateAsOf(pool, asOf: Date): Promise<{ rate: number; date: Date } | null>` and `convertBsdToUsd(amountBsd: number, rate: number): number`. Consumed by Task 7.

- [ ] **Step 1: Write the failing test**

This test hits the real local ERP mssql container (`docker compose -f docker/docker-compose.yml up -d`, same one every other `.integration.test.ts` in `__tests__/integration/` already assumes is running for `bun run test:mssql`).

```ts
// __tests__/integration/costing-currency.integration.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { getUsdRateAsOf, convertBsdToUsd } from '@/lib/costing/currency';

function buildMssqlConfig(): sql.config {
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
let latestUsdTasa: { fecha: Date; tasa_v: number };

beforeAll(async () => {
  pool = await new sql.ConnectionPool(buildMssqlConfig()).connect();
  const result = await pool.request()
    .query(`SELECT TOP 1 fecha, tasa_v FROM saTasa WHERE co_mone = 'USD' ORDER BY fecha DESC`);
  latestUsdTasa = result.recordset[0];
});

afterAll(async () => {
  await pool.close();
});

describe('getUsdRateAsOf', () => {
  test('returns the most recent USD rate on or before the given date', async () => {
    const asOf = new Date(latestUsdTasa.fecha.getTime() + 24 * 60 * 60 * 1000); // one day after the latest known rate
    const result = await getUsdRateAsOf(pool, asOf);
    expect(result).not.toBeNull();
    expect(result!.rate).toBeCloseTo(latestUsdTasa.tasa_v, 5);
  });

  test('returns null when asked for a date before any USD rate exists', async () => {
    const result = await getUsdRateAsOf(pool, new Date('1999-01-01'));
    expect(result).toBeNull();
  });
});

describe('convertBsdToUsd', () => {
  test('divides the BSD amount by the rate (Bs per 1 USD)', () => {
    expect(convertBsdToUsd(721.35, 721.35)).toBeCloseTo(1, 5);
    expect(convertBsdToUsd(1000, 500)).toBeCloseTo(2, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/integration/costing-currency.integration.test.ts`
Expected: FAIL — cannot find module `@/lib/costing/currency`.

- [ ] **Step 3: Implement**

```ts
// lib/costing/currency.ts
import sql from 'mssql';

export interface UsdRate {
  rate: number;
  date: Date;
}

export async function getUsdRateAsOf(pool: sql.ConnectionPool, asOf: Date): Promise<UsdRate | null> {
  const result = await pool.request()
    .input('asOf', sql.DateTime, asOf)
    .query(`
      SELECT TOP 1 fecha, tasa_v
      FROM saTasa
      WHERE co_mone = 'USD' AND fecha <= @asOf
      ORDER BY fecha DESC
    `);

  const row = result.recordset[0];
  if (!row) return null;

  return { rate: Number(row.tasa_v), date: new Date(row.fecha) };
}

/** `rate` is Bs per 1 USD (saTasa.tasa_v convention). */
export function convertBsdToUsd(amountBsd: number, rate: number): number {
  return amountBsd / rate;
}
```

- [ ] **Step 4: Run test to verify it passes**

Prerequisite: `docker compose -f docker/docker-compose.yml up -d` (skip if already running — check with `docker ps`).
Run: `bun test --isolate --env-file=.env.local __tests__/integration/costing-currency.integration.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/costing/currency.ts __tests__/integration/costing-currency.integration.test.ts
git commit -m "feat: add USD rate lookup against saTasa"
```

---

### Task 6: FIFO cost-layer query (`saCostoHistoricoEntrada`)

**Files:**
- Create: `lib/costing/erp-layers.ts`
- Test: `__tests__/integration/costing-erp-layers.integration.test.ts`

**Interfaces:**
- Consumes: `sql.ConnectionPool`, `CostLayer` type from Task 4.
- Produces: `getCostLayers(pool, coArt: string): Promise<CostLayer[]>`, sorted oldest-first, pre-filtered to `remaining > 0`. Consumed by Task 7.

- [ ] **Step 1: Write the failing test**

Uses two real articles already known from live ERP research: `0000083` (Harina Panadera 45Kg Atlas — has purchase layers, none consumed in the restored snapshot) and `0000080` (Harina de trigo para pizzas 1 kg — confirmed zero layers, ever).

```ts
// __tests__/integration/costing-erp-layers.integration.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { getCostLayers } from '@/lib/costing/erp-layers';

function buildMssqlConfig(): sql.config {
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

beforeAll(async () => {
  pool = await new sql.ConnectionPool(buildMssqlConfig()).connect();
});

afterAll(async () => {
  await pool.close();
});

describe('getCostLayers', () => {
  test('returns layers for a real article, oldest first, with positive remaining only', async () => {
    const layers = await getCostLayers(pool, '0000083');
    expect(layers.length).toBeGreaterThan(0);
    for (const layer of layers) {
      expect(layer.remaining).toBeGreaterThan(0);
      expect(layer.costBsd).toBeGreaterThan(0);
    }

    // independently fetch raw rows to confirm oldest-first ordering matches fecha_emision
    const raw = await pool.request().input('coArt', sql.Char(30), '0000083').query(`
      SELECT CHE.cantidad, CHE.cantidad_usada, CHE.costo, CHE.fecha_emision
      FROM saCostoHistoricoEntrada CHE
      JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
      WHERE A.co_art = @coArt AND (CHE.cantidad - CHE.cantidad_usada) > 0
      ORDER BY CHE.fecha_emision ASC
    `);
    expect(layers).toHaveLength(raw.recordset.length);
    expect(layers[0]!.remaining).toBeCloseTo(raw.recordset[0]!.cantidad - raw.recordset[0]!.cantidad_usada, 5);
    expect(layers[0]!.costBsd).toBeCloseTo(raw.recordset[0]!.costo, 5);
  });

  test('returns an empty array for an article with no purchase history', async () => {
    const layers = await getCostLayers(pool, '0000080');
    expect(layers).toEqual([]);
  });

  test('returns an empty array for a nonexistent article code', async () => {
    const layers = await getCostLayers(pool, 'NOEXISTE999');
    expect(layers).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/integration/costing-erp-layers.integration.test.ts`
Expected: FAIL — cannot find module `@/lib/costing/erp-layers`.

- [ ] **Step 3: Implement**

```ts
// lib/costing/erp-layers.ts
import sql from 'mssql';
import type { CostLayer } from './fifo';

export async function getCostLayers(pool: sql.ConnectionPool, coArt: string): Promise<CostLayer[]> {
  const result = await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .query(`
      SELECT CHE.cantidad, CHE.cantidad_usada, CHE.costo
      FROM saCostoHistoricoEntrada CHE
      JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
      WHERE A.co_art = @coArt AND (CHE.cantidad - CHE.cantidad_usada) > 0
      ORDER BY CHE.fecha_emision ASC
    `);

  return result.recordset.map(row => ({
    remaining: Number(row.cantidad) - Number(row.cantidad_usada),
    costBsd:   Number(row.costo),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test --isolate --env-file=.env.local __tests__/integration/costing-erp-layers.integration.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/costing/erp-layers.ts __tests__/integration/costing-erp-layers.integration.test.ts
git commit -m "feat: add FIFO cost-layer query against saCostoHistoricoEntrada"
```

---

### Task 7: Product cost orchestration

**Files:**
- Create: `lib/costing/product-cost.ts`
- Test: `__tests__/integration/costing-product-cost.integration.test.ts`

**Interfaces:**
- Consumes: `getCostLayers` (Task 6), `computeFifoCost` (Task 4), `getUsdRateAsOf`/`convertBsdToUsd` (Task 5).
- Produces:
  ```ts
  export interface RecipeLineInput {
    lineType: 'erp_article' | 'manual';
    coArt: string | null;
    quantity: number;
    manualUnitCostUsd: number | null;
  }
  export interface LineCostResult {
    lineType: 'erp_article' | 'manual';
    coArt: string | null;
    quantity: number;
    costUsd: number | null;   // null = no cost data at all for this line
    estimated: boolean;
  }
  export interface ProductCostResult {
    totalUsd: number;          // sum of all lines with available data (nulls contribute 0)
    lines: LineCostResult[];
    asOfRateDate: string | null; // ISO date of the USD rate used, or null if no rate was available
    incomplete: boolean;         // true if any line has costUsd === null or no USD rate was found
  }
  export async function computeProductCost(pool: sql.ConnectionPool, lines: RecipeLineInput[], asOf?: Date): Promise<ProductCostResult>
  ```
  Consumed by Task 9 (the cost API route).

- [ ] **Step 1: Write the failing test**

Reuses `0000083` (Harina Panadera, real layers) and `0000080` (zero layers) from Task 6, plus a manual line.

```ts
// __tests__/integration/costing-product-cost.integration.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { computeProductCost, type RecipeLineInput } from '@/lib/costing/product-cost';
import { getCostLayers } from '@/lib/costing/erp-layers';
import { computeFifoCost } from '@/lib/costing/fifo';
import { getUsdRateAsOf, convertBsdToUsd } from '@/lib/costing/currency';

function buildMssqlConfig(): sql.config {
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

beforeAll(async () => {
  pool = await new sql.ConnectionPool(buildMssqlConfig()).connect();
});

afterAll(async () => {
  await pool.close();
});

describe('computeProductCost', () => {
  test('combines an erp_article line and a manual line into a USD total, matching an independently hand-computed expectation', async () => {
    const asOf = new Date();
    const quantity = 0.5;

    const lines: RecipeLineInput[] = [
      { lineType: 'erp_article', coArt: '0000083', quantity, manualUnitCostUsd: null },
      { lineType: 'manual', coArt: null, quantity: 1, manualUnitCostUsd: 0.10 },
    ];

    const result = await computeProductCost(pool, lines, asOf);

    // Hand-compute the expected erp_article line from the same primitives, independently of computeProductCost's internals.
    const layers = await getCostLayers(pool, '0000083');
    const fifo = computeFifoCost(layers, quantity);
    const rate = await getUsdRateAsOf(pool, asOf);
    const expectedErpLineUsd = convertBsdToUsd(fifo.costBsd, rate!.rate);

    const erpLine = result.lines.find(l => l.lineType === 'erp_article')!;
    expect(erpLine.costUsd).toBeCloseTo(expectedErpLineUsd, 5);
    expect(erpLine.estimated).toBe(fifo.estimated);

    const manualLine = result.lines.find(l => l.lineType === 'manual')!;
    expect(manualLine.costUsd).toBeCloseTo(0.10, 5);
    expect(manualLine.estimated).toBe(false);

    expect(result.totalUsd).toBeCloseTo(expectedErpLineUsd + 0.10, 5);
    expect(result.incomplete).toBe(false);
    expect(result.asOfRateDate).not.toBeNull();
  });

  test('an erp_article line with zero purchase history has null cost and marks the result incomplete', async () => {
    const lines: RecipeLineInput[] = [
      { lineType: 'erp_article', coArt: '0000080', quantity: 1, manualUnitCostUsd: null },
    ];

    const result = await computeProductCost(pool, lines, new Date());

    expect(result.lines[0]!.costUsd).toBeNull();
    expect(result.incomplete).toBe(true);
    expect(result.totalUsd).toBe(0);
  });

  test('a manual line with no manualUnitCostUsd set defaults to 0, not null', async () => {
    const lines: RecipeLineInput[] = [
      { lineType: 'manual', coArt: null, quantity: 5, manualUnitCostUsd: null },
    ];

    const result = await computeProductCost(pool, lines, new Date());

    expect(result.lines[0]!.costUsd).toBe(0);
    expect(result.incomplete).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/integration/costing-product-cost.integration.test.ts`
Expected: FAIL — cannot find module `@/lib/costing/product-cost`.

- [ ] **Step 3: Implement**

```ts
// lib/costing/product-cost.ts
import sql from 'mssql';
import { getCostLayers } from './erp-layers';
import { computeFifoCost } from './fifo';
import { getUsdRateAsOf, convertBsdToUsd } from './currency';

export interface RecipeLineInput {
  lineType: 'erp_article' | 'manual';
  coArt: string | null;
  quantity: number;
  manualUnitCostUsd: number | null;
}

export interface LineCostResult {
  lineType: 'erp_article' | 'manual';
  coArt: string | null;
  quantity: number;
  costUsd: number | null;
  estimated: boolean;
}

export interface ProductCostResult {
  totalUsd: number;
  lines: LineCostResult[];
  asOfRateDate: string | null;
  incomplete: boolean;
}

export async function computeProductCost(
  pool: sql.ConnectionPool,
  lines: RecipeLineInput[],
  asOf: Date = new Date(),
): Promise<ProductCostResult> {
  const usdRate = await getUsdRateAsOf(pool, asOf);

  const lineResults: LineCostResult[] = [];
  let incomplete = usdRate === null && lines.some(l => l.lineType === 'erp_article');

  for (const line of lines) {
    if (line.lineType === 'manual') {
      lineResults.push({
        lineType: 'manual',
        coArt: null,
        quantity: line.quantity,
        costUsd: line.quantity * (line.manualUnitCostUsd ?? 0),
        estimated: false,
      });
      continue;
    }

    const layers = await getCostLayers(pool, line.coArt!);
    const fifo = computeFifoCost(layers, line.quantity);

    if (!fifo.hasData || usdRate === null) {
      incomplete = true;
      lineResults.push({
        lineType: 'erp_article',
        coArt: line.coArt,
        quantity: line.quantity,
        costUsd: null,
        estimated: false,
      });
      continue;
    }

    if (fifo.estimated) incomplete = true;

    lineResults.push({
      lineType: 'erp_article',
      coArt: line.coArt,
      quantity: line.quantity,
      costUsd: convertBsdToUsd(fifo.costBsd, usdRate.rate),
      estimated: fifo.estimated,
    });
  }

  const totalUsd = lineResults.reduce((sum, l) => sum + (l.costUsd ?? 0), 0);

  return {
    totalUsd,
    lines: lineResults,
    asOfRateDate: usdRate ? usdRate.date.toISOString() : null,
    incomplete,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test --isolate --env-file=.env.local __tests__/integration/costing-product-cost.integration.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/costing/product-cost.ts __tests__/integration/costing-product-cost.integration.test.ts
git commit -m "feat: add product-cost orchestration combining FIFO layers and USD conversion"
```

---

### Task 8: Recipe CRUD API routes

**Files:**
- Create: `app/api/recetas/recipes/route.ts` (GET list, POST create)
- Create: `app/api/recetas/recipes/[id]/route.ts` (GET one with lines, PUT replace, DELETE)
- Test: `__tests__/integration/recetas-recipes-crud.integration.test.ts`

**Interfaces:**
- Consumes: `hasRecipesAccess` (Task 2), `getSessionFromRequest` (existing, `@/lib/inventory/access`), `schema.recipes`/`schema.recipeLines` (Task 1).
- Produces: the HTTP contract Task 11 (recipe editor UI) calls against.
  - `GET /api/recetas/recipes` → `{ id, coArt, label, active }[]`
  - `POST /api/recetas/recipes` body `{ coArt, label }` → `201 { id }` or `400` (missing fields / duplicate `coArt`)
  - `GET /api/recetas/recipes/[id]` → `{ id, coArt, label, active, lines: { id, lineType, coArt, manualLabel, quantity, unit, manualUnitCostUsd }[] }` or `404`
  - `PUT /api/recetas/recipes/[id]` body `{ label, active, lines: { lineType, coArt, manualLabel, quantity, unit, manualUnitCostUsd }[] }` → `200 { ok: true }` (full replace of lines) or `404`/`400`
  - `DELETE /api/recetas/recipes/[id]` → `200 { ok: true }` or `404`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/integration/recetas-recipes-crud.integration.test.ts
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules, recipes, recipeLines } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { GET as listRecipes, POST as createRecipe } from '@/app/api/recetas/recipes/route';
import { GET as getRecipe, PUT as putRecipe, DELETE as deleteRecipe } from '@/app/api/recetas/recipes/[id]/route';

function buildRequest(token: string | null, init: { method: string; body?: string }, url = 'http://localhost:3000/api/test'): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `session=${token}`;
  return new NextRequest(url, { method: init.method, body: init.body, headers });
}

function resetDb() {
  const db = getDb();
  db.delete(recipeLines).run();
  db.delete(recipes).run();
  db.delete(userModules).run();
  db.delete(users).run();
}

let userToken: string;
let adminToken: string;

beforeEach(async () => {
  resetDb();
  const db = getDb();
  const admin = db.insert(users).values({
    email: 'admin@test.com', name: 'Admin', passwordHash: 'x', role: 'admin', createdAt: Date.now(),
  }).returning({ id: users.id }).get();
  adminToken = await signToken({ sub: String(admin!.id), role: 'admin', name: 'Admin' });

  const grantedUser = db.insert(users).values({
    email: 'user@test.com', name: 'User', passwordHash: 'x', role: 'user', createdAt: Date.now(),
  }).returning({ id: users.id }).get();
  db.insert(userModules).values({ userId: grantedUser!.id, module: 'recipes' }).run();
  userToken = await signToken({ sub: String(grantedUser!.id), role: 'user', name: 'User' });
});

afterEach(() => resetDb());

describe('recipes CRUD', () => {
  test('rejects an unauthenticated request', async () => {
    const res = await listRecipes(buildRequest(null, { method: 'GET' }));
    expect(res.status).toBe(401);
  });

  test('rejects a user without the recipes grant', async () => {
    const db = getDb();
    const ungranted = db.insert(users).values({
      email: 'nogrant@test.com', name: 'No Grant', passwordHash: 'x', role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get();
    const token = await signToken({ sub: String(ungranted!.id), role: 'user', name: 'No Grant' });

    const res = await listRecipes(buildRequest(token, { method: 'GET' }));
    expect(res.status).toBe(403);
  });

  test('creates a recipe and lists it', async () => {
    const createRes = await createRecipe(buildRequest(userToken, {
      method: 'POST',
      body: JSON.stringify({ coArt: '0000005', label: 'Baguette 4 Granos 220gr' }),
    }));
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.id).toBeGreaterThan(0);

    const listRes = await listRecipes(buildRequest(userToken, { method: 'GET' }));
    const list = await listRes.json();
    expect(list).toHaveLength(1);
    expect(list[0].coArt).toBe('0000005');
  });

  test('rejects creating a duplicate coArt', async () => {
    await createRecipe(buildRequest(userToken, {
      method: 'POST', body: JSON.stringify({ coArt: '0000005', label: 'Baguette' }),
    }));
    const dup = await createRecipe(buildRequest(userToken, {
      method: 'POST', body: JSON.stringify({ coArt: '0000005', label: 'Otra vez' }),
    }));
    expect(dup.status).toBe(400);
  });

  test('gets a recipe with its lines, updates lines via full replace, then deletes it', async () => {
    const createRes = await createRecipe(buildRequest(userToken, {
      method: 'POST', body: JSON.stringify({ coArt: '0000005', label: 'Baguette 4 Granos 220gr' }),
    }));
    const { id } = await createRes.json();

    const putRes = await putRecipe(
      buildRequest(userToken, {
        method: 'PUT',
        body: JSON.stringify({
          label: 'Baguette 4 Granos 220gr', active: true,
          lines: [
            { lineType: 'erp_article', coArt: '0000083', manualLabel: null, quantity: 0.2, unit: 'KG', manualUnitCostUsd: null },
            { lineType: 'manual', coArt: null, manualLabel: 'Agua', quantity: 0.15, unit: 'LTS', manualUnitCostUsd: 0 },
          ],
        }),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    );
    expect(putRes.status).toBe(200);

    const getRes = await getRecipe(buildRequest(userToken, { method: 'GET' }), { params: Promise.resolve({ id: String(id) }) });
    const fetched = await getRes.json();
    expect(fetched.lines).toHaveLength(2);
    expect(fetched.lines.find((l: { lineType: string }) => l.lineType === 'manual').manualLabel).toBe('Agua');

    // full replace: saving again with one line should drop the other
    await putRecipe(
      buildRequest(userToken, {
        method: 'PUT',
        body: JSON.stringify({
          label: 'Baguette 4 Granos 220gr', active: true,
          lines: [{ lineType: 'erp_article', coArt: '0000083', manualLabel: null, quantity: 0.25, unit: 'KG', manualUnitCostUsd: null }],
        }),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    );
    const getRes2 = await getRecipe(buildRequest(userToken, { method: 'GET' }), { params: Promise.resolve({ id: String(id) }) });
    const fetched2 = await getRes2.json();
    expect(fetched2.lines).toHaveLength(1);
    expect(fetched2.lines[0].quantity).toBe(0.25);

    const deleteRes = await deleteRecipe(buildRequest(userToken, { method: 'DELETE' }), { params: Promise.resolve({ id: String(id) }) });
    expect(deleteRes.status).toBe(200);

    const getRes3 = await getRecipe(buildRequest(userToken, { method: 'GET' }), { params: Promise.resolve({ id: String(id) }) });
    expect(getRes3.status).toBe(404);
  });

  test('returns 404 for a nonexistent recipe id', async () => {
    const res = await getRecipe(buildRequest(userToken, { method: 'GET' }), { params: Promise.resolve({ id: '999999' }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/integration/recetas-recipes-crud.integration.test.ts`
Expected: FAIL — cannot find module `@/app/api/recetas/recipes/route`.

- [ ] **Step 3: Implement `app/api/recetas/recipes/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { hasRecipesAccess } from '@/lib/recipes/access';
import { getDb } from '@/lib/db/sqlite';
import { recipes } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasRecipesAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const rows = db.select().from(recipes).all();
  return NextResponse.json(rows.map(r => ({ id: r.id, coArt: r.coArt, label: r.label, active: r.active })));
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasRecipesAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.coArt !== 'string' || body.coArt.trim() === '' || typeof body.label !== 'string' || body.label.trim() === '') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const existing = db.select({ id: recipes.id }).from(recipes).where(eq(recipes.coArt, body.coArt.trim())).get();
  if (existing) {
    return NextResponse.json({ error: 'Ya existe una receta para este artículo' }, { status: 400 });
  }

  const now = Date.now();
  const created = db.insert(recipes).values({
    coArt: body.coArt.trim(), label: body.label.trim(), active: true, createdAt: now, updatedAt: now,
  }).returning({ id: recipes.id }).get();

  return NextResponse.json({ id: created!.id }, { status: 201 });
}
```

- [ ] **Step 4: Implement `app/api/recetas/recipes/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { hasRecipesAccess } from '@/lib/recipes/access';
import { getDb } from '@/lib/db/sqlite';
import { recipes, recipeLines } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

interface LineInput {
  lineType: 'erp_article' | 'manual';
  coArt: string | null;
  manualLabel: string | null;
  quantity: number;
  unit: string;
  manualUnitCostUsd: number | null;
}

function isValidLine(line: unknown): line is LineInput {
  if (!line || typeof line !== 'object') return false;
  const l = line as Record<string, unknown>;
  if (l.lineType !== 'erp_article' && l.lineType !== 'manual') return false;
  if (typeof l.quantity !== 'number' || !isFinite(l.quantity) || l.quantity <= 0) return false;
  if (typeof l.unit !== 'string' || l.unit.trim() === '') return false;
  if (l.lineType === 'erp_article' && (typeof l.coArt !== 'string' || l.coArt.trim() === '')) return false;
  if (l.lineType === 'manual' && (typeof l.manualLabel !== 'string' || l.manualLabel.trim() === '')) return false;
  return true;
}

async function authorize(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return { error: 'No autorizado', status: 401 } as const;
  const db = getDb();
  const allowed = await hasRecipesAccess(db, session.sub, session.role);
  if (!allowed) return { error: 'Prohibido', status: 403 } as const;
  return { session } as const;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const db = getDb();
  const recipe = db.select().from(recipes).where(eq(recipes.id, Number(id))).get();
  if (!recipe) return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 });

  const lines = db.select().from(recipeLines)
    .where(eq(recipeLines.recipeId, recipe.id))
    .orderBy(recipeLines.sortOrder)
    .all();

  return NextResponse.json({
    id: recipe.id, coArt: recipe.coArt, label: recipe.label, active: recipe.active,
    lines: lines.map(l => ({
      id: l.id, lineType: l.lineType, coArt: l.coArt, manualLabel: l.manualLabel,
      quantity: l.quantity, unit: l.unit, manualUnitCostUsd: l.manualUnitCostUsd,
    })),
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const db = getDb();
  const recipe = db.select().from(recipes).where(eq(recipes.id, Number(id))).get();
  if (!recipe) return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.label !== 'string' || body.label.trim() === '' || typeof body.active !== 'boolean' || !Array.isArray(body.lines)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  if (!body.lines.every(isValidLine)) {
    return NextResponse.json({ error: 'Renglón de receta inválido' }, { status: 400 });
  }

  db.update(recipes).set({ label: body.label.trim(), active: body.active, updatedAt: Date.now() }).where(eq(recipes.id, recipe.id)).run();

  db.delete(recipeLines).where(eq(recipeLines.recipeId, recipe.id)).run();
  if (body.lines.length > 0) {
    db.insert(recipeLines).values(
      (body.lines as LineInput[]).map((line, index) => ({
        recipeId: recipe.id,
        lineType: line.lineType,
        coArt: line.lineType === 'erp_article' ? line.coArt!.trim() : null,
        manualLabel: line.lineType === 'manual' ? line.manualLabel!.trim() : null,
        quantity: line.quantity,
        unit: line.unit.trim(),
        manualUnitCostUsd: line.lineType === 'manual' ? (line.manualUnitCostUsd ?? 0) : null,
        sortOrder: index,
      })),
    ).run();
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const db = getDb();
  const recipe = db.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, Number(id))).get();
  if (!recipe) return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 });

  db.delete(recipes).where(eq(recipes.id, recipe.id)).run();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test --isolate --env-file=.env.local __tests__/integration/recetas-recipes-crud.integration.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add app/api/recetas/recipes __tests__/integration/recetas-recipes-crud.integration.test.ts
git commit -m "feat: add recipe CRUD API routes"
```

---

### Task 9: Recipe cost API route

**Files:**
- Create: `app/api/recetas/recipes/[id]/cost/route.ts`
- Test: `__tests__/integration/recetas-recipe-cost.integration.test.ts`

**Interfaces:**
- Consumes: `computeProductCost` (Task 7), `getPool` (`@/lib/db/mssql`), `recipes`/`recipeLines` (Task 1).
- Produces: `GET /api/recetas/recipes/[id]/cost` → `200 ProductCostResult` (shape from Task 7) or `404` if the recipe doesn't exist. Consumed by Task 11 (cost panel).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/integration/recetas-recipe-cost.integration.test.ts
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules, recipes, recipeLines } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { GET as getCost } from '@/app/api/recetas/recipes/[id]/cost/route';

function buildRequest(token: string, url = 'http://localhost:3000/api/test'): NextRequest {
  return new NextRequest(url, { headers: { Cookie: `session=${token}` } });
}

function resetDb() {
  const db = getDb();
  db.delete(recipeLines).run();
  db.delete(recipes).run();
  db.delete(userModules).run();
  db.delete(users).run();
}

let token: string;

beforeEach(async () => {
  resetDb();
  const db = getDb();
  const user = db.insert(users).values({
    email: 'user@test.com', name: 'User', passwordHash: 'x', role: 'user', createdAt: Date.now(),
  }).returning({ id: users.id }).get();
  db.insert(userModules).values({ userId: user!.id, module: 'recipes' }).run();
  token = await signToken({ sub: String(user!.id), role: 'user', name: 'User' });
});

afterEach(() => resetDb());

describe('GET /api/recetas/recipes/[id]/cost', () => {
  test('computes the live cost for a recipe with an ERP line and a manual line', async () => {
    const db = getDb();
    const now = Date.now();
    const recipe = db.insert(recipes).values({
      coArt: '0000005', label: 'Baguette 4 Granos 220gr', active: true, createdAt: now, updatedAt: now,
    }).returning({ id: recipes.id }).get();

    db.insert(recipeLines).values([
      { recipeId: recipe!.id, lineType: 'erp_article', coArt: '0000083', manualLabel: null, quantity: 0.2, unit: 'KG', manualUnitCostUsd: null, sortOrder: 0 },
      { recipeId: recipe!.id, lineType: 'manual', coArt: null, manualLabel: 'Agua', quantity: 0.15, unit: 'LTS', manualUnitCostUsd: 0.05, sortOrder: 1 },
    ]).run();

    const res = await getCost(buildRequest(token), { params: Promise.resolve({ id: String(recipe!.id) }) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.lines).toHaveLength(2);
    expect(body.totalUsd).toBeGreaterThan(0);
    const manualLine = body.lines.find((l: { lineType: string }) => l.lineType === 'manual');
    expect(manualLine.costUsd).toBeCloseTo(0.15 * 0.05, 5);
  });

  test('returns 404 for a nonexistent recipe', async () => {
    const res = await getCost(buildRequest(token), { params: Promise.resolve({ id: '999999' }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/integration/recetas-recipe-cost.integration.test.ts`
Expected: FAIL — cannot find module `@/app/api/recetas/recipes/[id]/cost/route`.

- [ ] **Step 3: Implement**

```ts
// app/api/recetas/recipes/[id]/cost/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { hasRecipesAccess } from '@/lib/recipes/access';
import { getDb } from '@/lib/db/sqlite';
import { recipes, recipeLines } from '@/lib/db/schema';
import { getPool } from '@/lib/db/mssql';
import { computeProductCost, type RecipeLineInput } from '@/lib/costing/product-cost';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasRecipesAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const { id } = await params;
  const recipe = db.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, Number(id))).get();
  if (!recipe) return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 });

  const lines = db.select().from(recipeLines)
    .where(eq(recipeLines.recipeId, recipe.id))
    .orderBy(recipeLines.sortOrder)
    .all();

  const input: RecipeLineInput[] = lines.map(l => ({
    lineType: l.lineType,
    coArt: l.coArt,
    quantity: l.quantity,
    manualUnitCostUsd: l.manualUnitCostUsd,
  }));

  try {
    const pool = await getPool();
    const result = await computeProductCost(pool, input);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Product cost computation error:', error);
    return NextResponse.json({ error: 'Error al calcular el costo' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test --isolate --env-file=.env.local __tests__/integration/recetas-recipe-cost.integration.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/recetas/recipes/\[id\]/cost __tests__/integration/recetas-recipe-cost.integration.test.ts
git commit -m "feat: add live recipe cost API route"
```

---

### Task 10: Recipes list page

**Files:**
- Create: `app/(app)/recetas/page.tsx`
- Create: `app/(app)/recetas/recetas-client.tsx`
- Create: `content/help/recetas.md`

**Interfaces:**
- Consumes: `hasRecipesAccess` (Task 2), `getSession` (`@/lib/auth/get-session`), `GET /api/recetas/recipes` / `POST /api/recetas/recipes` (Task 8), `/api/inventory/items` (existing, for the "pick a finished product" search).
- Produces: `/recetas` route, linked from Task 12's sidebar entry; links to `/recetas/[id]` (Task 11).

- [ ] **Step 1: Implement the page (server component, mirrors `ajustes/page.tsx`)**

```tsx
// app/(app)/recetas/page.tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { hasRecipesAccess } from '@/lib/recipes/access';
import { HelpPanel } from '@/components/help-panel';
import { RecetasClient } from './recetas-client';

export default async function RecetasPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = getDb();
  const allowed = await hasRecipesAccess(db, session.sub, session.role);
  if (!allowed) redirect('/reports/ventas');

  return (
    <>
      <RecetasClient />
      <HelpPanel page="recetas" />
    </>
  );
}
```

- [ ] **Step 2: Implement the client component**

Reuses the same search-by-code-or-name pattern as `ajustes-client.tsx` (`normalize`/`matchesSearch`), applied to `/api/inventory/items` for picking which finished product to create a recipe for, and to the recipes list itself for filtering existing recipes.

```tsx
// app/(app)/recetas/recetas-client.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface RecipeRow {
  id: number;
  coArt: string;
  label: string;
  active: boolean;
}

interface ArticleOption {
  coArt: string;
  artDes: string;
}

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function RecetasClient() {
  const [recipeList, setRecipeList] = useState<RecipeRow[]>([]);
  const [articles, setArticles] = useState<ArticleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [newCoArt, setNewCoArt] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function loadRecipes() {
    const res = await fetch('/api/recetas/recipes');
    if (res.ok) setRecipeList(await res.json());
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError(null);
      try {
        const [recipesRes, itemsRes] = await Promise.all([
          fetch('/api/recetas/recipes'),
          fetch('/api/inventory/items'),
        ]);
        if (cancelled) return;
        if (!recipesRes.ok || !itemsRes.ok) {
          setLoadError('No se pudo cargar la información');
          return;
        }
        setRecipeList(await recipesRes.json());
        const items: { coArt: string; artDes: string }[] = await itemsRes.json();
        setArticles(items.map(i => ({ coArt: i.coArt, artDes: i.artDes })));
      } catch {
        if (!cancelled) setLoadError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const recipeCoArts = useMemo(() => new Set(recipeList.map(r => r.coArt)), [recipeList]);
  const availableArticles = useMemo(
    () => articles.filter(a => !recipeCoArts.has(a.coArt)),
    [articles, recipeCoArts],
  );

  const filteredRecipes = useMemo(() => {
    const q = normalize(search.trim());
    if (q === '') return recipeList;
    return recipeList.filter(r => normalize(r.coArt).includes(q) || normalize(r.label).includes(q));
  }, [recipeList, search]);

  async function handleCreate() {
    const article = availableArticles.find(a => a.coArt === newCoArt);
    if (!article) return;

    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/recetas/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coArt: article.coArt, label: article.artDes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(data.error ?? 'No se pudo crear la receta');
        return;
      }
      setNewCoArt('');
      await loadRecipes();
    } catch {
      setCreateError('No se pudo conectar con el servidor');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Cargando recetas…</div>;
  }

  const inputClass = `w-full border border-gray-300 rounded-md px-2 py-1 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Recetas</h1>
      <p className="text-sm text-gray-500">
        Define la receta de un producto terminado para ver su costo de fabricación,
        calculado en vivo con el método PEPS sobre las capas de costo de Profit Plus.
      </p>

      {loadError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{loadError}</p>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <label htmlFor="new-recipe-article" className="block text-xs font-medium text-gray-700">
          Crear receta para un producto
        </label>
        <div className="flex gap-2">
          <select
            id="new-recipe-article"
            value={newCoArt}
            onChange={e => { setNewCoArt(e.target.value); setCreateError(null); }}
            className={`${inputClass} max-w-md`}
          >
            <option value="">Selecciona un producto…</option>
            {availableArticles.map(a => (
              <option key={a.coArt} value={a.coArt}>{a.coArt} — {a.artDes}</option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={creating || !newCoArt}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-40 whitespace-nowrap"
          >
            {creating ? 'Creando…' : 'Crear Receta'}
          </button>
        </div>
        {createError && <p className="text-sm text-red-600">{createError}</p>}
      </div>

      <div>
        <label htmlFor="recetas-search" className="block text-xs font-medium text-gray-700 mb-1">Buscar receta</label>
        <input
          id="recetas-search"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Código o nombre…"
          className={`${inputClass} max-w-sm`}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              {['Código', 'Producto', 'Estado', ''].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRecipes.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{r.coArt}</td>
                <td className="px-3 py-2 text-gray-900">{r.label}</td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.active ? 'Activa' : 'Inactiva'}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link href={`/recetas/${r.id}`} className="text-blue-600 hover:underline">Editar / Costo</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRecipes.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">No hay recetas registradas todavía.</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add help content**

```markdown
# content/help/recetas.md
# Recetas

Define qué insumos componen cada producto terminado y en qué cantidad.
El costo de fabricación se calcula en vivo con el método PEPS (FIFO) sobre
las capas de costo reales de Profit Plus, convertido a dólares con la tasa
más reciente disponible.

Los renglones pueden referenciar un artículo de Profit Plus (su costo se
recalcula automáticamente) o ser manuales, para insumos que no se compran
por Profit Plus (por ejemplo, agua del servicio) — en ese caso tú indicas
el costo por unidad.
```

- [ ] **Step 4: Manual verification (no automated test for this task — covered end-to-end by Task 13)**

Run: `bun dev`, log in as a user with the `recipes` grant, visit `/recetas`, confirm the create form lists real ERP articles and the table renders. This task has no isolated automated test because it's pure composition of already-tested API routes (Tasks 8) and an already-tested search pattern (`ajustes-client.tsx`'s `matchesSearch`, not duplicated here since it's inline) — Task 13's E2E test exercises this page for real.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/recetas/page.tsx" "app/(app)/recetas/recetas-client.tsx" content/help/recetas.md
git commit -m "feat: add recipes list page"
```

---

### Task 11: Recipe editor + live cost panel

**Files:**
- Create: `app/(app)/recetas/[id]/page.tsx`
- Create: `app/(app)/recetas/[id]/recipe-detail-client.tsx`

**Interfaces:**
- Consumes: `GET/PUT /api/recetas/recipes/[id]` (Task 8), `GET /api/recetas/recipes/[id]/cost` (Task 9), `/api/inventory/items` (existing, for the ingredient picker).
- Produces: the `/recetas/[id]` route linked from Task 10.

- [ ] **Step 1: Implement the page**

```tsx
// app/(app)/recetas/[id]/page.tsx
import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { hasRecipesAccess } from '@/lib/recipes/access';
import { HelpPanel } from '@/components/help-panel';
import { RecipeDetailClient } from './recipe-detail-client';

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = getDb();
  const allowed = await hasRecipesAccess(db, session.sub, session.role);
  if (!allowed) redirect('/reports/ventas');

  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId) || recipeId <= 0) notFound();

  return (
    <>
      <RecipeDetailClient recipeId={recipeId} />
      <HelpPanel page="recetas" />
    </>
  );
}
```

- [ ] **Step 2: Implement the client component**

```tsx
// app/(app)/recetas/[id]/recipe-detail-client.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Line {
  id?: number;
  lineType: 'erp_article' | 'manual';
  coArt: string | null;
  manualLabel: string | null;
  quantity: number;
  unit: string;
  manualUnitCostUsd: number | null;
}

interface RecipeDetail {
  id: number;
  coArt: string;
  label: string;
  active: boolean;
  lines: Line[];
}

interface ArticleOption {
  coArt: string;
  artDes: string;
  unidad: string | null;
}

interface CostLineResult {
  lineType: 'erp_article' | 'manual';
  coArt: string | null;
  quantity: number;
  costUsd: number | null;
  estimated: boolean;
}

interface CostResult {
  totalUsd: number;
  lines: CostLineResult[];
  asOfRateDate: string | null;
  incomplete: boolean;
}

function emptyErpLine(): Line {
  return { lineType: 'erp_article', coArt: '', manualLabel: null, quantity: 0, unit: 'KG', manualUnitCostUsd: null };
}

function emptyManualLine(): Line {
  return { lineType: 'manual', coArt: null, manualLabel: '', quantity: 0, unit: 'LTS', manualUnitCostUsd: 0 };
}

export function RecipeDetailClient({ recipeId }: { recipeId: number }) {
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [articles, setArticles] = useState<ArticleOption[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cost, setCost] = useState<CostResult | null>(null);
  const [costLoading, setCostLoading] = useState(false);

  const loadCost = useCallback(async () => {
    setCostLoading(true);
    try {
      const res = await fetch(`/api/recetas/recipes/${recipeId}/cost`);
      if (res.ok) setCost(await res.json());
    } finally {
      setCostLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError(null);
      try {
        const [recipeRes, itemsRes] = await Promise.all([
          fetch(`/api/recetas/recipes/${recipeId}`),
          fetch('/api/inventory/items'),
        ]);
        if (cancelled) return;
        if (!recipeRes.ok) {
          setLoadError('No se pudo cargar la receta');
          return;
        }
        const recipeData: RecipeDetail = await recipeRes.json();
        setRecipe(recipeData);
        setLines(recipeData.lines);
        if (itemsRes.ok) {
          const items: { coArt: string; artDes: string; unidad: string | null }[] = await itemsRes.json();
          setArticles(items);
        }
      } catch {
        if (!cancelled) setLoadError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [recipeId]);

  useEffect(() => {
    if (recipe) loadCost();
  }, [recipe, loadCost]);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, ...patch } : l));
  }

  function removeLine(index: number) {
    setLines(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!recipe) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/recetas/recipes/${recipeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: recipe.label, active: recipe.active, lines }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error ?? 'No se pudo guardar la receta');
        return;
      }
      await loadCost();
    } catch {
      setSaveError('No se pudo conectar con el servidor');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta receta?')) return;
    const res = await fetch(`/api/recetas/recipes/${recipeId}`, { method: 'DELETE' });
    if (res.ok) router.push('/recetas');
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando receta…</div>;
  if (loadError || !recipe) {
    return <div className="p-6 text-sm text-red-600">{loadError ?? 'Receta no encontrada'}</div>;
  }

  const inputClass = `border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{recipe.coArt} — {recipe.label}</h1>
        <button onClick={handleDelete} className="text-sm text-red-600 hover:underline">Eliminar receta</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Insumos</h2>

        {lines.map((line, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2 border-b border-gray-100 pb-3">
            {line.lineType === 'erp_article' ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Artículo</label>
                <select
                  value={line.coArt ?? ''}
                  onChange={e => updateLine(index, { coArt: e.target.value })}
                  className={`${inputClass} min-w-[16rem]`}
                >
                  <option value="">Selecciona…</option>
                  {articles.map(a => (
                    <option key={a.coArt} value={a.coArt}>{a.coArt} — {a.artDes}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Insumo (manual)</label>
                <input
                  type="text"
                  value={line.manualLabel ?? ''}
                  onChange={e => updateLine(index, { manualLabel: e.target.value })}
                  placeholder="Ej: Agua"
                  className={`${inputClass} min-w-[12rem]`}
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
              <input
                type="number"
                step="any"
                value={line.quantity}
                onChange={e => updateLine(index, { quantity: Number(e.target.value) })}
                className={`${inputClass} w-24`}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Unidad</label>
              <input
                type="text"
                value={line.unit}
                onChange={e => updateLine(index, { unit: e.target.value })}
                className={`${inputClass} w-20`}
              />
            </div>

            {line.lineType === 'manual' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Costo USD / unidad</label>
                <input
                  type="number"
                  step="any"
                  value={line.manualUnitCostUsd ?? 0}
                  onChange={e => updateLine(index, { manualUnitCostUsd: Number(e.target.value) })}
                  className={`${inputClass} w-28`}
                />
              </div>
            )}

            <button onClick={() => removeLine(index)} className="text-sm text-red-600 hover:underline pb-1">Quitar</button>
          </div>
        ))}

        <div className="flex gap-2">
          <button onClick={() => setLines(prev => [...prev, emptyErpLine()])} className="text-sm text-blue-600 hover:underline">
            + Insumo de Profit Plus
          </button>
          <button onClick={() => setLines(prev => [...prev, emptyManualLine()])} className="text-sm text-blue-600 hover:underline">
            + Insumo manual
          </button>
        </div>

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-40"
        >
          {saving ? 'Guardando…' : 'Guardar Receta'}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Costo de Fabricación (en vivo)</h2>
        {costLoading && <p className="text-sm text-gray-500">Calculando…</p>}
        {!costLoading && cost && (
          <>
            <p className="text-3xl font-bold text-gray-900">${cost.totalUsd.toFixed(4)}</p>
            {cost.incomplete && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Este costo es incompleto o estimado — algún insumo no tiene suficiente historial de compras en Profit Plus.
              </p>
            )}
            <table className="min-w-full text-sm mt-2">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Insumo', 'Cantidad', 'Costo USD', ''].map(h => (
                    <th key={h} className="px-2 py-1 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cost.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1">{l.coArt ?? lines[i]?.manualLabel ?? '—'}</td>
                    <td className="px-2 py-1">{l.quantity}</td>
                    <td className="px-2 py-1">{l.costUsd === null ? 'Sin datos' : `$${l.costUsd.toFixed(4)}`}</td>
                    <td className="px-2 py-1 text-xs text-amber-700">{l.estimated ? 'Estimado' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

Run: `bun dev`, open a recipe created via Task 10, add an ERP-article line (pick a real material) and a manual line (e.g. "Agua" at $0.05/LTS), save, confirm the cost panel shows a computed USD total with a per-line breakdown, and that a shortfall/no-data ingredient shows "Sin datos"/"Estimado" instead of a silently wrong number.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/recetas/[id]"
git commit -m "feat: add recipe editor with live FIFO cost panel"
```

---

### Task 12: Sidebar navigation + layout wiring

**Files:**
- Modify: `app/(app)/layout.tsx`
- Modify: `components/sidebar.tsx`

**Interfaces:**
- Consumes: `hasRecipesAccess` (Task 2).
- Produces: a "Recetas" nav section visible only to users with the module grant, linking to `/recetas` (Task 10).

- [ ] **Step 1: Wire the access check in the layout**

```tsx
// app/(app)/layout.tsx — add alongside the existing hasInventoryAccess/hasDwhAccess calls
import { hasRecipesAccess } from '@/lib/recipes/access';
// ...
const canSeeRecipes = await hasRecipesAccess(db, session.sub, session.role);
// ...
<Sidebar user={session} canSeeInventory={canSeeInventory} canSeeAnalitica={canSeeAnalitica} canSeeRecipes={canSeeRecipes} />
```

- [ ] **Step 2: Add the nav section to `components/sidebar.tsx`**

```tsx
interface Props {
  user: SessionPayload;
  canSeeInventory: boolean;
  canSeeAnalitica: boolean;
  canSeeRecipes: boolean;
}

// destructure canSeeRecipes in the function signature, then, after the existing canSeeInventory block:
{canSeeRecipes && (
  <>
    <p className="px-2 mt-5 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
      Recetas
    </p>
    <Link href="/recetas" className={navClass('/recetas')}>
      Recetas
    </Link>
  </>
)}
```

- [ ] **Step 3: Manual verification**

Run: `bun dev`, log in as a user without the `recipes` grant — confirm no "Recetas" section appears and `/recetas` redirects to `/reports/ventas`. Grant it via `/admin/users` (Task 3) and confirm the section appears and the page loads.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/layout.tsx" components/sidebar.tsx
git commit -m "feat: wire recipes module into sidebar navigation"
```

---

### Task 13: End-to-end test

**Files:**
- Create: `e2e/recetas.spec.ts`

**Interfaces:**
- Consumes: the full stack built in Tasks 1–12, plus the real restored-backup ERP container (`docker/docker-compose.yml`), following the `@mssql` convention from `e2e/reports.spec.ts`.

- [ ] **Step 1: Check how `e2e/reports.spec.ts` logs in and grants modules, to reuse the same helpers**

Run: `sed -n '1,40p' e2e/reports.spec.ts` and `ls e2e/helpers/`
Expected: find the existing login helper and any DB-seeding helper for granting a module to the test user before the test runs (this repo's e2e suite already needs to grant `inventory`/`dwh` for other specs — reuse that exact mechanism for `recipes` rather than inventing a new one).

- [ ] **Step 2: Write the test**

```ts
// e2e/recetas.spec.ts
// @mssql — requires the `profitplus-erp-mock` container (docker-compose.yml), same as reports.spec.ts
import { test, expect } from '@playwright/test';
// import whatever login/module-grant helper Step 1 found, e.g.:
// import { loginAs, grantModule } from './helpers/auth';

test.describe('recetas @mssql', () => {
  test('creates a recipe, saves ERP + manual lines, and sees a live FIFO cost', async ({ page }) => {
    // 1. Log in and ensure the test user has the `recipes` module grant
    //    (mirror whatever Step 1 found for granting `inventory`/`dwh` today).

    await page.goto('/recetas');

    // 2. Create a recipe for a real finished-good article.
    //    Use '0000005' (Baguette 4 Granos 220gr) — confirmed to exist in the
    //    restored Ncake_a backup used by this container.
    await page.getByLabel('Crear receta para un producto').selectOption({ label: /0000005/ });
    await page.getByRole('button', { name: 'Crear Receta' }).click();

    // 3. Follow into the recipe detail page.
    await page.getByRole('link', { name: 'Editar / Costo' }).click();
    await expect(page).toHaveURL(/\/recetas\/\d+/);

    // 4. Add an ERP-article line using a real raw material with known FIFO layers.
    await page.getByRole('button', { name: '+ Insumo de Profit Plus' }).click();
    await page.locator('select').last().selectOption({ label: /0000083/ }); // Harina Panadera 45Kg (Atlas)
    await page.locator('input[type="number"]').first().fill('0.2');

    // 5. Add a manual line for a non-ERP ingredient (e.g. water).
    await page.getByRole('button', { name: '+ Insumo manual' }).click();
    await page.getByPlaceholder('Ej: Agua').fill('Agua');
    const manualQuantityInput = page.locator('input[type="number"]').nth(2);
    await manualQuantityInput.fill('0.15');
    const manualCostInput = page.locator('input[type="number"]').nth(3);
    await manualCostInput.fill('0.05');

    await page.getByRole('button', { name: 'Guardar Receta' }).click();

    // 6. Assert the live cost panel renders a computed USD total.
    await expect(page.getByText('Costo de Fabricación (en vivo)')).toBeVisible();
    await expect(page.locator('text=/^\\$\\d+\\.\\d{4}$/')).toBeVisible({ timeout: 10_000 });
  });
});
```

- [ ] **Step 3: Run it**

Prerequisite: `docker compose -f docker/docker-compose.yml up -d`
Run: `bun run e2e:mssql -- e2e/recetas.spec.ts`
Expected: PASS. If a selector doesn't match (e.g. the login/grant helper's actual name from Step 1, or Playwright's resolved accessible names for the `<select>`s), adjust the test to match what Step 1 found and what the browser actually renders — re-run after each fix.

- [ ] **Step 4: Run the full default e2e suite to confirm no regression**

Run: `bun run e2e`
Expected: PASS (this new spec is excluded from the default run via `@mssql`, same as `reports.spec.ts`; this just confirms nothing else broke).

- [ ] **Step 5: Commit**

```bash
git add e2e/recetas.spec.ts
git commit -m "test: add e2e coverage for recipe creation and live FIFO costing"
```

---

## Final steps (after Task 13)

- [ ] Run the full non-mssql suite once more: `bun test --isolate --env-file=.env.local --path-ignore-patterns='e2e/**'` (or whatever the exact `test` script in `package.json` resolves to) and `bun run lint`, fix anything red.
- [ ] Run `bun run test:mssql` (all mssql-tagged integration tests) to confirm nothing in Tasks 5–9 regressed against the live container.
- [ ] Open the PR against `main` with a summary covering: the ERP research finding (BOM tables dormant, FIFO layers real), the new `recipes` module, and explicit non-goals (no production-run tracking yet — future work per the spec).
