# Data Warehouse Guide — DWH_AlimentosNY

**Status**: Fully implemented per `2026-08-25-sales-margin-collections-dwh-design.md`  
**Last updated**: 2026-09-01

---

## Quick Start

### Step 1: Run Migrations (First-time Setup)

```bash
# Set up environment (if not already done)
# Edit .env.local with DW connection details — see .env.example [DWH_AlimentosNY] section

# Run all pending migrations — creates database, schema, tables, and stored procedures
bun run migrate:dwh
```

This creates the `DWH_AlimentosNY` database from scratch, applies all numbered migration files in order, and creates all `Load_Dim_*`, `Load_Fact_*`, and `Snapshot_*` stored procedures inside the database.

**Output after success**: All 13 migrations applied; DWH_AlimentosNY ready with empty tables.

### Step 2: Populate Data

Three paths: **full initial load** (first-time only), **incremental refresh** (ongoing via procedure calls), or **SQL Agent jobs** (production automation).

#### Path 1: Full Initial Load (First Run)

After migrations complete, manually run all load procedures **in order** via SQL:

```sql
USE DWH_AlimentosNY;

-- Load dimensions first (dependencies for facts)
EXEC dwh.Load_Dim_Currency;
EXEC dwh.Load_Fact_ExchangeRate;  -- depends on Dim_Currency

EXEC dwh.Load_Dim_Customer;       -- SCD Type 2 (tracks versions with ValidFrom/ValidTo)
EXEC dwh.Load_Dim_LegalEntity;    -- Legal entity grouping (reads Dim_Customer.MatrizCode)
EXEC dwh.Load_Dim_Product;        -- SCD Type 2
EXEC dwh.Load_Dim_SalesRep;       -- Type 1 (overwrite)
EXEC dwh.Load_Dim_Warehouse;      -- Type 1
-- Note: Dim_Date is pre-populated by migration 0003
-- Note: Dim_DocumentType is pre-seeded by migration 0007 (static, no loader needed)

-- Load facts (depend on all dims above)
EXEC dwh.Load_Fact_Sales;
EXEC dwh.Load_Fact_Returns;
EXEC dwh.Load_Fact_Collections;

-- Finally, take the first AR snapshot (daily job, separate from incremental)
EXEC dwh.Snapshot_Fact_AR;
```

This backfills the entire history from ERP:
- **Dim_Customer**, **Dim_Product** — all versions (SCD Type 2 with ValidFrom/ValidTo for time-travel)
- **Dim_SalesRep**, **Dim_Warehouse** — all current values (Type 1 overwrite)
- **Dim_Date** — pre-generated calendar (1 row per day, years ahead)
- **Dim_DocumentType** — pre-seeded static lookup (FACT, N/CR, N/DB, COBR, ANT, etc.)
- **Dim_Currency** — all currencies from ERP with IsBaseCurrency flag
- **Fact_Sales** — all historical invoices (saFacturaVenta + saFacturaVentaReng)
- **Fact_Returns** — all historical returns (saDevolucionCliente + saDevolucionClienteReng)
- **Fact_Collections** — all historical collections (saCobro + saCobroDocReng)
- **Fact_ExchangeRate** — historical daily rates (saTasa, from 2020-01-01 onward)
- **Fact_AR_Snapshot** — current AR state (as-of today; **historical snapshots cannot be backfilled**)

**Time**: ~30–60 seconds against the reference test database (~5k sales, ~4.6k sales lines); scale to production volume before running.

#### Path 2: Incremental Refresh (Ongoing — Manual)

After initial load, run load procedures on any schedule (every 15–30 min for near-real-time, or hourly if OLTP load is a concern). **Run in the same order as initial load:**

```sql
USE DWH_AlimentosNY;

-- Incremental load (repeat as often as needed)
EXEC dwh.Load_Dim_Currency;
EXEC dwh.Load_Fact_ExchangeRate;
EXEC dwh.Load_Dim_Customer;
EXEC dwh.Load_Dim_LegalEntity;
EXEC dwh.Load_Dim_Product;
EXEC dwh.Load_Dim_SalesRep;
EXEC dwh.Load_Dim_Warehouse;
EXEC dwh.Load_Fact_Sales;
EXEC dwh.Load_Fact_Returns;
EXEC dwh.Load_Fact_Collections;

-- Separate daily job (run once per day after business close):
EXEC dwh.Snapshot_Fact_AR;
```

**What it does**:
- Detects changed rows in ERP source tables since last run (via `validador` rowversion watermark)
- Updates or inserts corresponding rows in DWH dimensions and facts
- Tracks watermark progress in `dwh.EtlWatermark` table

**Daily AR Snapshot** (separate, run once daily after business close):
```sql
EXEC dwh.Snapshot_Fact_AR;
```

Captures point-in-time `saDocumentoVenta` balance state for that day.

Note: SQL Agent jobs for scheduling these automatically were removed (see git history, "Remove
job agents") — trigger `bun run dwh:incremental-load` / `bun run dwh:snapshot-load` externally
(cron, a scheduled task, CI, etc.) if automation is needed.

---

## Architecture Overview

### Database Layout

```
DWH_AlimentosNY (new database, same SQL Server instance as ERP)
├── dwh schema
│   ├── EtlWatermark          — incremental load progress tracking
│   ├── __dwh_migrations      — migration history (internal use)
│   ├── Load_Dim_*            — stored procedures: dimension loaders
│   ├── Load_Fact_*           — stored procedures: fact loaders
│   └── Snapshot_AR_*         — stored procedures: AR snapshot jobs
│
├── dim schema (Conformed Dimensions)
│   ├── Dim_Date              — calendar (Type 0, pre-generated)
│   ├── Dim_Customer          — customer master (SCD Type 2 — tracks versions over time)
│   ├── Dim_Product           — article/SKU master (SCD Type 2)
│   ├── Dim_SalesRep          — sales rep (Type 1 — overwrite)
│   ├── Dim_Warehouse         — warehouse/location (Type 1)
│   ├── Dim_Currency          — currency (Type 1)
│   └── Dim_DocumentType      — document type catalog (FACT, N/CR, N/DB, etc. — Type 1)
│
└── fact schema (Star Schema)
    ├── Fact_Sales            — sales transactions (grain: 1 row per invoice line)
    ├── Fact_Returns          — customer returns (grain: 1 row per return line)
    ├── Fact_Collections      — cash receipts (grain: 1 row per invoice paid)
    ├── Fact_AR_Snapshot      — daily A/R state (grain: 1 row per open invoice per snapshot date)
    └── Fact_ExchangeRate     — historical rates (grain: 1 row per currency per day)
```

### Source Mapping (ERP → DWH)

| Fact/Dim | Source Table(s) | Grain/Key Columns |
|---|---|---|
| **Fact_Sales** | `saFacturaVenta` (header) + `saFacturaVentaReng` (lines) | 1 row per `(doc_num, reng_num)` line |
| **Fact_Returns** | `saDevolucionCliente` (header) + `saDevolucionClienteReng` (lines) | 1 row per return line |
| **Fact_Collections** | `saCobro` (header) + `saCobroDocReng` (lines) | 1 row per payment applied to one invoice |
| **Fact_AR_Snapshot** | `saDocumentoVenta` (open balances) | 1 row per open invoice per snapshot date |
| **Fact_ExchangeRate** | `saTasa` | 1 row per currency per day |
| **Dim_Customer** | `saCliente` | 1 row per customer version (SCD2) |
| **Dim_Product** | `saArticulo` + `saCatArticulo` + `saLineaArticulo` + `saSubLinea` (denormalized) | 1 row per product version (SCD2) |
| **Dim_SalesRep** | `saVendedor` | 1 row per rep (Type 1) |
| **Dim_Warehouse** | `saAlmacen` | 1 row per warehouse (Type 1) |
| **Dim_Currency** | `saMoneda` | 1 row per currency (Type 1) |
| **Dim_DocumentType** | Hardcoded domain | Static lookup (FACT, N/CR, N/DB, COBR, ANT, …) |
| **Dim_Date** | Generated (not sourced) | 1 row per calendar day, pre-generated years ahead |

---

## Table Metadata

### Fact Tables

#### Fact_Sales
**Grain**: 1 row per invoice line (`saFacturaVentaReng`)  
**Source**: `Ncake_a.dbo.saFacturaVenta` (header) + `Ncake_a.dbo.saFacturaVentaReng` (lines)  
**Refresh**: Incremental (watermark: `saFacturaVentaReng.validador`)

| Column | Type | Source | Notes |
|---|---|---|---|
| `FactSalesKey` | bigint | IDENTITY | Surrogate key |
| `DateKey` | int | `saFacturaVenta.fec_emis` (YYYYMMDD format) | FK → `Dim_Date` |
| `CustomerKey` | int | `saFacturaVenta.co_cli` | FK → `Dim_Customer` (resolved to version active on `fec_emis`) |
| `ProductKey` | int | `saFacturaVentaReng.co_art` | FK → `Dim_Product` (resolved to version active on `fec_emis`) |
| `SalesRepKey` | int | `saFacturaVenta.co_ven` | FK → `Dim_SalesRep` |
| `WarehouseKey` | int | `saFacturaVentaReng.co_alma` | FK → `Dim_Warehouse` |
| `CurrencyKey` | int | `saFacturaVenta.co_mone` | FK → `Dim_Currency` |
| `DocumentTypeKey` | int | Constant: `'FACT'` | FK → `Dim_DocumentType` |
| `InvoiceNumber` | char(20) | `saFacturaVenta.doc_num` | Degenerate dim (drill-to-source) |
| `LineNumber` | int | `saFacturaVentaReng.reng_num` | Degenerate dim |
| `QuantitySold` | decimal(18,5) | `saFacturaVentaReng.total_art` | Units |
| `GrossAmount` | decimal(18,2) | `total_art × prec_vta` (before discount) | — |
| `DiscountAmount` | decimal(18,2) | `saFacturaVentaReng.monto_desc` + prorated `monto_desc_glob` | — |
| `TaxAmount` | decimal(18,2) | `monto_imp` + `monto_imp2` + `monto_imp3` | — |
| `NetAmount` | decimal(18,2) | `saFacturaVentaReng.reng_neto` | Net revenue (this row's contribution) |
| `UnitCost` | decimal(18,5) | `saCostoHistoricoSalida.costo_pro` | **Currently always `NULL`** — see "Cost Data Gap" below |
| `COGSAmount` | decimal(18,2) | `UnitCost × QuantitySold` | **Currently always `NULL`** |
| `GrossProfitAmount` | decimal(18,2) | `NetAmount - COGSAmount` | **Currently always `NULL`** |
| `CostSourceFlag` | varchar(20) | `'HISTORY'` or `'NO_COST_DATA'` | `'NO_COST_DATA'` for all rows (no cost data in ERP) |
| `DocumentExchangeRate` | decimal(21,8) | `saFacturaVenta.tasa` | Exchange rate baked into document (for reconciliation) |
| `IsVoided` | bit | `saFacturaVenta.anulado` | 0=real, 1=voided (kept at load time; BI layer filters) |
| `LoadedAtUtc` | datetime2(3) | SYSUTCDATETIME() | DWH load timestamp |

**Unique constraint**: `(InvoiceNumber, LineNumber)` — one row per source line, ensuring idempotent upserts.

**Cost Data Gap** ⚠️  
This installation has **never recorded production/manufacturing cost** for any finished good in Profit Plus. Verified findings:
- `saCostoHistoricoSalida`: 4,618 of 4,618 rows have `costo_pro = 0` (100% zero)
- `saCostoHistoricoEntrada`: 291 of 292 type-V rows are `costo = 0`
- `saArtCompuesto` (BOM): zero finished-goods articles modeled as compuestos
- `saArticulo.tipo_cos` is set to `'1'` (Último Costo/Last Cost) for all 65 active articles, but no cost values exist

**Impact**: Margin dashboards (Gross Margin Waterfall, Margin by Product) **cannot be built from ERP data as it exists today**. The `UnitCost`/`COGSAmount`/`GrossProfitAmount` columns exist as a reserved-but-unwired schema slot for a future cost source — `dwh.Load_Fact_Sales` currently inserts them as hardcoded `NULL, NULL, NULL, 'NO_COST_DATA'` with no join to any cost table at all (`dwh-migrations/0009_fact_sales.sql:117-122`), so nothing will populate them automatically; an upstream costing process AND a corresponding `Load_Fact_Sales` code change are both required before these columns hold real data. Do not build margin dashboards until this gap is resolved. See design spec §2 and §8 for details. (2026-09-15: the Finanzas tab's Margen Operativo now uses a Compras-based proxy for gross margin instead of waiting on this column — see the "Margen Operativo" workaround section below.)

#### Fact_Returns
**Grain**: 1 row per return line (`saDevolucionClienteReng`)  
**Source**: `Ncake_a.dbo.saDevolucionCliente` (header) + `Ncake_a.dbo.saDevolucionClienteReng` (lines)  
**Refresh**: Incremental (watermark: `saDevolucionClienteReng.validador`)  
**Column shape**: Identical dimensional FKs to `Fact_Sales`; measures are `QuantityReturned`, `GrossAmount`, `DiscountAmount`, `TaxAmount`, `NetAmount` (all from return lines). No cost/margin columns.

#### Fact_Collections
**Grain**: 1 row per payment line (`saCobroDocReng`) — one receipt applying to one invoice  
**Source**: `Ncake_a.dbo.saCobro` (header) + `Ncake_a.dbo.saCobroDocReng` (lines)  
**Refresh**: Incremental (watermark: `saCobroDocReng.validador`)

| Column | Type | Source | Notes |
|---|---|---|---|
| `FactCollectionsKey` | bigint | IDENTITY | Surrogate key |
| `DateKey` | int | `saCobro.fecha` | FK → `Dim_Date` |
| `CustomerKey` | int | `saCobro.co_cli` | FK → `Dim_Customer` |
| `SalesRepKey` | int | `saCobro.co_ven` | Collector (cross-ref `Dim_SalesRep.fun_cob` for Collections Efficiency) |
| `CurrencyKey` | int | `saCobro.co_mone` | FK → `Dim_Currency` |
| `InvoiceDocumentTypeKey` | int | `saCobroDocReng.co_tipo_doc` | Document type of invoice being paid (FACT, N/CR, etc.) |
| `ReceiptNumber` | char(20) | `saCobro.cob_num` | Cash receipt number |
| `InvoiceNumber` | char(20) | `saCobroDocReng.nro_doc` | Which invoice this payment is for (degenerate) |
| `AmountCollected` | decimal(18,2) | `saCobroDocReng.mont_cob` | Amount paid toward this invoice |
| `RetentionIVAAmount` | decimal(18,2) | `saCobroDocReng.monto_retencion_iva` | VAT withholding |
| `RetentionISLRAmount` | decimal(18,2) | `saCobroDocReng.monto_retencion` | ISLR withholding |
| `EarlyPaymentDiscountAmount` | decimal(18,2) | `saCobroDocReng.dpcobro_monto` | Early-pay discount applied |
| `DocumentExchangeRate` | decimal(21,8) | `saCobro.tasa` | Receipt exchange rate |
| `IsVoided` | bit | `saCobro.anulado` | 0=real, 1=voided |
| `LoadedAtUtc` | datetime2(3) | SYSUTCDATETIME() | DWH load timestamp |

#### Fact_AR_Snapshot
**Grain**: 1 row per open invoice per snapshot date  
**Source**: `Ncake_a.dbo.saDocumentoVenta` (all document types with outstanding balance)  
**Refresh**: Daily snapshot (separate SQL Agent job, **not** incremental)  
**Key difference**: This is a periodic snapshot fact, not a transaction fact. Profit Plus stores no history of `saldo` — the DWH becomes the system of record for AR history going forward. Historical snapshots before the DWH's first run cannot be backfilled.

| Column | Type | Source | Notes |
|---|---|---|---|
| `FactARSnapshotKey` | bigint | IDENTITY | Surrogate key |
| `SnapshotDateKey` | int | Date job ran | FK → `Dim_Date` |
| `CustomerKey` | int | `saDocumentoVenta.co_cli` | FK → `Dim_Customer` |
| `DocumentTypeKey` | int | `saDocumentoVenta.co_tipo_doc` | FK → `Dim_DocumentType` |
| `InvoiceNumber` | char(20) | `saDocumentoVenta.nro_doc` | Which document (degenerate) |
| `CurrencyKey` | int | `saDocumentoVenta.co_mone` | FK → `Dim_Currency` |
| `OutstandingBalance` | decimal(18,2) | `saDocumentoVenta.saldo` | In document currency, as of snapshot time |
| `DocumentExchangeRate` | decimal(21,8) | `saDocumentoVenta.tasa` | Document's own rate (for converted totals) |
| `DueDate` | date | `saDocumentoVenta.fec_venc` | — |
| `DaysPastDue` | int | `DATEDIFF(day, fec_venc, @SnapshotDate)` | Computed at load time |
| `AgingBucket` | varchar(10) | Derived: `'Current'`, `'1-30'`, `'31-60'`, `'61-90'`, `'>90'` | Computed from `DaysPastDue` |
| `IsCreditNote` | bit | `co_tipo_doc IN ('N/CR','NCR')` | Credit notes have `saldo > 0` but represent credit *to* customer (signed negative in aging totals) |
| `LoadedAtUtc` | datetime2(3) | SYSUTCDATETIME() | DWH load timestamp |

#### Fact_ExchangeRate
**Grain**: 1 row per currency per day  
**Source**: `Ncake_a.dbo.saTasa` (historical daily rates)  
**Refresh**: Incremental (watermark: `saTasa.validador`)

| Column | Type | Source | Notes |
|---|---|---|---|
| `FactExchangeRateKey` | bigint | IDENTITY | Surrogate key |
| `DateKey` | int | `saTasa.fecha` (YYYYMMDD) | FK → `Dim_Date` |
| `CurrencyKey` | int | `saTasa.co_mone` | FK → `Dim_Currency` |
| `BuyRate` | decimal(21,8) | `saTasa.tasa_c` | Rate paid when buying currency (cost rate) |
| `SellRate` | decimal(21,8) | `saTasa.tasa_v` | Rate paid when selling currency (vendor rate) |
| `LoadedAtUtc` | datetime2(3) | SYSUTCDATETIME() | DWH load timestamp |

### Dimension Tables

#### Dim_Customer
**Type**: SCD Type 2 (tracks versions over time with `ValidFrom`/`ValidTo`/`IsCurrent`)  
**Source**: `Ncake_a.dbo.saCliente`  
**Grain**: 1 row per customer version  
**Why SCD2**: Credit limits, zones, and segments change over time. Dashboards like "Credit Risk & Concentration" need the limit that was in force *when* a balance existed, not today's limit.

**⚠️ Customer-to-legal-entity multiplicity**: many customers have **multiple store/venue records** in the ERP that legally belong to one company — one `saCliente` row per location. Example: FARMATODO C.A has one corporate parent record and many individual store locations, each with its own `CustomerCode`. The dimension reflects store-level accounts. Aggregations at the legal-entity level (across all of a chain's stores) must join through `dim.Dim_LegalEntity` and group by `LegalEntityKey` — see [Legal Entity Rollup](#legal-entity-rollup-account-for-multi-store-customers) below. Do **not** group by `RIF`/`LegalEntityRIF` for this — see that section for why.

| Column | Type | Source | Notes |
|---|---|---|---|
| `CustomerKey` | int | IDENTITY | Surrogate key |
| `CustomerCode` | char(20) | `saCliente.co_cli` | Natural key (ERP ID, store-level) |
| `CustomerName` | varchar(200) | `saCliente.cli_des` | Business name |
| `TaxId` | varchar(20) | `saCliente.rif` | Tax ID (store-level, may be same as LegalEntityRIF) |
| `LegalEntityRIF` | varchar(20) | `saCliente.rif` | Own RIF, denormalized. **Not the legal-entity grouping key** — superseded by `LegalEntityKey`/`MatrizCode` (see below). Kept as-is for debugging/back-reference only; RIF-based grouping is known to produce false-positive groupings (distinct businesses that happen to share a fiscal RIF) and must not be used for rollups. |
| `MatrizCode` | char(16) | `saCliente.matriz` | Parent/casa-matriz `co_cli`, when this row is a store belonging to a chain (NULL for a standalone customer or a parent itself). Source for `LegalEntityKey` resolution — see `dwh.Load_Dim_LegalEntity`. |
| `LegalEntityKey` | int | Derived (`dwh.Load_Dim_LegalEntity`) | FK to `dim.Dim_LegalEntity` — **the correct grouping key for legal-entity rollups**. Every current row resolves to exactly one entity (never NULL): a chain's parent and all its children share the same `LegalEntityKey`; a standalone customer is its own entity of size 1. |
| `IsSpecialContributor` | bit | `saCliente.contrib` | Special contributor status (SENIAT) |
| `DefaultSalesRepCode` | char(20) | `saCliente.co_ven` | Default sales rep for this customer |
| `CreditLimit` | decimal(18,2) | `saCliente.mont_cre` | Credit limit (in original currency) |
| `CreditLimitCurrency` | char(6) | `saCliente.co_mone` | Currency of credit limit |
| `ZoneCode` | char(6) | `saCliente.co_zon` | Geographic/sales zone |
| `SegmentCode` | char(6) | `saCliente.co_seg` | Customer segment (key for concentration risk) |
| `IsInactive` | bit | `saCliente.inactivo` | Soft-delete flag (1=inactive) |
| `IsLegalEntity` | bit | `saCliente.juridico` | Business type (1=legal entity, 0=natural person) |
| `ValidFrom` | datetime2(3) | DWH load time | When this version became active |
| `ValidTo` | datetime2(3) | DWH load time | When this version was superseded (NULL if current) |
| `IsCurrent` | bit | Derived | 1 if this is the active version |
| `LoadedAtUtc` | datetime2(3) | SYSUTCDATETIME() | DWH load timestamp |

#### Dim_LegalEntity
**Type**: Type 1 (overwrite) — no time-travel need identified for entity membership.
**Source**: derived from `dim.Dim_Customer` (via `MatrizCode`), populated by `dwh.Load_Dim_LegalEntity`, which runs immediately after `Load_Dim_Customer` (it depends on `Dim_Customer.MatrizCode`).
**Grain**: 1 row per legal entity — a multi-store chain, or a standalone customer counted as an entity of size 1.

| Column | Type | Source | Notes |
|---|---|---|---|
| `LegalEntityKey` | int | IDENTITY | Surrogate key — this is what `Dim_Customer.LegalEntityKey` points to |
| `RootCustomerCode` | char(16) | Derived | The `co_cli` anchoring this entity: the parent's code for a chain, or the customer's own code if standalone |
| `LegalEntityName` | varchar(120) | Derived | Parent's `cli_des` for a chain; the customer's own name if standalone |
| `StoreCount` | int | Derived | Count of `Dim_Customer` rows resolving to this entity, including the parent/root itself |
| `LoadedAtUtc` | datetime2(3) | SYSUTCDATETIME() | DWH load timestamp |

See `docs/superpowers/specs/2026-09-10-customer-legal-entity-grouping-design.md` §2-3 for the full grouping-mechanism rationale (why `saCliente.matriz`, not RIF matching) and the exact resolution algorithm.

#### Dim_Product
**Type**: SCD Type 2  
**Source**: `Ncake_a.dbo.saArticulo` + `saCatArticulo` + `saLineaArticulo` + `saSubLinea` (denormalized)  
**Grain**: 1 row per product version  
**Why SCD2**: Category reclassifications and product status changes affect historical margin-by-category trends.

| Column | Type | Source | Notes |
|---|---|---|---|
| `ProductKey` | int | IDENTITY | Surrogate key |
| `ProductCode` | char(30) | `saArticulo.co_art` | Natural key (SKU) |
| `ProductName` | varchar(200) | `saArticulo.art_des` | Description |
| `ProductType` | char(1) | `saArticulo.tipo` | V=finished goods, C=component, S=service, F=raw, M=semi-finished, N=no-invoiceable, E=package |
| `CostingMethod` | char(1) | `saArticulo.tipo_cos` | 1=Last Cost, 2=Average Cost, 3=FIFO, 4=LIFO |
| `LineCode` | char(6) | `saArticulo.co_lin` | Product line |
| `LineName` | varchar(200) | `saLineaArticulo.lin_des` | Line description |
| `CategoryCode` | char(6) | `saCatArticulo.co_cat` | Product category |
| `CategoryName` | varchar(200) | `saCatArticulo.cat_des` | Category description |
| `SublineCode` | char(6) | `saSubLinea.co_subl` | Product subline (finer grouping) |
| `MinMargin` | decimal(18,2) | `saArticulo.margen_min` | Minimum margin policy |
| `MaxMargin` | decimal(18,2) | `saArticulo.margen_max` | Maximum margin policy |
| `IsActive` | bit | NOT `saArticulo.anulado` | 1=active, 0=inactive/deleted |
| `ValidFrom` | datetime2(3) | DWH load time | When this version became active |
| `ValidTo` | datetime2(3) | DWH load time | When superseded (NULL if current) |
| `IsCurrent` | bit | Derived | 1 if active version |
| `LoadedAtUtc` | datetime2(3) | SYSUTCDATETIME() | DWH load timestamp |

#### Dim_SalesRep
**Type**: Type 1 (overwrite — low change volume in this installation)  
**Source**: `Ncake_a.dbo.saVendedor`  
**Grain**: 1 row per rep

| Column | Type | Source | Notes |
|---|---|---|---|
| `SalesRepKey` | int | IDENTITY | Surrogate key |
| `SalesRepCode` | char(20) | `saVendedor.co_ven` | Natural key (ERP ID) |
| `SalesRepName` | varchar(200) | `saVendedor.ven_des` | Name |
| `RepType` | char(1) | `saVendedor.tipo` | V=vendedor (sales rep), C=cobrador (collector), A=agente (agent) |
| `IsSalesRep` | bit | `tipo IN ('V','A')` | True if can record sales |
| `IsCollector` | bit | `tipo IN ('C','A')` | True if can record collections |
| `CommissionPercentage` | decimal(5,2) | `saVendedor.comision` | Commission rate (%) |
| `ZoneCode` | char(6) | `saVendedor.co_zon` | Territory |
| `IsInactive` | bit | `saVendedor.inactivo` | Soft-delete flag |
| `LoadedAtUtc` | datetime2(3) | SYSUTCDATETIME() | DWH load timestamp |

#### Dim_Warehouse
**Type**: Type 1  
**Source**: `Ncake_a.dbo.saAlmacen`  
**Grain**: 1 row per warehouse

| Column | Type | Source | Notes |
|---|---|---|---|
| `WarehouseKey` | int | IDENTITY | Surrogate key |
| `WarehouseCode` | char(6) | `saAlmacen.co_alma` | Natural key |
| `WarehouseName` | varchar(200) | `saAlmacen.des_alma` | Name |
| `IsRetailLocation` | bit | NOT `saAlmacen.noventa` | 1=sales location (store/showroom), 0=back warehouse |
| `IsPurchaseWarehouse` | bit | NOT `saAlmacen.nocompra` | 1=receives purchase orders |
| `IsRawMaterialsLocation` | bit | `saAlmacen.materiales` | 1=raw/component storage |
| `IsProductionLocation` | bit | `saAlmacen.produccion` | 1=manufacturing/assembly location |
| `HasRealStock` | bit | Derived | 1 if ever held non-zero stock (noise filter: only 2 of 52 warehouses hold real stock) |
| `LoadedAtUtc` | datetime2(3) | SYSUTCDATETIME() | DWH load timestamp |

#### Dim_Currency
**Type**: Type 1  
**Source**: `Ncake_a.dbo.saMoneda`  
**Grain**: 1 row per currency

| Column | Type | Source | Notes |
|---|---|---|---|
| `CurrencyKey` | int | IDENTITY | Surrogate key |
| `CurrencyCode` | char(6) | `saMoneda.co_mone` | Natural key (ISO-ish code, padded `char(6)`) |
| `CurrencyName` | varchar(200) | `saMoneda.mone_des` | Description |
| `IsBaseCurrency` | bit | `saMoneda.cambio = 1` | **Always dynamically computed, never hardcoded.** Base currency in this installation is 'BS    ' (Bolívares), not 'VES'. |
| `LoadedAtUtc` | datetime2(3) | SYSUTCDATETIME() | DWH load timestamp |

**Important**: Base currency resolution is dynamic (`WHERE cambio = 1`), never hardcoded. Previous installations have used `'VES'`, but this one uses `'BS'` (padded `char(6)`). See design spec §2.

#### Dim_DocumentType
**Type**: Static lookup (hardcoded from ERP domain)  
**Source**: Hardcoded domain (not loaded from ERP table)  
**Grain**: 1 row per document type

| Column | Type | Notes |
|---|---|---|
| `DocumentTypeKey` | int | Surrogate key |
| `DocumentTypeCode` | char(6) | Natural key (FACT, N/CR, N/DB, COBR, ANT, etc.) |
| `DocumentTypeDescription` | varchar(200) | Human-readable name |
| `IsCredit` | bit | 1 if credit note (affects sign convention) |
| `AffectsAR` | bit | 1 if affects accounts receivable (invoice, credit, debit, collection) |

#### Dim_Date
**Type**: Type 0 (static, pre-generated)  
**Source**: Generated (not sourced from ERP)  
**Grain**: 1 row per calendar day (pre-generated years into future)

| Column | Type | Notes |
|---|---|---|
| `DateKey` | int | YYYYMMDD format (e.g., 20260901) |
| `FullDate` | date | Actual calendar date |
| `Year` | int | — |
| `Month` | int | 1–12 |
| `DayOfMonth` | int | 1–31 |
| `Quarter` | int | 1–4 |
| `MonthName` | varchar(20) | 'January', 'February', etc. |
| `DayName` | varchar(20) | 'Monday', 'Tuesday', etc. |
| `IsWeekend` | bit | 1 if Saturday or Sunday |
| `WeekNumber` | int | ISO week number |
| `FiscalYear` | int | Same as `Year` (no separate fiscal calendar in use) |
| `FiscalMonth` | int | Same as `Month` (no separate fiscal calendar in use) |

---

## Lineage & Data Flow

### Incremental Load Watermark Strategy

The DWH tracks incremental progress using **`validador` (SQL rowversion)**:
- **Monotonic**: Always increases with each change, collision-free
- **Never backdated**: Unlike `fe_us_mo` (a human/app-editable datetime), rowversion cannot be backdated by admin scripts
- **Per-table tracking**: `dwh.EtlWatermark` maintains one row per source table being loaded

**Detail tables without rowversion**:
- `saFacturaVentaReng`, `saDevolucionClienteReng`, `saCobroDocReng` — the three "Reng" detail tables — have **no `validador` column**
- Workaround: Watermark uses **`fe_us_mo` (datetime)** for these tables instead; acknowledged trade-off (see design spec §5)
- Each fact table therefore maintains **two watermark rows**:
  - One for the header table (using `LastValidador`)
  - One for the detail table (using `LastValidatorDateTime`)

Example (Fact_Sales):
```sql
SELECT SourceTableName, LastValidador, LastValidatorDateTime, LastRowsProcessed, LastRunAtUtc
FROM dwh.EtlWatermark
WHERE SourceTableName IN ('saFacturaVenta', 'saFacturaVentaReng');
```

### Load Order (Dependency-Driven)

```
1. Dim_Date                  (once, pre-generated)
   ↓
2. Dim_Currency ──→ Fact_ExchangeRate
   ↓
3. Dim_Customer (SCD2)
   Dim_Product (SCD2)
   Dim_SalesRep (Type 1)
   Dim_Warehouse (Type 1)
   Dim_DocumentType (static)
   ↓
4. Fact_Sales ────┐
   Fact_Returns ──┼─ (all depend on dims above)
   Fact_Collections ─┘
   ↓
5. Fact_AR_Snapshot (separate daily job, not incremental)
```

Each `Load_*` stored procedure:
1. Reads current watermark from `dwh.EtlWatermark`
2. Fetches changed rows from ERP since watermark (`WHERE validador > @Watermark`)
3. Runs `MERGE` to insert/update/delete in DWH
4. Advances watermark to new maximum `validador`
5. Updates load metadata (rows processed, timestamp)

---

## Environments & Migration

### Environment Variables

Create `.env.local` with DWH connection details (or reuse existing `DB_*` if on same instance):

```env
# ─── ERP Source (Profit Plus) ─────────────────────
DB_SERVER=192.168.1.100
DB_PORT=1433
DB_NAME=Ncake_a
DB_USER=erp_user
DB_PASSWORD=changeme
DB_ENCRYPT=false
DB_TRUST_SERVER_CERT=true

# ─── DWH Target (same instance, different database) ──
DW_SERVER=192.168.1.100          # (optional, defaults to DB_SERVER)
DW_PORT=1433                      # (optional, defaults to DB_PORT)
DW_NAME=DWH_AlimentosNY           # (optional, defaults to 'DWH_AlimentosNY')
DW_USER=dwh_user                  # (optional, defaults to DB_USER)
DW_PASSWORD=changeme              # (optional, defaults to DB_PASSWORD)
```

The runner falls back to `DB_*` values if `DW_*` are unset, so on a single instance you can omit all `DW_*` vars.

### Running Migrations

```bash
# Apply all pending migrations in sequence
bun run migrate:dwh
```

This:
1. Creates `DWH_AlimentosNY` database (connecting to `master` first)
2. Applies all 13 numbered `.sql` files from `dwh-migrations/` in order
3. Creates all stored procedures inside the DWH database
4. Initializes the `dwh.EtlWatermark` tracking table
5. Pre-populates `Dim_Date` calendar (migration 0003)

**Output**: Database and all tables ready with empty rows; stored procedures in place.

### First-Time Data Load

After migrations complete, run all load procedures **in SQL** (see "Step 2: Populate Data" above for the exact T-SQL commands). The procedures:
- Load all historical customers, products, sales reps, warehouses (dimensions)
- Load all invoices, returns, and collections since ERP go-live (facts)
- Load all historical daily exchange rates (since 2020-01-01)
- Take initial AR snapshot (as-of today) — **no historical AR snapshots can be backfilled**

---

## Known Limitations & Gaps

### 1. Cost Data Gap ⚠️
**Impact**: Margin dashboards (Gross Margin Waterfall, Margin by Product) cannot be built.

**Finding**: No production/manufacturing cost has ever been recorded in this Profit Plus installation:
- `saCostoHistoricoSalida`: 100% of rows have `costo_pro = 0`
- `saCostoHistoricoEntrada`: 99% of type-V rows are `costo = 0`
- `saArtCompuesto` (BOM): zero finished-goods articles modeled as compuestos
- No recipe-cost or costing workflow exists

**Workaround**: `Fact_Sales.UnitCost`/`COGSAmount`/`GrossProfitAmount` columns exist as a reserved schema slot for a future cost source but are **not** wired to any live data path — `dwh.Load_Fact_Sales` inserts them as hardcoded `NULL, NULL, NULL, 'NO_COST_DATA'` (`dwh-migrations/0009_fact_sales.sql:117-122`), with no join to any cost table. Populating them for real requires both an upstream costing process in Profit Plus AND a `Load_Fact_Sales` code change — this is not automatic.

**"Margen Operativo" workaround (shipped 2026-09-14, renamed from
"EBITDA" 2026-09-14):** the Finanzas tab shows a cash-basis operating margin
computed from bank/cash movements (`fact.Fact_CashMovements`,
`Ingresos Operativos − Gastos Operativos`) instead of `Fact_Sales`'s
COGS/GrossProfit columns — see
`docs/superpowers/specs/2026-09-14-cash-movement-ebitda-design.md`. The sales
waterfall's `Utilidad Bruta`/`Margen bruto` figures are still driven by
`Fact_Sales` and remain `0`/unusable for margin reporting until this gap is
closed upstream.

**Accrual revision (2026-09-15):** the cash-ledger-only calculation above
understated real operating expense by ~4.5x (live-verified: 90-day cash-ledger
Gastos ~7.26M vs. `Fact_Purchases.NetAmount` ~32.6M for the same window) —
Profit Plus records purchase invoices reliably but not their eventual bank
settlement promptly. Margen Operativo now sources Ingresos from
`Fact_Sales.NetAmount − Fact_Returns.NetAmount` and Gastos Operativos from
`dwh.vw_GastosOperativos` (`dwh-migrations/0026_gastos_operativos_view.sql`),
a view unioning `Fact_Purchases` ("Compras") with non-`MateriaPrima`
`Fact_CashMovements` Gasto categories — see
`docs/superpowers/specs/2026-09-15-margen-operativo-accrual-design.md`.

**Utilidad Bruta (proxy) addition (2026-09-15):** the Finanzas tab's old
`Fact_Sales`-based waterfall (`Bruto → Descuento → Neto → COGS → Utilidad
Bruta`) was always `0`/unusable for margin reporting, for the same Cost Data
Gap reason documented above — it has been removed. In its place, the
waterfall now shows a **proxy** gross margin using Compras as a stand-in for
COGS: `Utilidad Bruta (proxy) = Ingresos Operativos − Compras` (where
Compras is the `dwh.vw_GastosOperativos` `'Compras'` category, i.e.
`Fact_Purchases`), with `Margen Bruto % = Utilidad Bruta / Ingresos`. This is
explicitly a proxy (Compras ≠ COGS — it includes non-resold purchases and
excludes labor/overhead), distinct from Margen Operativo (which nets against
*all* of `dwh.vw_GastosOperativos`, not just Compras): `Margen Operativo =
Utilidad Bruta (proxy) − Otros Gastos Operativos` (`dwh.vw_GastosOperativos`
minus its Compras rows), with `Margen Operativo % = Margen Operativo /
Ingresos`. Both percentages are new fields on the Finanzas API response
(`FinanzasResponse.margenProxy`) — see
`docs/superpowers/specs/2026-09-15-analitica-ui-and-margin-design.md` Part 2.

Deliberately **not** labeled EBITDA: it cannot isolate production cost from
admin/sales cost, so it is not "earnings before" anything in the accounting
sense — see the cost-center gap below.

**Cost-center gap (found 2026-09-14):** Gastos Operativos cannot be split by
cost center (production vs. administration vs. sales), which would be
required to compute a true operating margin that excludes non-production
payroll. Investigated: `saMovimientoBanco.dis_cen` (an XML column meant for
cost-center distribution, referencing real cost centers in
`Ncake_a.dbo.scCentro`) is `NULL` on 100% of Nomina-category rows checked,
including rows whose concept name explicitly says "Produccion" —
`saDistribCosto` (the dedicated cost-distribution table) has 0 rows. Neither
mechanism has ever been used in this installation, same pattern as the
cost-of-goods gap above. The only usable signal is the expense concept's
NAME (`dim.Dim_ExpenseConcept.CostCenter`, seeded in
`dwh-migrations/0024_nomina_cost_center.sql` from keyword matches like
"Nomina Produc" vs. "Nomina personal administrativo") — that covers only
6.6% of Nomina volume; the remaining 93.4%, including the single largest
Nomina line ("NOMINA POR PAGAR", ~38% of Nomina by itself), is a generic
payable/clearing concept with no cost-center signal anywhere in the source
data and is shown as "Sin clasificar" in the Finanzas tab's Nomina
drilldown.

**Action**: Establish a costing process in Profit Plus upstream (BOM/compuestos, manual cost entry, or external costing feed) before margin dashboards can be scoped. A true production-cost split additionally requires this installation to start actually populating `dis_cen`/`saDistribCosto` (or an equivalent payroll cost-allocation process) — the schema support already exists, it's simply never been used.

### 2. AR Snapshot — No Historical Backfill
**Impact**: DSO and aging-trend dashboards only show data from DWH go-live date forward.

**Reason**: Profit Plus stores no history of outstanding balances (`saldo` column). Each day the DWH snapshots the current state; reversing time is not possible without that history.

**Accepted limitation**: Flagged as known, not a defect.

### 3. Small Test Database Volume
**Note**: All performance data and load timings in the design plan were collected against the reference test database (~5k sales, ~4.6k sales lines), which is far smaller than production. Re-verify load times, index effectiveness, and schedule intervals against real production volume before tuning.

---

## Cleanup: Removing `/ddl` Directory

The `/ddl` directory contains **obsolete DDL** from Phase 1 of the DWH project (when schema was created via standalone SQL files). It should be deleted:

```bash
# These files are no longer used — migrations replaced them
rm -rf ddl/

# Commit cleanup
git add -A
git commit -m "chore: remove obsolete /ddl directory (replaced by dwh-migrations/)"
```

**Why safe to delete**:
- `ddl/01_dw_profit_schema.sql` — defines old `stg`/`ops`/`dw`/`snap` schemas (not used by current DWH)
- `ddl/02_analytics_views.sql` — defines old analytics views (not used by current DWH)
- All current DWH structure lives in `dwh-migrations/` and is applied by `bun run migrate:dwh`

---

## Quick Reference: Common Queries

### Check DWH Health
```sql
USE DWH_AlimentosNY;

-- Last load run for each source table
SELECT SourceTableName, LastRunAtUtc, LastRowsProcessed, LastValidador
FROM dwh.EtlWatermark
ORDER BY SourceTableName;

-- Row counts by fact table
SELECT
    (SELECT COUNT(*) FROM fact.Fact_Sales) AS Fact_Sales_Rows,
    (SELECT COUNT(*) FROM fact.Fact_Returns) AS Fact_Returns_Rows,
    (SELECT COUNT(*) FROM fact.Fact_Collections) AS Fact_Collections_Rows,
    (SELECT COUNT(*) FROM fact.Fact_AR_Snapshot) AS Fact_AR_Snapshot_Rows,
    (SELECT COUNT(*) FROM fact.Fact_ExchangeRate) AS Fact_ExchangeRate_Rows;

-- Customer count (current versions only)
SELECT COUNT(*) AS Active_Customers FROM dim.Dim_Customer WHERE IsCurrent = 1;

-- Product count (current versions only)
SELECT COUNT(*) AS Active_Products FROM dim.Dim_Product WHERE IsCurrent = 1 AND ProductType = 'V';
```

### Net Revenue (Sales − Returns)
```sql
SELECT
    dt.Year, dt.Month, dt.MonthName,
    SUM(fs.NetAmount) AS Gross_Sales,
    SUM(fr.NetAmount) AS Returns_Deduction,
    SUM(fs.NetAmount) - SUM(fr.NetAmount) AS Net_Revenue
FROM fact.Fact_Sales fs
LEFT JOIN fact.Fact_Returns fr ON fs.DateKey = fr.DateKey AND fs.CustomerKey = fr.CustomerKey
LEFT JOIN dim.Dim_Date dt ON fs.DateKey = dt.DateKey
WHERE fs.IsVoided = 0 AND fr.IsVoided = 0
GROUP BY dt.Year, dt.Month, dt.MonthName
ORDER BY dt.Year DESC, dt.Month DESC;
```

### AR Aging (Current)
```sql
SELECT
    AgingBucket,
    COUNT(DISTINCT InvoiceNumber) AS Num_Invoices,
    SUM(OutstandingBalance) AS Total_Outstanding
FROM fact.Fact_AR_Snapshot
WHERE SnapshotDateKey = (SELECT MAX(SnapshotDateKey) FROM fact.Fact_AR_Snapshot)
  AND IsCreditNote = 0  -- exclude credit notes from aging totals
GROUP BY AgingBucket
ORDER BY CASE
    WHEN AgingBucket = 'Current' THEN 0
    WHEN AgingBucket = '1-30' THEN 1
    WHEN AgingBucket = '31-60' THEN 2
    WHEN AgingBucket = '61-90' THEN 3
    ELSE 4 END;
```

### Legal Entity Rollup (Account for Multi-Store Customers)
Many customers have multiple store/venue records that legally belong to one company (e.g., FARMATODO C.A has one corporate parent record but many individual store locations, each its own `saCliente`/`Dim_Customer` row). To aggregate at the **legal entity level**, join through `dim.Dim_LegalEntity` and group by `LegalEntityKey`:

```sql
-- Collections by legal entity — each location's receipts summed under its chain
SELECT
    le.LegalEntityKey,
    le.LegalEntityName,
    le.StoreCount,
    COUNT(DISTINCT fc.ReceiptNumber) AS Num_Receipts,
    SUM(fc.AmountCollected) AS Total_Collections
FROM fact.Fact_Collections fc
INNER JOIN dim.Dim_Customer dc ON fc.CustomerKey = dc.CustomerKey AND dc.IsCurrent = 1
INNER JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = dc.LegalEntityKey
WHERE fc.DateKey >= 20260801
GROUP BY le.LegalEntityKey, le.LegalEntityName, le.StoreCount
ORDER BY Total_Collections DESC;

-- With store-level breakout (hierarchical):
SELECT
    le.LegalEntityKey,
    le.LegalEntityName,
    dc.CustomerCode,
    dc.CustomerName,
    COUNT(DISTINCT fc.ReceiptNumber) AS Num_Receipts,
    SUM(fc.AmountCollected) AS Total_Collections
FROM fact.Fact_Collections fc
INNER JOIN dim.Dim_Customer dc ON fc.CustomerKey = dc.CustomerKey AND dc.IsCurrent = 1
INNER JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = dc.LegalEntityKey
WHERE fc.DateKey >= 20260801
GROUP BY le.LegalEntityKey, le.LegalEntityName, dc.CustomerCode, dc.CustomerName
ORDER BY le.LegalEntityKey, Total_Collections DESC;
```

`LegalEntityKey` is populated by `dwh.Load_Dim_LegalEntity` from `saCliente.matriz` (Profit's own parent/casa-matriz link — see `pSucursalesVsCasaMatriz`), which runs immediately after `Load_Dim_Customer` in every load path (Quick Start above, and `scripts/dwh-incremental-load.ts`). Every current `Dim_Customer` row resolves to exactly one `LegalEntityKey` (never NULL): a chain's parent and all its stores share one entity; a standalone customer is its own entity of size 1 (`StoreCount = 1`).

**⚠️ Do not group by `RIF`/`LegalEntityRIF` for this.** An earlier version of this guide recommended `GROUP BY dc.LegalEntityRIF` — that approach was investigated and rejected: several RIF-sharing pairs found in live data (e.g. two automercado chains and two other unrelated businesses) turned out to be **distinct companies that happen to share a fiscal RIF** for legitimate reasons unrelated to being one retail chain, so RIF-only grouping produces false-positive merges. `saCliente.matriz` is an explicit, intentional link Profit's own data entry sets and does not have this failure mode. `Dim_Customer.LegalEntityRIF` still exists in the schema and is still populated (own RIF per row) but is kept only for debugging/back-reference — see `docs/superpowers/specs/2026-09-10-customer-legal-entity-grouping-design.md` §2 for the full investigation and rationale.

**Performance note**: `LegalEntityKey` is indexed (`IX_Dim_Customer_LegalEntityKey`), so GROUP BY on it is efficient even with millions of fact rows.

---

## Implementation Status

✓ **Design**: Approved spec `2026-08-25-sales-margin-collections-dwh-design.md`  
✓ **Schema**: All 13 migrations implemented (`dwh-migrations/0001_...0013`)  
✓ **Tables**: 12 tables created (7 dimensions + 5 facts)  
✓ **Procedures**: All `Load_Dim_*`, `Load_Fact_*`, and `Snapshot_*` stored procedures created  

⚠️ **Data**: Tables empty until you run `EXEC dwh.Load_*` procedures (see Quick Start)  
⚠️ **TypeScript load scripts**: Not implemented (migrations create T-SQL procedures only)  

## Workflows

**New DWH from scratch**:
```bash
bun run migrate:dwh           # Step 1: Create database, schema, procedures
# Then in SQL Server Studio:
# EXEC dwh.Load_Dim_Currency; EXEC dwh.Load_Fact_ExchangeRate; ...  (see Quick Start)
```

**Regular incremental refresh** (repeat on schedule):
```sql
-- Every 15–30 minutes (or as needed for near-real-time freshness)
EXEC dwh.Load_Dim_Currency;
EXEC dwh.Load_Fact_ExchangeRate;
EXEC dwh.Load_Dim_Customer;
EXEC dwh.Load_Dim_LegalEntity;
EXEC dwh.Load_Dim_Product;
EXEC dwh.Load_Dim_SalesRep;
EXEC dwh.Load_Dim_Warehouse;
EXEC dwh.Load_Fact_Sales;
EXEC dwh.Load_Fact_Returns;
EXEC dwh.Load_Fact_Collections;

-- Separate: Run once daily after business close
EXEC dwh.Snapshot_Fact_AR;
```

**Production automation**: SQL Agent jobs for this were removed (see git history, "Remove job
agents"). Trigger `bun run dwh:incremental-load` and `bun run dwh:snapshot-load` externally
(cron, a scheduled task, CI, etc.) if automation is needed.

## References

- **Design Spec**: `docs/superpowers/specs/2026-08-25-sales-margin-collections-dwh-design.md`
- **Implementation Plan**: `docs/superpowers/plans/2026-08-25-sales-returns-collections-dwh.md`
- **Migrations**: `dwh-migrations/` (13 files, apply in order via `bun run migrate:dwh`)
- **Migration Runner**: `scripts/migrate-dwh.ts` (TypeScript runner)
- **Load Procedures**: Inside `DWH_AlimentosNY` database, `dwh` schema (created by migrations)
- **ERP Knowledge Base**: `docs/tables/*.md` (source table documentation)
