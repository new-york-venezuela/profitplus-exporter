# E2E Playwright Testing + PR Validation Workflow

## Goal

Give this app end-to-end test coverage of its user-facing flows using
Playwright, following best practice of testing behavior rather than
implementation, and gate merges to `main` on a PR workflow that runs
lint, typecheck, unit/integration tests, and the e2e suite.

## Context

The app (`kigali-scaffold` / ProfitPlus Exporter) is a Next.js 16 App
Router app with two data stores: SQLite (Drizzle) for user accounts/auth,
and a remote SQL Server ERP for report data. There is currently:

- No Playwright installed, no `e2e/` directory.
- No GitHub Actions workflows (`.github/workflows/` exists but is empty).
- Existing `bun test` unit/integration tests under `__tests__/`, one of
  which (`compras-export.integration.test.ts`) calls the real MSSQL pool
  with no mock, so it cannot run without the SQL Server mock reachable.
- A dockerized mock ERP (`docker/docker-compose.yml`, seeded via
  `docker/mssql/init.sql` + `data.sql`) that is **not** to be added to
  CI — it's heavy, and stays run-on-demand locally.

Commit history and route exploration surfaced these user-facing features:

| Feature | Routes | Notes |
|---|---|---|
| Login | `/login`, `POST /api/auth/login` | JWT cookie session |
| Logout | `POST /api/auth/logout` | |
| Forgot/reset password | `/forgot-password`, `/password-reset`, `POST /api/auth/password-reset-request`, `GET/POST /api/auth/password-reset/[token]`, `POST /api/auth/password-reset/verify` | Sends real email via nodemailer/SMTP |
| Admin user management | `/admin/users`, `/api/admin/users*` | Create/list/delete users, admin-triggered password reset. Role-gated. |
| Profile | `/profile` | View own name/email |
| Reports (ventas/compras) | `/reports/ventas`, `/reports/compras`, `/api/reports/[report]/{preview,export}` | Date range, column toggling, selectors, xlsx/csv export. Needs live MSSQL data. |
| Firmas (signature generator) | `/firmas` | Pure client-side, no backend calls, clipboard API |

Middleware (`middleware.ts`) is an Edge Runtime JWT guard protecting all
routes except `/login` and `/api/auth/*`.

## Approach

Single Playwright project (chromium only — this is an internal tool, not
a cross-browser product) against `bun dev`, using two tiers of specs:

1. **Default tier** — everything not touching the MSSQL ERP. Runs in CI
   on every PR. Depends only on the seedable SQLite auth DB and a
   Mailhog SMTP catcher.
2. **`@mssql` tier** — `reports.spec.ts`, tagged in test titles with
   `@mssql`. Excluded from the default CI run via
   `--grep-invert @mssql`. Run locally on demand once the developer has
   brought up `docker/docker-compose.yml` themselves.

This mirrors the same split already implicit in `bun test`
(`compras-export.integration.test.ts` also needs live MSSQL) — so the
convention is consistent across both unit and e2e layers rather than
inventing a second mechanism.

### Why tag+grep over a separate Playwright `project`

A second `project` entry would still need `testMatch`/`testIgnore`
wiring and duplicates the same exclusion logic. A title tag + one CLI
flag is the smallest mechanism that satisfies "excluded by default, one
flag away for the developer who has the mock ERP running."

## Test Data Setup

**SQLite (default tier):** a new `scripts/e2e-seed.ts`, structurally
similar to `scripts/seed.ts` but non-interactive, creates a fresh SQLite
file (path from `SQLITE_PATH_E2E` or a fixed `data/e2e-test.db`) with:
- one admin user (known email/password)
- one regular user (known email/password)

The e2e run points `SQLITE_PATH` at this file via env override in
`playwright.config.ts`'s `webServer.env`. The file is deleted and
recreated at the start of each e2e run (idempotent, gitignored).

**MSSQL (`@mssql` tier):** relies on the developer having already run
`docker compose -f docker/docker-compose.yml up -d`, which seeds via the
existing `init.sql`/`data.sql`. No changes needed to that setup — e2e
tests in this tier just assume it's reachable and skip/fail clearly if
not.

**Email (default tier):** Mailhog, run as a GitHub Actions `services:`
container in CI (`mailhog/mailhog` image, SMTP on 1025, HTTP API on
8025) — not added to `docker-compose.yml` since it's unrelated to the
MSSQL mock and needs to be available without opting into the heavy
stack. Locally, developers run it themselves (`docker run
mailhog/mailhog`) documented in AGENT.md. Tests that need to observe a
sent email poll Mailhog's HTTP API (`GET /api/v2/messages`) to fetch the
reset link/token out of the email body, then navigate to it — this
exercises the real send path instead of stubbing nodemailer, which is
already what the unit tests do (see
`password-reset-routes.integration.test.ts`), so e2e adds new coverage
rather than duplicating it.

`SMTP_HOST`/`SMTP_PORT` point at Mailhog for both the CI job and local
runs via `.env.test` (new file, gitignored, documented in AGENT.md;
`.env.example` gets a comment pointing to it).

## Structure

```
e2e/
  fixtures.ts             # authenticated-page fixture: logs in via UI once,
                           # reuses storageState across tests in a file
  helpers/mailhog.ts       # pollForEmail(to: string): fetches + parses latest
                           # Mailhog message, extracts reset link
  auth.spec.ts             # login success/failure, logout, middleware redirect
  password-reset.spec.ts   # forgot-password → email → reset → login w/ new pw;
                           # invalid/expired token states
  admin-users.spec.ts      # create/list/delete user, admin password reset,
                           # non-admin cannot access /admin/users
  profile.spec.ts          # view own name/email
  firmas.spec.ts           # form → live preview reflects input; copy buttons
                            # (clipboard mocked via page.context().grantPermissions)
  reports.spec.ts          # @mssql — date filter, column toggle, selector,
                            # preview table renders seeded rows, export
                            # triggers a download
playwright.config.ts
scripts/e2e-seed.ts
.env.test                  # gitignored; SMTP_HOST/PORT → mailhog, SQLITE_PATH → e2e db
```

`playwright.config.ts`:
- `testDir: './e2e'`
- `webServer`: `bun dev`, `url: 'http://localhost:3000'`, `reuseExistingServer: !process.env.CI`, env overrides for `SQLITE_PATH`/`SMTP_HOST`/`SMTP_PORT` sourced from `.env.test`
- `use.baseURL`, one `chromium` project
- `retries: 2` on CI only, matching Playwright's own recommended default

## Testing Philosophy (behavior, not implementation)

- Select elements via role/label/text (`getByRole`, `getByLabel`), never
  CSS classes or test-ids sprinkled into JSX — the app's Tailwind
  classes are styling, not a testing contract.
- Assert on visible outcomes: URL after login, error text shown, row
  appearing in the users table, download firing — not on internal state,
  fetch call counts, or component structure.
- One user-observable behavior per test; avoid mega-tests that walk
  the entire app in one `test()` block, so failures localize.
- The export button test asserts a download event with the expected
  filename/extension, not file contents — content correctness is
  already covered by unit tests in `__tests__/unit` and the (opt-in)
  `compras-export.integration.test.ts`. E2e's job here is "does
  clicking the button do the right thing," not "is the CSV byte-correct."

## CI Workflow

`.github/workflows/pr-checks.yml`, triggered on `pull_request` targeting
`main`:

```yaml
jobs:
  checks:
    steps:
      - checkout, setup bun
      - bun install
      - bun run lint
      - bunx tsc --noEmit
      - bun test:unit          # excludes compras-export.integration.test.ts
  e2e:
    services:
      mailhog: { image: mailhog/mailhog, ports: [1025, 8025] }
    steps:
      - checkout, setup bun
      - bun install
      - bunx playwright install --with-deps chromium
      - bun run e2e:seed
      - bun run e2e             # playwright test --grep-invert @mssql
      - upload playwright-report/ as artifact on failure
```

Two jobs (not one) so lint/typecheck/unit failures surface fast without
waiting on browser install + e2e run; both are required status checks
for merge (branch protection is a manual GitHub setting the user
applies separately — outside this repo's files).

## package.json additions

```json
"test:unit": "bun test --ignore __tests__/integration/compras-export.integration.test.ts",
"test:mssql": "bun test __tests__/integration/compras-export.integration.test.ts",
"e2e": "playwright test --grep-invert @mssql",
"e2e:mssql": "playwright test --grep @mssql",
"e2e:seed": "bun run scripts/e2e-seed.ts",
"e2e:ui": "playwright test --ui --grep-invert @mssql"
```

(Exact `bun test` exclusion flag to be verified against Bun's test
runner CLI during implementation — Bun's exclusion syntax may differ
from Jest's; if unsupported, fall back to a `--test-name-pattern`
inverse or moving the file to `__tests__/integration/mssql/` and
pointing `test:unit` at everything else via glob.)

## AGENT.md

New root-level file (distinct from `AGENTS.md`, which covers app
architecture) documenting, for whoever adds tests next:

- How to run e2e locally: `bun run e2e:seed && bun run e2e`
- What `@mssql` means, when to use it, how to bring up the docker mock
  and run `bun run e2e:mssql`
- Mailhog: how to run it locally, how `helpers/mailhog.ts` polls it
- The behavior-not-implementation rule with a short example
- Pattern for adding a new spec when a new feature ships (one file per
  route/flow, tag `@mssql` if it touches the ERP)
- What the PR workflow gates and where its config lives

## Error Handling / Edge Cases

- Mailhog unreachable in a local run (dev didn't start it): e2e tests
  using `pollForEmail` should fail with a clear timeout message, not
  hang indefinitely — bounded poll (e.g. 10s/500ms interval).
- `@mssql` tests run without docker-compose up: expect connection
  failures from `getPool()`; documented as expected/actionable in
  AGENT.md rather than special-cased in test code.
- e2e SQLite seed file must not collide with the developer's real local
  `data/app.db` — separate path, gitignored, recreated per run.

## Out of Scope

- Cross-browser testing (firefox/webkit) — internal tool, chromium only.
- Visual regression testing.
- Load/perf testing.
- Adding mssql/mailhog to `docker-compose.yml` (kept separate per
  earlier decision).
- Branch protection rule configuration on GitHub (user-side setting).
