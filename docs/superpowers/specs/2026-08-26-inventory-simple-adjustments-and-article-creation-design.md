# Inventory: Simple Movement Adjustments + Article Creation

## Goal

Two additive extensions to the inventory module
(`docs/superpowers/specs/2026-08-20-inventory-management-design.md`,
`docs/superpowers/specs/2026-08-20-inventory-adjustment-procedure-design.md`):

1. **A "simple ajuste" mode.** Today `/inventario/ajustes` only supports a
   physical-recount flow: pick an article, type the counted total, the app
   computes sobrante/faltante against Profit Plus's current stock. That's
   the wrong shape for the module's most common real use — production
   staff pulling raw material to bake, or dropping off finished product —
   where the user already knows the quantity moved (`50kg de harina
   salió`), not a new total to reconcile. This adds a second mode: pick a
   reason, an article, a warehouse, and a quantity; the app registers that
   exact movement directly. No stock lookup, no delta math.
2. **Article creation.** The original spec deliberately kept item
   *creation* out of scope ("stays procurement's job — this module only
   edits existing `saArticulo` rows"). That constraint is lifted for a
   narrow case: a newly developed product (e.g. a new bread) needs to
   exist in Profit Plus and be assigned to a warehouse (typically the
   production warehouse) before production or ajustes can reference it at
   all. This adds a minimal "crear artículo" form to `/inventario/articulos`,
   deliberately excluding pricing/fiscal/costing — same boundary the
   existing quick-edit form already respects.

Both features write to Profit Plus; both follow this module's existing
practice of wrapping any multi-step ERP write in one new stored procedure,
deployed via the existing `mssql-migrations/` mechanism, verified live
against the dev DB before shipping.

## Context

### Existing conventions this design follows exactly

- Every inventory API route independently calls `getSessionFromRequest` +
  `hasInventoryAccess` (`lib/inventory/access.ts`) — no new access model
  needed, both features are gated the same way the existing ones are.
- `inventoryWarehouses` (SQLite, admin-managed allowlist) already governs
  which `co_alma` values are selectable anywhere in this module — both
  new forms restrict their warehouse dropdown the same way
  `/api/inventory/adjustments` and the "add to warehouse" flow already do.
- Writes to Profit Plus go through a dedicated stored procedure wrapping
  every step in one `BEGIN TRAN`/`ROLLBACK`, deployed via
  `mssql-migrations/NNNN_*.sql` and the existing `bun run migrate:mssql`
  runner. Both features add one migration file each.
- `trimStrings` (`lib/trim-strings.ts`) is applied to every read of
  `char`-typed Profit Plus columns before returning JSON, matching every
  existing inventory route.

### Verified live against the dev DB (`Ncake_a`, 2026-08-26)

**`co_art` is a plain zero-padded sequential number, not a coded
scheme.** All 166 existing rows are `char(30)`, left-padded to 7 digits
(`0000001`…`0000166`), assigned in insertion order regardless of `tipo`
— no line/category prefix, no per-type series. `co_art` is the table's
PK (`PK_saArticulo`, confirmed via `sys.key_constraints`); there is no
"reserved but not yet visible" intermediate state, so a plain
`SELECT 1 FROM saArticulo WHERE co_art = @coArt` is a sufficient
uniqueness check. `MAX(TRY_CAST(co_art AS BIGINT)) + 1`, zero-padded to 7
digits, is a safe next-code suggestion.

**`pInsertarArticulo` is a pure `INSERT INTO saArticulo`** — verified by
reading its full live body via `OBJECT_DEFINITION`. It does **not**
cascade into `saArtUnidad`; that is always a separate, required call.
Every parameter documented in
`erp-knowledge-base/docs/procedures/pInsertarArticulo.md` is exactly
what the live body uses; nothing else undocumented surfaced. It also
calls `pInsertarPista` for the standard Profit Plus audit trail (matches
`pInsertarUnidadArticuloRenglon`'s own behavior, below) — this app's new
wrapper procedure doesn't need to touch that itself.

**Verified sane defaults for `saArticulo` NOT NULL columns this module
never exposes**, sampled across 5 real `tipo='M'` (materia prima) rows —
consistent across all 5:

| Column | Default | Verified |
|---|---|---|
| `co_color` | `'GEN'` | Exists in `saColor`, des = "Generico" |
| `co_ubicacion` | `'00001'` | Exists in `saUbicacion`, des = "Ubicacion por defecto" |
| `cod_proc` | `NULL` | Column is nullable |
| `tipo_imp` | `'1'` | — |
| `margen_min`, `margen_max` | `0` | — |
| `punt_ven`, `punt_cli` | `0` | — |
| `lic_mon_ilc`, `lic_capacidad`, `lic_grado_al` | `0` | — |
| `prec_om` | `true` | — |
| `tipo_cos` | `'1'` | — |
| `relac_unidad` | `0` | Matches "single unit, no alternate" — see below |

**`co_subl` (sub-línea) is the one classification field that can't be
defaulted to a constant.** Unlike `co_color`/`co_ubicacion`, it's a real
second classification level: `saSubLinea` has a composite key
(`co_lin`, `co_subl`) — 34 distinct sub-línea values exist across the
9 líneas, genuinely varying per línea, not a fixed default. The form
adds a Sub-línea dropdown, filtered by the chosen Línea (product
decision, see below) — same simple `<select>` pattern as Línea/Categoría,
just cascading.

**Lookup table sizes** (all trivially small — plain `<select>`, no
search UI needed): `saLineaArticulo` 9 rows, `saCatArticulo` 6 rows,
`saUnidad` 12 rows (BULTO, GAL, KG, LTS, MTS, M3, PAQ, PAR, PZA, SAC,
UNID, UNIMIG). `saSubLinea` row count not separately queried but implied
≤34 total across all líneas — fetched and filtered client-side by
`co_lin`, matching how Línea/Categoría options are already derived from
loaded data elsewhere in this module.

**`saArtUnidad` must be inserted via `pInsertarUnidadArticuloRenglon`,
not a raw `INSERT`.** Verified by reading its full body: it wraps the
insert with the same `pInsertarPista` audit-trail call and auto-sets
`fe_us_in`/`fe_us_mo`/`co_us_mo`/`co_sucu_mo`. Caller still supplies
`@iReng_Num` (line number — always `1`, single-unit article) and
`@sRevisado`/`@sTrasnfe`. Real single-unit rows (queried via
`relac_unidad=0`, which is what 100% of sampled articles actually use —
no row in this DB has `relac_unidad=1`) look like:

```
co_uni: (chosen unit)   relacion: false        equivalencia: 1
uso_venta: true         uso_compra: true
uni_principal: true     uso_principal: true
uni_secundaria: false   uso_secundaria: false
uso_numDecimales: false num_decimales: 0
```

This is the exact shape the new procedure's single `saArtUnidad` insert
uses — no conversion-factor UI, matching the earlier "single principal
unit only" decision.

### Product decisions made during brainstorming (recorded here since they
aren't derivable from the code)

- **Simple ajuste reuses all 6 existing production `saTipoAjuste`
  reasons as-is** (Entrada Producción, Salida, Merma De Producción,
  Merma De Producción A Materia Prima, Salida De Productos Dañados,
  plus the module already treats the two manual-recount codes as
  Ajustes-only). No new `saTipoAjuste` rows, no relabeling — Profit
  Plus's own `des_tipo` text populates the dropdown directly.
- **Direction is derived from the chosen reason, not picked separately.**
  Each `co_tipo` has a fixed `tipo_trans` in Profit Plus already; asking
  the user to also pick entrada/salida would let them contradict the
  reason they picked. The form has no direction toggle.
- **Simple ajuste has no stock-lookup/delta step.** The quantity typed is
  the movement itself, sent straight to the adjustment procedure as a
  single line. This is the core behavioral difference from the existing
  recount mode.
- **New articles always start at 0 stock.** Bringing in a real opening
  quantity is a deliberate follow-up action using the simple-ajuste flow
  (e.g. "Entrada Producción, 50kg") — kept as two separate, independently
  auditable operations rather than one combined create+stock call.
- **Article creation form stays minimal**: Código (app-suggested,
  editable), Nombre, Tipo, Línea, Sub-línea (filtered by Línea),
  Categoría, Unidad (single), Almacén inicial. No pricing, fiscal,
  costing, margin, or serial/lote fields — same boundary the existing
  quick-edit form already draws on `saArticulo`.

## Data Model

### Profit Plus (MSSQL) — two new stored procedures, no schema changes

Both deployed via new `mssql-migrations/NNNN_*.sql` files, following the
existing runner (`scripts/migrate-mssql.ts`) exactly as
`pApiCrearAjusteInventario` was.

**1. Simple ajuste — no new procedure needed.** The existing
`pApiCrearAjusteInventario(@Motivo, @Fecha, @CoUsIn, @CoSucuIn, @Lineas
TVP, @sAjueNumOut OUTPUT)` already accepts exactly the line shape this
feature needs: `(co_tipo, co_art, co_alma, co_uni, total_art, cost_unit
NULL, permitir_negativo)`. The simple-ajuste form is a new *caller* of
this same procedure with a single-line TVP, `co_tipo` taken directly
from the user's reason choice, `total_art` the typed quantity (no delta
computed), `cost_unit` left `NULL` (resolved server-side, same fallback
behavior as today), `co_uni` resolved from `saArtUnidad` for the chosen
article exactly as the recount flow already does it.
`permitir_negativo` defaults to the same per-line checkbox behavior the
recount flow already ships (checked by default, per the original spec's
decision — negative stock is allowed, not blocked, matching current live
ERP behavior).

**2. `pApiCrearArticuloInventario`** — new procedure, wraps article
creation in one transaction:

```sql
CREATE PROCEDURE [pApiCrearArticuloInventario]
    (
      @sCoArt      CHAR(30),
      @sArtDes     VARCHAR(120),
      @sTipo       CHAR(1),
      @sCoLin      CHAR(6),
      @sCoSubl     CHAR(6),
      @sCoCat      CHAR(6),
      @sCoUni      CHAR(6),
      @sCoUsIn     CHAR(6),
      @sCoSucuIn   CHAR(6) = NULL
    )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;

        IF EXISTS (SELECT 1 FROM saArticulo WHERE co_art = @sCoArt)
        BEGIN
            RAISERROR('El código de artículo %s ya existe', 16, 1, @sCoArt);
            RETURN;
        END

        EXEC pInsertarArticulo
            @sCo_Art = @sCoArt, @sdFecha_Reg = GETDATE(), @sArt_Des = @sArtDes,
            @sTipo = @sTipo, @bAnulado = 0,
            @sCo_Lin = @sCoLin, @sCo_Subl = @sCoSubl, @sCo_Cat = @sCoCat,
            @sCo_Color = 'GEN', @sCo_Ubicacion = '00001',
            @bGenerico = 0, @bManeja_Serial = 0, @bManeja_Lote = 0, @bManeja_Lote_Venc = 0,
            @deMargen_Min = 0, @deMargen_Max = 0,
            @sTipo_Imp = '1',
            @sGarantia = '', @deVolumen = 0, @dePeso = 0,
            @deStock_Min = 0, @deStock_Max = 0, @deStock_Pedido = 0,
            @iRelac_Unidad = 0,
            @dePunt_Ven = 0, @dePunt_Cli = 0,
            @deLic_Mon_Ilc = 0, @deLic_Capacidad = 0, @deLic_Grado_Al = 0,
            @bPrec_Om = 1, @sTipo_Cos = '1',
            @sCo_Us_In = @sCoUsIn, @sCo_Sucu_In = @sCoSucuIn,
            @sRevisado = 'N', @sTrasnfe = 'N';

        EXEC pInsertarUnidadArticuloRenglon
            @sCo_Art = @sCoArt, @iReng_Num = 1, @sCo_Uni = @sCoUni,
            @bRelacion = 0, @deEquivalencia = 1,
            @bUso_Venta = 1, @bUso_Compra = 1,
            @bUni_Principal = 1, @bUso_Principal = 1,
            @bUni_Secundaria = 0, @bUso_Secundaria = 0,
            @bUso_NumDecimales = 0, @iNum_Decimales = 0,
            @sCo_Us_In = @sCoUsIn, @sCo_Sucu_In = @sCoSucuIn,
            @sRevisado = 'N', @sTrasnfe = 'N';

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrState INT = ERROR_STATE();
        IF @@TRANCOUNT > 0 AND XACT_STATE() <> 0 ROLLBACK TRAN;
        RAISERROR('%s', @ErrSeverity, @ErrState, @ErrMsg);
        RETURN;
    END CATCH
END
```

Exact parameter names for `pInsertarArticulo` and
`pInsertarUnidadArticuloRenglon` must be confirmed against their full
signatures (the `pInsertarArticulo` signature is fully documented in
`erp-knowledge-base/docs/procedures/pInsertarArticulo.md`;
`pInsertarUnidadArticuloRenglon`'s full parameter list was read live
during this design's investigation but is not yet transcribed into the
knowledge-base doc — transcribe it there as part of implementation, the
same way the two corrections in the original ajuste-procedure plan were
recorded) before this ships — this body is a design-time draft, to be
proven by actually running it against the dev DB during implementation,
matching how `pApiCrearAjusteInventario` was hardened (see "Three bugs a
design-only pass would have missed" in the adjustment-procedure spec).
Same `BEGIN TRY`/`BEGIN CATCH` + explicit `ROLLBACK TRAN` pattern is used
proactively here, since that spec already found `XACT_ABORT` alone
insufficient once a nested procedure manages its own savepoint — worth
re-verifying whether `pInsertarArticulo`/`pInsertarUnidadArticuloRenglon`
do the same, rather than assuming they don't.

**Warehouse assignment reuses the existing endpoint unchanged.** After
`pApiCrearArticuloInventario` succeeds, the article-creation API route
calls the same logic already in
`app/api/inventory/items/[co_art]/warehouses/route.ts` (zero-stock
`saStockAlmacen` insert) — either by calling that route's POST handler
directly or by factoring its body into a shared function called from
both routes. That file already carries a flagged, unresolved risk (its
`INSERT INTO saStockAlmacen` column list was never verified against a
live schema, per its own comment) — resolve that verification as part of
this work, since article creation is about to depend on it more heavily
than before.

### App (SQLite/Drizzle) — no schema changes

Both features reuse `inventoryWarehouses` for warehouse scoping. No new
tables.

## Module & Routes

**`/inventario/ajustes`** gains a second mode alongside the existing
recount form — a mode toggle or two tabs ("Conteo manual" /
"Movimiento simple"), implementation detail for the plan. Simple mode:
**Motivo** (dropdown of the 6 production `saTipoAjuste` reasons,
direction implied) → **Artículo** (reuses the existing searchable
picker) → **Almacén** → **Cantidad**. Submits one line to
`pApiCrearAjusteInventario` via the existing `/api/inventory/adjustments`
POST route, extended to accept this second body shape
(`{coTipo, coArt, coAlma, cantidad}`) alongside the existing
recount shape (`{coArt, coAlma, countedStock}`) — discriminated by
presence of `coTipo`. History table (`historial-client.tsx`) needs no
changes: it already reads generically from `saAjuste`/`saAjusteReng`, so
simple-mode adjustments appear there automatically.

**`/inventario/articulos`** gains a "+ Crear artículo nuevo" action next
to the existing "+ Agregar artículo existente a un almacén" (same
pattern — collapsible inline panel). Form: Código (pre-filled from
`GET /api/inventory/items/next-code` or similar, editable),
Nombre, Tipo (V/M/S/C/E — a plain 5-option dropdown with Spanish
labels), Línea, Sub-línea (options filtered client-side once Línea is
chosen), Categoría, Unidad, Almacén inicial (same allowlist as the
existing add-to-warehouse dropdown). New route:
`POST /api/inventory/items` (the list route currently only has `GET`;
this adds `POST` to the same path, consistent with REST conventions
already used elsewhere — `PATCH` already lives on
`/api/inventory/items/[co_art]`). On success, the new article appears in
the items list at 0 stock in the chosen warehouse — same shape the
add-to-warehouse flow already produces, so no new list-rendering logic
is needed.

Also needed: `GET /api/inventory/lookups` (or fold into an existing
route) returning Línea/Sub-línea/Categoría/Unidad option lists — small,
static-ish reference data, fetched once when the create-article panel
opens.

## Error Handling / Edge Cases

- **Simple ajuste, article/warehouse pair with no `saStockAlmacen` row
  yet** (e.g. a brand-new article not yet assigned there): same 404
  ("Artículo no encontrado en ese almacén") the recount flow already
  returns — user must add the article to that warehouse first (existing
  flow, or the new create-article flow if the article doesn't exist at
  all).
- **Simple ajuste, negative-stock rejection**: identical to the existing
  recount flow's handling of `pApiCrearAjusteInventario`'s `RAISERROR`
  (mssql error number `50000`) — surfaced as a 400 with the DB's own
  message.
- **Article creation, duplicate `co_art`**: the new procedure's own
  `EXISTS` check raises a clear error before calling `pInsertarArticulo`
  at all, rather than relying on the PK violation's less friendly
  message. If two users' suggested codes collide, the second submit fails
  cleanly and the user can adjust the (editable) code field and retry.
- **Article creation, chosen Sub-línea doesn't belong to chosen Línea**:
  prevented client-side by only ever populating Sub-línea options from
  the already-selected Línea's rows — same defense-in-depth pattern as
  Ajustes' article-unit fetching (never free text, always sourced from a
  fetched list).
- **Article creation succeeds, warehouse-assignment step fails**: the
  article now exists in Profit Plus but isn't stocked anywhere yet. Not
  silently rolled back (the two are separate ERP calls per the "always
  reuse the existing warehouse-add endpoint" decision) — the API route
  surfaces a distinct error message telling the user the article was
  created but warehouse assignment failed, so they can retry just the
  "add to warehouse" step from `/inventario/articulos` without
  recreating the article. This mirrors the real ERP shape (two genuinely
  separate tables/operations) rather than pretending it's atomic.

## Testing

Following this module's existing tiering
(`docs/superpowers/plans/2026-08-18-e2e-playwright-testing.md`,
default vs. `@mssql`-tagged tiers):

- **Integration tests, `@mssql` tier**: `pApiCrearArticuloInventario`
  called directly (mirroring
  `__tests__/integration/inventory-adjustments.integration.test.ts`'s
  approach for the ajuste procedure) — successful creation produces a
  `saArticulo` row and a matching `saArtUnidad` row with the verified
  single-unit shape; duplicate `co_art` is rejected cleanly with no
  partial insert (verify via a follow-up `SELECT` that neither table
  gained a row); a full create → assign-to-warehouse → simple-ajuste
  entrada round trip ends with the expected `saStockAlmacen.stock`.
  Clean up test articles by deleting the inserted
  `saArticulo`/`saArtUnidad`/`saStockAlmacen` rows afterward (this DB
  has no soft-delete-only constraint on `saArticulo` the way adjustments
  do on `saAjuste`, but confirm that live before relying on it).
- **Integration tests, `@mssql` tier**: simple-ajuste single-line call
  through `pApiCrearAjusteInventario` for at least one entrada reason
  and one salida reason, confirming `saStockAlmacen.stock` changes by
  exactly the typed quantity (no delta math involved) and that a
  negative-stock rejection with `permitir_negativo=false` leaves stock
  and `saAjuste`/`saAjusteReng` unchanged — same pattern as the existing
  adjustment-procedure tests already prove for the recount caller.
- **E2E, default tier**: simple-ajuste form validation (reason required,
  quantity required and numeric, no stock lookup needed so no live MSSQL
  required for this slice) and create-article form validation (código
  uniqueness surfaced from a mocked 400, Sub-línea options empty until
  Línea chosen).
- **E2E, `@mssql` tier**: full create-article submission against the
  dockerized mock ERP, verifying the new article appears in
  `/inventario/articulos` at 0 stock in the chosen warehouse; full
  simple-ajuste submission verifying the adjustment appears in
  `/inventario/ajustes`' history and updates the dashboard's stock
  figure — same assertions the existing recount E2E spec already makes,
  extended to this second mode.

## Out of Scope

- Multi-unit articles (conversion factors, secondary units) — no article
  in this database uses `relac_unidad=1` today; the "single principal
  unit only" decision applies here exactly as it did to the original
  spec's broader unit-of-measure display work.
- Editing pricing, fiscal, costing, margin, commission, or serial/lote
  fields at creation time — same boundary the existing quick-edit form
  already respects on `saArticulo`.
- Bundling an opening-stock quantity into the create-article flow —
  deliberately kept as two separate operations (see Product Decisions).
- A dedicated Sub-línea/Línea/Categoría *management* UI — this design
  only reads those tables for dropdowns; creating new líneas/categorías
  stays out of scope, same as the original spec's classification-field
  boundary.
- Deactivating or editing articles created through this flow beyond what
  the existing quick-edit form on `/inventario/articulos` already
  allows.
