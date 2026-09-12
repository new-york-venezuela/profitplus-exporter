# Finanzas (Fact_Expenses) & Compras (Fact_Purchases) — Design

**Date**: 2026-09-12
**Status**: Approved by user via superpowers:brainstorming (section-by-section), pending final spec review
**Author**: Claude (Sonnet 5), with Eugenio Doñaque

**Note on scope**: this spec covers two related but independent facts, bundled into one design because they're both small builds the user asked to tackle together. §1 (Finanzas) and §2 (Compras) can be implemented and reviewed as separate SDD tracks; neither depends on the other's tables. This closes out two items from the informal backlog tracked in memory `dwh-analytics-initiative-p0-p6` (see also `docs/superpowers/specs/2026-09-10-customer-legal-entity-grouping-design.md`, which explicitly deferred both).

## 1. Finanzas — `Fact_Expenses`

### 1.1 Purpose & Scope

**Problem**: the Finanzas tab currently shows a P&L waterfall (Bruto → Descuento → Neto → COGS → Utilidad) sourced entirely from `Fact_Sales`. There is no real operating-expense data anywhere in the DWH, so "Utilidad" is actually gross margin, not net profit — the tab cannot show EBITDA, operating margin, or true net income.

**Fix**: source real operating expenses from Profit's bank/cash transaction ledger (§1.2), classify them into a small set of business categories (§1.3), and extend the Finanzas waterfall with a real EBITDA/Utilidad Neta calculation plus an expense-category breakdown table (§1.5).

**Explicitly in scope**:
- New `dim.Dim_ExpenseConcept` + `fact.Fact_Expenses`, ETL'd from `saMovimientoBanco` + `saMovimientoCaja` joined to `saCuentaIngEgr`.
- A seed/classification step mapping all 248 `saCuentaIngEgr` concepts to the fixed category set in §1.3 (mechanical data work, delegated to a subagent during implementation — full source list already extracted and verified live, see §1.6).
- Finanzas tab: extend the existing waterfall with Gastos Operativos → EBITDA → Intereses/Impuestos → Utilidad Neta, plus a category breakdown table.

**Explicitly out of scope**:
- True depreciation/amortization — structurally absent from this data source (bank movements are cash transactions only; D&A is a non-cash bookkeeping entry). EBITDA here is computed as operating profit excluding interest/tax, which is D&A-free by construction, not by adjustment. Labeled as such in the UI, not silently presented as a textbook EBITDA.
- Cost-center (`scCentro`) breakdown of expenses — `saMovimientoBanco.dis_cen` (XML) may carry this but was not verified live; a future enhancement if wanted, not blocking this build.
- `scCuenta`/`cue_gasto`/`co_gas`/`scGastos` — investigated and found empty/unpopulated (0 rows, 0 flags across all 347 accounts); not used by this design. `saMovimientoBanco`/`saCuentaIngEgr` is the primary and only source.

### 1.2 Source System Facts Grounding This Design

Verified live, read-only, against the exporter's dev database connection (`Ncake_a`):

- **`saMovimientoBanco`**: 12,527 rows, dated 2021-10-04 to 2026-07-13 — real multi-year history, unlike `Fact_Sales` (DWH only has data from 2026-03-16 onward in this environment). `co_cta_ingr_egr` (the income/expense concept FK) is populated on all 12,527 rows. `anulado` (void flag) present, 78 rows voided.
- **`saMovimientoCaja`**: 64 rows, same shape (`co_cta_ingr_egr`, `monto_d`, `monto_h`, `anulado`, `fecha`), same concept scheme. All 64 rows join cleanly to `saCuentaIngEgr`. **Not a minor/edge-case source** — per the user (2026-09-12): this table is actively used to register payments manually when the app fails to register them through the bank movement flow. Skipping it would silently miss real payments that exist nowhere else, not just a handful of rare cash transactions. `Fact_Expenses` MUST union both tables, never just `saMovimientoBanco`.
- **`saCuentaIngEgr`**: 248 rows, **100% join coverage** from both movement tables (12,449/12,449 non-voided `saMovimientoBanco` rows matched on `LTRIM(RTRIM(co_cta_ingr_egr))` — codes are fixed-width `char` and need trimming both sides). Full list extracted live 2026-09-12 (§1.6).
- **`monto_d` (debit) / `monto_h` (credit) give direction.** Sample query on 2026 data confirmed real, sensible category totals (Materia Prima ~4.8M, Nómina ~2.6M, Publicidad ~234K, etc. — see brainstorming transcript).
- **The originally-planned path is dead**: `scCuenta.cue_gasto` = 0 for all 347 rows; `co_gas` empty for all 347 rows; `scGastos` has 0 rows total. The chart-of-accounts-based classification (`LEFT(co_cue,1) IN ('5','6')`) does work as a fallback signal but is **not used** here — `saMovimientoBanco`/`saCuentaIngEgr` is richer (multi-year history, already-meaningful concept names) and needs no such derivation.
- **Interest & tax ARE separable**: keyword search over the 248 concepts found 24 concepts matching `%interes%`/`%islr%`/`%impuesto%` (e.g. "Intereses Bco Caroni", "Pago ISLR (DEFINITIVO)", "Impuesto Municipal Publicidad"). 381 non-voided movements against these concepts in 2026 alone, ~Bs.910K. This makes a real Intereses/Impuestos exclusion from EBITDA possible, not just a proxy.
- **Depreciation/amortization: zero matching concepts** (`%deprec%`, `%amortiz%` — 0 rows). Expected: D&A is a non-cash entry and never posts through a bank/cash account.
- **Code-prefix structure observed across all 248 concepts** (not previously documented anywhere): codes prefixed `I-` are Ingresos (income — "Ventas", "Otros Ingresos", "Venta de Activo..."); numeric and `E-`-prefixed codes are Egresos (expenses); a small set matched by description keyword (`TRASP` "Traspaso entre cuentas", `E-12` "Traspaso entre cuentas (CAJA T)", `I-08` "Traspaso") are **internal transfers between the company's own accounts, not real income or expense** — these must be excluded entirely (not just uncategorized as "Otros") or they will double-count money moving between bank accounts as both an outflow and an inflow. `BANCO` ("Banesco (cheques)") looked transfer-like on first read but its description doesn't actually confirm that — it's classified as `Otros`/`Gasto` by default (§1.6) pending the human sanity check that step calls for, not assumed to be a transfer.

### 1.3 Category Taxonomy

Fixed set of 10 categories, chosen to (a) support the EBITDA exclusion rule and (b) keep the breakdown table readable:

| Category | Purpose |
|---|---|
| `Nomina` | Payroll, benefits, prestaciones, bonos, vacaciones, liquidaciones |
| `MateriaPrima` | Raw materials, packaging, production inputs |
| `Alquileres` | Rent (production, offices, equipment) |
| `Servicios` | Utilities (electricidad, agua, telefonia), fumigación, aseo |
| `Mantenimiento` | Vehicle/equipment/plant maintenance, repuestos |
| `Publicidad` | Advertising, patrocinio, marketing |
| `Honorarios` | Professional fees (legal, tax, accounting) |
| `Intereses` | Bank/loan interest — **excluded from EBITDA** |
| `Impuestos` | ISLR, IVA, municipal taxes, SENIAT, retenciones fiscales — **excluded from EBITDA** |
| `Otros` | Everything else that's a real expense but doesn't fit above (donations, misceláneos, insurance, travel, etc.) |

Plus two special, non-expense classifications, both **excluded from `Fact_Expenses` entirely** (filtered at ETL time, not merely categorized):
- **Ingresos** (`I-`-prefixed concepts like Ventas, Otros Ingresos, Venta de Activo) — these represent money coming in through the bank, not an expense. Out of scope for `Fact_Expenses`; sales revenue already comes from `Fact_Sales`. Including them would double-count revenue through a second, less-precise channel.
- **Traspasos** (`TRASP`, `E-12`, `I-08`) — transfers between the company's own accounts. Not real economic activity; including them would inflate both "expense" and "income" totals for money that never left the business. (`BANCO` is not included here — see §1.2's note; it defaults to `Otros`/`Gasto` pending human review.)

`Dim_ExpenseConcept` carries a `ConceptType` column (`'Gasto' | 'Ingreso' | 'Traspaso'`) so this filtering is explicit and auditable, not silently baked into the ETL's WHERE clause alone.

### 1.4 Data Foundation Design

**New dimension `dim.Dim_ExpenseConcept`** — one row per `saCuentaIngEgr` concept:

| Column | Type | Notes |
|---|---|---|
| `ExpenseConceptKey` | int IDENTITY PK | |
| `ConceptCode` | char(20) NOT NULL | `saCuentaIngEgr.co_cta_ingr_egr`, trimmed |
| `ConceptName` | varchar(60) | `saCuentaIngEgr.descrip`, trimmed |
| `ConceptType` | varchar(10) NOT NULL | `'Gasto'` \| `'Ingreso'` \| `'Traspaso'` — see §1.3 |
| `Category` | varchar(20) NULL | One of the 10 categories in §1.3; NULL for `Ingreso`/`Traspaso` rows |
| `IsExcludedFromEbitda` | bit NOT NULL | `1` for `Intereses`/`Impuestos` categories, else `0` |
| `LoadedAtUtc` | datetime2(3) | |

Type 1 (overwrite) — concept classification doesn't need history; if Profit adds a new concept code later, it lands as `Otros`/`Gasto` by default until re-classified (see §1.6 seeding note).

**New fact `fact.Fact_Expenses`** — one row per bank/cash movement (grain matches source):

| Column | Type | Notes |
|---|---|---|
| `ExpenseKey` | bigint IDENTITY PK | |
| `DateKey` | int FK → `Dim_Date` | From `fecha` |
| `ExpenseConceptKey` | int FK → `Dim_ExpenseConcept` | |
| `Amount` | decimal(18,2) | `monto_d - monto_h` (net outflow; a `monto_h`-heavy row, e.g. a refund, nets negative) |
| `SourceTable` | varchar(20) | `'Banco'` \| `'Caja'` — for debugging/back-reference only, not exposed in the UI |
| `IsVoided` | bit | From `anulado` |
| `LoadedAtUtc` | datetime2(3) | |

ETL loads `saMovimientoBanco` UNION ALL `saMovimientoCaja`, joins `saCuentaIngEgr` on trimmed `co_cta_ingr_egr`, **excludes rows where the resolved concept's `ConceptType = 'Ingreso'` or `'Traspaso'`** at load time (so `Fact_Expenses` only ever contains real expenses — the API layer doesn't need to remember to filter). Same watermark-incremental pattern as `Fact_Sales`/`Fact_Returns` (new `EtlWatermark` rows for `saMovimientoBanco`/`saMovimientoCaja`).

### 1.5 Finanzas Tab

Extends the existing waterfall (`app/api/dwh/finanzas/route.ts`, `FinanzasResponse.waterfall`) with new steps, computed for the selected date range:

```
Ventas Netas          (existing, from Fact_Sales)
− COGS                (existing)
= Utilidad Bruta      (existing)
− Gastos Operativos   (NEW: SUM(Fact_Expenses.Amount) WHERE Category NOT IN ('Intereses','Impuestos'))
= EBITDA              (NEW — labeled "EBITDA (aprox.)" with a tooltip noting no D&A adjustment is possible; see §1.1 scope)
− Intereses           (NEW: SUM(Amount) WHERE Category = 'Intereses')
− Impuestos           (NEW: SUM(Amount) WHERE Category = 'Impuestos')
= Utilidad Neta       (NEW)
```

Below the waterfall, a `GroupedDrilldownTable`-style breakdown: rows = the 8 non-excluded expense categories (Nomina, MateriaPrima, Alquileres, Servicios, Mantenimiento, Publicidad, Honorarios, Otros) ranked by total, each expandable to its individual `ConceptName` line items — same on-demand-fetch UX already used in Ventas/Devoluciones/Vendedores. Currency-aware via the existing `moneyLabel`/`formatBreakdownMetric` pattern (per the currency-conversion bug fixed 2026-09-11, this must be wired from the start, not bolted on after).

`FinanzasResponse` type gains: `ebitda: number`, `utilidadNeta: number`, `expenseBreakdown` (category rows, same shape as other tabs' breakdown responses).

### 1.6 Expense Concept Classification (implementation note, not a spec placeholder)

The full 248-row `saCuentaIngEgr` list was extracted live on 2026-09-12 (see brainstorming session). Classifying every row into the §1.3 taxonomy is mechanical, well-defined work — given the source list and the category definitions, there is exactly one reasonable answer per row (e.g. "Materia Prima" → `MateriaPrima`/`Gasto`; "I-01|Ventas" → `Ingreso`; "E-12|Traspaso entre cuentas (CAJA T)" → `Traspaso`). This is delegated to a subagent as part of the implementation plan's data-seeding task, not left for a human to fill in later — the plan must include the source list inline so the subagent has no ambiguity about what "the 248 concepts" means. Any concept the subagent finds genuinely ambiguous must default to `Otros`/`Gasto` and be flagged in that task's report for a quick human sanity check, rather than guessed silently.

## 2. Compras — `Fact_Purchases`

### 2.1 Purpose & Scope

**Problem**: the Compras tab is currently a stub (`TabStub`, `analitica-client.tsx:39`). There is no purchasing/supplier visibility anywhere in the DWH.

**Fix**: mirror the existing `Fact_Sales` design almost exactly — `saFacturaCompra`/`saFacturaCompraReng` are structurally near-identical to `saFacturaVenta`/`saFacturaVentaReng`.

**Explicitly in scope**:
- New `dim.Dim_Supplier` (mirrors `Dim_Customer`, sourced from `saProveedor`).
- New `fact.Fact_Purchases` (header+lines, mirrors `Fact_Sales`), watermark-incremental ETL.
- Compras tab: monthly trend chart + top-suppliers `GroupedDrilldownTable`, drillable into producto/línea — same shape as the Ventas tab, replacing `TabStub`.

**Explicitly out of scope**:
- Purchase order / receiving workflow analytics (`saOrdenCompra`, `saNotaRecepcionCompra`) — only invoiced purchases (`saFacturaCompra`) are in scope, matching how `Fact_Sales` only covers invoiced sales, not orders/quotes.
- Supplier-side legal-entity grouping (the `matriz`-style chain-grouping problem solved for customers in the 2026-09-10 spec) — not investigated; out of scope unless a similar fragmentation problem is later reported for suppliers.

### 2.2 Source System Facts Grounding This Design

Verified live:

- **`saFacturaCompra`**: 246 rows. Columns mirror `saFacturaVenta`'s shape closely: `co_prov` (supplier FK), `fec_emis`/`fec_reg` (dates), `total_bruto`/`total_neto` (amounts), `anulado` (void flag), `co_mone`/`tasa` (currency/rate) — same fields `Fact_Sales`'s ETL already knows how to handle.
- **`saFacturaCompraReng`**: line items, joins to product via `co_art` (same key `Fact_Sales`'s line-level ETL uses against `saFacturaVentaReng`).
- **`saDocumentoCompra`**: 549 rows — a broader compras-document table (not just invoices); not used here, since `Fact_Sales`'s precedent is to source from the invoice table specifically, not the generic document table.
- **No `Dim_Supplier` or equivalent exists yet** in `DWH_AlimentosNY` — confirmed via `INFORMATION_SCHEMA.TABLES` (0 matches for `%Supplier%`/`%Proveedor%` in the `dim` schema). This is a net-new dimension, not an extension of an existing one.

### 2.3 Data Foundation Design

**New dimension `dim.Dim_Supplier`** — mirrors `Dim_Customer`'s existing shape (SCD Type 2 if `Dim_Customer` is Type 2; confirm against the live `Dim_Customer` migration during implementation and match it, rather than introducing an inconsistent pattern):

| Column | Notes |
|---|---|
| `SupplierKey` | int IDENTITY PK |
| `SupplierCode` | `saProveedor.co_prov` |
| `SupplierName` | `saProveedor` name field (confirm exact column during implementation) |
| *(SCD tracking columns matching `Dim_Customer`'s pattern)* | |

**New fact `fact.Fact_Purchases`** — mirrors `Fact_Sales`'s header+lines grain exactly: `PurchaseKey`, `DateKey`, `SupplierKey`, `ProductKey`, `QuantityPurchased`, `GrossAmount`, `DiscountAmount`, `NetAmount`, `IsVoided`, watermark-incremental from `saFacturaCompra`/`saFacturaCompraReng`.

### 2.4 Compras Tab

Replaces `TabStub` in `analitica-client.tsx`. New route `app/api/dwh/compras/route.ts` and `app/(app)/analitica/tabs/tab-compras.tsx`, structured identically to `tab-ventas.tsx`:
- Monthly trend chart (`groupBy=mes`), bar-click drills into `groupBy=proveedor` for that month.
- `groupBy=proveedor` view uses `GroupedDrilldownTable` with a breakdown-by producto/línea option (reusing the existing `producto` `Dimension` from `query-builder.ts` — no new dimension needed on the breakdown side, only the new `proveedor` grouping dimension for the parent rows, added to `DIMENSION_SPECS` in `query-builder.ts` alongside `cliente_entidad`/`cliente_tienda`/`producto`/`vendedor`).
- Same date-range/currency controls as every other tab.

`ComprasResponse` type mirrors `VentasResponse`'s shape.

## 3. Testing

- Live SQL verification of the ETL queries against real data (both `Fact_Expenses` and `Fact_Purchases`), same standard applied throughout the 2026-09-10 legal-entity-grouping work — no query ships without being run against the actual dev DWH first.
- New `@mssql`-tagged E2E coverage for the reworked Finanzas tab (waterfall renders new steps, category breakdown expands) and the new Compras tab (loads, drills into a supplier, breakdown expands) — extending `e2e/analitica.spec.ts`.
- Unit tests for the `Dim_ExpenseConcept` classification seed data (spot-check a sample of the 248 concepts land in the expected category) and for the EBITDA/Utilidad Neta arithmetic in the Finanzas route.

## 4. Open Questions Resolved During Brainstorming (for the record)

- **Combined vs. separate specs**: one spec, two independent sections — user's explicit choice.
- **Finanzas tab shape**: extend the waterfall (not a standalone new view) + add margin/profit/EBITDA KPIs — user's explicit choice, refined further below.
- **EBITDA definition**: investigated live rather than assumed; real Intereses/Impuestos exclusion is possible (not just a Utilidad-Operativa proxy), D&A is structurally zero by construction and labeled as such — user's explicit choice after investigation.
- **Expense categorization**: fixed category set with a maintained mapping table (not runtime keyword matching) — user's explicit choice, taxonomy in §1.3.
- **Compras tab shape**: mirror the Ventas tab structure — user's explicit choice.
