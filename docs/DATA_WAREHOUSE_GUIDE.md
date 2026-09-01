# Data Warehouse Guide — DWH_AlimentosNY

**Status**: Fully implemented per `2026-08-25-sales-margin-collections-dwh-design.md`  
**Last updated**: 2026-09-01

---

## Quick Start

### Running Migrations (First-time Setup)

```bash
# Set up environment (if not already done)
# Edit .env.local with DW connection details — see .env.example [DWH_AlimentosNY] section

# Run all pending migrations
bun run migrate:dwh
```

This creates the `DWH_AlimentosNY` database from scratch and applies all numbered migration files in order.

### Populating Data

Two paths: **full initial load** (first-time only) or **incremental refresh** (ongoing).

#### Path 1: Full Initial Load (First Run)

The migration runner (`migrate:dwh`) creates empty tables. After migrations complete:

```bash
# Load all dimensions and facts from ERP (Ncake_a) — first-time full snapshot
bun run load:dwh-initial
```

This runs all `Load_Dim_*` and `Load_Fact_*` stored procedures once to backfill the entire history.

**What it loads**:
- `Dim_Date` — calendar table (pre-generated, years into future)
- `Dim_Customer`, `Dim_Product`, `Dim_SalesRep`, `Dim_Warehouse`, `Dim_Currency`, `Dim_DocumentType`
- `Fact_Sales` — all historical invoices (saFacturaVenta + saFacturaVentaReng)
- `Fact_Returns` — all historical returns (saDevolucionCliente + saDevolucionClienteReng)
- `Fact_Collections` — all historical collections (saCobro + saCobroDocReng)
- `Fact_ExchangeRate` — historical daily rates (saTasa)
- `Fact_AR_Snapshot` — current AR state (as-of today; **historical snapshots cannot be backfilled**)

**Time**: ~30–60 seconds against the reference test database (~5k sales, ~4.6k sales lines); scale to production volume before running.

#### Path 2: Incremental Refresh (Ongoing)

After initial load, run this on a schedule (every 15–30 min for near-real-time, or hourly if OLTP load is a concern):

```bash
# Via TypeScript (development)
bun run load:dwh-incremental

# Via SQL Agent job (production, after setup step below)
-- Job runs automatically per schedule configured in SQL Server Agent
```

**What it does**:
- Detects changed rows in ERP source tables since last run (via `validador` rowversion watermark)
- Updates or inserts corresponding rows in DWH dimensions and facts
- Tracks watermark progress in `dwh.EtlWatermark` table

**AR Snapshot job** (daily, separate from incremental):
```bash
bun run load:dwh-ar-snapshot
```

Runs once daily (recommend after business close, e.g. 22:00) to capture point-in-time `saDocumentoVenta` balance state.

#### Path 3: Production SQL Agent Jobs (After Initial Load)

To automate incremental loads and AR snapshots in production, enable the two jobs created by migration `0013_sql_agent_jobs.sql`:

```sql
-- Enable Incremental Load job
EXEC msdb.dbo.sp_update_job @job_name = N'DWH - Incremental Load', @enabled = 1;
EXEC msdb.dbo.sp_add_jobschedule @job_name = N'DWH - Incremental Load', @name = N'Every 30 min', 
    @freq_type = 4, @freq_interval = 1, @freq_subday_type = 4, @freq_subday_interval = 30;

-- Enable Daily AR Snapshot job
EXEC msdb.dbo.sp_update_job @job_name = N'DWH - Daily AR Snapshot', @enabled = 1;
EXEC msdb.dbo.sp_add_jobschedule @job_name = N'DWH - Daily AR Snapshot', @name = N'Daily after close',
    @freq_type = 4, @freq_interval = 1, @freq_subday_type = 1, @active_start_time = 220000;
```

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

**Impact**: Margin dashboards (Gross Margin Waterfall, Margin by Product) **cannot be built from ERP data as it exists today**. The `UnitCost`/`COGSAmount`/`GrossProfitAmount` columns are wired into the schema and will populate automatically when cost data starts flowing, but do not build margin dashboards until this gap is resolved. See design spec §2 and §8 for details.

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

| Column | Type | Source | Notes |
|---|---|---|---|
| `CustomerKey` | int | IDENTITY | Surrogate key |
| `CustomerCode` | char(20) | `saCliente.co_cli` | Natural key (ERP ID) |
| `CustomerName` | varchar(200) | `saCliente.cli_des` | Business name |
| `RIF` | varchar(20) | `saCliente.rif` | Tax ID |
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

# Output:
# Running dwh-migrations/0001_create_database.sql...
# Running dwh-migrations/0002_create_schemas_and_watermark_table.sql...
# ... (all 13 migrations) ...
# ✓ All migrations applied successfully
```

### First-Time Data Load

After migrations complete:

```bash
# Full initial load — backfills all history from ERP
bun run load:dwh-initial
```

This loads:
- All historical customers, products, sales reps, warehouses
- All invoices, returns, and collections since ERP go-live
- All historical daily exchange rates
- Current AR state (as-of today) — **no historical AR snapshots can be backfilled**

---

## Known Limitations & Gaps

### 1. Cost Data Gap ⚠️
**Impact**: Margin dashboards (Gross Margin Waterfall, Margin by Product) cannot be built.

**Finding**: No production/manufacturing cost has ever been recorded in this Profit Plus installation:
- `saCostoHistoricoSalida`: 100% of rows have `costo_pro = 0`
- `saCostoHistoricoEntrada`: 99% of type-V rows are `costo = 0`
- `saArtCompuesto` (BOM): zero finished-goods articles modeled as compuestos
- No recipe-cost or costing workflow exists

**Workaround**: `Fact_Sales.UnitCost`/`COGSAmount`/`GrossProfitAmount` columns exist and are wired to auto-populate when cost data flows; currently always `NULL` with `CostSourceFlag = 'NO_COST_DATA'`.

**Action**: Establish a costing process in Profit Plus upstream (BOM/compuestos, manual cost entry, or external costing feed) before margin dashboards can be scoped.

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

---

## References

- **Design Spec**: `docs/superpowers/specs/2026-08-25-sales-margin-collections-dwh-design.md`
- **Implementation Plan**: `docs/superpowers/plans/2026-08-25-sales-returns-collections-dwh.md`
- **Migrations**: `dwh-migrations/`
- **Migration Runner**: `scripts/migrate-dwh.ts`
- **Load Procedures**: `DWH_AlimentosNY` database, `dwh` schema (stored procedures)
- **ERP Knowledge Base**: `docs/tables/*.md` (source table documentation)
