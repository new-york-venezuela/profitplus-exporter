# Invoice Reminder Emails — Design

**Date**: 2026-08-28
**Status**: Approved for planning

## Problem

Customers with open balances (facturas due soon, due today, or overdue) get
no proactive notice from us. We want a daily automated job that finds
invoices close to or past their due date and emails each affected customer
a digest of what they owe, so they're never surprised by their balance.

This is a new subsystem, not a refactor: it must not touch the existing
report/inventory/DWH request paths, and it should be easy to extend later
(e.g. a second reminder type for suppliers) without reopening this code.

## Data Source (ERP, via `erp-knowledge-base` RAG)

Confirmed against the knowledge base's indexed schema docs
(`docs/tables/saDocumentoVenta.md`, `docs/tables/saCliente.md`,
`docs/tables/saFacturaVenta.md`) and `docs/WORKFLOWS.md`. The RAG's data
was already complete for this feature — no re-extraction from the ERP was
needed. (The MCP server process itself was not running locally during this
session — Qdrant was up on :6333, but `mcp-server/server.py` was not
listening on :8000 — so the docs were read directly from
`erp-knowledge-base/docs/tables/*.md` instead of through the MCP tools.
That's a local dev-environment gap, not a documentation gap.)

**Source of truth for CxC**: `saDocumentoVenta`, *not* `saFacturaVenta` —
per `WORKFLOWS.md`: "`saDocumentoVenta.saldo` es la fuente de verdad de CXC
(nunca recalcular desde cobros)". Relevant columns:

| Column | Meaning |
|---|---|
| `co_tipo_doc` | `'FACT'` for invoices; must exclude `'N/CR'`/`'NCR'` (credit notes are not debts) |
| `nro_doc` | Document number, joins to `saFacturaVenta.doc_num` when `co_tipo_doc='FACT'` |
| `co_cli` | FK → `saCliente.co_cli` |
| `fec_venc` | Due date |
| `saldo` | Outstanding balance in Bs; `0` = paid off |
| `tasa` | Exchange rate at document time; `saldo / NULLIF(tasa,0)` = USD equivalent |
| `anulado` | Must be `0` |
| `n_control` | Fiscal control number, useful as a human-readable reference in the email |

`saCliente` gives `email` and `cli_des` (customer name) by `co_cli`.

The knowledge base's own "documentos vencidos" recipe (in
`saDocumentoVenta.md`) is the starting point for the repository query:

```sql
SELECT co_cli, co_tipo_doc, nro_doc, fec_venc,
       saldo, saldo / NULLIF(tasa,0) AS saldo_usd,
       DATEDIFF(day, fec_venc, GETDATE()) AS dias_vencido
FROM saDocumentoVenta
WHERE anulado = 0 AND saldo > 0
  AND fec_venc < GETDATE()
  AND co_tipo_doc NOT IN ('N/CR','NCR')
ORDER BY co_cli, dias_vencido DESC;
```

This project's query extends the `fec_venc` filter to include the
due-soon window (`fec_venc <= DATEADD(day, @thresholdDays, GETDATE())`)
rather than only strictly-overdue rows, and joins `saCliente` for
`email`/`cli_des`. Standard project convention applies: ERP `mssql` inputs
go through `.input()`, never string concatenation (see `AGENTS.md` code
conventions).

## Trigger Mechanism

A standalone script, **not** a route or an in-process cron library:

```
scripts/send-invoice-reminders.ts
```

Run daily by **Windows Task Scheduler** on the production server (same
machine that already runs the app as a Windows Service via NSSM, per
`INSTRUCTIONS.md`). The script is invoked directly with `bun run`, uses
the same `getPool()` / `getDb()` singletons as the app, and exits with a
non-zero code only on a hard failure (e.g. couldn't reach the ERP DB,
couldn't read settings) so Task Scheduler's own failure/alerting applies.
Per-customer send failures do **not** fail the whole run (see Error
Handling).

This keeps the job fully decoupled from the Next.js request lifecycle —
no risk of a slow report request blocking on a stalled email job, and no
risk of the job depending on the web server being "up" in the HTTP sense
(only the DB and SMTP need to be reachable).

## Components

```
lib/invoice-reminders/
  repository.ts          — getInvoiceReminderData(pool, thresholdDays)
  reminder-service.ts     — InvoiceReminderService (orchestrator)
  types.ts                 — CustomerInvoiceGroup, ReminderInvoice, RunSummary

lib/email/templates/
  invoice-reminder.hbs     — new Handlebars template

lib/db/schema.ts           — + invoiceReminderSettings, invoiceReminderLog

scripts/
  send-invoice-reminders.ts — entrypoint, wired for Task Scheduler

app/(app)/admin/config-cobranza/
  page.tsx, config-client.tsx — admin settings screen (mirrors config-inventario)

app/api/admin/config-cobranza/
  route.ts                  — GET/PUT threshold settings, admin-gated
```

### `lib/invoice-reminders/repository.ts`

```typescript
export interface ReminderInvoice {
  nroDoc: string;
  nControl: string | null;
  fecVenc: Date;
  saldoBs: number;
  saldoUsd: number;
  diasVencido: number;        // negative = not yet due, 0 = due today, positive = overdue
}

export interface CustomerInvoiceGroup {
  coCli: string;
  cliDes: string;
  email: string;
  dueSoon: ReminderInvoice[];   // diasVencido < 0, i.e. due within (0, thresholdDays] days from now
  dueToday: ReminderInvoice[];  // diasVencido === 0
  overdue: ReminderInvoice[];   // diasVencido > 0
}

export async function getInvoiceReminderData(
  pool: sql.ConnectionPool,
  thresholdDays: number,
): Promise<CustomerInvoiceGroup[]>;
```

Single query against `saDocumentoVenta` joined to `saCliente`, filtered to
`anulado=0`, `saldo>0`, `co_tipo_doc NOT IN ('N/CR','NCR')`,
`fec_venc <= DATEADD(day, @thresholdDays, GETDATE())`, and **excluding
customers with a null/empty `email`** (logged as skipped, not failed — see
Error Handling). Grouping into `dueSoon`/`dueToday`/`overdue` buckets
happens in TypeScript after the fetch, keeping the SQL itself simple and
matching the existing pattern of thin queries + mapper functions
(`lib/reports/mappers/`).

Customers with zero rows returned are absent from the result set entirely
— no extra filtering needed elsewhere, satisfying "only email customers
with something to report."

### `lib/db/schema.ts` additions

```typescript
export const invoiceReminderSettings = sqliteTable('invoice_reminder_settings', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  thresholdDays: integer('threshold_days').notNull().default(3),
});

export const invoiceReminderLog = sqliteTable('invoice_reminder_log', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  runDate:       text('run_date').notNull(),          // YYYY-MM-DD, local run date
  coCli:         text('co_cli').notNull(),
  email:         text('email').notNull(),
  invoiceCount:  integer('invoice_count').notNull(),
  status:        text('status', { enum: ['sent', 'failed'] }).notNull(),
  errorMessage:  text('error_message'),
  sentAt:        integer('sent_at').notNull(),         // unix ms
});
```

Same single-row-config shape as `inventorySettings` (`AGENTS.md` already
documents this pattern — no new pattern introduced). `invoiceReminderLog`
is append-only, one row per customer per run; it's both the audit trail
and the answer to "did we already email this customer today" if the job
is ever re-run same-day (out of scope to build a skip-on-rerun guard now,
but the table shape supports adding one later without a migration).

A new Drizzle migration under `drizzle/migrations/` adds both tables,
generated via `bun run db:generate` per existing convention.

### `lib/invoice-reminders/reminder-service.ts`

```typescript
export class InvoiceReminderService {
  constructor(
    private readonly getInvoiceData: typeof getInvoiceReminderData,
    private readonly emailService: EmailService,
    private readonly db: BunSQLiteDatabase<typeof schema>,
  ) {}

  async run(): Promise<RunSummary> {
    const thresholdDays = this.readThresholdDays();
    const pool = await getPool();
    const groups = await this.getInvoiceData(pool, thresholdDays);

    let sent = 0, failed = 0;
    for (const group of groups) {
      try {
        await this.emailService.send(group.email, 'invoice-reminder', buildTemplateData(group));
        this.logResult(group, 'sent');
        sent++;
      } catch (error) {
        this.logResult(group, 'failed', error);
        failed++;
      }
    }
    return { sent, failed, total: groups.length };
  }
}
```

Constructor injection of the repository function, `EmailService`, and the
SQLite db keeps this unit-testable without a live SMTP/MSSQL connection —
tests can pass fakes for all three. This mirrors the project's existing
service pattern (`PasswordResetService`, `EmailService` itself) rather
than introducing a new style.

### Email template

`lib/email/templates/invoice-reminder.hbs` follows the same plain
Handlebars + inline-styled-table structure as `password-reset.hbs`
(same logo header, same color/font choices). Three conditional sections
(`{{#if overdue}}`, `{{#if dueToday}}`, `{{#if dueSoon}}`), each an HTML
table of invoices (`n_control`, `fec_venc`, saldo Bs, saldo USD).

**Note on `EmailService.send()`'s signature**: it currently types `data`
as `Record<string, string>`, which is too narrow for an array of invoice
rows. The template needs either (a) the signature widened to
`Record<string, unknown>` so `{{#each}}` can iterate a real array — the
minimal change, and the one this design uses — or (b) pre-rendering the
invoice table to an HTML string in `reminder-service.ts` and passing it
as a single string field. Widening the type is preferred: it's a
one-line signature change, Handlebars already supports `{{#each}}`/`{{#if}}`
natively with no new helper registration, and it keeps table-row markup
in the `.hbs` file (presentation) rather than string-built in the service
(logic) — consistent with "logic and markup stay separated" already
implied by the template-file approach.

`EmailService.getSubjectForTemplate()`'s lookup map gets one new entry:
`'invoice-reminder': 'Estado de cuenta — facturas próximas a vencer'`.

### `scripts/send-invoice-reminders.ts`

Thin entrypoint, same shape as `scripts/seed.ts`: constructs
`InvoiceReminderService` with real dependencies, calls `.run()`, logs a
one-line summary (`sent`, `failed`, `total`) to stdout, and
`process.exit(1)` only when `run()` itself throws (DB unreachable, etc.)
— not when individual customer sends fail, since those are already
captured in `RunSummary`/the log table.

### Admin UI

`app/(app)/admin/config-cobranza/` — new admin-only page (role check per
existing convention, `AGENTS.md` "Admin check"), mirroring
`config-inventario`'s `page.tsx`/`config-client.tsx` split: server
component loads current `invoiceReminderSettings` row, client component
renders a form with a single `thresholdDays` number input, PUT to
`app/api/admin/config-cobranza/route.ts` (admin-gated independently per
existing "every gate enforced twice" convention). No new UI pattern
introduced.

## Error Handling

- **Per-customer send failure** (SMTP error, template render error): caught
  inside the loop in `InvoiceReminderService.run()`, logged as a `'failed'`
  row with `errorMessage`, loop continues. The run's overall exit code
  stays `0` — a partial-failure run is still a "successful" invocation of
  the job as far as Task Scheduler is concerned; failures are visible in
  the log table for a human to review.
- **Customer with no email on file**: excluded from the query result (an
  `INNER JOIN` requiring non-null/non-empty `saCliente.email`), not logged
  as a failure — there was nothing actionable to attempt. (If visibility
  into "customers with debt but no email" becomes wanted later, that's a
  separate reporting concern, not part of this job.)
- **Hard failure** (ERP DB unreachable, SQLite unreachable, settings row
  missing): thrown out of `run()`, caught in the script entrypoint, logged,
  `process.exit(1)`.

## Testing

- `lib/invoice-reminders/repository.ts` — integration test against the
  Dockerized mock ERP (per existing MSSQL integration test pattern), same
  shape as `scripts/dwh/` tests: seed a few `saDocumentoVenta` rows across
  due-soon/due-today/overdue/paid-off/anulado/credit-note states, assert
  the grouping and exclusions are correct.
- `lib/invoice-reminders/reminder-service.ts` — unit tests with fake
  repository fn, fake `EmailService` (assert `.send()` called with
  expected args per customer, count sent/failed), fake db (assert log rows
  written). No real SMTP or MSSQL needed here — this is exactly what the
  constructor-injection is for.
- `lib/email/templates/invoice-reminder.hbs` — a lightweight test can
  compile the template with representative fixture data and assert key
  strings appear (invoice numbers, amounts) — same spirit as existing
  `csv.test.ts`/`xlsx.test.ts` output-shape assertions.

## Out of Scope (this pass)

- No refactor of `EmailService` beyond the one type-signature widening
  noted above.
- No same-day duplicate-send guard (log table supports adding one later).
- No UI for browsing `invoiceReminderLog` history — settings-only admin
  screen for now.
- No change to how the ERP knowledge base / MCP server is run or deployed
  — this design only *reads* its already-complete docs.
