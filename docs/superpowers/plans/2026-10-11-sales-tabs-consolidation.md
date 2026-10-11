# Sales Tabs Consolidation (plan C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the Analítica sales tabs: add the month-pace strip to Resumen, group/route filters + visit compliance + inactive list + patrimonio/nuevo to Clientes, line > sub-line > product drill with a Fresco/Congelado filter and a product x customer-group share matrix to Productos, limit Histórico to 2025, and remove the Vendedores, Profundidad de Línea, Matriz Vendedor-Producto and Cadencia tabs (code, routes, e2e, help) without breaking Vendedor 360 / Seguimiento.

**Architecture:** Capability is added first, deletion last, so the app builds and tests pass after every task. Business rules are pure modules (`lib/clientes/scope.ts`, `lib/productos/group-share.ts`, `app/(app)/analitica/lib/cartera.ts`, `lib/dwh/depth-tier.ts`, `lib/dwh/historico-window.ts`, `app/(app)/analitica/lib/tab-keys.ts`); SQL that needs disposable-DWH coverage lives in `lib/*/queries.ts`-style modules that take a `mssql` pool. Clientes extends the existing "Cobertura de clientes" section (it already has last-invoice per current customer) instead of adding a parallel customer list; Productos extends its existing drill and its inline "Profundidad" table. The one piece of Profundidad that another feature depends on (Vendedor 360's `coverage`) is moved to `lib/dwh/seller-coverage.ts` before the route is deleted.

**Tech Stack:** Bun (`bun test`), Next.js 16 App Router, React 19 + Tailwind, `mssql` via `getDwhPool()`, Drizzle/`bun:sqlite`, React Testing Library on happy-dom, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-11-sales-tabs-refactor-design.md` (section "C. Consolidation", Decisions table, Risks). Depends on plan A `docs/superpowers/plans/2026-10-11-route-data-layer.md` (`dim.Dim_Customer.ErpSegmentCode/RegisteredDate/IsMigrationBatch/VisitFrequency/VisitIntervalDays`, `dim.Dim_Zone`, `dim.Dim_Segment`, `lib/dwh/cutover.ts`) and plan B `docs/superpowers/plans/2026-10-11-seguimiento-tab.md` (`lib/seguimiento/*`, `components/seguimiento/visuals.tsx`, `app/api/dwh/lib/consignment.ts`, `tabs/tab-seguimiento.tsx`, `components/quota-editor.tsx`), both merged on this branch before this plan starts.

## Global Constraints

- Branch `feat/sales-tabs-refactor`; do not switch branches. Every commit message ends with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- DWH queries only through `getDwhPool()`; every user-controlled value reaches SQL through `.input()`. The only interpolated SQL is a date window from `buildDateWhereClause` / `buildReturnsDateWhereClause` and fixed fragments built in code from validated values (alias names are regex-checked).
- Module gate on every route (`requireDwhAccess(request)`: 401/403, error shape `{ error: string }`); `/analitica` page is already gated by `hasDwhAccess`. Do not add a route without the gate.
- Money is `DualAmount { bs: number; usd: number | null }` built with `dualAmountExpr` + `usdConversionJoin`; `usd: null` renders "—", never `$0`. Ventas brutas = `SUM(Fact_Sales.NetAmount)`.
- Customer attributes (route, group, frequency, seller) always come from the **current** `Dim_Customer` row (`IsCurrent = 1`) resolved by `CustomerCode`; invoices may point at an older SCD2 version.
- Visit frequency: `Dim_Customer.VisitIntervalDays` NULL means "Sin frecuencia" and is never overdue and never read as 0 (`lib/seguimiento/visit-compliance.ts`).
- Patrimonio / nuevo are derived with `customerKindInYear` (`lib/dwh/cutover.ts`), never stored.
- Product hierarchy: Line (`Dim_Product.LineName`) > SubLine (`SubLineName`: Artesanal/Industrial) > product; `CategoryName` (Fresco/Congelado) is a filter, **not** a drill level. Customer group = `Dim_Segment.SegmentName` via `Dim_Customer.ErpSegmentCode`.
- Local DWH/ERP are stale copies of production. Tests use mocks (`mock.module` on `@/lib/dwh/access` and `@/lib/db/dwh-mssql`) or a disposable DWH (`DW_NAME` set at the top of the test file, `--timeout 30000`). Production-dependent assumptions are in "Verify on production".
- Default Playwright suite (`bun run e2e`) has no DWH and `scripts/e2e-seed.ts` seeds only SQLite users, so every Analítica e2e that needs data in the default suite uses `page.route` mocks; real-data specs are tagged `@mssql` (`bun run e2e:mssql`). Always run e2e with `SQLITE_PATH=./e2e/.tmp` (already in `.env.test`; see memory "Dev DB wipe hazards"). `/analitica` needs the `adminPage` fixture (the seeded plain user has no `dwh` grant).
- Spanish user-facing text, English identifiers. Tailwind classes follow the sibling tabs. Data-driven dropdowns use `lib/components/searchable-select.tsx`; fixed small enums stay native `<select>`.
- Component tests: import `screen` from `test/dom-setup` FIRST, call `cleanup` in `afterEach`, `mock.module` for `posthog-js`, set `globalThis.fetch` per test, dynamic `await import(...)` after `mock.module`.
- Delete only what a grep proves unreferenced; each deleting task lists the references it found and the command that proves none remain.

## Review Focus

1. **Moved customers and the group/route filter.** A customer re-routed or re-grouped by `mapping:apply` has several `Dim_Customer` versions; old invoices point at the old version. The filter must follow the current row (an invoice on an old S2 version of a customer now in S1 counts under S1 only). Pinned in Task 5 (disposable DWH) and Task 7.
2. **No visit frequency yet.** Until `mapping:apply` runs, `VisitIntervalDays` is NULL for everyone: nobody is overdue, the compliance KPI reads "—" (not 0%), cells read "Sin frecuencia". Pinned in Tasks 3, 4, 6, 11.
3. **NULL-heavy product matrix.** Customers with no group, products with NULL `CategoryName`/`SubLineName`, negative or zero rows, a category with no sales: the matrix must show a "Sin grupo" column, shares must sum to 100% per row, an absent cell is "—" (not 0%), and an empty result renders the empty state. Pinned in Tasks 7, 8.
4. **Old links and dead API paths.** `?tab=vendedores|profundidad|matriz-vendedor|cadencia` must open Resumen (no "Tab not found"); the deleted `/api/dwh/{vendedores,profundidad-linea,matriz-vendedor,cadencia}` and `/api/cadencia-targets` return 404 rather than silently working. Pinned in Tasks 2, 12-15 and the e2e spec.
5. **Vendedor 360 coverage after Profundidad is gone.** `coverage` must keep working once `profundidad-linea/route.ts` is deleted AND must not depend on `Dim_Customer.SegmentCode IN ('CADENA','INDEPENDIENTES')` (the business groups replace those values). Pinned in Task 1 (disposable DWH + unit tests).

## Decisions the user may want to veto

1. **Clientes extends "Cobertura de clientes"** (it already has a per-current-customer last invoice, seller, status, XLSX export and print) with Ruta, Grupo, Tipo (patrimonio/nuevo), Visita columns, visit KPIs and a "Sin compras en el período" list. It does **not** call plan B's `fetchCustomers`: that query computes the same last-invoice-per-customer already present in `lib/clientes/cobertura-sql.ts`, and a second customer query would let the two lists disagree. It does reuse `visitCompliance`/`summarizeCompliance`/`VisitBadge`/`customerKindInYear`.
2. **Group/route filters apply to the whole Clientes tab** (cobertura, Pareto, trend, churned). On the Pareto/trend/churned queries the filter scopes the *sales* side by customer code; returns are still correlated per entity (Entidad grain) so a chain whose stores are in different groups attributes all its returns to each group row. Exact at Tienda grain. Noted in the tab.
3. **Productos keeps:** the line > sub-line > product drill with returns/netas, the stacked units-by-line chart, and the presence table (clients, stores, price, units, return rate) now with the Primera/Segunda/Addon tier badge derived from client penetration. **Productos drops** from Profundidad: the CADENA/INDEPENDIENTES columns and "gap list" (those values stop meaning anything once customer groups replace them), the editable tier thresholds (fixed at 70%/30% via `DEFAULT_TIER_THRESHOLDS`), and the "Cobertura por vendedor" leaderboard UI (the per-seller number survives on Vendedor 360). **Matriz Vendedor-Producto is dropped entirely**, including its seller x product x store grid and XLSX export: account-level follow-up is covered by Seguimiento's customer -> invoice-line drill and Clientes' lists. Say so if you want the store matrix or its export kept.
4. **Category (Fresco/Congelado) is a filter only** (a select), not an additional split column.
5. **Vendedor 360 coverage is recomputed segment-agnostically** (penetration of tiered lines over all active legal entities) in `lib/dwh/seller-coverage.ts`; numbers can differ slightly from today's CADENA+INDEPENDIENTES sum for chains whose stores sat in both segments.
6. **`visit_cadence_targets` (SQLite) is left in `lib/db/schema.ts`** with a deprecation comment, no Drizzle migration: dropping it would destroy the manually entered cadence targets with no way back, and a leftover empty-use table costs nothing. Its code (`/api/cadencia-targets`, the cadencia route, target resolution) is removed.
7. **Histórico 2025** keeps its label; window becomes `20250101..20251231` in the sales AND returns queries. Jan-Feb 2026 stay in the legacy tables (and in `scripts/dwh-legacy-2025-import.ts`, unchanged) but are visible nowhere.
8. **Tab registry module** (`app/(app)/analitica/lib/tab-keys.ts`) is introduced so tab removal/fallback is unit-testable; behavior is otherwise the same as the inline `TABS` array.

## File structure

New: `app/(app)/analitica/lib/tab-keys.ts`, `app/(app)/analitica/lib/cartera.ts`, `app/(app)/analitica/components/cartera-filter-bar.tsx`, `app/(app)/analitica/components/resumen-pace.tsx`, `app/(app)/analitica/components/productos/{group-share-matrix,depth-table}.tsx`, `lib/clientes/{scope,cobertura-sql}.ts`, `lib/productos/{group-share,queries}.ts`, `lib/dwh/{depth-tier,seller-coverage,historico-window}.ts`, `scripts/dwh/__tests__/consolidation-queries.test.ts`, `e2e/analitica-consolidation.spec.ts`.
Modified: `analitica-client.tsx`, `tab-resumen.tsx`, `tab-clientes.tsx`, `tab-productos.tsx`, `tab-historico.tsx`, `components/cobertura-clientes.tsx`, `lib/cobertura.ts`, `types.ts`, `app/api/dwh/{clientes,clientes/cobertura,productos,historico,vendedor-360}/route.ts`, help/docs.
Deleted (Tasks 12-15): `tab-vendedores.tsx`, `tab-profundidad.tsx`, `tab-matriz-vendedor.tsx`, `tab-cadencia.tsx`, `app/api/dwh/{vendedores,profundidad-linea,matriz-vendedor,cadencia}/`, `app/api/cadencia-targets/`, and their e2e specs.

---

## Task 1: Move line-depth tiers and seller coverage to neutral `lib/dwh` and rewire Vendedor 360

**Files:**
- Create: `lib/dwh/depth-tier.ts`, `lib/dwh/seller-coverage.ts`
- Create: `scripts/dwh/__tests__/consolidation-queries.test.ts` (shared disposable-DWH seed; Tasks 4, 5, 7 append tests)
- Modify: `app/api/dwh/vendedor-360/route.ts` (drop the `getProfundidadLinea` import and the block that calls it, ~lines 12, 512-545)
- Test: `__tests__/unit/dwh/depth-tier.test.ts`, `__tests__/unit/dwh/seller-coverage.test.ts`

**Interfaces:**
- Consumes: `SellerCoverageRow` (`app/(app)/analitica/types.ts`, unchanged: `{ salesRepKey: string; salesRepName: string; entitiesServed: number; ownPenetration: number | null; baselinePenetration: number | null; gapVsBaseline: number | null }`); `runDwhMigrations`, `dwhDatabaseName` from `scripts/migrate-dwh.ts`.
- Produces:
```ts
// lib/dwh/depth-tier.ts
export type DepthTier = 'primera' | 'segunda' | 'addon' | 'sin-ventas';
export interface TierThresholds { firstLineMinPenetration: number; secondLineMinPenetration: number }
export const DEFAULT_TIER_THRESHOLDS: TierThresholds;               // 0.7 / 0.3
export function classifyTier(penetration: number | null, hasAnySales: boolean, thresholds?: TierThresholds): DepthTier;
// lib/dwh/seller-coverage.ts
export function computeGapVsBaseline(own: number | null, baseline: number | null): number | null;
export interface LineStat { line: string; entitiesBuying: number; salesGrossBs: number }
export function pickTieredLines(stats: readonly LineStat[], totalEntitiesActive: number, thresholds?: TierThresholds): { tieredLineNames: string[]; baselinePenetration: number | null };
export interface SellerLineCounts { salesRepKey: string; salesRepName: string; entitiesServed: number; tieredLinesCovered: number }
export function buildSellerCoverageRows(sellers: readonly SellerLineCounts[], tieredLineCount: number, baselinePenetration: number | null): SellerCoverageRow[];
export function fetchSellerCoverage(pool: sql.ConnectionPool, dateWhere: string, thresholds?: TierThresholds): Promise<SellerCoverageRow[]>;   // dateWhere uses alias `fs`
```
Rules: penetration of a line = distinct legal entities that bought it / distinct legal entities with any sale in the window (all segments pooled). Tiered lines = lines classified `primera` or `segunda`. A seller's own penetration = distinct (legal entity, tiered line) pairs it sold / (entities it served x tiered line count). Rows with `entitiesServed = 0` are dropped; sorted by `gapVsBaseline` ascending (worst first, `null` treated as 0). No tiered lines => `[]`.

- [ ] **Step 1: Write the failing unit tests**

`__tests__/unit/dwh/depth-tier.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import { DEFAULT_TIER_THRESHOLDS, classifyTier } from '../../../lib/dwh/depth-tier';

describe('classifyTier', () => {
  test('no sales at all is sin-ventas regardless of penetration', () => {
    expect(classifyTier(0.9, false)).toBe('sin-ventas');
  });
  test('boundaries are inclusive: 70% is primera, 30% is segunda', () => {
    expect(classifyTier(0.7, true)).toBe('primera');
    expect(classifyTier(0.6999, true)).toBe('segunda');
    expect(classifyTier(0.3, true)).toBe('segunda');
    expect(classifyTier(0.2999, true)).toBe('addon');
  });
  test('null penetration with sales is addon, not a crash', () => {
    expect(classifyTier(null, true)).toBe('addon');
  });
  test('custom thresholds win over the defaults', () => {
    expect(classifyTier(0.5, true, { firstLineMinPenetration: 0.5, secondLineMinPenetration: 0.1 })).toBe('primera');
    expect(DEFAULT_TIER_THRESHOLDS).toEqual({ firstLineMinPenetration: 0.7, secondLineMinPenetration: 0.3 });
  });
});
```

`__tests__/unit/dwh/seller-coverage.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import { buildSellerCoverageRows, computeGapVsBaseline, pickTieredLines } from '../../../lib/dwh/seller-coverage';

describe('computeGapVsBaseline', () => {
  test('difference, or null when either side is unknown', () => {
    expect(computeGapVsBaseline(0.5, 0.75)).toBeCloseTo(-0.25, 10);
    expect(computeGapVsBaseline(null, 0.5)).toBeNull();
    expect(computeGapVsBaseline(0.5, null)).toBeNull();
  });
});

describe('pickTieredLines', () => {
  const stats = [
    { line: 'Panaderia', entitiesBuying: 8, salesGrossBs: 100 },   // 0.8 primera
    { line: 'Pizza', entitiesBuying: 4, salesGrossBs: 50 },        // 0.4 segunda
    { line: 'Pasteleria', entitiesBuying: 1, salesGrossBs: 10 },   // 0.1 addon
    { line: 'Navidad', entitiesBuying: 0, salesGrossBs: 0 },       // sin ventas
  ];
  test('keeps primera and segunda lines; baseline is their mean penetration', () => {
    const r = pickTieredLines(stats, 10);
    expect(r.tieredLineNames).toEqual(['Panaderia', 'Pizza']);
    expect(r.baselinePenetration).toBeCloseTo(0.6, 10);
  });
  test('no active entities: nothing is tiered and the baseline is null', () => {
    expect(pickTieredLines(stats, 0)).toEqual({ tieredLineNames: [], baselinePenetration: null });
  });
});

describe('buildSellerCoverageRows', () => {
  const sellers = [
    { salesRepKey: '1', salesRepName: 'Ana', entitiesServed: 4, tieredLinesCovered: 6 },   // 6/(4*2)=0.75
    { salesRepKey: '2', salesRepName: 'Beto', entitiesServed: 4, tieredLinesCovered: 2 },  // 0.25
    { salesRepKey: '3', salesRepName: 'Cris', entitiesServed: 0, tieredLinesCovered: 0 },  // dropped
  ];
  test('own penetration, gap vs baseline, worst gap first, empty sellers dropped', () => {
    const rows = buildSellerCoverageRows(sellers, 2, 0.6);
    expect(rows.map(r => r.salesRepName)).toEqual(['Beto', 'Ana']);
    expect(rows[0].ownPenetration).toBeCloseTo(0.25, 10);
    expect(rows[0].gapVsBaseline).toBeCloseTo(-0.35, 10);
    expect(rows[1].gapVsBaseline).toBeCloseTo(0.15, 10);
    expect(rows[0].baselinePenetration).toBe(0.6);
  });
  test('zero tiered lines gives no rows instead of dividing by zero', () => {
    expect(buildSellerCoverageRows(sellers, 0, null)).toEqual([]);
  });
});
```

`scripts/dwh/__tests__/consolidation-queries.test.ts` (disposable DWH; the seed is shared by later tasks, only the seller-coverage test is written now):
```ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';
import { fetchSellerCoverage } from '../../../lib/dwh/seller-coverage';
import { buildDateWhereClause } from '../../../app/api/dwh/lib/query-builder';

process.env.DW_NAME = `DWH_AlimentosNY_Test_consolidation_${Date.now()}`;

function testConfig(database: string): sql.config {
  return {
    server: process.env.DW_SERVER ?? process.env.DB_SERVER!,
    port: parseInt(process.env.DW_PORT ?? process.env.DB_PORT ?? '1433'),
    database,
    user: process.env.DW_USER ?? process.env.DB_USER!,
    password: process.env.DW_PASSWORD ?? process.env.DB_PASSWORD!,
    options: {
      encrypt: (process.env.DW_ENCRYPT ?? process.env.DB_ENCRYPT) === 'true',
      trustServerCertificate: (process.env.DW_TRUST_SERVER_CERT ?? process.env.DB_TRUST_SERVER_CERT) !== 'false',
    },
  };
}

// Synthetic warehouse (Oct 2026 unless noted). Legal entities: LE1 'Cadena Uno' (C1, C2), LE2 (C3), LE3 (C4).
//   C1  S1 Abasto      route 3  seller V1  registered 2026-03-28 (migration batch)  SEMANAL
//   C2  S1 Abasto      route 3  seller V1  registered 2026-05-10                     no frequency
//       (C2 has an OLD version in S2 / route 4 that I3 points at)
//   C3  S2 Restaurante route 4  seller V2  registered 2020-01-01                     MENSUAL
//   C4  no group, no zone, seller V2, registered NULL, no frequency
//   C5  S1 Abasto      route 3  seller V1  registered 2026-06-01  (never invoiced)
// Products: P1 Panaderia/Artesanal/Fresco, P2 Panaderia/Industrial/Congelado, P3 Pizza/Industrial/Congelado.
// Invoices: I1 C1 P1 1000 (10-05, V1) | I2 C1 P2 500 (10-05, V1) | I3 C2old P1 2000 (10-06, V1) |
//           I4 C3 P3 700 (09-20, V2) | I5 C4 P1 300 (10-07, V2) | I7 C3 P1 400 (10-08, V2) | I6 C1 P1 9999 VOIDED (10-07).
async function seed(pool: sql.ConnectionPool) {
  await pool.request().batch(`
    ALTER TABLE fact.Fact_Sales NOCHECK CONSTRAINT ALL;
    INSERT INTO dim.Dim_Currency (CurrencyCode, CurrencyName, IsBaseCurrency) VALUES ('USD', 'Dolar', 0), ('BSD', 'Bolivar', 1);
    DECLARE @usd int = (SELECT CurrencyKey FROM dim.Dim_Currency WHERE RTRIM(CurrencyCode) = 'USD');
    INSERT INTO fact.Fact_ExchangeRate (DateKey, CurrencyKey, RateBuy, RateSell)
      VALUES (20260920, @usd, 50, 50), (20261005, @usd, 50, 50), (20261006, @usd, 50, 50), (20261007, @usd, 50, 50), (20261008, @usd, 50, 50);
    INSERT INTO dim.Dim_SalesRep (SalesRepCode, SalesRepName, IsSalesperson, IsCollector, IsInactive)
      VALUES ('V1', 'Ana', 1, 0, 0), ('V2', 'Beto', 1, 0, 0);
    DECLARE @v1 int = (SELECT SalesRepKey FROM dim.Dim_SalesRep WHERE RTRIM(SalesRepCode) = 'V1');
    DECLARE @v2 int = (SELECT SalesRepKey FROM dim.Dim_SalesRep WHERE RTRIM(SalesRepCode) = 'V2');
    INSERT INTO dim.Dim_Zone (ZoneCode, ZoneName, IsRoute, RouteNumber) VALUES ('CCS003', 'Ruta 3', 1, 3), ('CCS004', 'Ruta 4', 1, 4);
    INSERT INTO dim.Dim_Segment (ErpSegmentCode, SegmentName) VALUES ('S1', 'Abasto'), ('S2', 'Restaurante');
    INSERT INTO dim.Dim_LegalEntity (RootCustomerCode, LegalEntityName, StoreCount)
      VALUES ('C1', 'Cadena Uno', 2), ('C3', 'Indep Dos', 1), ('C4', 'Indep Tres', 1);
    DECLARE @le1 int = (SELECT LegalEntityKey FROM dim.Dim_LegalEntity WHERE RTRIM(RootCustomerCode) = 'C1');
    DECLARE @le2 int = (SELECT LegalEntityKey FROM dim.Dim_LegalEntity WHERE RTRIM(RootCustomerCode) = 'C3');
    DECLARE @le3 int = (SELECT LegalEntityKey FROM dim.Dim_LegalEntity WHERE RTRIM(RootCustomerCode) = 'C4');
    INSERT INTO dim.Dim_Product (ProductCode, ProductName, LineCode, LineName, SubLineCode, SubLineName, CategoryCode, CategoryName, IsInactive, ValidFrom, IsCurrent)
      VALUES ('P1', 'Pan Baguette', 'L1', 'Panaderia', 'SL1', 'Artesanal', 'K1', 'Fresco', 0, '2020-01-01', 1),
             ('P2', 'Pan Molde', 'L1', 'Panaderia', 'SL2', 'Industrial', 'K2', 'Congelado', 0, '2020-01-01', 1),
             ('P3', 'Pizza Familiar', 'L2', 'Pizza', 'SL2', 'Industrial', 'K2', 'Congelado', 0, '2020-01-01', 1);
    INSERT INTO dim.Dim_Customer (CustomerCode, CustomerName, IsSpecialTaxpayer, IsLegalEntity, IsInactive, ValidFrom, ValidTo, IsCurrent,
                                  ZoneCode, ErpSegmentCode, DefaultSalesRepCode, LegalEntityKey, RegisteredDate, IsMigrationBatch, VisitFrequency)
      VALUES ('C1', 'Cliente Uno',  0, 0, 0, '2020-01-01', NULL,         1, 'CCS003', 'S1', 'V1', @le1, '2026-03-28', 1, 'SEMANAL'),
             ('C2', 'Cliente Dos',  0, 0, 0, '2020-01-01', '2026-09-01', 0, 'CCS004', 'S2', 'V2', @le1, '2026-05-10', 0, NULL),
             ('C2', 'Cliente Dos',  0, 0, 0, '2026-09-01', NULL,         1, 'CCS003', 'S1', 'V1', @le1, '2026-05-10', 0, NULL),
             ('C3', 'Cliente Tres', 0, 0, 0, '2020-01-01', NULL,         1, 'CCS004', 'S2', 'V2', @le2, '2020-01-01', 0, 'MENSUAL'),
             ('C4', 'Cliente Cuatro', 0, 0, 0, '2020-01-01', NULL,       1, NULL,     NULL, 'V2', @le3, NULL,         0, NULL),
             ('C5', 'Cliente Cinco', 0, 0, 0, '2020-01-01', NULL,        1, 'CCS003', 'S1', 'V1', NULL, '2026-06-01', 0, NULL);
    DECLARE @c1 int = (SELECT CustomerKey FROM dim.Dim_Customer WHERE CustomerCode = 'C1');
    DECLARE @c2old int = (SELECT CustomerKey FROM dim.Dim_Customer WHERE CustomerCode = 'C2' AND IsCurrent = 0);
    DECLARE @c3 int = (SELECT CustomerKey FROM dim.Dim_Customer WHERE CustomerCode = 'C3');
    DECLARE @c4 int = (SELECT CustomerKey FROM dim.Dim_Customer WHERE CustomerCode = 'C4');
    DECLARE @p1 int = (SELECT ProductKey FROM dim.Dim_Product WHERE ProductCode = 'P1');
    DECLARE @p2 int = (SELECT ProductKey FROM dim.Dim_Product WHERE ProductCode = 'P2');
    DECLARE @p3 int = (SELECT ProductKey FROM dim.Dim_Product WHERE ProductCode = 'P3');
    INSERT INTO fact.Fact_Sales (DateKey, CustomerKey, ProductKey, SalesRepKey, DocumentTypeKey, InvoiceNumber, LineNumber,
        QuantitySold, GrossAmount, DiscountAmount, TaxAmount, NetAmount, CostSourceFlag, IsVoided)
      VALUES (20261005, @c1,    @p1, @v1, 1, 'I1', 1, 10, 1000, 0, 0, 1000, 'NO_COST_DATA', 0),
             (20261005, @c1,    @p2, @v1, 1, 'I2', 1,  5,  500, 0, 0,  500, 'NO_COST_DATA', 0),
             (20261006, @c2old, @p1, @v1, 1, 'I3', 1, 20, 2000, 0, 0, 2000, 'NO_COST_DATA', 0),
             (20260920, @c3,    @p3, @v2, 1, 'I4', 1,  7,  700, 0, 0,  700, 'NO_COST_DATA', 0),
             (20261007, @c4,    @p1, @v2, 1, 'I5', 1,  3,  300, 0, 0,  300, 'NO_COST_DATA', 0),
             (20261008, @c3,    @p1, @v2, 1, 'I7', 1,  4,  400, 0, 0,  400, 'NO_COST_DATA', 0),
             (20261007, @c1,    @p1, @v1, 1, 'I6', 1, 99, 9999, 0, 0, 9999, 'NO_COST_DATA', 1);
  `);
}

describe('consolidation queries (disposable DWH)', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    await seed(pool);
  }, 90_000);

  afterAll(async () => {
    try { await pool.close(); } finally {
      const master = await new sql.ConnectionPool(testConfig('master')).connect();
      try {
        await master.request().query(`
          ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
          DROP DATABASE [${dwhDatabaseName()}];`);
      } finally { await master.close(); }
    }
  });

  test('fetchSellerCoverage: pooled penetration, no dependency on CADENA/INDEPENDIENTES, worst gap first', async () => {
    // Window Sep-Oct: entities with sales = LE1, LE2, LE3 (3). Panaderia bought by LE1, LE2 (I7), LE3 = 3/3 = primera;
    // Pizza by LE2 only = 1/3 = segunda; baseline = (1 + 1/3) / 2. No Dim_Customer.SegmentCode is set anywhere.
    const rows = await fetchSellerCoverage(pool, buildDateWhereClause('custom:2026-09-01:2026-10-31', 'fs'));
    expect(rows.map(r => r.salesRepName)).toEqual(['Ana', 'Beto']);
    const [ana, beto] = rows;
    expect(ana.entitiesServed).toBe(1);                       // LE1 only
    expect(ana.ownPenetration).toBeCloseTo(0.5, 6);           // (LE1|Panaderia) / (1 entity x 2 tiered lines)
    expect(beto.entitiesServed).toBe(2);                      // LE2, LE3
    expect(beto.ownPenetration).toBeCloseTo(0.75, 6);         // (LE2|Pizza, LE2|Panaderia, LE3|Panaderia) / (2 x 2)
    expect(beto.baselinePenetration).toBeCloseTo((1 + 1 / 3) / 2, 6);
    expect(ana.gapVsBaseline).toBeLessThan(beto.gapVsBaseline!);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/dwh/depth-tier.test.ts __tests__/unit/dwh/seller-coverage.test.ts`
Expected: FAIL (modules not found).
Run: `bun test --isolate --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/consolidation-queries.test.ts`
Expected: FAIL (module `lib/dwh/seller-coverage` not found). Needs the local SQL Server from `.env.local`; the test creates and drops its own database.

- [ ] **Step 3: Implement**

`lib/dwh/depth-tier.ts`:
```ts
// Line-depth tiers (moved from app/api/dwh/profundidad-linea/tier.ts so it survives that route).
export type DepthTier = 'primera' | 'segunda' | 'addon' | 'sin-ventas';

export interface TierThresholds {
  firstLineMinPenetration: number;
  secondLineMinPenetration: number;
}

export const DEFAULT_TIER_THRESHOLDS: TierThresholds = {
  firstLineMinPenetration: 0.7,
  secondLineMinPenetration: 0.3,
};

export function classifyTier(
  penetration: number | null,
  hasAnySales: boolean,
  thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS,
): DepthTier {
  if (!hasAnySales) return 'sin-ventas';
  const p = penetration ?? 0;
  if (p >= thresholds.firstLineMinPenetration) return 'primera';
  if (p >= thresholds.secondLineMinPenetration) return 'segunda';
  return 'addon';
}
```

`lib/dwh/seller-coverage.ts`:
```ts
import sql from 'mssql';
import type { SellerCoverageRow } from '@/app/(app)/analitica/types';
import { classifyTier, DEFAULT_TIER_THRESHOLDS, type TierThresholds } from './depth-tier';

// Seller line-depth coverage, used by Vendedor 360 (app/api/dwh/vendedor-360/route.ts). Moved out of
// app/api/dwh/profundidad-linea/route.ts (handleLeaderboard) when that tab was removed. Penetration is pooled
// over ALL active legal entities: the old CADENA/INDEPENDIENTES split (Dim_Customer.SegmentCode) is gone
// because customer groups replace those values.
const NO_LINEA = 'Sin línea';

export function computeGapVsBaseline(own: number | null, baseline: number | null): number | null {
  if (own === null || baseline === null) return null;
  return own - baseline;
}

export interface LineStat { line: string; entitiesBuying: number; salesGrossBs: number }

export function pickTieredLines(
  stats: readonly LineStat[],
  totalEntitiesActive: number,
  thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS,
): { tieredLineNames: string[]; baselinePenetration: number | null } {
  const tieredLineNames: string[] = [];
  let sum = 0;
  let n = 0;
  for (const s of stats) {
    const penetration = totalEntitiesActive > 0 ? s.entitiesBuying / totalEntitiesActive : null;
    const tier = classifyTier(penetration, s.salesGrossBs > 0, thresholds);
    if (tier === 'primera' || tier === 'segunda') {
      tieredLineNames.push(s.line);
      if (penetration !== null) { sum += penetration; n += 1; }
    }
  }
  return { tieredLineNames, baselinePenetration: n > 0 ? sum / n : null };
}

export interface SellerLineCounts {
  salesRepKey: string;
  salesRepName: string;
  entitiesServed: number;
  tieredLinesCovered: number;
}

export function buildSellerCoverageRows(
  sellers: readonly SellerLineCounts[],
  tieredLineCount: number,
  baselinePenetration: number | null,
): SellerCoverageRow[] {
  if (tieredLineCount <= 0) return [];
  return sellers
    .filter(s => s.entitiesServed > 0)
    .map(s => {
      const ownPenetration = s.tieredLinesCovered / (s.entitiesServed * tieredLineCount);
      return {
        salesRepKey: s.salesRepKey,
        salesRepName: s.salesRepName,
        entitiesServed: s.entitiesServed,
        ownPenetration,
        baselinePenetration,
        gapVsBaseline: computeGapVsBaseline(ownPenetration, baselinePenetration),
      };
    })
    .sort((a, b) => (a.gapVsBaseline ?? 0) - (b.gapVsBaseline ?? 0));
}

const LINES_QUERY = (dateWhere: string) => `
  SELECT ISNULL(p.LineName, '${NO_LINEA}') AS Line,
         COUNT(DISTINCT c.LegalEntityKey) AS EntitiesBuying,
         SUM(fs.NetAmount) AS SalesGrossBs
  FROM fact.Fact_Sales fs
  JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
  JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
  WHERE fs.IsVoided = 0 ${dateWhere}
  GROUP BY ISNULL(p.LineName, '${NO_LINEA}')
`;

const ACTIVE_ENTITIES_QUERY = (dateWhere: string) => `
  SELECT COUNT(DISTINCT c.LegalEntityKey) AS TotalEntities
  FROM fact.Fact_Sales fs
  JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
  WHERE fs.IsVoided = 0 ${dateWhere}
`;

function sellerQuery(dateWhere: string, lineCount: number): string {
  const placeholders = Array.from({ length: lineCount }, (_, i) => `@tieredLine${i}`).join(', ');
  return `
    SELECT CAST(fs.SalesRepKey AS varchar(20)) AS SalesRepKey,
           ISNULL(r.SalesRepName, r.SalesRepCode) AS SalesRepName,
           COUNT(DISTINCT c.LegalEntityKey) AS EntitiesServed,
           COUNT(DISTINCT CONCAT(c.LegalEntityKey, '|', ISNULL(p.LineName, '${NO_LINEA}'))) AS TieredLinesCovered
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fs.SalesRepKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 AND ISNULL(p.LineName, '${NO_LINEA}') IN (${placeholders}) ${dateWhere}
    GROUP BY fs.SalesRepKey, ISNULL(r.SalesRepName, r.SalesRepCode)
  `;
}

// dateWhere comes from buildDateWhereClause(range, 'fs'). Tiered line names are bound with .input().
export async function fetchSellerCoverage(
  pool: sql.ConnectionPool,
  dateWhere: string,
  thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS,
): Promise<SellerCoverageRow[]> {
  const [linesResult, totalResult] = await Promise.all([
    pool.request().query(LINES_QUERY(dateWhere)),
    pool.request().query(ACTIVE_ENTITIES_QUERY(dateWhere)),
  ]);
  const totalEntities = Number(totalResult.recordset[0]?.TotalEntities ?? 0);
  const stats: LineStat[] = linesResult.recordset.map(r => ({
    line: String(r.Line),
    entitiesBuying: Number(r.EntitiesBuying),
    salesGrossBs: Number(r.SalesGrossBs ?? 0),
  }));
  const { tieredLineNames, baselinePenetration } = pickTieredLines(stats, totalEntities, thresholds);
  if (tieredLineNames.length === 0) return [];

  const req = pool.request();
  tieredLineNames.forEach((name, i) => req.input(`tieredLine${i}`, name));
  const sellerResult = await req.query(sellerQuery(dateWhere, tieredLineNames.length));
  const sellers: SellerLineCounts[] = sellerResult.recordset.map(r => ({
    salesRepKey: String(r.SalesRepKey),
    salesRepName: String(r.SalesRepName),
    entitiesServed: Number(r.EntitiesServed),
    tieredLinesCovered: Number(r.TieredLinesCovered),
  }));
  return buildSellerCoverageRows(sellers, tieredLineNames.length, baselinePenetration);
}
```

Edit `app/api/dwh/vendedor-360/route.ts`: delete line 12 (`import { GET as getProfundidadLinea } from '@/app/api/dwh/profundidad-linea/route';`) and replace the whole `let coverage ... catch { coverage = null; }` block (from `let coverage: Seller360Response['profundidad']['coverage'] = null;` through its closing `}` before `const response: Seller360Response`, plus the preceding explanatory comment about `handleLeaderboard` not being exported) with:
```ts
    // Coverage is supplementary context on this profile: a failed read must not fail the whole response.
    let coverage: Seller360Response['profundidad']['coverage'] = null;
    try {
      const rows = await fetchSellerCoverage(pool, buildDateWhereClause(dateRange, 'fs'));
      coverage = rows.find(r => r.salesRepKey === salesRepKeyParam) ?? null;
    } catch {
      coverage = null;
    }
```
Add `import { fetchSellerCoverage } from '@/lib/dwh/seller-coverage';` and make sure `buildDateWhereClause` is in the existing `@/app/api/dwh/lib/query-builder` import list (add it if absent). Keep `NextRequest` imported if the `GET` signature still uses it.

- [ ] **Step 4: Run to verify they pass**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/dwh/depth-tier.test.ts __tests__/unit/dwh/seller-coverage.test.ts app/api/dwh/vendedor-360`
Expected: PASS (vendedor-360's existing tests are 401 smoke + a live-DWH block that skips itself when data is missing).
Run: `bun test --isolate --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/consolidation-queries.test.ts`
Expected: PASS. If a seed `INSERT` fails with "Cannot insert NULL into column X", plan A's migration `0040` or an older migration added a NOT NULL column: add X to the insert (never change the code under test to suit the seed). If `Dim_Currency`/`Fact_ExchangeRate` rows already exist from a migration, drop that line.
Run: `bunx tsc --noEmit`
Expected: no errors (`profundidad-linea/route.ts` still compiles; it keeps its own `./tier` and `./seller-coverage` until Task 13).

- [ ] **Step 5: Commit**

```bash
git add lib/dwh/depth-tier.ts lib/dwh/seller-coverage.ts app/api/dwh/vendedor-360/route.ts scripts/dwh/__tests__/consolidation-queries.test.ts __tests__/unit/dwh/depth-tier.test.ts __tests__/unit/dwh/seller-coverage.test.ts
git commit -m "refactor(analitica): move tier + seller coverage to lib/dwh, decouple Vendedor 360 from profundidad route" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Tab registry module with fallback to the default tab

**Files:**
- Create: `app/(app)/analitica/lib/tab-keys.ts`
- Modify: `app/(app)/analitica/analitica-client.tsx` (imports, `TABS` array lines ~10-52, `activeTab` at ~line 130)
- Test: `app/(app)/analitica/lib/__tests__/tab-keys.test.ts`

**Interfaces:**
- Consumes: the current `TABS` order in `analitica-client.tsx` (read it first; plan B added `seguimiento` right after `resumen`).
- Produces:
```ts
// app/(app)/analitica/lib/tab-keys.ts
export const TAB_KEYS: readonly [...];                        // as const tuple, display order
export type TabKey = (typeof TAB_KEYS)[number];
export const DEFAULT_TAB: TabKey;                              // 'resumen'
export const TAB_LABELS: Record<TabKey, string>;
export function resolveActiveTab(param: string | null | undefined): TabKey;   // unknown/retired/empty -> DEFAULT_TAB
```
`analitica-client.tsx` builds `TABS` from `TAB_KEYS` + a `TAB_COMPONENTS: Record<TabKey, ComponentType<TabComponentProps>>` map, so `tsc` fails if a key has no component or a component has no key. Behavior is unchanged in this task.

- [ ] **Step 1: Write the failing test**

`app/(app)/analitica/lib/__tests__/tab-keys.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import { DEFAULT_TAB, TAB_KEYS, TAB_LABELS, resolveActiveTab } from '../tab-keys';

describe('tab registry', () => {
  test('resumen is the default and the first tab', () => {
    expect(DEFAULT_TAB).toBe('resumen');
    expect(TAB_KEYS[0]).toBe('resumen');
  });
  test('every key has a non-empty label and keys are unique', () => {
    expect(new Set(TAB_KEYS).size).toBe(TAB_KEYS.length);
    for (const k of TAB_KEYS) expect(TAB_LABELS[k].trim().length).toBeGreaterThan(0);
  });
  test('a known tab resolves to itself', () => {
    for (const k of TAB_KEYS) expect(resolveActiveTab(k)).toBe(k);
  });
  test('unknown, empty and missing values fall back to the default tab', () => {
    expect(resolveActiveTab('no-existe')).toBe(DEFAULT_TAB);
    expect(resolveActiveTab('')).toBe(DEFAULT_TAB);
    expect(resolveActiveTab(null)).toBe(DEFAULT_TAB);
    expect(resolveActiveTab(undefined)).toBe(DEFAULT_TAB);
  });
  test('lookup is exact: a prototype key or different case does not resolve', () => {
    expect(resolveActiveTab('constructor')).toBe(DEFAULT_TAB);
    expect(resolveActiveTab('Resumen')).toBe(DEFAULT_TAB);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `bun test --isolate --env-file=.env.local "app/(app)/analitica/lib/__tests__/tab-keys.test.ts"`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`app/(app)/analitica/lib/tab-keys.ts` (the key list below is plan B's order; if the current `TABS` array differs, mirror the actual order and labels):
```ts
// Single source of truth for the Analítica tab list. analitica-client.tsx maps each key to its component
// (Record<TabKey, ...>, so the compiler enforces the two stay in sync). Retired tabs are simply absent:
// any old ?tab= value resolves to the default tab.
export const TAB_KEYS = [
  'resumen',
  'seguimiento',
  'ventas',
  'devoluciones',
  'cxc',
  'vendedores',
  'clientes',
  'productos',
  'profundidad',
  'matriz-vendedor',
  'cadencia',
  'historico',
  'finanzas',
  'multimoneda',
  'compras',
] as const;

export type TabKey = (typeof TAB_KEYS)[number];

export const DEFAULT_TAB: TabKey = 'resumen';

export const TAB_LABELS: Record<TabKey, string> = {
  resumen: 'Resumen',
  seguimiento: 'Seguimiento',
  ventas: 'Ventas',
  devoluciones: 'Devoluciones',
  cxc: 'CXC y Cobranzas',
  vendedores: 'Vendedores',
  clientes: 'Clientes',
  productos: 'Productos',
  profundidad: 'Profundidad de Línea',
  'matriz-vendedor': 'Matriz Vendedor-Producto',
  cadencia: 'Cadencia',
  historico: 'Histórico 2025',
  finanzas: 'Finanzas',
  multimoneda: 'Multimoneda',
  compras: 'Compras',
};

const KEY_SET: ReadonlySet<string> = new Set(TAB_KEYS);

export function resolveActiveTab(param: string | null | undefined): TabKey {
  return param && KEY_SET.has(param) ? (param as TabKey) : DEFAULT_TAB;
}
```

In `analitica-client.tsx`: add `import { DEFAULT_TAB, TAB_KEYS, TAB_LABELS, resolveActiveTab, type TabKey } from './lib/tab-keys';`, delete the local `const DEFAULT_TAB = 'resumen';`, and replace the `const TABS: TabDef[] = [ ... ];` literal with:
```tsx
const TAB_COMPONENTS: Record<TabKey, ComponentType<TabComponentProps>> = {
  resumen: TabResumen,
  seguimiento: TabSeguimiento,
  ventas: TabVentas,
  devoluciones: TabDevoluciones,
  cxc: TabCxc,
  vendedores: TabVendedores,
  clientes: TabClientes,
  productos: TabProductos,
  profundidad: TabProfundidad,
  'matriz-vendedor': TabMatrizVendedor,
  cadencia: TabCadencia,
  historico: TabHistorico,
  finanzas: TabFinanzas,
  multimoneda: TabMultimoneda,
  compras: TabCompras,
};

const TABS: TabDef[] = TAB_KEYS.map(key => ({ key, label: TAB_LABELS[key], component: TAB_COMPONENTS[key] }));
```
(Keep the existing `TabSeguimiento` import added by plan B.) Replace
`const activeTab = TABS.some(t => t.key === tabParam) ? tabParam! : DEFAULT_TAB;` with `const activeTab: string = resolveActiveTab(tabParam);`.

- [ ] **Step 4: Run to verify it passes**

Run: `bun test --isolate --env-file=.env.local "app/(app)/analitica/lib/__tests__/tab-keys.test.ts"` -> PASS.
Run: `bunx tsc --noEmit` -> no errors. Run: `bun run lint` -> clean.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/analitica/lib/tab-keys.ts" "app/(app)/analitica/lib/__tests__/tab-keys.test.ts" "app/(app)/analitica/analitica-client.tsx"
git commit -m "refactor(analitica): tab registry module with default-tab fallback" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---
## Task 3: Pure cartera helpers, row types and filter extension (Clientes)

**Files:**
- Create: `app/(app)/analitica/lib/cartera.ts`
- Modify: `app/(app)/analitica/types.ts` (`CoberturaRowView`, `CoberturaResponse`, new `ClientesFiltersResponse`), `app/(app)/analitica/lib/cobertura.ts` (`filterCobertura`, `coberturaExportQuery`)
- Test: `app/(app)/analitica/lib/__tests__/cartera.test.ts`, extend `app/(app)/analitica/lib/__tests__/cobertura.test.ts`

**Interfaces:**
- Consumes: `visitCompliance`, `summarizeCompliance`, `VisitCompliance`, `ComplianceSummary` from `@/lib/seguimiento/visit-compliance` (plan B); `customerKindInYear`, `CustomerKind` from `@/lib/dwh/cutover` (plan A).
- Produces:
```ts
// lib/cartera.ts
export function dateKeyToIso(key: number): string;                                  // 20261014 -> '2026-10-14'
export function enrichCartera(input: { lastSaleDateKey: number | null; visitIntervalDays: number | null; registeredDate: string | null; todayKey: number; kindYear: number }): { visit: VisitCompliance; kind: CustomerKind | null };
export const KIND_LABEL: Record<CustomerKind, string>;                              // Patrimonio / Nuevo / Posterior
export function visitLabel(v: VisitCompliance): string;                             // plain text for XLSX/print
export interface CarteraSummary { compliance: ComplianceSummary; inactiveInPeriod: number; nuevos: number; patrimonio: number }
export function summarizeCartera(rows: readonly { visit: VisitCompliance; kind: CustomerKind | null; activeInPeriod: boolean }[]): CarteraSummary;
// types.ts  (CoberturaRowView gains)
//   routeNumber: number | null; groupCode: string | null; groupName: string | null;
//   kind: CustomerKind | null; visit: VisitCompliance; activeInPeriod: boolean
// types.ts  (CoberturaResponse gains)  kindYear: number
export interface ClientesFiltersResponse { groups: { value: string; label: string }[]; routes: { value: string; label: string }[] }
// lib/cobertura.ts
export interface CoberturaFilter { sellerCode?: string | null; status?: CoberturaStatus | null; grupo?: string | null; ruta?: number | null; visit?: 'overdue' | 'no_interval' | null; inactiveInPeriod?: boolean }
export function filterCobertura<T extends FilterableRow>(rows: T[], f: CoberturaFilter): T[];
export function coberturaExportQuery(f: { includeInactive: boolean; sellerCode: string | null; status: CoberturaStatus | null; dateRange?: string; grupo?: string | null; ruta?: number | null; visit?: 'overdue' | 'no_interval' | null; inactiveInPeriod?: boolean }): string;
```
Rules: `kind` is `null` when `registeredDate` is null or not `YYYY-MM-DD` (never throws); `enrichCartera` passes `VisitIntervalDays` NULL straight into `visitCompliance` (-> `no_interval`, never overdue). `summarizeCartera.nuevos` counts `kind === 'nuevo'`, `patrimonio` counts `kind === 'patrimonio'`, `inactiveInPeriod` counts `activeInPeriod === false`, `compliance` is `summarizeCompliance(rows.map(r => r.visit))`. `filterCobertura` new filters: `grupo` matches `groupCode` exactly, `ruta` matches `routeNumber`, `visit` matches `visit.status`, `inactiveInPeriod: true` keeps rows whose `activeInPeriod === false`; existing seller/status behavior unchanged. `coberturaExportQuery` output for the old arguments is byte-identical; new params are appended only when set (`dateRange`, `grupo`, `ruta`, `visit`, `inactive=1`).

- [ ] **Step 1: Write the failing tests**

`app/(app)/analitica/lib/__tests__/cartera.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import { KIND_LABEL, dateKeyToIso, enrichCartera, summarizeCartera, visitLabel } from '../cartera';

const base = { visitIntervalDays: 7, registeredDate: '2025-01-10', todayKey: 20261014, kindYear: 2026 };

describe('dateKeyToIso', () => {
  test('formats a YYYYMMDD key', () => expect(dateKeyToIso(20261014)).toBe('2026-10-14'));
});

describe('enrichCartera', () => {
  test('overdue when days since last sale exceed the interval', () => {
    const { visit } = enrichCartera({ ...base, lastSaleDateKey: 20261001 });
    expect(visit).toMatchObject({ status: 'overdue', daysSinceLastInvoice: 13, intervalDays: 7, daysOverdue: 6 });
  });
  test('a NULL frequency is never overdue, however old the last sale', () => {
    const { visit } = enrichCartera({ ...base, visitIntervalDays: null, lastSaleDateKey: 20200101 });
    expect(visit.status).toBe('no_interval');
    expect(visit.daysOverdue).toBeNull();
  });
  test('a frequency but no invoice is no_invoice', () => {
    expect(enrichCartera({ ...base, lastSaleDateKey: null }).visit.status).toBe('no_invoice');
  });
  test('kind: registered before the year or in the cutover batch is patrimonio; later in the year is nuevo', () => {
    expect(enrichCartera({ ...base, lastSaleDateKey: null, registeredDate: '2025-12-31' }).kind).toBe('patrimonio');
    expect(enrichCartera({ ...base, lastSaleDateKey: null, registeredDate: '2026-03-28' }).kind).toBe('patrimonio');
    expect(enrichCartera({ ...base, lastSaleDateKey: null, registeredDate: '2026-04-01' }).kind).toBe('nuevo');
  });
  test('kind is null for a missing or malformed date, never a throw', () => {
    expect(enrichCartera({ ...base, lastSaleDateKey: null, registeredDate: null }).kind).toBeNull();
    expect(enrichCartera({ ...base, lastSaleDateKey: null, registeredDate: '28/03/2026' }).kind).toBeNull();
  });
});

describe('visitLabel / KIND_LABEL', () => {
  test('labels', () => {
    expect(visitLabel(enrichCartera({ ...base, visitIntervalDays: null, lastSaleDateKey: 20261001 }).visit)).toBe('Sin frecuencia');
    expect(visitLabel(enrichCartera({ ...base, lastSaleDateKey: null }).visit)).toBe('Sin facturas');
    expect(visitLabel(enrichCartera({ ...base, lastSaleDateKey: 20261001 }).visit)).toBe('Vencida +6 d');
    expect(visitLabel(enrichCartera({ ...base, lastSaleDateKey: 20261012 }).visit)).toBe('Al día (2 de 7 d)');
    expect(KIND_LABEL.patrimonio).toBe('Patrimonio');
    expect(KIND_LABEL.nuevo).toBe('Nuevo');
  });
});

describe('summarizeCartera', () => {
  const row = (lastSaleDateKey: number | null, visitIntervalDays: number | null, kind: 'nuevo' | 'patrimonio' | null, activeInPeriod: boolean) =>
    ({ visit: enrichCartera({ ...base, lastSaleDateKey, visitIntervalDays }).visit, kind, activeInPeriod });
  test('counts compliance, inactive in period and kinds', () => {
    const s = summarizeCartera([
      row(20261001, 7, 'patrimonio', true),   // overdue
      row(20261012, 7, 'nuevo', true),        // ok
      row(20261012, null, 'nuevo', false),    // no interval
      row(null, 7, null, false),              // no invoice
    ]);
    expect(s.compliance).toMatchObject({ total: 4, ok: 1, overdue: 1, noInterval: 1, noInvoice: 1, complianceRate: 0.5 });
    expect(s.inactiveInPeriod).toBe(2);
    expect(s.nuevos).toBe(2);
    expect(s.patrimonio).toBe(1);
  });
  test('nobody has a frequency yet: rate is null and nobody is overdue', () => {
    const s = summarizeCartera([row(20200101, null, 'patrimonio', true), row(null, null, null, false)]);
    expect(s.compliance.overdue).toBe(0);
    expect(s.compliance.complianceRate).toBeNull();
  });
  test('empty list', () => {
    expect(summarizeCartera([])).toMatchObject({ inactiveInPeriod: 0, nuevos: 0, patrimonio: 0 });
  });
});
```

Append to `app/(app)/analitica/lib/__tests__/cobertura.test.ts`:
```ts
describe('filterCobertura: grupo / ruta / visit / inactive in period', () => {
  const r = (over: Record<string, unknown>) => ({
    sellerCode: 'V1', status: 'active' as const, groupCode: 'S1', routeNumber: 3,
    visit: { status: 'ok' }, activeInPeriod: true, ...over,
  });
  const rows = [
    r({ id: 1 }),
    r({ id: 2, groupCode: 'S2', routeNumber: 4, visit: { status: 'overdue' } }),
    r({ id: 3, groupCode: null, routeNumber: null, visit: { status: 'no_interval' }, activeInPeriod: false }),
  ];
  const ids = (out: { id?: unknown }[]) => out.map(x => x.id);
  test('grupo and ruta match the current attributes exactly', () => {
    expect(ids(filterCobertura(rows, { grupo: 'S2' }))).toEqual([2]);
    expect(ids(filterCobertura(rows, { ruta: 3 }))).toEqual([1]);
    expect(ids(filterCobertura(rows, { grupo: 'S1', ruta: 4 }))).toEqual([]);
  });
  test('visit filter and inactive-in-period filter', () => {
    expect(ids(filterCobertura(rows, { visit: 'overdue' }))).toEqual([2]);
    expect(ids(filterCobertura(rows, { visit: 'no_interval' }))).toEqual([3]);
    expect(ids(filterCobertura(rows, { inactiveInPeriod: true }))).toEqual([3]);
  });
  test('no filters keeps everything; old-shape rows (no new fields) still filter by seller', () => {
    expect(filterCobertura(rows, {})).toHaveLength(3);
    expect(filterCobertura([{ sellerCode: 'V9', status: 'never' as const }], { sellerCode: 'V9' })).toHaveLength(1);
  });
});

describe('coberturaExportQuery: new params', () => {
  test('old arguments produce the old query string', () => {
    expect(coberturaExportQuery({ includeInactive: false, sellerCode: null, status: null })).toBe('format=xlsx&includeInactive=0');
  });
  test('new filters are appended only when set', () => {
    const q = new URLSearchParams(coberturaExportQuery({
      includeInactive: true, sellerCode: 'V1', status: 'lapsed', dateRange: 'month:2026-10', grupo: 'S1', ruta: 3, visit: 'overdue', inactiveInPeriod: true,
    }));
    expect(q.get('dateRange')).toBe('month:2026-10');
    expect(q.get('grupo')).toBe('S1');
    expect(q.get('ruta')).toBe('3');
    expect(q.get('visit')).toBe('overdue');
    expect(q.get('inactive')).toBe('1');
    expect(q.get('seller')).toBe('V1');
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `bun test --isolate --env-file=.env.local "app/(app)/analitica/lib/__tests__/cartera.test.ts" "app/(app)/analitica/lib/__tests__/cobertura.test.ts"`
Expected: FAIL (cartera module not found; filter/export-query assertions fail).

- [ ] **Step 3: Implement**

`app/(app)/analitica/lib/cartera.ts`:
```ts
import { customerKindInYear, type CustomerKind } from '@/lib/dwh/cutover';
import {
  summarizeCompliance, visitCompliance, type ComplianceSummary, type VisitCompliance,
} from '@/lib/seguimiento/visit-compliance';

// Pure pieces of the Clientes "cartera" additions (visit compliance, patrimonio/nuevo). No server imports:
// the cobertura route and the client component share this file.
export function dateKeyToIso(key: number): string {
  const s = String(key);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function enrichCartera(input: {
  lastSaleDateKey: number | null;
  visitIntervalDays: number | null;
  registeredDate: string | null;
  todayKey: number;
  kindYear: number;
}): { visit: VisitCompliance; kind: CustomerKind | null } {
  const visit = visitCompliance({
    lastInvoiceDate: input.lastSaleDateKey === null ? null : dateKeyToIso(input.lastSaleDateKey),
    intervalDays: input.visitIntervalDays,
    asOf: dateKeyToIso(input.todayKey),
  });
  const kind = input.registeredDate && ISO.test(input.registeredDate)
    ? customerKindInYear(input.registeredDate, input.kindYear)
    : null;
  return { visit, kind };
}

export const KIND_LABEL: Record<CustomerKind, string> = {
  patrimonio: 'Patrimonio',
  nuevo: 'Nuevo',
  posterior: 'Posterior',
};

export function visitLabel(v: VisitCompliance): string {
  switch (v.status) {
    case 'no_interval': return 'Sin frecuencia';
    case 'no_invoice': return 'Sin facturas';
    case 'overdue': return `Vencida +${v.daysOverdue} d`;
    case 'ok': return `Al día (${v.daysSinceLastInvoice} de ${v.intervalDays} d)`;
  }
}

export interface CarteraSummary {
  compliance: ComplianceSummary;
  inactiveInPeriod: number;
  nuevos: number;
  patrimonio: number;
}

export function summarizeCartera(
  rows: readonly { visit: VisitCompliance; kind: CustomerKind | null; activeInPeriod: boolean }[],
): CarteraSummary {
  return {
    compliance: summarizeCompliance(rows.map(r => r.visit)),
    inactiveInPeriod: rows.filter(r => !r.activeInPeriod).length,
    nuevos: rows.filter(r => r.kind === 'nuevo').length,
    patrimonio: rows.filter(r => r.kind === 'patrimonio').length,
  };
}
```

`app/(app)/analitica/types.ts`: add near the Cobertura types
```ts
import type { CustomerKind } from '@/lib/dwh/cutover';
import type { VisitCompliance } from '@/lib/seguimiento/visit-compliance';
```
and extend:
```ts
export interface CoberturaRowView {
  // ...existing fields unchanged...
  routeNumber: number | null;     // current Dim_Zone.RouteNumber; null = no route
  groupCode: string | null;       // current ErpSegmentCode (customer group)
  groupName: string | null;       // Dim_Segment.SegmentName
  kind: CustomerKind | null;      // patrimonio / nuevo in the range's year; null = no registration date
  visit: VisitCompliance;         // as of today
  activeInPeriod: boolean;        // >= 1 non-voided invoice in the selected range
}

export interface CoberturaResponse {
  // ...existing fields unchanged...
  kindYear: number;               // the year patrimonio/nuevo were evaluated for (year of the range end)
}

// Clientes tab group/route filter options (GET /api/dwh/clientes?section=filters).
export interface ClientesFiltersResponse {
  groups: { value: string; label: string }[];   // value = ErpSegmentCode, label = SegmentName
  routes: { value: string; label: string }[];   // value = RouteNumber as text, label = 'Ruta N'
}
```

`app/(app)/analitica/lib/cobertura.ts`: replace the `FilterableRow` interface, `filterCobertura` and `coberturaExportQuery` with
```ts
interface FilterableRow {
  sellerCode: string | null;
  status: CoberturaStatus;
  groupCode?: string | null;
  routeNumber?: number | null;
  visit?: { status: string };
  activeInPeriod?: boolean;
}

export interface CoberturaFilter {
  sellerCode?: string | null;
  status?: CoberturaStatus | null;
  grupo?: string | null;
  ruta?: number | null;
  visit?: 'overdue' | 'no_interval' | null;
  inactiveInPeriod?: boolean;
}

export function filterCobertura<T extends FilterableRow>(rows: T[], f: CoberturaFilter): T[] {
  return rows.filter(r => {
    if (f.sellerCode) {
      const code = r.sellerCode ?? NO_SELLER;
      if (code !== f.sellerCode) return false;
    }
    if (f.status && r.status !== f.status) return false;
    if (f.grupo && r.groupCode !== f.grupo) return false;
    if (f.ruta !== null && f.ruta !== undefined && r.routeNumber !== f.ruta) return false;
    if (f.visit && r.visit?.status !== f.visit) return false;
    if (f.inactiveInPeriod && r.activeInPeriod !== false) return false;
    return true;
  });
}
```
```ts
export function coberturaExportQuery(f: {
  includeInactive: boolean;
  sellerCode: string | null;
  status: CoberturaStatus | null;
  dateRange?: string;
  grupo?: string | null;
  ruta?: number | null;
  visit?: 'overdue' | 'no_interval' | null;
  inactiveInPeriod?: boolean;
}): string {
  const p = new URLSearchParams({ format: 'xlsx', includeInactive: f.includeInactive ? '1' : '0' });
  if (f.sellerCode) p.set('seller', f.sellerCode);
  if (f.status) p.set('status', f.status);
  if (f.dateRange) p.set('dateRange', f.dateRange);
  if (f.grupo) p.set('grupo', f.grupo);
  if (f.ruta !== null && f.ruta !== undefined) p.set('ruta', String(f.ruta));
  if (f.visit) p.set('visit', f.visit);
  if (f.inactiveInPeriod) p.set('inactive', '1');
  return p.toString();
}
```
(Keep the existing `summarizeCobertura`, `groupBySeller`, etc. untouched.) Existing test `base` fixtures that build `CoberturaRowView` literals (`app/(app)/analitica/components/__tests__/cobertura-clientes.test.tsx`) now fail `tsc`; they are fixed in Task 6.

- [ ] **Step 4: Run to verify they pass**

Run: `bun test --isolate --env-file=.env.local "app/(app)/analitica/lib/__tests__/cartera.test.ts" "app/(app)/analitica/lib/__tests__/cobertura.test.ts"`
Expected: PASS.
Run: `bunx tsc --noEmit`
Expected: errors ONLY in `cobertura-clientes.test.tsx` and `app/api/dwh/clientes/cobertura/route.ts` (missing new row fields) - these are fixed in Tasks 4 and 6; if you prefer a green tree after each task, do Tasks 3 and 4 together before committing.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/analitica/lib/cartera.ts" "app/(app)/analitica/lib/cobertura.ts" "app/(app)/analitica/types.ts" "app/(app)/analitica/lib/__tests__/cartera.test.ts" "app/(app)/analitica/lib/__tests__/cobertura.test.ts"
git commit -m "feat(clientes): pure cartera helpers (visit compliance, patrimonio/nuevo) and filter extensions" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 4: Cobertura route: period activity, route, group, kind and visit compliance

**Files:**
- Create: `lib/clientes/cobertura-sql.ts`
- Modify: `app/api/dwh/clientes/cobertura/route.ts` (replace whole file)
- Test: `app/api/dwh/clientes/cobertura/__tests__/route.test.ts` (mocked pool), `app/api/dwh/clientes/cobertura/__tests__/route.auth.test.ts`, extend `scripts/dwh/__tests__/consolidation-queries.test.ts`

**Interfaces:**
- Consumes: `enrichCartera`, `dateKeyToIso` (Task 3), `filterCobertura` (Task 3), `buildDateWhereClause`, `rangeEndDateKey`, `usdConversionJoin`, `jsonWithCache` (`app/api/dwh/lib/query-builder.ts`), `buildXlsx` (`lib/xlsx.ts`), `parseCarteraScope`-style parsing is local here (scope SQL is not used by this route: filtering is applied in TypeScript).
- Produces:
```ts
// lib/clientes/cobertura-sql.ts
export function coberturaCustomersQuery(includeInactive: boolean, periodDateWhere: string): string;   // periodDateWhere uses alias `fs`
export const COBERTURA_MONTHLY_QUERY: string;                                                          // needs @windowStartKey
// GET /api/dwh/clientes/cobertura?includeInactive=0|1&dateRange=<range>[&format=xlsx&seller=&status=&grupo=&ruta=&visit=&inactive=1]
// JSON: CoberturaResponse (every row now carries routeNumber/groupCode/groupName/kind/visit/activeInPeriod; kindYear)
```
Rules: one row per CURRENT customer; `activeInPeriod` = at least one non-voided invoice whose `DateKey` is in the range, found through ANY SCD2 version of the same `CustomerCode`; `visit` is evaluated as of today (not the range end); `kind` is evaluated for the year of the range end (`rangeEndDateKey(dateRange) / 10000`); invalid `dateRange` strings fall back to the 365-day window inside `buildDateWhereClause` (never interpolated raw); `grupo`/`ruta`/`visit`/`inactive` only affect the XLSX export (the JSON returns all rows and the client filters, so KPIs and filters stay consistent).

- [ ] **Step 1: Write the failing tests**

`app/api/dwh/clientes/cobertura/__tests__/route.auth.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import { NextRequest } from 'next/server';
import { GET } from '../route';

describe('GET /api/dwh/clientes/cobertura', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const res = await GET(new NextRequest('http://localhost/api/dwh/clientes/cobertura'));
    expect(res.status).toBe(401);
  });
});
```

`app/api/dwh/clientes/cobertura/__tests__/route.test.ts`:
```ts
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';

interface Captured { sql: string; inputs: Record<string, unknown> }
const queries: Captured[] = [];
let respond: (text: string) => unknown[] = () => [];

function makeRequest() {
  const inputs: Record<string, unknown> = {};
  const req = {
    input(name: string, a: unknown, b?: unknown) { inputs[name] = b === undefined ? a : b; return req; },
    async query(text: string) { queries.push({ sql: text, inputs }); return { recordset: respond(text) }; },
  };
  return req;
}
mock.module('@/lib/db/dwh-mssql', () => ({ getDwhPool: async () => ({ request: makeRequest }) }));
mock.module('@/lib/dwh/access', () => ({
  requireDwhAccess: async () => ({ ok: true, session: { sub: '1', role: 'admin', name: 'T' } }),
}));
const { GET } = await import('../route');

const DAY = 86_400_000;
const keyOf = (d: Date) => d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
const daysAgoKey = (n: number) => keyOf(new Date(Date.now() - n * DAY));

const customerRow = (over: Record<string, unknown>) => ({
  CustomerCode: 'C', CustomerName: 'Cliente', LegalEntityName: null, SellerCode: 'V1', SellerName: 'Ana',
  LastDateKey: null, EntityLastDateKey: null, GroupCode: 'S1', GroupName: 'Abasto', RouteNumber: 3,
  RegisteredDate: new Date('2026-03-28T00:00:00Z'), VisitIntervalDays: 7, InPeriod: 1, ...over,
});

beforeEach(() => {
  queries.length = 0;
  respond = text => (text.includes('PeriodSales') ? [
    customerRow({ CustomerCode: 'C1', CustomerName: 'Uno', LastDateKey: daysAgoKey(20), InPeriod: 0 }),
    customerRow({ CustomerCode: 'C2', CustomerName: 'Dos', LastDateKey: daysAgoKey(3), VisitIntervalDays: null, RegisteredDate: new Date('2026-05-10T00:00:00Z'), GroupCode: 'S2', GroupName: 'Restaurante', RouteNumber: 4 }),
    customerRow({ CustomerCode: 'C3', CustomerName: 'Tres', VisitIntervalDays: 30, RegisteredDate: null, GroupCode: null, GroupName: null, RouteNumber: null }),
  ] : []);
});

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/dwh/clientes/cobertura?${qs}`));

describe('GET /api/dwh/clientes/cobertura', () => {
  test('maps route, group, kind, visit compliance and period activity per current customer', async () => {
    const res = await get('includeInactive=0&dateRange=month:2026-10');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kindYear).toBe(2026);
    const by = Object.fromEntries(body.rows.map((r: { customerCode: string }) => [r.customerCode, r]));
    expect(by.C1).toMatchObject({ routeNumber: 3, groupCode: 'S1', groupName: 'Abasto', kind: 'patrimonio', activeInPeriod: false });
    expect(by.C1.visit).toMatchObject({ status: 'overdue', intervalDays: 7, daysSinceLastInvoice: 20, daysOverdue: 13 });
    expect(by.C2).toMatchObject({ routeNumber: 4, groupCode: 'S2', kind: 'nuevo', activeInPeriod: true });
    expect(by.C2.visit).toMatchObject({ status: 'no_interval', daysOverdue: null });   // no frequency: never overdue
    expect(by.C3).toMatchObject({ routeNumber: null, groupCode: null, groupName: null, kind: null });
    expect(by.C3.visit.status).toBe('no_invoice');
  });

  test('the period window is built from the validated range and the invalid range cannot inject SQL', async () => {
    await get('dateRange=month:2026-10');
    const customers = queries.find(q => q.sql.includes('PeriodSales'))!;
    expect(customers.sql).toContain('fs.DateKey >= 20261001');
    expect(customers.sql).toContain('fs.DateKey <= 20261031');
    queries.length = 0;
    await get("dateRange=month:2026-10'; DROP TABLE x; --");
    expect(queries.every(q => !q.sql.includes('DROP'))).toBe(true);
  });

  test('includeInactive controls the IsInactive predicate', async () => {
    await get('includeInactive=0');
    expect(queries.find(q => q.sql.includes('PeriodSales'))!.sql).toContain('c.IsInactive = 0');
    queries.length = 0;
    await get('includeInactive=1');
    expect(queries.find(q => q.sql.includes('PeriodSales'))!.sql).not.toContain('c.IsInactive = 0');
  });

  test('xlsx export honors the new filters and returns a spreadsheet', async () => {
    const res = await get('format=xlsx&dateRange=month:2026-10&grupo=S2&visit=no_interval');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('spreadsheetml');
    expect(res.headers.get('Content-Disposition')).toContain('cobertura-clientes-');
  });

  test('a database error is a 500 with the standard error shape', async () => {
    respond = () => { throw new Error('boom'); };
    const res = await get('dateRange=month:2026-10');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Error al consultar el Data Warehouse' });
  });
});
```

Append to `scripts/dwh/__tests__/consolidation-queries.test.ts` (import `coberturaCustomersQuery` from `'../../../lib/clientes/cobertura-sql'` at the top):
```ts
  test('coberturaCustomersQuery: current rows only, route/group/frequency from the current row, period activity across SCD2 versions', async () => {
    const where = buildDateWhereClause('custom:2026-10-01:2026-10-07', 'fs');
    const result = await pool.request().query(coberturaCustomersQuery(false, where));
    const by = new Map(result.recordset.map(r => [String(r.CustomerCode).trim(), r]));
    expect([...by.keys()].sort()).toEqual(['C1', 'C2', 'C3', 'C4', 'C5']);   // C2's old version is not a row
    expect(by.get('C1')).toMatchObject({ RouteNumber: 3, GroupCode: 'S1', GroupName: 'Abasto', VisitIntervalDays: 7, InPeriod: 1 });
    // I3 points at C2's OLD key (S2 / route 4): activity counts for C2, attributes come from the CURRENT row (S1 / route 3).
    expect(by.get('C2')).toMatchObject({ RouteNumber: 3, GroupCode: 'S1', VisitIntervalDays: null, InPeriod: 1 });
    // C3's invoices are 09-20 and 10-08: both outside 10-01..10-07, but the last sale is still found.
    expect(by.get('C3')).toMatchObject({ InPeriod: 0, VisitIntervalDays: 30, LastDateKey: 20261008 });
    expect(by.get('C4')).toMatchObject({ RouteNumber: null, GroupName: null, RegisteredDate: null, InPeriod: 1 });
    expect(by.get('C5')).toMatchObject({ InPeriod: 0, LastDateKey: null });
  });
```

- [ ] **Step 2: Run to see them fail**

Run: `bun test --isolate --env-file=.env.local app/api/dwh/clientes/cobertura`
Expected: FAIL (new fields missing / `PeriodSales` absent).
Run: `bun test --isolate --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/consolidation-queries.test.ts`
Expected: FAIL (module `lib/clientes/cobertura-sql` not found).

- [ ] **Step 3: Implement**

`lib/clientes/cobertura-sql.ts`:
```ts
import { usdConversionJoin } from '@/app/api/dwh/lib/query-builder';

// One row per CURRENT customer version. Sales are keyed by CustomerKey, which may point at an older SCD2
// version of the same code, so every sales aggregate groups by RTRIM(CustomerCode) across all versions.
// Route / group / frequency / registration come from the current row (Dim_Zone, Dim_Segment joined on it).
// periodDateWhere (alias `fs`) comes from buildDateWhereClause(range, 'fs').
export function coberturaCustomersQuery(includeInactive: boolean, periodDateWhere: string): string {
  return `
    WITH Cur AS (
      SELECT RTRIM(c.CustomerCode) AS Code, c.CustomerName, RTRIM(c.DefaultSalesRepCode) AS SellerCode, c.LegalEntityKey,
             RTRIM(c.ErpSegmentCode) AS GroupCode, sg.SegmentName AS GroupName, z.RouteNumber AS RouteNumber,
             c.RegisteredDate AS RegisteredDate, c.VisitIntervalDays AS VisitIntervalDays
      FROM dim.Dim_Customer c
      LEFT JOIN dim.Dim_Segment sg ON sg.ErpSegmentCode = c.ErpSegmentCode
      LEFT JOIN dim.Dim_Zone z ON z.ZoneCode = c.ZoneCode
      WHERE c.IsCurrent = 1 ${includeInactive ? '' : 'AND c.IsInactive = 0'}
    ),
    OwnSales AS (
      SELECT RTRIM(c.CustomerCode) AS Code, MAX(fs.DateKey) AS LastDateKey
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0
      GROUP BY RTRIM(c.CustomerCode)
    ),
    EntitySales AS (
      SELECT c.LegalEntityKey, MAX(fs.DateKey) AS LastDateKey
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 AND c.LegalEntityKey IS NOT NULL
      GROUP BY c.LegalEntityKey
    ),
    PeriodSales AS (
      SELECT DISTINCT RTRIM(c.CustomerCode) AS Code
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 ${periodDateWhere}
    )
    SELECT cur.Code AS CustomerCode, cur.CustomerName, le.LegalEntityName, cur.SellerCode,
           r.SalesRepName AS SellerName, o.LastDateKey, e.LastDateKey AS EntityLastDateKey,
           cur.GroupCode, cur.GroupName, cur.RouteNumber, cur.RegisteredDate, cur.VisitIntervalDays,
           CASE WHEN ps.Code IS NULL THEN 0 ELSE 1 END AS InPeriod
    FROM Cur cur
    LEFT JOIN OwnSales o ON o.Code = cur.Code
    LEFT JOIN EntitySales e ON e.LegalEntityKey = cur.LegalEntityKey
    LEFT JOIN PeriodSales ps ON ps.Code = cur.Code
    LEFT JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = cur.LegalEntityKey
    LEFT JOIN dim.Dim_SalesRep r ON RTRIM(r.SalesRepCode) = cur.SellerCode
  `;
}

export const COBERTURA_MONTHLY_QUERY = `
  SELECT RTRIM(c.CustomerCode) AS Code, d.YearMonth,
         SUM(fs.QuantitySold) AS Units,
         SUM(fs.NetAmount / NULLIF(fx.RateSell, 0)) AS Usd
  FROM fact.Fact_Sales fs
  JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
  JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
  ${usdConversionJoin('fs')}
  WHERE fs.IsVoided = 0 AND fs.DateKey >= @windowStartKey
  GROUP BY RTRIM(c.CustomerCode), d.YearMonth
`;
```

`app/api/dwh/clientes/cobertura/route.ts` (full replacement):
```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { buildDateWhereClause, jsonWithCache, rangeEndDateKey } from '@/app/api/dwh/lib/query-builder';
import { COBERTURA_MONTHLY_QUERY, coberturaCustomersQuery } from '@/lib/clientes/cobertura-sql';
import { buildXlsx } from '@/lib/xlsx';
import {
  LAPSED_AFTER_DAYS, averageOverInvoicedMonths, classifyCoverage, compareDaysSince, filterCobertura,
  trailingWindowStartKey, type CoberturaStatus,
} from '@/app/(app)/analitica/lib/cobertura';
import { KIND_LABEL, enrichCartera, visitLabel } from '@/app/(app)/analitica/lib/cartera';
import type { CoberturaResponse, CoberturaRowView } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

function dateKeyOf(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

const STATUS_LABEL: Record<CoberturaStatus, string> = {
  never: 'Nunca vendido',
  via_matriz: 'Vende vía matriz',
  lapsed: `Sin ventas en ${LAPSED_AFTER_DAYS}+ días`,
  active: 'Activo',
};

function isStatus(v: string | null): v is CoberturaStatus {
  return v === 'never' || v === 'via_matriz' || v === 'lapsed' || v === 'active';
}

function formatKey(key: number | null): string {
  if (key === null) return 'Sin datos';
  const s = String(key);
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

const isoOf = (v: unknown): string => new Date(v as string | Date).toISOString().slice(0, 10);

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('includeInactive') === '1';
  const format = searchParams.get('format');
  const statusParam = searchParams.get('status');
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const rutaParam = searchParams.get('ruta');
  const visitParam = searchParams.get('visit');

  try {
    const pool = await getDwhPool();
    const now = new Date();
    const todayKey = dateKeyOf(now);
    const windowStartKey = trailingWindowStartKey(now);
    const kindYear = Math.floor(rangeEndDateKey(dateRange, now) / 10000);
    const periodWhere = buildDateWhereClause(dateRange, 'fs');

    const [customers, monthly] = await Promise.all([
      pool.request().query(coberturaCustomersQuery(includeInactive, periodWhere)),
      pool.request().input('windowStartKey', windowStartKey).query(COBERTURA_MONTHLY_QUERY),
    ]);

    const monthsByCode = new Map<string, { units: number; usd: number | null }[]>();
    for (const m of monthly.recordset) {
      const list = monthsByCode.get(m.Code) ?? [];
      list.push({ units: Number(m.Units ?? 0), usd: m.Usd === null ? null : Number(m.Usd) });
      monthsByCode.set(m.Code, list);
    }

    const rows: CoberturaRowView[] = customers.recordset.map(r => {
      const lastSaleDateKey = r.LastDateKey === null || r.LastDateKey === undefined ? null : Number(r.LastDateKey);
      const entityLastSaleDateKey = r.EntityLastDateKey === null || r.EntityLastDateKey === undefined ? null : Number(r.EntityLastDateKey);
      const { status, daysSinceLastSale } = classifyCoverage(lastSaleDateKey, entityLastSaleDateKey, todayKey);
      const avg = averageOverInvoicedMonths(monthsByCode.get(r.CustomerCode) ?? []);
      const { visit, kind } = enrichCartera({
        lastSaleDateKey,
        visitIntervalDays: r.VisitIntervalDays === null || r.VisitIntervalDays === undefined ? null : Number(r.VisitIntervalDays),
        registeredDate: r.RegisteredDate ? isoOf(r.RegisteredDate) : null,
        todayKey,
        kindYear,
      });
      return {
        customerCode: r.CustomerCode,
        customerName: (r.CustomerName ?? r.CustomerCode).trim(),
        entityName: r.LegalEntityName ? String(r.LegalEntityName).trim() : null,
        sellerCode: r.SellerCode ? String(r.SellerCode) : null,
        sellerName: r.SellerName ? String(r.SellerName).trim() : null,
        lastSaleDateKey,
        entityLastSaleDateKey,
        daysSinceLastSale,
        avgMonthlyUsd: avg?.avgUsd ?? null,
        avgMonthlyUnits: avg?.avgUnits ?? null,
        monthsWithSales: avg?.months ?? 0,
        status,
        routeNumber: r.RouteNumber === null || r.RouteNumber === undefined ? null : Number(r.RouteNumber),
        groupCode: r.GroupCode ? String(r.GroupCode).trim() : null,
        groupName: r.GroupName ? String(r.GroupName).trim() : null,
        kind,
        visit,
        activeInPeriod: Number(r.InPeriod) === 1,
      };
    });
    rows.sort((a, b) => compareDaysSince(a, b, 'asc'));

    if (format === 'xlsx') {
      const filtered = filterCobertura(rows, {
        sellerCode: searchParams.get('seller'),
        status: isStatus(statusParam) ? statusParam : null,
        grupo: searchParams.get('grupo'),
        ruta: rutaParam && /^\d{1,3}$/.test(rutaParam) ? Number(rutaParam) : null,
        visit: visitParam === 'overdue' || visitParam === 'no_interval' ? visitParam : null,
        inactiveInPeriod: searchParams.get('inactive') === '1',
      });
      const columns = [
        { key: 'cliente', label: 'Cliente', defaultVisible: true, defaultOrder: 0 },
        { key: 'codigo', label: 'Código', defaultVisible: true, defaultOrder: 1 },
        { key: 'entidad', label: 'Entidad', defaultVisible: true, defaultOrder: 2 },
        { key: 'vendedor', label: 'Vendedor', defaultVisible: true, defaultOrder: 3 },
        { key: 'ruta', label: 'Ruta', defaultVisible: true, defaultOrder: 4 },
        { key: 'grupo', label: 'Grupo', defaultVisible: true, defaultOrder: 5 },
        { key: 'tipo', label: 'Tipo', defaultVisible: true, defaultOrder: 6 },
        { key: 'ultimaVenta', label: 'Última venta', defaultVisible: true, defaultOrder: 7 },
        { key: 'dias', label: 'Días sin vender', defaultVisible: true, defaultOrder: 8, type: 'number' as const },
        { key: 'visita', label: 'Visita', defaultVisible: true, defaultOrder: 9 },
        { key: 'periodo', label: 'Compró en el período', defaultVisible: true, defaultOrder: 10 },
        { key: 'usdMes', label: 'USD/mes (prom. 12m)', defaultVisible: true, defaultOrder: 11, type: 'number' as const },
        { key: 'unidadesMes', label: 'Unidades/mes (prom. 12m)', defaultVisible: true, defaultOrder: 12, type: 'number' as const },
        { key: 'estado', label: 'Estado', defaultVisible: true, defaultOrder: 13 },
      ];
      const data = filtered.map(r => ({
        cliente: r.customerName,
        codigo: r.customerCode,
        entidad: r.entityName ?? 'Sin datos',
        vendedor: r.sellerName ?? 'Sin vendedor',
        ruta: r.routeNumber === null ? 'Sin ruta' : `Ruta ${r.routeNumber}`,
        grupo: r.groupName ?? 'Sin grupo',
        tipo: r.kind === null ? 'Sin fecha de registro' : KIND_LABEL[r.kind],
        ultimaVenta: r.lastSaleDateKey === null
          ? (r.status === 'via_matriz' ? `Sin datos (matriz: ${formatKey(r.entityLastSaleDateKey)})` : 'Sin datos')
          : formatKey(r.lastSaleDateKey),
        dias: r.daysSinceLastSale ?? 'Sin datos',
        visita: visitLabel(r.visit),
        periodo: r.activeInPeriod ? 'Sí' : 'No',
        usdMes: r.avgMonthlyUsd === null ? 'Sin datos' : Math.round(r.avgMonthlyUsd * 100) / 100,
        unidadesMes: r.avgMonthlyUnits === null ? 'Sin datos' : Math.round(r.avgMonthlyUnits * 100) / 100,
        estado: STATUS_LABEL[r.status],
      }));
      const buffer = buildXlsx(columns, data);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="cobertura-clientes-${todayKey}.xlsx"`,
        },
      });
    }

    const response: CoberturaResponse = {
      rows, asOfDateKey: todayKey, windowStartDateKey: windowStartKey, lapsedAfterDays: LAPSED_AFTER_DAYS, kindYear,
    };
    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
```
(If `buildXlsx`'s column type requires a `ColumnDef` shape with extra keys, copy the shape the old file used - the added entries follow the same shape.)

- [ ] **Step 4: Run to verify they pass**

Run: `bun test --isolate --env-file=.env.local app/api/dwh/clientes/cobertura "app/(app)/analitica/lib"` -> PASS.
Run: `bun test --isolate --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/consolidation-queries.test.ts` -> PASS (if `InPeriod` for C4 differs, re-check the seed date of I5 = 20261007, inside the custom window).
Run: `bunx tsc --noEmit` -> only the `cobertura-clientes.test.tsx` fixture errors from Task 3 remain (fixed in Task 6).

- [ ] **Step 5: Commit**

```bash
git add lib/clientes/cobertura-sql.ts app/api/dwh/clientes/cobertura scripts/dwh/__tests__/consolidation-queries.test.ts
git commit -m "feat(clientes): cobertura route with route, group, patrimonio/nuevo, visit compliance and period activity" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Group / route scope on the Clientes API (Pareto, trend, churned) and the filter-options section

**Files:**
- Create: `lib/clientes/scope.ts`
- Modify: `app/api/dwh/clientes/route.ts` (imports; `churnedQuery`, `trendQuery`, `customerQuery`, `handleChurned`, `handleTrend`, `GET`; add `handleFilters`)
- Modify: `app/(app)/analitica/types.ts` already has `ClientesFiltersResponse` (Task 3)
- Test: `__tests__/unit/clientes/scope.test.ts`, `app/api/dwh/clientes/__tests__/route.scope.test.ts` (mocked pool), extend `scripts/dwh/__tests__/consolidation-queries.test.ts`

**Interfaces:**
- Consumes: `ClientesFiltersResponse` (Task 3), `jsonWithCache`.
- Produces:
```ts
// lib/clientes/scope.ts
export interface CarteraScope { grupo: string | null; ruta: number | null }
export function parseCarteraScope(sp: URLSearchParams): CarteraScope;    // grupo /^[A-Za-z0-9_-]{1,6}$/, ruta /^\d{1,3}$/; invalid -> null (ignored, not an error)
export interface CustomerScopeSql { where: string; bind(req: { input(name: string, value: unknown): unknown }): void }
export function customerScope(scope: CarteraScope, customerAlias?: string): CustomerScopeSql;   // alias default 'c'; invalid alias throws
export const CLIENTES_GROUPS_QUERY: string;     // Code, Name
export const CLIENTES_ROUTES_QUERY: string;     // RouteNumber, ZoneName
// GET /api/dwh/clientes?...&grupo=S1&ruta=3     (default list, section=trend, section=churned)
// GET /api/dwh/clientes?section=filters         -> ClientesFiltersResponse
```
Rules: the scope is `AND <alias>.CustomerCode IN (SELECT cur_s.CustomerCode FROM dim.Dim_Customer cur_s LEFT JOIN dim.Dim_Zone z_s ON z_s.ZoneCode = cur_s.ZoneCode WHERE cur_s.IsCurrent = 1 [AND RTRIM(cur_s.ErpSegmentCode) = @scopeGrupo] [AND z_s.RouteNumber = @scopeRuta])`, i.e. membership is decided by the customer's CURRENT row, so an invoice on an old SCD2 version follows the customer. It filters the SALES side only (Review Focus 1); the correlated returns subqueries are unchanged (documented limitation at Entidad grain). In `churnedQuery` the scope applies to the outer (prior-period) query only.

- [ ] **Step 1: Write the failing tests**

`__tests__/unit/clientes/scope.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import { customerScope, parseCarteraScope } from '../../../lib/clientes/scope';

const sp = (q: string) => new URLSearchParams(q);

describe('parseCarteraScope', () => {
  test('valid group code and route number', () => {
    expect(parseCarteraScope(sp('grupo=S1&ruta=3'))).toEqual({ grupo: 'S1', ruta: 3 });
  });
  test('missing or malformed values are ignored, never an error or an injection vector', () => {
    expect(parseCarteraScope(sp(''))).toEqual({ grupo: null, ruta: null });
    expect(parseCarteraScope(sp("grupo=S1' OR '1'='1&ruta=3;DROP"))).toEqual({ grupo: null, ruta: null });
    expect(parseCarteraScope(sp('grupo=TOOLONGCODE&ruta=12345'))).toEqual({ grupo: null, ruta: null });
    expect(parseCarteraScope(sp('ruta=0'))).toEqual({ grupo: null, ruta: 0 });
  });
});

describe('customerScope', () => {
  test('no scope adds no SQL and binds nothing', () => {
    const s = customerScope({ grupo: null, ruta: null });
    const bound: string[] = [];
    s.bind({ input: n => bound.push(n) });
    expect(s.where).toBe('');
    expect(bound).toEqual([]);
  });
  test('group only filters the CURRENT row by ErpSegmentCode', () => {
    const s = customerScope({ grupo: 'S1', ruta: null }, 'c');
    expect(s.where).toContain('c.CustomerCode IN (SELECT cur_s.CustomerCode');
    expect(s.where).toContain('cur_s.IsCurrent = 1');
    expect(s.where).toContain('RTRIM(cur_s.ErpSegmentCode) = @scopeGrupo');
    expect(s.where).not.toContain('@scopeRuta');
  });
  test('both filters bind both parameters with the parsed values', () => {
    const s = customerScope({ grupo: 'S1', ruta: 3 });
    const bound: Record<string, unknown> = {};
    s.bind({ input: (n, v) => { bound[n] = v; } });
    expect(bound).toEqual({ scopeGrupo: 'S1', scopeRuta: 3 });
    expect(s.where).toContain('z_s.RouteNumber = @scopeRuta');
  });
  test('the alias is validated because it is interpolated', () => {
    expect(() => customerScope({ grupo: 'S1', ruta: null }, 'c; DROP TABLE x')).toThrow(/Alias/);
  });
});
```

`app/api/dwh/clientes/__tests__/route.scope.test.ts`:
```ts
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';

interface Captured { sql: string; inputs: Record<string, unknown> }
const queries: Captured[] = [];
let respond: (text: string) => unknown[] = () => [];
function makeRequest() {
  const inputs: Record<string, unknown> = {};
  const req = {
    input(name: string, a: unknown, b?: unknown) { inputs[name] = b === undefined ? a : b; return req; },
    async query(text: string) { queries.push({ sql: text, inputs }); return { recordset: respond(text) }; },
  };
  return req;
}
mock.module('@/lib/db/dwh-mssql', () => ({ getDwhPool: async () => ({ request: makeRequest }) }));
mock.module('@/lib/dwh/access', () => ({
  requireDwhAccess: async () => ({ ok: true, session: { sub: '1', role: 'admin', name: 'T' } }),
}));
const { GET } = await import('../route');

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/dwh/clientes?${qs}`));
beforeEach(() => { queries.length = 0; respond = () => []; });

describe('GET /api/dwh/clientes scope', () => {
  test('default list: group and route become bound parameters on the sales query', async () => {
    const res = await get('dateRange=month:2026-10&clienteDimension=cliente_tienda&grupo=S1&ruta=3');
    expect(res.status).toBe(200);
    const q = queries[0];
    expect(q.sql).toContain('cur_s.IsCurrent = 1');
    expect(q.sql).toContain('@scopeGrupo');
    expect(q.sql).toContain('@scopeRuta');
    expect(q.inputs).toMatchObject({ scopeGrupo: 'S1', scopeRuta: 3 });
  });
  test('no scope params: the SQL is unchanged', async () => {
    await get('dateRange=month:2026-10');
    expect(queries[0].sql).not.toContain('cur_s');
    expect(queries[0].inputs).toEqual({});
  });
  test('malformed scope values are ignored (no SQL, no inputs)', async () => {
    await get("dateRange=month:2026-10&grupo=S1' OR '1'='1&ruta=abc");
    expect(queries[0].sql).not.toContain('cur_s');
    expect(queries[0].inputs).toEqual({});
  });
  test('trend keeps minYearMonth and adds the scope to the monthly customer set', async () => {
    await get('dateRange=month:2026-10&section=trend&grupo=S2');
    expect(queries[0].sql).toContain('@scopeGrupo');
    expect(queries[0].inputs).toMatchObject({ minYearMonth: '2026-10', scopeGrupo: 'S2' });
  });
  test('churned scopes the prior-period customers', async () => {
    await get('dateRange=month:2026-10&section=churned&ruta=4');
    expect(queries[0].sql).toContain('@scopeRuta');
    expect(queries[0].inputs).toMatchObject({ scopeRuta: 4 });
  });
  test('section=filters returns the group and route options', async () => {
    respond = text => (text.includes('Dim_Segment')
      ? [{ Code: 'S1', Name: 'Abasto' }, { Code: 'S2', Name: 'Restaurante' }]
      : [{ RouteNumber: 3, ZoneName: 'Ruta 3' }, { RouteNumber: 4, ZoneName: 'Ruta 4' }]);
    const res = await get('section=filters');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      groups: [{ value: 'S1', label: 'Abasto' }, { value: 'S2', label: 'Restaurante' }],
      routes: [{ value: '3', label: 'Ruta 3' }, { value: '4', label: 'Ruta 4' }],
    });
  });
  test('a database error is a 500 with the standard shape', async () => {
    respond = () => { throw new Error('boom'); };
    const res = await get('section=filters');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Error al consultar el Data Warehouse' });
  });
});
```

Append to `scripts/dwh/__tests__/consolidation-queries.test.ts` (import `{ CLIENTES_GROUPS_QUERY, CLIENTES_ROUTES_QUERY, customerScope }` from `'../../../lib/clientes/scope'`):
```ts
  test('customerScope follows the CURRENT row: an invoice on an old SCD2 version belongs to the current group/route', async () => {
    const run = async (grupo: string | null, ruta: number | null) => {
      const scope = customerScope({ grupo, ruta }, 'c');
      const req = pool.request();
      scope.bind(req);
      const r = await req.query(`
        SELECT RTRIM(c.CustomerCode) AS Code, SUM(fs.NetAmount) AS Bs
        FROM fact.Fact_Sales fs JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
        WHERE fs.IsVoided = 0 ${scope.where}
        GROUP BY RTRIM(c.CustomerCode) ORDER BY 1`);
      return r.recordset.map(x => `${x.Code}:${x.Bs}`);
    };
    expect(await run('S1', 3)).toEqual(['C1:1500', 'C2:2000']);   // C2's I3 sits on its old S2/route-4 key but C2 is now S1/route 3
    expect(await run('S2', null)).toEqual(['C3:1100']);           // not C2: only the current row counts
    expect(await run(null, 4)).toEqual(['C3:1100']);
    expect(await run(null, null)).toEqual(['C1:1500', 'C2:2000', 'C3:1100', 'C4:300']);
  });

  test('filter option queries list only groups/routes with active current customers', async () => {
    const groups = (await pool.request().query(CLIENTES_GROUPS_QUERY)).recordset;
    expect(groups.map(g => [String(g.Code).trim(), g.Name])).toEqual([['S1', 'Abasto'], ['S2', 'Restaurante']]);
    const routes = (await pool.request().query(CLIENTES_ROUTES_QUERY)).recordset;
    expect(routes.map(r => [r.RouteNumber, r.ZoneName])).toEqual([[3, 'Ruta 3'], [4, 'Ruta 4']]);
  });
```

- [ ] **Step 2: Run to see them fail**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/clientes/scope.test.ts app/api/dwh/clientes/__tests__/route.scope.test.ts`
Expected: FAIL (module not found / no scope in SQL).

- [ ] **Step 3: Implement**

`lib/clientes/scope.ts`:
```ts
// Group / route scope for the Clientes tab. Membership is decided by the CURRENT Dim_Customer row (by
// CustomerCode), so invoices issued under an older SCD2 version follow the customer. Values reach SQL only
// through .input(); the alias is the single interpolated token and is validated.
export interface CarteraScope { grupo: string | null; ruta: number | null }

const GRUPO_RE = /^[A-Za-z0-9_-]{1,6}$/;
const RUTA_RE = /^\d{1,3}$/;
const ALIAS_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

export function parseCarteraScope(sp: URLSearchParams): CarteraScope {
  const g = (sp.get('grupo') ?? '').trim();
  const r = sp.get('ruta') ?? '';
  return { grupo: GRUPO_RE.test(g) ? g : null, ruta: RUTA_RE.test(r) ? Number(r) : null };
}

export interface CustomerScopeSql {
  where: string;
  bind(req: { input(name: string, value: unknown): unknown }): void;
}

export function customerScope(scope: CarteraScope, customerAlias: string = 'c'): CustomerScopeSql {
  if (!ALIAS_RE.test(customerAlias)) throw new Error(`Alias inválido '${customerAlias}'`);
  if (scope.grupo === null && scope.ruta === null) return { where: '', bind: () => {} };
  const conds = ['cur_s.IsCurrent = 1'];
  if (scope.grupo !== null) conds.push('RTRIM(cur_s.ErpSegmentCode) = @scopeGrupo');
  if (scope.ruta !== null) conds.push('z_s.RouteNumber = @scopeRuta');
  return {
    where: `AND ${customerAlias}.CustomerCode IN (SELECT cur_s.CustomerCode FROM dim.Dim_Customer cur_s LEFT JOIN dim.Dim_Zone z_s ON z_s.ZoneCode = cur_s.ZoneCode WHERE ${conds.join(' AND ')})`,
    bind: req => {
      if (scope.grupo !== null) req.input('scopeGrupo', scope.grupo);
      if (scope.ruta !== null) req.input('scopeRuta', scope.ruta);
    },
  };
}

export const CLIENTES_GROUPS_QUERY = `
  SELECT RTRIM(s.ErpSegmentCode) AS Code, s.SegmentName AS Name
  FROM dim.Dim_Segment s
  WHERE EXISTS (SELECT 1 FROM dim.Dim_Customer c
                WHERE c.IsCurrent = 1 AND c.IsInactive = 0 AND c.ErpSegmentCode = s.ErpSegmentCode)
  ORDER BY s.SegmentName
`;

export const CLIENTES_ROUTES_QUERY = `
  SELECT z.RouteNumber AS RouteNumber, z.ZoneName AS ZoneName
  FROM dim.Dim_Zone z
  WHERE z.IsRoute = 1 AND z.RouteNumber IS NOT NULL
    AND EXISTS (SELECT 1 FROM dim.Dim_Customer c
                WHERE c.IsCurrent = 1 AND c.IsInactive = 0 AND c.ZoneCode = z.ZoneCode)
  ORDER BY z.RouteNumber
`;
```

Edits to `app/api/dwh/clientes/route.ts`:
1. Imports: add `import { CLIENTES_GROUPS_QUERY, CLIENTES_ROUTES_QUERY, customerScope, parseCarteraScope, type CarteraScope } from '@/lib/clientes/scope';` and add `ClientesFiltersResponse` to the type import from `@/app/(app)/analitica/types`.
2. `churnedQuery(dimension, prevDateWhere, currentDateWhere)` -> add a 4th parameter `scopeWhere: string` and change `WHERE fs.IsVoided = 0 ${prevDateWhere}` to `WHERE fs.IsVoided = 0 ${prevDateWhere} ${scopeWhere}` (outer query only; do NOT touch the `NOT EXISTS` subquery).
3. `trendQuery(dimension, widenedDateWhere)` -> add `scopeWhere: string`; change `WHERE fs.IsVoided = 0 ${widenedDateWhere}` (inside `CustomerMonth`) to `WHERE fs.IsVoided = 0 ${widenedDateWhere} ${scopeWhere}`.
4. `customerQuery(dimension, salesDateWhere, returnsDateWhere)` -> add `scopeWhere: string`; change `WHERE fs.IsVoided = 0 ${salesDateWhere}` to `WHERE fs.IsVoided = 0 ${salesDateWhere} ${scopeWhere}`.
5. `handleChurned(dimension, dateRange)` -> `handleChurned(dimension, dateRange, scope: CarteraScope)`; replace the final query call with
```ts
  const sc = customerScope(scope, 'c');
  const req = pool.request();
  sc.bind(req);
  const churned = await req.query(churnedQuery(dimension, prevSalesDateWhere, currentSalesDateWhere, sc.where));
```
6. `handleTrend(dimension, dateRange)` -> add `scope: CarteraScope`; replace the request chain with
```ts
  const sc = customerScope(scope, 'c');
  const req = pool.request().input('minYearMonth', minYearMonth);
  sc.bind(req);
  const result = await req.query(trendQuery(dimension, widenedDateWhereClause(dateRange), sc.where));
```
7. Add the filters handler above `GET`:
```ts
async function handleFilters(): Promise<NextResponse> {
  const pool = await getDwhPool();
  const [groups, routes] = await Promise.all([
    pool.request().query(CLIENTES_GROUPS_QUERY),
    pool.request().query(CLIENTES_ROUTES_QUERY),
  ]);
  const response: ClientesFiltersResponse = {
    groups: groups.recordset.map(r => ({ value: String(r.Code).trim(), label: String(r.Name).trim() })),
    routes: routes.recordset.map(r => ({ value: String(r.RouteNumber), label: String(r.ZoneName).trim() })),
  };
  return jsonWithCache(response);
}
```
8. In `GET`, after `clienteDimension` is computed: `const scope = parseCarteraScope(searchParams);` ; add before the `trend` branch
```ts
  if (searchParams.get('section') === 'filters') {
    try {
      return await handleFilters();
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }
```
pass `scope` to `handleTrend(clienteDimension, dateRange, scope)` and `handleChurned(clienteDimension, dateRange, scope)`, and in the default branch replace `const customers = await pool.request().query(customerQuery(clienteDimension, salesDateWhere, returnsDateWhere));` with
```ts
    const sc = customerScope(scope, 'c');
    const req = pool.request();
    sc.bind(req);
    const customers = await req.query(customerQuery(clienteDimension, salesDateWhere, returnsDateWhere, sc.where));
```
Add one comment above `customerQuery`: `// Group/route scope filters the SALES rows by the customer's current attributes; the correlated returns subquery is per entity/tienda and is not scoped (exact at Tienda grain).`

- [ ] **Step 4: Run to verify they pass**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/clientes/scope.test.ts app/api/dwh/clientes` -> PASS (existing 401 tests included).
Run: `bun test --isolate --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/consolidation-queries.test.ts` -> PASS. Expected sums: C1 = I1 1000 + I2 500 (voided I6 excluded) = 1500; C2 = I3 2000; C3 = I4 700 + I7 400 = 1100; C4 = 300.
Run: `bunx tsc --noEmit` -> only the Task 3 fixture error in `cobertura-clientes.test.tsx` remains.

- [ ] **Step 5: Commit**

```bash
git add lib/clientes/scope.ts app/api/dwh/clientes/route.ts __tests__/unit/clientes/scope.test.ts app/api/dwh/clientes/__tests__/route.scope.test.ts scripts/dwh/__tests__/consolidation-queries.test.ts
git commit -m "feat(clientes): group and route scope on the Clientes API and filter-options section" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 6: Clientes UI: filter bar, visit compliance, overdue and inactive lists, patrimonio/nuevo

**Files:**
- Create: `app/(app)/analitica/components/cartera-filter-bar.tsx`
- Modify: `app/(app)/analitica/components/cobertura-clientes.tsx`, `app/(app)/analitica/tabs/tab-clientes.tsx`, `content/help/analitica-definiciones.md`
- Test: `app/(app)/analitica/components/__tests__/cartera-filter-bar.test.tsx`, update + extend `app/(app)/analitica/components/__tests__/cobertura-clientes.test.tsx`

**Interfaces:**
- Consumes: `ClientesFiltersResponse`, `CoberturaRowView` (Task 3); `filterCobertura`, `coberturaExportQuery` (Task 3); `summarizeCartera`, `KIND_LABEL` (Task 3); `VisitBadge(props: { visit: VisitCompliance })` from `./seguimiento/visuals` (plan B; read its text for `no_interval` first - the spec string is "Sin frecuencia"); `SearchableSelect`; `KpiGroup`, `KpiCard`.
- Produces:
```tsx
// components/cartera-filter-bar.tsx
export default function CarteraFilterBar(props: { grupo: string | null; ruta: string | null; onGrupo: (v: string | null) => void; onRuta: (v: string | null) => void }): JSX.Element;
// components/cobertura-clientes.tsx
export default function CoberturaClientes(props: { dateRange?: DateRange; grupo?: string | null; ruta?: number | null }): JSX.Element;   // all optional: old call sites keep working
```
Behavior: the filter bar loads options once from `/api/dwh/clientes?section=filters` (a failed load leaves the selects empty, non-fatal), selects use `SearchableSelect` with aria-labels `Filtrar por grupo` / `Filtrar por ruta`. `CoberturaClientes` refetches when `dateRange` changes, filters `grupo`/`ruta` client-side and computes ALL its KPIs from the scoped rows (seller/status/visit filters still do not change the KPIs). New second KPI group "Visitas y período" with cards `Visitas vencidas` (subtitle `N sin frecuencia`), `Cumplimiento de visitas` (`—` + "Sin frecuencia asignada" when the rate is null), `Sin compras en el período`, `Clientes nuevos` (subtitle `N patrimonio`). New table columns Ruta ("Sin ruta"), Grupo ("Sin grupo"), Tipo, Visita (`VisitBadge`, sortable, most overdue first). New filters: select `Filtrar por visita` (Todas / Visita vencida / Sin frecuencia) and checkbox `Sin compras en el período`. Export passes the same filters.

- [ ] **Step 1: Write the failing tests**

`app/(app)/analitica/components/__tests__/cartera-filter-bar.test.tsx`:
```tsx
import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClientesFiltersResponse } from '../../types';

const { default: CarteraFilterBar } = await import('../cartera-filter-bar');

const payload: ClientesFiltersResponse = {
  groups: [{ value: 'S1', label: 'Abasto' }, { value: 'S2', label: 'Restaurante' }],
  routes: [{ value: '3', label: 'Ruta 3' }, { value: '4', label: 'Ruta 4' }],
};
const fetchMock = mock<(url: string) => Promise<Response>>(async () => ({ ok: true, json: async () => payload }) as unknown as Response);

beforeEach(() => {
  fetchMock.mockClear();
  fetchMock.mockImplementation(async () => ({ ok: true, json: async () => payload }) as unknown as Response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);

describe('CarteraFilterBar', () => {
  test('loads options once from the filters section and reports the chosen group', async () => {
    const onGrupo = mock((_v: string | null) => {});
    render(<CarteraFilterBar grupo={null} ruta={null} onGrupo={onGrupo} onRuta={() => {}} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toContain('/api/dwh/clientes?section=filters');
    const user = userEvent.setup();
    await user.click(screen.getByRole('textbox', { name: 'Filtrar por grupo' }));
    await user.click(await screen.findByRole('button', { name: 'Abasto' }));
    expect(onGrupo).toHaveBeenCalledWith('S1');
  });

  test('picking a route reports its number as text; "Todas las rutas" clears it', async () => {
    const onRuta = mock((_v: string | null) => {});
    render(<CarteraFilterBar grupo={null} ruta="3" onGrupo={() => {}} onRuta={onRuta} />);
    const user = userEvent.setup();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await user.click(screen.getByRole('textbox', { name: 'Filtrar por ruta' }));
    await user.click(await screen.findByRole('button', { name: 'Ruta 4' }));
    expect(onRuta).toHaveBeenCalledWith('4');
    await user.click(screen.getByRole('textbox', { name: 'Filtrar por ruta' }));
    await user.click(await screen.findByRole('button', { name: 'Todas las rutas' }));
    expect(onRuta).toHaveBeenCalledWith(null);
  });

  test('a failed options request leaves empty selects instead of crashing', async () => {
    fetchMock.mockImplementation(async () => { throw new Error('offline'); });
    render(<CarteraFilterBar grupo={null} ruta={null} onGrupo={() => {}} onRuta={() => {}} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByRole('textbox', { name: 'Filtrar por grupo' })).toBeTruthy();
  });
});
```

Update `app/(app)/analitica/components/__tests__/cobertura-clientes.test.tsx`: (a) add, before the dynamic import, a stub of the badge so the test does not depend on plan B's copy:
```tsx
mock.module('../seguimiento/visuals', () => ({
  VisitBadge: ({ visit }: { visit: { status: string } }) => <span data-testid="visit-badge">{visit.status}</span>,
}));
```
(b) extend `base` with the new fields and give the fixture rows visit data:
```tsx
const noVisit = { status: 'no_interval' as const, daysSinceLastInvoice: null, intervalDays: null, daysOverdue: null };
const base: CoberturaRowView = {
  customerCode: 'X', customerName: 'X', entityName: null, sellerCode: null, sellerName: null,
  lastSaleDateKey: null, entityLastSaleDateKey: null, daysSinceLastSale: null,
  avgMonthlyUsd: null, avgMonthlyUnits: null, monthsWithSales: 0, status: 'never',
  routeNumber: null, groupCode: null, groupName: null, kind: null, visit: noVisit, activeInPeriod: true,
};
```
and replace the `rows` fixture with:
```tsx
const rows: CoberturaRowView[] = [
  { ...base, customerCode: 'C1', customerName: 'Nunca Vendido SA', entityName: 'NUNCA', sellerCode: 'V1', sellerName: 'Ana', status: 'never',
    routeNumber: 3, groupCode: 'S1', groupName: 'Abasto', kind: 'patrimonio', activeInPeriod: false,
    visit: { status: 'no_invoice', daysSinceLastInvoice: null, intervalDays: 7, daysOverdue: null } },
  { ...base, customerCode: 'C2', customerName: 'Tienda Via Matriz', entityName: 'CADENA', sellerCode: 'V2', sellerName: 'Bruno', entityLastSaleDateKey: 20260901, status: 'via_matriz',
    routeNumber: 4, groupCode: 'S2', groupName: 'Restaurante', kind: 'nuevo' },
  { ...base, customerCode: 'C3', customerName: 'Cliente Inactivo Reciente', entityName: 'REC', sellerCode: null, sellerName: null, lastSaleDateKey: 20260710, daysSinceLastSale: 86,
    avgMonthlyUsd: 883.87, avgMonthlyUnits: 181.8, monthsWithSales: 5, status: 'lapsed',
    routeNumber: 3, groupCode: 'S1', groupName: 'Abasto', kind: 'patrimonio', activeInPeriod: false,
    visit: { status: 'overdue', daysSinceLastInvoice: 86, intervalDays: 30, daysOverdue: 56 } },
  { ...base, customerCode: 'C4', customerName: 'Cliente Activo', entityName: 'ACT', sellerCode: 'V1', sellerName: 'Ana', lastSaleDateKey: 20261001, daysSinceLastSale: 3,
    avgMonthlyUsd: 100, avgMonthlyUnits: 10, monthsWithSales: 3, status: 'active',
    routeNumber: 4, groupCode: 'S2', groupName: 'Restaurante', kind: 'nuevo',
    visit: { status: 'ok', daysSinceLastInvoice: 3, intervalDays: 7, daysOverdue: 0 } },
];
```
Add `kindYear: 2026` to `payload`. Then append:
```tsx
describe('CoberturaClientes: cartera additions', () => {
  test('visit KPIs: overdue count with the sin-frecuencia subtitle and the compliance rate', async () => {
    await loaded();
    const section = within(screenSection());
    expect(section.getByText('Visitas vencidas').nextElementSibling!.textContent).toBe('1');
    expect(section.getByText('1 sin frecuencia')).toBeTruthy();                 // only C2 has no frequency; C1 has one but no invoice
    expect(section.getByText('Cumplimiento de visitas').nextElementSibling!.textContent).toBe('50%');
    expect(section.getByText('Sin compras en el período').nextElementSibling!.textContent).toBe('2');
    expect(section.getByText('Clientes nuevos').nextElementSibling!.textContent).toBe('2');
    expect(section.getByText('2 patrimonio')).toBeTruthy();
  });

  test('the visit filter lists only overdue customers, most overdue first', async () => {
    const { user } = await loaded();
    await user.selectOptions(within(screenSection()).getByLabelText('Filtrar por visita'), 'overdue');
    const names = [...screenSection().querySelectorAll('tbody tr')].map(tr => tr.querySelector('td')!.textContent);
    expect(names).toHaveLength(1);
    expect(names[0]).toContain('Cliente Inactivo Reciente');
  });

  test('"Sin frecuencia" filter and the inactive-in-period checkbox narrow the table', async () => {
    const { user } = await loaded();
    await user.selectOptions(within(screenSection()).getByLabelText('Filtrar por visita'), 'no_interval');
    expect(screenSection().querySelectorAll('tbody tr')).toHaveLength(1);
    expect(screenSection().textContent).toContain('Tienda Via Matriz');
    await user.selectOptions(within(screenSection()).getByLabelText('Filtrar por visita'), '');
    await user.click(within(screenSection()).getByLabelText('Sin compras en el período'));
    const names = [...screenSection().querySelectorAll('tbody tr')].map(tr => tr.querySelector('td')!.textContent);
    expect(names.some(n => n!.includes('Nunca Vendido SA'))).toBe(true);
    expect(names.some(n => n!.includes('Cliente Activo'))).toBe(false);
  });

  test('grupo/ruta props scope both the table and the KPIs', async () => {
    render(<CoberturaClientes grupo="S1" ruta={null} />);
    await screen.findByRole('region', { name: 'Cobertura de clientes' });
    expect(screenSection().querySelectorAll('tbody tr')).toHaveLength(2);            // C1 and C3 are S1
    expect(within(screenSection()).getByText('de 2 clientes')).toBeTruthy();
  });

  test('ruta/grupo/tipo cells fall back to "Sin ruta" / "Sin grupo" / "—"', async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ ...payload, rows: [{ ...base, customerCode: 'Z', customerName: 'Zeta' }] }) }) as unknown as Response);
    await loaded();
    const row = screenSection().querySelector('tbody tr')!;
    expect(row.textContent).toContain('Sin ruta');
    expect(row.textContent).toContain('Sin grupo');
  });

  test('nobody has a frequency: the compliance rate reads "—", not 0%', async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ ...payload, rows: rows.map(r => ({ ...r, visit: noVisit })) }) }) as unknown as Response);
    await loaded();
    const section = within(screenSection());
    expect(section.getByText('Visitas vencidas').nextElementSibling!.textContent).toBe('0');
    expect(section.getByText('Cumplimiento de visitas').nextElementSibling!.textContent).toBe('—');
    expect(section.getByText('Sin frecuencia asignada')).toBeTruthy();
  });

  test('dateRange is sent to the API and a change refetches', async () => {
    const { rerender } = render(<CoberturaClientes dateRange="month:2026-10" />);
    await screen.findByRole('region', { name: 'Cobertura de clientes' });
    expect(fetchMock.mock.calls[0][0]).toContain('dateRange=month%3A2026-10');
    rerender(<CoberturaClientes dateRange="month:2026-09" />);
    await waitFor(() => expect(fetchMock.mock.calls.some(c => String(c[0]).includes('month%3A2026-09'))).toBe(true));
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `bun run test:components`
Expected: FAIL in `cartera-filter-bar` (module not found) and in `cobertura-clientes` (new KPIs, filters, props missing).

- [ ] **Step 3: Implement**

`app/(app)/analitica/components/cartera-filter-bar.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import SearchableSelect from '@/lib/components/searchable-select';
import type { ClientesFiltersResponse } from '../types';

export default function CarteraFilterBar({
  grupo, ruta, onGrupo, onRuta,
}: {
  grupo: string | null;
  ruta: string | null;
  onGrupo: (v: string | null) => void;
  onRuta: (v: string | null) => void;
}) {
  const [options, setOptions] = useState<ClientesFiltersResponse>({ groups: [], routes: [] });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/dwh/clientes?section=filters');
        if (cancelled || !res.ok) return;
        const body: ClientesFiltersResponse = await res.json();
        if (!cancelled) setOptions(body);
      } catch {
        // Non-critical: the selects just stay empty.
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex items-center gap-3 flex-wrap bg-white border border-gray-200 rounded-lg p-4 print:hidden">
      <div>
        <h2 className="text-sm font-bold text-gray-900">Grupo y ruta</h2>
        <p className="text-xs text-gray-500 max-w-xl">
          Filtran toda la pestaña por el grupo y la ruta actuales del cliente. En Entidad, las devoluciones se atribuyen a la entidad completa.
        </p>
      </div>
      <div className="w-56">
        <SearchableSelect
          value={grupo}
          onChange={onGrupo}
          options={options.groups}
          allLabel="Todos los grupos"
          placeholder="Grupo…"
          ariaLabel="Filtrar por grupo"
        />
      </div>
      <div className="w-44">
        <SearchableSelect
          value={ruta}
          onChange={onRuta}
          options={options.routes}
          allLabel="Todas las rutas"
          placeholder="Ruta…"
          ariaLabel="Filtrar por ruta"
        />
      </div>
    </div>
  );
}
```

Edits to `app/(app)/analitica/components/cobertura-clientes.tsx` (all in this one file):
1. Imports: add `import { VisitBadge } from './seguimiento/visuals';`, `import { KIND_LABEL, summarizeCartera } from '../lib/cartera';`, `import type { DateRange } from '../types';` (merge with the existing `../types` import).
2. `type SortKey = 'days' | 'customer' | 'seller' | 'usd' | 'units' | 'visit';`
3. Signature: `export default function CoberturaClientes({ dateRange = '12m', grupo = null, ruta = null }: { dateRange?: DateRange; grupo?: string | null; ruta?: number | null })`.
4. State: after `statusFilter` add
```tsx
  const [visitFilter, setVisitFilter] = useState<'overdue' | 'no_interval' | null>(null);
  const [inactiveOnly, setInactiveOnly] = useState<boolean>(false);
```
5. Fetch: `const res = await fetch(`/api/dwh/clientes/cobertura?includeInactive=${includeInactive ? 1 : 0}&dateRange=${encodeURIComponent(dateRange)}`);` and dependency array `[includeInactive, dateRange]`.
6. Replace `const rows = useMemo(() => data?.rows ?? [], [data]);` with
```tsx
  const allRows = useMemo(() => data?.rows ?? [], [data]);
  const rows = useMemo(() => filterCobertura(allRows, { grupo, ruta }), [allRows, grupo, ruta]);
```
and after `const summary = ...` add `const cartera = useMemo(() => summarizeCartera(rows), [rows]);`.
7. In the `sorted` memo: `const filtered = filterCobertura(rows, { sellerCode: sellerFilter, status: statusFilter, visit: visitFilter, inactiveInPeriod: inactiveOnly });`, add `case 'visit': return compareNullLast(a.visit.daysOverdue, b.visit.daysOverdue, sortDir);` and the new deps `visitFilter, inactiveOnly`.
8. `handleExport`: `coberturaExportQuery({ includeInactive, sellerCode: sellerFilter, status: statusFilter, dateRange, grupo, ruta, visit: visitFilter, inactiveInPeriod: inactiveOnly })`.
9. Under the existing `<KpiGroup title="Cobertura" ...>` add:
```tsx
        <KpiGroup title="Visitas y período" tone="customers" columns={4}>
          <KpiCard
            label="Visitas vencidas"
            value={String(cartera.compliance.overdue)}
            tone={cartera.compliance.overdue > 0 ? 'warn' : 'default'}
            subtitle={`${cartera.compliance.noInterval} sin frecuencia`}
            title="Clientes con más días sin comprar que su frecuencia de visita (semanal 7, quincenal 15, mensual 30). Un cliente sin frecuencia asignada nunca figura como vencido."
          />
          <KpiCard
            label="Cumplimiento de visitas"
            value={cartera.compliance.complianceRate === null ? '—' : `${Math.round(cartera.compliance.complianceRate * 100)}%`}
            subtitle={cartera.compliance.complianceRate === null
              ? 'Sin frecuencia asignada'
              : `${cartera.compliance.ok} al día de ${cartera.compliance.ok + cartera.compliance.overdue}`}
          />
          <KpiCard
            label="Sin compras en el período"
            value={String(cartera.inactiveInPeriod)}
            tone={cartera.inactiveInPeriod > 0 ? 'warn' : 'default'}
            subtitle={`de ${cartera.compliance.total} clientes asignados`}
            title="Clientes asignados sin ninguna factura (sin anuladas) en el rango de fechas elegido."
          />
          <KpiCard
            label="Clientes nuevos"
            value={String(cartera.nuevos)}
            subtitle={`${cartera.patrimonio} patrimonio`}
            title="Nuevo: registrado en el año del rango, sin contar el lote migrado en la puesta en marcha. Patrimonio: registrado antes del año o en ese lote."
          />
        </KpiGroup>
```
10. In the filter row add after the status `<select>`:
```tsx
          <select
            className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
            value={visitFilter ?? ''}
            onChange={e => setVisitFilter((e.target.value || null) as 'overdue' | 'no_interval' | null)}
            aria-label="Filtrar por visita"
          >
            <option value="">Todas las visitas</option>
            <option value="overdue">Visita vencida</option>
            <option value="no_interval">Sin frecuencia</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={inactiveOnly} onChange={e => setInactiveOnly(e.target.checked)} />
            Sin compras en el período
          </label>
```
11. Table: after `{sortHeader('seller', 'Vendedor')}` add `<th ...>Ruta</th><th ...>Grupo</th><th ...>Tipo</th>` (same classes as "Entidad"); after the `Estado` header add `{sortHeader('visit', 'Visita')}`. Body cells in the same order:
```tsx
                    <td className="px-3 py-2 text-gray-600">{r.routeNumber === null ? 'Sin ruta' : `Ruta ${r.routeNumber}`}</td>
                    <td className="px-3 py-2 text-gray-600">{r.groupName ?? 'Sin grupo'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.kind === null ? '—' : KIND_LABEL[r.kind]}</td>
                    ... (existing cells) ...
                    <td className="px-3 py-2"><VisitBadge visit={r.visit} /></td>
```
Leave the print layout unchanged.

Edits to `app/(app)/analitica/tabs/tab-clientes.tsx`:
1. `import CarteraFilterBar from '../components/cartera-filter-bar';`
2. `useClientesTrend(dateRange, clienteDimension, grupo, ruta)` and `useClientesChurned(...)` take two more params; after `const params = new URLSearchParams({ dateRange, clienteDimension, section: '...' });` add `if (grupo) params.set('grupo', grupo); if (ruta) params.set('ruta', ruta);` and add `grupo, ruta` to the dependency arrays. Same two lines in the main list loader inside `TabClientes`.
3. In `TabClientes` add `const [grupo, setGrupo] = useState<string | null>(null); const [ruta, setRuta] = useState<string | null>(null);` before the hooks and pass them to both hooks.
4. Keep the filter bar mounted in every state: define
```tsx
  const filterBar = <CarteraFilterBar grupo={grupo} ruta={ruta} onGrupo={setGrupo} onRuta={setRuta} />;
```
and change the three early returns to `return <div className="p-6 space-y-6">{filterBar}<div className="text-sm text-gray-500">Cargando…</div></div>;` (loading), `return <div className="p-6 space-y-6">{filterBar}<p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p></div>;` (error), `return <div className="p-6 space-y-6">{filterBar}<EmptyState /></div>;` (no data). In the final return replace `<CoberturaClientes />` with
```tsx
      {filterBar}
      <CoberturaClientes dateRange={dateRange} grupo={grupo} ruta={ruta === null ? null : Number(ruta)} />
```

Help (`content/help/analitica-definiciones.md`, section "Cobertura de clientes"): replace the sentence "La sección ... **no depende del período seleccionado**, para no perder datos por un filtro de fechas." with "La última venta y los promedios de la sección \"Cobertura de clientes\" no dependen del período seleccionado; solo \"Sin compras en el período\" y \"Clientes nuevos\" usan el rango de fechas." and append bullets:
```markdown
- **Grupo y ruta:** salen de la ficha actual del cliente en Profit Plus (grupo = segmento del cliente; ruta = zona de ruta). Los filtros de arriba de la pestaña aplican a toda la pestaña; en Entidad, las devoluciones se atribuyen a la entidad completa.
- **Visita vencida:** el cliente lleva más días sin comprar que su frecuencia de visita (semanal 7, quincenal 15, mensual 30). Un cliente sin frecuencia asignada muestra "Sin frecuencia" y nunca figura como vencido. El cumplimiento es al día ÷ (al día + vencidas).
- **Sin compras en el período:** clientes asignados (no inactivos) sin ninguna factura, sin anuladas, en el rango de fechas elegido.
- **Tipo:** *Patrimonio* = registrado antes del año del rango o en el lote migrado en la puesta en marcha (28/03/2026); *Nuevo* = registrado en el año del rango, fuera de ese lote. Sin fecha de registro se muestra "—".
```

- [ ] **Step 4: Run to verify they pass**

Run: `bun run test:components` -> PASS.
Run: `bunx tsc --noEmit` and `bun run lint` -> clean (the Task 3 fixture errors are now fixed).
Run: `grep -n "VisitBadge" "app/(app)/analitica/components/seguimiento/visuals.tsx"` -> exactly the export plan B promised.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/analitica/components/cartera-filter-bar.tsx" "app/(app)/analitica/components/cobertura-clientes.tsx" "app/(app)/analitica/tabs/tab-clientes.tsx" "app/(app)/analitica/components/__tests__" content/help/analitica-definiciones.md
git commit -m "feat(clientes): group/route filters, visit compliance, overdue and inactive lists, patrimonio/nuevo" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---
## Task 7: Productos server: category filter, tier badge on the presence table, product x customer-group share matrix

**Files:**
- Create: `lib/productos/group-share.ts`, `lib/productos/queries.ts`
- Modify: `app/api/dwh/productos/route.ts`, `app/(app)/analitica/types.ts` (`ProfundidadLineaRow.tier`, new `ProductosGroupShareResponse`, `ProductosCategoriasResponse`)
- Test: `__tests__/unit/productos/group-share.test.ts`, `app/api/dwh/productos/__tests__/route.filters.test.ts` (mocked pool), extend `scripts/dwh/__tests__/consolidation-queries.test.ts`

**Interfaces:**
- Consumes: `classifyTier`, `DEFAULT_TIER_THRESHOLDS`, `DepthTier` (`lib/dwh/depth-tier.ts`, Task 1); `buildDateWhereClause`, `usdConversionJoin`, `dualAmountExpr`, `jsonWithCache` (`app/api/dwh/lib/query-builder.ts`).
- Produces:
```ts
// lib/productos/group-share.ts
export const NO_GROUP_CODE: string;             // '__sin_grupo__'
export const NO_GROUP_LABEL: string;            // 'Sin grupo'
export interface GroupShareRaw { label: string; groupCode: string | null; groupName: string | null; salesBs: number; salesUsd: number | null }
export interface GroupShareColumn { code: string; name: string; salesBs: number }
export interface GroupShareCell { salesBs: number; salesUsd: number | null; share: number }      // share = cell Bs / row total Bs, 0..1
export interface GroupShareRow { label: string; totalBs: number; totalUsd: number | null; cells: Record<string, GroupShareCell> }   // absent group => key absent
export interface GroupShareMatrix { columns: GroupShareColumn[]; rows: GroupShareRow[] }
export function buildGroupShareMatrix(raw: readonly GroupShareRaw[], maxRows?: number): GroupShareMatrix;   // default 30 rows
// lib/productos/queries.ts
export type ProductosLevel = 'linea' | 'sublinea' | 'sku';
export function parseCategoria(raw: string | null): string | null;            // trimmed, <= 60 chars, else null
export interface GroupShareQueryOptions { dateWhere: string; level: ProductosLevel; linea: string | null; sublinea: string | null; tiendaKey: number | null; categoria: string | null }
export function fetchGroupShare(pool: sql.ConnectionPool, o: GroupShareQueryOptions): Promise<GroupShareRaw[]>;
export function fetchCategorias(pool: sql.ConnectionPool): Promise<string[]>;
// types.ts
//   ProfundidadLineaRow gains  tier: DepthTier
export interface ProductosGroupShareResponse extends GroupShareMatrix { level: 'linea' | 'sublinea' | 'sku' }
export interface ProductosCategoriasResponse { categorias: string[] }
// API
//   GET /api/dwh/productos?...&categoria=Fresco            applies to the drill, section=profundidad, section=porLineaMes, section=grupos
//   GET /api/dwh/productos?section=grupos&groupBy=linea|sublinea|sku&linea=&sublinea=&dateRange=&tienda=&categoria=   -> ProductosGroupShareResponse
//   GET /api/dwh/productos?categorias=1                    -> ProductosCategoriasResponse
```
Rules: the matrix attributes every invoice to the customer's CURRENT group (invoice -> `Dim_Customer c` by key -> `cur` = same `CustomerCode` with `IsCurrent = 1`); customers with no group go to a `Sin grupo` column (always the last column); only positive-Bs rows count so shares of a row sum to 1; a (row, group) pair with no sales is absent, not 0; columns that no kept row uses are dropped; `groupBy=sublinea` without `linea` (or `sku` without `linea`+`sublinea`) falls back to `linea`. The category filter is `p.CategoryName = @categoria` on the sales side and `pr.CategoryName = @categoria` on the drill's returns subqueries; in `section=profundidad` the client/store DENOMINATOR (`activeTotalsQuery`) is NOT narrowed by category (penetration = clients buying the product / all active clients). `tier` = `classifyTier(clientShare, salesGrossBs > 0, DEFAULT_TIER_THRESHOLDS)`.

- [ ] **Step 1: Write the failing tests**

`__tests__/unit/productos/group-share.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import { NO_GROUP_CODE, buildGroupShareMatrix, type GroupShareRaw } from '../../../lib/productos/group-share';

const raw = (label: string, groupCode: string | null, groupName: string | null, salesBs: number, salesUsd: number | null): GroupShareRaw =>
  ({ label, groupCode, groupName, salesBs, salesUsd });

describe('buildGroupShareMatrix', () => {
  const data = [
    raw('Panaderia', 'S1', 'Abasto', 3500, 70),
    raw('Panaderia', 'S2', 'Restaurante', 400, 8),
    raw('Panaderia', null, null, 300, null),
    raw('Pizza', 'S2', 'Restaurante', 700, 14),
    raw('Pizza', 'S1', 'Abasto', -50, -1),      // credit: ignored
    raw('Navidad', 'S1', 'Abasto', 0, 0),        // zero: ignored, the row disappears
  ];
  test('rows by total desc, shares by Bs sum to 1, absent pairs are absent', () => {
    const m = buildGroupShareMatrix(data);
    expect(m.rows.map(r => r.label)).toEqual(['Panaderia', 'Pizza']);
    const pan = m.rows[0];
    expect(pan.totalBs).toBe(4200);
    expect(pan.cells.S1.share).toBeCloseTo(3500 / 4200, 10);
    const sum = Object.values(pan.cells).reduce((s, c) => s + c.share, 0);
    expect(sum).toBeCloseTo(1, 10);
    expect(Object.keys(m.rows[1].cells)).toEqual(['S2']);
    expect(m.rows[1].cells.S2.share).toBe(1);
  });
  test('USD sums ignore null rows and stay null only when every contributing row is null', () => {
    const m = buildGroupShareMatrix(data);
    expect(m.rows[0].totalUsd).toBe(78);
    expect(m.rows[0].cells[NO_GROUP_CODE].salesUsd).toBeNull();
    expect(m.rows[0].cells.S1.salesUsd).toBe(70);
  });
  test('columns: by sales desc, "Sin grupo" always last even when it is the biggest', () => {
    const big = buildGroupShareMatrix([raw('A', null, null, 9000, null), raw('A', 'S1', 'Abasto', 10, 1), raw('A', 'S2', 'Restaurante', 20, 2)]);
    expect(big.columns.map(c => c.name)).toEqual(['Restaurante', 'Abasto', 'Sin grupo']);
  });
  test('maxRows keeps the biggest rows and drops columns only used by dropped rows', () => {
    const m = buildGroupShareMatrix([raw('A', 'S1', 'Abasto', 100, 2), raw('B', 'S2', 'Restaurante', 50, 1)], 1);
    expect(m.rows.map(r => r.label)).toEqual(['A']);
    expect(m.columns.map(c => c.code)).toEqual(['S1']);
  });
  test('a blank group code is treated as no group; duplicate (label, group) rows are merged', () => {
    const m = buildGroupShareMatrix([raw('A', '  ', '  ', 10, null), raw('A', null, null, 5, null)]);
    expect(m.rows[0].cells[NO_GROUP_CODE].salesBs).toBe(15);
  });
  test('nothing positive gives an empty matrix', () => {
    expect(buildGroupShareMatrix([])).toEqual({ columns: [], rows: [] });
    expect(buildGroupShareMatrix([raw('A', 'S1', 'Abasto', -1, null)])).toEqual({ columns: [], rows: [] });
  });
});
```

`app/api/dwh/productos/__tests__/route.filters.test.ts`:
```ts
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';

interface Captured { sql: string; inputs: Record<string, unknown> }
const queries: Captured[] = [];
let respond: (text: string) => unknown[] = () => [];
function makeRequest() {
  const inputs: Record<string, unknown> = {};
  const req = {
    input(name: string, a: unknown, b?: unknown) { inputs[name] = b === undefined ? a : b; return req; },
    async query(text: string) { queries.push({ sql: text, inputs }); return { recordset: respond(text) }; },
  };
  return req;
}
mock.module('@/lib/db/dwh-mssql', () => ({ getDwhPool: async () => ({ request: makeRequest }) }));
mock.module('@/lib/dwh/access', () => ({
  requireDwhAccess: async () => ({ ok: true, session: { sub: '1', role: 'admin', name: 'T' } }),
}));
const { GET } = await import('../route');

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/dwh/productos?${qs}`));
beforeEach(() => { queries.length = 0; respond = () => []; });

describe('GET /api/dwh/productos category filter', () => {
  test('the drill filters sales AND the returns subquery by the bound category', async () => {
    const res = await get('dateRange=month:2026-10&groupBy=linea&categoria=Fresco');
    expect(res.status).toBe(200);
    expect(queries[0].sql).toContain('p.CategoryName = @categoria');
    expect(queries[0].sql).toContain('pr.CategoryName = @categoria');
    expect(queries[0].inputs.categoria).toBe('Fresco');
  });
  test('a hostile category string is only ever a parameter value', async () => {
    const hostile = "Fresco' OR 1=1 --";
    await get(`dateRange=month:2026-10&groupBy=linea&categoria=${encodeURIComponent(hostile)}`);
    expect(queries[0].sql).not.toContain('OR 1=1');
    expect(queries[0].inputs.categoria).toBe(hostile);
  });
  test('an over-long or empty category is ignored', async () => {
    await get(`groupBy=linea&categoria=${'x'.repeat(61)}`);
    expect(queries[0].sql).not.toContain('@categoria');
    queries.length = 0;
    await get('groupBy=linea&categoria=');
    expect(queries[0].sql).not.toContain('@categoria');
  });
  test('sublinea drill keeps linea and category bound together', async () => {
    await get('groupBy=sublinea&linea=Panaderia&categoria=Congelado');
    expect(queries[0].inputs).toMatchObject({ linea: 'Panaderia', categoria: 'Congelado' });
  });
  test('stacked chart and presence table honor the category; the presence denominator does not', async () => {
    respond = text => (text.includes('TotalClients') ? [{ TotalClients: 10, TotalStores: 12 }] : []);
    await get('section=profundidad&categoria=Fresco&dateRange=month:2026-10');
    const rowsQuery = queries.find(q => q.sql.includes('ClientCount'))!;
    const totalsQuery = queries.find(q => q.sql.includes('TotalClients'))!;
    expect(rowsQuery.sql).toContain('p.CategoryName = @categoria');
    expect(totalsQuery.sql).not.toContain('CategoryName');
    queries.length = 0;
    await get('section=porLineaMes&categoria=Fresco&dateRange=month:2026-10');
    expect(queries.every(q => q.sql.includes('p.CategoryName = @categoria'))).toBe(true);
  });
});

describe('GET /api/dwh/productos section=profundidad tier', () => {
  test('rows carry the tier derived from client penetration', async () => {
    respond = text => (text.includes('TotalClients')
      ? [{ TotalClients: 10, TotalStores: 12 }]
      : [
        { Sku: 'Pan Baguette', ClientCount: 8, StoreCount: 9, MonthCount: 1, SalesGrossBs: 1000, SalesGrossUsd: 20, QuantitySold: 100, ReturnsNetBs: 10 },
        { Sku: 'Pizza', ClientCount: 4, StoreCount: 5, MonthCount: 1, SalesGrossBs: 500, SalesGrossUsd: 10, QuantitySold: 50, ReturnsNetBs: 0 },
        { Sku: 'Rara', ClientCount: 1, StoreCount: 1, MonthCount: 1, SalesGrossBs: 50, SalesGrossUsd: null, QuantitySold: 5, ReturnsNetBs: 0 },
      ]);
    const body = await (await get('section=profundidad&dateRange=month:2026-10')).json();
    expect(body.rows.map((r: { sku: string; tier: string }) => [r.sku, r.tier])).toEqual([
      ['Pan Baguette', 'primera'], ['Pizza', 'segunda'], ['Rara', 'addon'],
    ]);
  });
});

describe('GET /api/dwh/productos section=grupos', () => {
  test('returns the share matrix for the drill level and binds category and tienda', async () => {
    respond = () => [
      { Label: 'Panaderia', GroupCode: 'S1', GroupName: 'Abasto', SalesBs: 3500, SalesUsd: 70 },
      { Label: 'Panaderia', GroupCode: null, GroupName: null, SalesBs: 300, SalesUsd: null },
    ];
    const res = await get('section=grupos&groupBy=linea&dateRange=month:2026-10&categoria=Congelado&tienda=7');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.level).toBe('linea');
    expect(body.columns.map((c: { name: string }) => c.name)).toEqual(['Abasto', 'Sin grupo']);
    expect(body.rows[0].cells.S1.share).toBeCloseTo(3500 / 3800, 8);
    expect(queries[0].sql).toContain('cur.IsCurrent = 1');
    expect(queries[0].inputs).toMatchObject({ categoria: 'Congelado', tiendaKey: 7 });
  });
  test('sublinea without linea falls back to the linea level (no @linea in the SQL)', async () => {
    const body = await (await get('section=grupos&groupBy=sublinea&dateRange=month:2026-10')).json();
    expect(body.level).toBe('linea');
    expect(queries[0].sql).not.toContain('@linea');
  });
  test('sku level binds linea and sublinea', async () => {
    await get('section=grupos&groupBy=sku&linea=Panaderia&sublinea=Artesanal&dateRange=month:2026-10');
    expect(queries[0].inputs).toMatchObject({ linea: 'Panaderia', sublinea: 'Artesanal' });
  });
  test('an empty result is an empty matrix, not an error', async () => {
    const body = await (await get('section=grupos&groupBy=linea')).json();
    expect(body).toMatchObject({ columns: [], rows: [], level: 'linea' });
  });
});

describe('GET /api/dwh/productos?categorias=1', () => {
  test('lists the distinct current categories', async () => {
    respond = () => [{ Name: 'Congelado' }, { Name: 'Fresco' }];
    const body = await (await get('categorias=1')).json();
    expect(body).toEqual({ categorias: ['Congelado', 'Fresco'] });
  });
  test('a database error is a 500 with the standard shape', async () => {
    respond = () => { throw new Error('boom'); };
    const res = await get('categorias=1');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Error al consultar el Data Warehouse' });
  });
});
```

Append to `scripts/dwh/__tests__/consolidation-queries.test.ts` (import `{ fetchCategorias, fetchGroupShare }` from `'../../../lib/productos/queries'` and `{ buildGroupShareMatrix }` from `'../../../lib/productos/group-share'`):
```ts
  test('fetchGroupShare: current-group attribution through old SCD2 versions, Sin grupo, voided excluded', async () => {
    const month = buildDateWhereClause('month:2026-10', 'fs');
    const raw = await fetchGroupShare(pool, { dateWhere: month, level: 'linea', linea: null, sublinea: null, tiendaKey: null, categoria: null });
    const m = buildGroupShareMatrix(raw);
    expect(m.rows.map(r => r.label)).toEqual(['Panaderia']);                          // I4 (Pizza) is in September
    expect(m.columns.map(c => c.name)).toEqual(['Abasto', 'Restaurante', 'Sin grupo']);
    const cells = m.rows[0].cells;
    expect(cells.S1.salesBs).toBe(3500);                                              // I1 1000 + I2 500 + I3 2000 (C2's OLD S2 key -> current S1); voided I6 excluded
    expect(cells.S1.salesUsd).toBe(70);
    expect(cells.S2.salesBs).toBe(400);                                               // I7
    expect(cells.__sin_grupo__.salesBs).toBe(300);                                    // I5, C4 has no group
    expect(cells.S1.share).toBeCloseTo(3500 / 4200, 8);
  });

  test('fetchGroupShare: category filter, sub-line and product levels, tienda filter', async () => {
    const month = buildDateWhereClause('month:2026-10', 'fs');
    const base = { dateWhere: month, linea: null, sublinea: null, tiendaKey: null, categoria: null } as const;
    const congelado = buildGroupShareMatrix(await fetchGroupShare(pool, { ...base, level: 'linea', categoria: 'Congelado' }));
    expect(congelado.rows[0].cells.S1.salesBs).toBe(500);                            // only P2
    expect(Object.keys(congelado.rows[0].cells)).toEqual(['S1']);
    const subs = buildGroupShareMatrix(await fetchGroupShare(pool, { ...base, level: 'sublinea', linea: 'Panaderia' }));
    expect(subs.rows.map(r => [r.label, r.totalBs])).toEqual([['Artesanal', 3700], ['Industrial', 500]]);
    const skus = buildGroupShareMatrix(await fetchGroupShare(pool, { ...base, level: 'sku', linea: 'Panaderia', sublinea: 'Artesanal' }));
    expect(skus.rows.map(r => r.label)).toEqual(['Pan Baguette']);
    const c1 = (await pool.request().query(`SELECT CustomerKey FROM dim.Dim_Customer WHERE CustomerCode = 'C1'`)).recordset[0].CustomerKey as number;
    const tienda = buildGroupShareMatrix(await fetchGroupShare(pool, { ...base, level: 'linea', tiendaKey: c1 }));
    expect(tienda.rows[0].totalBs).toBe(1500);
  });

  test('fetchGroupShare: a hostile category is a parameter and simply matches nothing', async () => {
    const month = buildDateWhereClause('month:2026-10', 'fs');
    const raw = await fetchGroupShare(pool, { dateWhere: month, level: 'linea', linea: null, sublinea: null, tiendaKey: null, categoria: "Fresco' OR 1=1 --" });
    expect(raw).toEqual([]);
  });

  test('fetchCategorias: distinct current categories', async () => {
    expect(await fetchCategorias(pool)).toEqual(['Congelado', 'Fresco']);
  });
```
(Sub-line totals: Artesanal = P1 sales I1 1000 + I3 2000 + I5 300 + I7 400 = 3700; Industrial = P2 I2 500.)

- [ ] **Step 2: Run to see them fail**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/productos/group-share.test.ts app/api/dwh/productos`
Expected: FAIL (module not found; `categoria`/`section=grupos` not handled).

- [ ] **Step 3: Implement**

`lib/productos/group-share.ts`:
```ts
// Product x customer-group share matrix (the workbook's "Hoja1"). Pure; the SQL lives in queries.ts.
export const NO_GROUP_CODE = '__sin_grupo__';
export const NO_GROUP_LABEL = 'Sin grupo';
const DEFAULT_MAX_ROWS = 30;

export interface GroupShareRaw { label: string; groupCode: string | null; groupName: string | null; salesBs: number; salesUsd: number | null }
export interface GroupShareColumn { code: string; name: string; salesBs: number }
export interface GroupShareCell { salesBs: number; salesUsd: number | null; share: number }
export interface GroupShareRow { label: string; totalBs: number; totalUsd: number | null; cells: Record<string, GroupShareCell> }
export interface GroupShareMatrix { columns: GroupShareColumn[]; rows: GroupShareRow[] }

const addUsd = (acc: number | null, v: number | null): number | null => (v === null ? acc : (acc ?? 0) + v);

export function buildGroupShareMatrix(raw: readonly GroupShareRaw[], maxRows: number = DEFAULT_MAX_ROWS): GroupShareMatrix {
  interface Acc { label: string; totalBs: number; totalUsd: number | null; cells: Map<string, { bs: number; usd: number | null }> }
  const names = new Map<string, string>();
  const rowMap = new Map<string, Acc>();
  for (const r of raw) {
    if (!(r.salesBs > 0)) continue;
    const trimmed = r.groupCode?.trim();
    const code = trimmed ? trimmed : NO_GROUP_CODE;
    names.set(code, code === NO_GROUP_CODE ? NO_GROUP_LABEL : (r.groupName?.trim() || code));
    const row = rowMap.get(r.label) ?? { label: r.label, totalBs: 0, totalUsd: null, cells: new Map() };
    row.totalBs += r.salesBs;
    row.totalUsd = addUsd(row.totalUsd, r.salesUsd);
    const cell = row.cells.get(code) ?? { bs: 0, usd: null };
    cell.bs += r.salesBs;
    cell.usd = addUsd(cell.usd, r.salesUsd);
    row.cells.set(code, cell);
    rowMap.set(r.label, row);
  }

  const kept = [...rowMap.values()]
    .sort((a, b) => b.totalBs - a.totalBs || a.label.localeCompare(b.label))
    .slice(0, maxRows);

  const columnTotals = new Map<string, number>();
  const rows: GroupShareRow[] = kept.map(row => {
    const cells: Record<string, GroupShareCell> = {};
    for (const [code, c] of row.cells) {
      cells[code] = { salesBs: c.bs, salesUsd: c.usd, share: c.bs / row.totalBs };
      columnTotals.set(code, (columnTotals.get(code) ?? 0) + c.bs);
    }
    return { label: row.label, totalBs: row.totalBs, totalUsd: row.totalUsd, cells };
  });

  const columns: GroupShareColumn[] = [...columnTotals]
    .map(([code, salesBs]) => ({ code, name: names.get(code) ?? code, salesBs }))
    .sort((a, b) =>
      (a.code === NO_GROUP_CODE ? 1 : 0) - (b.code === NO_GROUP_CODE ? 1 : 0)
      || b.salesBs - a.salesBs
      || a.name.localeCompare(b.name));
  return { columns, rows };
}
```

`lib/productos/queries.ts`:
```ts
import sql from 'mssql';
import { dualAmountExpr, usdConversionJoin } from '@/app/api/dwh/lib/query-builder';
import type { GroupShareRaw } from './group-share';

// dateWhere comes from buildDateWhereClause(range, 'fs'); every user-controlled value is bound with .input().
const NO_LINEA = 'Sin línea';
const NO_SUBLINEA = 'Sin sublínea';

export type ProductosLevel = 'linea' | 'sublinea' | 'sku';

export function parseCategoria(raw: string | null): string | null {
  const v = raw?.trim();
  return v && v.length <= 60 ? v : null;
}

export interface GroupShareQueryOptions {
  dateWhere: string;
  level: ProductosLevel;
  linea: string | null;
  sublinea: string | null;
  tiendaKey: number | null;
  categoria: string | null;
}

function labelExpr(level: ProductosLevel): string {
  if (level === 'sku') return 'ISNULL(p.ProductName, p.ProductCode)';
  if (level === 'sublinea') return `ISNULL(p.SubLineName, '${NO_SUBLINEA}')`;
  return `ISNULL(p.LineName, '${NO_LINEA}')`;
}

export async function fetchGroupShare(pool: sql.ConnectionPool, o: GroupShareQueryOptions): Promise<GroupShareRaw[]> {
  if (o.level !== 'linea' && o.linea === null) throw new Error('linea requerida para este nivel');
  if (o.level === 'sku' && o.sublinea === null) throw new Error('sublinea requerida para este nivel');
  const scope = [
    o.level !== 'linea' ? `AND ISNULL(p.LineName, '${NO_LINEA}') = @linea` : '',
    o.level === 'sku' ? `AND ISNULL(p.SubLineName, '${NO_SUBLINEA}') = @sublinea` : '',
    o.tiendaKey !== null ? 'AND fs.CustomerKey = @tiendaKey' : '',
    o.categoria !== null ? 'AND p.CategoryName = @categoria' : '',
  ].join(' ');
  const req = pool.request();
  if (o.level !== 'linea') req.input('linea', o.linea);
  if (o.level === 'sku') req.input('sublinea', o.sublinea);
  if (o.tiendaKey !== null) req.input('tiendaKey', o.tiendaKey);
  if (o.categoria !== null) req.input('categoria', o.categoria);
  const label = labelExpr(o.level);
  const result = await req.query(`
    SELECT ${label} AS Label, RTRIM(cur.ErpSegmentCode) AS GroupCode, sg.SegmentName AS GroupName,
           ${dualAmountExpr('fs', 'NetAmount', 'SalesBs', 'SalesUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_Customer cur ON cur.CustomerCode = c.CustomerCode AND cur.IsCurrent = 1
    LEFT JOIN dim.Dim_Segment sg ON sg.ErpSegmentCode = cur.ErpSegmentCode
    WHERE fs.IsVoided = 0 ${o.dateWhere} ${scope}
    GROUP BY ${label}, RTRIM(cur.ErpSegmentCode), sg.SegmentName
  `);
  return result.recordset.map(r => ({
    label: String(r.Label),
    groupCode: r.GroupCode ? String(r.GroupCode).trim() || null : null,
    groupName: r.GroupName ? String(r.GroupName).trim() : null,
    salesBs: Number(r.SalesBs ?? 0),
    salesUsd: r.SalesUsd === null || r.SalesUsd === undefined ? null : Number(r.SalesUsd),
  }));
}

export async function fetchCategorias(pool: sql.ConnectionPool): Promise<string[]> {
  const result = await pool.request().query(`
    SELECT DISTINCT RTRIM(p.CategoryName) AS Name
    FROM dim.Dim_Product p
    WHERE p.IsCurrent = 1 AND p.CategoryName IS NOT NULL AND LTRIM(RTRIM(p.CategoryName)) <> ''
    ORDER BY Name
  `);
  return result.recordset.map(r => String(r.Name));
}
```

`app/(app)/analitica/types.ts`: add `import type { DepthTier } from '@/lib/dwh/depth-tier'; import type { GroupShareMatrix } from '@/lib/productos/group-share';`, add `tier: DepthTier;` as the last field of `ProfundidadLineaRow` (comment: `// primera/segunda/addon from clientShare vs DEFAULT_TIER_THRESHOLDS`), and
```ts
// Productos tab - product x customer-group share matrix (section=grupos) and the category filter options.
export interface ProductosGroupShareResponse extends GroupShareMatrix { level: 'linea' | 'sublinea' | 'sku' }
export interface ProductosCategoriasResponse { categorias: string[] }
```

`app/api/dwh/productos/route.ts` edits:
1. Imports: add
```ts
import { classifyTier, DEFAULT_TIER_THRESHOLDS } from '@/lib/dwh/depth-tier';
import { buildGroupShareMatrix } from '@/lib/productos/group-share';
import { fetchCategorias, fetchGroupShare, parseCategoria } from '@/lib/productos/queries';
```
and add `ProductosGroupShareResponse, ProductosCategoriasResponse` to the types import.
2. Above `handleProfundidad` add:
```ts
function bindFilters(req: { input(name: string, value: unknown): unknown }, tiendaKey: number | null, categoria: string | null): void {
  if (tiendaKey !== null) req.input('tiendaKey', tiendaKey);
  if (categoria !== null) req.input('categoria', categoria);
}
```
3. Replace `handleProfundidad` with:
```ts
async function handleProfundidad(
  dateWhere: string, returnsDateWhere: string, salesFilterWhere: string, tiendaOnlyWhere: string,
  tiendaKey: number | null, categoria: string | null,
): Promise<NextResponse> {
  const pool = await getDwhPool();
  const returnsTiendaWhere = tiendaKey !== null ? 'AND fr.CustomerKey = @tiendaKey' : '';

  const rowsReq = pool.request();
  bindFilters(rowsReq, tiendaKey, categoria);
  const rowsResult = await rowsReq.query(profundidadLineaQuery(dateWhere, returnsDateWhere, salesFilterWhere, returnsTiendaWhere));

  // Denominator: all clients/stores active in range (category NOT applied).
  const totalsReq = pool.request();
  bindFilters(totalsReq, tiendaKey, null);
  const totalsResult = await totalsReq.query(activeTotalsQuery(dateWhere, tiendaOnlyWhere));
  const totalClients = Number(totalsResult.recordset[0]?.TotalClients ?? 0);
  const totalStores = Number(totalsResult.recordset[0]?.TotalStores ?? 0);

  const rows: ProfundidadLineaRow[] = rowsResult.recordset.map(r => {
    const clientCount = Number(r.ClientCount);
    const storeCount = Number(r.StoreCount);
    const monthCount = Number(r.MonthCount) || 1;
    const salesGrossBs = Number(r.SalesGrossBs);
    const salesGrossUsd = r.SalesGrossUsd === null ? null : Number(r.SalesGrossUsd);
    const quantitySold = Number(r.QuantitySold);
    const returnsNetBs = Number(r.ReturnsNetBs);
    const clientShare = totalClients > 0 ? clientCount / totalClients : null;

    return {
      sku: String(r.Sku),
      clientCount,
      clientShare,
      storeCount,
      storeShare: totalStores > 0 ? storeCount / totalStores : null,
      avgMonthlyPrice: quantitySold > 0
        ? { bs: salesGrossBs / quantitySold, usd: salesGrossUsd === null ? null : salesGrossUsd / quantitySold }
        : { bs: 0, usd: 0 },
      avgMonthlyUnits: quantitySold / monthCount,
      returnRate: salesGrossBs > 0 ? returnsNetBs / salesGrossBs : null,
      tier: classifyTier(clientShare, salesGrossBs > 0, DEFAULT_TIER_THRESHOLDS),
    };
  });

  const response: ProfundidadLineaResponse = { rows };
  return jsonWithCache(response);
}
```
4. `handlePorLineaMes(dateWhere, tiendaWhere, tiendaKey, trend)` -> `handlePorLineaMes(dateWhere, salesFilterWhere, tiendaKey, categoria, trend)`: rename the second parameter's uses (`topLineasQuery(dateWhere, salesFilterWhere)`, `unitsByLineaMonthQuery(dateWhere, salesFilterWhere, trend)`) and replace both `if (tiendaKey !== null) topReq.input(...)` / `monthReq.input(...)` lines by `bindFilters(topReq, tiendaKey, categoria);` / `bindFilters(monthReq, tiendaKey, categoria);`.
5. Add `handleGrupos` above `GET`:
```ts
async function handleGrupos(
  dateRange: string, level: 'linea' | 'sublinea' | 'sku', linea: string | null, sublinea: string | null,
  tiendaKey: number | null, categoria: string | null,
): Promise<NextResponse> {
  const pool = await getDwhPool();
  const raw = await fetchGroupShare(pool, {
    dateWhere: buildDateWhereClause(dateRange, 'fs'), level, linea, sublinea, tiendaKey, categoria,
  });
  const response: ProductosGroupShareResponse = { ...buildGroupShareMatrix(raw), level };
  return jsonWithCache(response);
}
```
6. Replace the whole `GET` function with:
```ts
export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const groupByParam = searchParams.get('groupBy');
  const lineaParam = searchParams.get('linea');
  const sublineaParam = searchParams.get('sublinea');
  const tiendaParam = searchParams.get('tienda');
  const tiendaKey = tiendaParam && /^\d+$/.test(tiendaParam) ? Number(tiendaParam) : null;
  const categoria = parseCategoria(searchParams.get('categoria'));

  if (searchParams.get('tiendas') === '1') {
    try {
      const pool = await getDwhPool();
      const result = await pool.request().query(tiendasQuery());
      return jsonWithCache({
        tiendas: result.recordset.map(r => ({ value: String(r.CustomerKey), label: r.CustomerName })),
      });
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  if (searchParams.get('categorias') === '1') {
    try {
      const pool = await getDwhPool();
      const response: ProductosCategoriasResponse = { categorias: await fetchCategorias(pool) };
      return jsonWithCache(response);
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  // Fall back to a shallower level if the params needed to scope a deeper
  // drill are missing (e.g. a stale/hand-built URL) rather than erroring.
  let groupBy: ProductosGroupBy = isProductosGroupBy(groupByParam) ? groupByParam : 'linea';
  if (groupBy === 'sublinea' && !lineaParam) groupBy = 'linea';
  if (groupBy === 'sku' && (!lineaParam || !sublineaParam)) groupBy = 'linea';

  const tiendaOnlyWhere = tiendaKey !== null ? 'AND fs.CustomerKey = @tiendaKey' : '';
  const salesFilterWhere = `${tiendaOnlyWhere} ${categoria !== null ? 'AND p.CategoryName = @categoria' : ''}`;

  const section = searchParams.get('section');
  if (section === 'profundidad' || section === 'porLineaMes') {
    try {
      const dateWhere = buildDateWhereClause(dateRange, 'fs');
      // Profundidad's standalone Tasa dev. keeps the devolución-date basis
      // (labelled in the UI); the drill-down table above uses factura date.
      const returnsDateWhere = buildDateWhereClause(dateRange, 'fr');
      return section === 'profundidad'
        ? await handleProfundidad(dateWhere, returnsDateWhere, salesFilterWhere, tiendaOnlyWhere, tiendaKey, categoria)
        : await handlePorLineaMes(dateWhere, salesFilterWhere, tiendaKey, categoria, parseTrendBucket(searchParams, dateRange));
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  if (section === 'grupos') {
    try {
      return await handleGrupos(dateRange, groupBy, lineaParam, sublineaParam, tiendaKey, categoria);
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  try {
    const pool = await getDwhPool();

    const dateWhere = buildDateWhereClause(dateRange, 'fs');
    const drillReturnsDateWhere = buildReturnsDateWhereClause(dateRange, 'fr', 'factura');
    const returnsTiendaWhere = `${tiendaKey !== null ? 'AND fr.CustomerKey = @tiendaKey' : ''} ${categoria !== null ? 'AND pr.CategoryName = @categoria' : ''}`;

    let recordset: Record<string, unknown>[];
    const breadcrumb: ProductosResponse['breadcrumb'] = [{ label: 'Líneas', groupBy: 'linea' }];

    if (groupBy === 'sku') {
      const req = pool.request().input('linea', lineaParam).input('sublinea', sublineaParam);
      bindFilters(req, tiendaKey, categoria);
      const result = await req.query(skuQuery(dateWhere, salesFilterWhere, drillReturnsDateWhere, returnsTiendaWhere));
      recordset = result.recordset;
      breadcrumb.push({ label: lineaParam as string, groupBy: 'sublinea' });
      breadcrumb.push({ label: sublineaParam as string, groupBy: 'sku' });
    } else if (groupBy === 'sublinea') {
      const req = pool.request().input('linea', lineaParam);
      bindFilters(req, tiendaKey, categoria);
      const result = await req.query(sublineaQuery(dateWhere, salesFilterWhere, drillReturnsDateWhere, returnsTiendaWhere));
      recordset = result.recordset;
      breadcrumb.push({ label: lineaParam as string, groupBy: 'sublinea' });
    } else {
      const req = pool.request();
      bindFilters(req, tiendaKey, categoria);
      const result = await req.query(lineaQuery(dateWhere, salesFilterWhere, drillReturnsDateWhere, returnsTiendaWhere));
      recordset = result.recordset;
    }

    // ... the existing totalSalesGross / rows / response block from "const totalSalesGross = ..." to the end stays
    // exactly as it is today (unchanged) ...
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
```
For step 6 keep the existing mapping block between the `recordset` assignment and the closing `catch` verbatim (from `const totalSalesGross = recordset.reduce(...)` through `return jsonWithCache(response);`); only the lines above change. (The comment placeholder in the snippet marks where that unchanged block goes; do not leave the comment in the file.)

- [ ] **Step 4: Run to verify they pass**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/productos app/api/dwh/productos` -> PASS (existing auth tests included).
Run: `bun test --isolate --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/consolidation-queries.test.ts` -> PASS.
Run: `bunx tsc --noEmit` -> only errors, if any, in `tab-productos.tsx` (it constructs no `ProfundidadLineaRow`, so none expected).

- [ ] **Step 5: Commit**

```bash
git add lib/productos app/api/dwh/productos "app/(app)/analitica/types.ts" __tests__/unit/productos scripts/dwh/__tests__/consolidation-queries.test.ts
git commit -m "feat(productos): category filter, tier on presence table, product x customer-group share matrix" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 8: Productos UI: category select, group-share matrix, presence table with tiers

**Files:**
- Create: `app/(app)/analitica/components/productos/group-share-matrix.tsx`, `app/(app)/analitica/components/productos/depth-table.tsx`
- Modify: `app/(app)/analitica/tabs/tab-productos.tsx`, `content/help/analitica-definiciones.md`
- Test: `app/(app)/analitica/components/productos/__tests__/group-share-matrix.test.tsx`, `app/(app)/analitica/components/productos/__tests__/depth-table.test.tsx`

**Interfaces:**
- Consumes: `GroupShareMatrix` (`@/lib/productos/group-share`), `ProductosGroupShareResponse`, `ProfundidadLineaRow`, `Currency`, `moneyLabel`.
- Produces:
```tsx
export function GroupShareMatrixTable(props: { matrix: GroupShareMatrix; currency: Currency; rowHeader: string }): JSX.Element;   // table aria-label "Participación por grupo de cliente"
export function DepthTable(props: { rows: ProfundidadLineaRow[]; currency: Currency }): JSX.Element;                              // table aria-label "Presencia por producto"
```
`GroupShareMatrixTable`: header = `rowHeader`, one column per group, `Total`; cell text = share as whole percent (`83%`), `title` = money of that cell in the selected currency; an absent cell is "—"; empty matrix renders "Sin datos disponibles todavía."; heat = inline `backgroundColor: rgba(37, 99, 235, share * 0.5)`. `DepthTable`: columns Producto, Clientes (`N (P%)`), Tiendas, Clasificación (badge Primera línea / Segunda línea / Addon / Sin ventas), Precio prom./mes, Unidades prom./mes, Tasa dev.

- [ ] **Step 1: Write the failing tests**

`app/(app)/analitica/components/productos/__tests__/group-share-matrix.test.tsx`:
```tsx
import { screen } from '../../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, within } from '@testing-library/react';
import { GroupShareMatrixTable } from '../group-share-matrix';
import type { GroupShareMatrix } from '@/lib/productos/group-share';

afterEach(cleanup);

const matrix: GroupShareMatrix = {
  columns: [
    { code: 'S1', name: 'Abasto', salesBs: 3500 },
    { code: 'S2', name: 'Restaurante', salesBs: 700 },
    { code: '__sin_grupo__', name: 'Sin grupo', salesBs: 300 },
  ],
  rows: [
    { label: 'Panaderia', totalBs: 4200, totalUsd: 84, cells: {
      S1: { salesBs: 3500, salesUsd: 70, share: 3500 / 4200 },
      S2: { salesBs: 400, salesUsd: 8, share: 400 / 4200 },
      __sin_grupo__: { salesBs: 300, salesUsd: null, share: 300 / 4200 },
    } },
    { label: 'Pizza', totalBs: 700, totalUsd: 14, cells: { S2: { salesBs: 700, salesUsd: 14, share: 1 } } },
  ],
};

describe('GroupShareMatrixTable', () => {
  test('renders the row header, one column per group and Total', () => {
    render(<GroupShareMatrixTable matrix={matrix} currency="bs" rowHeader="Línea" />);
    const table = screen.getByRole('table', { name: 'Participación por grupo de cliente' });
    const headers = within(table).getAllByRole('columnheader').map(h => h.textContent);
    expect(headers).toEqual(['Línea', 'Abasto', 'Restaurante', 'Sin grupo', 'Total']);
  });
  test('cells show whole-percent shares; an absent pair is "—", never 0%', () => {
    render(<GroupShareMatrixTable matrix={matrix} currency="bs" rowHeader="Línea" />);
    const rows = screen.getAllByRole('row').slice(1);
    const pizza = within(rows[1]).getAllByRole('cell').map(c => c.textContent);
    expect(pizza).toEqual(['Pizza', '—', '100%', '—', 'Bs. 700']);
    const pan = within(rows[0]).getAllByRole('cell').map(c => c.textContent);
    expect(pan.slice(0, 4)).toEqual(['Panaderia', '83%', '10%', '7%']);
  });
  test('the cell tooltip carries the amount in the selected currency; null USD reads "—"', () => {
    const { rerender } = render(<GroupShareMatrixTable matrix={matrix} currency="usd" rowHeader="Línea" />);
    expect(screen.getByTitle('$70')).toBeTruthy();
    expect(screen.getByTitle('—')).toBeTruthy();         // Sin grupo has no USD
    rerender(<GroupShareMatrixTable matrix={matrix} currency="bs" rowHeader="Línea" />);
    expect(screen.getByTitle(/^Bs\. 3\.?500$/)).toBeTruthy();       // es-VE may or may not group 4-digit numbers
  });
  test('an empty matrix shows the empty state, no table', () => {
    render(<GroupShareMatrixTable matrix={{ columns: [], rows: [] }} currency="bs" rowHeader="Línea" />);
    expect(screen.getByText('Sin datos disponibles todavía.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
```

`app/(app)/analitica/components/productos/__tests__/depth-table.test.tsx`:
```tsx
import { screen } from '../../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, within } from '@testing-library/react';
import { DepthTable } from '../depth-table';
import type { ProfundidadLineaRow } from '../../../types';

afterEach(cleanup);

const row = (over: Partial<ProfundidadLineaRow>): ProfundidadLineaRow => ({
  sku: 'Pan Baguette', clientCount: 8, clientShare: 0.8, storeCount: 9, storeShare: 0.75,
  avgMonthlyPrice: { bs: 50, usd: 1 }, avgMonthlyUnits: 100, returnRate: 0.01, tier: 'primera', ...over,
});

describe('DepthTable', () => {
  test('shows presence, tier badge and rates per product', () => {
    render(<DepthTable currency="usd" rows={[row({}), row({ sku: 'Rara', tier: 'addon', clientShare: 0.1, clientCount: 1, returnRate: null })]} />);
    const rows = within(screen.getByRole('table', { name: 'Presencia por producto' })).getAllByRole('row').slice(1);
    const first = within(rows[0]).getAllByRole('cell').map(c => c.textContent);
    expect(first[0]).toBe('Pan Baguette');
    expect(first[1]).toContain('8');
    expect(first[1]).toContain('80.0%');
    expect(first[3]).toBe('Primera línea');
    expect(first[4]).toBe('$1');
    const second = within(rows[1]).getAllByRole('cell').map(c => c.textContent);
    expect(second[3]).toBe('Addon');
    expect(second[6]).toBe('—');                                 // null return rate
  });
  test('sin-ventas and segunda labels', () => {
    render(<DepthTable currency="bs" rows={[row({ tier: 'segunda' }), row({ sku: 'X', tier: 'sin-ventas' })]} />);
    expect(screen.getByText('Segunda línea')).toBeTruthy();
    expect(screen.getByText('Sin ventas')).toBeTruthy();
  });
  test('no rows renders the empty state', () => {
    render(<DepthTable currency="bs" rows={[]} />);
    expect(screen.getByText('Sin datos disponibles todavía.')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `bun run test:components`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`app/(app)/analitica/components/productos/group-share-matrix.tsx`:
```tsx
'use client';

import { moneyLabel } from '../../lib/format';
import type { Currency } from '../../types';
import type { GroupShareMatrix } from '@/lib/productos/group-share';

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function GroupShareMatrixTable({ matrix, currency, rowHeader }: { matrix: GroupShareMatrix; currency: Currency; rowHeader: string }) {
  if (matrix.rows.length === 0) {
    return <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">Sin datos disponibles todavía.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm" aria-label="Participación por grupo de cliente">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">{rowHeader}</th>
            {matrix.columns.map(c => (
              <th key={c.code} className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">{c.name}</th>
            ))}
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {matrix.rows.map(row => (
            <tr key={row.label}>
              <td className="px-3 py-2 text-gray-800">{row.label}</td>
              {matrix.columns.map(c => {
                const cell = row.cells[c.code];
                if (!cell) return <td key={c.code} className="px-3 py-2 text-right text-gray-400">—</td>;
                return (
                  <td
                    key={c.code}
                    className="px-3 py-2 text-right text-gray-900"
                    style={{ backgroundColor: `rgba(37, 99, 235, ${(cell.share * 0.5).toFixed(2)})` }}
                    title={moneyLabel({ bs: cell.salesBs, usd: cell.salesUsd }, currency)}
                  >
                    {pct(cell.share)}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right font-medium text-gray-900">
                {moneyLabel({ bs: row.totalBs, usd: row.totalUsd }, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`app/(app)/analitica/components/productos/depth-table.tsx`:
```tsx
'use client';

import { moneyLabel } from '../../lib/format';
import type { Currency, ProfundidadLineaRow } from '../../types';
import type { DepthTier } from '@/lib/dwh/depth-tier';

const TIER_LABEL: Record<DepthTier, string> = {
  primera: 'Primera línea',
  segunda: 'Segunda línea',
  addon: 'Addon',
  'sin-ventas': 'Sin ventas',
};
const TIER_CLASS: Record<DepthTier, string> = {
  primera: 'bg-green-100 text-green-800',
  segunda: 'bg-blue-100 text-blue-800',
  addon: 'bg-gray-100 text-gray-600',
  'sin-ventas': 'bg-gray-50 text-gray-400',
};

function pct(n: number | null): string {
  return n === null ? '—' : `${(n * 100).toFixed(1)}%`;
}
function qty(n: number): string {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(n);
}

export function DepthTable({ rows, currency }: { rows: ProfundidadLineaRow[]; currency: Currency }) {
  if (rows.length === 0) {
    return <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">Sin datos disponibles todavía.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm" aria-label="Presencia por producto">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Producto</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Clientes</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Tiendas</th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase" title="Primera línea: lo compra al menos el 70% de los clientes activos; segunda línea: al menos el 30%.">Clasificación</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Precio prom./mes</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Unidades prom./mes</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Tasa dev.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={`${row.sku}-${i}`} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
              <td className="px-3 py-2 text-gray-800">{row.sku}</td>
              <td className="px-3 py-2 text-right text-gray-600">
                {qty(row.clientCount)} <span className="text-gray-400">({pct(row.clientShare)})</span>
              </td>
              <td className="px-3 py-2 text-right text-gray-600">
                {qty(row.storeCount)} <span className="text-gray-400">({pct(row.storeShare)})</span>
              </td>
              <td className="px-3 py-2 text-center">
                <span className={`inline-block px-2 py-0.5 rounded text-xs ${TIER_CLASS[row.tier]}`}>{TIER_LABEL[row.tier]}</span>
              </td>
              <td className="px-3 py-2 text-right text-gray-600">{moneyLabel(row.avgMonthlyPrice, currency)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{qty(row.avgMonthlyUnits)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{pct(row.returnRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```
(The DepthTable test's cell index 4 is "Precio prom./mes" => `$1`, index 6 is "Tasa dev."; index 3 is the badge.)

Edits to `app/(app)/analitica/tabs/tab-productos.tsx`:
1. Imports: add `import { GroupShareMatrixTable } from '../components/productos/group-share-matrix'; import { DepthTable } from '../components/productos/depth-table';` and add `ProductosCategoriasResponse, ProductosGroupShareResponse` to the `../types` import.
2. After the `tiendas` state add:
```tsx
  const [categoria, setCategoria] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [grupoData, setGrupoData] = useState<ProductosGroupShareResponse | null>(null);
  const [grupoLoading, setGrupoLoading] = useState<boolean>(true);
  const [grupoError, setGrupoError] = useState<string | null>(null);
```
3. After the `loadTiendas` effect add:
```tsx
  useEffect(() => {
    let cancelled = false;
    async function loadCategorias() {
      try {
        const res = await fetch('/api/dwh/productos?categorias=1');
        if (cancelled || !res.ok) return;
        const body: ProductosCategoriasResponse = await res.json().catch(() => ({ categorias: [] }));
        if (!cancelled) setCategorias(body.categorias ?? []);
      } catch {
        // Non-critical: the filter just stays empty.
      }
    }
    loadCategorias();
    return () => { cancelled = true; };
  }, []);
```
4. In the three existing data effects, after `if (tienda) params.set('tienda', tienda);` add `if (categoria) params.set('categoria', categoria);` and add `categoria` to each dependency array (`[dateRange, groupBy, linea, sublinea, tienda, categoria]`, `[dateRange, tienda, categoria]`, `[dateRange, granularity, tienda, categoria]`).
5. After those effects add the matrix loader (follows the drill state so the matrix always matches the table above it):
```tsx
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setGrupoError(null);
      setGrupoLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, section: 'grupos', groupBy });
        if (groupBy !== 'linea' && linea) params.set('linea', linea);
        if (groupBy === 'sku' && sublinea) params.set('sublinea', sublinea);
        if (tienda) params.set('tienda', tienda);
        if (categoria) params.set('categoria', categoria);
        const res = await fetch(`/api/dwh/productos?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setGrupoError(body.error ?? 'Error desconocido');
          return;
        }
        setGrupoData(await res.json());
      } catch {
        if (!cancelled) setGrupoError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setGrupoLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [dateRange, groupBy, linea, sublinea, tienda, categoria]);
```
6. In the drill card header replace the single `<label>` for Tienda with a wrapper holding both filters:
```tsx
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Categoría:
              <select
                aria-label="Filtrar por categoría"
                className="border border-gray-200 rounded px-2 py-1 text-sm"
                value={categoria ?? ''}
                onChange={e => setCategoria(e.target.value || null)}
              >
                <option value="">Todas</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {/* existing Tienda <label> with SearchableSelect, unchanged */}
          </div>
```
7. Insert, right after the drill card (`id="productos-drilldown-section"`) and before the "Unidades vendidas por mes" ChartCard:
```tsx
      <ChartCard
        title="Participación por grupo de cliente"
        subtitle="Qué parte de las ventas brutas de cada fila va a cada grupo de cliente (grupo actual del cliente en Profit Plus) — sigue el nivel y los filtros de la tabla de arriba"
      >
        {grupoLoading ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
        ) : grupoError ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{grupoError}</p>
        ) : (
          <GroupShareMatrixTable
            matrix={grupoData ?? { columns: [], rows: [] }}
            currency={currency}
            rowHeader={COLUMN_LABEL[groupBy]}
          />
        )}
      </ChartCard>
```
8. Replace the whole "Profundidad de Línea" card at the bottom (the `<div className="bg-white ...">` with the `<h2>Profundidad de Línea</h2>` and its table) with:
```tsx
      <ChartCard
        title="Presencia y profundidad por producto"
        subtitle="Top 15 productos por ventas brutas — clientes y tiendas que lo compran (y su % de los activos), clasificación por penetración de clientes, precio y unidades promedio mensuales, tasa de devolución (devoluciones por fecha de devolución ÷ ventas brutas)"
      >
        {profundidadLoading ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
        ) : profundidadError ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{profundidadError}</p>
        ) : (
          <DepthTable rows={profundidadData?.rows ?? []} currency={currency} />
        )}
      </ChartCard>
```
Remove imports/locals that become unused (`ProfundidadLineaResponse` is still used by state; `moneyLabel`, `pct`, `qty` are still used by the drill table). `bun run lint` flags anything left over.

Help (`content/help/analitica-definiciones.md`): add a new section before "## Cobertura de clientes":
```markdown
## Productos

La pestaña **Productos** baja de **línea** a **sublínea** (Artesanal / Industrial) y de ahí a **producto**. La **categoría** (Fresco / Congelado) es un filtro, no un nivel: al elegirla, todas las tablas y gráficos de la pestaña se limitan a esa categoría.

- **Participación por grupo de cliente:** para cada fila del nivel actual, el porcentaje de sus ventas brutas (sin IVA) que va a cada grupo de cliente. Cada venta se asigna al grupo **actual** del cliente; los clientes sin grupo aparecen en "Sin grupo". Un "—" significa que ese grupo no compró esa fila. Pasar el cursor sobre una celda muestra el monto.
- **Presencia y profundidad por producto:** clientes y tiendas que compraron el producto y su porcentaje sobre los clientes y tiendas activos del período (la categoría no reduce ese denominador). *Primera línea* = lo compra el 70% o más de los clientes activos; *Segunda línea* = 30% o más; *Addon* = menos. La tasa de devolución usa la fecha de la devolución.
```

- [ ] **Step 4: Run to verify they pass**

Run: `bun run test:components` -> PASS.
Run: `bunx tsc --noEmit` and `bun run lint` -> clean.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/analitica/components/productos" "app/(app)/analitica/tabs/tab-productos.tsx" content/help/analitica-definiciones.md
git commit -m "feat(productos): category filter, customer-group share matrix and tiered presence table" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 9: Resumen month-pace strip

**Files:**
- Create: `app/(app)/analitica/components/resumen-pace.tsx`
- Modify: `app/(app)/analitica/tabs/tab-resumen.tsx` (the three early returns and the final return)
- Test: `app/(app)/analitica/components/__tests__/resumen-pace.test.tsx`

**Interfaces:**
- Consumes: `resolveReferenceMonth(dateRange: string, today: string): ReferenceMonth`, `monthPace(month: string, asOf: string): MonthPace` (`@/lib/seguimiento/month-pace`, plan B); `MonthPaceStrip(props: { pace: MonthPace })` (`./seguimiento/visuals`, plan B).
- Produces: `export function ResumenPace(props: { dateRange: DateRange; today?: string }): JSX.Element` (`today` is `YYYY-MM-DD`, defaults to the UTC date; it exists for tests). The strip is rendered in EVERY Resumen state (loading, error, empty, data) because it depends only on the date range, not on the API.

- [ ] **Step 1: Write the failing test**

`app/(app)/analitica/components/__tests__/resumen-pace.test.tsx`:
```tsx
import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';

// Decouple from the strip's copy (plan B owns it): expose the props the strip receives.
mock.module('../seguimiento/visuals', () => ({
  MonthPaceStrip: ({ pace }: { pace: unknown }) => <pre data-testid="pace">{JSON.stringify(pace)}</pre>,
}));
const { ResumenPace } = await import('../resumen-pace');

afterEach(cleanup);
const pace = () => JSON.parse(screen.getByTestId('pace').textContent!);

describe('ResumenPace', () => {
  test('a month range paces that month as of today', () => {
    render(<ResumenPace dateRange="month:2026-10" today="2026-10-14" />);
    expect(pace()).toMatchObject({ month: '2026-10', asOf: '2026-10-14', workingDaysInMonth: 22, workingDaysElapsed: 10 });
  });
  test('a closed past month is fully elapsed', () => {
    render(<ResumenPace dateRange="month:2026-09" today="2026-10-14" />);
    expect(pace()).toMatchObject({ month: '2026-09', asOf: '2026-09-30', workingDaysElapsed: 22, workingDaysInMonth: 22, fractionElapsed: 1 });
  });
  test('trailing windows use the current month', () => {
    render(<ResumenPace dateRange="30d" today="2026-10-14" />);
    expect(pace()).toMatchObject({ month: '2026-10', workingDaysElapsed: 10 });
  });
  test('a future month has nothing elapsed (0, not NaN)', () => {
    render(<ResumenPace dateRange="month:2027-01" today="2026-10-14" />);
    expect(pace()).toMatchObject({ month: '2027-01', workingDaysElapsed: 0, fractionElapsed: 0 });
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `bun run test:components`
Expected: FAIL (`resumen-pace` not found).

- [ ] **Step 3: Implement**

`app/(app)/analitica/components/resumen-pace.tsx`:
```tsx
'use client';

import { monthPace, resolveReferenceMonth } from '@/lib/seguimiento/month-pace';
import { MonthPaceStrip } from './seguimiento/visuals';
import type { DateRange } from '../types';

// Same reference-month rule as Seguimiento (resolveReferenceMonth): the month the selected range ends in,
// as of the earliest of today / range end / month end. Weekends-only working days (spec, "Working days").
export function ResumenPace({ dateRange, today }: { dateRange: DateRange; today?: string }) {
  const ref = resolveReferenceMonth(dateRange, today ?? new Date().toISOString().slice(0, 10));
  return <MonthPaceStrip pace={monthPace(ref.month, ref.asOf)} />;
}
```

In `tab-resumen.tsx`: add `import { ResumenPace } from '../components/resumen-pace';`; after the `useEffect` and before `if (loading)` add `const pace = <ResumenPace dateRange={dateRange} />;`; replace the three early returns with
```tsx
  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {pace}
        <div className="text-sm text-gray-500">Cargando…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-3">
        {pace}
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 space-y-3">
        {pace}
        <EmptyState />
      </div>
    );
  }
```
and in the final return put `{pace}` immediately after the `<p className="text-xs text-gray-500">Período: ...</p>` paragraph. Add a help bullet in `content/help/analitica-definiciones.md` under "## Ventas brutas" (or a new "## Ritmo del mes" section): `**Ritmo del mes** (Resumen): días laborables transcurridos del mes de referencia (el mes en que termina el rango elegido) y el porcentaje del mes. Solo se excluyen sábados y domingos; los feriados no se consideran.`

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test:components` -> PASS. Run: `bunx tsc --noEmit` and `bun run lint` -> clean.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/analitica/components/resumen-pace.tsx" "app/(app)/analitica/components/__tests__/resumen-pace.test.tsx" "app/(app)/analitica/tabs/tab-resumen.tsx" content/help/analitica-definiciones.md
git commit -m "feat(resumen): month-pace strip" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 10: Histórico 2025 limited to 2025

**Files:**
- Create: `lib/dwh/historico-window.ts`, `app/(app)/analitica/components/historico-banner.tsx`
- Modify: `app/api/dwh/historico/route.ts` (the two window constants, ~lines 31 and 39, and the comment above them), `app/(app)/analitica/tabs/tab-historico.tsx` (remove the local `DisclaimerBanner`, ~lines 39-60; comment ~line 91), `app/(app)/analitica/analitica-client.tsx` (comment ~line 59-61), `app/(app)/analitica/types.ts` (comment ~line 201), `content/help/analitica-definiciones.md` (the "Histórico 2025" sentence)
- Test: `__tests__/unit/dwh/historico-window.test.ts`, `app/api/dwh/historico/__tests__/route.window.test.ts` (mocked pool), `app/(app)/analitica/components/__tests__/historico-banner.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces:
```ts
// lib/dwh/historico-window.ts
export const HISTORICO_FROM_KEY: 20250101;
export const HISTORICO_TO_KEY: 20251231;
export const HISTORICO_SALES_WINDOW: string;     // 'AND fsl.DateKey BETWEEN 20250101 AND 20251231'
export const HISTORICO_RETURNS_WINDOW: string;   // 'AND frl.OriginalInvoiceDateKey BETWEEN 20250101 AND 20251231'
// components/historico-banner.tsx
export function HistoricoBanner(): JSX.Element;
```
Rules: the SAME window applies to every sales and returns query of the route (monthly, cliente, linea, linea->producto breakdown, KPIs sales and returns). The legacy import script and tables are untouched (Jan-Feb 2026 stay stored, shown nowhere). The tab label stays `Histórico 2025`.

- [ ] **Step 1: Write the failing tests**

`__tests__/unit/dwh/historico-window.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import {
  HISTORICO_FROM_KEY, HISTORICO_RETURNS_WINDOW, HISTORICO_SALES_WINDOW, HISTORICO_TO_KEY,
} from '../../../lib/dwh/historico-window';

describe('Histórico window', () => {
  test('is exactly calendar 2025', () => {
    expect(HISTORICO_FROM_KEY).toBe(20250101);
    expect(HISTORICO_TO_KEY).toBe(20251231);
  });
  test('sales and returns use the same bounds on their own date columns', () => {
    expect(HISTORICO_SALES_WINDOW).toBe('AND fsl.DateKey BETWEEN 20250101 AND 20251231');
    expect(HISTORICO_RETURNS_WINDOW).toBe('AND frl.OriginalInvoiceDateKey BETWEEN 20250101 AND 20251231');
  });
});
```

`app/api/dwh/historico/__tests__/route.window.test.ts`:
```ts
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';

const queries: string[] = [];
let respond: (text: string) => unknown[] = () => [];
function makeRequest() {
  const req = {
    input() { return req; },
    async query(text: string) { queries.push(text); return { recordset: respond(text) }; },
  };
  return req;
}
mock.module('@/lib/db/dwh-mssql', () => ({ getDwhPool: async () => ({ request: makeRequest }) }));
mock.module('@/lib/dwh/access', () => ({
  requireDwhAccess: async () => ({ ok: true, session: { sub: '1', role: 'admin', name: 'T' } }),
}));
const { GET } = await import('../route');

beforeEach(() => {
  queries.length = 0;
  // Only the two ungrouped KPI queries need a row; every grouped query (monthly, cliente, linea, breakdown) may be empty.
  respond = text => (text.includes('ActiveClients')
    ? [{ SalesGrossBs: 0, SalesGrossUsd: 0, UnitsSold: 0, ActiveClients: 0, InvoiceCount: 0 }]
    : text.includes('AS ReturnsBs') && !text.includes('GROUP BY') ? [{ ReturnsBs: 0, ReturnsUsd: 0 }] : []);
});

async function everyLegacyQueryIsWindowed(qs: string) {
  const res = await GET(new NextRequest(`http://localhost/api/dwh/historico?${qs}`));
  expect(res.status).toBe(200);
  const legacy = queries.filter(q => q.includes('_Legacy'));
  expect(legacy.length).toBeGreaterThan(0);
  for (const q of legacy) {
    expect(q).toContain('20250101 AND 20251231');
    expect(q).not.toContain('20260228');
  }
  return legacy;
}

describe('GET /api/dwh/historico window', () => {
  test('monthly view windows sales and the correlated returns subqueries to 2025', async () => {
    const legacy = await everyLegacyQueryIsWindowed('groupBy=mes');
    expect(legacy[0]).toContain('fsl.DateKey BETWEEN 20250101 AND 20251231');
    expect(legacy[0]).toContain('frl.OriginalInvoiceDateKey BETWEEN 20250101 AND 20251231');
  });
  test('kpis window sales and returns to 2025', async () => {
    const legacy = await everyLegacyQueryIsWindowed('section=kpis');
    expect(legacy).toHaveLength(2);
  });
  test('linea, cliente (with month) and the producto breakdown stay inside 2025', async () => {
    await everyLegacyQueryIsWindowed('groupBy=linea');
    queries.length = 0;
    await everyLegacyQueryIsWindowed('groupBy=cliente&month=2025-06');
    queries.length = 0;
    await everyLegacyQueryIsWindowed('groupBy=linea&breakdownBy=producto&parentValue=L1');
  });
});
```

`app/(app)/analitica/components/__tests__/historico-banner.test.tsx`:
```tsx
import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { HistoricoBanner } from '../historico-banner';

afterEach(cleanup);

describe('HistoricoBanner', () => {
  test('states the 2025 window and that Jan-Feb 2026 of the old system are not shown', () => {
    render(<HistoricoBanner />);
    expect(screen.getByText('Datos del sistema anterior (enero – diciembre 2025)')).toBeTruthy();
    expect(screen.getByText(/enero y febrero de 2026 del sistema anterior no se muestran/)).toBeTruthy();
    expect(screen.queryByText(/enero 2025 – febrero 2026/)).toBeNull();
  });
  test('keeps the returns-by-original-invoice explanation', () => {
    render(<HistoricoBanner />);
    expect(screen.getByText(/fecha de la factura/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/dwh/historico-window.test.ts app/api/dwh/historico` and `bun run test:components`
Expected: FAIL (module not found / window still ends 20260228).

- [ ] **Step 3: Implement**

`lib/dwh/historico-window.ts`:
```ts
// Histórico 2025 shows calendar 2025 only. fact.Fact_Sales_Legacy / Fact_Returns_Legacy still hold Jan 2025 -
// Feb 2026 (scripts/dwh-legacy-2025-import.ts is unchanged); Jan-Feb 2026 are simply not shown anywhere.
export const HISTORICO_FROM_KEY = 20250101 as const;
export const HISTORICO_TO_KEY = 20251231 as const;

export const HISTORICO_SALES_WINDOW = `AND fsl.DateKey BETWEEN ${HISTORICO_FROM_KEY} AND ${HISTORICO_TO_KEY}`;
// Returns are windowed by the ORIGINAL factura's date (OriginalInvoiceDateKey), like the rest of Analítica.
export const HISTORICO_RETURNS_WINDOW = `AND frl.OriginalInvoiceDateKey BETWEEN ${HISTORICO_FROM_KEY} AND ${HISTORICO_TO_KEY}`;
```

`app/api/dwh/historico/route.ts`: add `import { HISTORICO_RETURNS_WINDOW, HISTORICO_SALES_WINDOW } from '@/lib/dwh/historico-window';` and replace the two constants with
```ts
const DATE_WINDOW = HISTORICO_SALES_WINDOW;
```
```ts
const RETURNS_DATE_WINDOW = HISTORICO_RETURNS_WINDOW;
```
(keep the explanatory comments; change any sentence that says the window ends in February 2026 to "calendar 2025").

`app/(app)/analitica/components/historico-banner.tsx`:
```tsx
export function HistoricoBanner() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
      <p className="font-semibold mb-1">Datos del sistema anterior (enero – diciembre 2025)</p>
      <p>
        Estos datos provienen del sistema anterior a la migración de marzo de 2026.
        Los clientes, productos y vendedores de este período son identidades
        independientes de los datos actuales — no se pueden cruzar ni sumar con
        las cifras de 2026 en adelante. Esta pestaña solo muestra el año 2025: enero y febrero de 2026 del sistema anterior no se muestran.
      </p>
      <p className="mt-2">
        Ventas brutas sin IVA y antes de devoluciones. Las devoluciones se restan por <strong>fecha de la factura
        original</strong>, igual que en el resto de Analítica (una devolución sin factura identificable se
        cuenta en su propia fecha). Las devoluciones de facturas anteriores a enero 2025 no se incluyen.
      </p>
    </div>
  );
}
```
In `tab-historico.tsx` delete the local `function DisclaimerBanner() { ... }`, add `import { HistoricoBanner } from '../components/historico-banner';` and render `<HistoricoBanner />` where `<DisclaimerBanner />` was; change the comment "(Jan 2025-Feb 2026)" to "(calendar 2025)". Update the comments in `analitica-client.tsx` ("fixed Jan 2025-Feb 2026 window" -> "fixed calendar-2025 window") and `types.ts` ("a fixed, closed Jan 2025-Feb 2026 window imported" -> "a fixed 2025 window of the imported legacy snapshot"). Help: in `content/help/analitica-definiciones.md` change the sentence to "La pestaña **Histórico 2025** muestra solo el año 2025 del sistema anterior y sigue la misma regla (devoluciones por fecha de la factura original); las devoluciones de facturas anteriores a enero 2025 quedan fuera de esa pestaña, y enero y febrero de 2026 del sistema anterior no se muestran en ninguna."

- [ ] **Step 4: Run to verify they pass**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/dwh/historico-window.test.ts app/api/dwh/historico scripts/dwh/__tests__/legacy-2025-import-date-window.test.ts` and `bun run test:components` -> PASS (the import-window test must still pass: the import is intentionally unchanged).
Run: `grep -rn "20260228" app lib | grep -v worktrees` -> no output. Run: `bunx tsc --noEmit` and `bun run lint` -> clean.

- [ ] **Step 5: Commit**

```bash
git add lib/dwh/historico-window.ts app/api/dwh/historico "app/(app)/analitica/components/historico-banner.tsx" "app/(app)/analitica/components/__tests__/historico-banner.test.tsx" "app/(app)/analitica/tabs/tab-historico.tsx" "app/(app)/analitica/analitica-client.tsx" "app/(app)/analitica/types.ts" content/help/analitica-definiciones.md __tests__/unit/dwh/historico-window.test.ts
git commit -m "feat(historico): limit the window to 2025 in sales and returns queries" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 11: e2e for the new behavior (default suite with mocks + `@mssql`)

**Files:**
- Create: `e2e/analitica-consolidation.spec.ts`
- Test: itself

**Interfaces:**
- Consumes: `adminPage` fixture (`e2e/fixtures.ts`); UI strings from Tasks 6, 8, 9, 10; `Día laborable N de M` from plan B's `MonthPaceStrip` (the same regex plan B's `e2e/seguimiento.spec.ts` asserts - confirm in that file before running).
- Produces: describes `analitica consolidation (mocked API)` (default suite) and `analitica consolidation @mssql`. Later tasks (12-15) append fallback and tab-list tests to this file.

- [ ] **Step 1: Write the spec**

`e2e/analitica-consolidation.spec.ts`:
```ts
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

// Default suite (no DWH): every /api/dwh/* call is mocked with page.route. /analitica is gated by
// hasDwhAccess; only the admin role bypasses it, so use adminPage. Real-data coverage is the @mssql
// describe at the bottom (needs the migrated + loaded DWH; `bun run e2e:mssql`).

const DWH_ERROR = { error: 'Error al consultar el Data Warehouse' };

async function failAllDwh(page: Page) {
  await page.route(/\/api\/dwh\//, route => route.fulfill({ status: 500, json: DWH_ERROR }));
}

const noVisit = { status: 'no_interval', daysSinceLastInvoice: 3, intervalDays: null, daysOverdue: null };
const row = (over: Record<string, unknown>) => ({
  customerCode: 'X', customerName: 'X', entityName: null, sellerCode: 'V1', sellerName: 'Ana',
  lastSaleDateKey: 20261012, entityLastSaleDateKey: null, daysSinceLastSale: 3, avgMonthlyUsd: 100, avgMonthlyUnits: 10,
  monthsWithSales: 3, status: 'active', routeNumber: 3, groupCode: 'S1', groupName: 'Abasto', kind: 'patrimonio',
  visit: noVisit, activeInPeriod: true, ...over,
});
const COBERTURA = {
  rows: [
    row({ customerCode: 'C1', customerName: 'Cliente Uno', visit: { status: 'overdue', daysSinceLastInvoice: 20, intervalDays: 7, daysOverdue: 13 }, daysSinceLastSale: 20 }),
    row({ customerCode: 'C2', customerName: 'Cliente Dos', routeNumber: 4, groupCode: 'S2', groupName: 'Restaurante', kind: 'nuevo' }),
    row({ customerCode: 'C3', customerName: 'Cliente Tres', activeInPeriod: false, visit: { status: 'ok', daysSinceLastInvoice: 3, intervalDays: 7, daysOverdue: 0 } }),
  ],
  asOfDateKey: 20261015, windowStartDateKey: 20251101, lapsedAfterDays: 30, kindYear: 2026,
};

async function mockClientes(page: Page) {
  const seen: string[] = [];
  await page.route(/\/api\/dwh\/clientes\/cobertura/, route => route.fulfill({ json: COBERTURA }));
  await page.route(/\/api\/dwh\/clientes\?/, route => {
    const url = new URL(route.request().url());
    seen.push(url.search);
    const section = url.searchParams.get('section');
    if (section === 'filters') {
      return route.fulfill({ json: { groups: [{ value: 'S1', label: 'Abasto' }, { value: 'S2', label: 'Restaurante' }], routes: [{ value: '3', label: 'Ruta 3' }, { value: '4', label: 'Ruta 4' }] } });
    }
    if (section === 'trend') return route.fulfill({ json: { rows: [] } });
    if (section === 'churned') return route.fulfill({ json: { rows: [], available: true } });
    return route.fulfill({ json: { rows: [{ name: 'Cliente Uno', salesGross: { bs: 100, usd: 2 }, returnsNet: { bs: 0, usd: 0 }, salesNet: { bs: 100, usd: 2 }, returnRate: 0, pareto: 'A' }], paretoThresholds: { a: 0.2, b: 0.5 } } });
  });
  return seen;
}

const PROFUNDIDAD = { rows: [{ sku: 'Pan Baguette', clientCount: 8, clientShare: 0.8, storeCount: 9, storeShare: 0.75, avgMonthlyPrice: { bs: 50, usd: 1 }, avgMonthlyUnits: 100, returnRate: 0.01, tier: 'primera' }] };
const GRUPOS = {
  level: 'linea',
  columns: [{ code: 'S1', name: 'Abasto', salesBs: 3500 }, { code: 'S2', name: 'Restaurante', salesBs: 400 }, { code: '__sin_grupo__', name: 'Sin grupo', salesBs: 300 }],
  rows: [{ label: 'Panaderia', totalBs: 4200, totalUsd: 84, cells: {
    S1: { salesBs: 3500, salesUsd: 70, share: 3500 / 4200 }, S2: { salesBs: 400, salesUsd: 8, share: 400 / 4200 }, __sin_grupo__: { salesBs: 300, salesUsd: null, share: 300 / 4200 },
  } }],
};

async function mockProductos(page: Page) {
  const seen: string[] = [];
  await page.route(/\/api\/dwh\/productos(\?|$)/, route => {
    const url = new URL(route.request().url());
    seen.push(url.search);
    const p = url.searchParams;
    if (p.get('tiendas') === '1') return route.fulfill({ json: { tiendas: [] } });
    if (p.get('categorias') === '1') return route.fulfill({ json: { categorias: ['Congelado', 'Fresco'] } });
    if (p.get('section') === 'profundidad') return route.fulfill({ json: PROFUNDIDAD });
    if (p.get('section') === 'porLineaMes') return route.fulfill({ json: { rows: [], lineas: [], trendMode: 'month' } });
    if (p.get('section') === 'grupos') return route.fulfill({ json: GRUPOS });
    return route.fulfill({ json: {
      rows: [{ sku: '', linea: 'Panaderia', sublinea: '', rotacion: 1200, salesShare: 1, salesGross: { bs: 1000, usd: 20 }, returns: { bs: 0, usd: 0 }, salesNet: { bs: 1000, usd: 20 }, margin: null }],
      groupBy: 'linea', breadcrumb: [{ label: 'Líneas', groupBy: 'linea' }],
    } });
  });
  return seen;
}

test.describe('analitica consolidation (mocked API)', () => {
  test('Resumen shows the month-pace strip even while the API fails', async ({ adminPage }) => {
    await failAllDwh(adminPage);
    await adminPage.goto('/analitica');
    await expect(adminPage.getByText(/Día laborable \d+ de \d+/)).toBeVisible({ timeout: 15_000 });
  });

  test('Clientes: visit KPIs, overdue and inactive-in-period lists, "Sin frecuencia" instead of overdue', async ({ adminPage }) => {
    await mockClientes(adminPage);
    await adminPage.goto('/analitica?tab=clientes');
    const section = adminPage.getByRole('region', { name: 'Cobertura de clientes' });
    await expect(section).toBeVisible({ timeout: 15_000 });
    await expect(section.getByText('Visitas vencidas')).toBeVisible();
    await expect(section.getByText('1 sin frecuencia')).toBeVisible();              // Cliente Dos has no frequency
    await section.getByLabel('Filtrar por visita').selectOption('overdue');
    await expect(section.locator('tbody tr')).toHaveCount(1);
    await expect(section.locator('tbody tr').first()).toContainText('Cliente Uno');
    await section.getByLabel('Filtrar por visita').selectOption('no_interval');
    await expect(section.locator('tbody tr').first()).toContainText('Cliente Dos');
    await section.getByLabel('Filtrar por visita').selectOption('');
    await section.getByLabel('Sin compras en el período').check();
    await expect(section.locator('tbody tr')).toHaveCount(1);
    await expect(section.locator('tbody tr').first()).toContainText('Cliente Tres');
  });

  test('Clientes: the group filter narrows the cobertura table and is sent to the API', async ({ adminPage }) => {
    const seen = await mockClientes(adminPage);
    await adminPage.goto('/analitica?tab=clientes');
    const section = adminPage.getByRole('region', { name: 'Cobertura de clientes' });
    await expect(section.locator('tbody tr')).toHaveCount(3, { timeout: 15_000 });
    await adminPage.getByRole('textbox', { name: 'Filtrar por grupo' }).click();
    await adminPage.getByRole('button', { name: 'Restaurante' }).click();
    await expect(section.locator('tbody tr')).toHaveCount(1);
    await expect(section.locator('tbody tr').first()).toContainText('Cliente Dos');
    await expect.poll(() => seen.some(s => s.includes('grupo=S2'))).toBe(true);
    await adminPage.getByRole('textbox', { name: 'Filtrar por ruta' }).click();
    await adminPage.getByRole('button', { name: 'Ruta 3' }).click();
    await expect.poll(() => seen.some(s => s.includes('grupo=S2') && s.includes('ruta=3'))).toBe(true);
    await expect(section.getByText('Ningún cliente coincide con los filtros.')).toBeVisible();
  });

  test('Productos: category filter reaches every request; matrix and tier badge render', async ({ adminPage }) => {
    const seen = await mockProductos(adminPage);
    await adminPage.goto('/analitica?tab=productos');
    await expect(adminPage.getByRole('table', { name: 'Participación por grupo de cliente' })).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByRole('columnheader', { name: 'Abasto' })).toBeVisible();
    await expect(adminPage.getByRole('columnheader', { name: 'Sin grupo' })).toBeVisible();
    await expect(adminPage.getByRole('cell', { name: '83%' })).toBeVisible();
    await expect(adminPage.getByText('Primera línea')).toBeVisible();
    await adminPage.getByLabel('Filtrar por categoría').selectOption('Fresco');
    await expect.poll(() => seen.some(s => s.includes('section=grupos') && s.includes('categoria=Fresco'))).toBe(true);
    await expect.poll(() => seen.some(s => s.includes('section=profundidad') && s.includes('categoria=Fresco'))).toBe(true);
    await expect.poll(() => seen.some(s => !s.includes('section=') && s.includes('categoria=Fresco'))).toBe(true);
  });

  test('Productos: drilling into a line re-scopes the matrix to sub-lines', async ({ adminPage }) => {
    const seen = await mockProductos(adminPage);
    await adminPage.goto('/analitica?tab=productos');
    await expect(adminPage.locator('#productos-drilldown-section')).toBeVisible({ timeout: 15_000 });
    await adminPage.locator('#productos-drilldown-section').getByText('Panaderia').click();
    await expect.poll(() => seen.some(s => s.includes('section=grupos') && s.includes('groupBy=sublinea') && s.includes('linea=Panaderia'))).toBe(true);
  });

  test('Histórico states the 2025 window', async ({ adminPage }) => {
    await failAllDwh(adminPage);
    await adminPage.goto('/analitica?tab=historico');
    await expect(adminPage.getByText('Datos del sistema anterior (enero – diciembre 2025)')).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText(/enero 2025 – febrero 2026/)).toHaveCount(0);
    await expect(adminPage.getByRole('navigation', { name: 'Tabs' }).getByRole('button', { name: 'Histórico 2025' })).toBeVisible();
  });
});

// @mssql: needs the migrated + loaded DWH (plan A's migration 0040 applied). Excluded from default CI.
test.describe('analitica consolidation @mssql', () => {
  test('Resumen shows the month pace', async ({ adminPage }) => {
    await adminPage.goto('/analitica');
    await expect(adminPage.getByText(/Día laborable \d+ de \d+/)).toBeVisible({ timeout: 30_000 });
  });

  test('Clientes shows the group/route filters and the visit KPIs on real data', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=clientes');
    await expect(adminPage.getByRole('textbox', { name: 'Filtrar por grupo' })).toBeVisible({ timeout: 30_000 });
    await expect(adminPage.getByRole('textbox', { name: 'Filtrar por ruta' })).toBeVisible();
    await expect(adminPage.getByText('Cumplimiento de visitas')).toBeVisible({ timeout: 30_000 });
  });

  test('Productos shows the category filter and the group matrix on real data', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=productos');
    await expect(adminPage.getByLabel('Filtrar por categoría')).toBeVisible({ timeout: 30_000 });
    await expect(adminPage.getByRole('table', { name: 'Participación por grupo de cliente' })).toBeVisible({ timeout: 30_000 });
    await adminPage.getByLabel('Filtrar por categoría').selectOption({ index: 1 });
    await expect(adminPage.getByRole('table', { name: 'Participación por grupo de cliente' })).toBeVisible({ timeout: 30_000 });
  });

  test('Histórico loads and only shows months of 2025', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=historico');
    await expect(adminPage.getByText('Datos del sistema anterior (enero – diciembre 2025)')).toBeVisible({ timeout: 30_000 });
    await expect(adminPage.getByText(/Ene 26|Feb 26/)).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run to verify**

Run:
```bash
SQLITE_PATH=./e2e/.tmp bun run e2e:seed
bun run e2e -- e2e/analitica-consolidation.spec.ts
```
Expected: the 6 `analitica consolidation (mocked API)` tests PASS; the `@mssql` describe is excluded by `--grep-invert @mssql`. (First run builds the app: `next build`, up to ~3 minutes.) If the pace-strip regex fails, open plan B's `components/seguimiento/visuals.tsx` `MonthPaceStrip` and use its actual text (plan B's own e2e asserts `Día laborable 10 de 22`). If `getByRole('cell', { name: '83%' })` is ambiguous, scope it to the matrix table. Where the real DWH exists: `bun run e2e:mssql -- e2e/analitica-consolidation.spec.ts`.

- [ ] **Step 3: Commit**

```bash
git add e2e/analitica-consolidation.spec.ts
git commit -m "test(e2e): analitica consolidation (mocked default suite + @mssql)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---
## Task 12: Remove the Vendedores tab

Seguimiento (plan B) replaces it: same consignment exclusion (footnote + excluded-invoice list), seller drill-down via `SellerProfile`, quota editing via `QuotaEditor`. Its equivalent e2e coverage already exists in `e2e/seguimiento.spec.ts` (consignment footnote, "← Volver a Seguimiento").

**Files:**
- Delete: `app/(app)/analitica/tabs/tab-vendedores.tsx`; `app/api/dwh/vendedores/route.ts`, `app/api/dwh/vendedores/__tests__/route.test.ts` (and the now-empty directory; plan B moved `consignment.ts` + its test to `app/api/dwh/lib/` - confirm with `ls app/api/dwh/vendedores` before deleting; if `consignment.ts` is still there, STOP: plan B Task 6 did not run); `e2e/vendedores-consignment.spec.ts`, `e2e/vendedores-seller-profile.spec.ts`
- Modify: `app/(app)/analitica/lib/tab-keys.ts`, `app/(app)/analitica/analitica-client.tsx`, `app/(app)/analitica/tabs/seller-profile.tsx` (default `backLabel`, one sentence), `app/(app)/analitica/tabs/tab-resumen.tsx` (subtitle at ~line 309), `app/(app)/analitica/types.ts`, `e2e/analitica.spec.ts`, `e2e/analitica-consolidation.spec.ts`, `content/help/analitica-definiciones.md`, comments in `tab-ventas.tsx`, `tab-finanzas.tsx`, `lib/db/schema.ts`, `app/api/dwh/vendedor-360/route.ts`
- Test: `app/(app)/analitica/tabs/__tests__/seller-profile.test.tsx`, extend `app/(app)/analitica/lib/__tests__/tab-keys.test.ts`, extend `e2e/analitica-consolidation.spec.ts`

**References found by grep at plan time** (command: `grep -rIn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=worktrees --exclude-dir=specs --exclude-dir=plans "dwh/vendedores\|tab-vendedores\|tab=vendedores\|Vendedores\(Row\|Response\|Excluded\)\|Volver a Vendedores\|pestaña Vendedores\|Vendedores tab" .`):
`analitica-client.tsx` (import + registry), `tab-ventas.tsx:151` and `tab-finanzas.tsx:34` (comments "same pattern as tab-vendedores.tsx"), `seller-profile.tsx:261,271` ("← Volver a Vendedores") and `:349` ("igual que la pestaña Vendedores"), `tab-resumen.tsx:309` ("la pestaña Vendedores la excluye"), `types.ts` (`VendedoresRow`, `VendedoresResponse`, `VendedoresExcludedInvoice`, `VendedoresExcludedResponse`, comments at ~335, ~358, ~589), `lib/db/schema.ts:92`, `vendedor-360/route.ts` (comments ~45, ~48, ~371), `e2e/analitica.spec.ts` (header comment line 12; test "expanding a Vendedores row loads a product breakdown", lines 86-100; comments at ~148 and ~158), `content/help/analitica-definiciones.md` ("## Vendedores y consignación"), `docs/` (history, handled in Task 17). `migrations/dwh/0032_*.sql` mentions the route in a comment: migrations are immutable, leave it. No PostHog event names the tab (`analytics_tab_viewed` is generic: `grep -rn "vendedores" "app/(app)/analitica/analitica-client.tsx" components lib | grep -i posthog` returns nothing).

**Interfaces:**
- Consumes: `resolveActiveTab`, `TAB_KEYS` (Task 2); `SellerProfile` with optional `backLabel` (plan B Task 7).
- Produces: `SellerProfile`'s default `backLabel` is `'Seguimiento'`; `?tab=vendedores` resolves to `resumen`.

- [ ] **Step 1: Write the failing tests**

Append to `app/(app)/analitica/lib/__tests__/tab-keys.test.ts`:
```ts
describe('retired tab: vendedores', () => {
  test('is no longer a tab and an old link opens the default tab', () => {
    expect(TAB_KEYS).not.toContain('vendedores' as never);
    expect(resolveActiveTab('vendedores')).toBe('resumen');
  });
});
```

`app/(app)/analitica/tabs/__tests__/seller-profile.test.tsx` (first read how `seller-profile.tsx` renders its error branch; the error branch renders the back button, so no data fixture is needed):
```tsx
import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

mock.module('posthog-js', () => ({ default: { capture: () => {} } }));
const { default: SellerProfile } = await import('../seller-profile');

beforeEach(() => {
  globalThis.fetch = (async () => ({ ok: false, json: async () => ({ error: 'Fallo de prueba' }) })) as unknown as typeof fetch;
});
afterEach(cleanup);

describe('SellerProfile back link', () => {
  test('defaults to "← Volver a Seguimiento" (the Vendedores tab no longer exists) and calls onBack', async () => {
    const onBack = mock(() => {});
    render(<SellerProfile salesRepKey="1" dateRange="month:2026-10" currency="usd" onBack={onBack} />);
    const back = await screen.findByText('← Volver a Seguimiento');
    await userEvent.setup().click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Volver a Vendedores/)).toBeNull();
  });
  test('an explicit backLabel still wins', async () => {
    render(<SellerProfile salesRepKey="1" dateRange="month:2026-10" currency="usd" onBack={() => {}} backLabel="Otra pestaña" />);
    expect(await screen.findByText('← Volver a Otra pestaña')).toBeTruthy();
  });
});
```
Append to `e2e/analitica-consolidation.spec.ts` (inside a new `test.describe('retired tabs (mocked API)', ...)` block that later tasks extend; the helper is shared):
```ts
async function expectFallsBackToResumen(page: Page, key: string, retiredLabel: string) {
  await failAllDwh(page);
  await page.goto(`/analitica?tab=${key}`);
  const tabs = page.getByRole('navigation', { name: 'Tabs' });
  await expect(tabs.getByRole('button', { name: 'Resumen' })).toHaveClass(/border-blue-600/, { timeout: 15_000 });
  await expect(tabs.getByRole('button', { name: retiredLabel })).toHaveCount(0);
  await expect(page.getByText(/Tab not found/)).toHaveCount(0);
}

test.describe('retired tabs (mocked API)', () => {
  test('?tab=vendedores opens Resumen and the tab is gone from the bar', async ({ adminPage }) => {
    await expectFallsBackToResumen(adminPage, 'vendedores', 'Vendedores');
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `bun test --isolate --env-file=.env.local "app/(app)/analitica/lib/__tests__/tab-keys.test.ts"` and `bun run test:components`
Expected: FAIL (`vendedores` still in `TAB_KEYS`; default back label is "Vendedores").

- [ ] **Step 3: Implement**

1. `tab-keys.ts`: remove `'vendedores'` from `TAB_KEYS` and `vendedores: 'Vendedores'` from `TAB_LABELS`. `analitica-client.tsx`: remove `import TabVendedores ...` and `vendedores: TabVendedores,` from `TAB_COMPONENTS`. (`tsc` now fails until the other edits are done.)
2. `seller-profile.tsx`: `grep -n "backLabel" "app/(app)/analitica/tabs/seller-profile.tsx"`; change the prop default from `'Vendedores'` to `'Seguimiento'`, and the sentence at ~349 "excluida la facturación de consignación — igual que la pestaña Vendedores." to "... — igual que la pestaña Seguimiento.". If a leftover hard-coded "← Volver a Vendedores" remains (plan B should have parameterised both buttons), use `← Volver a {backLabel}` in both.
3. `tab-resumen.tsx`: in the "Desempeño por vendedor" `ChartCard` subtitle replace "(la pestaña Vendedores la excluye)" with "(la pestaña Seguimiento la excluye)".
4. Delete the files listed above (`git rm`).
5. `types.ts`: delete `VendedoresRow`, `VendedoresResponse`, `VendedoresExcludedInvoice`, `VendedoresExcludedResponse` and their leading comments; reword the other comments that say "Vendedores tab" (~589, the `SellerCoverageRow` block) to "Vendedor 360 profile". `lib/db/schema.ts` comment at ~92: "(reached from the Vendedores tab)" -> "(reached from the Seguimiento tab)". `vendedor-360/route.ts` comments at ~45-48 and ~371: "Vendedores tab" -> "Seguimiento tab". `tab-ventas.tsx:151` and `tab-finanzas.tsx:34`: replace "same pattern as tab-vendedores.tsx" with "same pattern the retired Vendedores tab used".
6. `e2e/analitica.spec.ts`: delete the test `expanding a Vendedores row loads a product breakdown` (lines ~86-100), in the header comment change "Devoluciones, Vendedores, Clientes, CxC" to "Devoluciones, Clientes, CxC", and reword the two later comments "...as Vendedores" / "Vendedores product-breakdown test above" to "as the Ventas tab" / "the Ventas product-breakdown test".
7. `content/help/analitica-definiciones.md`: replace the section "## Vendedores y consignación" with
```markdown
## Seguimiento y consignación

La pestaña **Seguimiento** y el perfil del vendedor excluyen las facturas emitidas a la raíz de una cadena con patrón de consignación, porque no se puede saber qué vendedor generó esa venta. El monto excluido aparece aparte (nota al pie con la lista de facturas). **Resumen** sí incluye esas facturas, así que su total por vendedor es mayor.
```
and in plan B's "## Seguimiento" section change "(que se lista aparte, igual que antes en Vendedores)" to "(que se lista aparte, igual que en el perfil del vendedor)".

- [ ] **Step 4: Run to verify they pass**

Run each; all must be clean:
```bash
bun test --isolate --env-file=.env.local "app/(app)/analitica/lib/__tests__/tab-keys.test.ts"
bun run test:components
bunx tsc --noEmit
bun run lint
grep -rIn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=worktrees --exclude-dir=specs --exclude-dir=plans --exclude-dir=docs --exclude=tsconfig.tsbuildinfo "dwh/vendedores\|tab-vendedores\|TabVendedores\|VendedoresRow\|VendedoresResponse\|VendedoresExcluded\|Volver a Vendedores" . | grep -v "migrations/"
```
Expected: tests/tsc/lint pass; grep prints nothing. Then `bun run e2e -- e2e/analitica-consolidation.spec.ts e2e/seguimiento.spec.ts` -> PASS (the new fallback test included).

- [ ] **Step 5: Commit**

```bash
git add -A "app/(app)/analitica" app/api/dwh/vendedores app/api/dwh/vendedor-360 e2e content/help lib/db/schema.ts
git commit -m "refactor(analitica): remove the Vendedores tab (replaced by Seguimiento)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
(Review `git status` first: `git add -A` must only touch the paths listed above.)

---

## Task 13: Remove the Profundidad de Línea tab and route

Productos now carries the useful parts (presence table with tiers, drill, category filter, group matrix); Vendedor 360 uses `lib/dwh/seller-coverage.ts` (Task 1).

**Files:**
- Delete: `app/(app)/analitica/tabs/tab-profundidad.tsx`; `app/api/dwh/profundidad-linea/route.ts`, `tier.ts`, `seller-coverage.ts`, `__tests__/route.test.ts`, `__tests__/seller-coverage.test.ts`, `__tests__/tier.test.ts`; `e2e/profundidad-linea.spec.ts`, `e2e/profundidad-linea-vendedor.spec.ts`
- Modify: `tab-keys.ts`, `analitica-client.tsx`, `types.ts`, `app/api/dwh/productos/route.ts` and `tab-productos.tsx` (comments only), `app/api/dwh/vendedor-360/route.ts` (comments only), `e2e/analitica-consolidation.spec.ts`, `content/help/analitica-definiciones.md` if it names the tab
- Test: extend `tab-keys.test.ts`, `e2e/analitica-consolidation.spec.ts`

**References found by grep at plan time** (command: `grep -rIln --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=worktrees --exclude-dir=specs --exclude-dir=plans -i "profundidad" .`): `migrations/dwh/0031_*.sql` and `0032_*.sql` (comments, immutable, leave), `tab-productos.tsx` (its own "Profundidad" card, replaced in Task 8; leftover comments), `seller-profile.tsx` (its `data.profundidad.coverage` section is the Vendedor 360 field name, NOT the tab: keep), `analitica-client.tsx`, `types.ts` (`DepthMatrixCell`, `DepthMatrixRow`, `DepthMatrixResponse`, `DepthGapEntity`, `DepthGapResponse`, `SellerCoverageResponse`, `CustomerSegment` - the last is also used by `CadenceRow`, so it is removed in Task 15), `vendedor-360/route.ts` (already rewired in Task 1; comments at ~24 and ~512 remain), `productos/route.ts` and `productos/__tests__/route.test.ts` (`section=profundidad` is the presence-table section of the Productos route: KEEP), the files above. `e2e/profundidad-linea*.spec.ts` are the only e2e. Before deleting `__tests__/tier.test.ts` and `__tests__/seller-coverage.test.ts`, compare their case lists with `__tests__/unit/dwh/depth-tier.test.ts` / `seller-coverage.test.ts` (Task 1) and port any case that is not covered.

**Interfaces:**
- Consumes: Task 1 (`fetchSellerCoverage`), Task 2 (`resolveActiveTab`).
- Produces: `?tab=profundidad` resolves to `resumen`; `GET /api/dwh/profundidad-linea` is a 404.

- [ ] **Step 1: Write the failing tests**

Append to `tab-keys.test.ts`:
```ts
describe('retired tab: profundidad', () => {
  test('is no longer a tab and an old link opens the default tab', () => {
    expect(TAB_KEYS).not.toContain('profundidad' as never);
    expect(resolveActiveTab('profundidad')).toBe('resumen');
  });
});
```
Append to the `retired tabs (mocked API)` describe in `e2e/analitica-consolidation.spec.ts`:
```ts
  test('?tab=profundidad opens Resumen and the tab is gone from the bar', async ({ adminPage }) => {
    await expectFallsBackToResumen(adminPage, 'profundidad', 'Profundidad de Línea');
  });
```

- [ ] **Step 2: Run to see them fail**

Run: `bun test --isolate --env-file=.env.local "app/(app)/analitica/lib/__tests__/tab-keys.test.ts"` -> FAIL (`profundidad` still a tab).

- [ ] **Step 3: Implement**

Remove `'profundidad'` from `TAB_KEYS`/`TAB_LABELS`, the `TabProfundidad` import and `TAB_COMPONENTS` entry; `git rm` the files listed; delete `DepthMatrixCell`, `DepthMatrixRow`, `DepthMatrixResponse`, `DepthGapEntity`, `DepthGapResponse`, `SellerCoverageResponse` from `types.ts` (keep `SellerCoverageRow` and `CustomerSegment`); reword the comments in `productos/route.ts`/`tab-productos.tsx`/`vendedor-360/route.ts` that point at the deleted route ("profundidad-linea/route.ts's handleLeaderboard" -> "lib/dwh/seller-coverage.ts").

- [ ] **Step 4: Run to verify**

```bash
bun test --isolate --env-file=.env.local "app/(app)/analitica/lib/__tests__/tab-keys.test.ts" app/api/dwh/productos app/api/dwh/vendedor-360 __tests__/unit/dwh
bun run test:components
bunx tsc --noEmit && bun run lint
grep -rIn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=worktrees --exclude-dir=specs --exclude-dir=plans --exclude-dir=docs --exclude=tsconfig.tsbuildinfo "profundidad-linea\|TabProfundidad\|tab-profundidad\|DepthMatrix\|DepthGap\|SellerCoverageResponse\|api/dwh/profundidad" . | grep -v "migrations/"
```
Expected: all pass; the grep prints nothing. Then `bun run e2e -- e2e/analitica-consolidation.spec.ts` -> PASS.

- [ ] **Step 5: Commit**

```bash
git add -A "app/(app)/analitica" app/api/dwh/profundidad-linea app/api/dwh/productos app/api/dwh/vendedor-360 e2e content/help
git commit -m "refactor(analitica): remove the Profundidad de Línea tab and route" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 14: Remove the Matriz Vendedor-Producto tab, route and XLSX export

**Files:**
- Delete: `app/(app)/analitica/tabs/tab-matriz-vendedor.tsx`; `app/api/dwh/matriz-vendedor/route.ts`, `export-rows.ts`, `__tests__/route.test.ts`, `__tests__/export-rows.test.ts`
- Modify: `tab-keys.ts`, `analitica-client.tsx`, `types.ts`, `e2e/analitica-consolidation.spec.ts`, `content/help/analitica-definiciones.md` (only if it still names the tab), `docs/ventas-netas-analysis.md` (Task 17)
- Test: extend `tab-keys.test.ts`, `e2e/analitica-consolidation.spec.ts`

**References found by grep at plan time** (command: `grep -rIn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=worktrees --exclude-dir=specs --exclude-dir=plans -i "matriz-vendedor\|matriz vendedor\|MatrizVendedor\|SellerSummary\|SellerMatrix\|MATRIZ_EXPORT\|buildMatrizExportRows" .`): `analitica-client.tsx`, `types.ts` (`SellerSummaryRow`, `SellerSummaryResponse`, `SellerMatrixProduct`, `SellerMatrixStore`, `SellerMatrixCell`, `SellerMatrixResponse` and their comment block ~lines 689-731), the tab, the route + `export-rows.ts` (the only users of `MATRIZ_EXPORT_COLUMNS`/`buildMatrizExportRows`; its `lib/reports/registry` `ColumnDef` import is type-only and stays used elsewhere), `docs/ventas-netas-analysis.md`, `docs/2026-09-22-deploying-four-analytics-tabs.md` (history). There is NO e2e spec for the matrix. `lib/xlsx.ts` stays (the cobertura export uses it): verify with `grep -rn "from '@/lib/xlsx'" app lib | grep -v matriz-vendedor`.

**Interfaces:**
- Consumes: Task 2.
- Produces: `?tab=matriz-vendedor` resolves to `resumen`; `GET /api/dwh/matriz-vendedor` (including `format=xlsx`) is a 404.

- [ ] **Step 1: Write the failing tests**

Append to `tab-keys.test.ts`:
```ts
describe('retired tab: matriz-vendedor', () => {
  test('is no longer a tab and an old link opens the default tab', () => {
    expect(TAB_KEYS).not.toContain('matriz-vendedor' as never);
    expect(resolveActiveTab('matriz-vendedor')).toBe('resumen');
  });
});
```
Append to the retired-tabs describe in `e2e/analitica-consolidation.spec.ts`:
```ts
  test('?tab=matriz-vendedor opens Resumen and the tab is gone from the bar', async ({ adminPage }) => {
    await expectFallsBackToResumen(adminPage, 'matriz-vendedor', 'Matriz Vendedor-Producto');
  });
```

- [ ] **Step 2: Run to see them fail**

Run: `bun test --isolate --env-file=.env.local "app/(app)/analitica/lib/__tests__/tab-keys.test.ts"` -> FAIL.

- [ ] **Step 3: Implement**

Remove `'matriz-vendedor'` from `TAB_KEYS`/`TAB_LABELS`, the `TabMatrizVendedor` import and `TAB_COMPONENTS` entry; `git rm` the files above; delete the six `Seller*` types and their comment block from `types.ts`. Help: `grep -n "Matriz" content/help/analitica-definiciones.md` must be empty (Task 12 already rewrote the only mention).

- [ ] **Step 4: Run to verify**

```bash
bun test --isolate --env-file=.env.local "app/(app)/analitica/lib/__tests__/tab-keys.test.ts" lib/xlsx.test.ts
bun run test:components
bunx tsc --noEmit && bun run lint
grep -rIn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=worktrees --exclude-dir=specs --exclude-dir=plans --exclude-dir=docs --exclude=tsconfig.tsbuildinfo -i "matriz-vendedor\|TabMatrizVendedor\|SellerSummary\|SellerMatrix\|MATRIZ_EXPORT\|buildMatrizExportRows" . | grep -v "migrations/"
```
Expected: all pass; grep prints nothing. `bun run e2e -- e2e/analitica-consolidation.spec.ts` -> PASS.

- [ ] **Step 5: Commit**

```bash
git add -A "app/(app)/analitica" app/api/dwh/matriz-vendedor e2e content/help
git commit -m "refactor(analitica): remove the Matriz Vendedor-Producto tab, route and XLSX export" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 15: Remove the Cadencia tab, its API and the gap-target editor (keep the SQLite table)

Replaced by visit compliance in Clientes (Task 6). `visit_cadence_targets` holds manually typed targets; dropping the table would destroy them irreversibly for no gain, so the table definition stays in `lib/db/schema.ts` with a deprecation comment and **no Drizzle migration** is added (a future cleanup can drop it after exporting the rows).

**Files:**
- Delete: `app/(app)/analitica/tabs/tab-cadencia.tsx`; `app/api/dwh/cadencia/route.ts`, `target-resolution.ts`, `__tests__/route.test.ts`, `__tests__/target-resolution.test.ts`; `app/api/cadencia-targets/route.ts`, `app/api/cadencia-targets/__tests__/route.test.ts`; `e2e/cadencia.spec.ts`
- Modify: `tab-keys.ts`, `analitica-client.tsx`, `types.ts` (`CadenceRow`, `CadenceResponse`, the Cadencia comment block ~lines 668-690; `CustomerSegment` if grep shows no user left), `lib/db/schema.ts` (comment only), `app/(app)/analitica/tabs/seller-profile.tsx` (two comments), `app/api/admin/seller-targets/route.ts` (comment ~54), `app/api/admin/seller-targets/__tests__/route.test.ts` (comment ~29), `e2e/analitica-consolidation.spec.ts`
- Test: extend `tab-keys.test.ts`, `e2e/analitica-consolidation.spec.ts`

**References found by grep at plan time** (command: `grep -rIn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=worktrees --exclude-dir=specs --exclude-dir=plans -i "cadencia\|cadence\|visitCadenceTargets\|visit_cadence" .`): `tab-cadencia.tsx` (fetches `/api/dwh/cadencia` and posts to `/api/cadencia-targets`), `analitica-client.tsx`, `types.ts`, `app/api/dwh/cadencia/*`, `app/api/cadencia-targets/*`, `lib/db/schema.ts:71-86` (`visitCadenceTargets`, `VisitCadenceTarget`, `NewVisitCadenceTarget` - only the two routes above import them), `seller-profile.tsx:47,237` (comments "same pattern as tab-cadencia.tsx"), `app/api/admin/seller-targets/route.ts:54` and its test `:29` (comments), `e2e/cadencia.spec.ts` (@mssql), `migrations/dwh/0032_*.sql` (comment, immutable), `migrations/sqlite/*` (the table's creation migration, immutable), `docs/2026-09-22-deploying-four-analytics-tabs.md` (history, Task 17). `e2e/analitica.spec.ts` does not reference it. `scripts/e2e-seed.ts` does not touch it (`grep -n cadence scripts/e2e-seed.ts` -> nothing).

**Interfaces:**
- Consumes: Task 2.
- Produces: `?tab=cadencia` resolves to `resumen`; `/api/dwh/cadencia` and `/api/cadencia-targets` are 404; the final tab bar is `Resumen, Seguimiento, Ventas, Devoluciones, CXC y Cobranzas, Clientes, Productos, Histórico 2025, Finanzas, Multimoneda, Compras`.

- [ ] **Step 1: Write the failing tests**

Append to `app/(app)/analitica/lib/__tests__/tab-keys.test.ts` (and add `TAB_LABELS` to its import from `../tab-keys` if absent):
```ts
describe('retired tab: cadencia, and the final tab list', () => {
  test('cadencia is gone and an old link opens the default tab', () => {
    expect(TAB_KEYS).not.toContain('cadencia' as never);
    expect(resolveActiveTab('cadencia')).toBe('resumen');
  });
  test('the consolidated tab list, in order', () => {
    expect([...TAB_KEYS]).toEqual([
      'resumen', 'seguimiento', 'ventas', 'devoluciones', 'cxc', 'clientes', 'productos', 'historico', 'finanzas', 'multimoneda', 'compras',
    ]);
    expect(TAB_KEYS.map(k => TAB_LABELS[k])).toEqual([
      'Resumen', 'Seguimiento', 'Ventas', 'Devoluciones', 'CXC y Cobranzas', 'Clientes', 'Productos', 'Histórico 2025', 'Finanzas', 'Multimoneda', 'Compras',
    ]);
  });
  test('every retired key falls back', () => {
    for (const k of ['vendedores', 'profundidad', 'matriz-vendedor', 'cadencia']) expect(resolveActiveTab(k)).toBe('resumen');
  });
});
```
Append to the retired-tabs describe in `e2e/analitica-consolidation.spec.ts`:
```ts
  test('?tab=cadencia opens Resumen and the tab is gone from the bar', async ({ adminPage }) => {
    await expectFallsBackToResumen(adminPage, 'cadencia', 'Cadencia');
  });

  test('the tab bar lists exactly the consolidated tabs, in order', async ({ adminPage }) => {
    await failAllDwh(adminPage);
    await adminPage.goto('/analitica');
    const labels = await adminPage.getByRole('navigation', { name: 'Tabs' }).getByRole('button').allTextContents();
    expect(labels).toEqual([
      'Resumen', 'Seguimiento', 'Ventas', 'Devoluciones', 'CXC y Cobranzas', 'Clientes', 'Productos', 'Histórico 2025', 'Finanzas', 'Multimoneda', 'Compras',
    ]);
  });
```

- [ ] **Step 2: Run to see them fail**

Run: `bun test --isolate --env-file=.env.local "app/(app)/analitica/lib/__tests__/tab-keys.test.ts"` -> FAIL (`cadencia` still a tab).

- [ ] **Step 3: Implement**

Remove `'cadencia'` from `TAB_KEYS`/`TAB_LABELS`, the `TabCadencia` import and `TAB_COMPONENTS` entry; `git rm` the listed files and directories; delete `CadenceRow`, `CadenceResponse` and the Cadencia comment block from `types.ts`; then run `grep -rn "CustomerSegment" app lib | grep -v worktrees` and delete the `CustomerSegment` type only if nothing but `types.ts` itself still uses it (after Tasks 13 and 15 it should be unused).

`lib/db/schema.ts`: replace the comment block above `visitCadenceTargets` with
```ts
// ── Visit cadence targets (DEPRECATED, unused) ──────────────────────
// Were the manual per-customer/segment expected purchase-gap targets of the Cadencia tab, which was
// removed (docs/superpowers/specs/2026-10-11-sales-tabs-refactor-design.md): visit compliance now comes from
// saCliente.frecu_vist (Dim_Customer.VisitIntervalDays). The table is kept ON PURPOSE: it holds manually
// entered data and dropping it would be irreversible. Nothing reads or writes it; to retire it, export the
// rows first and add a Drizzle migration that drops `visit_cadence_targets`.
```
(keep the table and its two exported types untouched). Reword the two `seller-profile.tsx` comments ("same pattern as tab-cadencia.tsx's ..." -> "same pattern the retired Cadencia tab used"), the `seller-targets` route comment (~54: "app/cadencia-targets/route.ts" -> "the retired cadencia-targets route") and its test comment (~29).

- [ ] **Step 4: Run to verify**

```bash
bun test --isolate --env-file=.env.local "app/(app)/analitica/lib/__tests__/tab-keys.test.ts" app/api/admin/seller-targets
bun run test:components
bunx tsc --noEmit && bun run lint
grep -rIn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=worktrees --exclude-dir=specs --exclude-dir=plans --exclude-dir=docs --exclude=tsconfig.tsbuildinfo -i "cadencia\|CadenceRow\|CadenceResponse\|cadencia-targets" . | grep -v "migrations/"
```
Expected: pass; the grep prints nothing except the deprecation comment in `lib/db/schema.ts` (mentions "Cadencia tab"). Then `bun run e2e -- e2e/analitica-consolidation.spec.ts` -> PASS (including the tab-bar order test).

- [ ] **Step 5: Commit**

```bash
git add -A "app/(app)/analitica" app/api/dwh/cadencia app/api/cadencia-targets app/api/admin/seller-targets lib/db/schema.ts e2e
git commit -m "refactor(analitica): remove the Cadencia tab and its target API (SQLite table kept, deprecated)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 16: Dead-code sweep (only what grep proves unreferenced)

**Files:**
- Modify: `app/(app)/analitica/types.ts` (and whatever the sweep proves dead)
- Test: `bunx tsc --noEmit`, `bun run lint`, full unit + component suites

**Interfaces:** none produced. Rule: a symbol or file is deleted only if the repo-wide word count (all of `app lib scripts components e2e __tests__ test`, tests included, worktrees excluded) equals exactly its declaration, i.e. nothing - not even a test or its own file - references it. Anything referenced inside its own file only is NOT dead (at most it loses its `export` keyword, and only if no test imports it).

Proven at plan time (before Tasks 12-15): `FilterParams` and `DrillContext` in `app/(app)/analitica/types.ts` have exactly one occurrence in the repo (their declarations). Every other exported symbol of `types.ts`, `app/(app)/analitica/lib/*.ts`, `app/api/dwh/lib/*.ts`, `lib/dwh/*.ts` and `app/(app)/analitica/components/*.tsx` had at least one reference. Files checked and found imported: `entidad-tree-table`, `grouped-drilldown-table`, `kpi-card`, `kpi-group`, `trend-bucket`, `ventas-children`, `ventas-rows`, `period-label`, `devoluciones-kpis`, `cxc-trends`, `cobertura`, `incremental-load-sql`, `xlsx`, `trim-strings`, `searchable-select`.

- [ ] **Step 1: Re-run the proof after the deletions**

```bash
for f in "app/(app)/analitica/types.ts" "app/(app)/analitica/lib/"*.ts app/api/dwh/lib/*.ts lib/dwh/*.ts lib/seguimiento/*.ts lib/clientes/*.ts lib/productos/*.ts "app/(app)/analitica/components/"*.tsx "app/(app)/analitica/components/productos/"*.tsx; do
  grep -oE "^export (async )?(function|const|interface|type|class) [A-Za-z0-9_]+" "$f" | awk '{print $NF}' | while read n; do
    total=$(grep -rIw --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=worktrees --exclude-dir=.superpowers --include='*.ts' --include='*.tsx' -- "$n" app lib scripts components e2e __tests__ test 2>/dev/null | wc -l | tr -d ' ')
    [ "$total" = "1" ] && echo "DEAD? $f :: $n"
  done
done
for b in entidad-tree-table grouped-drilldown-table kpi-card kpi-group trend-bucket ventas-children ventas-rows period-label devoluciones-kpis cxc-trends cobertura xlsx trim-strings searchable-select; do
  n=$(grep -rIlE --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=worktrees --include='*.ts' --include='*.tsx' "from '[^']*/$b'" app lib scripts components | grep -v "\.test\." | wc -l | tr -d ' ')
  [ "$n" = "0" ] && echo "ORPHAN FILE? $b"
done
```
Expected output: `DEAD? ... :: FilterParams`, `DEAD? ... :: DrillContext`, plus any symbol that only the deleted tabs/routes used (the sweep, not this plan, is the authority). No `ORPHAN FILE?` lines is the expected result; if one appears, confirm with `grep -rn "<basename>"` over the whole repo (including `e2e` and `docs`) before deleting.

- [ ] **Step 2: Delete exactly what step 1 listed**

For each `DEAD?` line: open the declaration, delete the symbol and its leading comment, nothing else. For an `ORPHAN FILE?`: `git rm` the file and its test.

- [ ] **Step 3: Verify**

```bash
bunx tsc --noEmit && bun run lint
bun run test:unit
bun run test:components
```
Expected: all pass (a failure means the symbol was not dead: restore it).

- [ ] **Step 4: Commit**

```bash
git add -A "app/(app)/analitica" app/api/dwh/lib lib
git commit -m "chore(analitica): drop provably unreferenced exports" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 17: AGENTS.md / docs updates and final verification

**Files:**
- Modify: `AGENTS.md` (directory map + a short "Analítica tabs" paragraph), `docs/2026-09-22-deploying-four-analytics-tabs.md` (superseded banner), `docs/ventas-netas-analysis.md` (superseded note); `INSTRUCTIONS.md` only if it names removed tabs
- Test: the whole verification list below

**Interfaces:** none.

- [ ] **Step 1: AGENTS.md**

In the `lib/` directory map add:
```
  clientes/scope.ts, cobertura-sql.ts — Clientes tab: group/route scope (decided by the CURRENT Dim_Customer row) and the cobertura query (last invoice, period activity, route, group, visit frequency)
  productos/group-share.ts, queries.ts — Productos tab: product x customer-group share matrix (pure builder + SQL), category list
  dwh/depth-tier.ts, seller-coverage.ts — line-depth tiers and the per-seller coverage figure shown on Vendedor 360 (moved from the removed Profundidad route)
  dwh/historico-window.ts  — Histórico 2025 window (calendar 2025, sales and returns)
```
and under `app/(app)/analitica/` add `lib/tab-keys.ts — tab registry (TAB_KEYS/TAB_LABELS/resolveActiveTab); an unknown or retired ?tab= resolves to Resumen`. Add this paragraph after "Seguimiento (Analítica tab)" (plan B) - or after "Recipes / Product Costing" if that paragraph is absent:
```markdown
## Analítica tabs (consolidated)

Tabs, in order: Resumen (with the month-pace strip), Seguimiento, Ventas, Devoluciones, CXC y Cobranzas, Clientes, Productos, Histórico 2025, Finanzas, Multimoneda, Compras. The registry is `app/(app)/analitica/lib/tab-keys.ts`; `?tab=vendedores|profundidad|matriz-vendedor|cadencia` (removed) open Resumen.
- **Clientes** extends "Cobertura de clientes" (`/api/dwh/clientes/cobertura`): route, group, patrimonio/nuevo (`customerKindInYear`), visit compliance (`visitCompliance`; `VisitIntervalDays` NULL = "Sin frecuencia", never overdue) and "Sin compras en el período". The group/route filters (`lib/clientes/scope.ts`) scope the whole tab by the customer's CURRENT row; they filter the sales side only.
- **Productos**: Line > SubLine > product drill; `CategoryName` (Fresco/Congelado) is a filter, not a level; `section=grupos` is the product x customer-group share matrix (group = `Dim_Segment.SegmentName` of the current `ErpSegmentCode`); the presence table carries the Primera/Segunda/Addon tier from `lib/dwh/depth-tier.ts`.
- **Histórico 2025** shows calendar 2025 only (`lib/dwh/historico-window.ts`); Jan-Feb 2026 stay in the legacy tables, shown nowhere.
- `visit_cadence_targets` (SQLite) is deprecated and unused (kept on purpose, see `lib/db/schema.ts`).
- Vendedor 360's `coverage` comes from `lib/dwh/seller-coverage.ts` (pooled over all legal entities, no CADENA/INDEPENDIENTES split).
```
Remove any AGENTS.md line that still names the Vendedores, Profundidad, Matriz or Cadencia tabs (`grep -n -i "vendedores tab\|profundidad\|matriz\|cadencia" AGENTS.md`).

- [ ] **Step 2: Docs**

At the top of `docs/2026-09-22-deploying-four-analytics-tabs.md` insert: `> **Superseded (2026-10-11):** the Profundidad de Línea, Cadencia, Matriz Vendedor-Producto and Vendedores tabs described below were removed or replaced (Seguimiento, Clientes visit compliance, Productos). See docs/superpowers/plans/2026-10-11-sales-tabs-consolidation.md. The deploy steps for the consignment exclusion still apply.` At the top of `docs/ventas-netas-analysis.md` insert a one-line note that the Vendedores, Matriz Vendedor-Producto and Histórico sections refer to tabs since removed or windowed to 2025. Run `grep -n -i "vendedores\|cadencia\|profundidad\|matriz" INSTRUCTIONS.md`: expected no output (leave the file alone).

- [ ] **Step 3: Final verification**

Run each and confirm:
```bash
bun run test:unit                                    # all unit tests (new + existing)
bun run test:components                              # all RTL tests
DW_NAME=DWH_AlimentosNY_Test bun test --isolate --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/consolidation-queries.test.ts scripts/dwh/__tests__/seguimiento-queries.test.ts
bunx tsc --noEmit
bun run lint
bun run build                                        # next build: no route/import left dangling
SQLITE_PATH=./e2e/.tmp bun run e2e:seed && bun run e2e   # default suite: mocked analitica + seguimiento specs, everything else
git status --short                                   # only intended files; no .tmp artefacts
grep -rIn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=worktrees --exclude-dir=specs --exclude-dir=plans --exclude-dir=docs --exclude=tsconfig.tsbuildinfo "api/dwh/vendedores\|api/dwh/profundidad-linea\|api/dwh/matriz-vendedor\|api/dwh/cadencia\|api/cadencia-targets" .
```
Expected: everything passes; the final grep prints nothing. Where the real DWH is available also run `bun run e2e:mssql -- e2e/analitica-consolidation.spec.ts e2e/analitica.spec.ts e2e/seguimiento.spec.ts`.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md docs/2026-09-22-deploying-four-analytics-tabs.md docs/ventas-netas-analysis.md
git commit -m "docs: AGENTS.md and docs for the consolidated Analítica tabs" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Verify on production

Local DWH/ERP are stale copies; check these before announcing (none blocks merging):
1. **Fields populated.** After `mapping:apply`: `Dim_Customer.ErpSegmentCode`, `Dim_Zone.RouteNumber` for `CCS003..CCS022`, `VisitFrequency`/`VisitIntervalDays`, `RegisteredDate`. Before it, Clientes must read "Sin ruta" / "Sin grupo" / "Sin frecuencia", the compliance KPI "—", and nobody is overdue.
2. **Patrimonio / nuevo.** 115 customers with `RegisteredDate = 2026-03-28` are `patrimonio`; spot-check one customer registered in the old system just before the cutover.
3. **Category values.** `SELECT DISTINCT CategoryName FROM dim.Dim_Product WHERE IsCurrent = 1` is exactly Fresco/Congelado (+ NULL); check trailing spaces/case (the filter compares with `=` under the DWH collation, case-insensitive).
4. **Matrix reconciliation.** For one closed month, the sum of the matrix row totals equals the drill table's ventas brutas for the same filters; a gap means a customer code with two `IsCurrent = 1` rows (would double count) or sales on a code with no current row (dropped by the join).
5. **Seller coverage.** Compare Vendedor 360's `coverage` for one seller before (old route, CADENA+INDEPENDIENTES) and after (pooled); differences should only come from chains whose stores sat in both segments. Confirm what `Dim_Customer.SegmentCode` holds in production (plan A says segment NAME) - the old query silently returned nothing if it no longer equals CADENA/INDEPENDIENTES.
6. **Cobertura performance.** The query now adds `PeriodSales` on top of `OwnSales`/`EntitySales` over all history; time it on production (index `IX_Fact_Sales_CustomerKey`). Cache is the default 15 minutes.
7. **Year of `kind`.** `patrimonio/nuevo` use the year of the range end (`rangeEndDateKey`); for `12m` that is the current year, so a customer registered last November is `patrimonio`. Confirm that matches how the business reads the workbook.
8. **Time zone.** "Today" is UTC (as before in cobertura); in the evening in Caracas the as-of day can run one day ahead.
9. **Consignment roots.** Cobertura (unlike Seguimiento) does not exclude consignment-root customers; they can appear as "Sin compras en el período" or overdue. Confirm acceptable or exclude via `getFlaggedRootCodes`.
10. **Returns with the scope at Entidad grain.** A chain whose stores are in different groups shows all its returns under each group row; check whether any real chain is split before relying on the Entidad return rate under a group filter.
11. **Histórico.** 2025 totals per month equal the previous values for Jan-Dec 2025; Jan-Feb 2026 are gone; communicate that those two months are now visible nowhere.
12. **Stale links.** Bookmarks to the four retired tabs open Resumen; the retired API paths return 404 (any external script calling `/api/dwh/matriz-vendedor?format=xlsx` breaks).
13. **`visit_cadence_targets`.** Export its rows once (`SELECT * FROM visit_cadence_targets`) before any future decision to drop it.
