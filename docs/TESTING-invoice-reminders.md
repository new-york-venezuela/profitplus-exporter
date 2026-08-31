# Testing Guide — Invoice Reminder Emails

Covers everything shipped in the invoice-reminder-emails feature (commits
`29130c8`…`8264b26` merged into `main`) plus the follow-up UX fixes on top
(threshold validation, currency formatting, last-run panel). Three layers:
automated tests, manual UI walkthrough, and a real end-to-end email send
against the mock ERP.

## 0. What you're testing

A daily job (`bun run send-invoice-reminders`) queries `saDocumentoVenta`
for invoices due soon/today/overdue, groups them per customer, and emails
each customer a digest via `saCliente.email`. Admins configure the
lead-time threshold and see the last run's outcome at
`/admin/config-cobranza`.

| Piece | File |
|---|---|
| Threshold + run-log tables | `lib/db/schema.ts` (`invoiceReminderSettings`, `invoiceReminderLog`) |
| ERP query | `lib/invoice-reminders/repository.ts` |
| Orchestration | `lib/invoice-reminders/reminder-service.ts` |
| Email template | `lib/email/templates/invoice-reminder.hbs` |
| Entrypoint | `scripts/send-invoice-reminders.ts` |
| Admin settings page | `app/(app)/admin/config-cobranza/` |
| Admin settings API | `app/api/admin/config-cobranza/route.ts` |

## 1. Automated tests (fastest — run these first)

```bash
bunx tsc --noEmit                                    # typecheck, should be clean

bun test --isolate --env-file=.env.local \
  lib/invoice-reminders \
  lib/services/email-service.test.ts \
  __tests__/integration/admin-config-cobranza.integration.test.ts \
  __tests__/integration/invoice-reminder-repository.integration.test.ts
```

Expect all green. The two `__tests__/integration/*` files need the mock
ERP container running (§4) — `invoice-reminder-repository.integration.test.ts`
hits real `saDocumentoVenta`/`saCliente` tables.

Full unit suite (everything else in the app, sanity check you didn't break
something unrelated):

```bash
bun run test:unit
```

`scripts/dwh/__tests__/*` will fail unless `DW_NAME` DWH infra is set up —
that's pre-existing and unrelated to this feature, ignore those.

## 2. E2E: admin settings UI (`/admin/config-cobranza`)

```bash
bun run e2e:seed
bun run e2e -- config-cobranza.spec.ts
```

This spec (`e2e/config-cobranza.spec.ts`) drives a real browser against a
production build and covers:

- non-admin redirected away from the page
- sidebar "Config. Cobranza" link navigates there
- default threshold (3) loads
- editing + saving persists across reload
- rejects `0` and rejects `>60` with a visible error, doesn't persist either
- "Guardado" confirmation clears once you touch the field again
- "Última ejecución" panel shows the empty state when the job has never run

### Manual walkthrough (same page, by hand)

```bash
bun run dev
```

1. Log in as an admin user, go to **Admin → Config. Cobranza**.
2. Confirm the "Días de anticipación" field shows the current threshold and
   the "Última ejecución" panel reflects reality (empty state if the job
   has never run in this DB; sent/failed counts if it has — see §3 to
   generate a real run).
3. Change the value, click **Guardar** — "Guardado" appears next to the
   button. Edit the field again without saving — "Guardado" should
   disappear immediately.
4. Reload the page — your saved value should still be there.
5. Try `0` and try `9999` — both should show a red validation message
   ("Ingresa un número entre 1 y 60") and *not* change the persisted value
   (reload to confirm).

## 3. E2E: full suite regression check

```bash
bun run e2e
```

Everything should pass except two pre-existing, unrelated gaps in this
environment:

- `password-reset.spec.ts` (3 tests) — needs Mailhog running locally (§4.3)
- `admin-users.spec.ts` → "admin can grant and revoke the inventory module"
  — documented flaky race under parallel workers, unrelated to this feature

## 4. Manual end-to-end: actually send a reminder email

This is the only way to see the real `.hbs` template rendered with real
data (currency formatting, total line, overdue/due-today/due-soon
sections) — none of the automated tests render the final HTML end-to-end
with live-formatted numbers.

### 4.1 Start the mock ERP

```bash
cd docker
docker-compose up -d
bash init-db.sh        # first time only, or after a volume reset
cd ..
```

Confirm `.env.local` points at it (`DB_SERVER`, `DB_NAME`, etc. — already
configured for the mock container per `docker/README.md`).

### 4.2 Seed a customer + overdue/due-soon invoices

The mock ERP's sample data may or may not already have `saCliente` rows
with a real `email` and matching `saDocumentoVenta` rows with `fec_venc`
near today. Check first:

```sql
SELECT TOP 5 d.co_cli, c.email, d.nro_doc, d.fec_venc, d.saldo, d.co_tipo_doc, d.anulado
FROM saDocumentoVenta d
JOIN saCliente c ON c.co_cli = d.co_cli
WHERE d.anulado = 0 AND d.saldo > 0 AND c.email IS NOT NULL
ORDER BY d.fec_venc;
```

If nothing comes back within your configured threshold, insert or update a
test row so at least one invoice's `fec_venc` falls within the threshold
window (today, a few days out, and a few days overdue — one of each is the
best coverage) and that customer's `saCliente.email` is set to an address
you control (or to Mailhog — any address works, Mailhog catches all local
SMTP regardless of recipient).

### 4.3 Start Mailhog and set the threshold

```bash
docker run --rm -d -p 1025:1025 -p 8025:8025 --name e2e-mailhog mailhog/mailhog
```

Confirm `.env.local`'s `SMTP_HOST=localhost` / `SMTP_PORT=1025` point at
it (matches `.env.test`'s values — copy those into `.env.local` if not
already set for local dev).

Set the threshold via the admin UI (§2) or directly:

```bash
sqlite3 ./data/exporter.db "UPDATE invoice_reminder_settings SET threshold_days = 3;"
```

### 4.4 Run the job

```bash
bun run send-invoice-reminders
```

Expect console output like:
```
[send-invoice-reminders] <timestamp> — sent=1 failed=0 total=1
```

The process should exit cleanly (`echo $?` → `0`) — it does not hang, per
the `pool.close()` + `process.exit(0)` fix in `c7d3d35`/the final fix wave.

### 4.5 Verify the email

Open `http://localhost:8025` (Mailhog UI) and check:

- Subject/sender look right (from `EmailService`'s `'invoice-reminder'`
  entry)
- Customer name (`cliDes`) appears in the greeting
- Each bucket present in your test data (Vencidas / Vencen hoy / Vence
  pronto) renders with the right color coding and correct row counts
- **Amounts use Venezuelan formatting**: `1.234,50`, not `1234.50` or
  `1,234.50`
- **A "Total adeudado: X Bs / Y USD" line appears**, summing across all
  three buckets — verify the math by hand against the rows shown
- Days overdue (`diasVencido`) only shows in the Vencidas section and is a
  sane positive integer

### 4.6 Verify the log + admin panel

```bash
sqlite3 ./data/exporter.db "SELECT * FROM invoice_reminder_log ORDER BY sent_at DESC LIMIT 5;"
```

Then reload `/admin/config-cobranza` — the "Última ejecución" panel should
now show today's date, a time, and "N enviados" (plus "M fallidos" if any
failed).

### 4.7 Failure isolation (optional but worth doing once)

Point one customer's `saCliente.email` at something that will bounce
against Mailhog (or temporarily stop the Mailhog container mid-run for one
customer) — confirm the job logs that customer as `failed` with an
`error_message`, continues to the rest, and still exits `0`.

### 4.8 Clean up

```bash
docker stop e2e-mailhog
cd docker && docker-compose down   # only if you're done with the mock ERP entirely
```

## 5. Known, deliberately-unfixed gaps

Worth knowing about before you sign off, not necessarily worth blocking on:

- **Unconfirmed against real production data**: the CxC filter is
  `co_tipo_doc NOT IN ('N/CR', 'NCR')` (blocklist), not an explicit
  allowlist of `FACT`/`N/DB`. If production ever has other document types
  (`COBR`/`ANT`/`CHEQ`, etc.) carrying a positive `saldo`, they'd be
  wrongly counted as debt. Run against real prod data before fully
  trusting the feature (query in the design spec's open-items section).
- No unsubscribe/dispute contact link in the email itself.
- No `<form>`/Enter-to-submit on the settings page (click-only).
- Overdue rows aren't visually tiered by severity (1 day overdue looks
  identical to 90 days overdue).
