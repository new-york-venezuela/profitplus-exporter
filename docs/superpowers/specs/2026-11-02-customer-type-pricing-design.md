# Precios por tipo de cliente: export/import por Excel — Design Spec

**Status:** implemented (2026-11-02). Items marked **[my call]** were decided by the assistant, not the user. Operator steps: `data/pricing-lists/RUNBOOK-tipo-cliente.md`; user guide: `data/pricing-lists/README.md` («Cargar desde Excel»). Sections 5-7 describe what was built, including the deviations from the first design noted there.

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
- `desde` is today or later (discounts: exactly today, see §6); `hasta` is end of day; planners never create overlapping periods; a regular price cannot change while an active or scheduled promotion covers that article/list.
- Existing CSV importers keep working unchanged.
- `--apply` requires `--confirm-db <DB_NAME>`.

## 4. Scope of articles

Sellable = `Dim_Product.LineName` in **Panadería, Pastelería, Pizza** (68 today, joined to ERP articles by `co_art`; Congelado/Fresco is a separate attribute, not the filter). The same rule rejects any article outside it in `Precios`, `Promociones` and `Descuentos`.
**[my call]** Include all active articles in those lines, not only recently sold ones; the user trims rows they do not want. If the DWH line is missing for a new article, the export lists it in a warning, not silently dropped.

## 5. Workbook

`pricing:export-xlsx` writes `data/pricing-lists/precios-actuales.xlsx` (never overwrites; `--out` to choose). Tabs:

1. `Listas`: lista, nombre, moneda (`USD`/`BSD`), desde, `nueva`. Existing lists are prefilled as context; only rows with `nueva = SI` are created, so the user adds the four type lists as new rows.
2. `Precios`: co_art, nombre, linea, categoria (Congelado/Fresco), `actual <lista>` per existing list (read-only context), one input column per list marked new, whose header equals that list's key. Empty cell = no price. Never `0`.
3. `Promociones`: same columns as `promotions.csv` plus `estado`. Rows with a filled `estado` are existing (active/scheduled) overlay promotions, shown as read-only context and not imported; to edit or cancel one use the app's Promociones tab. New promotions are rows with blank `estado`.
4. `Descuentos por cliente`: co_cli, co_art, `precio` (final price or `-N%`), desde, hasta (blank = permanent).
5. `Clientes`: co_cli, nombre, tip_cli_actual, des_tipo_actual, segmento (customer business group name, read-only context), lista_actual, lista_usada_90d, moneda_90d, `tip_cli_nuevo`. `tip_cli_nuevo` accepts the same values as `tipo-cliente:apply` plus the key or name of a new list from `Listas`.

`pricing:import-xlsx -- --file <path> [--step lists|promotions|customers|discounts|all] [--apply --confirm-db <DB_NAME>]` parses the workbook (pure reader with unit tests; rejects wrong headers or missing tabs), converts tabs 1-3 into the existing `lists/prices/promotions` plan inputs and tab 5 into `tipo-cliente:apply` rows, and runs the existing planners and services (`planImport`/`applyImport`, promo import, `planTipoCliente`/`applyTipoCliente`). Dry-run by default. Any plan problem blocks every write. When `customers` runs alone, new-list keys are resolved by list `nombre` against live Profit; duplicate live names make the step fail.

## 6. Per-customer discounts (special lists)

- A discount set = the customer's type list + overrides. Customers with an identical override set share one special list (named `Desc <key> · <type list>`). **[my call]**
- The special list is a full copy of the type list (Profit cannot fall back to another list mid-invoice) with overridden articles replaced; a `-N%` is computed against the type list price at import time, rounded to 5 decimals.
- Segments: permanent discounts (blank `hasta`) share one `group` segment per special list; dated discounts get a per-customer `special` segment (`pricing_segment_meta.kind = 'special'`), because special segments require an expiry. The dated segment stores `hasta` so the nightly sweep and the Vencimientos tab revert the customer to the type segment, which is why the type segment must already be assigned (apply order, §7).
- Dates: `desde` must equal the run date (today); any other value is a plan problem. `hasta` blank = permanent, otherwise strictly after today. A new list used as the type of a discounted customer must start today.
- A customer currently in a promotion segment, or in a discount segment different from this run's target, is reported as a plan error and not moved (move them to their type segment first).
- **Re-sync [my call]:** a special list is a snapshot. The dry-run warns for special lists whose non-overridden prices differ from their type list. There is no re-sync tool yet and applying the workbook does not re-sync; base-price changes never propagate automatically.
- Dry-run shows per special list which customers and how many articles differ from base.

## 7. Apply order (explicit)

1. Lists + regular prices. 2. Promotions. 3. Customers (`tip_cli_nuevo`, the type segment). 4. Discounts (special lists and segments; they need the type segment as fallback). Each step is idempotent; nothing moves a customer before step 3. `--step all` runs them in this order and stops at the first failing step. Rollback exists only for step 3 (`tipo-cliente:apply -- --rollback <runId>`); lists, prices, promotions and discounts cannot be deleted in Profit.

## 8. Errors and edge cases

- Article without a price in the target list at promotion `desde`: error (existing rule).
- Promotion price not below regular: warning.
- Customer currency differs from the list currency: warning (existing).
- Discount for a customer that does not exist, or an article outside scope: error, nothing written.
- Per-article failure does not abort others (existing transaction model).

## 9. Left to the builder

- Choice of xlsx library (prefer what `lib/xlsx.ts` already uses; read support may need an addition).
- Exact module layout under `lib/pricing/xlsx/`.
- Whether `import-xlsx` shells into the existing CSV code paths or shares their functions (prefer functions).

## 10. Open items to verify in the non-production rehearsal

Warehouse resolution of prices (today `000015`), unit of measure, USD/BSD invoice conversion (documented as unverified in `data/pricing-lists/README.md`). These do not change the design but may change the runbook.

## 11. Testing

Unit: xlsx reader, scope filter, discount compile (shared sets, percent maths, null price never 0), re-sync detection. Dry-run output snapshot test. ERP-writing integration only against non-production, excluded from `test`/`test:unit` like the other pricing ERP tests.
