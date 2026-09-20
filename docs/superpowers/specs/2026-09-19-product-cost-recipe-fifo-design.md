# Product Cost via Recipes + FIFO — Design

**Date**: 2026-09-19
**Status**: Approved for planning
**Scope**: v1 — read-only costing visibility. Production-run tracking (stock
decrement on batch execution) is explicitly out of scope; see "Future work."

## Problem

Alimentos New York (bakery/pastry, ProfitPlus company `Ncake_a`) needs to see
the live manufacturing cost of each finished product, computed from the
FIFO cost of the raw materials its recipe consumes, always expressed in USD.

## ERP research findings (validated live against `Ncake_a`, 2026-09-19)

- **`saArtCompuesto` / `saArtCompuestoReng` / `saArtCompuestoGen` /
  `saArtCompuestoGenReng`** — ProfitPlus's native BOM/recipe/production-run
  tables. Confirmed **0 rows** in all four, live. Never adopted by this
  business. Not used, not touched by this feature — writing recipes here
  would mean also owning `saArtCompuestoGen`'s production-run semantics
  (real stock consumption), which is bigger and riskier than what v1 needs.
- **`saCostoHistoricoEntrada`** (cost-layer ledger, one row per inbound
  layer: `cantidad`, `cantidad_usada`, `costo`, `fecha_emision`) and
  **`saCostoHistoricoSalida`** (exit log, links back to the specific entry
  layer consumed via `cod_costo_historico_entrada`) — this is real, live,
  and actively maintained. 713 entry rows / 4,624 exit rows in the
  restored-backup snapshot used for local dev.
- FIFO chain linkage (`cod_costo_historico_entrada IS NOT NULL`) is 100%
  for `AJUS` (manual inventory adjustments — the mechanism this app's own
  Inventory module uses) and ~7% for `FACT` (sales, which only ever exit
  finished-goods/service articles, never raw materials). **As of this
  app's inventory-adjustment feature going into real use in production,
  raw-material consumption is now tracked there** — confirmed by the user;
  the local backup snapshot predates that usage and shows no raw-material
  depletion, which is a property of the snapshot, not of the mechanism.
- No stored procedure computes "cost to produce a hypothetical recipe from
  current layers" — `pCostoActualizarEntrada`/`pInsertarCostoHistoricoEntrada`
  maintain the ledger (mark layers, consume them, chain them) but there's
  nothing that answers a virtual/read-only "what would this cost right now"
  question, because that requires recipe data ProfitPlus doesn't have. We
  are not reinventing FIFO bookkeeping — we're reading its real output and
  adding the one piece of logic (recipe-aware live costing) that has never
  existed anywhere in this system.
- **Currency**: base currency is `BSD` (`par_emp.g_moneda`), not `BS` as an
  earlier knowledge-base doc claimed (`BS` is a legacy code left over from
  Venezuela's currency redenominations, coincidentally also `cambio=1`).
  All `costo` values are in BSD. `saTasa` (`co_mone='USD'`) has the daily
  buy/sell rate; convert every cost figure to USD via the closest `saTasa`
  row on or before the as-of date.
- Units: only 5 units in real use (`KG`, `LTS`, `PAQ`, `SAC`, `UNID`);
  dual-unit conversion is marginal (1 article of 167). v1 recipe lines use
  a single plain quantity + unit label, no unit-conversion engine.

## Approach

Recipes are **owned by this app**, not ProfitPlus — new tables in the
existing SQLite app DB (`lib/db/schema.ts`), following the same pattern as
`inventory_warehouses`/`inventory_settings`. Each recipe line either
references a live ERP article (`co_art`) or is a manual line for
ingredients ProfitPlus never tracks (e.g. water from the utility service —
no purchase, no `co_art`, no cost layers).

Live cost is computed on demand, server-side, by a new pure-logic module
that reads `saCostoHistoricoEntrada` + `saTasa` read-only — no writes to
ERP, no dependency on `saArtCompuesto*`. Because it's a plain read
re-executed on every page load, it's automatically "live": any inventory
movement already recorded by this app's Inventory module (or directly in
ProfitPlus) is reflected the next time the cost is viewed, with no cache to
invalidate.

## Data model (new, in `lib/db/schema.ts` / `drizzle/migrations`)

```ts
export const recipes = sqliteTable('recipes', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  coArt:     text('co_art').notNull().unique(),   // finished-good article this recipe produces
  label:     text('label').notNull(),             // denormalized art_des snapshot, for display without a live ERP join on every list render
  active:    integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const recipeLines = sqliteTable('recipe_lines', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  recipeId:         integer('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  lineType:         text('line_type', { enum: ['erp_article', 'manual'] }).notNull(),
  coArt:            text('co_art'),               // set iff lineType === 'erp_article'
  manualLabel:      text('manual_label'),          // set iff lineType === 'manual', e.g. "Agua"
  quantity:         real('quantity').notNull(),    // amount of this ingredient per 1 unit of the recipe's finished good
  unit:             text('unit').notNull(),        // free-text display label (KG, LTS, UNID, ...), no conversion engine in v1
  manualUnitCostUsd: real('manual_unit_cost_usd'), // set iff lineType === 'manual'; USD cost per `unit`, defaults to 0 (informational) until the user sets a real figure
  sortOrder:        integer('sort_order').notNull().default(0),
});
```

Module grant: add `'recipes'` to the `module` enum in `userModules`
(`lib/db/schema.ts`) and `VALID_MODULES`
(`app/api/admin/users/[id]/modules/route.ts`), plus a `has RecipesAccess()`
helper mirroring `hasInventoryAccess`/`hasDwhAccess`, gating page + every
API route independently per this repo's established double-gate
convention.

## FIFO costing algorithm (`lib/costing/`)

For ingredient `co_art`, quantity needed `Q` (a recipe line's `quantity`):

1. `SELECT cantidad, cantidad_usada, costo, fecha_emision FROM saCostoHistoricoEntrada CHE JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid WHERE A.co_art = @coArt ORDER BY CHE.fecha_emision ASC`
2. Compute `remaining = cantidad - cantidad_usada` per layer; skip `remaining <= 0`.
3. Walk oldest → newest, consuming from `remaining` until `Q` is covered,
   accumulating `Σ (portion_from_layer_i × costo_i)`. This correctly spans
   multiple layers when the oldest alone doesn't cover `Q`.
4. If total remaining across all layers is less than `Q` (e.g. the article
   predates this app's inventory tracking, or was never purchased through
   a chain that creates layers), price the shortfall at the **most recent**
   layer's `costo` and mark that ingredient's contribution as **estimated**
   in the response — surfaced in the UI rather than silently blended in.
   If there are zero layers at all, the line has **no cost data** (`null`,
   not `0`) and is flagged prominently.
5. Convert the BSD total to USD: `SELECT TOP 1 tasa_v FROM saTasa WHERE co_mone = 'USD' AND fecha <= @asOf ORDER BY fecha DESC`.
6. Product cost = `Σ` over all recipe lines: `erp_article` lines use steps
   1–5; `manual` lines use `quantity × manualUnitCostUsd` (already in USD,
   no conversion).

This lives in a pure function taking a DB pool + recipe lines and returning
`{ totalUsd, lines: [{ ..., costUsd, estimated: boolean }], asOfRateDate }`
— unit-testable against synthetic layer data without a live DB, and reused
by both the API route and any future batch/production-run feature.

## UI

New module, Spanish-labeled to match the rest of the app, English enum
value `recipes` per existing convention (`inventory`, `dwh`):

- `app/(app)/recetas/page.tsx` — list of recipes (search by product,
  create new), gated by `hasRecipesAccess`.
- `app/(app)/recetas/[id]/page.tsx` — single recipe: header (product
  picker, reusing the existing `/api/inventory/items` search rather than
  building a second ERP article picker), editable line list (add/remove
  ERP-article or manual lines), and a live cost panel showing the computed
  USD total, per-line breakdown, and estimated/no-data flags inline.
- Admin: add a `recipes` checkbox column to
  `app/(app)/admin/users/users-client.tsx`, generalizing the existing
  `handleToggleModule` (already parameterized for this).

## API

- `GET/POST /api/recetas/recipes` — list / create.
- `GET/PUT/DELETE /api/recetas/recipes/[id]` — read / update (lines
  replace-on-save, matching this app's existing settings-form pattern) /
  delete.
- `GET /api/recetas/recipes/[id]/cost` — runs the FIFO algorithm live,
  returns the breakdown described above. No caching.

Every route: `getSessionFromRequest` → `hasRecipesAccess` → 403, matching
the rest of the app.

## Non-ERP ingredients (e.g. water)

`lineType: 'manual'` lines carry their own `manualUnitCostUsd`, defaulting
to `0` (informational placeholder) until the user enters a real figure
(e.g. derived from a utility bill). No attempt to auto-estimate; that's a
business decision for the user to make explicitly per ingredient.

## Testing

- Unit tests (`lib/costing/__tests__/`): the layer-walk algorithm against
  synthetic layer arrays — single layer covers `Q`, `Q` spans multiple
  layers, insufficient-layer shortfall, zero-layer no-data case, currency
  conversion date selection.
- Integration test (`__tests__/integration/`, `@mssql`-style, mirroring
  `test:mssql`): the live `saCostoHistoricoEntrada`/`saTasa` queries shaped
  correctly against the restored `Ncake_a` snapshot.
- E2E (Playwright): create a recipe (ERP line + manual line), view its
  live cost, tagged `@mssql` per the existing `reports.spec.ts` convention
  since it needs the real restored-backup container — excluded from the
  default `bun run e2e`, run via `bun run e2e:mssql`.

## Future work (explicitly out of scope for this design)

- Production-run tracking: logging a batch as actually produced, which
  would need either (a) writing real `AJUS`-equivalent consumption through
  this app's existing inventory-adjustment path (reuses proven, chained
  FIFO bookkeeping, no ERP schema risk), or (b) a parallel ledger this app
  maintains itself. Left for a follow-up design once v1's read-only costing
  is in use.
