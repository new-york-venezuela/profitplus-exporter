# AGENT.md — E2E Testing Guide

This file documents the Playwright e2e suite and PR workflow.

## Running e2e tests locally

```bash
bun run e2e:seed   # rebuilds e2e/.tmp/data/exporter.db with 3 fixed test users
bun run e2e        # runs everything except @mssql-tagged specs
bun run e2e:ui     # same, in Playwright's interactive UI mode
```

`bun run e2e` builds the app once (`next build --webpack`) and then serves
that production build (`next start`) for the whole run — it does **not**
run against `bun dev`/`next dev`. Dev mode compiles each route on its first
request, and under Playwright's parallel workers that on-demand compile
raced real tests badly enough to fail them outright (clicks landing before
React hydration attached its handlers, requests timing out mid-compile).
If you're debugging a spec interactively, `bun run e2e:ui` still runs
against the same production build — there's no faster "dev mode" path for
this suite, by design.

The SQLite path, JWT secret, SMTP target, etc. used during local e2e runs
come from `.env.test` (tracked in git — no real secrets in it), loaded by
`playwright.config.ts`'s `webServer.env`. This is separate from your local
`.env.local` — e2e runs never touch your real `data/app.db`. In CI, the
same variables come from a GitHub Environment instead (see below).

Seeded users (fixed, defined in `scripts/e2e-seed.ts`):

| Email | Password | Role |
|---|---|---|
| `admin@e2e.test` | `AdminPass123!` | admin |
| `user@e2e.test` | `UserPass123!` | user |
| `reset-flow@e2e.test` | `ResetFlowPass123!` | user |

`admin@e2e.test` and `user@e2e.test`'s passwords must stay stable across
the whole suite — only `reset-flow@e2e.test` is used by tests that change
a password (the full password-reset flow), and admin-triggered password
resets in `admin-users.spec.ts` create and target their own throwaway user
rather than touching any of the three fixed accounts. Follow this pattern
for new specs: if a test mutates auth state, either create a disposable
user in the test itself or use a dedicated fixed account — never mutate
`admin@e2e.test` or `user@e2e.test`.

## Email testing (Mailhog)

Specs that need to observe a sent email (currently just
`password-reset.spec.ts`) poll Mailhog's HTTP API via
`e2e/helpers/mailhog.ts`. Start Mailhog before running those tests
locally:

```bash
docker run --rm -d -p 1025:1025 -p 8025:8025 --name e2e-mailhog mailhog/mailhog
bun run e2e -- password-reset.spec.ts
docker stop e2e-mailhog
```

View caught mail in a browser at `http://localhost:8025` while it's
running. In CI, Mailhog runs as a GitHub Actions `services:` container
(see `.github/workflows/pr-checks.yml`) — no docker-compose involved.

Note on the reset-link regex in `mailhog.ts`: nodemailer sends the HTML
body quoted-printable encoded, which can soft-wrap a long `<a href="...">`
across lines (a bare `=` right before the line break) and Handlebars'
default escaping of `{{resetUrl}}` turns `?token=` into `?token&#x3D;`
inside the attribute. The helper unwraps soft line-breaks, decodes
quoted-printable `=XX` escapes, and decodes both `&#x3D;` and `&amp;`
before matching the `href` — if a new email template changes how its
link is rendered, re-verify against the raw Mailhog message body rather
than assuming the same regex still applies.

## Reliable form submission (`submitReliably`)

Every form in this app is a React-controlled `<form onSubmit>` with no
`action` and unnamed inputs. `e2e/fixtures.ts` exports
`submitReliably(page, fillAndClick)`, used by every spec that submits one
of these forms (login, forgot-password, password-reset). Even against a
production build, a click can in principle land before React has flushed
the state update from a preceding `.fill()`, or (rarer, mostly a dev-mode
concern) before its `onSubmit` handler is attached — both failure modes
leave a stray trailing `?` on the URL (a native form-submit fallback on
unnamed inputs). `submitReliably` retries the whole fill+click from
scratch whenever that shows up.

```typescript
await submitReliably(page, async () => {
  const field = page.getByLabel('Some Label');
  await field.fill('value');
  await expect(field).toHaveValue('value'); // confirms React's state committed
  await page.getByRole('button', { name: 'Submit' }).click();
});
```

Use it for any new spec that submits a `<form>` in this app. Buttons that
aren't inside a `<form>` (e.g. the admin users modal's Crear/Guardar
buttons, which are plain `onClick` handlers) don't need it — there's no
native-submit fallback for those to race into.

## The `@mssql` tag

`e2e/reports.spec.ts` covers `/reports/ventas` and `/reports/compras`,
which need the dockerized mock ERP (`docker/docker-compose.yml`) with real
query results. That stack is **intentionally excluded from CI** — it's
heavy, and we don't want to add multi-minute SQL Server container boots
(plus large seed/backup files) to every PR run.

Every test that depends on the mock ERP has `@mssql` in its title. This is
not a Playwright `project` or config option — it's a plain string in
`test()`'s name, filtered with `--grep`/`--grep-invert`. `bun run e2e`
uses `--grep-invert @mssql` (skips them); `bun run e2e:mssql` uses
`--grep @mssql` (runs only them). `reports.spec.ts` tags its `describe`
block (`describe('reports @mssql', ...)`) rather than every individual
`test()` — `--grep` matches on the full test title Playwright prints,
which includes the `describe` block name, so tagging the block covers
everything inside it in one place. Follow the same pattern for new
`@mssql` specs.

To run the `@mssql` tier locally:

```bash
docker compose -f docker/docker-compose.yml up -d
bash docker/init-db.sh   # loads schema + data — required, the container starts empty
# wait for MSSQL to be ready (first boot ~30-60s), then:
bun run e2e:mssql
docker compose -f docker/docker-compose.yml down
```

**Known local issue (as of this writing):** `docker-compose.yml` also
mounts `docker/mssql/Ncake_a.bak` (gitignored, not present by default),
which currently makes `docker compose up -d` fail outright unless that
file exists locally — `docker/README.md`'s actual init flow
(`init-db.sh` + `init.sql`/`data.sql`) never touches it, so it looks like
stale config. `reports.spec.ts` was written against the real column
config and seed data (`lib/reports/ventas.ts`, `docker/mssql/data.sql`)
but has not been run end-to-end against a live container — verify it
once this is sorted out, rather than trusting it blind.

## Testing philosophy: behavior, not implementation

- Select elements the way a user finds them: `getByRole`, `getByLabel`,
  `getByText`. Never select by CSS class or an added `data-testid` —
  this app's Tailwind classes are styling, not a testing contract, and
  should be free to change without breaking tests. A few pages had
  `<label>` elements with no `htmlFor`/`id` pairing their `<input>`,
  which `getByLabel()` can't resolve — fixed those associations directly
  in the app rather than falling back to a weaker selector (it's a real
  accessibility gap either way, not just a test problem).
- Assert on what the user would see: a URL change, a visible message,
  a row in a table, a triggered download — not on internal state,
  network call counts, or component structure.
- One user-observable behavior per `test()`. A test walking five
  unrelated things in one block makes failures hard to localize.
- Watch for accidental substring/multi-match ambiguity in role/text
  selectors. `getByRole('button', { name: 'Crear' })` without
  `exact: true` also matched a `"+ Crear usuario"` button elsewhere on
  the page (Playwright's default name matching is substring-based); a
  strict-mode violation like that is a real selector bug, not flakiness.
  Scope `getByText` to a landmark (e.g. `getByRole('main')`) when the
  same text legitimately appears twice on a page (a sidebar nav link and
  the page's own content, for example).
- Don't re-test what's already covered elsewhere. E2e's job is "does
  clicking the button do the right thing end to end," not re-proving
  correctness (e.g. exact export file contents) that unit/integration
  tests already cover.

## Adding e2e coverage for a new feature

1. One spec file per route or user flow, named after it:
   `e2e/<feature>.spec.ts`.
2. If it needs an authenticated user, import `test`/`expect` from
   `./fixtures` and use the `adminPage`/`userPage` fixtures rather than
   logging in by hand in every test.
3. If it submits a `<form onSubmit>`, use `submitReliably` (see above)
   rather than a bare `.fill()` + `.click()`.
4. If it touches the SQL Server ERP, tag the `describe` block (or every
   individual `test()` if there's no shared `describe`) with `@mssql`.
5. If it needs to observe an email, reuse `e2e/helpers/mailhog.ts`; add
   a new helper function there rather than duplicating the polling
   logic in the spec.
6. Run it locally (`bun run e2e -- <file>.spec.ts`, plus Mailhog/docker
   compose if tagged) before committing — the PR workflow will run the
   default tier automatically, but the `@mssql` tier never runs in CI,
   so it's on you to have verified it locally.

## What the PR workflow gates

`.github/workflows/pr-checks.yml` runs on every PR targeting `main`,
as two jobs:

- **`checks`** — `bun run lint`, `bunx tsc --noEmit`, `bun run test:unit`
  (this excludes `compras-export.integration.test.ts`, which — like
  `@mssql` e2e specs — needs the real MSSQL mock and is run on demand
  via `bun run test:mssql`, never in CI). `bun run lint` genuinely
  passes (0 errors) on a clean checkout — an earlier pass at this
  workflow assumed ~1600 pre-existing errors and dropped lint from the
  gate entirely, but that count turned out to be an artifact of
  eslint-config-next's `.next/**` ignore not matching nested git
  worktrees under `.claude/worktrees/*/.next/**` (see `eslint.config.mjs`'s
  comment) — every worktree's own build output, including generated
  `.next/types/**` files, was getting linted by any other worktree's
  `bun run lint`. Fixed via `**/`-prefixed ignore patterns plus an
  explicit `.claude/worktrees/**` ignore; the real backlog was 11 errors
  (now fixed) and some pre-existing unused-var warnings (lint doesn't
  fail on warnings).
- **`e2e`** — builds the app (`next build --webpack`), then runs the
  default-tier Playwright suite (`bun run e2e`) against that build, with
  Mailhog as a service container. On failure, the HTML report is
  uploaded as a build artifact — download it from the failed run's
  Actions page to see traces/screenshots.

The `e2e` job runs under a GitHub Environment named `e2e-test` (Settings
→ Environments in the repo). Its runtime config (`JWT_SECRET`, SMTP
target, etc. — the same keys `.env.test` defines for local runs) must be
added there as environment secrets before the workflow can pass; the job
fails fast with a clear "Missing required e2e env var" error if any are
absent. `.env.test` itself is never read in CI — it exists only for local
runs.

Branch protection requiring these checks to pass before merge is a
GitHub repository setting, configured outside this codebase.
