# Customer-Type Pricing via Excel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export current pricing state to one `.xlsx`, let the user fill in type-list prices, promotions, per-customer discounts and customer types, and import it through the existing pricing services (dry-run by default).

**Architecture:** A thin workbook layer converts each sheet to the CSV text the existing parsers already read (`parseListsCsv`, `parsePricesCsv`, `parsePromotionsCsv`, `parseTipoClienteCsv`), so planners and ERP writers are reused unchanged. New logic is limited to: sheet adapter, sellable-article scope filter, discount compiler/applier, export builder, and two CLI scripts.

**Tech Stack:** Bun, TypeScript, `xlsx` (SheetJS, already a dependency, used by `lib/xlsx.ts`), `mssql`, Drizzle/`bun:sqlite`, `bun test`.

**Spec:** `docs/superpowers/specs/2026-11-02-customer-type-pricing-design.md` (operator steps: `...-runbook-DRAFT.md`).

## Global Constraints

- Sellable articles = `dim.Dim_Product.LineName` in `Panaderia`, `Pasteleria`, `Pizza` (DWH spelling, no accents), `IsCurrent = 1`, joined by trimmed `ProductCode` = ERP `co_art`. Anything else is rejected in `Precios`, `Promociones`, `Descuentos por cliente`.
- ERP writes only through existing services (`createList`, `cloneList`, `applyRates`, `createPromotion`, `createSegment`, `SegmentErp.moveCustomer`). No raw SQL writes.
- `desde` is today or later. Prices: `> 0`, max 5 decimals, never `0`; an empty cell means "no price", never `0`.
- All commands dry-run by default; `--apply` requires `--confirm-db <DB_NAME>` (`assertConfirmedDb` from `lib/customer-mapping/diff-csv`).
- Existing CSV importers and their tests stay unchanged and green.
- User-facing strings in Spanish, matching the existing importers.
- Tests live in `__tests__/unit/pricing/`, run with `bun test --isolate --env-file=.env.local <file>`.

## Review Focus

- Excel date cells arrive as serial numbers or `Date`, not `AAAA-MM-DD` text: must normalise to ISO, never shift a day for timezone.
- Excel floats such as `11.900000000000002` or `12.4` stored as number: must round to 5 decimals before `parsePrice`, and never print scientific notation.
- A `0` price or `-0%` discount must be an error, not a free article.
- Two `Descuentos` rows for the same customer+article, or one customer with mixed `hasta` values, must be an error, not last-wins.
- A discount whose article has no price in the customer's type list (so `-N%` or the copy has no base) must be an error.
- A customer with discounts but no resolvable type list (no `tip_cli_nuevo`, current segment not tied to a type list) must be an error.
- `tip_cli_nuevo` referring to a list key from `Listas` that does not exist in Profit yet must validate in dry-run and resolve to the real code at apply.

---

### Task 1: Workbook sheet adapter

**Files:**
- Create: `lib/pricing/xlsx/workbook.ts`
- Test: `__tests__/unit/pricing/xlsx-workbook.test.ts`

**Interfaces:**
- Produces:
  - `SHEET = { listas: 'Listas', precios: 'Precios', promociones: 'Promociones', descuentos: 'Descuentos por cliente', clientes: 'Clientes' } as const`
  - `readSheetCsv(buf: Buffer | Uint8Array, sheet: string, keep: string[]): { csv: string; errors: string[] }` — CSV text (comma-delimited, header first) containing only the `keep` columns in `keep` order, rows entirely blank dropped. Error if the sheet or a kept column is missing.
  - `readWorkbookRows(buf, sheet): { header: string[]; rows: string[][] }` — same normalisation without column selection (for the `nueva`/`estado` row filters).

- [ ] **Step 1: Write failing tests** (build workbooks in memory with `XLSX.utils.aoa_to_sheet`; `XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })`):
  - `numbers render without float noise`: cell `11.900000000000002` → `11.9`; `12.4` → `12.4`; `3` → `3`.
  - `date cells become ISO`: a real `Date` cell (UTC midnight 2026-11-09, written with `cellDates: true`) → `2026-11-09`; text `2026-11-09` unchanged.
  - `keeps only requested columns in order`, and `blank rows are dropped`.
  - `missing sheet and missing column report Spanish errors` (`Falta la hoja «Precios»`, `Falta la columna «co_art» en «Precios»`).
- [ ] **Step 2: Run, verify FAIL** (module not found).
- [ ] **Step 3: Implement** `readWorkbookRows` with `XLSX.read(buf, { cellDates: true })` and `sheet_to_json(ws, { header: 1, raw: true, defval: '' })`, then stringify per cell: number → `String(Math.round(n * 1e5) / 1e5)`; `Date` → ISO date using UTC components; string → trimmed. `readSheetCsv` quotes fields containing `,`, `"` or newline.
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** `feat(pricing): xlsx sheet adapter`.

### Task 2: Sellable-article scope

**Files:**
- Create: `lib/pricing/xlsx/scope.ts`
- Test: `__tests__/unit/pricing/xlsx-scope.test.ts`

**Interfaces:**
- Produces:
  - `SELLABLE_LINES = ['Panaderia', 'Pasteleria', 'Pizza'] as const`
  - `interface ScopedArticle { coArt: string; artDes: string; line: string; category: string }`
  - `partitionByScope(erp: ArticleRow[], dwh: { productCode: string; lineName: string | null; categoryName: string | null }[]): { inScope: ScopedArticle[]; unclassified: ArticleRow[] }` — `ArticleRow` from `lib/pricing/rates-erp`; codes compared trimmed, case-insensitive; `unclassified` = ERP articles with no current DWH row (reported as a warning, not included).
  - `fetchDwhProducts(pool: ConnectionPool): Promise<{ productCode: string; lineName: string | null; categoryName: string | null }[]>` — `SELECT RTRIM(ProductCode), LineName, CategoryName FROM dim.Dim_Product WHERE IsCurrent = 1`.
  - `scopeViolations(coArts: string[], inScope: ScopedArticle[], where: string): string[]` — one Spanish error per code outside scope: `${where}: ${coArt} no es un producto terminado (Panadería/Pastelería/Pizza)`.

- [ ] **Step 1: Write failing tests:** Materia Prima article excluded; `Panaderia`/`Pasteleria`/`Pizza` included regardless of Fresco/Congelado; ERP article absent from DWH lands in `unclassified`; `scopeViolations` returns an error for `ACEITE` and none for an in-scope code.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement** the pure functions and the one-query fetcher.
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** `feat(pricing): sellable article scope for xlsx import`.

### Task 3: Discount parsing and compilation

**Files:**
- Create: `lib/pricing/xlsx/discounts.ts`
- Test: `__tests__/unit/pricing/xlsx-discounts.test.ts`

**Interfaces:**
- Consumes: `parsePrice`, `semicolonHint` from `lib/pricing/list-import/csv`; `isValidIsoDate` from `lib/pricing/dates`.
- Produces:
  - `DISCOUNT_COLUMNS = ['co_cli', 'co_art', 'precio', 'desde', 'hasta'] as const` (`precio` is `12.40` or `-8%`).
  - `interface DiscountRow { line: number; coCli: string; coArt: string; kind: 'price' | 'percent'; value: number; desde: string; hasta: string | null }`
  - `parseDiscountsCsv(csv: string): { rows: DiscountRow[]; errors: string[] }` — errors: duplicate `(coCli, coArt)`; percent not in `(0, 100)` (`-0%`, `-100%`, positive `8%` also invalid: must start with `-`); price rule from `parsePrice`; bad dates; `hasta < desde`; one customer with different `hasta` values.
  - `interface DiscountSet { key: string; overrides: Map<string, number>; customers: { coCli: string; desde: string; hasta: string | null }[] }`
  - `compileDiscounts(rows: DiscountRow[], typeListPrices: (coCli: string) => Map<string, number> | null): { sets: DiscountSet[]; errors: string[] }` — percent price = `round5(base * (1 - pct/100))`, error if no base price for that article or result `<= 0`; customer with no resolvable type list → error; customers with identical `overrides` (same article → same price) and identical `desde` share one `DiscountSet`; `key` is a stable hash of sorted `coArt=price` pairs plus `desde`.

- [ ] **Step 1: Write failing tests:** `-8%` over base 10 gives `9.2`; result `0` rejected; duplicate row error; mixed `hasta` for one customer error; two customers with identical overrides → one set with two customers; same overrides but different `desde` → two sets; article missing in type list → error mentioning the `co_art`; unresolvable type list → error.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement** both functions (pure, no I/O).
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** `feat(pricing): per-customer discount parsing and compilation`.

### Task 4: Export workbook

**Files:**
- Create: `lib/pricing/xlsx/export.ts`, `scripts/pricing-export-xlsx.ts`
- Modify: `package.json` (script `"pricing:export-xlsx": "bun --bun run scripts/pricing-export-xlsx.ts"`)
- Test: `__tests__/unit/pricing/xlsx-export.test.ts`

**Interfaces:**
- Consumes: `ScopedArticle` (Task 2); `SHEET` (Task 1); `PriceListRow`, `RateRow` from `lib/pricing/rates-erp`; promotions from `listPromotions`/`listItems` (`lib/pricing/promotions-repo`).
- Produces:
  - `interface ExportData { lists: { coPrecio: string; desPrecio: string; coMone: string | null }[]; articles: ScopedArticle[]; currentPrice: Map<string, number> /* key `${coPrecio}|${coArt}` */; promotions: { name: string; coPrecio: string; startsOn: string; endsOn: string; reason: string | null; status: 'activa' | 'programada'; items: { coArt: string; monto: number }[] }[]; customers: { coCli: string; nombre: string; tipCli: string; desTipo: string; listaActual: string; lista90d: string }[] }`
  - `buildExportWorkbook(d: ExportData, today: string): Buffer` with sheets and headers:
    - `Listas`: `lista,nombre,moneda,desde,nueva` — existing lists prefilled (`lista` = `coPrecio`, `desde` = today, `nueva` blank); four empty rows are NOT added.
    - `Precios`: `co_art,nombre,linea,categoria,` then one `actual <coPrecio>` column per existing list (read-only context), then no input columns (the user adds one column per new list key).
    - `Promociones`: `promocion,lista,desde,hasta,motivo,co_art,precio,estado` — current/scheduled overlay promotions (not cancelled, `endsOn >= today`), `estado` filled.
    - `Descuentos por cliente`: header `co_cli,co_art,precio,desde,hasta`, no rows.
    - `Clientes`: `co_cli,nombre,tip_cli_actual,des_tipo_actual,lista_actual,lista_usada_90d,tip_cli_nuevo`.
  - `loadExportData(deps): Promise<ExportData>` — reads ERP lists/rates, scope (Task 2), SQLite promotions, customer rows (reuse the query behind `scripts/tipo-cliente-export.ts`; extract it to a shared function there rather than copying).

- [ ] **Step 1: Write failing tests** on `buildExportWorkbook` by reading the result back with `readWorkbookRows`: expected headers per sheet; `Precios` has one row per in-scope article with the existing price in the matching `actual <lista>` column and `''` where none; an expired or cancelled promotion is absent; `estado` is `activa` for a promotion covering today and `programada` for a future one.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement** the builder (use `XLSX.utils.aoa_to_sheet`, bold-free, column widths like `lib/xlsx.ts`), the loader, and the script: refuses to overwrite (`--out`, default `data/pricing-lists/precios-actuales.xlsx`), prints counts and the `unclassified` warning list.
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Smoke run** `bun run pricing:export-xlsx -- --out tmp/precios.xlsx` against the local ERP; expect 68 rows in `Precios`.
- [ ] **Step 6: Commit** `feat(pricing): export pricing state to xlsx`.

### Task 5: Import planner (dry-run)

**Files:**
- Create: `lib/pricing/xlsx/import.ts`, `scripts/pricing-import-xlsx.ts`
- Modify: `package.json` (`"pricing:import-xlsx": "bun --bun run scripts/pricing-import-xlsx.ts"`)
- Test: `__tests__/unit/pricing/xlsx-import.test.ts`

**Interfaces:**
- Consumes: Tasks 1-3; `parseListsCsv`, `parsePricesCsv`, `ListDef`, `PriceCell`; `parsePromotionsCsv`, `PromoDef`; `parseTipoClienteCsv`, `TipoClienteRow`; `planImport`; `planPromoImport`; `planTipoCliente`.
- Produces:
  - `interface ParsedWorkbook { lists: ListDef[]; cells: PriceCell[]; promos: PromoDef[]; discounts: DiscountRow[]; customers: TipoClienteRow[]; errors: string[] }`
  - `parseWorkbook(buf: Buffer, inScope: ScopedArticle[]): ParsedWorkbook` — rules:
    - `Listas`: only rows with `nueva` = `SI` (case-insensitive) become `ListDef`s; header must contain `lista,nombre,moneda,desde,nueva`.
    - `Precios`: keep `co_art` plus every column whose header equals a new list key; unknown extra columns (`actual …`, `linea`, `categoria`) ignored; prices for codes outside scope → `scopeViolations`.
    - `Promociones`: only rows with blank `estado`; keep `PROMO_COLUMNS`; scope check on `co_art`.
    - `Descuentos por cliente`: `parseDiscountsCsv`; scope check on `co_art`.
    - `Clientes`: keep `co_cli,nombre,moneda_90d?,tip_cli_nuevo` (column `moneda_90d` optional); a `tip_cli_nuevo` equal to a new list key or name is rewritten to the sentinel `L:@<key>`, resolved at apply time (Task 6).
  - `planWorkbook(deps, parsed, today): Promise<WorkbookPlan>` where `WorkbookPlan = { lists: ImportPlan; promos: CheckedPromoPlan; customers: TipoClientePlan | null; discounts: { sets: DiscountSet[]; errors: string[] }; warnings: string[]; problems: string[] }`. `customers` is `null` (with a warning) when any customer target is `L:@key` for a list not yet created; keys are validated against `Listas`.
  - Script flags: `--file <path>` (required), `--apply`, `--confirm-db`, `--step lists|promotions|customers|discounts|all` (default `all`; `all` runs in that order and stops at the first step with failures). Dry-run output reuses the formats of `pricing-lists-import.ts` / `pricing-promotions-import.ts`, plus per-customer discount lines `cliente → lista especial <key> (N artículos distintos)`. Exit 1 on any problem, with nothing written.

- [ ] **Step 1: Write failing tests** for `parseWorkbook`: existing list rows (no `nueva`) ignored; new list key `B` picks up its price column; `actual 01` ignored; out-of-scope `co_art` in `Precios`, `Promociones` and `Descuentos` each yield a scope error; promotion rows with `estado` filled ignored; `tip_cli_nuevo = Cadenas` (a new list name) becomes `L:@B`-style sentinel; semicolon-damaged or header-damaged sheets yield errors, nothing partial.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement** `parseWorkbook` (composition only) and `planWorkbook` (call the existing planners with their existing deps; type-list prices for `compileDiscounts` come from the parsed `Precios` cells for new lists, or `currentPrices` for existing ones).
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Write failing test** `planWorkbook reports 0 writes`: with fake deps, assert the fakes' write methods were never called.
- [ ] **Step 6: Implement the script dry-run path**; run `bun run pricing:import-xlsx -- --file tmp/precios.xlsx` on the exported file; expect a clean "Simulación: no se escribió nada" and exit 0.
- [ ] **Step 7: Commit** `feat(pricing): xlsx import dry-run`.

### Task 6: Apply steps (lists, promotions, customers)

**Files:**
- Modify: `lib/pricing/xlsx/import.ts`, `scripts/pricing-import-xlsx.ts`
- Test: `__tests__/unit/pricing/xlsx-import.test.ts` (extend)

**Interfaces:**
- Consumes: `applyImport`, `applyPromoImport`, `applyTipoCliente`.
- Produces:
  - `resolveListSentinels(rows: TipoClienteRow[], created: { key: string; coPrecio: string }[]): TipoClienteRow[]` — replaces `L:@key` with `L:<coPrecio>`; unknown key throws `Error('Lista «key» no existe')`.
  - `applyWorkbook(deps, plan: WorkbookPlan, parsed: ParsedWorkbook, step: Step, actor: Actor, runFile: string): Promise<StepOutcome[]>` — runs steps in the fixed order lists → promotions → customers; the customers step re-plans (`planTipoCliente`) after sentinel resolution against live ERP, so segments for new lists exist before moves.

- [ ] **Step 1: Write failing tests:** `resolveListSentinels` maps and throws; `applyWorkbook` with step `promotions` never calls the lists writer; the order `lists → promotions → customers` is respected (spy call order) for `all`.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement**; script `--apply` wires `assertConfirmedDb`, actor `{ id: 'import-xlsx', erpUser: process.env.PRICING_ERP_SERVICE_USER ?? 'PROFIT' }`, run file `data/tipo-cliente/runs/<runId>.jsonl` (same as `tipo-cliente:apply`, so its `--rollback` works unchanged).
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** `feat(pricing): apply lists, promotions and customer types from xlsx`.

### Task 7: Apply per-customer discounts

**Files:**
- Create: `lib/pricing/xlsx/discounts-run.ts`
- Modify: `scripts/pricing-import-xlsx.ts` (step `discounts`, runs last)
- Test: `__tests__/unit/pricing/xlsx-discounts-run.test.ts`

**Interfaces:**
- Consumes: `DiscountSet` (Task 3); `cloneList` (`lib/pricing/lists-service`, `rows` + `effectiveFrom` options); `createSegment` (`lib/pricing/segments-service`); `SegmentErp.moveCustomer`.
- Produces:
  - `specialListName(typeListName: string, key: string): string` — `Desc ${key} · ${typeListName}` truncated to 60 chars.
  - `applyDiscountSets(deps: { lists: ListsDeps; segments: ServiceDeps }, sets: DiscountSet[], typeOf: (coCli: string) => { coPrecio: string; tipCli: string }, actor: Actor): Promise<DiscountOutcome[]>` where `DiscountOutcome = { key: string; coPrecio: string; reusedList: boolean; customers: { coCli: string; outcome: 'success' | 'conflict' | 'error'; message?: string }[] }`.
  - Behaviour (plan decisions, spec §6 refined): list = `cloneList` of the customer's type list with `rows` = its current rows overridden by `set.overrides`, `effectiveFrom = set.customers[0].desde`; an existing list with the same `specialListName` is reused (idempotent). Customers with `hasta` null → one shared `group` segment per set (`createSegment` kind `group`, name = the list name) then `moveCustomer`. Customers with `hasta` → per-customer `createSegment` kind `special` (`reason: 'Descuento por artículo'`, `expiresOn: hasta`, `fallbackTipCli: typeOf(coCli).tipCli`), which also moves the customer; the existing nightly sweep reverts them at expiry. A failing customer never stops the others.
  - Dry-run helper `describeDiscountSets(sets, existingListNames): string[]` for the script output (count of differing articles per set).

- [ ] **Step 1: Write failing tests** with fake deps: shared overrides produce one `cloneList` call and one group segment for two permanent customers; a dated customer gets a `special` segment with `expiresOn` = `hasta` and the fallback = type segment; re-running with the list already present makes no `cloneList` call; one `moveCustomer` conflict leaves the other customer `success`.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement** as described.
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Extend `planWorkbook` output / script** so dry-run prints `describeDiscountSets`, and a re-sync notice listing special lists whose non-overridden prices differ from the current type list (compare `readListRates` of the special list vs type list outside `overrides`).
- [ ] **Step 6: Commit** `feat(pricing): per-customer discount lists from xlsx`.

### Task 8: Docs and spec alignment

**Files:**
- Modify: `data/pricing-lists/README.md` (new section «Cargar desde Excel»), `AGENTS.md` (Bulk pricing tools paragraph, `lib/pricing/xlsx/` entry), `docs/superpowers/specs/2026-11-02-customer-type-pricing-design.md` (§5, §6, §7)
- Rename: `docs/superpowers/specs/2026-11-02-customer-type-pricing-runbook-DRAFT.md` → `data/pricing-lists/RUNBOOK-tipo-cliente.md` (drop DRAFT banner; remove **(nuevo)** markers)

- [ ] **Step 1:** Update the spec to match what was built: apply order is lists → promotions → **customers (type)** → discounts (special segments need the type segment as fallback); permanent discounts use a shared group segment, dated ones a per-customer special segment (special segments require an expiry); existing promotions in `Promociones` are read-only context (edit them in the app tab), new rows have blank `estado`; `Listas` uses a `nueva` column.
- [ ] **Step 2:** Update the runbook to the same order (steps 6 and 8 swap) and the `--step` flags.
- [ ] **Step 3:** Run `bun run test:unit`; expect all green.
- [ ] **Step 4: Commit** `docs(pricing): xlsx pricing runbook and spec alignment`.

---

## Self-review

- **Spec coverage:** §4 scope → Task 2, enforced in 5; §5 workbook → 1, 4, 5; §6 discounts → 3, 7 (with refinements recorded in Task 8); §7 order → 6, 7, 8; §8 errors → Review Focus tests in 3, 5; §10 rehearsal → runbook (Task 8); §11 testing → every task.
- **Deviations from the spec, recorded and applied to the spec in Task 8:** apply order swap; permanent vs dated segments; existing promotions read-only.
- **Type consistency:** `ScopedArticle`, `DiscountRow`, `DiscountSet`, `ParsedWorkbook`, `WorkbookPlan` are defined once and reused by name.
