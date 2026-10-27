# Customer AR Statement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Download a Spanish PDF "estado de cuenta" of open receivables (BSD + USD) for one customer from the UI, and a CLI that writes one PDF per customer with a positive net balance into a folder.

**Architecture:** A pure `buildStatement()` turns open `saDocumentoVenta` rows plus `saTasa` USD rates into a typed `Statement` (rows, aging, totals). A thin SQL repo feeds it live ERP data (read-only). A `pdfkit` renderer turns a `Statement` into a PDF buffer. The API route, the page and the CLI are all thin callers of repo → builder → renderer.

**Tech Stack:** Next.js 16 App Router, Bun, `mssql`, `pdfkit` (new dependency, built-in Helvetica which covers Spanish accents and ñ), `bun:test`.

**Spec:** `docs/superpowers/specs/2026-10-26-customer-ar-statement-design.md`

## Global Constraints

- ERP is read-only; every parameter via `.input()`; `char` padding trimmed (`lib/trim-strings.ts`).
- USD per row = `saldo` ÷ `saTasa` (`co_mone='USD'`, column `tasa_v`, latest `fecha` on or before the issue day, date-only compare). Never use `saDocumentoVenta.tasa` or `co_mone`.
- Missing rate → USD cell is `null` ("Sin tasa"), excluded from USD totals, statement `incomplete = true`. Never `0`.
- `saldo` is always positive; sign comes from type. Debt: `FACT`, `N/DB`. Reducing: `N/CR`, `NCR`, `ADEL`, and any unknown type (flagged `unknownType`, logged).
- Aging buckets (debt only): `Por vencer` (`fec_venc >= asOf`), `1–30`, `31–60`, `61–90`, `+90` days past `fec_venc`, calendar days, date-only. Reducing rows are a separate "Créditos y anticipos" line, subtracted in the grand total; their days overdue is `null`.
- Totals (BSD and USD) are sums of row values, not total ÷ one rate.
- PDF in Spanish; header shows `par_emp.emp_nom` and the logo from `public/statement-logo.png` if the file exists.
- Gate is a new `'statements'` module, enforced independently by page and API (no middleware). Errors are `{ error: string }`.
- CLI exports customers whose net BSD balance (debt − reducing) is `> 0`, one PDF each, exits non-zero if any customer fails but continues the batch.

## Review Focus

- Customer with only credits/advances (net ≤ 0): CLI skips them; UI still renders a statement with a zero/negative total.
- BSD debt row issued before the first `saTasa` row: USD shows "Sin tasa", statement marked incompleto, USD total excludes it.
- Two `saTasa` rows on the same day or a rate dated mid-day: the latest on or before the issue day is used, no crash.
- Document due today vs. yesterday vs. in the future: bucket boundaries (`Por vencer`, 1, 30, 31, 90, 91 days).
- Customer names with accents, `ñ`, `/` or `:` produce a valid, stable filename and render correctly in the PDF.
- A statement with enough rows to span several pages keeps the repeated header and shows totals on the last page.
- Unknown document type appears as a reducing row labelled with its raw code (never as debt).
- `fec_venc` NULL: treated as `Por vencer`, days overdue `null`.

---

### Task 1: `'statements'` module gate

**Files:**
- Modify: `lib/db/schema.ts:20` (add `'statements'` to the `module` enum)
- Modify: `app/api/admin/users/[id]/modules/route.ts:10` (`VALID_MODULES`)
- Create: `lib/statements/access.ts`
- Modify: `app/(app)/admin/users/users-client.tsx` (checkbox column + `handleToggleModule` union, mirror `recipes`)
- Modify: `lib/nav.ts`, `components/sidebar.tsx`, `app/(app)/layout.tsx` (nav entry "Estados de cuenta" → `/estados-de-cuenta`, visible with the new flag)
- Test: `lib/statements/access.test.ts`

**Interfaces:**
- Produces: `hasStatementsAccess(db, userId: string, role: 'user'|'admin'): Promise<boolean>`; `requireStatementsAccess(request: NextRequest): Promise<{ ok: true; session: SessionPayload } | { ok: false; response: NextResponse }>`; `NavAccess.statements: boolean`.

- [ ] **Step 1: Write failing test** `access.test.ts`: admin → true; user without grant → false; user with a `user_modules` row `'statements'` → true (use the in-memory/temp SQLite pattern from `lib/recipes` access tests if present, else mirror `lib/geo` tests).
- [ ] **Step 2: Run** `bun test --isolate --env-file=.env.local lib/statements/access.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `access.ts` as a copy of `lib/geo/access.ts` with module `'statements'`; add the enum value, `VALID_MODULES` entry, admin checkbox, nav entry and layout/sidebar plumbing.
- [ ] **Step 4: Run** the test → PASS; run `bun run test:unit` for nav/admin regressions.
- [ ] **Step 5: Commit** `feat(statements): statements module gate`.

---

### Task 2: Pure statement builder

**Files:**
- Create: `lib/statements/types.ts`, `lib/statements/build-statement.ts`
- Test: `lib/statements/build-statement.test.ts`

**Interfaces:**
- Produces (in `types.ts`):
  - `StatementDoc { coTipoDoc: string; nroDoc: string; fecEmis: Date; fecVenc: Date | null; saldoBsd: number }`
  - `UsdRate { fecha: Date; tasaV: number }`
  - `StatementRow { kind: 'debt' | 'reducing'; coTipoDoc: string; nroDoc: string; fecEmis: Date; fecVenc: Date | null; daysOverdue: number | null; amountBsd: number; rate: number | null; amountUsd: number | null; unknownType: boolean }` (`amountBsd`/`amountUsd` negative for reducing rows)
  - `Money { bsd: number; usd: number }`
  - `Statement { asOf: Date; rows: StatementRow[]; aging: { porVencer: Money; d1_30: Money; d31_60: Money; d61_90: Money; d90plus: Money }; credits: Money; total: Money; incomplete: boolean }`
- Produces: `resolveUsdRate(rates: UsdRate[], issueDate: Date): number | null` and `buildStatement(docs: StatementDoc[], rates: UsdRate[], asOf: Date): Statement`. Rows sorted debt first by `fecVenc` ascending, then reducing.

- [ ] **Step 1: Write failing tests** with exact values: BSD `FACT` 1000 on a day with rate 50 → `amountUsd 20`, `rate 50`; `N/CR` 500 same rate → `amountBsd -500`, `amountUsd -10`, `total.bsd 500`, `total.usd 10`, `credits.bsd -500`; `ADEL` is reducing; unknown type `XYZ` → reducing + `unknownType true`; no rate → `amountUsd null`, `incomplete true`, USD sums exclude it; `resolveUsdRate` picks the latest `fecha` ≤ issue day date-only (rate dated 14:00 same day counts) and returns `null` before the first rate; bucket boundary tests for `fecVenc = asOf`, `asOf−1`, `asOf−30`, `asOf−31`, `asOf−90`, `asOf−91`, future date, and `fecVenc null` (→ `porVencer`, `daysOverdue null`); a customer with only credits gives `total.bsd < 0`.
- [ ] **Step 2: Run** `bun test lib/statements/build-statement.test.ts` → FAIL.
- [ ] **Step 3: Implement** both functions in `build-statement.ts`; `resolveUsdRate` binary-searches or scans a pre-sorted copy; date-only comparison via local `YYYY-MM-DD` keys (reuse `lib/dates.ts` helpers, no date library).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(statements): pure statement builder with aging and USD rates`.

---

### Task 3: ERP repository

**Files:**
- Create: `lib/statements/repo.ts`
- Test: `lib/statements/repo.test.ts` (unit for the row-mapping helper) and `__tests__/integration/statements-repo.integration.test.ts` (read-only, hits the ERP; add to `test:mssql`-style exclusion like `compras-export.integration.test.ts` and mention it in `package.json` `test`/`test:unit` ignore patterns)

**Interfaces:**
- Consumes: `StatementDoc`, `UsdRate` (Task 2).
- Produces:
  - `fetchOpenDocs(pool, coCli: string): Promise<StatementDoc[]>` — `saDocumentoVenta` where `co_cli=@coCli`, `ISNULL(anulado,0)=0`, `saldo<>0`.
  - `fetchUsdRates(pool): Promise<UsdRate[]>` — all `saTasa` rows `co_mone='USD'` ordered by `fecha` (one query, reused for all customers).
  - `fetchCustomerHeader(pool, coCli): Promise<{ coCli: string; name: string; rif: string | null; address: string | null } | null>` — `saCliente.cli_des`, `rif`, `direc1`.
  - `fetchCompanyName(pool): Promise<string>` — `par_emp.emp_nom`.
  - `listCustomersWithOpenDocs(pool): Promise<string[]>` — distinct `co_cli` with open rows (candidates; the CLI applies the net > 0 rule after `buildStatement`).
  - `listCustomersForPicker(pool): Promise<{ co_cli: string; cli_des: string }[]>` — all customers ordered by name.

- [ ] **Step 1: Write failing unit test** for the mapper that trims `char` padding and converts `saldo` to number.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the functions with `.input()` for `coCli`; pass results through `trimStrings`.
- [ ] **Step 4: Run** unit test → PASS; run the integration test locally and confirm a known customer with open `FACT` rows returns docs and USD rates are non-empty.
- [ ] **Step 5: Commit** `feat(statements): ERP repository`.

---

### Task 4: PDF renderer

**Files:**
- Modify: `package.json` (add `pdfkit` and `@types/pdfkit`)
- Create: `lib/statements/render-pdf.ts`
- Test: `lib/statements/render-pdf.test.ts`

**Interfaces:**
- Consumes: `Statement` (Task 2).
- Produces: `renderStatementPdf(input: { company: string; logoPath: string | null; customer: { coCli: string; name: string; rif: string | null; address: string | null }; statement: Statement }): Promise<Buffer>` and `statementFileName(coCli: string, name: string): string` (`<co_cli>-<name>.pdf`, ASCII-safe, no `/ \ : * ? " < > |`, whitespace collapsed to `-`, max 80 chars).

- [ ] **Step 1: Write failing tests:** buffer starts with `%PDF`; a statement with 120 rows renders without throwing and the page count (parse `/Type /Page` occurrences) is `> 1`; empty statement renders; `statementFileName('C001', 'Ñandú / Distribuidora: "El Sol"')` is stable, contains no forbidden chars, ends `.pdf`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** with `pdfkit`, Helvetica, Spanish labels (Estado de cuenta, Fecha de emisión, Vencimiento, Días de mora, Monto Bs, Tasa, Monto USD, Resumen de antigüedad, Créditos y anticipos, Total, "Sin tasa", "Estado de cuenta incompleto: faltan tasas de cambio"). Header on each page repeats the table header row; totals on the last page; page footer "Página X de Y" using `bufferPages`. Dates `DD/MM/YYYY`, amounts es-VE formatting.
- [ ] **Step 4: Run** → PASS; generate one sample PDF into the scratchpad and open it to eyeball accents and layout.
- [ ] **Step 5: Commit** `feat(statements): PDF renderer`.

---

### Task 5: API route and page

**Files:**
- Create: `app/api/statements/[co_cli]/route.ts`, `app/api/statements/customers/route.ts`
- Create: `app/(app)/estados-de-cuenta/page.tsx`, `app/(app)/estados-de-cuenta/estados-de-cuenta-client.tsx`
- Create: `lib/statements/generate.ts` (shared `generateStatementPdf(pool, rates, coCli): Promise<{ pdf: Buffer; fileName: string; statement: Statement; customerName: string } | null>`, `null` = unknown customer)
- Test: `lib/statements/generate.test.ts` (with a fake repo via injected functions), component test under `app/(app)/estados-de-cuenta/__tests__/`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `GET /api/statements/customers` → `{ customers: {co_cli, cli_des}[] }`; `GET /api/statements/[co_cli]` → `application/pdf` with `Content-Disposition: attachment; filename="<fileName>"`, `401/403/404` as `{ error }`.

- [ ] **Step 1: Write failing tests:** `generateStatementPdf` returns `null` for an unknown customer and a `%PDF` buffer for a known one; component test: picker lists customers via `SearchableSelect`, "Descargar PDF" is disabled until a customer is chosen, clicking it navigates/fetches `/api/statements/<co_cli>` (follow the `app/(app)/analitica/components/__tests__/` conventions: `test/dom-setup` first, mock `posthog-js`, set `globalThis.fetch`).
- [ ] **Step 2: Run** `bun test --isolate --env-file=.env.local lib/statements/generate.test.ts` and `bun run test:components` → FAIL.
- [ ] **Step 3: Implement** routes (each calls `requireStatementsAccess`, uses `getPool()`, `captureEvent` before success return, `captureException` in catch per AGENTS.md); page redirects to `/reports/ventas` without access, renders the client plus `HelpPanel` only if a help page is added (skip otherwise).
- [ ] **Step 4: Run** the tests → PASS; start `bun dev`, log in as a granted user, download a PDF for a customer with debt and one without access gets 403 (`curl` without cookie → 401).
- [ ] **Step 5: Commit** `feat(statements): API route and page`.

---

### Task 6: Batch CLI

**Files:**
- Create: `scripts/export-statements.ts`, `lib/statements/batch.ts`
- Modify: `package.json` (`"statements:export": "bun --bun run scripts/export-statements.ts"`)
- Test: `lib/statements/batch.test.ts`

**Interfaces:**
- Produces: `exportStatements(deps: { listCandidates(): Promise<string[]>; generate(coCli: string): Promise<{ pdf: Buffer; fileName: string; statement: Statement } | null>; write(fileName: string, pdf: Buffer): Promise<void>; log(msg: string): void }): Promise<{ written: number; skipped: number; failed: number }>` — skips net BSD total `<= 0`, continues after a failure, counts it.
- CLI args: `--out <folder>` (required; created if missing). Prints a summary line like `send-invoice-reminders.ts`; exit code 1 if `failed > 0`; closes the pool.

- [ ] **Step 1: Write failing tests:** net > 0 is written; net ≤ 0 skipped; a throwing customer is counted `failed` and the next still written; incomplete statements are logged with the customer code.
- [ ] **Step 2: Run** `bun test lib/statements/batch.test.ts` → FAIL.
- [ ] **Step 3: Implement** `batch.ts` and the script wiring (fetch rates once, reuse for every customer).
- [ ] **Step 4: Run** tests → PASS; run `bun run statements:export --out <scratchpad>/statements` against the dev ERP, check one PDF per customer with debt, files overwrite on re-run, exit code 0.
- [ ] **Step 5: Commit** `feat(statements): batch export CLI`.

---

### Task 7: Docs

**Files:**
- Modify: `AGENTS.md` (directory map entries for `lib/statements/`, `app/api/statements/`, `app/(app)/estados-de-cuenta/`, `scripts/export-statements.ts`; a short "Estados de cuenta" section stating the currency rule and sign mapping; add `'statements'` to the module list)
- Modify: `INSTRUCTIONS.md` (CLI usage and logo path)

- [ ] **Step 1:** Write the AGENTS.md section and the INSTRUCTIONS.md entry, with the "USD via `saTasa` on the issue date, never the row's `tasa`" rule in bold.
- [ ] **Step 2:** `bun run lint && bun run test:unit` pass.
- [ ] **Step 3: Commit** `docs(statements): agent notes and usage`.

---

### Task 8: End-to-end tests

**Files:**
- Create: `e2e/estados-de-cuenta.spec.ts`
- Modify: `e2e/admin-users.spec.ts` (assert the new "Estados de cuenta" module checkbox toggles) and `scripts/e2e-seed.ts` only if a non-admin user with the grant is needed

**Interfaces:**
- Consumes: Tasks 1, 5, 6. Follows `e2e/recetas.spec.ts` conventions (`./fixtures`, `adminPage`/`userPage`, `@mssql` tag in the `describe` title for tests that read the ERP mock).

- [ ] **Step 1: Write the specs:** (a) a user without the grant is redirected from `/estados-de-cuenta` to `/reports/ventas` and `GET /api/statements/customers` returns 403; (b) admin opens the page, picks a customer in the `SearchableSelect`, clicks "Descargar PDF" and receives a download whose bytes start with `%PDF` and whose filename matches `^\S+-.+\.pdf$` (`@mssql`, use a customer code with open `FACT` rows in the restored `Ncake_a`); (c) unknown `co_cli` on `/api/statements/ZZZZ` returns 404 `{ error }` (`@mssql`); (d) the admin users page toggles the module checkbox.
- [ ] **Step 2: Run** `bun run e2e -- e2e/estados-de-cuenta.spec.ts e2e/admin-users.spec.ts` and `bun run e2e:mssql -- e2e/estados-de-cuenta.spec.ts` if the docker ERP mock is available; fix until green.
- [ ] **Step 3: Run the whole `bun run e2e`** to confirm no regression (nav changes, admin users).
- [ ] **Step 4: Commit** `test(statements): e2e coverage`.
