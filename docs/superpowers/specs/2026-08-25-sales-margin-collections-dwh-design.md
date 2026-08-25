# Sales, Margin & Collections Data Warehouse — Design

**Date**: 2026-08-25
**Status**: Approved by user, pending spec review
**Author**: Claude (Sonnet 5), with Eugenio Doñaque

## 1. Purpose & Scope

Design a Kimball-style dimensional Data Warehouse (DWH) for "Alimentos New York," a Venezuelan bakery/food operation running Profit Plus 2k12 as its ERP (SQL Server, database referred to here as `ERP_DB` — the live instance is `Ncake_a`). The DWH powers three BI pillars:

1. **Sales, Returns & Net Revenue** — trend, return rate, customer/product Pareto, sales rep performance
2. **Unit Economics, Costs & Margins** — gross margin waterfall, margin by product/category, cost volatility
3. **Collections, Aging & Cash Flow** — AR aging buckets, DSO trend, collections efficiency, credit concentration

This spec covers the dimensional model (dims + facts), the ETL/incremental-load mechanism, and the T-SQL to build it. It also covers targeted improvements to the `erp-knowledge-base` documentation repo for source tables this design depends on that were previously undocumented stubs.

**Explicitly out of scope** (confirmed with user):
- Return reason-code breakdown — Profit Plus has no `co_motivo_devolucion` catalog; only a free-text `comentario` field exists on `saDevolucionCliente`. Fact_Returns ships without a reason dimension.
- Sales target / quota realization — Profit Plus has no presupuesto/meta table anywhere in the schema. Fact_Sales ships with full rep performance (gross/net/discount) but no target-vs-actual.

## 2. Source System Facts Grounding This Design

- **Database**: single ERP database (`Ncake_a` in the reference instance), ~243 tables, Profit Plus 2k12 schema. DWH will live in a separate database (`DWH_AlimentosNY`) on the **same instance**, enabling cross-database three-part-name queries (`Ncake_a.dbo.saFacturaVenta`) without linked servers.
- **Base currency quirk**: the system's base currency row in `saMoneda` is coded `'BS'` (padded `char(6)`), *not* the ISO code `VES`. Any DWH currency logic must resolve the base currency dynamically (`SELECT co_mone FROM saMoneda WHERE cambio = 1`), never hardcode `'VES'`.
- **Multimoneda pattern**: every transactional document stores its own `tasa` (the Bs-per-unit rate at time of emission). Historical rates independent of any document live in `saTasa` (`co_mone`, `fecha`, `tasa_c`, `tasa_v`). Never use `saMoneda.cambio` (current rate only) for historical conversion.
- **Immutable documents**: Profit Plus never hard-deletes transactional rows; documents are marked `anulado = 1` instead. All fact ETL must filter `anulado = 0` at the source, and dimension/fact design should still capture voided documents' existence for audit completeness in a `dwh.IsVoided` flag rather than silently dropping rows (voided sales that were later reversed still matter for "how often do we void" operational metrics, even if BI dashboards default-filter them out).
- **Incremental-load key**: **174 of ~243 tables** carry a `validador` column of SQL type `timestamp` (rowversion) — monotonic, always unique, immune to clock skew. All tables this design touches have it. This is the watermark key for incremental ETL (see §5), in preference to the human-editable `fe_us_mo` datetime column that exists on the same tables.
- **Inventory reality check — COGS is not computable from this ERP today (verified live, 2026-08-25)**: per `saAlmacen` documentation, this installation is a **make-to-order bakery**. Finished-goods sales (166 active articles, `tipo='V'`) post against warehouse `000015` ("OFICINA"), which never carries positive stock in `saStockAlmacen`. A live read-only query against `Ncake_a` (via the exporter app's existing `mssql` connection, `DB_NAME=Ncake_a`) confirmed the worst case, not merely thin coverage:
  - `saCostoHistoricoSalida`: **4,618 of 4,618 rows have `costo_pro = 0`** — 100% zero, including all 4,608 `FACT` rows (which do correctly join to finished-goods articles by `co_art`/warehouse `000015`, so the *join logic* is sound — the *cost value* itself was simply never populated by whatever process writes this table).
  - `saCostoHistoricoEntrada` (the entry-cost layers `saCostoHistoricoSalida` is supposed to consume): 291 of 292 `tipo='V'` layers are also `costo = 0`.
  - `saArtCompuesto` (BOM/recipe costing — flour+labor+packaging rolled into a per-unit cost): **zero** finished-goods articles are modeled as compuestos. No recipe-cost roll-up exists as an alternative source.
  - `saArtPrecio` only carries **selling** price lists (contado/cadenas/independientes/USD/BS variants) — no cost price list.
  - `saArticulo.tipo_cos = '1'` (Último Costo/Last Cost) for all 65 active finished-goods articles, but there is no last-cost value anywhere to read for that method to resolve.
  - **Conclusion**: this is not a DWH design problem to solve around — **Alimentos New York has never recorded a production/manufacturing cost for any finished good in Profit Plus.** No fallback join, however clever, produces a real number here; every path terminates at zero or absent data. The Gross Margin Waterfall and Margin by Product/Category dashboards **cannot be built from ERP data as it exists today**. This must be raised with the business stakeholder as an operational gap (costing needs to start being recorded — via BOM/compuestos, manual cost entry, or an external costing process feeding back into Profit Plus) before those two dashboards can be scoped further. Fact_Sales will still ship with `NetAmount`/`GrossAmount`/`DiscountAmount` (all fully sourced) and a `UnitCost`/`COGSAmount`/`GrossProfitAmount` column set populated as `NULL` with a `CostSourceFlag = 'NO_COST_DATA'`, so the schema is ready the day cost data starts flowing, without blocking Sales/Returns/Collections dashboards that don't need it.

## 3. Dimensional Model

### 3.1 Conformed Dimensions

| Dimension | Grain | Source | Type | Key columns carried |
|---|---|---|---|---|
| `Dim_Date` | 1 row/day | Generated (not sourced from ERP) | Type 0 | Calendar attrs, fiscal month/year (Profit Plus reporting is calendar-month based — no separate fiscal calendar in source) |
| `Dim_Customer` | 1 row/customer/version | `saCliente` | **SCD Type 2** | `co_cli`, `cli_des`, `rif`, `contrib`, `mont_cre`, `co_mone` (credit limit currency), `co_zon`, `co_seg`, `co_ven` (default rep), `juridico`, `inactivo` |
| `Dim_Product` | 1 row/article/version | `saArticulo` + `saCatArticulo` + `saLineaArticulo` + `saSubLinea` (denormalized) | **SCD Type 2** | `co_art`, `art_des`, `tipo` (V/C/S/F/M/N/E), `tipo_cos` (costing method), `co_lin`/`lin_des`, `co_cat`/`cat_des`, `co_subl`, `margen_min`, `margen_max`, `anulado` |
| `Dim_SalesRep` | 1 row/rep | `saVendedor` | Type 1 (low change volume) | `co_ven`, `ven_des`, `tipo` (V/C/A), `fun_ven`, `fun_cob` (rep who is also a collector — relevant to Collections Efficiency), `comision`, `co_zon`, `inactivo` |
| `Dim_Warehouse` | 1 row/warehouse | `saAlmacen` | Type 1 | `co_alma`, `des_alma`, `noventa`, `nocompra`, `materiales`, `produccion`. Carries a derived `HasRealStock` bit (computed at load time from `EXISTS (SELECT 1 FROM saStockAlmacen WHERE stock <> 0)`) so BI tools can filter warehouse noise per the documented finding that only 2 of 52 warehouses hold real stock. |
| `Dim_Currency` | 1 row/currency | `saMoneda` | Type 1 | `co_mone`, `mone_des`, `IsBaseCurrency` (derived from `cambio = 1`, not hardcoded) |
| `Dim_DocumentType` | small conformed lookup | Hardcoded from Profit Plus's known `co_tipo_doc` domain (`FACT`, `N/CR`, `N/DB`, `COBR`, `ANT`, etc.) | Static | `co_tipo_doc`, `doc_type_des`, `IsCredit` (true for N/CR), `AffectsAR` (true for FACT/N/CR/N/DB) |

**Why SCD Type 2 for Customer and Product, Type 1 for the rest**: customer credit limits, segments, and zones change over time and dashboards like "Credit Risk & Customer Concentration" need to reflect the limit that was in force *when* a balance existed, not today's limit. Same logic for product category reclassification affecting historical margin-by-category trends. Sales reps and warehouses change rarely enough in this installation (small team) that Type 1 (overwrite) is a reasonable simplification — revisit if the business starts reassigning territories frequently.

### 3.2 Fact Tables

| Fact | Grain | Primary source(s) | Type |
|---|---|---|---|
| `Fact_Sales` | 1 row per `saFacturaVentaReng` line | `saFacturaVenta` (header) + `saFacturaVentaReng` (lines) + `saCostoHistoricoSalida` (cost, see §2 caveat) | Transaction |
| `Fact_Returns` | 1 row per `saDevolucionClienteReng` line | `saDevolucionCliente` (header) + `saDevolucionClienteReng` (lines) | Transaction |
| `Fact_Collections` | 1 row per `saCobroDocReng` (one payment applied to one invoice) | `saCobro` (header) + `saCobroDocReng` (lines) | Transaction |
| `Fact_AR_Snapshot` | 1 row per open `saDocumentoVenta` document per snapshot date | `saDocumentoVenta`, snapshotted daily | **Periodic snapshot** |
| `Fact_ExchangeRate` | 1 row per currency per day | `saTasa` | Periodic snapshot (mini-fact, no measures beyond rates — supports rate-adjusted trend analysis independent of any one document) |

**Sales vs. Returns — separate facts, not unified** (per user decision): `saFacturaVentaReng` and `saDevolucionClienteReng` are different source tables with different triggers, different lifecycle columns (`saldo`/`aut` exist on `saDocumentoVenta` for both but the line-level detail differs — e.g. `total_dev`/`monto_dev` only make sense in the returns context), and different insert cadences. Keeping them separate with **identical conformed dimensionality** (same `Dim_Date`, `Dim_Customer`, `Dim_Product`, `Dim_SalesRep`, `Dim_Currency` FKs) lets any BI tool compute `Net Revenue = SUM(Fact_Sales.NetAmount) - SUM(Fact_Returns.NetAmount)` as a simple calculated measure, without a lossy union at ETL time.

#### Fact_Sales — column detail

| Column | Source | Notes |
|---|---|---|
| `DateKey` | `saFacturaVenta.fec_emis` | FK → Dim_Date |
| `CustomerKey` | `saFacturaVenta.co_cli` | FK → Dim_Customer (SCD2, resolved to the version active at `fec_emis`) |
| `ProductKey` | `saFacturaVentaReng.co_art` | FK → Dim_Product (SCD2, resolved to version active at `fec_emis`) |
| `SalesRepKey` | `saFacturaVenta.co_ven` | FK → Dim_SalesRep |
| `WarehouseKey` | `saFacturaVentaReng.co_alma` | FK → Dim_Warehouse |
| `CurrencyKey` | `saFacturaVenta.co_mone` | FK → Dim_Currency |
| `DocumentTypeKey` | `'FACT'` | FK → Dim_DocumentType (constant for this fact) |
| `InvoiceNumber` | `saFacturaVenta.doc_num` | Degenerate dimension — for drill-to-source |
| `LineNumber` | `saFacturaVentaReng.reng_num` | Degenerate dimension |
| `QuantitySold` | `saFacturaVentaReng.total_art` | — |
| `GrossAmount` | line qty × `prec_vta` before discount | — |
| `DiscountAmount` | `saFacturaVentaReng.monto_desc` + prorated `monto_desc_glob` | — |
| `TaxAmount` | `monto_imp` + `monto_imp2` + `monto_imp3` | — |
| `NetAmount` | `saFacturaVentaReng.reng_neto` | This is Net Revenue at line grain |
| `UnitCost` | `saCostoHistoricoSalida.costo_pro` joined via `saArticulo.rowguid` + `doc_orig`, when non-zero | **Currently always `NULL`** — verified live that every `costo_pro` value in this table is `0` for this installation (§2). Column and join wired up so it activates automatically the day real cost data appears upstream, but do not build a margin dashboard against it yet. |
| `COGSAmount` | `UnitCost × QuantitySold`, `NULL` if `UnitCost` is `NULL` | Currently always `NULL`, per above |
| `GrossProfitAmount` | `NetAmount - COGSAmount`, `NULL` if `COGSAmount` is `NULL` | Currently always `NULL`, per above |
| `CostSourceFlag` | `'HISTORY'` if a non-zero `costo_pro` was found, else `'NO_COST_DATA'` | Currently always `'NO_COST_DATA'` for every row — lets a BI tool visibly distinguish "zero margin because it's actually zero" from "margin unknown, no cost data exists" |
| `DocumentExchangeRate` | `saFacturaVenta.tasa` | Degenerate fact attribute — the rate baked into the source document, kept for exact reconciliation. Distinct from `Fact_ExchangeRate`, which is for time-series rate analysis. |
| `IsVoided` | `saFacturaVenta.anulado` | Kept (not filtered) at load time; BI semantic layer default-filters `IsVoided = 0` |

#### Fact_Returns — mirrors Fact_Sales column shape

Same dimensional FKs; measures are `QuantityReturned`, `GrossAmount`, `DiscountAmount`, `TaxAmount`, `NetAmount` (all from `saDevolucionClienteReng`), sourced with the header from `saDevolucionCliente`. No cost/margin columns — returns don't reverse COGS in this v1 (a return's inventory effect, if any, is a separate inventory-domain concern, out of scope for a sales/margin/collections DWH).

#### Fact_Collections — column detail

| Column | Source |
|---|---|
| `DateKey` | `saCobro.fecha` |
| `CustomerKey` | `saCobro.co_cli` |
| `SalesRepKey` | `saCobro.co_ven` (the collector — cross-reference `Dim_SalesRep.fun_cob` for the Collections Efficiency dashboard) |
| `CurrencyKey` | `saCobro.co_mone` |
| `InvoiceDocumentTypeKey` | `saCobroDocReng.co_tipo_doc` (what was paid — FACT, N/CR, etc.) |
| `ReceiptNumber` / `InvoiceNumber` | `saCobro.cob_num` / `saCobroDocReng.nro_doc` (degenerate) |
| `AmountCollected` | `saCobroDocReng.mont_cob` |
| `RetentionIVAAmount` | `saCobroDocReng.monto_retencion_iva` |
| `RetentionISLRAmount` | `saCobroDocReng.monto_retencion` |
| `EarlyPaymentDiscountAmount` | `saCobroDocReng.dpcobro_monto` |
| `DocumentExchangeRate` | `saCobro.tasa` |
| `IsVoided` | `saCobro.anulado` |

#### Fact_AR_Snapshot — column detail

| Column | Source |
|---|---|
| `SnapshotDateKey` | the date the daily job ran |
| `CustomerKey` | `saDocumentoVenta.co_cli` |
| `DocumentTypeKey` | `saDocumentoVenta.co_tipo_doc` |
| `InvoiceNumber` | `saDocumentoVenta.nro_doc` |
| `CurrencyKey` | `saDocumentoVenta.co_mone` |
| `OutstandingBalance` | `saDocumentoVenta.saldo` (in document currency) as of snapshot time |
| `DocumentExchangeRate` | `saDocumentoVenta.tasa` |
| `DueDate` | `saDocumentoVenta.fec_venc` |
| `DaysPastDue` | `DATEDIFF(day, fec_venc, @SnapshotDate)`, computed at load time |
| `AgingBucket` | Derived: `Current`, `1-30`, `31-60`, `61-90`, `>90`, computed from `DaysPastDue` |
| `IsCreditNote` | `co_tipo_doc IN ('N/CR','NCR')` — needed because unapplied credit notes have `saldo > 0` but represent credit owed *to* the customer, not receivable, and must be excluded/signed-negative in aging totals |

This is the only fact requiring a **daily SQL Agent job** rather than pure incremental catch-up, because Profit Plus itself keeps no history of `saldo` — the DWH becomes the system of record for AR history going forward. Historical snapshots before the DWH's first run cannot be reconstructed (documented as a known limitation, not a defect).

## 4. Physical Database Layout

```
DWH_AlimentosNY (new database, same instance as ERP_DB)
├── dwh schema        -- control tables (watermarks, load logs)
├── dim schema         -- Dim_Date, Dim_Customer, Dim_Product, Dim_SalesRep,
│                         Dim_Warehouse, Dim_Currency, Dim_DocumentType
└── fact schema        -- Fact_Sales, Fact_Returns, Fact_Collections,
                          Fact_AR_Snapshot, Fact_ExchangeRate
```

Physical tables (not views), per user decision — BI tool refreshes must not re-scan the ERP live, and AR snapshot history has nowhere else to live.

### 4.1 Watermark control table

```sql
CREATE TABLE dwh.EtlWatermark (
    SourceTableName   sysname       NOT NULL PRIMARY KEY,
    LastValidador     binary(8)     NOT NULL,   -- last-seen MAX(validador), rowversion
    LastRunAtUtc      datetime2(3)  NOT NULL,
    LastRowsProcessed int           NOT NULL
);
```

One row per source ERP table being incrementally loaded (`saFacturaVenta`, `saFacturaVentaReng`, `saDevolucionCliente`, `saDevolucionClienteReng`, `saCobro`, `saCobroDocReng`, `saCliente`, `saArticulo`, `saTasa`, ...). Seeded with `0x0000000000000000` on first run (full initial load).

## 5. Incremental Load Pattern

Every load proc follows the same shape, using `validador` (rowversion) as the watermark — chosen over `fe_us_mo` because rowversion is monotonic and collision-free even under same-millisecond writes or backdated correction scripts, whereas `fe_us_mo` is a human/application-set datetime that both source docs and observed procedures show can be rewritten by admin data-fix scripts.

```sql
CREATE OR ALTER PROCEDURE dwh.Load_Fact_Sales
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) =
        (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saFacturaVentaReng');
    DECLARE @NewWatermark binary(8);
    DECLARE @RowCount int;

    ;WITH Changed AS (
        SELECT r.*, f.co_cli, f.co_ven, f.co_mone, f.tasa, f.fec_emis, f.anulado
        FROM ERP_DB.dbo.saFacturaVentaReng r
        INNER JOIN ERP_DB.dbo.saFacturaVenta f ON f.doc_num = r.doc_num
        WHERE r.validador > @Watermark OR f.validador > @Watermark
    )
    MERGE fact.Fact_Sales AS tgt
    USING Changed AS src
        ON tgt.InvoiceNumber = src.doc_num AND tgt.LineNumber = src.reng_num
    WHEN MATCHED THEN UPDATE SET
        tgt.NetAmount = src.reng_neto,
        tgt.IsVoided  = src.anulado,
        -- ... remaining column mappings, cost join, dimension key lookups
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN INSERT (...)
        VALUES (...);

    SET @RowCount = @@ROWCOUNT;

    SELECT @NewWatermark = MAX(v) FROM (
        SELECT MAX(validador) AS v FROM ERP_DB.dbo.saFacturaVentaReng
        UNION ALL
        SELECT MAX(validador) FROM ERP_DB.dbo.saFacturaVenta
    ) x;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saFacturaVentaReng';
END
```

This pattern (CTE of changed rows since watermark → `MERGE` into the fact/dim → advance watermark) repeats for every dim/fact. SCD Type 2 dims (`Dim_Customer`, `Dim_Product`) use the same watermark detection but the `MERGE`'s `WHEN MATCHED` branch closes the current row (`ValidTo = SYSUTCDATETIME()`) and inserts a new version row, rather than updating in place.

**Dimension keys are resolved at fact-load time**, not pre-joined — the load proc looks up `CustomerKey` from `Dim_Customer` `WHERE co_cli = @co_cli AND @fec_emis BETWEEN ValidFrom AND ValidTo`, so a sale always points at the dimension version that was true when the sale happened.

### 5.1 Load order (dependency-driven)

1. `Dim_Date` (pre-generated once, far into the future — not incremental)
2. `Dim_Currency`, `Fact_ExchangeRate` (from `saMoneda`, `saTasa`)
3. `Dim_Customer`, `Dim_Product`, `Dim_SalesRep`, `Dim_Warehouse`, `Dim_DocumentType`
4. `Fact_Sales`, `Fact_Returns`, `Fact_Collections` (depend on all dims above being current)
5. `Fact_AR_Snapshot` — separate daily job, not part of the incremental chain, since it's a snapshot not a delta

A single SQL Agent job (e.g. `DWH - Incremental Load`) runs steps 1–4 on a schedule (recommend every 15–30 min for near-real-time dashboards, or hourly if load on the OLTP instance is a concern — needs a call from the business on freshness vs. server load trade-off). A second job (`DWH - Daily AR Snapshot`) runs step 5 once daily after business close.

## 6. Table-Search Keyword Strategy for the MCP

To avoid re-truncating context the way the previous pass did, search the knowledge base by these keyword groups **before** requesting full schema dumps, and only pull `get_table_schema` for tables actually confirmed relevant:

| Domain | Search keywords |
|---|---|
| Sales invoices/lines | `factura venta`, `FacturaVenta`, `documento venta` |
| Returns/credit notes | `devolucion cliente`, `Devolucion`, `nota credito` |
| Product master/cost/category | `articulo`, `costo historico`, `cat articulo`, `linea articulo`, `precio articulo` |
| Customer master | `cliente`, `Cliente` |
| AR / collections | `cobro`, `documento venta saldo`, `retencion` |
| Currency/multimoneda | `tasa`, `moneda`, `multimoneda` |
| Sales rep | `vendedor` |
| Warehouse | `almacen` |

Each of the tables named explicitly in §3 has already been verified against the knowledge base or live schema during this design pass — no further blind dumps needed for those. Any *new* table encountered during implementation should go through `search_profit_docs` first, then `get_table_schema` only for the specific hit, never a full-database dump.

## 7. erp-knowledge-base Documentation Improvements

Per user request, alongside building this DWH, the following tables — currently `_Pendiente de enriquecimiento_` stubs or unverified in `erp-knowledge-base/docs/tables/` — will be enriched to the same standard as `saArticulo.md` / `saCostoHistoricoSalida.md` (business description, verified columns, relationships, SQL recipes) as part of implementation, since this design depends on understanding them precisely:

- `saDevolucionCliente.md` / `saDevolucionClienteReng.md` — currently stub description despite full column list
- `saArtPrecio.md` — stub description
- `saCatArticulo.md` / `saLineaArticulo.md` / `saSubLinea.md` — stub descriptions (all three referenced by Dim_Product denormalization)

Confirmed already well-documented during this pass — no action needed: `saMoneda.md` (has the BS/VES gotcha), `saTasa.md`, `saCobro.md` / `saCobroDocReng.md`, `saDocumentoVenta.md`, `saCliente.md`, `saVendedor.md`, `saAlmacen.md`, `saArticulo.md`, `saFacturaVenta.md` / `saFacturaVentaReng.md`, `saCostoHistoricoSalida.md` / `saCostoHistoricoEntrada.md`.

## 8. Open Items / Risks

1. **COGS data does not exist — resolved, not open, but blocking** (§2, verified live 2026-08-25): `saCostoHistoricoSalida`, `saCostoHistoricoEntrada`, and `saArtCompuesto` all confirm no production cost has ever been recorded for finished goods in this Profit Plus installation. This is a **business-process gap outside the DWH's control**, not an engineering risk to mitigate — no ETL cleverness produces a real COGS number from data that was never captured. The Gross Margin Waterfall and Margin by Product/Category dashboards from the original ask are **not deliverable** until the business starts recording finished-goods cost somewhere (BOM/compuestos costing, manual cost entry per batch, or an external costing feed). Recommend surfacing this to the stakeholder explicitly and re-scoping those two dashboards out of the initial DWH rollout, or scoping a separate short project to establish a costing process first.
2. **AR snapshot has no pre-DWH history** — DSO/aging trend dashboards will only show data from the DWH's go-live date forward; do not attempt to backfill by reverse-engineering `saCobro` history against point-in-time balances (too error-prone given no historical `saldo` log).
3. **Load frequency vs. OLTP load** — needs a business decision (§5.1), not a technical one.
4. **Dim_Product SCD2 volume** — with only 166 active articles this is a non-issue at current scale; flagged only in case of much larger future catalogs.
