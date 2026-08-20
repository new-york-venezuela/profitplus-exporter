# Inventory Management Module

## Goal

Give inventory managers a dedicated module to: create stock adjustments
that write into Profit Plus itself (so the desktop ERP and this app never
disagree on stock), see how inventory has evolved over time, get warned
when a fast-moving item is running low with a suggested reorder quantity,
and make quick edits to a predefined item list (name, references, notes,
reorder thresholds). Item *creation* stays procurement's job — this
module only edits existing `saArticulo` rows.

This also introduces the first per-module access control in the app:
today `role` is a flat `user | admin` enum; inventory managers are
`user`s additionally granted the `inventory` module.

## Context

### Existing app conventions (verified against the current codebase)

- Auth: stateless JWT in an `httpOnly` cookie
  (`lib/auth/session.ts`), `SessionPayload = { sub, role, name }`.
  `getSession()` (`lib/auth/get-session.ts`) is called independently in
  every admin-gated Server Component/route — there is no shared
  middleware enforcing role checks beyond routing (see gap below).
- SQLite via Drizzle (`lib/db/schema.ts`, migrations in
  `drizzle/migrations/`) holds only the `users` table today.
- SQL Server ERP access is read-only everywhere in the app today
  (`lib/db/mssql.ts`, a singleton `mssql` pool). This module is the
  first feature that *writes* to Profit Plus.
- Report modules follow a `ReportConfig` registry pattern
  (`lib/reports/registry.ts`) with static nav arrays in
  `components/sidebar.tsx`. The inventory module is enough of a
  departure (multiple pages, writes, its own admin config) that it gets
  its own directory rather than fitting the report registry shape.
- Page URIs are Spanish (`/reports/ventas`, `/reports/compras`,
  `/firmas`); API routes are English/technical
  (`/api/reports/[report]`). This module follows the same split.
- **Gap noted, not fixed here**: `AGENTS.md` describes a
  `middleware.ts` Edge Runtime JWT guard, but no such file exists in
  the repo today. Route protection currently relies entirely on
  per-route `getSession()` checks. Out of scope for this spec, but the
  new inventory routes must each check `getSession()` + module
  membership independently, consistent with how admin routes already
  work.

### Profit Plus findings (verified live against `Ncake_a`, 2026-08-20)

All of the following was confirmed by reading `OBJECT_DEFINITION()` of
the real stored procedures/functions and querying live data — not
inferred from the (previously trimmed) knowledge-base docs, which have
since been corrected in `erp-knowledge-base/docs/`.

**This is a make-to-order bakery.** Of 166 active `saArticulo` rows
(`tipo`: `V`=65 venta/producto terminado, `M`=52 materia prima, `S`=29
servicio, `C`=12 consumo, `E`=8 empaque), only warehouses `13`
(insumos/oficina, 16 items) and `14` (materia prima, 45 items) carry
real `saStockAlmacen` rows. Warehouse `000015` (OFICINA), where
finished-goods sales post, has **no stock records at all** — finished
products aren't inventoried today. The user intends to add a warehouse
for finished products later, so warehouse scope must be
admin-configurable data, not hardcoded.

**No article uses lotes or seriales** (`maneja_lote=0`,
`maneja_serial=0` for all 166 rows) — v1 does not need lot/serial UI.

**Adjustments require 3-step orchestration; nothing in Profit Plus ties
them together atomically.** The desktop ERP client must call, in order:

1. `pInsertarAjusteEntradaSalida` — inserts the `saAjuste` header. Pure
   insert, no validation.
2. `pInsertarRenglonesAjusteEntradaSalida` — inserts a `saAjusteReng`
   line, then calls `pCostoActualizarEntrada` (if
   `saTipoAjuste.tipo_trans='0'`) or `pCostoActualizarSalida`
   (`tipo_trans='1'`) to update the FIFO cost layers
   (`saCostoHistoricoEntrada`/`Salida`). **Neither of these touches
   `saStockAlmacen`.**
3. `pStockActualizar` — the **only** procedure in Profit Plus that
   writes `saStockAlmacen.stock`. Must be called explicitly per line,
   with `@sTipoStock='ACT'`, `@bSumarStock` derived from
   `tipo_trans`, and `@bPermiteStockNegativo` decided by the caller —
   there is no config flag that sets this per article or warehouse.

No trigger bridges step 2 to step 3. If an ERP client (or a naive
implementation of this module) dies between them, an adjustment gets
recorded with no effect on real stock. **This module must wrap all
three steps in one SQL transaction**, via a new stored procedure (see
Data Model).

`ajue_num` is generated through the standard `saConsecutivo` mechanism
(key `AJUS_NUM`), not through `pObtenerNroAjuste` — that procedure only
resolves a number from a physical-count session (`saInventarioFisico`,
also 0 rows in this DB), which this module does not use.

**Negative stock is already happening in production.**
`par_emp.i_stock_negativo = true` (global flag), and warehouse `000015`
already carries roughly -53,279 net units across its 88 articles. `
saAjuste` itself has zero historical rows — this module is a genuinely
new workflow, not digitizing an existing habit.

**`saTipoAjuste` has 6 real rows** (verified via live `SELECT`), split
by `tipo_trans`:

| `co_tipo` | `des_tipo` | `tipo_trans` |
|---|---|---|
| `E00001` | Entrada Produccion | `0` (entrada) |
| `E00002` | Entrada De Produccion Por Merma Convertida A Materia Prima | `0` |
| `S00001` | Salida | `1` (salida) |
| `S00002` | Merma De Produccion | `1` |
| `S00003` | Merma De Produccion A Materia Prima | `1` |
| `S00004` | Salida De Productos Dañados | `1` |

These populate the adjustment-reason dropdown directly — no new
Profit Plus config needed.

**`dbo.MovimientoInventario`** is a verified, pre-existing table-valued
function that unifies all 12 kinds of inventory movement (purchases,
sales, notes, returns, adjustments, transfers) into one chronological
stream with `total_entrada`/`total_salida` already converted to base
units. Its `AJUS` branch uses the exact same `saTipoAjuste.tipo_trans`
logic as `pStockActualizar`, so adjustments created by this module
appear in it automatically. This is the data source for both the stock
evolution chart and the consumption-rate calculation — no
reconstruction from raw movement tables is needed.

**`saArticulo` has 64 columns** (previous knowledge-base doc was
silently truncated at 40). Full verified list and edit-safety
classification now live in `erp-knowledge-base/docs/tables/saArticulo.md`.
Safe to quick-edit: `art_des`, `ref`, `modelo`, `comentario`,
`campo1`-`campo8`, `stock_min`/`stock_max`/`stock_pedido`. Never
touched by this module: pricing (separate `saArtPrecio` table), fiscal
fields (`tipo_imp*`, `co_reten`, `reten_iva_tercero`), costing/margin/
commission fields, classification (`co_lin`/`co_subl`/`co_cat` —
reclassifying an article affects reports across every module), the
serial/lote flags, and `anulado` (deactivation is procurement's call).
The only trigger on the table, `TrigEstado_saArticulo`, reacts solely
to `anulado` changes, so direct `UPDATE`s of the descriptive fields
above are safe.

### Knowledge base updates

The following `erp-knowledge-base/docs/` files were rewritten with
live-verified, complete data during this investigation (they replace
prior versions that were trimmed by a token-limited generation pass):
`tables/saArticulo.md`, `tables/saAlmacen.md`, `tables/saStockAlmacen.md`,
`tables/saAjuste.md`, `tables/saAjusteReng.md`, `tables/saTipoAjuste.md`,
`tables/saCostoHistoricoSalida.md`, `procedures/pStockActualizar.md`,
`procedures/RepMovimientoInventarioxArticulo.md`, and the previously
undocumented `procedures/MovimientoInventario.md`.

## Data Model

### Profit Plus (MSSQL) — one new stored procedure, no schema changes

Deployed through a **new, separate migration mechanism**
(`mssql-migrations/`, its own runner script and its own tracking table,
e.g. `dbo.__exporter_migrations`, inside the Profit Plus database) —
deliberately kept independent from `drizzle/migrations/`, which only
ever touches the app's own SQLite database. Different database,
different deploy target, different lifecycle: a Profit Plus schema
change should never ride along with an app auth-schema change.

`pApiCrearAjusteInventario(@Motivo, @Fecha, @CoUsIn, @CoSucuIn, @Lineas TVP)`
where `@Lineas` is a table-valued parameter of
`(co_tipo, co_art, co_alma, co_uni, total_art, cost_unit NULL-able, permitir_negativo)`.

Body, all inside one `BEGIN TRAN` / `ROLLBACK` on any error:

1. For any line where `cost_unit IS NULL`, resolve it via
   `SELECT TOP 1 costo FROM saCostoHistoricoEntrada WHERE co_art = ... ORDER BY fecha DESC`,
   falling back to `0` if the article has no cost history yet (e.g. a
   finished product analysts haven't priced).
2. Generate `ajue_num` via the existing `saConsecutivo` mechanism
   (`AJUS_NUM`), matching how the ERP itself numbers adjustments.
3. Insert the `saAjuste` header (same fields as
   `pInsertarAjusteEntradaSalida`).
4. Per line: insert into `saAjusteReng`, call
   `pCostoActualizarEntrada`/`Salida` per `tipo_trans` (cost layers),
   then call `pStockActualizar` with `@sTipoStock='ACT'`,
   `@bSumarStock` from `tipo_trans`, and the line's
   `permitir_negativo`.
5. Any `RAISERROR` (e.g. from `pStockActualizar`'s negative-stock
   guard) propagates out, the transaction rolls back completely — no
   header, no lines, no stock changes — and the API surfaces the
   original message (it already names the article and warehouse) so
   the user knows exactly which line failed.

No other Profit Plus schema changes. All reads use existing tables and
`dbo.MovimientoInventario`.

### App (SQLite/Drizzle) — three new tables

- **`user_modules`**: `user_id` (FK → `users.id`), `module` (text enum,
  starts with just `'inventory'`). Additive — the existing `role`
  enum keeps gating the admin-only screens (`/admin/users`); module
  membership is a separate, orthogonal axis. An `admin` implicitly has
  every module; a `user` needs an explicit row per module they can
  access.
- **`inventory_warehouses`**: `co_alma` (char(6), matches Profit
  Plus's warehouse code), `label` (text, admin-friendly name),
  `active` (bool). Admin-managed allowlist of which Profit Plus
  warehouses this module surfaces. When empty/unconfigured, the module
  falls back to "every warehouse with at least one `saStockAlmacen`
  row" so it isn't empty before an admin sets anything up — and so
  adding the planned finished-goods warehouse later is a data change,
  not a code change.
- **`inventory_settings`**: single-row (or key/value) table holding
  the low-stock rolling-window size (days) and the days-of-stock
  warning threshold, with sane defaults baked in.

## Module & Routes

Nav: new "Inventario" sidebar section, visible when
`session.modules.includes('inventory')` or `role === 'admin'`.
`/admin/users` gains a module-assignment control per user.

**Pages** (Spanish URIs, matching existing convention):

- **`/inventario`** — dashboard. Current stock per article/warehouse
  (`saStockAlmacen`, filtered to configured warehouses); a stock
  evolution chart per article, built from `dbo.MovimientoInventario`'s
  running balance (`SUM(total_entrada - total_salida)` ordered by
  `fecha, fe_us_in`, filtered `anulado=0`); a low-stock warnings list —
  `dias_restantes = stock_actual / consumo_diario_promedio`, where
  consumption is `SUM(total_salida)` from the `FACT` and `AJUS`
  (`tipo_trans='1'`) branches only (transfers excluded — internal
  movement isn't consumption) over the configured rolling window,
  divided by window size — flagged when under the configured
  threshold, with a suggested reorder quantity from `stock_pedido`
  (falling back to `consumo_diario_promedio × lead_time_days` if
  `stock_pedido` is unset).
- **`/inventario/articulos`** — the predefined item list: active
  `saArticulo` rows with stock in a configured warehouse, filterable by
  línea/categoría, inline quick-edit limited to the safe descriptive
  fields and stock thresholds listed above.
- **`/inventario/ajustes`** — adjustment history (`saAjuste` joined to
  `saAjusteReng`, `saTipoAjuste`, `saArticulo`, `saAlmacen`) plus a
  "new adjustment" form: pick warehouse (from the configured list) →
  add lines (article, reason from `saTipoAjuste`, quantity, optional
  cost override) → submit calls `pApiCrearAjusteInventario` once,
  atomically.
- **`/admin/config-inventario`** — admin-only: manage
  `inventory_warehouses` and `inventory_settings`.

**API routes** (English/technical, matching existing convention):
`GET/PATCH /api/inventory/items[/[co_art]]`,
`GET /api/inventory/dashboard`,
`GET/POST /api/inventory/adjustments`,
`GET/POST/PATCH /api/admin/inventory-settings`,
module-assignment additions to `/api/admin/users`.

Every inventory route calls `getSession()` and independently checks
module membership (or `admin`), matching how existing admin routes
each re-check `role` rather than relying solely on routing.

## Error Handling / Edge Cases

- **SP failure mid-adjustment**: caught in the API route, mapped to a
  per-line error in the adjustment form using the SP's own message
  (already names article/warehouse/stock numbers). Nothing is
  committed — confirmed all-or-nothing per product decision.
- **Article missing a `saArtUnidad` row for the chosen unit**:
  `pStockActualizar` aborts via `dbo.ArtUnidadBase` returning `NULL`.
  The adjustment form only offers units that exist in `saArtUnidad`
  for the selected article (fetched on article selection), never free
  text, so this should be unreachable in practice — the SP-level guard
  is a backstop.
- **Negative stock**: allowed but flagged, not blocked, matching the
  business's current live behavior (`i_stock_negativo=true`,
  warehouse `000015` already negative). The adjustment form's
  "permitir stock negativo" checkbox defaults to checked per line. A
  stricter opt-in could live in `inventory_settings` later; out of
  scope for v1.
- **Concurrent adjustments on the same article/warehouse**: handled by
  SQL Server's row lock during `pStockActualizar`'s `UPDATE` — no
  additional handling needed in the app layer.
- **No warehouses configured yet**: dashboard and item list fall back
  to "all warehouses with `saStockAlmacen` rows," so the module works
  immediately after deploy, before an admin visits
  `/admin/config-inventario`.
- **Article never priced** (`cost_unit` lookup finds nothing): SP
  falls back to `0` rather than failing the adjustment; the UI should
  visibly flag a `0` cost so an analyst can follow up, but does not
  block the stock movement itself.

## Testing

Following the repo's existing Playwright conventions
(`docs/superpowers/plans/2026-08-18-e2e-playwright-testing.md`) and its
`@mssql`-tagged tier for anything touching the ERP:

- **E2E, default tier**: nav visibility and route 403s for
  users with/without the `inventory` module; item quick-edit form
  validation (client-side only, no live MSSQL needed for this slice).
- **E2E, `@mssql` tier**: full adjustment creation against the
  dockerized mock ERP once `pApiCrearAjusteInventario` is added to its
  init scripts; verify a created adjustment appears in
  `/inventario/ajustes` and updates the dashboard's stock figure;
  verify an intentionally-failing line (insufficient stock, negative
  not permitted) rolls back the whole adjustment and surfaces the
  error.
- **Unit tests**: cost-default resolution logic, days-of-stock
  calculation, warehouse-allowlist fallback behavior.
- **Manual, pre-launch, not automated**: full negative-stock/rollback
  behavior against a real Profit Plus instance, since it depends on
  live `RAISERROR` behavior that's expensive to fully mirror in the
  mock — flagged here rather than silently assumed covered.

## Out of Scope (v1)

- Lot/serial tracking UI (no article in this database uses either).
- Item *creation* (procurement's responsibility).
- Editing pricing, fiscal, costing, or classification fields on
  `saArticulo`.
- Physical inventory count sessions (`saInventarioFisico` — unused,
  separate workflow from ad-hoc adjustments).
- A configurable "block negative stock" toggle beyond the existing
  per-line checkbox (could live in `inventory_settings` later).
- Fixing the `middleware.ts` gap noted in Context — unrelated to this
  module, flagged for separate follow-up.
