# Deploying: Depth of Line, Consignment Exclusion, Seller Coverage, Cadencia

**Date:** 2026-09-22
**Branch:** merged to `main` at `60158b3`

This covers everything needed to install and run the four analytics
features added in this batch of work:

1. **Depth of Line** (Profundidad de Línea tab) — per-customer product-line
   tier matrix and gap drill-down.
2. **Seller × Depth-of-Line Coverage** — seller-scoped leaderboard showing
   which sellers' customers are covering which tiers.
3. **Consignment Commission Exclusion** — flags consignment-pattern
   invoices and excludes them from seller commission totals in the
   Vendedores tab.
4. **Active Customer Visit Cadence** (Cadencia tab) — purchase-frequency
   gap tracking against per-segment/per-entity visit targets.

All four ship inside the existing `/analitica` dashboard (gated by the
`dwh` module — see `lib/dwh/access.ts`). No new module, no new page route,
no new environment variables.

## 1. Pull and install

```bash
git checkout main
git pull
bun install
```

Nothing new in `package.json` dependencies — no `bun install` surprises
expected, this step is just the usual one.

## 2. Apply the two new DWH migrations

Two new files landed in `dwh-migrations/`, both fixing real bugs found
during implementation and review:

- **`0031_resolve_customer_segment_name.sql`** — `Load_Dim_Customer` was
  writing `Dim_Customer.SegmentCode` as the raw ERP code (`'46'`,
  `'0023'`) instead of resolving it through `saSegmento.seg_des` to the
  human-readable name (`'CADENA'`, `'INDEPENDIENTES'`). The Depth of Line
  tab groups by segment name, so this had to be fixed before that tab's
  numbers would mean anything.
- **`0032_backfill_legalentitykey_noncurrent.sql`** — `Load_Dim_LegalEntity`
  only ever back-filled `Dim_Customer.LegalEntityKey` on `IsCurrent = 1`
  rows. Any `Fact_Sales` row pointing at a now-historical (SCD2-versioned)
  customer row kept a `NULL` `LegalEntityKey` forever, silently dropping
  out of every entity-grain query — including the consignment-exclusion
  denominator, where it understated `TotalSales` and could wrongly flag a
  legal entity as a consignment pattern.

Run the standard DWH migration runner — it's idempotent, tracked in
`dwh.__dwh_migrations`, and safe to run against a database that already
has 0001–0030 applied:

```bash
bun run migrate:dwh
```

Confirm both applied:

```bash
sqlcmd -S <DW_SERVER> -d DWH_AlimentosNY -Q "SELECT TOP 5 * FROM dwh.__dwh_migrations ORDER BY id DESC"
```
(or whatever DWH client you normally use — the point is just to see
`0031_...` and `0032_...` in the tail of that table)

**Load procedures then need to run once** so the corrected `SegmentCode`
and `LegalEntityKey` values actually populate existing rows — the
migration only redefines the procedures, it doesn't re-run them:

```bash
bun run <your existing DWH load/refresh command — see dwh-migrations/README.md>
```

## 3. Apply the new SQLite migration

One new local-auth-DB table, `visit_cadence_targets`, holds the
per-segment/per-entity visit cadence overrides used by the Cadencia tab:

```bash
bun run migrate
```

This runs `drizzle/migrations/0003_reflective_cable.sql` against
`SQLITE_PATH` (`data/exporter.db` by default). No new env var — same
`SQLITE_PATH` as always.

## 4. Build and start

```bash
bun run build
bun run start
```

(or `bun dev` for local iteration — same as always, no new dev-server
behavior).

## 5. Verify

Full verification already ran on `main` after merge:

- `bunx tsc --noEmit` — clean
- `bun run lint` — clean (0 errors)
- `bun run test:unit` — 382/382 pass

If you want to re-confirm after applying migrations on your own
environment:

```bash
bunx tsc --noEmit
bun run lint
bun run test:unit
```

For end-to-end coverage of these four features specifically:

```bash
bun run e2e          # default suite — includes cadencia.spec.ts,
                      # profundidad-linea.spec.ts,
                      # profundidad-linea-vendedor.spec.ts,
                      # vendedores-consignment.spec.ts
```

The `@mssql`-tagged specs (inventory suite, unrelated to this batch) need
real ERP/DWH infra and run separately via `bun run e2e:mssql` — not
required to validate this batch of work, which is covered by the default
suite.

**Note:** the e2e suite's `reset-flow@e2e.test` account has its password
mutated by `password-reset.spec.ts`'s full-flow test and isn't reset
afterward. If you re-run the suite and see login failures for that
account, reseed:

```bash
SQLITE_PATH=./e2e/.tmp bun run e2e:seed
```

## 6. What to look at in the UI

Log in as a user with the `dwh` module grant (or an admin — admins bypass
every module gate) and go to `/analitica`:

- **Profundidad de Línea tab** — customer × product-line tier matrix, gap
  drill-down, and (new) the seller coverage leaderboard + filter.
- **Vendedores tab** — commission totals now show a footnote when
  consignment-pattern invoices were excluded from a seller's total.
- **Cadencia tab** (new) — purchase-frequency gaps per active customer
  against segment/entity visit targets, with an overdue badge for
  customers past their target window.

## Rollback

All four features are additive — no existing route, table, or procedure
was removed or renamed. If something needs to be rolled back:

- The two DWH migrations (`0031`, `0032`) are `CREATE OR ALTER PROCEDURE`
  redefinitions plus one backfill `UPDATE` — there's no automatic
  down-migration. Reverting the procedure logic would mean manually
  restoring the prior `Load_Dim_Customer`/`Load_Dim_LegalEntity` bodies
  from git history (`dwh-migrations/0005_*.sql`,
  `dwh-migrations/0014_dim_legal_entity.sql`, etc.) — the backfilled data
  itself is harmless to leave in place even if you do that.
- The SQLite `visit_cadence_targets` table can be dropped without
  affecting anything else (`DROP TABLE visit_cadence_targets;`) — nothing
  else references it.
- Reverting the `app/`/`lib/` code is a normal `git revert` of the merge
  range; no data migration is coupled to the app code itself.
