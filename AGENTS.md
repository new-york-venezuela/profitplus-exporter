# AGENTS.md — Context for LLM Coding Assistants

This file describes the architecture, conventions, and extension patterns
for the ProfitPlus Exporter. Read this before making any changes. For
setup, running locally, and deploying, see `INSTRUCTIONS.md`.

## System Architecture

Three databases, one Next.js 16 App Router app:

| Database          | Purpose                                    | Driver                | Location             |
|--------------------|----------------------------------------------|-------------------------|------------------------|
| SQLite             | User accounts / auth / module permissions   | Drizzle + `bun:sqlite` | `data/exporter.db`    |
| SQL Server — ERP   | Live Profit Plus data (reports, inventory)  | `mssql` singleton pool | Profit Plus server    |
| SQL Server — DWH   | `DWH_AlimentosNY`, pre-aggregated Kimball warehouse (sales/returns/collections analytics) | separate `mssql` singleton pool | same instance as ERP by default, configurable via `DW_*` |

Sessions are **stateless JWTs** in `httpOnly` cookies — no session table.

The ERP and the DWH are two different things reached two different ways:
the ERP is queried live, per-request, directly against Profit Plus tables
(`saFacturaVenta`, `saArticulo`, etc.) with collation/RTRIM handling inline
in each query. The DWH is a separate database (`DWH_AlimentosNY`) built
ahead of time by `dwh-migrations/` and refreshed by `Load_*` stored
procedures — the app's analytics dashboard queries `dim.*`/`fact.*` tables
there directly, with no collation gymnastics needed since that was already
handled at load time. Never query raw ERP tables from `app/api/dwh/*`, and
never query `dim.*`/`fact.*` from anywhere that isn't the analytics
dashboard's own routes.

## Directory Map

```
lib/
  auth/session.ts        — signToken(), verifyToken() — pure, Edge-safe
  auth/get-session.ts    — getSession() — uses next/headers, Server only
  db/schema.ts           — Drizzle tables: users, user_modules, inventory_warehouses, inventory_settings, recipes, recipe_lines
  db/sqlite.ts            — Drizzle client singleton
  db/mssql.ts             — ERP mssql pool singleton: getPool()
  db/dwh-mssql.ts          — DWH mssql pool singleton: getDwhPool() (separate pool, DW_* env)
  inventory/access.ts      — hasInventoryAccess(), getSessionFromRequest() (shared by every module)
  inventory/item-fields.ts — EDITABLE_ITEM_FIELDS allowlist for the inventory quick-edit module
  dwh/access.ts             — hasDwhAccess() — same shape as hasInventoryAccess(), gates /analitica
  recipes/access.ts         — hasRecipesAccess() — same shape again, gates /recetas
  costing/fifo.ts           — computeFifoCost() — pure FIFO layer-walk, no I/O, see "Recipes / Product
                              Costing" below
  costing/erp-layers.ts     — getCostLayers() — reads saCostoHistoricoEntrada (read-only)
  costing/currency.ts       — getUsdRateAsOf(), convertBsdToUsd() — reads saTasa (read-only)
  costing/product-cost.ts   — computeProductCost() — orchestrates the three above per recipe
  reports/registry.ts      — ColumnDef, ReportConfig, REPORTS map
  reports/ventas.ts        — Ventas report config
  reports/compras.ts       — Compras report config
  services/                — email-service.ts, password-reset-service.ts, forgot-password-service.ts
  errors/password-reset.ts — typed error classes for the password-reset flow
  components/reports/      — shared report UI (e.g. SucursalSelector.tsx)
  routes/api/reports/      — CSV export handlers factored out of app/api routes
  dates.ts                 — getPreviousMonthRange(), parseDate()
  csv.ts                   — buildCsv() with UTF-8 BOM
  xlsx.ts                  — XLSX export helper
  trim-strings.ts           — trimStrings() — strips char()-padding from ERP query results

dwh-migrations/            — numbered .sql files for DWH_AlimentosNY (dim/fact schema +
                              Load_*/Snapshot_* procs); see dwh-migrations/README.md
mssql-migrations/           — numbered .sql files installing app-specific ERP stored procedures
                              (e.g. pApiCrearAjusteInventario for inventory adjustments)
scripts/migrate-dwh.ts     — runs dwh-migrations/ in order, tracked in dwh.__dwh_migrations
scripts/migrate-mssql.ts    — runs mssql-migrations/ in order, against the ERP database
scripts/migrate.ts          — runs drizzle/migrations/ (SQLite)

app/(app)/
  analitica/                — sales/returns/collections dashboard, gated on the 'dwh' module
  inventario/                — stock/adjustments module, gated on the 'inventory' module
  recetas/                   — recipe management + live FIFO product costing, gated on the 'recipes' module
  admin/users/                — user + per-user module-grant management (admin only)
  admin/config-inventario/    — inventory module settings (admin only)
  reports/ventas, reports/compras — ERP report exports (no module gate, all authenticated users)

app/api/
  recetas/recipes/            — recipe CRUD + GET .../[id]/cost (live cost computation)
```

**No `middleware.ts`** — there is no Edge Runtime request guard in this
app. Every route (page or API) must check auth/role/module access
independently; there is no shared enforcement layer to fall back on.
Server Components use `getSession()`; API Route Handlers use
`getSessionFromRequest(request)` instead (see Auth Flow Summary below).

## Module-Based Permissions

Beyond `role` (`'user' | 'admin'`), individual features are gated by a
**module grant** stored in the `user_modules` SQLite table
(`lib/db/schema.ts`): one row per `(userId, module)` pair. Three modules
exist today: `'inventory'`, `'dwh'` (gates `/analitica`), and `'recipes'`
(gates `/recetas`).

Each module has its own `has<X>Access()` helper (`lib/inventory/access.ts`,
`lib/dwh/access.ts`) with an identical shape:

```typescript
export async function hasDwhAccess(
  db: BunSQLiteDatabase<typeof schema>,
  userId: string,
  role: 'user' | 'admin',
): Promise<boolean> {
  if (role === 'admin') return true;   // admins bypass every module gate
  // ...query user_modules for (userId, 'dwh')
}
```

`getSessionFromRequest()` (despite living in `lib/inventory/access.ts`) is
shared by every module — it's not inventory-specific, just historically
placed there first.

**Adding a new module**: add the module name to the `module` enum in
`lib/db/schema.ts` (SQLite `text` column, no `CHECK` constraint — this is a
TypeScript-only enum, so no migration is needed to add a new value), add it
to `VALID_MODULES` in `app/api/admin/users/[id]/modules/route.ts`, write a
`has<X>Access()` helper mirroring the two above, gate the page's server
component and every corresponding API route with it, and add a checkbox
column to `app/(app)/admin/users/users-client.tsx` (generalize
`handleToggleModule(user, moduleName)`, already parameterized for this).

**Every gate is enforced twice, independently — page and API**: a page
redirects on denial (`redirect('/reports/ventas')`); the API route it calls
also checks and returns `403` on its own. Never rely on the page-level
check alone — someone can call the API directly.

## Database Quirk: Spanish Collation (ERP only)

The SQL Server ERP uses `Modern_Spanish_CI_AS` collation, while the DWH
database uses the SQL Server default (`SQL_Latin1_General_CP1_CI_AS`). This
means:
- String comparisons on the ERP are **case-insensitive** by default;
  characters like Á, É, Ñ, Ü sort correctly
- The `BETWEEN` operator on ERP date columns works as expected
- **Any query that joins ERP tables against DWH tables** (i.e. every
  `Load_*` procedure in `dwh-migrations/`, and nowhere in `app/`) must add
  `COLLATE SQL_Latin1_General_CP1_CI_AS` to the ERP-sourced side of the
  comparison, or SQL Server throws a collation-conflict error. App code
  never does this join directly — it's isolated inside the DWH load
  procedures — but keep it in mind if you ever add an ERP-to-DWH query
  anywhere in `app/`.
- Column aliases in ERP views may use Spanish characters — the `label`
  field in `ColumnDef` should match the intended display name, not the SQL
  alias

The CSV builder (`lib/csv.ts`) prepends a UTF-8 BOM (`﻿`) so Excel
on Spanish Windows auto-detects the encoding without the Import Wizard.

## Adding a New Report (ERP, live-query)

1. Create `lib/reports/<name>.ts`:
   ```typescript
   import type { ReportConfig } from './registry';
   export const NAME_CONFIG: ReportConfig = {
     id:         '<name>',
     label:      'Display Name',
     queryType:  'view',        // or 'procedure'
     sourceName: 'v_view_name', // SQL view or SP name
     dateColumn: 'fecha',       // column used in WHERE clause (views only)
     columns: [
       { key: 'col_alias', label: 'Spanish Label', defaultVisible: true, defaultOrder: 0 },
       // alwaysVisible: true — column cannot be toggled off
     ],
   };
   ```

2. Add to `lib/reports/registry.ts`:
   ```typescript
   import { NAME_CONFIG } from './name';
   export const REPORTS = { ..., name: NAME_CONFIG };
   ```

3. Add nav link in `components/sidebar.tsx` (`NAV_REPORTS` array).

4. Create page: `app/(app)/reports/<name>/page.tsx` (copy from ventas).

No changes needed to API routes — they use `REPORTS[reportId]` dynamically.
This pattern is for **live ERP queries only** — it has nothing to do with
the DWH/analytics dashboard below.

## Adding a New Chart to the Analytics Dashboard (DWH)

The dashboard (`app/(app)/analitica/`) does not use the `ReportConfig`
pattern above — it queries `DWH_AlimentosNY` (`dim.*`/`fact.*` tables)
directly through a single API route.

1. Add a query to `app/api/dwh/dashboard/route.ts` using `getDwhPool()`
   from `lib/db/dwh-mssql.ts`. Query pre-aggregated `dim.*`/`fact.*` tables
   only — no ERP tables, no collation handling needed (already done at DWH
   load time).
2. Extend the JSON response shape and the matching TypeScript interface in
   `app/(app)/analitica/analitica-client.tsx`.
3. Add a chart with Recharts (`ResponsiveContainer` wrapping `BarChart` /
   `ComposedChart` / etc.) — follow the existing `KpiCard`/`ChartCard`
   layout helpers already in that file rather than inventing new markup.
4. If the new metric needs a fact table that doesn't exist yet, that's a
   `dwh-migrations/` change, not an `app/` change — see
   `dwh-migrations/README.md` first, especially "Incremental watermark
   strategy" if the source is a Profit Plus detail table (these often lack
   a `validador` rowversion column; check before assuming one exists).

Both the page and the API route are gated by `hasDwhAccess()` — see
"Module-Based Permissions" above.

## Recipes / Product Costing (FIFO)

`/recetas` lets a user define a recipe (bill of materials) for a finished
product and see its live manufacturing cost in USD. Full research and
design rationale: `docs/superpowers/specs/2026-09-19-product-cost-recipe-fifo-design.md`.

**Why this isn't built on Profit Plus's native `saArtCompuesto*` tables**:
that BOM feature exists in the ERP schema but is verified unused (0 rows,
live, in every one of `saArtCompuesto`/`saArtCompuestoReng`/
`saArtCompuestoGen`/`saArtCompuestoGenReng`). Its only real *use* mechanism,
`saArtCompuestoGen`, is a production-run document — executing it actually
consumes raw-material stock and posts a costeo entry, which is a much
bigger commitment than "show me a cost." Recipes therefore live entirely
in this app's own SQLite tables (`recipes`, `recipe_lines` in
`lib/db/schema.ts`); the Profit Plus side of this feature is **read-only**,
same discipline as everywhere else in this app — nothing here writes to
`saArtCompuesto*` or moves ERP stock.

**Data model**: a `recipe` has one `co_art` (the finished-good article it
produces) and many `recipe_lines`. Each line is either:
- `lineType: 'erp_article'` — references a live Profit Plus `co_art`
  (typically a raw material); its cost is computed from real FIFO layers.
- `lineType: 'manual'` — for ingredients Profit Plus never tracks (e.g.
  water from the utility service, not purchased/inventoried) — the user
  sets a fixed `manualUnitCostUsd` directly, defaulting to `0` until they do.

**FIFO cost algorithm** (`lib/costing/`, pure + read-only, no caching —
every request recomputes from current ERP state, which is what makes it
"live"):
1. `erp-layers.ts` pulls `saCostoHistoricoEntrada` rows for the article
   (joined via `saArticulo.rowguid`, **not** `co_art` — that table has no
   `co_art` column), oldest-first, pre-filtered to `cantidad - cantidad_usada > 0`.
2. `fifo.ts`'s `computeFifoCost(layers, quantity)` walks those layers
   oldest→newest, consuming from each until the recipe line's quantity is
   covered — correctly spanning multiple layers when one alone isn't
   enough. If total remaining stock is less than needed, the shortfall is
   priced at the most recent layer's cost and the result is marked
   `estimated: true`. If there are **zero** layers ever (no purchase
   history), the result is `hasData: false` — never silently `0`.
3. `currency.ts`'s `getUsdRateAsOf()` converts the BSD total to USD via
   `saTasa` (`co_mone='USD'`, closest rate on or before the as-of date).
   **The ERP's base currency is `BSD`** (`par_emp.g_moneda`) — a stale
   knowledge-base doc once claimed it was `'BS'`, a legacy currency code
   left over from Venezuela's redenominations; don't trust that without
   re-checking `par_emp.g_moneda` live if it ever matters again.
4. `product-cost.ts`'s `computeProductCost()` sums all lines (ERP + manual)
   into one `ProductCostResult`.

**UX invariants — preserve these in any future change to this module**:
- **Always USD, never raw BSD.** Every cost figure shown to the user must
  already be converted; nothing in `recetas/` should render a bare `costo`
  value from `saCostoHistoricoEntrada`.
- **`costUsd: null` must render as "no data" (e.g. "Sin datos"), never as
  `$0.00`.** A missing-data line silently showing zero would understate
  the recipe's true cost without any indication something's wrong — this
  is the single most important invariant in this module, since the whole
  point of the feature is a trustworthy cost number.
- **`estimated: true` must be visibly flagged per line**, and the overall
  `incomplete: true` result must show a clear warning at the top of the
  cost panel — a recipe with any incomplete/estimated ingredient is not
  fully reliable and the UI must say so, not just compute a quiet best-effort number.
- **Manual (non-ERP) ingredient lines must always be editable**, with
  their USD cost visible and changeable inline — they exist specifically
  because Profit Plus can't supply that number, so the UI is the only
  place it can come from.

**Adding an ingredient-selection UI element**: reuse `/api/inventory/items`
(the same live-ERP article search the Inventory module's ajustes/articulos
pages already use) rather than building a second article picker.

## Auth Flow Summary

```
POST /api/auth/login
  → Bun.password.verify(hash, password)
  → signToken({ sub, role, name })
  → Set-Cookie: session=<jwt>; HttpOnly

Every page/route (no shared middleware — checked independently)
  → fail → redirect /login or 401 JSON

Server Components (page.tsx)
  → getSession() (lib/auth/get-session.ts) → verifyToken(cookie)
  → relies on next/headers cookies(), only valid inside a real request scope

API Route Handlers
  → getSessionFromRequest(request) (lib/inventory/access.ts) → verifyToken(cookie)
  → reads the cookie off the NextRequest directly — use this instead of
    getSession() in route handlers, since getSession() throws when called
    outside a live Next.js request (e.g. in a test)

Admin-only API routes
  → getSessionFromRequest(request) → check role === 'admin' → 403 if not

Admin page (Server Component)
  → getSession() → role !== 'admin' → redirect('/reports/ventas')

Module-gated page (e.g. /analitica, /inventario/*)
  → getSession() → has<Module>Access(db, sub, role) → redirect('/reports/ventas') if false

Module-gated API route
  → getSessionFromRequest(request) → has<Module>Access(db, sub, role) → 403 if false
```

## Product Analytics (PostHog)

`lib/analytics/posthog.ts` exports `captureEvent(distinctId, event, properties?)`
and `captureException(error, distinctId, properties?)` — both server-side
(posthog-node), both no-ops if `NEXT_PUBLIC_POSTHOG_KEY` is unset. Call
`captureEvent` right before an API route's success `return`, using
`session.sub` as `distinctId` so it matches the client-side identify call.
Call `captureException` in `catch` blocks alongside the existing
`console.error`. Client-side, `components/posthog-provider.tsx` wraps
`app/(app)/layout.tsx`, initializes `posthog-js` with autocapture
(pageviews/clicks — no manual event needed for those), and calls
`posthog.identify(session.sub, ...)`. For a UI-only signal with no server
round-trip (e.g. a client-side tab switch), call `posthog.capture(...)`
directly from the client component instead of adding a server event.

Two client-side host vars, both required for the reverse-proxy setup:
`NEXT_PUBLIC_POSTHOG_HOST` is the ingestion endpoint (`api_host` client-side,
`host` server-side) — point it at the proxy domain. `NEXT_PUBLIC_POSTHOG_UI_HOST`
is only for the PostHog app itself (toolbar, links) since a proxy/custom
`api_host` can't serve the UI — client-only, `posthog-node` has no
equivalent. `PostHogProvider`'s `useEffect` re-runs `identify()` on every
mount, which covers a fresh page load while already logged in (mounting
`(app)/layout.tsx` for the first time reads the session server-side either
way). The one thing that needs an explicit call is logout: `posthog.reset()`
in `components/sidebar.tsx`'s `handleLogout()`, before redirecting to
`/login` — without it, a second user logging in on the same browser could
briefly inherit the previous user's identified state.

## Code Conventions

- **No date library** — use `lib/dates.ts` for all date math
- **Drizzle queries are synchronous** — no `await` needed; `Bun.password` and `jose` are async
- **ERP `mssql` queries use `.input()` for ALL user-controlled values** — never concatenate
- **DWH `mssql` queries** (`app/api/dwh/*`) currently take no user-controlled input beyond the
  session — if you add a filter (date range, warehouse, etc.), use `.input()` there too
- **CSV encoding** — always use `buildCsv()` from `lib/csv.ts`; never construct CSV manually
- **Error responses** — always `{ error: string }` shape with appropriate HTTP status
- **Admin check** — check `role === 'admin'` in every admin route independently (no middleware to
  rely on instead); Server Components call `getSession()`, API Route Handlers call
  `getSessionFromRequest(request)` instead — `getSession()` throws outside a live request scope
- **Module check** — same independent-check discipline as admin routes; see "Module-Based
  Permissions" above
- **DWH migrations** — every `CREATE TABLE`/`CREATE OR ALTER PROCEDURE` in `dwh-migrations/` must
  be safely re-runnable (`IF NOT EXISTS` / `CREATE OR ALTER`); see `dwh-migrations/README.md`
  before adding one

## Environment Variables

See `.env.example` for the full list; `INSTRUCTIONS.md` covers setup end to end. Key variables:

| Variable                       | Used by                                  |
|----------------------------------|---------------------------------------------|
| `SQLITE_PATH`                   | `lib/db/sqlite.ts`                          |
| `JWT_SECRET`                     | `lib/auth/session.ts`                       |
| `DB_SERVER` + `DB_*`             | `lib/db/mssql.ts` (ERP)                     |
| `DW_SERVER` + `DW_*` (optional)  | `lib/db/dwh-mssql.ts`, `scripts/migrate-dwh.ts` — falls back to `DB_*` when unset, `DW_NAME` defaults to `DWH_AlimentosNY` |
| `NODE_ENV`                       | Cookie `secure` flag, dev guards             |

## Testing Notes

- `bun test --isolate --env-file=.env.local --timeout 30000 scripts/dwh/` runs the DWH integration
  tests — they need `DW_NAME` pointed at a disposable database (they create, migrate, assert, and
  drop it). The `--timeout 30000` flag is required; the bare `bun test` default (5s) is too tight
  once a test's `beforeAll` applies several migrations. `bunfig.toml`'s `[test] timeout` does not
  work for this in Bun 1.3.14 — always pass `--timeout` on the CLI, not in config.
- See `INSTRUCTIONS.md` → "Running Tests" for the full command reference (unit, e2e, MSSQL
  integration).
