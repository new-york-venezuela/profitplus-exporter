# Consignment / Split-Store Delivery Analytics ("Gama")

Date: 2026-09-27
Status: Approved, pending implementation plan

## Context

We have one large consignment client ("Gama" — 22 branded store locations:
Gama Express Chuao, Gama La Urbina, Gama Plus La Trinidad, etc.) whose
store-level deliveries are **not** individually invoiced in the ERP. The
client is delivered to per-store against a delivery note (*Nota de
Entrega*) or PO, and Profit Plus only records the periodic **consolidated
invoice** against the matriz (parent) customer account, with no per-store
breakdown. This means today's DWH has zero store-level granularity for
Gama — `Fact_Sales` only knows "the matriz was invoiced $X in aggregate,"
not which of the 22 stores received what.

The client periodically sends an Excel export of deliveries (one row per
delivery: store, date, PO/delivery-note number, quantity per product) which
is the only source of store-level truth. This spec covers turning that file
into a queryable DWH model, starting with the one file already on hand
(`despacho-excelsior-gama.xlsx`) and structured to accept future files (this
client's later exports, and the one other consignment account mentioned but
not yet supplied).

### What the source file actually contains (verified by parsing it)

The task prompt described a richer file (per-line unit price, extended
totals, PO *and* consolidated-invoice linkage) than what's actually there.
Parsed directly (`openpyxl`, single sheet "GAMA"):

- **523 delivery rows**, dates 2026-04-16 to 2026-09-22.
- **22 distinct stores** in column A (`Nombre de Cliente` — client-side
  naming, e.g. "Gama Express Sebucan Norte"). Two additional non-store rows
  ("Total Unidades", "Total $") are column-total summary rows, not stores.
- Column B: delivery date. Column C: **mixed identifier scheme** — early
  rows hold a plain numeric PO number (e.g. `5402749223`), later rows hold
  an alphanumeric delivery-note code with a letter prefix (`D0001`, `E0002`,
  `F0124`, `B0006`, ...). The letter prefixes' meaning is unknown and out of
  scope to decode — carried through as an opaque string.
- **12 fixed product columns** (D–P): `4 Granos 500gr`, `7 Cereales 600gr`,
  `Miel y pasas 600gr`, `Pan Blanco 600gr`, `Magdalena`, `Molido 300gr`,
  `Baguette 220gr`, `cheese Cake fresa`, `cheese Cake Choco`, `Pizza
  Margarita 270`, `Pizza Magarita Cj`, `Pizza New York Cj`, `Pizza
  Americana Cj` — each cell is a **quantity delivered**, no per-line price.
- **No per-line `$` anywhere.** The only dollar figures are two bottom
  summary rows, one total per product across the whole file. A second small
  block (columns R–AD, near the bottom rows) mirrors the same 12 product
  headers with one more aggregate total each — also not row-level data, and
  otherwise unused by this design.
- **No consolidated-invoice reference of any kind** in the file, and
  (confirmed by user) the ERP's consolidated invoices carry no reference
  back to delivery notes or POs either. There is no row-level join available
  between a delivery and the invoice that eventually pays for it.

Given no per-line price exists in the source, and no invoice linkage exists
in either system, this spec pulls pricing from the matriz's own invoice
history (below) and does not attempt automatic double-counting prevention
via a join — see "Double-counting" below.

### What already exists (verified against the current schema)

- **`dim.Dim_LegalEntity`** / **`Dim_Customer.MatrizCode`**
  (`migrations/dwh/0014_dim_legal_entity.sql`, `0030_fix_matriz_scd2_...sql`):
  the DWH already models "one parent customer account with N child store
  accounts rolling up to it" for cases where the ERP *does* have per-store
  `saCliente` rows under a shared `matriz` code. **Gama is not this case** —
  its 22 store names in the file do not correspond to 22 `saCliente` rows;
  Profit Plus only has the one matriz-level customer account. So
  `Dim_LegalEntity` is reused as the anchor (Gama's matriz `CustomerKey`
  resolves to one `Dim_LegalEntity` row) but a **new** dimension is needed
  for the store names themselves, since they don't exist as ERP entities at
  all.
- **`sucursal` already means something else in this codebase** —
  `lib/components/reports/SucursalSelector.tsx` / `co_alma` /
  `Dim_Warehouse` is *our own* warehouse/branch, used to filter ERP report
  exports. It has no relationship to a consignment client's store locations.
  This confirms there is no existing "store" concept to reuse or collide
  with; a new dimension is genuinely required, not a rename of something
  that already exists.
- **`dim.Dim_Product`** (`0006_dim_product.sql`): `ProductCode`,
  `ProductName`, `IsCurrent` — the 12 product names from the file are
  matched against this, `IsCurrent = 1` only.
- **`fact.Fact_Sales`** (`0009_fact_sales.sql`): `CustomerKey`, `ProductKey`,
  `DateKey`, `QuantitySold`, `NetAmount` (BSD, see `erp_currency_bsd_usd`
  memory — needs `saTasa`/`Fact_ExchangeRate` conversion to USD, same
  pattern as every other USD-denominated DWH query in this codebase). This
  is the pricing source: Gama's matriz already has real consolidated
  invoice lines in here, each with a real `NetAmount`/`QuantitySold` per
  product per date.
- **No existing precedent for a manually-supplied (non-ERP,
  non-scheduled) data source feeding the DWH.** Every current `Load_*`
  procedure in `migrations/dwh/` pulls from a live `Ncake_a.dbo.*` ERP table
  on a watermark. This is the first source that's a human-sent file — see
  "Load mechanism" below for why that means a different tool, not a new
  `Load_*` procedure.

## Design

### 1. New dimension: `dim.Dim_ConsignmentStore`

One row per distinct store name per consignment client, not tied to any
ERP entity (none exists):

```sql
CREATE TABLE dim.Dim_ConsignmentStore (
    ConsignmentStoreKey   int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    LegalEntityKey        int           NOT NULL, -- FK to Dim_LegalEntity (the matriz, e.g. Gama)
    StoreName             varchar(120)  NOT NULL, -- raw string from the source file, e.g. "Gama Express Chuao"
    StoreNameNormalized   varchar(120)  NOT NULL, -- trimmed/lowercased/accent-folded, for idempotent re-import matching
    SourceClientTag       varchar(40)   NOT NULL, -- e.g. 'gama' — namespaces store names per consignment client
    IsActive              bit           NOT NULL DEFAULT 1,
    CreatedAtUtc           datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Dim_ConsignmentStore_LegalEntity FOREIGN KEY (LegalEntityKey) REFERENCES dim.Dim_LegalEntity(LegalEntityKey)
);
CREATE UNIQUE INDEX IX_Dim_ConsignmentStore_Client_Name ON dim.Dim_ConsignmentStore (SourceClientTag, StoreNameNormalized);
```

No SCD2 — store names are file-driven labels, not ERP master data that
changes underneath the DWH between loads. `SourceClientTag` keeps this
table usable for the second consignment account mentioned in the original
task, whenever that file materializes, without a schema change.

### 2. Product mapping: manually-reviewed, not auto-fuzzy

Only 12 distinct product names exist in the file. A wrong automatic fuzzy
match (e.g. conflating "Pizza Margarita 270" with a differently-sized SKU)
is a real, cheap-to-avoid risk at this volume, so this is a **one-time
human-reviewed mapping**, not a runtime fuzzy-matching pipeline:

| Excel Product String | Candidate `Dim_Product.ProductName` match | `ProductCode` | Confidence |
|---|---|---|---|
| *(built during implementation by querying `Dim_Product` for each of the 12 names, normalized — trim/lowercase/strip-accents — and presenting candidates for human sign-off)* | | | |

Output: a static seed, `dwh.ConsignmentProductMap` (`SourceClientTag`,
`ExcelProductName`, `ProductKey`), populated once via reviewed INSERT
statements committed to a migration — not recomputed on every import run.
Any future file introducing a 13th product name with no match blocks that
product's rows at import time rather than guessing.

### 3. Fact table: `fact.Fact_ConsignmentDeliveries`

```sql
CREATE TABLE fact.Fact_ConsignmentDeliveries (
    FactConsignmentDeliveryKey bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
    DateKey               int             NOT NULL,
    ConsignmentStoreKey   int             NOT NULL,
    ProductKey            int             NOT NULL,
    NotaEntregaNum        varchar(30)     NULL,    -- raw string from the file (PO number or D/E/F/B-prefixed code); opaque
    QuantityDelivered     decimal(18,5)   NOT NULL,
    UnitPriceUsd          decimal(18,5)   NULL,     -- as-of price from the matriz's own Fact_Sales; NULL if no prior invoice exists yet for that product
    LineAmountUsd         decimal(18,2)   NULL,     -- QuantityDelivered * UnitPriceUsd, NULL when UnitPriceUsd is NULL
    SourceClientTag       varchar(40)     NOT NULL,
    SourceFileName        varchar(200)    NOT NULL,
    SourceRowHash         varchar(64)     NOT NULL, -- hash of (store, date, nota, product, qty) for idempotent re-import
    LoadedAtUtc            datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Fact_ConsignmentDeliveries_Date FOREIGN KEY (DateKey) REFERENCES dim.Dim_Date(DateKey),
    CONSTRAINT FK_Fact_ConsignmentDeliveries_Store FOREIGN KEY (ConsignmentStoreKey) REFERENCES dim.Dim_ConsignmentStore(ConsignmentStoreKey),
    CONSTRAINT FK_Fact_ConsignmentDeliveries_Product FOREIGN KEY (ProductKey) REFERENCES dim.Dim_Product(ProductKey)
);
CREATE UNIQUE INDEX IX_Fact_ConsignmentDeliveries_RowHash ON fact.Fact_ConsignmentDeliveries (SourceRowHash);
CREATE INDEX IX_Fact_ConsignmentDeliveries_DateKey ON fact.Fact_ConsignmentDeliveries (DateKey);
CREATE INDEX IX_Fact_ConsignmentDeliveries_StoreKey ON fact.Fact_ConsignmentDeliveries (ConsignmentStoreKey);
```

No `InvoiceNumber`/consolidated-invoice FK column — there's no reliable
linkage data to populate it with, and a guessed link would be actively
misleading. This table is deliberately **separate from `Fact_Sales`**, not
a variant row type merged into it: they answer different questions (what
was delivered to a specific store vs. what was invoiced to the matriz in
aggregate) and mixing them in one fact would make "total sales" queries
double-count unless every consumer remembered to filter by a type flag —
error-prone versus just keeping them apart.

### 4. Pricing: as-of lookup against the matriz's own `Fact_Sales`

For each `(ProductKey, DateKey)` pair in the import batch:

```sql
SELECT TOP 1 fs.NetAmount / NULLIF(fs.QuantitySold, 0) AS UnitPriceUsd
FROM fact.Fact_Sales fs
WHERE fs.ProductKey = @ProductKey
  AND fs.CustomerKey IN (SELECT CustomerKey FROM dim.Dim_Customer WHERE LegalEntityKey = @GamaLegalEntityKey AND IsCurrent = 1)
  AND fs.DateKey <= @DateKey
  AND fs.IsVoided = 0
ORDER BY fs.DateKey DESC
```

`NetAmount` is BSD (per `erp_currency_bsd_usd` memory) — convert using the
same per-row `DocumentExchangeRate` pattern already established for every
other USD figure in the Analítica dashboard (see
`2026-09-23-historical-usd-conversion-design.md`), not a blanket current
rate. If no prior invoice line exists yet for that product (e.g. a brand
new SKU delivered before ever being separately invoiced), `UnitPriceUsd`
and `LineAmountUsd` stay `NULL` rather than defaulting to 0 or guessing —
surfaced as a diagnostic in the import report, backfillable by re-running
the import once a real invoice exists.

### 5. Double-counting: kept structurally separate, not netted

Since neither the file nor the ERP's consolidated invoices carry any
reference tying a delivery back to the invoice that eventually covers it,
there is no reliable per-row join to suppress overlap. Rather than build a
brittle heuristic (e.g. matching by date range and rough total, which would
misattribute on partial payments, disputes, or timing drift), this design
keeps `Fact_ConsignmentDeliveries` and `Fact_Sales` as two independent
lenses:

- `Fact_Sales` (filtered to Gama's matriz) already answers "how much were
  we paid/invoiced," in aggregate — this is unchanged and remains the
  source of truth for revenue reporting.
- `Fact_ConsignmentDeliveries` answers "how much did each store actually
  receive" — a distribution/logistics lens, not a revenue lens.
- Any dashboard or export built on this data must be explicit about which
  question it's answering and must not sum both facts together into one
  "total sales" figure. This is a consumer-side discipline, not something
  enforceable in the schema — called out explicitly here so the eventual
  Analítica dashboard integration (if any) doesn't silently double-count.

### 6. Load mechanism: manual import script, not a scheduled `Load_*` proc

Every existing `Load_*` procedure in `migrations/dwh/` runs against a live,
watermarked ERP table. This source is a human-emailed Excel file with no
comparable cadence or watermark column — it doesn't fit that pattern.
Instead: `scripts/import-consignment-deliveries.ts`, a Bun script run
manually each time a new file arrives:

1. Read the `.xlsx` (a small library like `exceljs`; no existing xlsx
   *reader* in this codebase — `lib/xlsx.ts` only *writes* XLSX for report
   exports).
2. Normalize store names, look up `Dim_ConsignmentStore` (insert new stores
   on first sight, matched by `StoreNameNormalized` + `SourceClientTag`).
3. Look up each product against the reviewed `dwh.ConsignmentProductMap`;
   hard-fail listing any unmapped product name rather than skipping it
   silently.
4. Compute `SourceRowHash` per row; upsert into
   `fact.Fact_ConsignmentDeliveries` keyed on that hash, so re-running the
   script on a corrected or re-sent version of the same file is safe
   (matches the file's known column-total rows, since files like this tend
   to get corrected copies re-sent).
5. Run the as-of pricing lookup (Section 4) per distinct
   `(ProductKey, DateKey)` in the batch, not per row, to avoid redundant
   queries.
6. Print a diagnostic report: rows imported, rows skipped (unmapped
   product), stores newly created, products with no price found.

This script takes the file path as an argument and `SourceClientTag` (e.g.
`gama`), so the second consignment client's eventual file reuses the same
script and dimension tables.

## Deliverables produced by implementation

1. **Migration** `migrations/dwh/0035_consignment_store_deliveries.sql`:
   `Dim_ConsignmentStore`, `ConsignmentProductMap` (with the 12 reviewed
   Gama rows seeded), `Fact_ConsignmentDeliveries` — following the existing
   `IF NOT EXISTS`/`CREATE OR ALTER` re-runnable convention (see
   `migrations/dwh/README.md`).
2. **Import script** `scripts/import-consignment-deliveries.ts`.
3. **One import run** against `despacho-excelsior-gama.xlsx`, with the
   diagnostic report (row counts, date range, unmapped products/stores if
   any) shared back before considering the data ready for downstream use.
4. **No Analítica dashboard changes** in this pass — this spec stops at a
   queryable fact table. A `/analitica` tab or export surfacing this data
   is a separate, later spec once the base data is validated.

## Open items carried into implementation (not blocking the spec)

- The exact 12-row product mapping table (Section 2) is filled in during
  implementation by querying live `Dim_Product`, since this session has no
  live DWH connection.
- Confirming Gama's `LegalEntityKey`/matriz `CustomerCode` in
  `Dim_LegalEntity` similarly requires a live query at implementation time.
