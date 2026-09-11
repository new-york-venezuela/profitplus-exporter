# Customer Legal Entity Grouping (P0) — Design

**Date**: 2026-09-10
**Status**: Draft, pending user review
**Author**: Claude (Sonnet 5), with Eugenio Doñaque

## 1. Purpose & Scope

This is project P0 of a larger analytics-improvement initiative (7 user-reported issues, decomposed into P0–P6; see conversation for full breakdown). P0 is the foundation every other project in the initiative depends on, so it ships first.

**Problem**: several of the company's largest customers are legally one entity operating many physical stores, each registered as a separate customer record in Profit Plus (`saCliente`). Today's DWH (`Dim_Customer`) treats every store as an independent customer with no relationship to its siblings. This causes two confirmed, concrete defects:

1. **Pareto segmentation is meaningless in production** (user-reported issue #4): `app/api/dwh/clientes/route.ts` groups sales by `CustomerKey` (= one store) and ranks stores individually. A chain like Excelsior Gama Supermercados, whose 24 stores collectively dwarf any single independent customer, never produces a single row large enough to cross the 20% cumulative-share threshold for segment A — its revenue is fragmented into 24 mid-size slices instead of one dominant one. **No customer ever lands in segment A.** Verified live against `Ncake_a.dbo.saCliente`: 4 chains share a `rif` across many `co_cli` rows — Excelsior Gama Supermercados (24 stores, RIF `J-30142060-8`), Farmatodo CA (19 stores, RIF `J-000202001`), Automercados Plaza S (19 stores, RIF `J-30672502-4`), Plansuárez (5 stores, RIF `J-305065616`).
2. **"Top customer" rankings and drilldowns are incomparable** (user-reported issue #1): the user cannot compare "Gama" (currently shown, if at all, as one store or an arbitrary aggregation) against "La Muralla" (a single-store independent customer) because Gama's true scale is invisible — split across 24 rows, none individually competitive with a strong single-store customer.

This almost certainly also explains user-reported issue #2 (a Gama store missing from the Devoluciones tab's customer view) — if Gama's returns are similarly fragmented by store, no single Gama store may clear whatever cutoff (top-N) that view applies, even though the chain in aggregate would.

**Fix**: introduce a **legal entity grouping** layer in the DWH so any analytics that ranks or segments "customers" can operate at the legal-entity grain (all stores under one RIF, rolled into one row) while still allowing drilldown to the individual store — store-level drilldown itself is P3, out of scope here. This spec only builds the grouping; P1/P2/P3 consume it.

**Explicitly in scope**: `Dim_Customer` schema change, ETL logic to populate it, and updates to the Clientes, Ventas, Devoluciones, and CxC API routes so their top-N/ranking/segmentation queries roll up to entity grain by default.

**Explicitly out of scope**:
- Store-level drilldown UI (cliente → tienda breakdown) — that's P3.
- Fixing the specific Gama-missing-from-Devoluciones bug beyond what this grouping fixes structurally — if it persists after P0 ships, it gets a separate bugfix, but the working hypothesis (confirmed plausible by the data above) is that P0 resolves it as a side effect.
- Any UI/copy changes beyond what's needed to show entity-level names/totals instead of store-level ones in existing top-N lists.

## 2. Source System Facts Grounding This Design

Verified live against `Ncake_a.dbo.saCliente` (read-only queries via the exporter's existing `lib/db/mssql.ts` connection):

- **The grouping key already exists and is clean**: `saCliente.rif` is populated consistently and identically across every store belonging to the same chain — no whitespace/casing/format drift observed across the 4 verified chains (58 store rows total). Grouping by `LTRIM(RTRIM(rif))` is sufficient; no fuzzy matching or manual mapping table is needed.
- **Each chain has a "parent" customer record distinct from its numbered stores**: `co_cli` for the parent is the bare RIF (no store suffix), e.g. `J-301420608` for Gama, `J-00020200-1` for Farmatodo, `J-306725024` for Plaza, `J-30506561-6` for Plansuárez — note the parent's `co_cli` formatting doesn't always exactly match the child rows' `rif` formatting (dash position can differ), which is exactly why grouping must key off `rif`, not `co_cli` prefix-matching. The parent's `cli_des` is the clean legal/trade name (e.g. `"EXCELSIOR GAMA SUPERMERCADOS, C.A."`, `"FARMATODO CA"`) — this is the name to display for the entity, not a derived or heuristic name.
- **The parent record is not a dormant shell — it transacts on its own**: live query against `saFacturaVenta` confirmed direct invoices posted to the parent `co_cli` itself, separate from its stores' invoices (Gama parent: 34 invoices, ~17.8M total_neto; Farmatodo parent: 32 invoices, ~144K; Plaza parent: 17 invoices, ~79.6K; Plansuárez parent: 6 invoices, ~6). **Entity totals must sum parent + all child stores** — treating the parent as just a label with no transactions of its own would silently drop real revenue.
- **One data-quality irregularity observed, not blocking**: Automercados Plaza has one child row with a malformed `co_cli` (`J306725024-18` — missing the dash after `J`, unlike its siblings' `J-306725024-N` shape) — it still carries the correct `rif` value, so RIF-based grouping is unaffected, and it still ends in the trailing `-18` store-suffix shape the parent-detection heuristic (§3.3) checks for, so it is correctly excluded from being mistaken for a parent record despite its malformed prefix. No other irregularities found in the sample; a broader one-time audit of the full `saCliente` table (not just the 4 known chains) happens naturally once this ships, since the grouping logic runs over all customers, not a hardcoded chain list.
- **`Dim_Customer.LegalEntityRIF` already exists as a column** (`dwh-migrations/0005_dim_customer.sql`) but is currently populated as `= src.rif` per row — i.e., it was scaffolded for exactly this purpose but never used for grouping. This spec activates it rather than adding a new column.
- **This is a general mechanism, not a 4-chain special case**: any customer whose `rif` is shared by ≥2 `saCliente` rows is a multi-store legal entity under this design, whether or not it was one of the 4 chains found during investigation. Independent single-store customers (the common case) are entities of size 1 and pass through unchanged.

## 3. Design

### 3.1 Approach: entity rollup via a new dimension, not a `Dim_Customer` schema rewrite

Two ways to model this were considered:

**A. New `Dim_LegalEntity` dimension, `Dim_Customer` gets a `LegalEntityKey` FK (recommended)**. `Dim_Customer` keeps representing individual `saCliente` rows (stores) exactly as today — nothing about per-store data changes. A new small dimension, one row per distinct normalized RIF, carries the entity's display name and aggregate identity. Facts (`Fact_Sales`, `Fact_Returns`, `Fact_Collections`, `Fact_AR_Snapshot`) don't change at all — they still join to `Dim_Customer` by `CustomerKey` as today; queries that want entity-grain results join through `Dim_Customer.LegalEntityKey → Dim_LegalEntity` and `GROUP BY LegalEntityKey` instead of `GROUP BY CustomerKey`.

**B. Collapse all stores into one `Dim_Customer` row per entity.** Rejected: this destroys the store-level grain that P3's drilldown needs, and would require rewriting how every existing fact table's `CustomerKey` resolves (a store's invoice would need to resolve to the entity's single `CustomerKey`, losing which physical store the invoice belongs to — unrecoverable without re-deriving from source).

Approach A is the natural Kimball pattern here (an "outrigger" / higher-grain rollup dimension) and is strictly additive: existing store-grain queries are untouched, entity-grain queries are new.

### 3.2 Schema changes

**New dimension `dim.Dim_LegalEntity`**:

| Column | Type | Notes |
|---|---|---|
| `LegalEntityKey` | int IDENTITY PK | |
| `LegalEntityRIF` | varchar(20) NOT NULL, unique | Normalized (`LTRIM(RTRIM(...))`) RIF — the grouping key |
| `LegalEntityName` | varchar(120) | Display name. Sourced from the parent `saCliente` row's `cli_des` where a parent exists (bare-RIF `co_cli`, i.e. no `-N` suffix); falls back to the single member's own name for entities of size 1 |
| `StoreCount` | int | Count of `Dim_Customer` rows (current version) carrying this RIF — cheap to denormalize here, saves a join+count in every UI that shows "24 tiendas" |
| `LoadedAtUtc` | datetime2(3) | |

Type 1 (overwrite) — legal entity membership is not expected to need historical time-travel the way customer credit limits do; revisit if that assumption breaks.

**`dim.Dim_Customer` change**: add `LegalEntityKey int NULL` (FK to `Dim_LegalEntity`), populated by `Load_Dim_Customer` after `Dim_LegalEntity` loads. `LegalEntityRIF` (the existing raw-RIF column) stays as-is for backward compatibility / debugging — `LegalEntityKey` is the new join path analytics code should use.

**No changes to any `Fact_*` table** — they keep joining `Dim_Customer` by `CustomerKey` exactly as today.

### 3.3 ETL logic

New procedure `dwh.Load_Dim_LegalEntity`, run after `Load_Dim_Customer` in the load order (dimensions load Customer first since LegalEntity is derived from it, then a second pass updates Customer's `LegalEntityKey` — see below):

```sql
-- One row per distinct normalized RIF with >0 current customers
MERGE dim.Dim_LegalEntity AS tgt
USING (
  SELECT
    LTRIM(RTRIM(c.LegalEntityRIF)) AS LegalEntityRIF,
    COUNT(*) AS StoreCount,
    -- Prefer the parent record's name (the saCliente row whose CustomerCode
    -- has no numeric store suffix); fall back to any member's name.
    COALESCE(
      MAX(CASE WHEN c.CustomerCode NOT LIKE '%-[0-9]%' THEN c.CustomerName END),
      MAX(c.CustomerName)
    ) AS LegalEntityName
  FROM dim.Dim_Customer c
  WHERE c.IsCurrent = 1 AND c.LegalEntityRIF IS NOT NULL AND LTRIM(RTRIM(c.LegalEntityRIF)) <> ''
  GROUP BY LTRIM(RTRIM(c.LegalEntityRIF))
) AS src
ON tgt.LegalEntityRIF = src.LegalEntityRIF
WHEN MATCHED THEN UPDATE SET tgt.LegalEntityName = src.LegalEntityName, tgt.StoreCount = src.StoreCount
WHEN NOT MATCHED THEN INSERT (LegalEntityRIF, LegalEntityName, StoreCount, LoadedAtUtc)
  VALUES (src.LegalEntityRIF, src.LegalEntityName, src.StoreCount, SYSUTCDATETIME());
```

Then `Load_Dim_Customer` (existing procedure) gets one additional `UPDATE` step after its current insert/close-out logic, backfilling `LegalEntityKey` for any current-version row where it's stale or null:

```sql
UPDATE c
SET c.LegalEntityKey = le.LegalEntityKey
FROM dim.Dim_Customer c
JOIN dim.Dim_LegalEntity le ON le.LegalEntityRIF = LTRIM(RTRIM(c.LegalEntityRIF))
WHERE c.IsCurrent = 1 AND (c.LegalEntityKey IS NULL OR c.LegalEntityKey <> le.LegalEntityKey);
```

**Load order**: `Load_Dim_Customer` (as today, populates `LegalEntityRIF`) → `Load_Dim_LegalEntity` (new, derives entities from current customer rows) → re-run the `LegalEntityKey` backfill `UPDATE` above (can live at the end of `Load_Dim_LegalEntity` itself, so callers don't need to remember a 3-step order). This keeps the existing `EXEC dwh.Load_Dim_Customer` call sites working; only one new `EXEC dwh.Load_Dim_LegalEntity` line is added to the incremental-load script and the DWH guide's documented run order, immediately after `Load_Dim_Customer`.

The `NOT LIKE '%-[0-9]%'` parent-detection heuristic is checked against all 4 known chains' data above and holds, but is a heuristic, not a guarantee for every future chain — if a chain's parent row doesn't match this pattern, its `LegalEntityName` falls back to "any member's name" (`MAX(c.CustomerName)`), which is a reasonable-if-imperfect default, not a crash or null.

### 3.4 API/query changes

`app/api/dwh/clientes/route.ts`: `customerQuery` changes its `GROUP BY` from `fs.CustomerKey` to `c.LegalEntityKey` (falling back to `fs.CustomerKey` for the rare case for `LegalEntityKey IS NULL`, which shouldn't occur once ETL runs but is a defensive `COALESCE` rather than an assumption), and its display name from `Dim_Customer.CustomerName` to `Dim_LegalEntity.LegalEntityName`. The Pareto walk logic (§ existing code, lines 59–81) is unchanged — it already just consumes whatever rows the query returns in `SalesNet DESC` order.

`app/api/dwh/ventas/route.ts`, `app/api/dwh/devoluciones/route.ts`, `app/api/dwh/cxc/route.ts`: any "top cliente" ranking query gets the same `GROUP BY` change (`LegalEntityKey` instead of `CustomerKey`) for its customer-facing breakdown. Store-level detail (if any currently shown) is preserved as-is until P3 adds proper drilldown — this spec only changes what the *default/top-level* customer view groups by.

### 3.5 Testing

- Unit/integration test on the new `Load_Dim_LegalEntity` procedure: seed `Dim_Customer` with a synthetic multi-store chain (matching the parent + N children pattern) and an independent single-store customer, run the procedure, assert `Dim_LegalEntity` gets one row per distinct RIF with correct `StoreCount` and the parent's name preferred.
- Integration test on `Load_Dim_Customer`'s new backfill step: assert every current-version customer row ends up with a non-null `LegalEntityKey` pointing at the right entity.
- API test on `clientes/route.ts`: with the DWH test fixture extended to include a multi-store chain's sales, assert the chain appears as one row with summed `SalesNet` and that its Pareto segment reflects the combined total (regression test directly targeting user-reported issue #4).
- Manual verification against the reference test DB (or production, read-only) post-deploy: confirm Gama/Farmatodo/Plaza/Plansuárez each appear as a single row in the Clientes tab with `StoreCount` matching the live counts found during investigation (24/19/19/5).

## 4. Rollout

This changes ETL (new migration + procedure) and 4 API routes. No UI redesign — existing tables/cards just show entity names and entity-scale numbers where they previously showed one store's slice. Migration file: `dwh-migrations/0014_dim_legal_entity.sql`. Ships as its own PR; P1–P6 build on top of it in the agreed sequence (P0 → P3 → P1+P2 → P6 → P5).
