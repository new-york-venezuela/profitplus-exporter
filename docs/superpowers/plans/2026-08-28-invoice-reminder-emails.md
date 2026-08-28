# Invoice Reminder Emails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a daily scheduled job that emails each customer with open invoices (due soon, due today, or overdue) a digest of what they owe, sourced from the ERP's `saDocumentoVenta` CxC ledger.

**Architecture:** A standalone script (`scripts/send-invoice-reminders.ts`), triggered by Windows Task Scheduler, built from a thin MSSQL repository, an injectable orchestrator service, a Handlebars email template, two new SQLite settings/log tables, and an admin settings page — following the project's existing `lib/reports/` (query) + `lib/services/` (orchestration) + `lib/email/templates/` (presentation) split.

**Tech Stack:** Next.js 16 App Router, TypeScript, Bun, `mssql` (ERP), Drizzle + `bun:sqlite` (settings/log), `nodemailer` + `handlebars` (existing `EmailService`), `bun:test`.

**Spec:** `docs/superpowers/specs/2026-08-28-invoice-reminder-emails-design.md`

## Global Constraints

- ERP `mssql` queries use `.input()` for ALL user-controlled values — never concatenate (project convention, `AGENTS.md`).
- ERP `char` columns (`co_tipo_doc`, `nro_doc`, `co_cli`, `email`) are space-padded — always `.trim()` output via the existing `trimStrings()` helper (`lib/trim-strings.ts`), never a fresh trim implementation.
- `saCliente.email` may be `NULL`, empty, or the literal sentinel string `'-'` (confirmed against real data in the mock ERP) — all three count as "no email on file" and must be excluded from the query results, not treated as failures.
- `saDocumentoVenta.saldo` is the CxC source of truth — never recompute debt from `saCobroDocReng`.
- `co_tipo_doc NOT IN ('N/CR','NCR')` is the correct debt filter — `'N/DB'` (nota de débito, e.g. diferencial cambiario) counts as debt and must stay included, `'N/CR'`/`'NCR'` (credit notes) must stay excluded.
- Every admin route/page checks `role === 'admin'` independently at both the page and the API layer — no shared middleware exists in this app (`AGENTS.md`).
- CSV/date conventions don't apply here (no CSV export in this feature), but date math still goes through `lib/dates.ts` conventions where applicable — this feature does its own date arithmetic in SQL (`DATEDIFF`/`DATEADD`) and TypeScript `Date`, not `lib/dates.ts`, since `lib/dates.ts` is scoped to report date-range parsing, not this.
- Error responses from new API routes use the `{ error: string }` shape with appropriate HTTP status, matching every other route in the app.

---

## File Structure

```
lib/db/schema.ts                                    — MODIFY: + invoiceReminderSettings, invoiceReminderLog tables
drizzle/migrations/0002_<generated>.sql              — CREATE: via drizzle-kit generate

lib/invoice-reminders/types.ts                       — CREATE: shared types
lib/invoice-reminders/repository.ts                  — CREATE: getInvoiceReminderData()
lib/invoice-reminders/repository.test.ts             — CREATE: unit tests for grouping logic (pure function, no DB)
lib/invoice-reminders/reminder-service.ts            — CREATE: InvoiceReminderService orchestrator
lib/invoice-reminders/reminder-service.test.ts        — CREATE: unit tests with fakes

lib/email/email-service.ts                            — MODIFY: widen send()'s data param type
lib/email/templates/invoice-reminder.hbs              — CREATE: digest email template

scripts/send-invoice-reminders.ts                     — CREATE: entrypoint

app/api/admin/config-cobranza/route.ts                — CREATE: GET/PATCH threshold settings
app/(app)/admin/config-cobranza/page.tsx               — CREATE: server component
app/(app)/admin/config-cobranza/config-client.tsx      — CREATE: client form
components/sidebar.tsx                                 — MODIFY: + nav link

__tests__/integration/invoice-reminder-repository.integration.test.ts   — CREATE: real MSSQL query test
__tests__/integration/admin-config-cobranza.integration.test.ts          — CREATE: admin route test
```

---

### Task 1: Settings and log tables (SQLite schema + migration)

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `drizzle/migrations/0002_<name>.sql` (generated, not hand-written)
- Test: `__tests__/integration/admin-config-cobranza.integration.test.ts` (written in Task 7, but this task's migration is what makes it possible — no standalone test for the schema file itself, verified via Task 7)

**Interfaces:**
- Produces: `invoiceReminderSettings` table (`id`, `thresholdDays: number`, default `3`), `invoiceReminderLog` table (`id`, `runDate: string`, `coCli: string`, `email: string`, `invoiceCount: number`, `status: 'sent'|'failed'`, `errorMessage: string|null`, `sentAt: number`), and their inferred `InvoiceReminderSettings`/`NewInvoiceReminderSettings`/`InvoiceReminderLog`/`NewInvoiceReminderLog` types — consumed by Task 2 (repository reads settings), Task 3 (service writes log rows), Task 6/7 (admin route reads/writes settings).

- [ ] **Step 1: Add the two tables to `lib/db/schema.ts`**

Append after the existing `inventorySettings` block:

```typescript
// ── Invoice reminders ───────────────────────────────────────────────

export const invoiceReminderSettings = sqliteTable('invoice_reminder_settings', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  thresholdDays: integer('threshold_days').notNull().default(3),
});

export type InvoiceReminderSettings    = typeof invoiceReminderSettings.$inferSelect;
export type NewInvoiceReminderSettings = typeof invoiceReminderSettings.$inferInsert;

export const invoiceReminderLog = sqliteTable('invoice_reminder_log', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  runDate:      text('run_date').notNull(),
  coCli:        text('co_cli').notNull(),
  email:        text('email').notNull(),
  invoiceCount: integer('invoice_count').notNull(),
  status:       text('status', { enum: ['sent', 'failed'] }).notNull(),
  errorMessage: text('error_message'),
  sentAt:       integer('sent_at').notNull(),
});

export type InvoiceReminderLog    = typeof invoiceReminderLog.$inferSelect;
export type NewInvoiceReminderLog = typeof invoiceReminderLog.$inferInsert;
```

- [ ] **Step 2: Generate the migration**

Run: `bun run db:generate`
Expected: a new file `drizzle/migrations/0002_<generated-name>.sql` is created containing `CREATE TABLE invoice_reminder_settings (...)` and `CREATE TABLE invoice_reminder_log (...)`.

- [ ] **Step 3: Add a seed row for the settings singleton to the generated migration**

Open the new migration file and append, after the two `CREATE TABLE` statements (following the exact pattern used in `drizzle/migrations/0001_clean_starjammers.sql`'s final line):

```sql
--> statement-breakpoint
INSERT INTO invoice_reminder_settings (threshold_days) VALUES (3);
```

- [ ] **Step 4: Apply the migration locally**

Run: `bun run migrate`
Expected: no errors; `data/exporter.db` now has `invoice_reminder_settings` (1 row, `threshold_days=3`) and `invoice_reminder_log` (empty) tables. Verify with:
`bun run -e "import { getDb } from './lib/db/sqlite'; import { invoiceReminderSettings } from './lib/db/schema'; console.log(getDb().select().from(invoiceReminderSettings).all())"` — Expected output: `[ { id: 1, thresholdDays: 3 } ]`

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts drizzle/migrations/
git commit -m "feat: add invoice_reminder_settings and invoice_reminder_log tables"
```

---

### Task 2: Repository — query and group ERP invoice data

**Files:**
- Create: `lib/invoice-reminders/types.ts`
- Create: `lib/invoice-reminders/repository.ts`
- Test: `lib/invoice-reminders/repository.test.ts` (pure grouping-function unit test, no DB)
- Test: `__tests__/integration/invoice-reminder-repository.integration.test.ts` (real MSSQL query, uses the mock ERP)

**Interfaces:**
- Consumes: `sql.ConnectionPool` from `mssql` (constructed the same way as `lib/db/mssql.ts`'s `getPool()`), `trimStrings()` from `lib/trim-strings.ts`.
- Produces: `ReminderInvoice`, `CustomerInvoiceGroup` types; `getInvoiceReminderData(pool: sql.ConnectionPool, thresholdDays: number): Promise<CustomerInvoiceGroup[]>`; `groupInvoiceRows(rows: RawInvoiceRow[]): CustomerInvoiceGroup[]` (exported separately so it's unit-testable without a live DB) — consumed by Task 3 (`InvoiceReminderService`).

- [ ] **Step 1: Write `lib/invoice-reminders/types.ts`**

```typescript
export interface ReminderInvoice {
  nroDoc:      string;
  nControl:    string | null;
  fecVenc:     Date;
  saldoBs:     number;
  saldoUsd:    number;
  diasVencido: number; // negative = due within thresholdDays, 0 = due today, positive = overdue
}

export interface CustomerInvoiceGroup {
  coCli:    string;
  cliDes:   string;
  email:    string;
  dueSoon:  ReminderInvoice[];
  dueToday: ReminderInvoice[];
  overdue:  ReminderInvoice[];
}

export interface RawInvoiceRow {
  co_cli:   string;
  cli_des:  string;
  email:    string;
  nro_doc:  string;
  n_control: string | null;
  fec_venc: Date;
  saldo:    number;
  tasa:     number;
}
```

- [ ] **Step 2: Write the failing unit test for the pure grouping function**

Create `lib/invoice-reminders/repository.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import { groupInvoiceRows } from './repository';
import type { RawInvoiceRow } from './types';

function makeRow(overrides: Partial<RawInvoiceRow> = {}): RawInvoiceRow {
  return {
    co_cli: 'C001', cli_des: 'Cliente Uno', email: 'uno@x.com',
    nro_doc: 'B0001', n_control: '00-001', fec_venc: new Date(), saldo: 100, tasa: 50,
    ...overrides,
  };
}

describe('groupInvoiceRows', () => {
  test('groups a not-yet-due row into dueSoon', () => {
    const inTwoDays = new Date();
    inTwoDays.setDate(inTwoDays.getDate() + 2);
    const groups = groupInvoiceRows([makeRow({ fec_venc: inTwoDays })]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.dueSoon).toHaveLength(1);
    expect(groups[0]!.dueToday).toHaveLength(0);
    expect(groups[0]!.overdue).toHaveLength(0);
    expect(groups[0]!.dueSoon[0]!.diasVencido).toBeLessThan(0);
  });

  test('groups a today-due row into dueToday', () => {
    const groups = groupInvoiceRows([makeRow({ fec_venc: new Date() })]);
    expect(groups[0]!.dueToday).toHaveLength(1);
    expect(groups[0]!.dueToday[0]!.diasVencido).toBe(0);
  });

  test('groups a past-due row into overdue', () => {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const groups = groupInvoiceRows([makeRow({ fec_venc: fiveDaysAgo })]);
    expect(groups[0]!.overdue).toHaveLength(1);
    expect(groups[0]!.overdue[0]!.diasVencido).toBe(5);
  });

  test('computes saldoUsd as saldo / tasa', () => {
    const groups = groupInvoiceRows([makeRow({ saldo: 500, tasa: 50 })]);
    const invoice = groups[0]!.dueToday[0] ?? groups[0]!.dueSoon[0] ?? groups[0]!.overdue[0];
    expect(invoice!.saldoUsd).toBeCloseTo(10, 5);
  });

  test('groups multiple rows for the same customer under one entry', () => {
    const groups = groupInvoiceRows([
      makeRow({ nro_doc: 'B0001' }),
      makeRow({ nro_doc: 'B0002' }),
    ]);
    expect(groups).toHaveLength(1);
    const total = groups[0]!.dueSoon.length + groups[0]!.dueToday.length + groups[0]!.overdue.length;
    expect(total).toBe(2);
  });

  test('keeps separate customers as separate entries', () => {
    const groups = groupInvoiceRows([
      makeRow({ co_cli: 'C001' }),
      makeRow({ co_cli: 'C002', cli_des: 'Cliente Dos', email: 'dos@x.com' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map(g => g.coCli).sort()).toEqual(['C001', 'C002']);
  });

  test('empty input returns empty array', () => {
    expect(groupInvoiceRows([])).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test lib/invoice-reminders/repository.test.ts`
Expected: FAIL — `groupInvoiceRows` is not exported / module not found (`repository.ts` doesn't exist yet).

- [ ] **Step 4: Write `lib/invoice-reminders/repository.ts`**

```typescript
import sql from 'mssql';
import { trimStrings } from '@/lib/trim-strings';
import type { CustomerInvoiceGroup, RawInvoiceRow, ReminderInvoice } from './types';

export function groupInvoiceRows(rows: RawInvoiceRow[]): CustomerInvoiceGroup[] {
  const byCustomer = new Map<string, CustomerInvoiceGroup>();

  for (const row of rows) {
    let group = byCustomer.get(row.co_cli);
    if (!group) {
      group = {
        coCli:    row.co_cli,
        cliDes:   row.cli_des,
        email:    row.email,
        dueSoon:  [],
        dueToday: [],
        overdue:  [],
      };
      byCustomer.set(row.co_cli, group);
    }

    const diasVencido = Math.round(
      (Date.now() - row.fec_venc.getTime()) / (1000 * 60 * 60 * 24)
    );

    const invoice: ReminderInvoice = {
      nroDoc:      row.nro_doc,
      nControl:    row.n_control,
      fecVenc:     row.fec_venc,
      saldoBs:     row.saldo,
      saldoUsd:    row.tasa !== 0 ? row.saldo / row.tasa : 0,
      diasVencido,
    };

    if (diasVencido < 0)      group.dueSoon.push(invoice);
    else if (diasVencido === 0) group.dueToday.push(invoice);
    else                        group.overdue.push(invoice);
  }

  return Array.from(byCustomer.values());
}

export async function getInvoiceReminderData(
  pool: sql.ConnectionPool,
  thresholdDays: number,
): Promise<CustomerInvoiceGroup[]> {
  const result = await pool.request()
    .input('thresholdDays', sql.Int, thresholdDays)
    .query(`
      SELECT
        d.co_cli, c.cli_des, c.email,
        d.nro_doc, d.n_control, d.fec_venc, d.saldo, d.tasa
      FROM saDocumentoVenta d
      INNER JOIN saCliente c ON c.co_cli = d.co_cli
      WHERE d.anulado = 0
        AND d.saldo > 0
        AND RTRIM(d.co_tipo_doc) NOT IN ('N/CR', 'NCR')
        AND d.fec_venc <= DATEADD(day, @thresholdDays, GETDATE())
        AND c.email IS NOT NULL
        AND LTRIM(RTRIM(c.email)) NOT IN ('', '-')
      ORDER BY d.co_cli, d.fec_venc
    `);

  const rows = trimStrings(result.recordset) as unknown as RawInvoiceRow[];
  return groupInvoiceRows(rows);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test lib/invoice-reminders/repository.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Write the integration test against the real (mock) ERP**

Create `__tests__/integration/invoice-reminder-repository.integration.test.ts`:

```typescript
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import sql from 'mssql';
import { getInvoiceReminderData } from '@/lib/invoice-reminders/repository';

function buildTestConfig(): sql.config {
  return {
    server: process.env.DB_SERVER!,
    port: parseInt(process.env.DB_PORT ?? '1433'),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
    },
  };
}

let pool: sql.ConnectionPool;
const TEST_CLI = 'ZZTEST01';
const TEST_DOC_DUE_SOON = 'ZZDOC001';
const TEST_DOC_OVERDUE  = 'ZZDOC002';
const TEST_DOC_CREDIT   = 'ZZDOC003';

async function cleanup() {
  await pool.request().query(`DELETE FROM saDocumentoVenta WHERE co_cli = '${TEST_CLI}'`);
  await pool.request().query(`DELETE FROM saCliente WHERE co_cli = '${TEST_CLI}'`);
}

beforeAll(async () => {
  pool = await new sql.ConnectionPool(buildTestConfig()).connect();
  await cleanup();

  await pool.request()
    .input('coCli', sql.Char(20), TEST_CLI)
    .input('cliDes', sql.VarChar(60), 'Cliente De Prueba Reminder')
    .input('email', sql.VarChar(120), 'reminder-test@example.com')
    .query(`INSERT INTO saCliente (co_cli, cli_des, email, inactivo) VALUES (@coCli, @cliDes, @email, 0)`);

  const inTwoDays = new Date();
  inTwoDays.setDate(inTwoDays.getDate() + 2);
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  async function insertDoc(tipoDoc: string, nroDoc: string, fecVenc: Date, saldo: number) {
    await pool.request()
      .input('tipoDoc', sql.Char(4), tipoDoc)
      .input('nroDoc', sql.Char(20), nroDoc)
      .input('coCli', sql.Char(20), TEST_CLI)
      .input('fecVenc', sql.SmallDateTime, fecVenc)
      .input('saldo', sql.Decimal(18, 2), saldo)
      .input('tasa', sql.Decimal(18, 4), 50)
      .query(`
        INSERT INTO saDocumentoVenta (co_tipo_doc, nro_doc, co_cli, fec_venc, fec_emis, saldo, tasa, anulado, total_neto)
        VALUES (@tipoDoc, @nroDoc, @coCli, @fecVenc, @fecVenc, @saldo, @tasa, 0, @saldo)
      `);
  }

  await insertDoc('FACT', TEST_DOC_DUE_SOON, inTwoDays, 500);
  await insertDoc('FACT', TEST_DOC_OVERDUE, fiveDaysAgo, 300);
  await insertDoc('N/CR', TEST_DOC_CREDIT, fiveDaysAgo, 200);
});

afterEach(async () => {
  // no per-test mutation to reset — data is static across tests in this file
});

afterAll(async () => {
  await cleanup();
  if (pool?.connected) await pool.close();
});

describe('getInvoiceReminderData', () => {
  test('returns the test customer with dueSoon and overdue invoices, excluding the credit note', async () => {
    const groups = await getInvoiceReminderData(pool, 3);
    const group = groups.find(g => g.coCli === TEST_CLI);

    expect(group).toBeDefined();
    expect(group!.email).toBe('reminder-test@example.com');
    expect(group!.dueSoon.map(i => i.nroDoc)).toContain(TEST_DOC_DUE_SOON);
    expect(group!.overdue.map(i => i.nroDoc)).toContain(TEST_DOC_OVERDUE);
    expect(group!.dueSoon.map(i => i.nroDoc)).not.toContain(TEST_DOC_CREDIT);
    expect(group!.overdue.map(i => i.nroDoc)).not.toContain(TEST_DOC_CREDIT);
    expect(group!.dueToday).toHaveLength(0);
  });

  test('respects the thresholdDays window — a 0-day threshold excludes the dueSoon invoice', async () => {
    const groups = await getInvoiceReminderData(pool, 0);
    const group = groups.find(g => g.coCli === TEST_CLI);
    // dueSoon invoice is 2 days out — excluded when threshold is 0, overdue still included
    if (group) {
      expect(group.dueSoon.map(i => i.nroDoc)).not.toContain(TEST_DOC_DUE_SOON);
      expect(group.overdue.map(i => i.nroDoc)).toContain(TEST_DOC_OVERDUE);
    } else {
      // acceptable only if overdue-only customers still surface as their own group
      throw new Error('Expected test customer group with overdue invoice to still appear at threshold=0');
    }
  });

  test('excludes a customer whose email is the sentinel "-"', async () => {
    const sentinelCli = 'ZZTEST02';
    await pool.request()
      .input('coCli', sql.Char(20), sentinelCli)
      .input('cliDes', sql.VarChar(60), 'Cliente Sin Email')
      .query(`INSERT INTO saCliente (co_cli, cli_des, email, inactivo) VALUES (@coCli, @cliDes, '-', 0)`);
    await pool.request()
      .input('tipoDoc', sql.Char(4), 'FACT')
      .input('nroDoc', sql.Char(20), 'ZZDOC004')
      .input('coCli', sql.Char(20), sentinelCli)
      .input('fecVenc', sql.SmallDateTime, new Date())
      .input('saldo', sql.Decimal(18, 2), 100)
      .input('tasa', sql.Decimal(18, 4), 50)
      .query(`
        INSERT INTO saDocumentoVenta (co_tipo_doc, nro_doc, co_cli, fec_venc, fec_emis, saldo, tasa, anulado, total_neto)
        VALUES (@tipoDoc, @nroDoc, @coCli, @fecVenc, @fecVenc, @saldo, @tasa, 0, @saldo)
      `);

    const groups = await getInvoiceReminderData(pool, 3);
    expect(groups.find(g => g.coCli === sentinelCli)).toBeUndefined();

    await pool.request().query(`DELETE FROM saDocumentoVenta WHERE co_cli = '${sentinelCli}'`);
    await pool.request().query(`DELETE FROM saCliente WHERE co_cli = '${sentinelCli}'`);
  });
});
```

- [ ] **Step 7: Run the integration test**

Run: `bun test --isolate --env-file=.env.local --timeout 30000 __tests__/integration/invoice-reminder-repository.integration.test.ts`
Expected: PASS (3 tests). Requires the mock ERP container (`profitplus-erp-mock`) running — confirm with `docker ps` first if it fails to connect.

- [ ] **Step 8: Commit**

```bash
git add lib/invoice-reminders/types.ts lib/invoice-reminders/repository.ts lib/invoice-reminders/repository.test.ts __tests__/integration/invoice-reminder-repository.integration.test.ts
git commit -m "feat: add invoice reminder repository querying saDocumentoVenta CxC data"
```

---

### Task 3: EmailService type widening + invoice-reminder template

**Files:**
- Modify: `lib/services/email-service.ts:22-25` (the `send()` signature), `:76-80` (`getSubjectForTemplate`)
- Create: `lib/email/templates/invoice-reminder.hbs`
- Test: `lib/services/email-service.test.ts` (new — no existing test file for this service; verifies template compiles with array data)

**Interfaces:**
- Consumes: nothing new.
- Produces: `EmailService.send(to: string, templateName: string, data: Record<string, unknown>): Promise<void>` (widened from `Record<string, string>`) — consumed by Task 4 (`InvoiceReminderService`).

- [ ] **Step 1: Write the failing test**

Create `lib/services/email-service.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

describe('invoice-reminder.hbs template', () => {
  test('renders invoice tables from array data without a helper registration', () => {
    const templatePath = path.join(process.cwd(), 'lib', 'email', 'templates', 'invoice-reminder.hbs');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);

    const html = template({
      cliDes: 'Cliente De Prueba',
      dueSoon: [{ nroDoc: 'B0001', nControl: '00-001', fecVenc: '2026-09-01', saldoBs: '500.00', saldoUsd: '10.00' }],
      dueToday: [],
      overdue: [{ nroDoc: 'B0002', nControl: '00-002', fecVenc: '2026-08-20', saldoBs: '300.00', saldoUsd: '6.00', diasVencido: 8 }],
    });

    expect(html).toContain('Cliente De Prueba');
    expect(html).toContain('B0001');
    expect(html).toContain('B0002');
    expect(html).toContain('500.00');
    expect(html).toContain('6.00');
  });

  test('omits a section entirely when its array is empty', () => {
    const templatePath = path.join(process.cwd(), 'lib', 'email', 'templates', 'invoice-reminder.hbs');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);

    const html = template({
      cliDes: 'Cliente Dos',
      dueSoon: [],
      dueToday: [],
      overdue: [{ nroDoc: 'B0003', nControl: null, fecVenc: '2026-08-20', saldoBs: '100.00', saldoUsd: '2.00', diasVencido: 3 }],
    });

    expect(html).not.toContain('Vence pronto');
    expect(html).toContain('Vencida');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test lib/services/email-service.test.ts`
Expected: FAIL — `lib/email/templates/invoice-reminder.hbs` does not exist (ENOENT).

- [ ] **Step 3: Write `lib/email/templates/invoice-reminder.hbs`**

```handlebars
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Estado de cuenta</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9f9f9;">

<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #333333; max-width: 650px; width: 100%; border-collapse: collapse; margin: 20px auto; background-color: #ffffff; padding: 30px; border: 1px solid #e5e5e5;">

    <tr>
        <td align="center" style="padding-bottom: 20px; border-bottom: 1px solid #e5e5e5; padding-top: 20px;">
            <a href="https://www.alimentosnewyork.com" target="_blank" style="text-decoration: none;">
                <img src="https://raw.githubusercontent.com/new-york-venezuela/web/6e0c301ac3ddbbf51b34bdf4649f15217b09c619/public/logos/logo-mail.png" alt="Alimentos New York" width="120" style="display: block; border: 0; max-width: 100%; height: auto;">
            </a>
        </td>
    </tr>

    <tr>
        <td style="padding: 30px 20px;">
            <h1 style="font-size: 22px; font-weight: bold; color: #111111; margin-top: 0; margin-bottom: 20px; text-align: center;">
                Estado de cuenta
            </h1>

            <p style="font-size: 14px; color: #555555; line-height: 1.6; margin-top: 0; margin-bottom: 25px;">
                Hola <strong>{{cliDes}}</strong>, este es un resumen de tus facturas pendientes.
            </p>

            {{#if overdue}}
            <h2 style="font-size: 16px; color: #b91c1c; margin-bottom: 10px;">Vencidas</h2>
            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #fef2f2;">
                        <th style="text-align: left; padding: 8px; font-size: 12px; color: #7f1d1d;">Documento</th>
                        <th style="text-align: left; padding: 8px; font-size: 12px; color: #7f1d1d;">Vencimiento</th>
                        <th style="text-align: right; padding: 8px; font-size: 12px; color: #7f1d1d;">Días vencido</th>
                        <th style="text-align: right; padding: 8px; font-size: 12px; color: #7f1d1d;">Monto (Bs)</th>
                        <th style="text-align: right; padding: 8px; font-size: 12px; color: #7f1d1d;">Monto (USD)</th>
                    </tr>
                </thead>
                <tbody>
                    {{#each overdue}}
                    <tr style="border-bottom: 1px solid #f3f4f6;">
                        <td style="padding: 8px; font-size: 13px;">{{this.nroDoc}}{{#if this.nControl}} ({{this.nControl}}){{/if}}</td>
                        <td style="padding: 8px; font-size: 13px;">{{this.fecVenc}}</td>
                        <td style="padding: 8px; font-size: 13px; text-align: right;">{{this.diasVencido}}</td>
                        <td style="padding: 8px; font-size: 13px; text-align: right;">{{this.saldoBs}}</td>
                        <td style="padding: 8px; font-size: 13px; text-align: right;">{{this.saldoUsd}}</td>
                    </tr>
                    {{/each}}
                </tbody>
            </table>
            {{/if}}

            {{#if dueToday}}
            <h2 style="font-size: 16px; color: #92400e; margin-bottom: 10px;">Vencen hoy</h2>
            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #fffbeb;">
                        <th style="text-align: left; padding: 8px; font-size: 12px; color: #78350f;">Documento</th>
                        <th style="text-align: left; padding: 8px; font-size: 12px; color: #78350f;">Vencimiento</th>
                        <th style="text-align: right; padding: 8px; font-size: 12px; color: #78350f;">Monto (Bs)</th>
                        <th style="text-align: right; padding: 8px; font-size: 12px; color: #78350f;">Monto (USD)</th>
                    </tr>
                </thead>
                <tbody>
                    {{#each dueToday}}
                    <tr style="border-bottom: 1px solid #f3f4f6;">
                        <td style="padding: 8px; font-size: 13px;">{{this.nroDoc}}{{#if this.nControl}} ({{this.nControl}}){{/if}}</td>
                        <td style="padding: 8px; font-size: 13px;">{{this.fecVenc}}</td>
                        <td style="padding: 8px; font-size: 13px; text-align: right;">{{this.saldoBs}}</td>
                        <td style="padding: 8px; font-size: 13px; text-align: right;">{{this.saldoUsd}}</td>
                    </tr>
                    {{/each}}
                </tbody>
            </table>
            {{/if}}

            {{#if dueSoon}}
            <h2 style="font-size: 16px; color: #1e40af; margin-bottom: 10px;">Vence pronto</h2>
            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 15px; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #eff6ff;">
                        <th style="text-align: left; padding: 8px; font-size: 12px; color: #1e3a8a;">Documento</th>
                        <th style="text-align: left; padding: 8px; font-size: 12px; color: #1e3a8a;">Vencimiento</th>
                        <th style="text-align: right; padding: 8px; font-size: 12px; color: #1e3a8a;">Monto (Bs)</th>
                        <th style="text-align: right; padding: 8px; font-size: 12px; color: #1e3a8a;">Monto (USD)</th>
                    </tr>
                </thead>
                <tbody>
                    {{#each dueSoon}}
                    <tr style="border-bottom: 1px solid #f3f4f6;">
                        <td style="padding: 8px; font-size: 13px;">{{this.nroDoc}}{{#if this.nControl}} ({{this.nControl}}){{/if}}</td>
                        <td style="padding: 8px; font-size: 13px;">{{this.fecVenc}}</td>
                        <td style="padding: 8px; font-size: 13px; text-align: right;">{{this.saldoBs}}</td>
                        <td style="padding: 8px; font-size: 13px; text-align: right;">{{this.saldoUsd}}</td>
                    </tr>
                    {{/each}}
                </tbody>
            </table>
            {{/if}}

            <p style="font-size: 12px; color: #666666; line-height: 1.6; margin-top: 20px; margin-bottom: 0;">
                Si ya realizaste el pago de alguna de estas facturas, puedes ignorar este correo.
            </p>
        </td>
    </tr>

</table>

</body>
</html>
```

- [ ] **Step 4: Run test to verify it still fails (template exists, type not widened yet — but this test doesn't touch EmailService directly, so re-run to confirm the template itself works)**

Run: `bun test lib/services/email-service.test.ts`
Expected: PASS (2 tests) — this test compiles the `.hbs` directly with Handlebars, not through `EmailService`, so it doesn't require the type change yet.

- [ ] **Step 5: Widen `EmailService.send()`'s signature**

In `lib/services/email-service.ts`, change:

```typescript
  async send(
    to: string,
    templateName: string,
    data: Record<string, string>
  ): Promise<void> {
```

to:

```typescript
  async send(
    to: string,
    templateName: string,
    data: Record<string, unknown>
  ): Promise<void> {
```

- [ ] **Step 6: Add the subject line for the new template**

In the same file, find `getSubjectForTemplate` and change:

```typescript
  private getSubjectForTemplate(templateName: string): string {
    const subjects: Record<string, string> = {
      'password-reset': 'Reset Your Password',
    };
    return subjects[templateName] || 'Email from ProfitPlus Exporter';
  }
```

to:

```typescript
  private getSubjectForTemplate(templateName: string): string {
    const subjects: Record<string, string> = {
      'password-reset':   'Reset Your Password',
      'invoice-reminder': 'Estado de cuenta — facturas próximas a vencer',
    };
    return subjects[templateName] || 'Email from ProfitPlus Exporter';
  }
```

- [ ] **Step 7: Run the full test suite for this file and its neighbors to check nothing broke**

Run: `bun test lib/services/ lib/email/`
Expected: PASS (no existing tests reference the old `Record<string, string>` type directly, so the widening is additive and non-breaking)

- [ ] **Step 8: Commit**

```bash
git add lib/services/email-service.ts lib/services/email-service.test.ts lib/email/templates/invoice-reminder.hbs
git commit -m "feat: add invoice-reminder email template, widen EmailService data type"
```

---

### Task 4: InvoiceReminderService orchestrator

**Files:**
- Create: `lib/invoice-reminders/reminder-service.ts`
- Test: `lib/invoice-reminders/reminder-service.test.ts`

**Interfaces:**
- Consumes: `CustomerInvoiceGroup` (Task 2's `types.ts`), `EmailService` (`lib/services/email-service.ts`, unchanged class shape besides the widened `send()`), `getDb()`'s return type (`BunSQLiteDatabase<typeof schema>`), `invoiceReminderSettings`/`invoiceReminderLog` (Task 1's `lib/db/schema.ts`).
- Produces: `RunSummary { sent: number; failed: number; total: number }`; `InvoiceReminderService` class with constructor `(getInvoiceData: typeof getInvoiceReminderData, emailService: EmailService, db: BunSQLiteDatabase<typeof schema>, pool: sql.ConnectionPool)` and method `run(): Promise<RunSummary>` — consumed by Task 5 (`scripts/send-invoice-reminders.ts`).

- [ ] **Step 1: Write the failing test**

Create `lib/invoice-reminders/reminder-service.test.ts`:

```typescript
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/sqlite';
import { invoiceReminderSettings, invoiceReminderLog } from '@/lib/db/schema';
import { InvoiceReminderService } from './reminder-service';
import type { CustomerInvoiceGroup } from './types';
import type { EmailService } from '@/lib/services/email-service';

function makeGroup(overrides: Partial<CustomerInvoiceGroup> = {}): CustomerInvoiceGroup {
  return {
    coCli: 'C001', cliDes: 'Cliente Uno', email: 'uno@x.com',
    dueSoon: [], dueToday: [{
      nroDoc: 'B0001', nControl: '00-001', fecVenc: new Date(), saldoBs: 100, saldoUsd: 2, diasVencido: 0,
    }], overdue: [],
    ...overrides,
  };
}

function resetDb() {
  const db = getDb();
  db.delete(invoiceReminderLog).run();
  db.delete(invoiceReminderSettings).run();
  db.insert(invoiceReminderSettings).values({ thresholdDays: 3 }).run();
}

describe('InvoiceReminderService', () => {
  beforeEach(() => {
    resetDb();
  });

  test('sends one email per customer group and logs a sent row each', async () => {
    const groups = [makeGroup({ coCli: 'C001' }), makeGroup({ coCli: 'C002', email: 'dos@x.com' })];
    const sentTo: string[] = [];
    const fakeEmailService = {
      send: async (to: string) => { sentTo.push(to); },
    } as unknown as EmailService;

    const service = new InvoiceReminderService(
      async () => groups,
      fakeEmailService,
      getDb(),
      {} as never, // pool unused when getInvoiceData is faked
    );

    const summary = await service.run();

    expect(summary).toEqual({ sent: 2, failed: 0, total: 2 });
    expect(sentTo.sort()).toEqual(['dos@x.com', 'uno@x.com']);

    const logRows = getDb().select().from(invoiceReminderLog).all();
    expect(logRows).toHaveLength(2);
    expect(logRows.every(r => r.status === 'sent')).toBe(true);
  });

  test('continues past a per-customer send failure and logs it', async () => {
    const groups = [makeGroup({ coCli: 'C001', email: 'fails@x.com' }), makeGroup({ coCli: 'C002', email: 'ok@x.com' })];
    const fakeEmailService = {
      send: async (to: string) => {
        if (to === 'fails@x.com') throw new Error('SMTP down');
      },
    } as unknown as EmailService;

    const service = new InvoiceReminderService(
      async () => groups,
      fakeEmailService,
      getDb(),
      {} as never,
    );

    const summary = await service.run();

    expect(summary).toEqual({ sent: 1, failed: 1, total: 2 });

    const logRows = getDb().select().from(invoiceReminderLog).all();
    const failedRow = logRows.find(r => r.email === 'fails@x.com');
    expect(failedRow?.status).toBe('failed');
    expect(failedRow?.errorMessage).toContain('SMTP down');
    const sentRow = logRows.find(r => r.email === 'ok@x.com');
    expect(sentRow?.status).toBe('sent');
  });

  test('reads thresholdDays from settings and passes it to the repository function', async () => {
    getDb().update(invoiceReminderSettings).set({ thresholdDays: 7 })
      .where(eq(invoiceReminderSettings.id, getDb().select().from(invoiceReminderSettings).get()!.id)).run();

    let receivedThreshold: number | null = null;
    const fakeGetData = async (_pool: unknown, thresholdDays: number) => {
      receivedThreshold = thresholdDays;
      return [];
    };
    const fakeEmailService = { send: async () => {} } as unknown as EmailService;

    const service = new InvoiceReminderService(fakeGetData as never, fakeEmailService, getDb(), {} as never);
    await service.run();

    expect(receivedThreshold).toBe(7);
  });

  test('empty groups produce a zeroed summary and no log rows', async () => {
    const fakeEmailService = { send: async () => {} } as unknown as EmailService;
    const service = new InvoiceReminderService(async () => [], fakeEmailService, getDb(), {} as never);

    const summary = await service.run();

    expect(summary).toEqual({ sent: 0, failed: 0, total: 0 });
    expect(getDb().select().from(invoiceReminderLog).all()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test lib/invoice-reminders/reminder-service.test.ts`
Expected: FAIL — `reminder-service.ts` does not exist.

- [ ] **Step 3: Write `lib/invoice-reminders/reminder-service.ts`**

```typescript
import type sql from 'mssql';
import { eq } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from '@/lib/db/schema';
import { invoiceReminderSettings, invoiceReminderLog } from '@/lib/db/schema';
import type { EmailService } from '@/lib/services/email-service';
import type { CustomerInvoiceGroup, ReminderInvoice } from './types';

export interface RunSummary {
  sent:   number;
  failed: number;
  total:  number;
}

type GetInvoiceData = (pool: sql.ConnectionPool, thresholdDays: number) => Promise<CustomerInvoiceGroup[]>;

function formatInvoice(invoice: ReminderInvoice) {
  return {
    nroDoc:      invoice.nroDoc,
    nControl:    invoice.nControl,
    fecVenc:     invoice.fecVenc.toLocaleDateString('es-VE'),
    saldoBs:     invoice.saldoBs.toFixed(2),
    saldoUsd:    invoice.saldoUsd.toFixed(2),
    diasVencido: invoice.diasVencido,
  };
}

export class InvoiceReminderService {
  constructor(
    private readonly getInvoiceData: GetInvoiceData,
    private readonly emailService: EmailService,
    private readonly db: BunSQLiteDatabase<typeof schema>,
    private readonly pool: sql.ConnectionPool,
  ) {}

  async run(): Promise<RunSummary> {
    const thresholdDays = this.readThresholdDays();
    const groups = await this.getInvoiceData(this.pool, thresholdDays);

    let sent = 0;
    let failed = 0;

    for (const group of groups) {
      const invoiceCount = group.dueSoon.length + group.dueToday.length + group.overdue.length;
      try {
        await this.emailService.send(group.email, 'invoice-reminder', {
          cliDes:   group.cliDes,
          dueSoon:  group.dueSoon.map(formatInvoice),
          dueToday: group.dueToday.map(formatInvoice),
          overdue:  group.overdue.map(formatInvoice),
        });
        this.logResult(group, invoiceCount, 'sent', null);
        sent++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logResult(group, invoiceCount, 'failed', message);
        failed++;
      }
    }

    return { sent, failed, total: groups.length };
  }

  private readThresholdDays(): number {
    const row = this.db.select().from(invoiceReminderSettings).get();
    return row?.thresholdDays ?? 3;
  }

  private logResult(
    group: CustomerInvoiceGroup,
    invoiceCount: number,
    status: 'sent' | 'failed',
    errorMessage: string | null,
  ): void {
    const runDate = new Date().toISOString().slice(0, 10);
    this.db.insert(invoiceReminderLog).values({
      runDate,
      coCli:        group.coCli,
      email:        group.email,
      invoiceCount,
      status,
      errorMessage,
      sentAt:       Date.now(),
    }).run();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test lib/invoice-reminders/reminder-service.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/invoice-reminders/reminder-service.ts lib/invoice-reminders/reminder-service.test.ts
git commit -m "feat: add InvoiceReminderService orchestrator with per-customer failure isolation"
```

---

### Task 5: Script entrypoint

**Files:**
- Create: `scripts/send-invoice-reminders.ts`
- Test: manual run verification against the mock ERP (no automated test — this is a thin wiring file; its logic is already covered by Task 2/4's tests. Verification is a real invocation, per Step 2 below)

**Interfaces:**
- Consumes: `getInvoiceReminderData` (Task 2), `InvoiceReminderService` (Task 4), `EmailService` (existing), `getPool()` (`lib/db/mssql.ts`, existing), `getDb()` (`lib/db/sqlite.ts`, existing).
- Produces: a runnable script — no exports consumed by other tasks.

- [ ] **Step 1: Write `scripts/send-invoice-reminders.ts`**

```typescript
import { getPool } from '@/lib/db/mssql';
import { getDb } from '@/lib/db/sqlite';
import { EmailService } from '@/lib/services/email-service';
import { getInvoiceReminderData } from '@/lib/invoice-reminders/repository';
import { InvoiceReminderService } from '@/lib/invoice-reminders/reminder-service';

async function main() {
  const pool = await getPool();
  const db = getDb();
  const emailService = new EmailService();

  const service = new InvoiceReminderService(getInvoiceReminderData, emailService, db, pool);
  const summary = await service.run();

  console.log(
    `[send-invoice-reminders] ${new Date().toISOString()} — ` +
    `sent=${summary.sent} failed=${summary.failed} total=${summary.total}`
  );

  if (summary.failed > 0) {
    console.warn(`[send-invoice-reminders] ${summary.failed} customer(s) failed — see invoice_reminder_log for details`);
  }
}

main().catch((err) => {
  console.error('[send-invoice-reminders] fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the script to `package.json`**

In `package.json`'s `"scripts"` block, add (alongside `"seed"`, `"migrate"`, etc.):

```json
"send-invoice-reminders": "bun --bun run scripts/send-invoice-reminders.ts",
```

- [ ] **Step 3: Verify it runs against the mock ERP**

Ensure `profitplus-erp-mock` container is up (`docker ps`), then:
Run: `bun --env-file=.env.local run send-invoice-reminders`
Expected: a summary line printed to stdout, e.g. `[send-invoice-reminders] ... — sent=N failed=0 total=N`, and no uncaught exception. (SMTP will likely fail against the placeholder `.env.local` SMTP_* values unless a real/test SMTP is configured — a `failed=N` result with a warning line is an acceptable pass for this manual check, since it proves the wiring works end-to-end up to the actual send call; a thrown *fatal* error is not acceptable.)

- [ ] **Step 4: Commit**

```bash
git add scripts/send-invoice-reminders.ts package.json
git commit -m "feat: add send-invoice-reminders script entrypoint for Task Scheduler"
```

---

### Task 6: Admin API route for threshold settings

**Files:**
- Create: `app/api/admin/config-cobranza/route.ts`
- Test: `__tests__/integration/admin-config-cobranza.integration.test.ts`

**Interfaces:**
- Consumes: `getSessionFromRequest` (`lib/inventory/access.ts`, existing), `getDb()`, `invoiceReminderSettings` (Task 1).
- Produces: `GET /api/admin/config-cobranza` → `{ id, thresholdDays }`; `PATCH /api/admin/config-cobranza` body `{ thresholdDays: number }` → `{ ok: true }` — consumed by Task 7 (admin page client component).

- [ ] **Step 1: Write the failing test**

Create `__tests__/integration/admin-config-cobranza.integration.test.ts`:

```typescript
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, invoiceReminderSettings } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { GET as getSettings, PATCH as patchSettings } from '@/app/api/admin/config-cobranza/route';

function buildRequest(token: string | null, init: { method: string; body?: string }): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `session=${token}`;
  return new NextRequest('http://localhost:3000/api/admin/config-cobranza', { method: init.method, body: init.body, headers });
}

function resetDb() {
  const db = getDb();
  db.delete(invoiceReminderSettings).run();
  db.delete(users).run();
  db.insert(invoiceReminderSettings).values({ thresholdDays: 3 }).run();
}

describe('admin config-cobranza API', () => {
  beforeEach(() => {
    resetDb();
  });

  test('no session cookie gets 401 on GET', async () => {
    const response = await getSettings(buildRequest(null, { method: 'GET' }));
    expect(response.status).toBe(401);
  });

  test('non-admin gets 403 on GET', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'user-cobranza@x.com', name: 'User', passwordHash: 'x', role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'User' });

    const response = await getSettings(buildRequest(token, { method: 'GET' }));
    expect(response.status).toBe(403);
  });

  test('admin can read the current threshold', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin-cobranza@x.com', name: 'Admin', passwordHash: 'x', role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const response = await getSettings(buildRequest(token, { method: 'GET' }));
    expect(response.status).toBe(200);
    const body = await response.json() as { thresholdDays: number };
    expect(body.thresholdDays).toBe(3);
  });

  test('admin can update the threshold', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin-cobranza2@x.com', name: 'Admin', passwordHash: 'x', role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const patchResponse = await patchSettings(buildRequest(token, {
      method: 'PATCH', body: JSON.stringify({ thresholdDays: 5 }),
    }));
    expect(patchResponse.status).toBe(200);

    const row = db.select().from(invoiceReminderSettings).get();
    expect(row?.thresholdDays).toBe(5);
  });

  test('non-admin gets 403 on PATCH', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'user-cobranza2@x.com', name: 'User', passwordHash: 'x', role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'User' });

    const response = await patchSettings(buildRequest(token, {
      method: 'PATCH', body: JSON.stringify({ thresholdDays: 5 }),
    }));
    expect(response.status).toBe(403);
  });

  test('rejects a non-positive thresholdDays', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin-cobranza3@x.com', name: 'Admin', passwordHash: 'x', role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const response = await patchSettings(buildRequest(token, {
      method: 'PATCH', body: JSON.stringify({ thresholdDays: 0 }),
    }));
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test __tests__/integration/admin-config-cobranza.integration.test.ts`
Expected: FAIL — `app/api/admin/config-cobranza/route.ts` does not exist.

- [ ] **Step 3: Write `app/api/admin/config-cobranza/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { invoiceReminderSettings } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return { error: 'No autorizado', status: 401 } as const;
  if (session.role !== 'admin') return { error: 'Prohibido', status: 403 } as const;
  return { session };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getDb();
  const row = db.select().from(invoiceReminderSettings).get();
  return NextResponse.json(row ?? { id: 0, thresholdDays: 3 });
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || typeof body.thresholdDays !== 'number' || body.thresholdDays <= 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const db = getDb();
    const row = db.select().from(invoiceReminderSettings).get();
    if (!row) return NextResponse.json({ error: 'Error interno' }, { status: 500 });

    db.update(invoiceReminderSettings).set({ thresholdDays: body.thresholdDays })
      .where((await import('drizzle-orm')).eq(invoiceReminderSettings.id, row.id)).run();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Fix the dynamic `eq` import (avoid runtime dynamic import — use a static import instead)**

Replace the `PATCH` function's `where` clause and the top import block so `eq` is statically imported, matching the pattern in `app/api/admin/inventory-settings/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { invoiceReminderSettings } from '@/lib/db/schema';
```

and:

```typescript
    db.update(invoiceReminderSettings).set({ thresholdDays: body.thresholdDays })
      .where(eq(invoiceReminderSettings.id, row.id)).run();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test __tests__/integration/admin-config-cobranza.integration.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/config-cobranza/route.ts __tests__/integration/admin-config-cobranza.integration.test.ts
git commit -m "feat: add admin API route for invoice reminder threshold settings"
```

---

### Task 7: Admin settings page + nav link

**Files:**
- Create: `app/(app)/admin/config-cobranza/page.tsx`
- Create: `app/(app)/admin/config-cobranza/config-client.tsx`
- Modify: `components/sidebar.tsx`

**Interfaces:**
- Consumes: `getSession()` (`lib/auth/get-session.ts`), `getDb()`, `invoiceReminderSettings` (Task 1), `GET`/`PATCH /api/admin/config-cobranza` (Task 6).
- Produces: the `/admin/config-cobranza` page — no further consumers within this plan (this is the last task).

- [ ] **Step 1: Write `app/(app)/admin/config-cobranza/page.tsx`**

```typescript
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { invoiceReminderSettings } from '@/lib/db/schema';
import { ConfigCobranzaClient } from './config-client';

export default async function ConfigCobranzaPage() {
  const session = await getSession();
  if (!session)                 redirect('/login');
  if (session.role !== 'admin') redirect('/reports/ventas');

  const db = getDb();
  const settingsRow = db.select().from(invoiceReminderSettings).get();

  return (
    <ConfigCobranzaClient
      initialSettings={settingsRow ?? { id: 0, thresholdDays: 3 }}
    />
  );
}
```

- [ ] **Step 2: Write `app/(app)/admin/config-cobranza/config-client.tsx`**

```typescript
'use client';

import { useState } from 'react';

interface Settings {
  id:            number;
  thresholdDays: number;
}

interface Props {
  initialSettings: Settings;
}

export function ConfigCobranzaClient({ initialSettings }: Props) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [error, setError]       = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const inputClass = `w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500`;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/config-cobranza', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ thresholdDays: settings.thresholdDays }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
      } else {
        setSaved(true);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Configuración de Cobranza</h1>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Recordatorios de facturas</h2>
        <div className="flex gap-6 items-start">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Días de anticipación
            </label>
            <input
              type="number"
              min={1}
              value={settings.thresholdDays}
              onChange={e => setSettings(s => ({ ...s, thresholdDays: parseInt(e.target.value, 10) || 0 }))}
              className={`${inputClass} w-32`}
            />
            <p className="text-xs text-gray-500 mt-1 max-w-64">
              Cuántos días antes del vencimiento se incluye una factura en el
              recordatorio diario por correo. Ej.: 3.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          {saved && <span className="text-sm text-green-600 self-center">Guardado</span>}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Add the nav link in `components/sidebar.tsx`**

Find the admin section (around line 98-110) and change:

```typescript
            <Link href="/admin/config-inventario" className={navClass('/admin/config-inventario')}>
              Config. Inventario
            </Link>
          </>
        )}
```

to:

```typescript
            <Link href="/admin/config-inventario" className={navClass('/admin/config-inventario')}>
              Config. Inventario
            </Link>
            <Link href="/admin/config-cobranza" className={navClass('/admin/config-cobranza')}>
              Config. Cobranza
            </Link>
          </>
        )}
```

- [ ] **Step 4: Manually verify the page renders**

Run: `bun dev` (in background or a separate terminal), then log in as an admin user and navigate to `http://localhost:3000/admin/config-cobranza`.
Expected: page loads, shows "Días de anticipación" with the current value (3), "Config. Cobranza" link visible in the sidebar under Admin, and clicking Guardar after changing the value persists it (reload the page to confirm the new value sticks).

- [ ] **Step 5: Run the full test suite to confirm nothing regressed**

Run: `bun run test:unit`
Expected: PASS, no failures introduced by the nav change or new page.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/admin/config-cobranza" components/sidebar.tsx
git commit -m "feat: add admin config-cobranza settings page and nav link"
```

---

## Final Verification

- [ ] **Run the full unit + integration suite**

Run: `bun run test:unit && bun test --isolate --env-file=.env.local --timeout 30000 __tests__/integration/invoice-reminder-repository.integration.test.ts __tests__/integration/admin-config-cobranza.integration.test.ts lib/invoice-reminders/`
Expected: all PASS.

- [ ] **End-to-end manual smoke test**

With `profitplus-erp-mock` running and a valid (or dummy) SMTP configured in `.env.local`:
Run: `bun --env-file=.env.local run send-invoice-reminders`
Expected: summary line with `total` reflecting real mock-ERP customers who have both an email on file and an invoice due within the configured threshold; check `data/exporter.db`'s `invoice_reminder_log` table has one row per attempted customer for today's `run_date`.
