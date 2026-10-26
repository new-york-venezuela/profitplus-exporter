# Customer receivables statement (Estado de cuenta) — design

## Intent

The business regularly sends customers with accumulated debt a statement of
what they owe. Today that is assembled by hand. This feature produces it
as a PDF, in two ways:

1. **UI**: pick one customer, download their statement.
2. **CLI**: generate one PDF per customer with an open balance, into a folder.

The customer reads it to understand exactly what is missing: which documents
are unpaid, how overdue each is, what credits/payments already reduce the
balance, and the total, in both BSD and USD.

## Goals

- One PDF per customer, in **Spanish**, with company name and **logo** (logo
  file supplied later by the owner; the code must work without it and pick it up
  from a configured path, e.g. `public/statement-logo.png`).
- **Open items only** ("what's pending payment"), not a movement history.
- Rows: every `saDocumentoVenta` row of the customer with `anulado = 0` and
  `saldo <> 0`:
  - `FACT` and `N/DB` = debt (positive).
  - `N/CR` / `NCR` with `saldo > 0` = unapplied credit (shown negative).
  - Any other open type (e.g. unapplied `ANT`/`COBR` payments/advances) shown as
    a reducing row too; the builder confirms the sign convention against the
    live data with `common_queries/ar_aging_bucket_audit.sql`-style checks.
- Table columns: document type, number, issue date, due date (`fec_venc`),
  days overdue, open amount BSD, rate used, open amount USD.
- **Aging summary** at the top, with totals in BSD and USD. Buckets (the
  designer's call): Por vencer, 1–30, 31–60, 61–90, +90 days past `fec_venc`.
  Credits are listed in their own line and netted in the grand total.
- Totals: sum of the row values (BSD sum, USD sum). The USD total is the sum
  of the per-row USD figures, not total BSD divided by one rate.

## Currency rule (decided by the owner — do not "simplify")

Profit stores every amount in BSD. `saDocumentoVenta.tasa` / `co_mone` describe
how a USD document was originally expressed, but for a BSD document `tasa = 1`,
so the row's own `tasa` can never be used to derive USD.

- **BSD amount** = `saldo` as stored.
- **USD amount** = `saldo` ÷ the `saTasa` USD rate (`co_mone = 'USD'`, `tasa_v`)
  **on the document's issue date** (`fec_emis`; the latest `saTasa.fecha <=
  fec_emis`, as in `lib/costing/currency.ts`'s as-of lookup). This applies to
  every document regardless of its `co_mone`; the row's own `tasa` column is
  never used.
- Each row displays the rate it used. If no rate exists on/before the issue
  date, the USD cell shows "Sin tasa", never `0` or a silent fallback, and the
  total flags the statement as incomplete (same spirit as the "Sin datos" rule
  in the recipes module).
- Do **not** follow the `d.saldo / NULLIF(d.tasa,0)` recipe in the Profit KB.

The rate lookup should be one set-based query/join for all of a customer's
documents (and a cached per-date map in the CLI), not one query per row.

## Delivery

### UI
- New page `app/(app)/estados-de-cuenta/` with a customer picker
  (`SearchableSelect`, per AGENTS.md since the customer list is large) and a
  "Descargar PDF" button.
- API: `GET /api/statements/[co_cli]` returns `application/pdf` with
  `Content-Disposition: attachment`. Errors use `{ error: string }`.
- 404 style behaviour for unknown customer; a customer with no open balance
  still returns a statement showing a zero balance (UI use is deliberate),
  only the CLI skips them.

### CLI
- `bun run statements:export --out <folder>` (script `scripts/export-statements.ts`,
  modelled on `scripts/send-invoice-reminders.ts`: own pool, exit non-zero on
  failure, summary line).
- Exports **every customer with an open balance** (at least one open row
  per the rule above), **one PDF each**.
- File name `<co_cli>-<sanitized name>.pdf` (builder's call; must be
  filesystem-safe and stable so re-runs overwrite).
- Statement date is "now"; printed on the PDF. A failure on one customer is
  logged and does not stop the batch, but makes the exit code non-zero.
- Read-only against the ERP.

## Constraints

- Reads the ERP live and read-only (no writes, no stored/derived tables), same
  discipline as the rest of the app. Uses `getPool()` and `.input()` for every
  parameter; ERP collation needs no special handling because nothing joins to
  the DWH.
- Trim `char`-padded values (`lib/trim-strings.ts`).
- Lightweight PDF library, no headless browser (owner's choice). The builder
  picks it; `pdfkit` is the author's suggestion. It must run under Bun, embed
  or use fonts supporting Spanish accents and `ñ`, and handle tables that
  paginate with a repeated header and a page footer.
- No `middleware.ts` exists: page and API each enforce access independently.
  Access gate: a new `'statements'` module following "Adding a new module" in
  AGENTS.md (the author's default; reusing `'dwh'` is the alternative).
- AGENTS.md should get a short "Estados de cuenta" section and the directory
  map entries.

## Non-goals / anti-goals

- No emailing or scheduling (the CLI only writes files).
- No movement history, no payment-application detail.
- No writes to the ERP or SQLite (beyond the module grant).
- Anti-goal: a number that looks plausible but is wrong. Wrong USD from
  using the row's `tasa`, or a missing rate shown as `0`, is a failure even if
  the PDF renders.

## Left to the builder

Library choice, layout and typography, aging bucket boundaries tweaks,
file naming, code structure (suggested: `lib/statements/` with a pure
`buildStatement(rows, rates, asOf)` that is unit-tested, a SQL repo file, and
a PDF renderer), test strategy (pure unit tests for builder/aging/rates; a
render smoke test).

## Verified against the ERP data (2026-10-26, local copy; re-check on production)

Open rows (`anulado = 0`, `saldo <> 0`) by type and `co_mone`:

- `saldo` is **always stored positive**, whatever the type. The sign comes from
  the type, not from the number.
- Types seen: `FACT` (debt), `N/CR` (unapplied credit), `ADEL` (customer
  advance, unapplied; reduces the balance). No `N/DB` in this copy, but it is debt
  per the KB.
- `co_mone` is not clean in the local copy: `BS`, `BSD`, `US$` and `USD` all
  occur. The owner says only USD and BSD are real (`US$` is the same dollars,
  likely fixed in the last migration), so the builder should not special-case
  the stray codes. This is one more reason the USD figure never depends on `co_mone`/`tasa`. USD-expressed
  documents have `tasa` between ~443 and ~876, BSD ones have `tasa = 1`,
  consistent with the currency rule above.
- `fec_venc` is never NULL on open rows; guard anyway.

Sign mapping: debt = `FACT`, `N/DB`; reducing = `N/CR`, `NCR`, `ADEL`, plus any
other unknown type. An unknown type must not be silently treated as debt: render
it as a reducing row labelled with its raw code and log a warning, so a human
notices.

## Calls made while reviewing (author's decisions, not the owner's)

- **Reducing rows (credits, advances) USD**: same rule as every row, `saldo` ÷
  `saTasa` rate on that row's own `fec_emis`. Shown as negative in both columns.
- **Aging buckets**: debt rows only. Reducing rows are listed in a separate
  "Créditos y anticipos" line (BSD and USD) and subtracted in the grand total.
  Days overdue = statement date minus `fec_venc` in calendar days (date-only).
  "Por vencer" = `fec_venc >= statement date`; bucket 1–30 = 1..30 days late.
  Reducing rows show "—" for days overdue.
- **Rate lookup**: `tasa_v` (Bs per USD), latest `saTasa.fecha <=` end of the
  issue day, USD only; reuse the logic of `getUsdRateAsOf` but in a set-based form.
- **"Sin tasa" row**: its USD cell is excluded from the USD total, the statement
  carries a visible "incompleto" note, and the CLI logs it.
- **Which customers the CLI exports**: net balance (debt minus reducing rows) in
  BSD is greater than zero. Customers whose credits cover their debt owe nothing and get
  no statement; inactive customers with debt are included. The UI picker lists
  all customers and shows a zero-balance statement on demand.
- **Company name**: `par_emp.emp_nom`; logo from the configured file path, absent = name only.
- **Module**: a new `'statements'` module (page and API each gate it
  independently).
- **Customer header**: name, code, and RIF/address from `saCliente` when present.
