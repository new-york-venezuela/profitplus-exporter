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
ahead of time by `migrations/dwh/` and refreshed by `Load_*` stored
procedures — it holds pre-aggregated `dim.*`/`fact.*` tables with no
collation gymnastics needed, since that was already handled at load time.
Any module may read the DWH through `getDwhPool()` (using `.input()` for
user-controlled values); a module that needs both ERP and DWH data (e.g.
`/mapa`) queries each through its own pool and merges the results in
TypeScript by customer code — never join across the two databases in SQL
outside the `Load_*` procedures. Never query raw ERP tables from
`app/api/dwh/*`.

## Directory Map

```
lib/
  auth/session.ts        — signToken(), verifyToken() — pure, Edge-safe
  auth/get-session.ts    — getSession() — uses next/headers, Server only
  db/schema.ts           — Drizzle tables: users, user_modules, inventory_warehouses, inventory_settings
  db/sqlite.ts            — Drizzle client singleton
  db/mssql.ts             — ERP mssql pool singleton: getPool()
  db/dwh-mssql.ts          — DWH mssql pool singleton: getDwhPool() (separate pool, DW_* env)
  inventory/access.ts      — hasInventoryAccess(), getSessionFromRequest() (shared by every module)
  inventory/item-fields.ts — EDITABLE_ITEM_FIELDS allowlist for the inventory quick-edit module
  dwh/access.ts             — hasDwhAccess() — same shape as hasInventoryAccess(), gates /analitica
  geo/types.ts, pareto.ts, merge.ts, map-data.ts — customer-map types, Pareto, ERP+DWH merge, SQL fetchers
  geo/filters.ts, date-range.ts — URL-synced map filters, period helpers
  geo/routes-repo.ts, route-validation.ts, location-patch.ts — SQLite routes CRUD and request validators
  geo/geometry.ts          — dependency-free planar geometry: point-in-polygon, polygon validity/overlap, GeoJSON [lng, lat] (de)serialization
  geo/area-validation.ts, areas-repo.ts — sales-area request validators and SQLite CRUD (overlap/validity checks)
  geo/area-match.ts        — applyAreaMatch() (customer → area, mismatch flag), areaRevenue()
  geo/color-scale.ts, layers.ts — choropleth scale, heat-layer points
  geo/discrepancies.ts     — findDiscrepancies(): seller mismatches and located customers outside every area
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
  geo/coordinates.ts      — parseCoordinates()/validateCoordinates()/formatCoordinates() for saCliente.campo1 ("Coordenadas: (lat, lng)")
  geo/erp-location.ts     — updateCustomerLocation() → pApiActualizarUbicacionCliente (only way the app writes campo1/dir_ent2)
  geo/geocoding.ts        — Nominatim/Google geocoding used by scripts/geocode-customers.ts
  pricing/access.ts       — getPricingAccessLevel(), requirePricingAccess(request, 'view' | 'edit') for API routes
  pricing/http.ts         — requirePricingAdmin() (admin-only routes) and shared route helpers
  pricing/*-service.ts, *-repo.ts, *-validators.ts — segments, lists and promotions: orchestration (ERP + SQLite), SQLite CRUD, request validators
  pricing/rate-planner.ts, promo-planner.ts, rates-math.ts — pure planners turning edits into saArtPrecio insert/update ops
  pricing/*-erp.ts, segment-erp.ts, sa-cliente-fields.ts, tipo-cliente.ts — ERP access; writes go through pApi* procs only
  pricing/promo-status.ts, timeline.ts, dates.ts — promotion status, timeline data, date-only helpers (YYYY-MM-DD)
  pricing/health.ts, health-loader.ts, health-repo.ts — pure expiry checks, live report loader, sweep heartbeat + alert settings/log
  pricing/digest.ts       — composeDigest()/sendDigest(): daily expiry email (template pricing-expiry-digest)
  pricing/sweep.ts, sweep-erp.ts, sweep-job.ts — nightly revert of expired special segments; runSweepJob() = sweep + heartbeat + digest

app/api/mapa/              — customer-map API (clientes, ubicacion, rutas, zonas), gated on 'geo'
  app/api/mapa/zonas/      — sales-area writes (POST, [id] PATCH/DELETE); areas are read via /api/mapa/clientes

app/api/pricing/           — pricing API (segments, customers, assignments, price-lists, lists/[coPrecio]/rates|export,
                              articles, promotions, health, alert-settings), gated per route (see Pricing below)

migrations/dwh/            — numbered .sql files for DWH_AlimentosNY (dim/fact schema +
                              Load_*/Snapshot_* procs); see migrations/dwh/README.md
migrations/mssql/           — numbered .sql files installing app-specific ERP stored procedures
                              (e.g. pApiCrearAjusteInventario for inventory adjustments,
                              pApiActualizarUbicacionCliente for customer location; 0010-0014 are the pricing
                              procs: pApiActualizarTipoCliente, pApiInsertar/ActualizarPrecioArticulo, pApiTipoPrecio,
                              plus the RAISERROR-return and end-of-day `hasta` fixes)
migrations/sqlite/          — drizzle-kit migrations; 0008-0012 add the pricing_* tables (segment/list meta, audit log,
                              promotions + items + customers, sweep runs, alert log/settings)
scripts/migrate-dwh.ts     — runs migrations/dwh/ in order, tracked in dwh.__dwh_migrations
scripts/migrate-mssql.ts    — runs migrations/mssql/ in order, against the ERP database
scripts/migrate.ts          — runs migrations/sqlite/ (SQLite)
scripts/geocode-customers.ts — bun run geocode:customers (dry-run by default)
scripts/sweep-promotions.ts  — bun run pricing:sweep-promotions, nightly Task Scheduler job (INSTRUCTIONS.md Step 10)
content/help/pricing-*.md    — in-app help pages for the pricing tabs (segmentos, listas, promociones, vencimientos);
                              slugs are allowlisted in app/api/help/[page]/route.ts

app/(app)/
  analitica/                — sales/returns/collections dashboard, gated on the 'dwh' module
  inventario/                — stock/adjustments module, gated on the 'inventory' module
  mapa/                      — customer map, gated on the 'geo' module
  pricing/                   — tabs: Segmentos, Listas, Promociones, Vencimientos; gated on 'pricing_view'/'pricing_edit'
  admin/users/                — user + per-user module-grant management (admin only)
  admin/config-inventario/    — inventory module settings (admin only)
  reports/ventas, reports/compras — ERP report exports (no module gate, all authenticated users)
```

**No `middleware.ts`** — there is no Edge Runtime request guard in this
app. Every route (page or API) must check auth/role/module access
independently; there is no shared enforcement layer to fall back on.
Server Components use `getSession()`; API Route Handlers use
`getSessionFromRequest(request)` instead (see Auth Flow Summary below).

## Module-Based Permissions

Beyond `role` (`'user' | 'admin'`), individual features are gated by a
**module grant** stored in the `user_modules` SQLite table
(`lib/db/schema.ts`): one row per `(userId, module)` pair. Modules today: `'inventory'`, `'dwh'`
(gates `/analitica`), `'geo'` (gates `/mapa`; `lib/geo/access.ts` exports
`hasGeoAccess`, `requireGeoAccess`), plus `'pricing_view'`/`'pricing_edit'`
(see `lib/pricing/access.ts`). Pricing semantics: `pricing_view` is enough for GETs, `pricing_edit` is
required for every write (edit implies view, admins have both); the email alert settings are admin-only.
Each pricing route calls `requirePricingAccess(request, 'view' | 'edit')` or, for
`/api/pricing/alert-settings`, `requirePricingAdmin(request)` itself.

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
  `Load_*` procedure in `migrations/dwh/`, and nowhere in `app/`) must add
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
   `migrations/dwh/` change, not an `app/` change — see
   `migrations/dwh/README.md` first, especially "Incremental watermark
   strategy" if the source is a Profit Plus detail table (these often lack
   a `validador` rowversion column; check before assuming one exists).

Both the page and the API route are gated by `hasDwhAccess()` — see
"Module-Based Permissions" above.

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

## Customer Map (`/mapa`)

Gated on the `'geo'` module (page redirects, every `/api/mapa/*` route
returns 401/403 itself). Customer coordinates live in `saCliente.campo1` as
`Coordenadas: (lat, lng)` — parse/format only via `lib/geo/coordinates.ts`,
and write to the ERP only via `updateCustomerLocation`. Routes are SQLite
(`routes`, `route_customers`). `GET /api/mapa/clientes` is the one route that
merges live ERP customers with DWH revenue in TypeScript (by trimmed customer
code); Pareto uses the same thresholds as the analytics Clientes tab.

Sales areas live in SQLite (`sales_areas`, `sales_area_sellers`); polygons are
GeoJSON `Polygon`s with `[lng, lat]` coordinates. Areas cannot overlap (shared
borders are fine). Customer-to-area matching is computed on read in
`GET /api/mapa/clientes` via `lib/geo/area-match.ts` — never stored, never
written to the ERP. Mismatch = the customer's
`co_ven` is not among the sellers of the area it falls in (areas with no
sellers never flag). A customer on a border resolves to the lowest area id.
Geometry is dependency-free (`lib/geo/geometry.ts`); Geoman and `leaflet.heat`
are imported only inside the client-only map tree.

`saCliente.co_ven` has exactly one writer: a user's manual "Cambiar vendedor"
action (popup / table row), `PATCH /api/mapa/clientes/[co_cli]/vendedor` →
`updateCustomerSeller` (`lib/geo/erp-seller.ts`) → `pApiActualizarVendedorCliente`
(`migrations/mssql/0009`, rejects unknown customers and unknown/inactive
sellers, stamps `co_us_mo`/`fe_us_mo`). Area matching never changes a seller
automatically. The seller picker lists `payload.sellers` (sellers with at least
one active customer; inactive ones, flagged `inactive`, are excluded).

## Pricing (`/pricing`)

Segments (`saTipoCliente`), price lists (`saTipoPrecio`/`saArtPrecio`), promotions and expiry tracking.
ERP is the source of truth; SQLite holds app metadata (`pricing_*` tables).

- **ERP pricing writes only through `pApi*` wrapper procs** (`migrations/mssql/0010-0014`) — never raw
  INSERT/UPDATE on `saArtPrecio`, `saTipoPrecio` or `saTipoCliente`.
- **Segment = `saTipoCliente`; `saCliente.co_seg` is never written** (customers move via `tip_cli` only).
- **Planners never create overlapping periods** for an article/list/warehouse (`rate-planner.ts`,
  `promo-planner.ts`; pure, unit-tested). `hasta` is **end of day** (23:59:59.997, set by the procs;
  `desde` stays midnight) — Profit treats `hasta >= GETDATE()` as current. Dates in the app are `YYYY-MM-DD`.
- **Promotions are tracked per item** (`pricing_promotion_items`, unique per promotion + article);
  overlay promotions reprice a list's articles for a period, segment promotions move customers into a
  special segment with its own list.
- **Nightly sweep + digest** (`scripts/sweep-promotions.ts` → `runSweepJob`): reverts customers out of
  expired special segments, ALWAYS writes a heartbeat (`pricing_sweep_runs`, even if the ERP is unreachable),
  then emails the expiry digest (needs `SMTP_*`; sent notices dedupe via `pricing_alert_log`). It exits
  non-zero on any failed move, sweep error, health-read error or failed send. The Vencimientos tab
  (`/api/pricing/health`) surfaces the same checks live.

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
- **Ventas brutas / netas** — `salesGross` = `SUM(Fact_Sales.NetAmount)` (sin IVA, before returns);
  `salesNet` always means brutas − devoluciones, with returns windowed by `OriginalInvoiceDateKey`
  (`buildReturnsDateWhereClause(..., 'factura')`) and converted to USD at the factura's rate
  (`returnsUsdConversionJoin`). Use the devolución date (`'devolucion'`) only for views that report
  returns as events, and label it. See `content/help/analitica-definiciones.md` and
  `docs/ventas-netas-analysis.md`
- **CSV encoding** — always use `buildCsv()` from `lib/csv.ts`; never construct CSV manually
- **Dropdown selectors** — any `<select>` whose option list is data-driven and can grow past a handful of
  items (e.g. a picker over `Dim_Customer`, `Dim_SalesRep`, or similar) must use
  `lib/components/searchable-select.tsx`'s `SearchableSelect` instead of a native `<select>`; a fixed, small
  enum (a segment filter, a group-by mode, yes/no) stays a native `<select>`
- **Error responses** — always `{ error: string }` shape with appropriate HTTP status
- **Admin check** — check `role === 'admin'` in every admin route independently (no middleware to
  rely on instead); Server Components call `getSession()`, API Route Handlers call
  `getSessionFromRequest(request)` instead — `getSession()` throws outside a live request scope
- **Module check** — same independent-check discipline as admin routes; see "Module-Based
  Permissions" above
- **DWH migrations** — every `CREATE TABLE`/`CREATE OR ALTER PROCEDURE` in `migrations/dwh/` must
  be safely re-runnable (`IF NOT EXISTS` / `CREATE OR ALTER`); see `migrations/dwh/README.md`
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
- **Component tests** use React Testing Library on happy-dom: `bun run test:components` (also part of
  `bun run test`). Name files `*.test.tsx` under a `__tests__/` folder and import `screen` from
  `test/dom-setup` **first** — it registers the DOM for that file only (the scripts use `--isolate`) and exports a
  `screen` bound to the registered `document`; the `screen` exported by `@testing-library/react` binds before the
  DOM exists under Bun and throws. Call `cleanup` in `afterEach`. Mock `posthog-js` with `mock.module` and set
  `globalThis.fetch` per test; load the component with a dynamic `await import(...)` after `mock.module`. See
  `app/(app)/analitica/components/__tests__/` for examples.
- `bun run test:pricing-erp` runs `scripts/dwh/__tests__/pricing-assignment.test.ts` — this test
  performs real writes against the live ERP (customer `tip_cli` reassignment, plus creating a
  `saTipoPrecio`/`saTipoCliente` row pair) and is excluded from `test`/`test:unit` via
  `--path-ignore-patterns`, matching how `compras-export.integration.test.ts` is excluded and run
  separately via `test:mssql`. Only run it against a non-production Profit Plus instance.
- `bun run test:geo-erp` writes to the ERP (then restores) — non-production only.
- See `INSTRUCTIONS.md` → "Running Tests" for the full command reference (unit, e2e, MSSQL
  integration).
