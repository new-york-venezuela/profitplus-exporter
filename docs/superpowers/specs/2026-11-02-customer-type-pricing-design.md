# Precios por tipo de cliente: export/import por Excel — Design Spec

**Status:** shape approved in conversation (2026-11-02). Items marked **[my call]** were decided by the assistant, not the user; check them. Operator steps: `2026-11-02-customer-type-pricing-runbook-DRAFT.md` (becomes `data/pricing-lists/README.md` content when built).

## 1. Intent

Lower base prices per customer type (Cadenas, Independientes, Mayoristas, Restaurantes) and load current temporary promotions and per-customer article discounts, from one Excel workbook the user fills in and hands back. Builds on the existing pricing stack (`lib/pricing/`): lists and regular prices, overlay promotions, special one-customer segments, bulk `tip_cli` assignment.

## 2. Goals / non-goals / anti-goals

**Goals**
- Export the current state to `.xlsx`; import the filled workbook through the existing services.
- Four type lists with final prices set by the user (not computed from rules).
- Promotions (overlay, dated) loadable from the same workbook.
- Per-customer, per-article discounts via special lists.
- Dry-run by default, same safety model as `pricing:import-lists`.

**Non-goals**
- Percentage rule engine for base prices (user gives final prices).
- Volume discounts (`saDescArticulo`).
- Raw materials, packaging, admin or maintenance articles.
- Deleting lists or rates (Profit does not allow it).

**Anti-goals**
- Moving customers to a new list before its prices are verified.
- A raw-material or non-sellable article getting a price.
- A missing price rendering as `0`, or a silent write on dry-run.

## 3. Constraints

- A customer has exactly one list, via `saCliente.tip_cli` → `saTipoCliente.co_precio`. `co_seg` is never written.
- ERP writes only through `pApi*` procs, using the existing services (`createList`, `applyRates`, `createPromotion`, `SegmentErp.moveCustomer`). No new ERP logic.
- `desde` is today or later; `hasta` is end of day; planners never create overlapping periods; a regular price cannot change while an active or scheduled promotion covers that article/list.
- Existing CSV importers keep working unchanged.
- `--apply` requires `--confirm-db <DB_NAME>`.

## 4. Scope of articles

Sellable = `Dim_Product.LineName` in **Panadería, Pastelería, Pizza** (68 today, joined to ERP articles by `co_art`; Congelado/Fresco is a separate attribute, not the filter). The same rule rejects any article outside it in `Precios`, `Promociones` and `Descuentos`.
**[my call]** Include all active articles in those lines, not only recently sold ones; the user trims rows they do not want. If the DWH line is missing for a new article, the export lists it in a warning, not silently dropped.

## 5. Workbook

`pricing:export-xlsx` writes `data/pricing-lists/precios-actuales.xlsx` (never overwrites; `--out` to choose). Tabs:

1. `Listas`: lista, nombre, moneda (`USD`/`BSD`), desde. Existing lists prefilled; the user adds the four type lists.
2. `Precios`: co_art, nombre, línea, categoría (Congelado/Fresco), current price per existing list (read-only context), one input column per list of `Listas` marked new. Empty cell = no price. Never `0`.
3. `Promociones`: same columns as `promotions.csv` plus `estado` (activa/programada, read-only), pre-filled with current and scheduled overlay promotions.
4. `Descuentos por cliente`: co_cli, co_art, `precio` (final) or `-N%`, desde, hasta (blank = permanent).
5. `Clientes`: co_cli, nombre, current segment/list, 90-day list used, `tipo nuevo`.

`pricing:import-xlsx -- --file <path>` parses the workbook (new xlsx reader, pure module with unit tests; rejects a workbook with wrong headers or `;`-style damage like the CSV readers), converts tabs 1-3 into the existing `lists/prices/promotions` plan inputs, and runs the existing planners. It reuses `planImport`/`applyImport`, `parsePromotions`/promo import, and tipo-cliente apply logic rather than reimplementing them.

## 6. Per-customer discounts (special lists)

- A discount set = the customer's type list + overrides. Customers with an identical override set share one special list/segment. **[my call]**
- The special list is a full copy of the type list (Profit cannot fall back to another list mid-invoice) with overridden articles replaced; a `-N%` is computed against the type list price at import time, rounded to 5 decimals.
- Segment is a one-customer (or shared) `special` segment (`pricing_segment_meta.kind = 'special'`); `hasta` is stored so the nightly sweep and the Vencimientos tab handle expiry, reverting to the type segment.
- **Re-sync [my call]:** a special list is a snapshot. `pricing:import-xlsx` dry-run lists special lists whose non-overridden prices differ from their type list; applying the workbook re-syncs them. Not automatic on base-price changes.
- Dry-run shows per customer: which special list is created/reused and how many articles differ from base.

## 7. Apply order (explicit)

1. Lists + regular prices. 2. Promotions. 3. Special lists. 4. Assign customers (`tipo nuevo`, plus special segments for discounted customers). Each step is idempotent; nothing moves a customer until step 4.

## 8. Errors and edge cases

- Article without a price in the target list at promotion `desde`: error (existing rule).
- Promotion price not below regular: warning.
- Customer currency differs from the list currency: warning (existing).
- Discount for a customer that does not exist, or an article outside scope: error, nothing written.
- Per-article failure does not abort others (existing transaction model).

## 9. Left to the builder

- Choice of xlsx library (prefer what `lib/xlsx.ts` already uses; read support may need an addition).
- Exact module layout under `lib/pricing/xlsx-import/`.
- Whether `import-xlsx` shells into the existing CSV code paths or shares their functions (prefer functions).

## 10. Open items to verify in the non-production rehearsal

Warehouse resolution of prices (today `000015`), unit of measure, USD/BSD invoice conversion (documented as unverified in `data/pricing-lists/README.md`). These do not change the design but may change the runbook.

## 11. Testing

Unit: xlsx reader, scope filter, discount compile (shared sets, percent maths, null price never 0), re-sync detection. Dry-run output snapshot test. ERP-writing integration only against non-production, excluded from `test`/`test:unit` like the other pricing ERP tests.
