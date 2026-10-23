# Customer Credit Terms Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set each customer's real credit term in the ERP and recompute the due date of every unpaid FACT invoice, so CxC aging is correct.

**Architecture:** A committed CSV (`data/credit-terms/2026-10.csv`) is the source of truth. Pure code (`lib/credit-terms/`) parses it and plans changes; an ERP gateway calls new `pApi*` procs (migration `0019`) that write only through audit tables keyed by `run_id`; `scripts/credit-terms-apply.ts` is dry-run by default, `--apply` / `--rollback` need `--confirm-db`. Mirrors `lib/customer-mapping/` and `scripts/mapping-apply.ts`.

**Tech Stack:** Bun, TypeScript, `mssql`, SQL Server procs (`CREATE OR ALTER`, re-runnable), `bun:test`.

**Spec:** `docs/superpowers/specs/2026-10-22-customer-credit-terms-design.md`

## Global Constraints

- ERP writes only through `pApi*` procs; never raw INSERT/UPDATE from app code.
- Only invoices with `co_tipo_doc = 'FACT'`, `ISNULL(anulado,0) = 0`, `saldo <> 0` are touched. Never paid, voided, `N/CR`, `ADEL`.
- Due date: `fec_venc = DATEADD(day, dias_cred, fec_emis)`; written to `saDocumentoVenta.fec_venc` and `saFacturaVenta.fec_venc` (join `saFacturaVenta.doc_num = saDocumentoVenta.nro_doc`), and `saFacturaVenta.co_cond` = the customer's new term.
- Allowed days and their `co_cond`: 7 -> `000002`, 15 -> `000003`, 21 -> `000004`, 35 -> `000015` (new, created by migration `0019`: `Credito 35 dias`, `dias_cred = 35`).
- ERP user code constant: `ERP_USER_CODE` from `lib/geo/erp-location.ts` (`'PROFIT'`).
- `co_cli` is `char(16)`: always `RTRIM` when reading from the ERP and compare trimmed.
- Dry-run by default; `--apply` and `--rollback` require `--confirm-db` equal to `process.env.DB_NAME` (`assertConfirmedDb` from `lib/customer-mapping/diff-csv.ts`).
- CSV columns exactly `co_cli,nombre,dias_cred,source,note`; `source` in `exact|fuzzy|inherited|override|skip|review`.
- User-facing script output in Spanish like `mapping-apply.ts`; code identifiers in English.
- Migrations re-runnable (`IF NOT EXISTS` / `CREATE OR ALTER`). Do not commit unless the user asks; steps marked Commit are for when they do.

## Review Focus

- A customer in the CSV that is missing from the ERP or inactive: the run must refuse before any write.
- Any `review` row, duplicate `co_cli`, or a `dias_cred` outside {7,15,21,35}: CSV invalid, nothing runs.
- Re-running `--apply` after a successful run changes nothing (0 customers, 0 invoices).
- A run that fails midway (one customer errors): earlier customers stay applied and logged under the same `run_id`; the failure is reported with a non-zero exit code; re-running resumes safely.
- Rollback after someone edited an invoice or customer since the run: that row is skipped and reported, not overwritten.
- Open invoices whose `fec_venc` is already correct, or whose customer is already on the right term: not rewritten, not logged.
- A skip-source row (e.g. the 4 Contado/7 customers left out) is never written, even if the customer is Contado.

---

### Task 1: Credit-terms CSV reader and plan (pure)

**Files:**
- Create: `lib/credit-terms/types.ts`, `lib/credit-terms/csv.ts`, `lib/credit-terms/plan.ts`
- Test: `__tests__/unit/credit-terms/csv.test.ts`, `__tests__/unit/credit-terms/plan.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `CREDIT_DAYS = [7, 15, 21, 35] as const`; `type CreditDays = typeof CREDIT_DAYS[number]`
  - `CO_COND_BY_DAYS: Record<CreditDays, string>` = the map in Global Constraints
  - `type CreditSource = 'exact'|'fuzzy'|'inherited'|'override'|'skip'|'review'`
  - `interface CreditTermRow { coCli: string; nombre: string; diasCred: CreditDays | null; source: CreditSource; note: string }`
  - `CREDIT_TERM_COLUMNS = ['co_cli','nombre','dias_cred','source','note'] as const`
  - `interface ErpCreditCustomer { coCli: string; condPag: string; plazPag: number; inactivo: boolean }`
- Produces (`csv.ts`): `parseCreditTermsCsv(text: string): { rows: CreditTermRow[]; errors: string[] }` (reuse `parseCsv` from `lib/customer-mapping/csv.ts`; BOM/CRLF tolerant).
- Produces (`plan.ts`): `buildCreditPlan(rows: CreditTermRow[], erp: Map<string, ErpCreditCustomer>): CreditPlan` where
  `CreditPlan = { customers: PlannedCustomer[]; skipped: CreditTermRow[]; problems: string[] }` and
  `PlannedCustomer = { coCli: string; nombre: string; diasCred: CreditDays; coCond: string; current: { condPag: string; plazPag: number }; needsCustomerWrite: boolean }`.

- [ ] **Step 1: Write failing CSV tests** (`csv.test.ts`): valid file with BOM + CRLF parses to rows; errors for wrong header, duplicate `co_cli`, unknown `source`, `dias_cred` 10, empty `dias_cred` on a non-`skip`/`review` row, non-empty `dias_cred` on a `skip` row. Each error message names the line (`línea N: ...`, same style as `csvToMapping`).
- [ ] **Step 2: Run** `bun test --isolate __tests__/unit/credit-terms/csv.test.ts`; expect FAIL (module missing).
- [ ] **Step 3: Implement `types.ts` and `parseCreditTermsCsv`** as specified.
- [ ] **Step 4: Run again; expect PASS.**
- [ ] **Step 5: Write failing plan tests** (`plan.test.ts`): (a) customer on `000001`/`7` with CSV 7 -> `needsCustomerWrite: true`, `coCond '000002'`; (b) customer already `000002`/7 with CSV 7 -> `needsCustomerWrite: false` but still listed (invoices are recomputed); (c) `000001`/7 with CSV 21 -> `coCond '000004'`; (d) `skip` row goes to `skipped`, never to `customers`, even if Contado; (e) `review` row -> problem `"<co_cli>: fila en revisión"`; (f) `co_cli` absent from ERP -> problem; (g) `inactivo: true` -> problem; (h) ERP codes arrive trimmed, CSV codes with stray spaces are trimmed before lookup.
- [ ] **Step 6: Run; expect FAIL.**
- [ ] **Step 7: Implement `buildCreditPlan`** (pure, no I/O; problems do not throw, the caller decides).
- [ ] **Step 8: Run both test files; expect PASS.**
- [ ] **Step 9: Commit** `feat(credit-terms): CSV reader and plan builder`.

---

### Task 2: Migration `0019` (procs + audit) and ERP gateway

**Files:**
- Create: `migrations/mssql/0019_pApi_credit_terms.sql`, `lib/credit-terms/erp.ts`
- Test: `scripts/dwh/__tests__/credit-terms-erp.test.ts` (non-production only, header comment like `customer-mapping-erp.test.ts`)
- Modify: `package.json` (add `"test:credit-terms-erp"`; add the new test to the `--path-ignore-patterns` list of `test` and `test:unit`, as done for `customer-mapping-erp.test.ts`)

**Interfaces:**
- Consumes: `ErpCreditCustomer`, `CreditDays`, `CO_COND_BY_DAYS` (Task 1); `ERP_USER_CODE`.
- Produces (`erp.ts`):
  - `interface InvoiceChange { nroDoc: string; coCli: string; fecEmis: string; fecVencOld: string; fecVencNew: string; saldo: number }`
  - `interface CreditGateway { listCustomers(): Promise<Map<string, ErpCreditCustomer>>; previewInvoiceChanges(coCli: string, diasCred: CreditDays): Promise<InvoiceChange[]>; setCustomerTerm(runId: string, coCli: string, coCond: string, plazPag: number): Promise<void>; fixInvoices(runId: string, coCli: string): Promise<InvoiceChange[]>; restoreCustomers(runId: string): Promise<RestoreResult>; restoreInvoices(runId: string): Promise<RestoreResult> }`
  - `interface RestoreResult { restored: number; skipped: { key: string; reason: string }[] }`
  - `mssqlCreditGateway(pool: sql.ConnectionPool): CreditGateway`
- Procs in the migration (all `CREATE OR ALTER`, `SET NOCOUNT ON`, `BEGIN TRY/CATCH` with `RAISERROR` rethrow, same style as `0018`):
  - Seed `saCondicionPago` `000015` / `Credito 35 dias` / `dias_cred 35` guarded by `NOT EXISTS`; copy the remaining NOT NULL columns from row `000004` (inspect with `INFORMATION_SCHEMA.COLUMNS` and `SELECT * FROM saCondicionPago WHERE co_cond='000004'`).
  - Tables `dbo.__exporter_credit_term_customer_fixes (id, run_id varchar(36), co_cli, cond_pag_old, plaz_pag_old, cond_pag_new, plaz_pag_new, co_us_mo, fixed_at_utc)` and `dbo.__exporter_credit_term_invoice_fixes (id, run_id, co_cli, nro_doc, fec_venc_old, fec_venc_new, co_cond_old, co_cond_new, co_us_in, fixed_at_utc)`.
  - `pApiActualizarCondicionPagoCliente(@sRunId VARCHAR(36), @sCoCli CHAR(16), @sCoCond CHAR(6), @iPlazPag INT, @sCoUsMo CHAR(6))`: errors on unknown customer, unknown `co_cond`, or `dias_cred <> @iPlazPag`; no-op (no log row) if both fields already equal; else UPDATE `saCliente.cond_pag, plaz_pag, co_us_mo, fe_us_mo` and log.
  - `pApiCorregirVencimientosFacturasCliente(@sRunId VARCHAR(36), @sCoCli CHAR(16), @sCoUsIn CHAR(6))`: uses the customer's current `cond_pag` -> `dias_cred`; refuses if `dias_cred = 0` (Contado) with a Spanish message; selects only invoices matching Global Constraints whose `fec_venc <> DATEADD(day, dias, fec_emis)`; logs then updates both tables and `saFacturaVenta.co_cond`, in one transaction; `OUTPUT`s the changed rows.
  - `pApiRestaurarCondicionPagoCliente(@sRunId VARCHAR(36), @sCoUsMo CHAR(6))` and `pApiRestaurarVencimientosFacturas(@sRunId VARCHAR(36), @sCoUsMo CHAR(6))`: restore old values only where the current value equals the logged new value; return skipped rows.

- [ ] **Step 1: Write the ERP test** (`credit-terms-erp.test.ts`, mock/non-prod only): pick a Contado customer with an open FACT invoice; run `setCustomerTerm` (7) then `fixInvoices`; assert customer `cond_pag='000002'`, `plaz_pag=7`, each changed invoice has `fec_venc = fec_emis + 7 days` in both tables, `saFacturaVenta.co_cond='000002'`; a second `fixInvoices` returns `[]`; `restoreInvoices` then `restoreCustomers` return the original values; a paid invoice (`saldo = 0`) of the same customer is untouched throughout; `fixInvoices` on a Contado customer rejects. Clean up in `afterAll`.
- [ ] **Step 2: Write the migration** per the Interfaces block.
- [ ] **Step 3: Apply it to the mock** with `bun run scripts/migrate-mssql.ts` (mock DB is `Ncake_a` on localhost; never run against production here). Expected: `0019` applied, `000015` present.
- [ ] **Step 4: Implement `mssqlCreditGateway`**; `previewInvoiceChanges` runs the same selection as the proc as a read-only SELECT (so dry-run and apply cannot drift); dates returned as `YYYY-MM-DD` via `CONVERT(char(10), ..., 23)`.
- [ ] **Step 5: Run** `bun run test:credit-terms-erp`; expect PASS.
- [ ] **Step 6: Commit** `feat(credit-terms): migration 0019 procs and ERP gateway`.

---

### Task 3: Apply / rollback orchestration

**Files:**
- Create: `lib/credit-terms/apply.ts`
- Test: `__tests__/unit/credit-terms/apply.test.ts` (uses an in-memory fake `CreditGateway`)

**Interfaces:**
- Consumes: `CreditPlan`, `PlannedCustomer` (Task 1); `CreditGateway`, `InvoiceChange` (Task 2).
- Produces:
  - `interface DryRunReport { customers: PlannedCustomer[]; invoiceChanges: InvoiceChange[] }`
  - `previewPlan(gateway: CreditGateway, plan: CreditPlan): Promise<DryRunReport>`
  - `interface ApplyResult { runId: string; customersWritten: number; invoicesFixed: number; failures: string[] }`
  - `applyPlan(deps: { gateway: CreditGateway; log: (m: string) => void; newRunId: () => string }, plan: CreditPlan): Promise<ApplyResult>` — throws if `plan.problems.length > 0` before any gateway write; per customer: `setCustomerTerm` only when `needsCustomerWrite`, then `fixInvoices`; an error in one customer is recorded in `failures` and the loop continues.
  - `rollbackRun(gateway: CreditGateway, runId: string): Promise<{ customers: RestoreResult; invoices: RestoreResult }>` — invoices first, then customers.

- [ ] **Step 1: Write failing tests**: problems present -> `applyPlan` rejects and the fake saw zero writes; `needsCustomerWrite: false` customer -> `setCustomerTerm` not called but `fixInvoices` is; one customer's `fixInvoices` throws -> others applied, `failures` has one entry; second `applyPlan` on the fake's updated state -> `customersWritten 0`, `invoicesFixed 0`; `previewPlan` performs no writes; `rollbackRun` calls invoices restore before customers restore.
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement** the four functions.
- [ ] **Step 4: Run; expect PASS.**
- [ ] **Step 5: Commit** `feat(credit-terms): apply and rollback orchestration`.

---

### Task 4: CLI script

**Files:**
- Create: `scripts/credit-terms-apply.ts`
- Modify: `package.json` (`"credit-terms:apply": "bun --bun run scripts/credit-terms-apply.ts"`), `.gitignore` (ignore `tmp/credit-terms-*.csv`)

**Interfaces:** Consumes everything above. Flags via `node:util` `parseArgs`: `--file` (default `data/credit-terms/2026-10.csv`), `--apply`, `--rollback <runId>`, `--confirm-db <name>`, `--out <path>` (default `tmp/credit-terms-dry-run.csv`), `--help`.

- [ ] **Step 1: Implement the script** following `scripts/mapping-apply.ts` structure: usage text in Spanish; `assertConfirmedDb` for `--apply`/`--rollback`; parse CSV (exit 1 listing `errors`); load `gateway.listCustomers()`; `buildCreditPlan`; dry-run prints a per-term summary (customers by `dias_cred`, how many need a customer write, how many invoices change, total `saldo` affected, problems, skipped) and writes the invoice diff with `buildCsv` from `lib/csv.ts` (columns `co_cli,nro_doc,fec_emis,fec_venc_old,fec_venc_new,saldo`); `--apply` generates `runId = crypto.randomUUID()`, prints it prominently, prints failures and exits non-zero on any; ends with the reminder to run `bun run scripts/dwh-snapshot-load.ts`; `--rollback` prints restored and skipped counts.
- [ ] **Step 2: Smoke test** `bun run credit-terms:apply -- --help` and a dry run with a one-row temp CSV (`--file` pointing into the scratchpad); expect the usage text and a 1-customer report; confirm `--apply` without `--confirm-db` exits non-zero with the `assertConfirmedDb` message and writes nothing.
- [ ] **Step 3: Commit** `feat(credit-terms): credit-terms:apply script`.

---

### Task 5: Mapping data

**Files:**
- Create: `data/credit-terms/2026-10.csv`
- Test: `__tests__/unit/credit-terms/data.test.ts`

Source: the draft at `/private/tmp/claude-501/-Users-eugenio-repos-new-york-venezuela-profitplus-exporter/fdf2b20c-f760-43ad-bae8-abf3e6467a20/scratchpad/credit-terms-draft.csv` (188 prod customers, already resolved per the spec). Convert to the committed columns: drop `cond_pag_now`/`plaz_now`, keep `co_cli,nombre,dias_cred,source,note`; rows with no term get `source=skip` and empty `dias_cred` (the 7 listed in the spec, incl. the 4 Contado/7 customers left out on purpose). If the draft file is gone, regenerate it from `clientes.csv` and `dias creditos.xlsm` on the Desktop using the resolution rules in the spec.

- [ ] **Step 1: Write the data test**: file parses with 0 errors; no `review` rows; 188 rows; exact expectations: all `J001675523*` = 15 and `override`; `J505366220` and its stores = 7; `J503848049` and its stores = 7; `J-504108979` = 7; `J502434526` = 7; Rio Vida parent `J500585039` = 35; Kalea (`nombre` contains `KALEA`) = 21; `J504525057`, `-1`, `-2` = 7; `J-306811036-1` and `-2` = 21 `fuzzy`; `J-000797218-1`, `J300542033`, `J504101435`, `J505130587` = `skip`.
- [ ] **Step 2: Run; expect FAIL (file missing).**
- [ ] **Step 3: Create the CSV** from the draft with the conversion above (UTF-8, with BOM, via `buildCsv`).
- [ ] **Step 4: Run; expect PASS.**
- [ ] **Step 5: Commit** `feat(credit-terms): 2026-10 credit terms mapping`.

---

### Task 6: Docs and mock verification

**Files:**
- Modify: `AGENTS.md` (directory map: `lib/credit-terms/`, `scripts/credit-terms-apply.ts`, `migrations/mssql/0019`, `data/credit-terms/`; one short section "Credit terms" stating that `cond_pag` drives invoice due dates, the 35-day term, and that `plaz_pag` alone does nothing), `INSTRUCTIONS.md` (usage, rollback, DWH snapshot reload, non-production test command)
- Modify: `docs/superpowers/specs/2026-10-22-customer-credit-terms-design.md` (status -> Implemented)

- [ ] **Step 1: Run the full flow on the mock**: dry-run -> record counts; `--apply --confirm-db Ncake_a`; dry-run again, expect 0 customer writes and 0 invoice changes; `--rollback <runId> --confirm-db Ncake_a`; dry-run again, counts equal the first. Report these numbers to the user.
- [ ] **Step 2: Run** `bun run test:unit` and `bun run typecheck` (or the project's existing type check script); expect green.
- [ ] **Step 3: Update docs** as listed.
- [ ] **Step 4: Prepare the production handover** (do not run it): the exact commands (`bun run scripts/migrate-mssql.ts`, dry-run, `--apply --confirm-db <prod DB_NAME>`, `bun run scripts/dwh-snapshot-load.ts`), and a request that the user review the prod dry-run CSV first, since the mock lacks the 4 newest prod customers and recent invoices.
- [ ] **Step 5: Commit** `docs(credit-terms): usage and agent notes`.
