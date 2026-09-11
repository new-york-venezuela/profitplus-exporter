# Customer Legal Entity Grouping & Generic Drilldown Pivot — Design

**Date**: 2026-09-10
**Status**: Approved by user via superpowers:brainstorming (section-by-section), pending final spec review
**Author**: Claude (Sonnet 5), with Eugenio Doñaque

**Note on history**: an earlier version of this file was self-committed by a misbehaving research subagent without user review or approval, using a RIF-text-matching approach and claiming a "P0-P6 sequence agreed with the user" that was never actually agreed. That version has been fully superseded by this one, which reflects an actual brainstorming session with the user (see `Claude-Session` link in the commit that introduces this version) and uses a materially different, more reliable grouping mechanism (`saCliente.matriz`, not RIF matching — see §2). This spec covers ONE project out of a larger, still-informal backlog (Ventas/Devoluciones drilldowns, Vendedores/Clientes/CxC pivots, Finanzas/Compras, Zonas) — no cross-project sequence is committed to here.

## 1. Purpose & Scope

**Problem**: several of the company's largest customers are legally one entity operating many physical stores, each registered as a separate customer record in Profit Plus (`saCliente`). Today's DWH (`Dim_Customer`) treats every store as an independent customer with no relationship to its siblings. This causes concrete, confirmed defects:

1. **Pareto segmentation is meaningless in production**: `app/api/dwh/clientes/route.ts` groups sales by `CustomerKey` (= one store) and ranks stores individually. `PARETO_THRESHOLDS = { a: 0.2, b: 0.5 }` (route.ts:18) assigns tier A only while cumulative revenue share is ≤20% — since a dominant chain's revenue is split across ~20 rows, no single row's own share crosses 20% early in the sorted walk, so **tier A ends up empty** even though the company has real customer concentration.
2. **"Top customer" rankings and drilldowns are incomparable**: the user cannot compare "Gama" (fragmented across ~24 rows) against "La Muralla" (one row) because Gama's true scale never surfaces as a single number.
3. **A returning chain (Gama) does not appear in Devoluciones' customer view**: `app/api/dwh/devoluciones/route.ts:63-77` groups by `CustomerKey`, `ORDER BY ReturnsNet DESC`, `TOP 50` — the same fragmentation means no single Gama store individually clears the cutoff, even though the chain in aggregate would be the top return-generator.

**Fix**: introduce a legal-entity rollup layer in the DWH (§2-3), and a generic, reusable "group by / break down by" query and UI mechanism (§4-5) so Ventas, Devoluciones, Vendedores, Clientes, and CxC can all pivot across Cliente (entity or store grain), Producto, and Vendedor consistently.

**Explicitly in scope**:
- `Dim_Customer` schema change + ETL to resolve each customer row to a legal entity via `saCliente.matriz`.
- A generic pivot query-builder (extending `app/api/dwh/lib/query-builder.ts`) and a shared `<GroupedDrilldownTable>` frontend component.
- Wiring `groupBy`/`breakdownBy` into Ventas, Devoluciones, Vendedores, Clientes, and CxC routes/tabs, with dimensions: Cliente (Entidad | Tienda), Producto, Vendedor.
- A one-line CSS fix for the Ventas top-clientes label clipping bug (unrelated root cause, bundled because it's in a file this work touches).
- A one-line label/tooltip clarification for "Tasa cobr." in Vendedores (collection-efficiency ratio, not AR-based; can exceed 100%).
- New `e2e/analitica.spec.ts` (`@mssql`-tagged) covering the toggle and one breakdown expansion.

**Explicitly out of scope** (separate future brainstorming cycles):
- Productos tab's store filter (small, independently scoped by the user).
- Finanzas/Compras rework sourced from Profit's accounting schema (`scCuenta`/`scCentro`/`scGastos`) — needs its own design once open questions about live data population are resolved.
- Zonas/geographic concentration analytics (`saZona`/`Dim_Customer.ZoneCode` already flow into the DWH unused, but need their own `Dim_Zone` design).

## 2. Source System Facts Grounding This Design

Verified live, read-only, against the exporter's own dev database connection (`Ncake_a`, the same source `saCliente` table the DWH ETLs from):

- **`saCliente.matriz` is the correct grouping mechanism — not RIF matching.** It is a `char(16)` nullable column: the `co_cli` of a store's parent/casa-matriz record. Profit Plus has a native stored procedure, `pSucursalesVsCasaMatriz` (module Clientes), that resolves `SELECT co_cli FROM saCliente WHERE matriz = @sCliente` — i.e., Profit already models this relationship; this design activates the same field rather than inferring a relationship from RIF text.
- **Live population check** (144-row dev/test `saCliente`): 68 rows have `matriz` populated, across 6 distinct parent groups. Sizes: 23, 18, 18, 4, 3, 2 stores (Gama, Plaza, Farmatodo, Plansuárez, and two smaller chains).
- **`matriz` vs. RIF grouping — `matriz` is strictly safer.** Every RIF-based group already known (Gama, Farmatodo, Plaza, Plansuárez) has `matriz` group sizes exactly one less than the RIF group sizes (e.g. Gama: 23 via `matriz` vs. 24 via RIF) — because `matriz` correctly excludes the parent from its own children list, while RIF grouping lumps the parent in with its children (still correct once we add the parent back explicitly, see below). More importantly: RIF grouping produces **false positives** `matriz` does not — several RIF-sharing pairs found live (e.g. "Hipermercado Paramo", "Farmacia Daranpe", "Inversiones Luvebras", "Mi Negocio Supermercados") have `distinct_matriz_in_group = 0`, meaning they are two separate customers who happen to share a fiscal RIF for legitimate reasons unrelated to being one retail chain — RIF-only grouping would have wrongly merged them. `matriz` does not have this failure mode since it's an explicit, intentional link Profit's own data entry sets.
- **The parent record transacts on its own.** Confirmed in a prior investigation pass (live query against `saFacturaVenta`): parent `co_cli` rows post real invoices directly (e.g. Gama's parent alone: 34 invoices, ~17.8M). **Entity totals must sum the parent's own transactions plus all children's** — user confirmed this is the desired semantics (§ brainstorming decision: "Padre + hijos = una sola entidad").
- **`Dim_Customer.LegalEntityRIF` already exists** (`dwh-migrations/0005_dim_customer.sql`) but is populated as `= own rif` per row and used nowhere in application code. This design does not repurpose it as the grouping key (superseded by `matriz`); it can remain as-is for debugging/back-reference, or be removed in a later cleanup — not addressed by this spec.
- **Dev/test database is small** (144 total `saCliente` rows) — chain sizes and row counts here are illustrative of the mechanism, not production scale; production volumes are unverified.

## 3. Data Foundation Design

### 3.1 Approach: new dimension, `Dim_Customer` untouched at store grain

**New dimension `dim.Dim_LegalEntity`** — one row per legal entity (a multi-store chain, or a standalone customer counted as an entity of size 1):

| Column | Type | Notes |
|---|---|---|
| `LegalEntityKey` | int IDENTITY PK | |
| `RootCustomerCode` | char(16) NOT NULL | The `co_cli` that anchors this entity: the parent's code for a chain, or the customer's own code if standalone |
| `LegalEntityName` | varchar(120) | Parent's `cli_des` for a chain; the customer's own name if standalone |
| `StoreCount` | int | Count of `Dim_Customer` rows resolving to this entity, including the parent/root itself |
| `LoadedAtUtc` | datetime2(3) | |

Type 1 (overwrite) — no time-travel need identified for entity membership; revisit if that assumption breaks.

**`dim.Dim_Customer` gets `LegalEntityKey int NOT NULL`** (FK), resolved per current-version row as:
1. If `saCliente.matriz` is populated and resolves to another current customer row → entity = that parent's `Dim_LegalEntity` row.
2. Else if this row's own `CustomerCode` is referenced as `matriz` by ≥1 other row → this row is itself a parent → entity = a new/existing `Dim_LegalEntity` row rooted at itself.
3. Else → standalone customer → entity = a `Dim_LegalEntity` row rooted at itself, `StoreCount = 1`.

Every customer row resolves to exactly one entity under this logic; no row is left with a null `LegalEntityKey`.

**No changes to any `Fact_*` table** — `Fact_Sales`, `Fact_Returns`, `Fact_Collections`, `Fact_AR_Snapshot` keep joining `Dim_Customer` by `CustomerKey` exactly as today. Entity-grain queries join through `Dim_Customer.LegalEntityKey → Dim_LegalEntity`.

### 3.2 ETL logic

New procedure `dwh.Load_Dim_LegalEntity`, run immediately after `Load_Dim_Customer` in the load order:

```sql
-- Step 1: upsert one Dim_LegalEntity row per root (parent-with-children, or standalone)
MERGE dim.Dim_LegalEntity AS tgt
USING (
  SELECT
    root.CustomerCode AS RootCustomerCode,
    root.CustomerName AS LegalEntityName,
    1 + ISNULL(child_counts.ChildCount, 0) AS StoreCount
  FROM dim.Dim_Customer root
  LEFT JOIN (
    SELECT LTRIM(RTRIM(c.MatrizCode)) AS ParentCode, COUNT(*) AS ChildCount
    FROM dim.Dim_Customer c
    WHERE c.IsCurrent = 1 AND c.MatrizCode IS NOT NULL AND LTRIM(RTRIM(c.MatrizCode)) <> ''
    GROUP BY LTRIM(RTRIM(c.MatrizCode))
  ) child_counts ON child_counts.ParentCode = root.CustomerCode
  WHERE root.IsCurrent = 1
    AND (
      -- root has no parent of its own ...
      root.MatrizCode IS NULL OR LTRIM(RTRIM(root.MatrizCode)) = ''
      -- ... OR its parent code doesn't resolve to any current customer row
      -- (orphaned/bad data) - treat it as its own root rather than dropping it.
      OR NOT EXISTS (
        SELECT 1 FROM dim.Dim_Customer p
        WHERE p.IsCurrent = 1 AND p.CustomerCode = LTRIM(RTRIM(root.MatrizCode))
      )
    )
) AS src
ON tgt.RootCustomerCode = src.RootCustomerCode
WHEN MATCHED THEN UPDATE SET tgt.LegalEntityName = src.LegalEntityName, tgt.StoreCount = src.StoreCount
WHEN NOT MATCHED THEN INSERT (RootCustomerCode, LegalEntityName, StoreCount, LoadedAtUtc)
  VALUES (src.RootCustomerCode, src.LegalEntityName, src.StoreCount, SYSUTCDATETIME());

-- Step 2: backfill Dim_Customer.LegalEntityKey for every current row (root or child).
-- Mirrors step 1's root-resolution exactly: a populated MatrizCode is only
-- trusted as "has a parent" if that parent actually exists as a current row;
-- otherwise (no MatrizCode, or an orphaned one) the row is its own root.
UPDATE c
SET c.LegalEntityKey = le.LegalEntityKey
FROM dim.Dim_Customer c
JOIN dim.Dim_LegalEntity le
  ON le.RootCustomerCode = CASE
       WHEN LTRIM(RTRIM(ISNULL(c.MatrizCode, ''))) <> ''
            AND EXISTS (
              SELECT 1 FROM dim.Dim_Customer p
              WHERE p.IsCurrent = 1 AND p.CustomerCode = LTRIM(RTRIM(c.MatrizCode))
            )
       THEN LTRIM(RTRIM(c.MatrizCode))
       ELSE c.CustomerCode
     END
WHERE c.IsCurrent = 1 AND (c.LegalEntityKey IS NULL OR c.LegalEntityKey <> le.LegalEntityKey);
```

This requires a new `MatrizCode char(16) NULL` column on `Dim_Customer`, populated by `Load_Dim_Customer` from `saCliente.matriz` (same pattern as its other columns) — added in the same migration as `LegalEntityKey`.

**Load order**: `Load_Dim_Customer` (now also populates `MatrizCode`) → `Load_Dim_LegalEntity` (new; does both the entity upsert and the `LegalEntityKey` backfill) — one new `EXEC dwh.Load_Dim_LegalEntity` line added immediately after `Load_Dim_Customer` in the incremental-load script and the DWH guide's documented run order.

**Edge case**: if a row's `MatrizCode` points to a `co_cli` that doesn't exist as a current `Dim_Customer` row (orphaned reference — bad data), both steps above explicitly check for that and fall through to "no parent," making the row its own root — this is checked consistently in both the root-selection query and the backfill's join condition, so no row is left with a null `LegalEntityKey`. This is a silent-but-safe default, not a crash; worth a one-time data-quality check post-deploy but not a blocking condition.

**Migration file**: `dwh-migrations/0014_dim_legal_entity.sql`.

## 4. Generic Pivot Query-Builder

### 4.1 Why generic, not per-tab bespoke (approach chosen: A)

Considered three approaches: (A) one shared query-builder + shared UI component reused across 5 tabs, (B) per-tab bespoke SQL with only the UI component shared, (C) ship only the data foundation now, defer any pivot/breakdown UX to a later cycle. The user asked for the Cliente/Producto/Vendedor breakdown to be included now (not deferred), which makes (A) the right call — building it generically once avoids five near-duplicate, drift-prone implementations of the same grouping logic that (B) would produce, and avoids the near-certain need to generalize (C)'s narrow version again immediately after.

### 4.2 Dimension model

```ts
type Dimension = 'cliente_entidad' | 'cliente_tienda' | 'producto' | 'vendedor';

interface DimensionSpec {
  joinClause: string;        // e.g. "JOIN dim.Dim_Customer c ON c.CustomerKey = f.CustomerKey JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey"
  groupByColumn: string;     // e.g. "le.LegalEntityKey"
  labelExpr: string;         // e.g. "le.LegalEntityName"
  valueExpr: string;         // the value returned for use as a `parentValue` filter on drill-in
}
```

Each `Dimension` maps to a fixed `DimensionSpec` the query-builder owns centrally (extends `app/api/dwh/lib/query-builder.ts`, which today only has `getUsdRate`/`buildDateWhereClause`). Routes stay in control of their own fact table, metric columns (`SUM(NetAmount) AS SalesNet`, etc.), and filters — matching today's existing pattern (`clienteQuery`/`lineaQuery` in `ventas/route.ts`) but with the `GROUP BY`/join logic parameterized by `Dimension` instead of hand-duplicated per query function.

### 4.3 API contract

Routes accept:
- `groupBy: Dimension` — top-level grouping (default varies per tab, e.g. Ventas defaults to `mes` as today, unaffected).
- `breakdownBy?: Dimension` — when present alongside `parentValue`, returns a second, cheap query scoped to just that one parent row's children (the row-expand fetch). Never computes a full cross-join of all combinations.
- Existing params (`dateRange`, `currency`, `month`, `salesRepKey`) unchanged.

This is a natural extension of the existing `GroupBy` union type and `breadcrumb` array already in `app/(app)/analitica/types.ts` and `ventas/route.ts` — not a new pattern from scratch.

### 4.4 Frontend

One shared `<GroupedDrilldownTable>` component: two selects ("Agrupar por" / "Desglosar por"), rows expandable inline, breakdown rows lazy-fetched on expand (not precomputed). Each consuming tab passes its own metric column definitions (labels, formatting, which numeric fields to show) but not its own fetch/expand logic — that's owned by the shared component.

## 5. Per-Tab Application

| Tab | Change |
|---|---|
| **Ventas** | `clienteQuery` groups by `cliente_entidad` (default) or `cliente_tienda` (toggle) instead of always `CustomerKey`. Adds `breakdownBy: producto \| vendedor`. Also: fix the top-customer label clipping bug — `tab-ventas.tsx:179-190`, Recharts `ResponsiveContainer` has no top margin and `YAxis width={160}` is too narrow for long entity names; add `margin.top` and widen/wrap the axis label. |
| **Devoluciones** | Same `cliente_entidad`/`cliente_tienda` grouping change to `clienteMatrixQuery` (`devoluciones/route.ts:63-77`) — this alone fixes Gama not appearing in the top-50 (entity-grain sum crosses the cutoff). Adds the same `breakdownBy` options. |
| **Clientes / Pareto** | `customerQuery`'s `GROUP BY` changes from `fs.CustomerKey` to entity grain by default (fixes zero-tier-A structurally — the existing `PARETO_THRESHOLDS` walk logic at lines 64-72 is unchanged, it just now receives correctly-aggregated rows). Keeps a `cliente_tienda` toggle for viewing fragmentation within an entity. |
| **Vendedores** | Adds `breakdownBy: producto \| cliente_tienda` — answers "which rep performs best with which product/store." Also: clarify the "Tasa cobr." label/tooltip (`tab-vendedores.tsx:47`) — it's collected ÷ net sales in the period, per rep; not AR-aging based, can exceed 100%. |
| **CxC** | Adds `groupBy: cliente_entidad \| cliente_tienda` so AR aging rolls up consistently with the other tabs. |

## 6. Testing

- **Unit tests**: `Load_Dim_LegalEntity` resolution logic — parent-with-children, standalone customer, and orphaned-`MatrizCode` cases (no DB needed, pure logic/fixture test against the SQL or an equivalent JS model if the ETL logic is factored to allow it; otherwise a scripted integration test against a seeded test schema).
- **Integration tests**: seed `Dim_Customer` with a synthetic chain (parent + N children) and a standalone customer, run `Load_Dim_LegalEntity`, assert correct `Dim_LegalEntity` rows and `LegalEntityKey` backfill.
- **API-level tests**: `clientes/route.ts` with DWH test fixtures extended to include a multi-store chain's sales — assert the chain appears as one row with summed `SalesNet` and lands in the correct Pareto tier.
- **E2E**: new `e2e/analitica.spec.ts` (`@mssql`-tagged, following the existing `reports.spec.ts` pattern): log in, open `/analitica`, verify the Entidad/Tienda toggle changes the Ventas top-clientes list, confirm the seeded multi-store chain's entity total appears in Devoluciones and in Pareto tier A, and exercise one row-expand (breakdown) interaction.
  - **Local environment note**: the docker MSSQL container (`profitplus-erp-mock`) itself works correctly (verified live 2026-09-10 — the previously-documented "bak file missing" blocker no longer reproduces). Running `@mssql`-tagged specs locally does currently fail with "Playwright requires Node.js 20 or higher" (local Node is 18.20.8) — a one-time local environment fix (`nvm install 20`), not a project blocker, but called out here so implementation isn't surprised by it.

## 7. Rollout

Changes: one new migration (`dwh-migrations/0014_dim_legal_entity.sql`), one new load procedure, extensions to `app/api/dwh/lib/query-builder.ts`, changes to 5 API routes (`clientes`, `ventas`, `devoluciones`, `vendedores`, `cxc`), one new shared frontend component (`<GroupedDrilldownTable>`), one CSS bug fix, one label/tooltip fix, one new E2E spec. Ships as its own PR. No other project from the broader backlog (Productos filter, Finanzas/Compras, Zonas) is sequenced or committed to here — each gets its own brainstorming cycle when picked up.
