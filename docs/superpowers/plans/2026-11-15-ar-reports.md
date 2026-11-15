# AR Reports (Retenciones + Facturas pendientes por cobrar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two read-only ERP reports of open receivables, "Comprobantes de Retenciones" and "Facturas pendientes por cobrar", to the existing Reportes section.

**Architecture:** `ReportConfig.queryType` gains `'query'`: a report ships its own parameterised SQL (`fetch`) and a pure row mapper (`map`), registered in one dispatcher (`lib/reports/query-reports.ts`) that both the preview and export routes call. A `snapshot` flag hides the date picker (state as of today).

**Tech Stack:** Next.js 16 App Router, `mssql` (ERP pool `getPool()`), bun test, existing `buildXlsx`/`buildCsv`.

**Spec:** `docs/superpowers/specs/2026-11-15-ar-reports-design.md`

## Global Constraints

- ERP is read-only: no `INSERT/UPDATE`, no procs, no new SQLite/DWH tables.
- Population = `saDocumentoVenta` rows with `ISNULL(anulado,0) = 0 AND saldo <> 0`.
- Seller = document `co_ven`, falling back to the customer's `saCliente.co_ven` when the document's is blank.
- Customer type = `saCliente.co_seg` -> `saSegmento` description, read live (never hardcode cadena/independiente).
- Retention = `IVA total x 0.75`, rounded to 2 decimals; documented limitation: 100 % withholders not distinguished.
- A missing figure is blank (`null`), never `0` (same invariant as recipes/statements).
- All user-controlled SQL values via `.input()`; results through `trimStrings`; dates through `formatDate` (`lib/dates.ts`).
- No module gate: any authenticated session (`getSession()` -> 401), like Ventas/Compras. Spanish UI/labels.
- Commit after each task, one logical change per commit.

## Review Focus

- Open FACT with no line rows in `saFacturaVentaReng`: base/exento blank, never 0 (Task 4 test).
- Invoice with no `fec_venc`: credit days blank, not 0 or negative (Task 4 test).
- Customer with no `co_seg` or seller blank on both document and customer: type "Sin asignar", seller blank (Task 3/4 tests).
- Exempt-only invoice: base 0 and IVA 0 are real zeros, exempt carries the amount (Task 2 test).
- Open N/CR for a special contributor in Retenciones: shown with its own `tipo_doc`, amounts positive as stored, no sign flip (Task 3 test).
- Preview with thousands of open rows: total count is real, rows capped at 100 (Task 5 test).

---

### Task 1: Probe the live ERP and record the findings

Blocks Tasks 2-4 (they need the exempt code and the line-base formula). Needs the ERP reachable (`servidor01:1435` timed out in design; ask the user for VPN/network if it still does). Read-only.

**Files:**
- Modify: `docs/superpowers/specs/2026-11-15-ar-reports-design.md` (the "Unverified" bullet of the research notes)
- Scratch (not committed): a probe script run with `bun --env-file=.env.local <script>` from the repo root (an earlier draft is at `/private/tmp/claude-501/-Users-eugenio-repos-new-york-venezuela-profitplus-exporter/65191f2b-66a8-4c77-98fc-ce4f6dd25e82/scratchpad/probe-ar.ts`; copy it under `tmp/` to run, delete after).

- [ ] **Step 1: Run the probe** and answer, with output pasted into the spec notes:
  1. Open documents (`saldo <> 0`, not anulado) by `co_tipo_doc` and `saCliente.contrib`.
  2. Distinct `tipo_imp` values in `saFacturaVentaReng` with `porc_imp` range: which code is exempt, which are IVA.
  3. For 10 open FACT: compare `saDocumentoVenta.total_neto`/`monto_imp` with `SUM(saFacturaVentaReng.reng_neto)`/`SUM(monto_imp)` and the header's `monto_desc_glob`/`otros1-3`. Decide `lineBaseExpr` (e.g. `reng_neto - monto_imp`) such that `SUM(base) + SUM(exempt) + SUM(iva) = total_neto` (to the cent) for all 10; if global discounts break it, record the prorated columns to use (`monto_desc_glob`, `monto_reca_glob`).
  4. Whether any open N/DB or N/CR exist for `contrib = 1`, and whether open N/CR have `saDocumentoVentaReng` rows.
  5. Count of open documents with blank `co_ven`; `saSegmento` columns (confirm description column name) and how many customers have `co_seg` NULL.
  6. Does `saDocumentoVenta` join `saFacturaVenta` on `nro_doc = doc_num` for FACT (confirm with row counts).
- [ ] **Step 2: Write the answers into the spec** (replace the "Unverified until the ERP is reachable" bullet with the findings; state `EXEMPT_TIPO_IMP` and `lineBaseExpr` explicitly). If any finding contradicts the design (e.g. base cannot be reconciled), stop and ask the user before Task 4.
- [ ] **Step 3: Commit**
```bash
git add docs/superpowers/specs/2026-11-15-ar-reports-design.md
git commit -m "docs(reports): record ERP findings for AR reports"
```

---

### Task 2: Query-report plumbing (registry, dispatcher, routes, tax buckets)

**Files:**
- Modify: `lib/reports/registry.ts`, `app/api/reports/[report]/preview/route.ts`, `app/api/reports/[report]/export/route.ts`, `components/report-page.tsx`
- Create: `lib/reports/query-reports.ts`, `lib/reports/tax-buckets.ts`
- Test: `lib/reports/__tests__/query-reports.test.ts`, `lib/reports/__tests__/tax-buckets.test.ts`

**Interfaces:**
- Produces:
  - `ReportConfig`: `queryType: 'view' | 'procedure' | 'query'`, new optional `snapshot?: boolean`.
  - `lib/reports/tax-buckets.ts`:
    `export const EXEMPT_TIPO_IMP: string` (value from Task 1);
    `export interface LineAgg { tipoImp: string; base: number; iva: number }`;
    `export function splitTaxBuckets(lines: LineAgg[]): { base: number; exento: number; iva: number } | null` (null when `lines` is empty; exempt = lines whose `tipoImp === EXEMPT_TIPO_IMP`, their `base` goes to `exento` and their `iva` is ignored; everything else sums to `base`/`iva`; sums rounded to 2 decimals).
  - `lib/reports/query-reports.ts`:
    `export interface QueryFilters { startDate?: string; endDate?: string }`;
    `export interface QueryReport { fetch(pool: sql.ConnectionPool, filters: QueryFilters): Promise<Record<string, unknown>[]>; map(rows: Record<string, unknown>[]): Record<string, unknown>[] }`;
    `export const QUERY_REPORTS: Record<string, QueryReport>` (empty here; Tasks 3-4 add entries);
    `export async function runQueryReport(reportId: string, pool: sql.ConnectionPool, filters: QueryFilters): Promise<Record<string, unknown>[]>` (fetch -> `trimStrings` -> map; throws `Error('Reporte no encontrado')` for an unknown id, using `Object.hasOwn`).

- [ ] **Step 1: Failing tests.** `tax-buckets.test.ts`: `[]` -> `null`; one IVA line `{tipoImp:'1',base:100,iva:16}` -> `{base:100,exento:0,iva:16}`; exempt-only `[{tipoImp:EXEMPT_TIPO_IMP,base:50,iva:0}]` -> `{base:0,exento:50,iva:0}` (real zeros); mixed lines sum with 2-decimal rounding (`0.1+0.2` case -> `0.3`). `query-reports.test.ts`: a fake registered report runs fetch -> trims padded strings -> maps; unknown id rejects with `Reporte no encontrado`; `'__proto__'`/`'constructor'` ids reject the same way.
- [ ] **Step 2: Run** `bun test --env-file=.env.local lib/reports/__tests__` -> FAIL (modules missing).
- [ ] **Step 3: Implement** the interfaces above. `QUERY_REPORTS` is a plain object; tests register a fake entry by mutating it and cleaning up in `afterEach`.
- [ ] **Step 4: Routes.** In both routes add a `config.queryType === 'query'` branch before the procedure branch: filters come only from explicit `startDate`/`endDate` query params (`parseDate(sp.get(...)) ?? undefined`, no previous-month default); `rows = await runQueryReport(reportId, pool, filters)`. Preview returns `{ rows: rows.slice(0, 100), total: rows.length }`; export reuses the existing xlsx/csv code path (extract the final xlsx/csv responses so the new branch shares them; do not duplicate). Filename for snapshot reports: `${reportId}_${today YYYY-MM-DD}.xlsx|csv`. `report_exported` event keeps firing with `rowCount`. Keep the `sourceName` regex check only when `sourceName` is set (query reports may omit it).
- [ ] **Step 5: `components/report-page.tsx`.** When `config.snapshot`, do not render `DateRangePicker` and do not send `startDate`/`endDate` in preview or export URLs.
- [ ] **Step 6: Route tests** (`app/api/reports/__tests__/query-route.test.ts`, mock `getSession`, `getPool`, `runQueryReport` with `mock.module`): no session -> 401; unknown id -> 404; preview with 250 rows -> `total: 250` and `rows.length === 100`; export `format=csv` returns `text/csv` with the BOM and header labels from the config columns; `format=bad` -> 400.
- [ ] **Step 7: Run** `bun test --env-file=.env.local lib/reports app/api/reports` -> PASS; `bun run lint` and `bunx tsc --noEmit` clean.
- [ ] **Step 8: Commit** `feat(reports): add query-type reports plumbing`

---

### Task 3: Comprobantes de Retenciones report

**Files:**
- Create: `lib/reports/retenciones.ts` (config), `lib/reports/retenciones-mapper.ts`, `lib/reports/queries/retenciones-query.ts`
- Modify: `lib/reports/registry.ts` (add `retenciones`), `lib/reports/query-reports.ts` (register)
- Test: `lib/reports/__tests__/retenciones-mapper.test.ts`, `lib/reports/__tests__/retenciones-query.test.ts`

**Interfaces:**
- Consumes: `QueryReport`, `QUERY_REPORTS`, `QueryFilters` (Task 2).
- Produces:
  - `RETENCIONES_CONFIG: ReportConfig` with `id: 'retenciones'`, `label: 'Comprobantes de Retenciones'`, `queryType: 'query'`, `snapshot: true`, columns (key / label / type): `vendedor` Vendedor, `tipo_cliente` Tipo de cliente, `cli_des` Cliente, `tipo_doc` Tipo de documento, `nro_doc` Nº documento, `fec_emis` Fecha de emisión (`date`), `iva_total` IVA total (`number`), `retencion_75` 75 % del IVA (retención por conciliar) (`number`), `saldo` Saldo pendiente (`number`); all default-visible in that order.
  - `fetchRetenciones(pool: sql.ConnectionPool, filters: QueryFilters): Promise<Record<string, unknown>[]>` returning raw rows `{ co_tipo_doc, nro_doc, fec_emis, cli_des, vendedor, tipo_cliente, monto_imp, saldo }`.
  - `mapRetencionesRows(rows: Record<string, unknown>[]): Record<string, unknown>[]`.

- [ ] **Step 1: Failing mapper tests** (inputs are raw query rows): FACT with `monto_imp: 160` -> `iva_total: 160`, `retencion_75: 120`; rounding `monto_imp: 33.33` -> `retencion_75: 25`; `monto_imp` null -> `iva_total: null` and `retencion_75: null` (blank, not 0); N/CR row keeps `tipo_doc: 'N/CR'` and positive stored values (no sign flip); blank `tipo_cliente` -> `'Sin asignar'`; `fec_emis` formatted `YYYY-MM-DD` via `formatDate`; blank vendedor stays `''`.
- [ ] **Step 2: Failing query test** with a fake pool recording `request().input(...).query(sql)`: the SQL contains `saldo <> 0`, `ISNULL(d.anulado, 0) = 0`, `c.contrib = 1`, `d.co_tipo_doc IN ('FACT', 'N/CR', 'N/DB')`, the seller fallback (`COALESCE(NULLIF(RTRIM(d.co_ven), ''), RTRIM(c.co_ven))` joined to `saVendedor`) and `saSegmento`; with no filters no date inputs are bound; with `startDate`/`endDate` it binds `@startDate`/`@endDate` (`sql.Date`) and adds a `d.fec_emis BETWEEN` clause.
- [ ] **Step 3: Run** the two test files -> FAIL.
- [ ] **Step 4: Implement** config, mapper and `fetchRetenciones` (column names per Task 1 findings, e.g. the `saSegmento` description column and the `saVendedor` name column), order by `c.cli_des, d.fec_emis, d.nro_doc`. Register in `REPORTS` and `QUERY_REPORTS`.
- [ ] **Step 5: Run** `bun test --env-file=.env.local lib/reports` -> PASS.
- [ ] **Step 6: Commit** `feat(reports): add Comprobantes de Retenciones report`

---

### Task 4: Facturas pendientes por cobrar report

**Files:**
- Create: `lib/reports/cxc-pendientes.ts`, `lib/reports/cxc-pendientes-mapper.ts`, `lib/reports/queries/cxc-pendientes-query.ts`
- Modify: `lib/reports/registry.ts`, `lib/reports/query-reports.ts`
- Test: `lib/reports/__tests__/cxc-pendientes-mapper.test.ts`, `lib/reports/__tests__/cxc-pendientes-query.test.ts`

**Interfaces:**
- Consumes: `splitTaxBuckets`, `LineAgg`, `QueryReport` (Task 2).
- Produces:
  - `CXC_PENDIENTES_CONFIG: ReportConfig`, `id: 'cxc-pendientes'`, `label: 'Facturas pendientes por cobrar'`, `queryType: 'query'`, `snapshot: true`; columns: `vendedor`, `tipo_cliente`, `cli_des` Cliente, `nro_factura` Nº factura, `fec_emis` Fecha de emisión (`date`), `fec_venc` Fecha de vencimiento (`date`), `dias_credito` Días de crédito (`number`), `base_imp` Base imponible (`number`), `exento` Monto exento (`number`), `iva` IVA (`number`).
  - `fetchCxcPendientes(pool, filters)`: one query for open FACT headers (same population, seller fallback and segment join as Task 3, plus `fec_venc`) and one for their lines aggregated per `(doc_num, tipo_imp)` using the `lineBaseExpr` from Task 1 (`SUM(<lineBaseExpr>) AS base, SUM(monto_imp) AS iva`), restricted to the same document set; returns header rows with a `lines: LineAgg[]` array attached per document (empty array when none).
  - `mapCxcPendientesRows(rows)`: output keys above.

- [ ] **Step 1: Failing mapper tests:** invoice with lines `[{tipoImp:'1',base:100,iva:16}, {tipoImp:EXEMPT_TIPO_IMP,base:50,iva:0}]` -> `base_imp 100, exento 50, iva 16`; `lines: []` -> `base_imp`, `exento`, `iva` all `null` (not 0); `fec_emis 2026-10-01`, `fec_venc 2026-10-22` -> `dias_credito: 21`; `fec_venc` null -> `fec_venc: ''`, `dias_credito: null`; same-day due date -> `dias_credito: 0` (a real zero, contado); vendedor/tipo_cliente behave as in Task 3.
- [ ] **Step 2: Failing query test** (fake pool): header SQL has `co_tipo_doc = 'FACT'`, `saldo <> 0`, `ISNULL(d.anulado, 0) = 0`, seller fallback; lines SQL reads `saFacturaVentaReng` joined on `doc_num`; the two result sets are stitched by document number, a document without lines gets `lines: []`; date filters bind `.input` as in Task 3.
- [ ] **Step 3: Run** -> FAIL. **Step 4: Implement**, register in `REPORTS` and `QUERY_REPORTS`. **Step 5: Run** `bun test --env-file=.env.local lib/reports` -> PASS.
- [ ] **Step 6: Commit** `feat(reports): add Facturas pendientes por cobrar report`

---

### Task 5: Pages, navigation and ERP reconciliation test

**Files:**
- Create: `app/(app)/reports/retenciones/page.tsx`, `app/(app)/reports/cxc-pendientes/page.tsx`, `__tests__/integration/ar-reports.integration.test.ts`
- Modify: `lib/nav.ts`, `lib/__tests__/nav.test.ts`, `package.json` (scripts), `AGENTS.md`

**Interfaces:**
- Consumes: both configs in `REPORTS`; `ReportPage` with `defaultDates` (still required by its props; pass `getPreviousMonthRange()` since snapshot reports ignore it).

- [ ] **Step 1: Failing nav test:** update the plain-user expectation to `['/reports/ventas', '/reports/compras', '/reports/retenciones', '/reports/cxc-pendientes', '/firmas', '/qr']` -> FAIL.
- [ ] **Step 2: Implement** the two pages (copy `app/(app)/reports/ventas/page.tsx`) and the two `NAV_SECTIONS` links under "Reportes" in `lib/nav.ts` with labels `Comprobantes de Retenciones` and `Facturas pendientes por cobrar` and one-line Spanish descriptions. Run `bun test --env-file=.env.local lib/__tests__/nav.test.ts` -> PASS.
- [ ] **Step 3: Integration test** (read-only, mirrors `statements-repo.integration.test.ts` style): against the live ERP, `fetchCxcPendientes` rows with lines satisfy `|base + exento + iva - total_neto| <= 0.01` for a sample of 50 open invoices (select `total_neto` in the integration query), and `fetchRetenciones` returns only `contrib = 1` customers and no `saldo = 0`. Add `test:ar-reports-erp` script and add `--path-ignore-patterns='**/ar-reports.integration.test.ts'` to `test` and `test:unit` in `package.json`.
- [ ] **Step 4: Run** `bun run test:ar-reports-erp` (needs ERP reachable) -> PASS; if reconciliation fails, fix `lineBaseExpr` in Task 4's query, not the test tolerance.
- [ ] **Step 5: AGENTS.md:** add a short "AR reports" paragraph (population rule, seller fallback, customer type = `co_seg`, snapshot flag, no sign flip, 75 % limitation) and the new files in the directory map.
- [ ] **Step 6: Full verification:** `bun run test:unit`, `bun run lint`, `bunx tsc --noEmit`; then run the app (`bun dev`), open both pages, preview, export xlsx and csv, and check one retention row and one invoice by hand against Profit Plus.
- [ ] **Step 7: Commit** `feat(reports): add AR report pages, nav links and docs`

---

## Self-review

- **Spec coverage:** both reports, columns, population, seller fallback, customer type, 75 % rule, snapshot/optional date filter, no-zero invariant, line-table research, tests, AGENTS docs: Tasks 1-5. Customer-type "co_seg vs tip_cli" is confirmed in Task 1 item 5 before use.
- **Open risk:** Task 1 needs the ERP reachable; Tasks 2 and 3 can proceed without it only if `EXEMPT_TIPO_IMP` is stubbed (don't: do Task 1 first).
