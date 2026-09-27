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

The only source of store-level truth is an internal tracking file: one of
our own employees manually logs every delivery (store, date,
PO/delivery-note number, quantity per product) into a **single, living
Excel workbook** that they keep appending to over time — not a periodic
export the client hands us. This spec covers turning that file into a
queryable DWH model, starting with the one snapshot already on hand
(`despacho-excelsior-gama.xlsx`, covering April–September so far) and
re-imported repeatedly as the employee keeps adding rows to it (see "Load
mechanism" below for what that means for re-import behavior), structured to
also accept a second such tracking file if the other consignment account
gets one later.

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
- **The file is hand-maintained**, so later rows can correct earlier ones
  (a typo'd quantity fixed in place, a store name spelled two different
  ways over time) rather than only ever appending net-new rows. The import
  design (Section 6) has to treat "same delivery, changed quantity" as an
  update, not a duplicate insert.

Given no per-line price exists in the source, and no invoice linkage exists
in either system, this spec pulls pricing from the matriz's own invoice
history (below) and does not attempt automatic double-counting prevention
via a join — see "Double-counting" below.

### What already exists (verified live against the DWH)

- **Gama already has 24 per-store child customer rows in `dim.Dim_Customer`**,
  all sharing `MatrizCode = 'J-301420608'` (the matriz, `CustomerKey = 29`,
  `LegalEntityKey = 26`) — e.g. `CustomerKey 35`, code `J-301420608-14`,
  name `EXCELSIOR GAMA SUPERMERCADOS, C. A. (Express Sebucán) G 113`. This
  contradicts this spec's original assumption that no per-store ERP
  entities exist for Gama — they do, and `dim.Dim_LegalEntity` /
  `Dim_Customer.MatrizCode` (`migrations/dwh/0014_dim_legal_entity.sql`,
  `0030_fix_matriz_scd2_...sql`) is exactly the "one matriz, N child stores"
  model this feature needs. **Revised design: reuse these 24 existing
  `Dim_Customer` rows as the store dimension — no new `Dim_ConsignmentStore`
  table.** Store-level analytics then joins the same `Dim_Customer`
  dimension every other DWH query already uses, instead of a parallel one.
- **Why `Fact_Sales` still has no store-level data for the file's date
  range, despite these rows existing:** querying `Fact_Sales` per child
  `CustomerKey` shows individual invoicing stopped around 2026-03-16 to
  2026-03-27 for every one of the 24 stores, and everything since has
  posted only against the matriz (`CustomerKey 29`: 152 lines, ~$17.5M,
  2026-04-22 through 2026-07-07) — which lines up with the tracking file
  starting 2026-04-16. So the premise holds (no store-level invoicing for
  the period this file covers); it's the *dimension* that already exists,
  not the fact data.
- **Store name mapping, resolved by hand (not fuzzy-matched) against the
  live query results:**

  | File Store Name | `Dim_Customer.CustomerCode` | `CustomerName` |
  |---|---|---|
  | Gama Plus Santa Eduvigis | `J-301420608-1` | (Express Santa Eduvigis) G-100 |
  | Gama Vizcaya | `J-301420608-10` | (Vizcaya) S004 |
  | Gama Express Santa Monica | `J-301420608-11` | (EXPRESS STA MONICA) G114 |
  | Gama La India | `J-301420608-12` | ( La India) |
  | Gama La Tahona | `J-301420608-13` | (Tahona) S002 |
  | Gama Express Sebucan Norte | `J-301420608-14` | (Express Sebucán) G 113 |
  | Gama La Urbina | `J-301420608-15` | (Express La Urbina) G106 |
  | Gama Express San Bernardino | `J-301420608-16` | (Express San Bernardino) G-101 |
  | Gama Express Macaracuay Plaza | `J-301420608-17` | (Macaracuay) S003 |
  | Gama Express Caurimare | `J-301420608-18` | (Express Caurimare) G108 |
  | Gama Panamericana | `J-301420608-19` | (PANAMERICANA) |
  | Gama Plus Santa Eduvigis | `J-301420608-2` | (Plus Sta Eduvigis) S007 |
  | Gama Express La Castellana | `J-301420608-20` | (Express La Castellana) S005 |
  | Gama Express Chuao | `J-301420608-21` | (EXPRESS Chuao) G102 |
  | Gama Los Palos Grandes | `J-301420608-22` | (Los Palos Grandes) S001 |
  | *(duplicate, do not map — see below)* | `J-301420608-23` | (Express Caurimare) G108 |
  | Gama Express Los Palos Grandes | `J-301420608-3` | (Express Los Palos Grandes LPG) |
  | Gama Express Las Mercedes | `J-301420608-4` | (Express Las Mercedes) G103 |
  | Gama Express Santa Fe | `J-301420608-5` | (EXPRESS SANTA FE) |
  | Gama Plus La Trinidad | `J-301420608-6` | (Plus La Trinidad) S008 |
  | Gama Express La Trinidad | `J-301420608-7` | (Express La Trinidad) G 110 |
  | Gama Express El Paraiso | `J-301420608-8` | (Express El Paraiso) |
  | Gama Santa Fe | `J-301420608-9` | (Santa Fe) S005 |
  | **Gama La Joya** | *(none — new store, no ERP child row)* | — |

  Two things resolved by direct query rather than guesswork: **`-18` and
  `-23` are true ERP duplicates** — same name, same store ("Express
  Caurimare G108") under two different customer codes. `-18` has zero
  `Fact_Sales` history and `-23` has exactly one line (2026-03-19); neither
  is a live, actively-used code today. This spec maps the file's one
  "Gama Express Caurimare" column to `-18` (the lower/first-created code)
  and leaves `-23` unmapped and untouched — it's a pre-existing ERP data
  quality issue, out of scope to fix here. Second, "Plus Sta Eduvigis"
  (`-2`) and "Plus La Trinidad" (`-6`) are two distinct real stores (the
  "Plus" format exists at both neighborhoods, separate from the "Express"
  stores at Santa Eduvigis `-1` and La Trinidad `-7`) — confirmed via
  `ZoneCode`/`TaxId` and the raw `saCliente` rows; no mismatch, both map
  cleanly. **User decision:** the one file store with no ERP match
  (`Gama La Joya`) gets a **new** `Dim_Customer`-shaped row created for it
  (not blocked) — see Section 1.
- **`sucursal` already means something else in this codebase** —
  `lib/components/reports/SucursalSelector.tsx` / `co_alma` /
  `Dim_Warehouse` is *our own* warehouse/branch, used to filter ERP report
  exports. It has no relationship to a consignment client's store locations,
  and is unaffected by this feature.
- **`dim.Dim_Product`** (`0006_dim_product.sql`): the 12 product names from
  the file, matched live against `IsCurrent = 1` rows — see Section 2 for
  the resolved mapping, including the 3 "Cj" (Caja/box) columns that have
  no case-level SKU in the ERP.
- **`fact.Fact_Sales`** (`0009_fact_sales.sql`): `CustomerKey`, `ProductKey`,
  `DateKey`, `QuantitySold`, `NetAmount` (BSD, see `erp_currency_bsd_usd`
  memory — needs `saTasa`/`Fact_ExchangeRate` conversion to USD, same
  pattern as every other USD-denominated DWH query in this codebase). This
  is the pricing source: Gama's matriz already has real consolidated
  invoice lines in here, each with a real `NetAmount`/`QuantitySold` per
  product per date.
- **No existing precedent for a manually-maintained (non-ERP,
  non-scheduled) data source feeding the DWH.** Every current `Load_*`
  procedure in `migrations/dwh/` pulls from a live `Ncake_a.dbo.*` ERP table
  on a watermark. This is the first source that's a hand-edited internal
  file — see "Load mechanism" below for why that means a different tool,
  not a new `Load_*` procedure.

## Design

### 1. Store dimension: reuse `dim.Dim_Customer` child rows

No new dimension. The 22 store names in the file (plus the one new store,
"Gama La Joya") map onto `dim.Dim_Customer` rows already present under
`MatrizCode = 'J-301420608'` — see the mapping table above. This means
`Fact_ConsignmentDeliveries` (Section 3) takes a plain `CustomerKey` FK,
exactly like `Fact_Sales` does, and any future join against
"which store" reuses the exact same dimension and key space the rest of
the DWH already joins against — no parallel store concept to keep in sync.

**"Gama La Joya" (new store, no existing ERP row):** insert one new row
directly into `dim.Dim_Customer` — `CustomerCode = 'J-301420608-24'` (next
available suffix), `CustomerName` following the existing naming
convention (`EXCELSIOR GAMA SUPERMERCADOS, C.A. (La Joya)`), `MatrizCode =
'J-301420608'`, `LegalEntityKey = 26`, `IsCurrent = 1`, `ValidFrom = now`,
same shape as every other row `Load_Dim_Customer` would produce from a real
`saCliente` row. This is a one-time manual INSERT in the feature's own
migration (Section 6's import script only *reads* `Dim_Customer`, it never
writes to it — keeping dimension writes inside migrations, matching how
every other `Dim_*` table in this codebase is populated). If
`Load_Dim_Customer` later runs and finds a *real* `saCliente` row for this
store (e.g. the client eventually gets a proper ERP code), the normal SCD2
change-detection in that procedure takes over from there — no special
handling needed on this feature's side.

### 2. Product mapping: manually-reviewed, not auto-fuzzy

Only 12 distinct product names exist in the file, resolved by hand against
a live `Dim_Product` query rather than a fuzzy-matching pipeline (a wrong
auto-match at this volume is a real, cheap-to-avoid risk):

| Excel Product String | `Dim_Product.ProductName` | `ProductCode` | Note |
|---|---|---|---|
| 4 Granos 500gr | Pan integral 4 Granos 500gr | `0000007` | |
| 7 Cereales 600gr | Pan integral 7 Cereales 600gr | `0000008` | |
| Miel y pasas 600gr | Pan integral Miel & Pasas 600gr | `0000009` | |
| Pan Blanco 600gr | Pan blanco 600gr | `0000022` | |
| Magdalena | Magdalenas | `0000016` | |
| Molido 300gr | Pan Molido 300gr | `0000011` | |
| Baguette 220gr | Baguette Topping Oregano 220gr | `0000004` | Only 220gr-labeled Baguette SKU; `Baguette 4 Granos 220gr` (`0000005`) and `Baguette Blanco 225gr` (`0000003`) were ruled out as different products |
| cheese Cake fresa | Cheese Cake Fresa 700gr | `0000017` | |
| cheese Cake Choco | Cheese Cake Chocolate 700gr | `0000018` | |
| Pizza Margarita 270 | Pizza Margarita Individual 270gr | `0000002` | |
| Pizza Magarita Cj | Pizza Margarita 550gr | `0000014` | **Box/case column — see caveat below** |
| Pizza New York Cj | Pizza New York 650gr | `0000015` | **Box/case column — see caveat below** |
| Pizza Americana Cj | Pizza Americana 550gr | `0000020` | **Box/case column — see caveat below** |

**Cj (Caja/box) caveat, user-confirmed:** these 3 columns record a box
count, not individual units, and no box-to-unit conversion factor exists
anywhere in this codebase (`Dim_Product` has no
units-per-case/presentation field). Per user decision, they map straight
to the individual-unit SKU with quantity recorded as delivered — i.e.
`QuantityDelivered` for these rows is box count, while `UnitPriceUsd`
(Section 4) is priced per individual unit from `Fact_Sales`. **This means
`LineAmountUsd` on these three products' rows is not directly comparable
to the other 9 products' rows without knowing units-per-box** — flagged
explicitly in the fact table's column comment and the import diagnostic
report, so nobody sums `LineAmountUsd` across all 12 products expecting an
apples-to-apples total without noticing.

Output: a static seed, `dwh.ConsignmentProductMap`
(`SourceClientTag`, `ExcelProductName`, `ProductKey`, `IsBoxUnit`),
populated once via reviewed INSERT statements committed to the migration —
not recomputed on every import run. Any future file introducing a 13th
product name with no match blocks that product's rows at import time
rather than guessing. `SourceClientTag` (e.g. `gama`) namespaces this
table per consignment client, since a second client's tracking file would
likely use different product names for the same or different SKUs.

### 3. Fact table: `fact.Fact_ConsignmentDeliveries`

```sql
CREATE TABLE fact.Fact_ConsignmentDeliveries (
    FactConsignmentDeliveryKey bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
    DateKey               int             NOT NULL,
    CustomerKey           int             NOT NULL, -- FK to dim.Dim_Customer — the store-level child row, not the matriz
    ProductKey            int             NOT NULL,
    NotaEntregaNum        varchar(30)     NULL,    -- raw string from the file (PO number or D/E/F/B-prefixed code); opaque
    QuantityDelivered     decimal(18,5)   NOT NULL, -- box count, not unit count, for the 3 "Cj" products — see ConsignmentProductMap.IsBoxUnit
    UnitPriceUsd          decimal(18,5)   NULL,     -- as-of price from the matriz's own Fact_Sales; NULL if no prior invoice exists yet for that product
    LineAmountUsd         decimal(18,2)   NULL,     -- QuantityDelivered * UnitPriceUsd, NULL when UnitPriceUsd is NULL; not unit-comparable for IsBoxUnit products
    SourceClientTag       varchar(40)     NOT NULL,
    SourceFileName        varchar(200)    NOT NULL,
    SourceRowKey          varchar(64)     NOT NULL, -- hash of (SourceClientTag, CustomerKey, date, nota, product) — identity, excludes qty
    SourceRowContentHash  varchar(64)     NOT NULL, -- hash of (qty) plus any other mutable fields — change detection
    LoadedAtUtc            datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Fact_ConsignmentDeliveries_Date FOREIGN KEY (DateKey) REFERENCES dim.Dim_Date(DateKey),
    CONSTRAINT FK_Fact_ConsignmentDeliveries_Customer FOREIGN KEY (CustomerKey) REFERENCES dim.Dim_Customer(CustomerKey),
    CONSTRAINT FK_Fact_ConsignmentDeliveries_Product FOREIGN KEY (ProductKey) REFERENCES dim.Dim_Product(ProductKey)
);
CREATE UNIQUE INDEX IX_Fact_ConsignmentDeliveries_RowKey ON fact.Fact_ConsignmentDeliveries (SourceRowKey);
CREATE INDEX IX_Fact_ConsignmentDeliveries_DateKey ON fact.Fact_ConsignmentDeliveries (DateKey);
CREATE INDEX IX_Fact_ConsignmentDeliveries_CustomerKey ON fact.Fact_ConsignmentDeliveries (CustomerKey);
```

`SourceRowKey` is the delivery's **identity** — store, date, nota/PO number,
and product, none of which the employee is expected to change once entered
(they'd log a correction as a new delivery, not silently move an existing
one to a different day). `SourceRowContentHash` covers what *can* change on
a re-edit (quantity today; extendable to price if that's ever captured).
This split matters because the source is hand-maintained and gets
corrected in place — a single hash over the whole row (as an
earlier draft of this spec had) would treat "quantity corrected from 18 to
20" as an unrelated new delivery instead of updating the existing one.

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
  AND fs.CustomerKey IN (SELECT CustomerKey FROM dim.Dim_Customer WHERE LegalEntityKey = 26 AND IsCurrent = 1) -- 26 = Gama's LegalEntityKey, confirmed live
  AND fs.DateKey <= @DateKey
  AND fs.IsVoided = 0
ORDER BY fs.DateKey DESC
```

This includes every Gama store's `Fact_Sales` lines (matriz and the
now-dormant per-store codes both), since the goal is "what did Gama pay per
unit of this product around this date," not a store-specific price — Gama
is billed one consolidated price regardless of which store received the
goods.

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

### 6. Load mechanism: manual import script, re-run against the growing file

Every existing `Load_*` procedure in `migrations/dwh/` runs against a live,
watermarked ERP table with a `validador`/`fe_us_mo` column to detect
changes. This source is a hand-maintained Excel workbook with no such
column, and the whole file is small enough (~500 rows today) that scanning
it in full each time is simpler and safer than trying to detect "new since
last run" from file metadata. Instead: `scripts/import-consignment-deliveries.ts`,
a Bun script re-run manually whenever the employee's tracking file has
moved forward (expected to be routine — this is their day-to-day log, not
an occasional handoff):

1. Read the `.xlsx` in full (a small library like `exceljs`; no existing
   xlsx *reader* in this codebase — `lib/xlsx.ts` only *writes* XLSX for
   report exports).
2. Look up each store name against the static store map from Section 1
   (a small in-script lookup table, `ExcelStoreName -> CustomerCode`, since
   there are only 23 entries and they don't change often); hard-fail
   listing any store name with no entry, same discipline as unmapped
   products — a brand-new store should be a deliberate migration change
   (Section 1's "Gama La Joya" pattern), not something the import script
   silently invents.
3. Look up each product against the reviewed `dwh.ConsignmentProductMap`;
   hard-fail listing any unmapped product name rather than skipping it
   silently.
4. Compute `SourceRowKey` (identity) and `SourceRowContentHash` (mutable
   fields) per row. For each row: no existing `SourceRowKey` → insert; a
   matching `SourceRowKey` whose `SourceRowContentHash` differs → update
   the existing row's quantity/price/amount in place; a matching key with
   an unchanged hash → skip. This makes every run safe to re-run against
   the same growing file, whether it added new rows, corrected old ones, or
   both.
5. Run the as-of pricing lookup (Section 4) per distinct
   `(ProductKey, DateKey)` in the batch, not per row, to avoid redundant
   queries.
6. Print a diagnostic report: rows inserted, rows updated (with old →
   new quantity for each, since a silent quantity change on a re-run is
   exactly the kind of thing worth a human glancing at), rows skipped
   (unmapped product or unmapped store, listed by name), products with no
   price found.

This script takes the file path as an argument and `SourceClientTag` (e.g.
`gama`), so a tracking file for the second consignment account, if one
gets created later, reuses the same script and the same `Fact_ConsignmentDeliveries`
table with its own product map and store lookup.

## Deliverables produced by implementation

1. **Migration** `migrations/dwh/0035_consignment_store_deliveries.sql`:
   the "Gama La Joya" `Dim_Customer` insert (Section 1), `ConsignmentProductMap`
   (with the 12 reviewed Gama rows seeded — 3 flagged `IsBoxUnit`),
   `Fact_ConsignmentDeliveries` — following the existing
   `IF NOT EXISTS`/`CREATE OR ALTER` re-runnable convention (see
   `migrations/dwh/README.md`).
2. **Import script** `scripts/import-consignment-deliveries.ts`, intended
   for repeated manual use going forward, not a one-time backfill.
3. **First import run** against `despacho-excelsior-gama.xlsx` as it stands
   today, with the diagnostic report (row counts, date range, any unmapped
   products/stores) shared back before considering the data ready for
   downstream use.
4. **No Analítica dashboard changes** in this pass — this spec stops at a
   queryable fact table. A `/analitica` tab or export surfacing this data
   is a separate, later spec once the base data is validated.
