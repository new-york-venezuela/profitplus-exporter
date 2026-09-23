# Histórico 2025 — Legacy ERP Data Import

Date: 2026-09-23
Status: Approved, pending implementation plan

## Sequence

4th of 4 planned changes from this brainstorming session, in this order:
(1) `2026-09-23-historical-usd-conversion-design.md` (spec, plan written),
(2) `2026-09-23-seller-product-store-matrix-design.md` (spec, plan written,
blocked on #1), (3) a `migrations/` directory reorg (bounded, approved
in-chat design, no written spec/plan yet, runs after #2), (4) **this spec**.
This spec has no code dependency on #1–#3, but its own new migration file
should be added to whatever the migrations directory looks like by the time
its plan executes — if the #3 reorg has landed by then, this spec's new
`dwh-migrations/00NN_...sql` file becomes `migrations/dwh/00NN_...sql`
instead; the implementation plan for this spec should check the actual
directory layout at plan-writing time rather than hardcode a path from this
document.

## Context

Alimentos New York migrated Profit Plus ERP servers in March 2026, importing
everything from that month forward into the server the current DWH already
reads (`Ncake_a`, via `lib/db/mssql.ts`/`getPool()`). The DWH currently has
**zero data before March 2026** — a hard cutover, not a partial/overlapping
migration. A full year of prior history (January 2025 through February
2026) exists only on the old, still-reachable (as a linked server) SQL
Server instance, and the user wants it importable into the DWH so it's
visible in the Analítica dashboard, without corrupting or blending into
current-era reporting.

### The core complication: customer codes changed format at the cutover

At the March 2026 migration, customer codes changed scheme — from
sequential numbers (old system) to RIF-plus-suffix (new system, e.g. a
store gets `<RIF>-01`, `<RIF>-02` for multiple branches of one legal
entity). **Confirmed with the user: there is no reliable mapping from old
customer code to new customer code** — matching by RIF or name was
considered and rejected as not reliable enough to trust for real reporting.
This means a 2025 sale to "Panadería X" and a 2026 sale to the same
real-world business are **not linkable** through any key in either system.

The user was not sure whether product codes (`saArticulo.co_art`) or
sales-rep codes (`saVendedor.co_ven`) also changed at the cutover, and has
no live access to the old server right now to check. **Decision: treat all
three master-data types (customers, products, sales reps) the same
defensive way — as fully independent, unmapped identities between the old
and new systems** — rather than risk a silent bad join if a code turns out
to have changed for products/reps too. This is the same "no cross-
referencing" treatment as customers, applied uniformly rather than
selectively, since there's no evidence either way for products/reps.

### Scope: sales-relevant data only

Confirmed with the user: this import covers only what's relevant to sales
reporting — sellers, products, customers, and invoices (sales + returns).
**Not in scope:** collections, AR aging/snapshots, purchases, expenses, cash
movements. If historical collections/AR/purchases data is wanted later,
that's a separate future spec — this one does not touch
`Fact_Collections`/`Fact_AR_Snapshot`/`Fact_Purchases`/`Fact_Expenses`/
`Fact_CashMovements` or their dimensions in any way.

### Why this can't reuse the existing `Load_Dim_*`/`Load_Fact_*` machinery

Every existing `dwh.Load_Dim_Customer`/`Load_Dim_Product`/`Load_Dim_SalesRep`/
`dwh.Load_Fact_Sales`/`Load_Fact_Returns` procedure is watermark-based,
incremental, and hardcoded to source from `Ncake_a` (the current ERP). None
of that fits here:

- This is a **one-time** historical load, not an ongoing incremental sync —
  the old server's data is static (nothing there will ever change again)
  and the old server may be decommissioned once this import is done.
- The source database is a **different SQL Server instance** than
  `Ncake_a`, reachable as its own linked server, not a same-instance
  cross-database join.
- Loading into `Dim_Customer`/`Dim_Product`/`Dim_SalesRep`/`Fact_Sales`/
  `Fact_Returns` directly would require resolving old codes against current
  dimension rows — which Section "The core complication" above rules out as
  unreliable. Reusing the existing tables/procedures would either silently
  create wrong joins or require inventing a mapping this spec has already
  decided not to trust.

## Non-goals

- No blending of 2025 legacy data into any existing chart, KPI, or query.
  Every existing route (`ventas`, `resumen`, `productos`, `vendedores`,
  `profundidad-linea`, etc.) is completely untouched by this spec — they
  continue to query only `Fact_Sales`/`Fact_Returns`/`Dim_Customer`/
  `Dim_Product`/`Dim_SalesRep` exactly as today, and will simply never see
  legacy rows (which live in entirely separate tables — see Schema below).
- No attempt to reconcile/map old and new customer, product, or sales-rep
  identities — confirmed impossible for customers, and untested (so treated
  the same way) for products/reps.
- No ongoing sync — this is a single load, run once, from a source that can
  be decommissioned afterward. If the old server later turns out to have
  been updated, that's a manual re-run of the same script, not a case this
  spec's design needs to handle automatically.
- No collections, AR snapshot, purchases, expenses, or cash-movement
  history — sales and returns only.
- No currency/date-range filter beyond the fixed Jan 2025–Feb 2026 window
  this one-time load covers.

## Schema: new `_Legacy`-suffixed dimension and fact tables

New migration, next-numbered file in whatever the migrations directory is
at plan-writing time (see "Sequence" above) — schema only, no data (the
data load is a separate script, see below). Following the same
`IF NOT EXISTS`/re-runnable convention as every other file in
`dwh-migrations/`.

**New dimensions** (static snapshots — no SCD2, since this data is loaded
once and never revised):

```sql
dim.Dim_Customer_Legacy
  CustomerLegacyKey   int IDENTITY(1,1) PK
  CustomerCode        char(16)      NOT NULL   -- old sequential-number code, RTRIM'd
  CustomerName        varchar(120)  NULL
  ZoneCode            char(6)       NULL
  SegmentCode         char(6)       NULL
  LoadedAtUtc         datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()

dim.Dim_Product_Legacy
  ProductLegacyKey    int IDENTITY(1,1) PK
  ProductCode         char(30)      NOT NULL
  ProductName         varchar(120)  NULL
  LineCode            char(6)       NULL
  LineName            varchar(60)   NULL
  SubLineCode         char(6)       NULL
  SubLineName         varchar(60)   NULL
  CategoryCode        char(6)       NULL
  CategoryName        varchar(60)   NULL
  LoadedAtUtc         datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()

dim.Dim_SalesRep_Legacy
  SalesRepLegacyKey   int IDENTITY(1,1) PK
  SalesRepCode        char(6)       NOT NULL
  SalesRepName        varchar(60)   NULL
  ZoneCode            char(6)       NULL
  LoadedAtUtc         datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
```

No `LegalEntityKey`/`Dim_LegalEntity` rollup for legacy customers — that
rollup depends on `MatrizCode`/`saCliente.matriz` resolving against other
*current* customer rows (`dwh-migrations/0014_dim_legal_entity.sql`'s
`Load_Dim_LegalEntity`), which has no meaning across the unmapped
old/new boundary. Legacy customer rows are flat, one row per old customer
code — no "entidad vs. tienda" rollup for legacy data. If the old system
itself has a matriz-equivalent, that's a future enhancement, not required
by this spec (the user did not ask for it and no current evidence
establishes it's reliable).

**New facts** (mirroring `Fact_Sales`/`Fact_Returns`'s shape, minus the
columns that only make sense for current-era data):

```sql
fact.Fact_Sales_Legacy
  FactSalesLegacyKey   bigint IDENTITY(1,1) PK
  DateKey              int             NOT NULL   -- FK to the SHARED dim.Dim_Date
  CustomerLegacyKey    int             NOT NULL   -- FK to Dim_Customer_Legacy
  ProductLegacyKey     int             NOT NULL   -- FK to Dim_Product_Legacy
  SalesRepLegacyKey    int             NULL        -- FK to Dim_SalesRep_Legacy
  InvoiceNumber        char(20)        NOT NULL
  LineNumber           int             NOT NULL
  QuantitySold         decimal(18,5)   NOT NULL
  NetAmount            decimal(18,2)   NOT NULL
  DocumentExchangeRate decimal(21,8)   NULL
  IsVoided             bit             NOT NULL
  LoadedAtUtc          datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME()
  CONSTRAINT UQ_Fact_Sales_Legacy_Invoice_Line UNIQUE (InvoiceNumber, LineNumber)

fact.Fact_Returns_Legacy
  FactReturnsLegacyKey  bigint IDENTITY(1,1) PK
  DateKey               int             NOT NULL
  CustomerLegacyKey     int             NOT NULL
  ProductLegacyKey      int             NOT NULL
  SalesRepLegacyKey     int             NULL
  CreditNoteNumber      char(20)        NOT NULL
  LineNumber            int             NOT NULL
  QuantityReturned      decimal(18,5)   NOT NULL
  NetAmount             decimal(18,2)   NOT NULL
  DocumentExchangeRate  decimal(21,8)   NULL
  IsVoided              bit             NOT NULL
  LoadedAtUtc           datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME()
  CONSTRAINT UQ_Fact_Returns_Legacy_CreditNote_Line UNIQUE (CreditNoteNumber, LineNumber)
```

`DateKey` still resolves against the **existing, shared** `dim.Dim_Date` —
dates themselves didn't change meaning across the cutover, only customer/
product/rep identity did, so there's no reason to duplicate the date
dimension. `dim.Dim_Date` already covers 2020–2035
(`dwh-migrations/0003_dim_date.sql`), so Jan 2025–Feb 2026 is already
populated there.

No `WarehouseKey`/`CurrencyKey`/`GrossAmount`/`DiscountAmount`/`TaxAmount`/
`DocumentTypeKey`/cost columns — omitted because nothing in the Histórico
tab's scope (a Ventas-style trend/breakdown view) needs them, matching this
spec's "sales-relevant only" scope decision. `DocumentExchangeRate` is kept
because the Histórico tab's own USD figures need the same historical
per-row conversion approach as current-era data (see "Currency conversion"
below).

## One-time data load: `scripts/dwh-legacy-2025-import.ts`

A new, standalone script — **not** a `dwh-migrations/` file, and not part
of `scripts/migrate-dwh.ts`'s tracked/repeatable migration sequence.
Confirmed with the user: this is deliberately a separate one-off tool,
distinct from the "schema migrations are always safely re-runnable" concern
`dwh-migrations/` exists for. (The tables it loads INTO are still created by
a normal `dwh-migrations/` file, per "Schema" above — only the *data load
itself* is this separate script.)

### Connection

New environment variables, read only by this script (never by the running
app, so there's no risk of the live app trying to reach a server that may
be decommissioned after this import completes):

```
LEGACY_DB_SERVER=
LEGACY_DB_PORT=1433
LEGACY_DB_NAME=
LEGACY_DB_USER=
LEGACY_DB_PASSWORD=
LEGACY_DB_ENCRYPT=false
LEGACY_DB_TRUST_SERVER_CERT=true
```

Added to `.env.example` alongside the existing `DB_*`/`DW_*` blocks. The
script opens its own direct `mssql` connection to the DWH database (same
`getDwhPool()`-equivalent target as `scripts/migrate-dwh.ts` connects to)
**and** a separate connection to the legacy server via `LEGACY_DB_*` — this
is a genuine cross-server operation (two separate `mssql.ConnectionPool`
instances, not a SQL Server linked-server `OPENQUERY`/four-part-name join
inside a single T-SQL batch), since the two databases may not actually be
linked-server-configured against each other from the DWH server's own
perspective even though both are independently reachable from wherever this
script runs. The script reads all legacy rows into memory (bounded — Jan
2025–Feb 2026 is at most ~14 months of one mid-size business's invoice
lines, comparable in order of magnitude to the volumes already noted in
`dwh-migrations/README.md`'s "Performance note") and writes them to the DWH
via batched `INSERT`s, rather than relying on a live cross-server SQL join.

### Load order and logic

1. **Guard: refuse to run if `fact.Fact_Sales_Legacy` already has any rows**
   — prevents an accidental double-import. (No incremental/upsert logic
   needed — this is intentionally a single load, never repeated against a
   live-changing source.)
2. **`Dim_Customer_Legacy`** — straight load from the legacy server's
   `saCliente`: `RTRIM(co_cli)` → `CustomerCode`, `cli_des` → `CustomerName`,
   `co_zon` → `ZoneCode`, `co_seg` → `SegmentCode`. No filtering by
   inactive/active status — historical customers should all appear even if
   inactive today. No cross-referencing against current `Dim_Customer` (see
   "Non-goals").
3. **`Dim_Product_Legacy`** — straight load from the legacy server's
   `saArticulo` (joined to `saLineaArticulo`/`saSubLinea`/`saCatArticulo`
   for names, same join shape as `dwh-migrations/0006_dim_product.sql`'s
   `Load_Dim_Product`, just against the legacy connection instead of
   `Ncake_a`): `co_art` → `ProductCode`, `art_des` → `ProductName`,
   `co_lin`/`lin_des` → `LineCode`/`LineName`, `co_subl`/`subl_des` →
   `SubLineCode`/`SubLineName`, `co_cat`/`cat_des` → `CategoryCode`/
   `CategoryName`.
4. **`Dim_SalesRep_Legacy`** — straight load from the legacy server's
   `saVendedor`: `co_ven` → `SalesRepCode`, `ven_des` → `SalesRepName`,
   `co_zon` → `ZoneCode`.
5. **`Fact_Sales_Legacy`** — from the legacy server's `saFacturaVentaReng`
   joined to `saFacturaVenta` (same join shape as
   `dwh-migrations/0009_fact_sales.sql`'s `Load_Fact_Sales`, against the
   legacy connection), filtered to `fec_emis` between `2025-01-01` and
   `2026-02-29` inclusive (2026 is not a leap year — the actual end
   boundary is `2026-02-28`; the implementation plan must get this exact
   date right, not hardcode `02-29`), resolved against the just-loaded
   `Dim_Customer_Legacy`/`Dim_Product_Legacy`/`Dim_SalesRep_Legacy` (by
   `CustomerCode`/`ProductCode`/`SalesRepCode` match — these are all
   internally consistent within the legacy server itself, unlike the
   old-to-new cross-server case), and `dim.Dim_Date` (shared, by
   `DateKey`).
6. **`Fact_Returns_Legacy`** — same shape as step 5, from
   `saDevolucionClienteReng`/`saDevolucionCliente`, same date window.
7. Print a summary (row counts loaded per table) and exit. No watermark
   tracking (`dwh.EtlWatermark`) — this script is not part of the
   incremental-load system and is not expected to run again.

### Why fully independent product/sales-rep matching (not just customers)

Per "The core complication" above, the user does not know whether product
or sales-rep codes also changed at the cutover, and has no way to check
right now. Loading `Dim_Product_Legacy`/`Dim_SalesRep_Legacy` as their own
independent tables (rather than trying to match into current `Dim_Product`/
`Dim_SalesRep` by code) means this spec's correctness does not depend on an
unverified assumption. If a future person confirms product/rep codes were
in fact stable across the cutover and wants to reconcile them, that's an
additive future change (e.g. a nullable `LikelyCurrentProductKey` hint
column) — explicitly out of scope here per the user's own "fully
independent, no cross-referencing" decision.

## Currency conversion for legacy figures

`Fact_Sales_Legacy`/`Fact_Returns_Legacy` carry `DocumentExchangeRate`
exactly like their current-era counterparts (sourced the same way, from
`saFacturaVenta.tasa`/`saDevolucionCliente.tasa` on the legacy server).
The Histórico tab's own route computes BS/USD the same historical,
per-row way as every other in-scope route from
`2026-09-23-historical-usd-conversion-design.md` — i.e. it should reuse
`usdConversionJoin`/`dualAmountExpr` from `query-builder.ts` (built by that
other plan's Task 1) rather than inventing separate conversion logic,
exactly like the seller-matrix spec's export does. The `fx` fallback join in
`usdConversionJoin` reads `fact.Fact_ExchangeRate`, which is **not**
legacy-specific — it's the same shared exchange-rate history used
everywhere else in the DWH, and already covers 2025 (per
`0004_dim_currency_and_fact_exchangerate.sql`'s load, which pulls all of
`saTasa` from `2020-01-01` onward, from the CURRENT `Ncake_a` connection —
worth double-checking in the implementation plan that this rate history
actually has 2025 data, since it's plausible the old server's own `saTasa`
diverges from what got carried into the new one; if `Ncake_a`'s
`Fact_ExchangeRate` is missing 2025 rows, the fallback in
`usdConversionJoin` will silently produce `NULL` USD for those rows rather
than error, which is the same "known gap, not a crash" behavior the
historical-USD-conversion spec already designed for a missing rate).

This spec therefore has a soft dependency on
`2026-09-23-historical-usd-conversion-design.md`'s implementation (needs
`usdConversionJoin`/`dualAmountExpr` to exist) — but unlike the
seller-matrix spec, this isn't a hard blocker on the *code*, since the
Histórico route could theoretically inline its own copy of the same
formula. The implementation plan should still prefer calling the shared
helpers (once they exist) over duplicating the expression, for the same
consistency reason as the matrix spec.

## New tab: "Histórico 2025"

Added to `TABS` in `app/(app)/analitica/analitica-client.tsx`, gated by the
existing `dwh` module (no new module) — same as every other Analítica tab.

**Mirrors the existing Ventas tab's drill-down UX as closely as possible**
(confirmed with the user: "mirror as much as we can"), pointed at the new
legacy fact/dimension tables instead of `Fact_Sales`/`Fact_Returns`:

- A monthly trend chart (salesNet/returnsNet by month), matching
  `ventas/route.ts`'s `monthlyQuery` pattern.
- `groupBy` drill-down: mes → cliente (by `Dim_Customer_Legacy`, no
  entidad/tienda distinction since legacy customers have no
  `Dim_LegalEntity` rollup — see Schema) and mes → línea → producto
  (by `Dim_Product_Legacy`), matching `ventas/route.ts`'s `clienteQuery`/
  `lineaQuery`/`lineaProductBreakdownQuery` shapes.
- A KPI row (salesNet, activeClients, avgTicket, unitsSold) matching
  `VentasKpis`'s shape, computed against the legacy facts — no
  period-over-period comparison (`salesNetPrevPeriod`), since there is no
  "previous period" before this data's own start (January 2025) and no
  meaningful "next period" after it hands off to current-era data at a
  different customer/product identity scheme.
- **No date-range picker** — unlike every other tab, Histórico's data is a
  fixed, closed window (Jan 2025–Feb 2026, never added to again), so a
  `dateRange` selector would be misleading (implying more recent legacy
  data might appear). The tab can still let the user pick a groupBy level
  and drill down within that fixed window, same as Ventas, just without
  the month/YTD/custom range selector Ventas has.
- **Weekly view**: not required for this tab (that requirement was scoped
  to the separate seller-matrix feature, `WeekStartDate`/`YearWeek` on
  `dim.Dim_Date` — those columns, once added by that other spec, are
  available here too if wanted later, but this spec doesn't require using
  them).

**New API route** `app/api/dwh/historico/route.ts`, following the same
`section`/`groupBy` dispatch shape as `ventas/route.ts`, gated by
`requireDwhAccess`.

### Disclaimer banner (confirmed with user)

A permanent, non-dismissible banner at the top of the Histórico 2025 tab:

> Estos datos provienen del sistema anterior (enero 2025 – febrero 2026).
> Los clientes, productos y vendedores de este período son identidades
> independientes de los datos actuales — no se pueden cruzar ni sumar con
> las cifras de 2026 en adelante.

(Exact Spanish wording to be finalized during implementation, but the
content — old-system origin, independent identities, don't sum with
current data — is fixed by this spec.)

## Testing

- A unit test for the date-window boundary logic (2025-01-01 through
  2026-02-28) in the import script, following whatever pure-function-
  extraction pattern the other in-flight plans use for testable logic
  (e.g. extract the boundary-date computation into its own small function
  rather than inlining it directly in the script's `main()`).
- Route test for `app/api/dwh/historico/route.ts` following this repo's
  existing route-test convention (confirmed by the other two plans in this
  sequence: auth-smoke-tests only — assert 401 for an unauthenticated
  `GET` — since there are no live-DB integration tests at the
  `app/api/dwh/*` route level in this repo today).
- The one-time import script itself is not unit-testable against a live
  linked legacy server in CI (no such server is reachable there) — its
  correctness is verified by manual review of the row counts it prints
  after a real run against the actual legacy server, matching the
  "operational script, not a repeatable migration" framing already used for
  `scripts/dwh-backfill.ts`.
- New migration (creating the `_Legacy` tables) follows the existing
  `dwh-migrations/README.md` convention: re-runnable, verified by running
  `bun run migrate:dwh` locally against a test database before committing,
  same as every other file in that directory.

## Open items resolved during brainstorming

- **Source schema**: same Profit Plus schema as the current ERP, just an
  older server — confirmed.
- **Access**: legacy server reachable as a linked server (though the
  design above uses two separate application-level `mssql` connections
  rather than a live SQL-side linked-server join, for load-script
  simplicity and to avoid needing actual `sp_addlinkedserver`
  configuration) — confirmed reachable.
- **Load pattern**: one-time backfill script, not a permanent second source
  in the regular incremental ETL — confirmed.
- **UI labeling**: originally "a badge/note," refined once the design
  moved to a fully separate tab — a persistent disclaimer banner on that
  tab, not a badge scattered across blended charts (since nothing blends)
  — confirmed.
- **Data gap**: hard cutover, zero DWH data before March 2026 — confirmed.
  Actual window: **January 2025 through February 2026** (not a clean
  calendar-year boundary — the user migrated ERPs in March 2026 and
  imported that month forward on the new server).
- **Table scope**: sales-relevant only — Fact_Sales/Fact_Returns/
  Dim_Customer/Dim_Product/Dim_SalesRep and their legacy counterparts.
  Collections/AR/Purchases/Expenses/CashMovements excluded — confirmed.
- **Customer code mapping**: none exists or is trusted — confirmed, this is
  the spec's central design driver.
- **Other code stability (products/reps)**: unknown, unverifiable right now
  (no DB access for a spike) — decision: treat defensively/independently,
  same as customers, for all three dimensions — confirmed.
- **Schema shape**: separate `_Legacy` dimension AND fact tables (not dual
  nullable FK columns on the existing fact tables) — confirmed, chosen
  specifically because there's no blending, so a second set of tables has
  zero risk to existing queries versus adding unused nullable columns to
  production fact tables.
- **Blast radius**: brand-new, fully separate "Histórico" tab — no existing
  tab/route/query touched at all — confirmed.
- **Tab content depth**: mirror the full Ventas tab's drill-down UX as
  closely as reasonable, not a stripped-down single view — confirmed
  ("mirror as much as we can").
- **Product/rep matching**: fully independent, no cross-referencing or
  "likely match" hinting against current dimensions — confirmed.
- **Backfill invocation**: a separate one-off script
  (`scripts/dwh-legacy-2025-import.ts`), outside the `dwh-migrations/`
  repeatable-migration system — confirmed (the schema for the tables it
  loads into still goes through a normal migration file; only the data
  load itself is the separate script).
- **Legacy DB connection**: new `LEGACY_DB_*` env vars, read only by the
  one-off script, never by the running app — confirmed.
