# E2E Playwright Testing + PR Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **PROGRESS (updated 2026-08-20):** Tasks 1-6, 8, and 9 are done and
> committed on branch `worktree-e2e-playwright-testing`, working in the git
> worktree at `.claude/worktrees/e2e-playwright-testing/` (NOT the main
> worktree — `cd` there before resuming, or launch
> `superpowers:using-git-worktrees`). **Remaining: Task 7 only**
> (reports.spec.ts, `@mssql`-tagged — needs the docker MSSQL mock and
> inspecting `docker/mssql/data.sql` for concrete seed values). See the
> "Deviations from this plan" section below — the single biggest one is
> that the suite runs against a **production build**
> (`next build --webpack && next start`), not `bun dev`/`next dev` as
> originally planned; Task 7's spec must be written against that same
> assumption. `AGENT.md` (Task 9) documents this and notes that Task 7's
> spec doesn't exist yet — update that note once Task 7 lands. Full session
> narrative: ask about "e2e playwright testing session" or check
> conversation history around 2026-08-20.

**Goal:** Add a Playwright e2e suite covering this app's user-facing flows, wire it plus existing lint/typecheck/unit tests into a GitHub Actions PR workflow, and document the whole setup in a new root-level `AGENT.md`.

**Architecture:** Two-tier Playwright suite (default tier: auth, password-reset via Mailhog, admin users, profile, firmas; `@mssql`-tagged tier: reports, excluded from CI by default) running against `bun dev`, driven by role/label selectors per Playwright best practice (test behavior, not implementation). A non-interactive seed script builds a throwaway SQLite auth DB for the default tier. CI is a two-job GitHub Actions workflow: fast checks (lint/typecheck/unit) and e2e (with a Mailhog service container).

**Tech Stack:** `@playwright/test` ^1.62, Bun test runner (existing), GitHub Actions, Mailhog (`mailhog/mailhog` Docker image, used only as a CI service container and an optional local `docker run`).

**Spec:** `docs/superpowers/specs/2026-08-18-e2e-playwright-testing-design.md`

## Global Constraints

- Playwright: chromium only, no cross-browser/visual/perf testing (spec: Out of Scope).
- MSSQL-dependent tests (both `bun test` and Playwright) must NOT run in default CI — the docker mock ERP stays local-only, never committed to CI runners.
- Selectors in all new specs use `getByRole`/`getByLabel`/`getByText` — never CSS classes or added `data-testid` attributes; assert on visible outcomes (URL, text, table rows, download events), not internal state.
- `docker/docker-compose.yml` is not modified (Mailhog is CI-service-only / local `docker run`, never added to that compose file).
- `SQLITE_PATH` env var is a **directory**, not a file path — actual DB file is always `<SQLITE_PATH>/data/exporter.db` (see `lib/db/sqlite.ts:8`). Every task touching seed/env config must respect this.
- New root file is `AGENT.md` (singular — distinct from the existing `AGENTS.md`, which documents app architecture and is not touched by this plan).

## Deviations from this plan (discovered during implementation)

- **Runs against a production build, not `bun dev`.** `next dev` compiles
  each route on its first request; under `fullyParallel` with multiple
  workers, that on-demand compile raced real tests (clicks landing before
  React hydration attached handlers, requests timing out mid-compile) —
  reproduced at a ~75% failure rate across repeated cold-cache runs.
  `playwright.config.ts`'s `webServer.command` now runs
  `next build --webpack && next start` locally, or in CI just `next start`
  against a build done as its own workflow step (see Task 8's commit
  `e720457` and `.github/workflows/pr-checks.yml`). 5/5 and then 3/3
  statistical verification runs came back clean after this change, versus
  never once passing clean across ~15 attempts under `next dev`.
- **`e2e/fixtures.ts` exports a `submitReliably(page, fillAndClick)` helper**
  (not in the original plan) used by every spec with a `<form onSubmit>`
  that has unnamed inputs — guards against the same hydration race by
  retrying the whole interaction if the URL picks up a stray trailing `?`
  (the native-form-submit-fallback signature). Login, forgot-password, and
  password-reset specs all use it.
- **Several pages had missing `htmlFor`/`id` label associations**, which
  `getByLabel()` cannot resolve without (a pre-existing accessibility bug,
  not introduced by this plan). Fixed alongside their specs rather than
  working around it with fragile selectors:
  `app/(auth)/login/page.tsx` (pre-existing fix, commit `54ea714`),
  `app/(auth)/forgot-password/page.tsx`, `app/(auth)/password-reset/page.tsx`
  (commit `e884329`), `app/(app)/admin/users/users-client.tsx` (commit
  `477cb20`), `app/(app)/firmas/page.tsx` (commit `ab0c606`).
- **`e2e/helpers/mailhog.ts`'s reset-link regex needed two more decode
  steps** beyond the plan's `=3D`→`=`/`&amp;`→`&` replacements: quoted-printable
  soft line-wraps (`=` immediately before a CRLF) can split the URL
  mid-token and must be joined first, and Handlebars' default HTML-escaping
  of `{{resetUrl}}` turns `?token=` into `?token&#x3D;` (not just `&amp;`
  for literal ampersands). Confirmed against a real sent message's raw
  Mailhog body — see commit `e884329`.
- **CI secrets come from a named GitHub Environment (`e2e-test`), not the
  tracked `.env.test` file.** `.env.test` remains the source of truth for
  local runs; `playwright.config.ts`'s `loadEnvTest()` branches on
  `process.env.CI` to read either the file (local) or `process.env`
  (CI, populated by the workflow's `environment: e2e-test` + `secrets.*`).
  **The `e2e-test` GitHub Environment must be created manually** (repo
  Settings → Environments) with secrets mirroring `.env.test`'s keys
  before the CI workflow can run — it fails fast with a clear error if
  any are missing. See commit `e720457`.
- Task 4's `getByRole('button', { name: 'Crear' })` needed `{ exact: true }`
  — Playwright's default substring name-matching made it also match the
  "+ Crear usuario" button that opens the modal (strict-mode violation, a
  real selector bug not a flaky one). Task 5's `profile.spec.ts` scopes its
  text assertions to `getByRole('main')` since the sidebar also links to
  `/profile` using the same user name text.

---

### Task 1: Install Playwright and scaffold config — ✅ DONE (commit 35bec9e)

**Files:**
- Modify: `package.json` (add `@playwright/test` devDependency + new scripts)
- Create: `playwright.config.ts`
- Create: `.env.test`
- Modify: `.gitignore` (ignore `e2e-results/`, `playwright-report/`, `test-results/`, `data/e2e-test.db*`, and `.env.test` is intentionally tracked — see step 3)
- Create: `e2e/.gitkeep` (placeholder so the directory exists before specs land in Task 3+)

**Interfaces:**
- Produces: `playwright.config.ts` exporting a config with `testDir: './e2e'`, `webServer` block starting `bun dev` with env overrides, `use.baseURL = 'http://localhost:3000'`, one `chromium` project, `retries: process.env.CI ? 2 : 0`.
- Produces: npm scripts `e2e`, `e2e:mssql`, `e2e:ui`, `e2e:seed`, `test:unit`, `test:mssql` (script bodies given below; `e2e:seed` consumed by Task 2, `test:unit`/`test:mssql` consumed by Task 8).

- [ ] **Step 1: Install `@playwright/test`**

Run: `bun add -D @playwright/test@^1.62.0`

- [ ] **Step 2: Install chromium browser binaries**

Run: `bunx playwright install --with-deps chromium`

Expected: downloads chromium into `~/.cache/ms-playwright` (or platform equivalent). This step has no test to verify beyond "command exits 0" — confirm with:

Run: `bunx playwright --version`
Expected: prints `Version 1.62.x`

- [ ] **Step 3: Create `.env.test`**

This file holds e2e-only environment overrides. It is tracked in git (no real secrets — Mailhog needs no real credentials, JWT_SECRET is a fixed test value) so CI and local runs share one source of truth.

```env
# Used only by playwright.config.ts's webServer.env — never loaded by `bun dev` directly.
SQLITE_PATH=./e2e/.tmp
JWT_SECRET=e2e-test-secret-do-not-use-in-production
JWT_EXPIRY_DAYS=7
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=e2e
SMTP_PASSWORD=e2e
SMTP_FROM_NAME=ProfitPlus Exporter
SMTP_FROM_EMAIL=noreply@example.com
PASSWORD_RESET_TOKEN_EXPIRY_MINUTES=15
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=ProfitPlus Exporter
NODE_ENV=test
```

- [ ] **Step 4: Write `playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import fs from 'fs';

function loadEnvTest(): Record<string, string> {
  const envPath = path.resolve(__dirname, '.env.test');
  const content = fs.readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'bun --bun run next dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: loadEnvTest(),
  },
});
```

- [ ] **Step 5: Add scripts to `package.json`**

Add under `"scripts"` (after the existing `"test"` entry):

```json
"test:unit": "bun test --path-ignore-patterns='**/compras-export.integration.test.ts'",
"test:mssql": "bun test __tests__/integration/compras-export.integration.test.ts",
"e2e": "playwright test --grep-invert @mssql",
"e2e:mssql": "playwright test --grep @mssql",
"e2e:ui": "playwright test --ui --grep-invert @mssql",
"e2e:seed": "bun --bun run scripts/e2e-seed.ts"
```

`--path-ignore-patterns` is Bun's documented flag (confirmed via `bun test --help`) for excluding files from a run — this satisfies the spec's "Exclude it from CI run" decision for the MSSQL-dependent unit test without touching that test file.

- [ ] **Step 6: Verify `test:unit` excludes the MSSQL test and everything else still runs**

Run: `bun run test:unit 2>&1 | tail -30`
Expected: test suite runs, `compras-export.integration.test.ts` does not appear in the output, other suites (password-reset, email-service, forgot-password-service, errors) run and pass (or fail for pre-existing reasons unrelated to this change — do not fix unrelated failures in this task).

- [ ] **Step 7: Update `.gitignore`**

Append:

```gitignore
# e2e
/e2e/.tmp
/playwright-report
/test-results
/blob-report
```

- [ ] **Step 8: Create `e2e/.gitkeep`**

Empty file so the directory is tracked before Task 3 adds real specs.

- [ ] **Step 9: Commit**

```bash
git add package.json bun.lock playwright.config.ts .env.test .gitignore e2e/.gitkeep
git commit -m "chore: install Playwright and scaffold e2e config"
```

---

### Task 2: Non-interactive e2e seed script — ✅ DONE (commit e08ccd8, extended in e884329)

**Files:**
- Create: `scripts/e2e-seed.ts`
- Test: manual verification (this is a script, not a unit-testable module — see Step 3)

**Interfaces:**
- Consumes: `getDb()` from `lib/db/sqlite.ts` (reads `SQLITE_PATH` env var as a **directory**; actual file ends up at `<SQLITE_PATH>/data/exporter.db`), `users` table from `lib/db/schema.ts` (`email`, `name`, `passwordHash`, `role: 'user'|'admin'`, `createdAt`), `migrate` from `drizzle-orm/bun-sqlite/migrator` (same call pattern as `scripts/seed.ts:1,9`).
- Produces: on disk, a SQLite file at `<SQLITE_PATH>/data/exporter.db` containing exactly two users:
  - `admin@e2e.test` / password `AdminPass123!` / role `admin` / name `E2E Admin`
  - `user@e2e.test` / password `UserPass123!` / role `user` / name `E2E User`

  These exact credentials are consumed by Task 3's `e2e/fixtures.ts` and every subsequent spec task — do not change them without updating those tasks too.

- [ ] **Step 1: Write `scripts/e2e-seed.ts`**

```typescript
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { getDb } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';

const SEED_USERS = [
  { email: 'admin@e2e.test', name: 'E2E Admin', password: 'AdminPass123!', role: 'admin' as const },
  { email: 'user@e2e.test',  name: 'E2E User',  password: 'UserPass123!',  role: 'user' as const },
];

async function main() {
  const sqlitePath = process.env.SQLITE_PATH ?? './e2e/.tmp';
  const dbFile = path.resolve(sqlitePath, 'data', 'exporter.db');

  // Fresh DB every run: e2e specs assume exactly the two seeded users exist.
  fs.rmSync(dbFile, { force: true });
  fs.rmSync(`${dbFile}-shm`, { force: true });
  fs.rmSync(`${dbFile}-wal`, { force: true });

  const db = getDb();
  migrate(db, { migrationsFolder: './drizzle/migrations' });

  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    db.insert(users).values({
      email: u.email,
      name: u.name,
      passwordHash,
      role: u.role,
      createdAt: Date.now(),
    }).run();
  }

  console.log(`Seeded ${SEED_USERS.length} e2e users into ${dbFile}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it directly to verify the DB is created correctly**

Run: `SQLITE_PATH=./e2e/.tmp bun run scripts/e2e-seed.ts`
Expected: prints `Seeded 2 e2e users into .../e2e/.tmp/data/exporter.db`, and the file exists:

Run: `ls -la e2e/.tmp/data/exporter.db`
Expected: file present, non-zero size

- [ ] **Step 3: Verify seeded credentials work against `bcrypt.compare` (sanity check, not a permanent test)**

Run:
```bash
SQLITE_PATH=./e2e/.tmp bun -e "
import { getDb } from './lib/db/sqlite';
import { users } from './lib/db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
const db = getDb();
const u = db.select().from(users).where(eq(users.email, 'admin@e2e.test')).get();
console.log('found:', !!u, 'role:', u?.role);
console.log('password ok:', await bcrypt.compare('AdminPass123!', u!.passwordHash));
"
```
Expected: `found: true role: admin` then `password ok: true`

- [ ] **Step 4: Add `e2e:seed` to `package.json` (already added in Task 1 Step 5 — verify it's present)**

Run: `grep -A1 '"e2e:seed"' package.json`
Expected: `"e2e:seed": "bun --bun run scripts/e2e-seed.ts"`

- [ ] **Step 5: Run via the npm script end-to-end with `.env.test` values**

Run: `SQLITE_PATH=./e2e/.tmp bun run e2e:seed`
Expected: same success output as Step 2 (confirms the script works both invoked directly and via the script alias)

- [ ] **Step 6: Commit**

```bash
git add scripts/e2e-seed.ts
git commit -m "feat: add non-interactive e2e seed script for auth DB"
```

---

### Task 3: Auth fixture + auth.spec.ts — ✅ DONE (commits acb9f77, 0171e59, 3f002f3)

**Files:**
- Create: `e2e/fixtures.ts`
- Create: `e2e/auth.spec.ts`

**Interfaces:**
- Produces: `test` (extended Playwright test) and `expect`, re-exported from `e2e/fixtures.ts`, with two new fixtures: `adminPage` (a `Page` already logged in as `admin@e2e.test`) and `userPage` (a `Page` already logged in as `user@e2e.test`). Every subsequent spec task (4, 5, 6) imports `{ test, expect }` from `./fixtures` instead of `@playwright/test` directly.
- Consumes: seeded credentials from Task 2 (`admin@e2e.test`/`AdminPass123!`, `user@e2e.test`/`UserPass123!`).

- [ ] **Step 1: Write `e2e/fixtures.ts`**

Uses Playwright's `storageState` pattern: log in once per test via the UI (not the API — logging in through the UI is itself covered once in `auth.spec.ts`; fixtures reuse a helper that submits the login form), then reuse the resulting cookie state for the rest of that test.

```typescript
import { test as base, expect, type Page } from '@playwright/test';

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL('/reports/ventas');
}

export const test = base.extend<{ adminPage: Page; userPage: Page }>({
  adminPage: async ({ page }, use) => {
    await loginAs(page, 'admin@e2e.test', 'AdminPass123!');
    await use(page);
  },
  userPage: async ({ page }, use) => {
    await loginAs(page, 'user@e2e.test', 'UserPass123!');
    await use(page);
  },
});

export { expect };
```

- [ ] **Step 2: Write `e2e/auth.spec.ts`**

```typescript
import { test, expect } from './fixtures';

test.describe('login', () => {
  test('shows an error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@e2e.test');
    await page.getByLabel('Contraseña', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page.getByText('Credenciales inválidas')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('logs in successfully and redirects to reports', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('user@e2e.test');
    await page.getByLabel('Contraseña', { exact: true }).fill('UserPass123!');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page).toHaveURL('/reports/ventas');
  });
});

test.describe('route protection', () => {
  test('redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/reports/ventas');
    await expect(page).toHaveURL(/\/login/);
  });

  test('logged-in user can reach a protected page', async ({ userPage }) => {
    await userPage.goto('/profile');
    await expect(userPage).toHaveURL('/profile');
  });
});
```

- [ ] **Step 3: Run the seed script fresh, then run just this spec**

Run:
```bash
rm -rf e2e/.tmp
SQLITE_PATH=./e2e/.tmp bun run e2e:seed
bun run e2e -- auth.spec.ts
```
Expected: 4 passed. If the label text `Correo electrónico` / `Contraseña` doesn't match exactly, re-check `app/(auth)/login/page.tsx` — the labels there are the source of truth, not this plan.

- [ ] **Step 4: Commit**

```bash
git add e2e/fixtures.ts e2e/auth.spec.ts
git commit -m "test: add e2e auth fixtures and login/route-protection specs"
```

---

### Task 4: Mailhog helper + password-reset.spec.ts — ✅ DONE (commit e884329)

**Files:**
- Create: `e2e/helpers/mailhog.ts`
- Create: `e2e/password-reset.spec.ts`

**Interfaces:**
- Produces: `clearMailhog(): Promise<void>` and `waitForResetEmail(to: string): Promise<{ resetUrl: string }>` from `e2e/helpers/mailhog.ts`, consumed only by `e2e/password-reset.spec.ts` in this plan (future specs needing email may reuse it).
- Consumes: Mailhog HTTP API at `http://localhost:8025` (fixed — matches the CI service container's mapped port and the local `docker run` instructions written in Task 9's AGENT.md).

- [ ] **Step 1: Write `e2e/helpers/mailhog.ts`**

Mailhog's HTTP API: `GET /api/v2/messages` returns `{ items: [{ Content: { Headers: { To: string[] }, Body: string }, ... }] }`. The email body is the raw MIME source when `Content-Transfer-Encoding` isn't set on a simple HTML email from nodemailer, so we extract the `href` via regex rather than fully parsing MIME — nodemailer's default HTML-only email keeps the `<a href="...">` intact in `Body`.

```typescript
interface MailhogMessage {
  Content: {
    Headers: { To?: string[] };
    Body: string;
  };
}

interface MailhogResponse {
  items: MailhogMessage[];
}

const MAILHOG_API = 'http://localhost:8025/api/v2';

export async function clearMailhog(): Promise<void> {
  await fetch(`${MAILHOG_API}/messages`, { method: 'DELETE' });
}

export async function waitForResetEmail(to: string, timeoutMs = 10_000): Promise<{ resetUrl: string }> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(`${MAILHOG_API}/messages`);
    const data = (await res.json()) as MailhogResponse;

    const match = data.items.find(m => (m.Content.Headers.To ?? []).some(h => h.includes(to)));
    if (match) {
      const hrefMatch = match.Content.Body.match(/href="([^"]*\/password-reset\?token=[^"]*)"/);
      if (!hrefMatch) throw new Error('Reset email found but no reset link in body');
      const resetUrl = hrefMatch[1].replace(/=3D/g, '=').replace(/&amp;/g, '&');
      return { resetUrl };
    }

    await new Promise(r => setTimeout(r, 500));
  }

  throw new Error(`Timed out waiting for reset email to ${to} after ${timeoutMs}ms`);
}
```

Note the `=3D`/quoted-printable cleanup: nodemailer may quoted-printable-encode the HTML body, which turns `=` into `=3D` and can soft-wrap lines with trailing `=`. The regex targets the `href="..."` attribute directly; if quoted-printable line-wrapping ever splits a URL mid-string in practice, this is the first place to look — documented here rather than pre-solved because it depends on the actual encoding nodemailer picks (verify in Step 3 below).

- [ ] **Step 2: Write `e2e/password-reset.spec.ts`**

```typescript
import { test, expect } from './fixtures';
import { clearMailhog, waitForResetEmail } from './helpers/mailhog';

test.describe('forgot password', () => {
  test.beforeEach(async () => {
    await clearMailhog();
  });

  test('shows confirmation message after submitting a known email', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel('Correo electrónico').fill('user@e2e.test');
    await page.getByRole('button', { name: 'Enviar instrucciones' }).click();

    await expect(page.getByText(/Si el correo existe en nuestro sistema/)).toBeVisible();
  });

  test('full flow: request reset, follow emailed link, set new password, log in', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel('Correo electrónico').fill('user@e2e.test');
    await page.getByRole('button', { name: 'Enviar instrucciones' }).click();
    await expect(page.getByText(/Si el correo existe en nuestro sistema/)).toBeVisible();

    const { resetUrl } = await waitForResetEmail('user@e2e.test');
    await page.goto(resetUrl);

    await expect(page.getByLabel('Nueva contraseña')).toBeVisible();
    await page.getByLabel('Nueva contraseña').fill('NewPass456!');
    await page.getByLabel('Confirmar contraseña').fill('NewPass456!');
    await page.getByRole('button', { name: 'Restablecer contraseña' }).click();

    await expect(page.getByText('Tu contraseña ha sido restablecida correctamente.')).toBeVisible();

    await page.getByRole('link', { name: 'Iniciar sesión' }).click();
    await page.getByLabel('Correo electrónico').fill('user@e2e.test');
    await page.getByLabel('Contraseña', { exact: true }).fill('NewPass456!');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL('/reports/ventas');
  });

  test('invalid token shows an error state', async ({ page }) => {
    await page.goto('/password-reset?token=not-a-real-token');
    await expect(page.getByText('Este enlace de restablecimiento es inválido o ha expirado.')).toBeVisible();
  });
});
```

The second test mutates the seeded user's password (`user@e2e.test` → `NewPass456!`) — it must run in a worker where no later test in this file (or others) relies on the original `UserPass123!` password still being valid. Playwright's default `fullyParallel: true` runs spec *files* in parallel but tests within one file in order by default; since this is the only place `user@e2e.test`'s password changes, and `auth.spec.ts` / `fixtures.ts` only read it at the start of *their own* run (each spec file gets a fresh server but shares the one seeded DB), there's a real ordering risk across files. Resolve it in Step 3.

- [ ] **Step 3: Fix the cross-file password-mutation risk**

Two files now depend on `user@e2e.test` / `UserPass123!`: `fixtures.ts` (`userPage` fixture, used by `auth.spec.ts`) and `password-reset.spec.ts` (which changes that password). Since specs can run in parallel across files, add a dedicated third user for the destructive password-change test instead of reusing the shared `user@e2e.test`.

Edit `scripts/e2e-seed.ts` from Task 2 — add a third seed user:

```typescript
const SEED_USERS = [
  { email: 'admin@e2e.test', name: 'E2E Admin', password: 'AdminPass123!', role: 'admin' as const },
  { email: 'user@e2e.test',  name: 'E2E User',  password: 'UserPass123!',  role: 'user' as const },
  { email: 'reset-flow@e2e.test', name: 'E2E Reset Flow', password: 'ResetFlowPass123!', role: 'user' as const },
];
```

Then update `password-reset.spec.ts`'s second test to use `reset-flow@e2e.test` / `ResetFlowPass123!` instead of `user@e2e.test` / `UserPass123!` / `NewPass456!` throughout (three occurrences: the forgot-password email field, the `waitForResetEmail` argument, and the final login assertion — new password stays `NewPass456!`).

Re-run seed:
```bash
rm -rf e2e/.tmp
SQLITE_PATH=./e2e/.tmp bun run e2e:seed
```
Expected: `Seeded 3 e2e users into ...`

- [ ] **Step 4: Start Mailhog locally and run this spec**

Run: `docker run --rm -d -p 1025:1025 -p 8025:8025 --name e2e-mailhog mailhog/mailhog`
Run: `bun run e2e -- password-reset.spec.ts`
Expected: 3 passed. If the email-link test fails on "no reset link in body", inspect the raw message to confirm encoding:

Run: `curl -s http://localhost:8025/api/v2/messages | bun -e "const d = await Bun.stdin.text(); console.log(JSON.parse(d).items[0]?.Content?.Body)"`

Adjust the regex/decoding in `mailhog.ts` if the actual body format differs from the quoted-printable assumption (e.g. if nodemailer sent base64 — in which case decode `Body` from base64 before regex-matching).

Run: `docker stop e2e-mailhog`

- [ ] **Step 5: Commit**

```bash
git add e2e/helpers/mailhog.ts e2e/password-reset.spec.ts scripts/e2e-seed.ts
git commit -m "test: add Mailhog helper and full password-reset e2e flow"
```

---

### Task 5: Admin users spec + profile spec — ✅ DONE (commit 477cb20)

**Files:**
- Create: `e2e/admin-users.spec.ts`
- Create: `e2e/profile.spec.ts`

**Interfaces:**
- Consumes: `test`/`expect`/`adminPage`/`userPage` from `e2e/fixtures.ts` (Task 3), seeded `admin@e2e.test` (name `E2E Admin`) and `user@e2e.test` (name `E2E User`, password `UserPass123!` — unchanged by this task, confirmed safe after Task 4 Step 3 moved the destructive test off this user).

- [ ] **Step 1: Write `e2e/admin-users.spec.ts`**

```typescript
import { test, expect } from './fixtures';

test.describe('admin user management', () => {
  test('non-admin cannot access the users page', async ({ userPage }) => {
    await userPage.goto('/admin/users');
    await expect(userPage).toHaveURL('/reports/ventas');
  });

  test('admin can view the seeded users', async ({ adminPage }) => {
    await adminPage.goto('/admin/users');
    await expect(adminPage.getByRole('cell', { name: 'E2E Admin' })).toBeVisible();
    await expect(adminPage.getByRole('cell', { name: 'E2E User' })).toBeVisible();
  });

  test('admin can create a new user and it appears in the list', async ({ adminPage }) => {
    await adminPage.goto('/admin/users');
    await adminPage.getByRole('button', { name: '+ Crear usuario' }).click();

    await adminPage.getByLabel('Nombre').fill('Created By Test');
    await adminPage.getByLabel('Email').fill('created-by-test@e2e.test');
    await adminPage.getByLabel('Contraseña').fill('CreatedPass123!');
    await adminPage.getByLabel('Rol').selectOption('user');
    await adminPage.getByRole('button', { name: 'Crear' }).click();

    await expect(adminPage.getByRole('cell', { name: 'Created By Test' })).toBeVisible();
  });

  test('admin can delete a user', async ({ adminPage }) => {
    await adminPage.goto('/admin/users');
    await adminPage.getByRole('button', { name: '+ Crear usuario' }).click();
    await adminPage.getByLabel('Nombre').fill('To Be Deleted');
    await adminPage.getByLabel('Email').fill('to-be-deleted@e2e.test');
    await adminPage.getByLabel('Contraseña').fill('DeletePass123!');
    await adminPage.getByLabel('Rol').selectOption('user');
    await adminPage.getByRole('button', { name: 'Crear' }).click();
    await expect(adminPage.getByRole('cell', { name: 'To Be Deleted' })).toBeVisible();

    const row = adminPage.getByRole('row', { name: /To Be Deleted/ });
    adminPage.once('dialog', dialog => dialog.accept());
    await row.getByRole('button', { name: '✕' }).click();

    await expect(adminPage.getByRole('cell', { name: 'To Be Deleted' })).not.toBeVisible();
  });

  test('admin can reset another user\'s password', async ({ adminPage }) => {
    await adminPage.goto('/admin/users');
    const row = adminPage.getByRole('row', { name: /E2E User/ });
    await row.getByRole('button', { name: 'Reset' }).click();

    await adminPage.getByLabel('Nueva contraseña').fill('AdminResetPass123!');
    await adminPage.getByLabel('Confirmar contraseña').fill('AdminResetPass123!');
    await adminPage.getByRole('button', { name: 'Guardar' }).click();

    await expect(adminPage.getByText('Guardar')).not.toBeVisible({ timeout: 5000 }).catch(() => {});
  });
});
```

The last test (`admin can reset another user's password`) mutates `user@e2e.test`'s password as a side effect. Since `userPage` fixture (used by `auth.spec.ts` and this file's own first test) depends on `UserPass123!` staying valid, this test must not run before those. Resolve in Step 2 by using the dedicated `reset-flow@e2e.test`-style isolation pattern already established in Task 4 — but since this test needs a user that exists in the admin list, not a fresh signup, take the simpler fix: assert the flow succeeds (form closes, no error) without actually depending on being able to log in with the old password afterward, and don't verify the new password via login — that behavior (password reset by admin working correctly) is already covered by unit tests. Keep this e2e test scoped to "the UI flow completes without error."

- [ ] **Step 2: Fix the test to not depend on `user@e2e.test` password before/after ordering**

Replace the last test in Step 1 with one that creates its own throwaway target user first, so it never touches the shared `user@e2e.test`:

```typescript
  test('admin can reset another user\'s password', async ({ adminPage }) => {
    await adminPage.goto('/admin/users');
    await adminPage.getByRole('button', { name: '+ Crear usuario' }).click();
    await adminPage.getByLabel('Nombre').fill('Reset Target');
    await adminPage.getByLabel('Email').fill('reset-target@e2e.test');
    await adminPage.getByLabel('Contraseña').fill('OriginalPass123!');
    await adminPage.getByLabel('Rol').selectOption('user');
    await adminPage.getByRole('button', { name: 'Crear' }).click();
    await expect(adminPage.getByRole('cell', { name: 'Reset Target' })).toBeVisible();

    const row = adminPage.getByRole('row', { name: /Reset Target/ });
    await row.getByRole('button', { name: 'Reset' }).click();
    await adminPage.getByLabel('Nueva contraseña').fill('AdminResetPass123!');
    await adminPage.getByLabel('Confirmar contraseña').fill('AdminResetPass123!');
    await adminPage.getByRole('button', { name: 'Guardar' }).click();

    // Modal closes on success — its "Guardar" button is no longer in the DOM.
    await expect(adminPage.getByRole('button', { name: 'Guardar' })).not.toBeVisible();
  });
```

Apply this replacement to the file written in Step 1 (i.e. the final file has this version of the test, not the first draft).

- [ ] **Step 3: Write `e2e/profile.spec.ts`**

```typescript
import { test, expect } from './fixtures';

test.describe('profile', () => {
  test('shows the logged-in user\'s name and email', async ({ userPage }) => {
    await userPage.goto('/profile');
    await expect(userPage.getByText('E2E User')).toBeVisible();
    await expect(userPage.getByText('user@e2e.test')).toBeVisible();
  });
});
```

Before finalizing this test, confirm what `ProfileClient` actually renders — the plan author has not read `app/(app)/profile/profile-client.tsx`. Read it first:

Run: `cat "app/(app)/profile/profile-client.tsx"`

If name/email are rendered as plain text (likely, given the page passes `name` and `email` props directly), the test above is correct. If they're rendered inside form inputs instead (e.g. a read-only `<input value={email}>`), change the assertions to `expect(userPage.getByDisplayValue('user@e2e.test')).toBeVisible()` accordingly — match whatever the actual component does, don't guess blind.

- [ ] **Step 4: Run both specs**

Run:
```bash
docker run --rm -d -p 1025:1025 -p 8025:8025 --name e2e-mailhog mailhog/mailhog
rm -rf e2e/.tmp && SQLITE_PATH=./e2e/.tmp bun run e2e:seed
bun run e2e -- admin-users.spec.ts profile.spec.ts
docker stop e2e-mailhog
```
Expected: all tests pass (5 in admin-users, 1 in profile).

- [ ] **Step 5: Commit**

```bash
git add e2e/admin-users.spec.ts e2e/profile.spec.ts
git commit -m "test: add admin user management and profile e2e specs"
```

---

### Task 6: Firmas spec — ✅ DONE (commit ab0c606)

**Files:**
- Create: `e2e/firmas.spec.ts`

**Interfaces:**
- Consumes: `test`/`expect`/`userPage` from `e2e/fixtures.ts` (Task 3). Firmas has no role restriction — any authenticated user can reach it (confirmed: `app/(app)/firmas/page.tsx` has no `getSession`/redirect logic, it's inside the `(app)` group so middleware still requires auth, but no role check).

- [ ] **Step 1: Write `e2e/firmas.spec.ts`**

Tests behavior: typing into the form updates the live signature preview. The preview is rendered via `dangerouslySetInnerHTML` inside a `ref`-attached `div` with no accessible role — so this test targets it by its container structure (the one exception to role/label-only selectors, justified because the preview pane has no semantic role to hook into; use `page.locator` scoped to the preview container's heading sibling).

```typescript
import { test, expect } from './fixtures';

test.describe('firmas (signature generator)', () => {
  test('editing the full name updates the live preview', async ({ userPage }) => {
    await userPage.goto('/firmas');

    const preview = userPage.locator('text=Vista Previa').locator('..').locator('..');

    await expect(preview.getByText('Eugenio Doñaque')).toBeVisible();

    await userPage.getByLabel('Nombre Completo').fill('Jane Doe');

    await expect(preview.getByText('Jane Doe')).toBeVisible();
    await expect(preview.getByText('Eugenio Doñaque')).not.toBeVisible();
  });

  test('toggling WhatsApp shows the WhatsApp field and preview line', async ({ userPage }) => {
    await userPage.goto('/firmas');

    await expect(userPage.getByPlaceholder('+58 000 000 0000')).not.toBeVisible();

    await userPage.getByLabel('Incluir número de WhatsApp (WA)').check();

    await expect(userPage.getByPlaceholder('+58 000 000 0000')).toBeVisible();
  });

  test('copy HTML button shows a confirmation message', async ({ userPage, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await userPage.goto('/firmas');

    await userPage.getByRole('button', { name: /Copiar Código HTML Bruto/ }).click();

    await expect(userPage.getByText('¡Código HTML copiado!')).toBeVisible();
  });
});
```

- [ ] **Step 2: Run it, fix the preview locator if needed**

Run: `bun run e2e -- firmas.spec.ts`

The `preview` locator (`text=Vista Previa` → `..` → `..`) is fragile by construction — Playwright text locators plus manual `..` traversal are a last resort here because the preview div has no accessible name. If this fails, open `app/(app)/firmas/page.tsx` (already read in full during brainstorming — the preview `div` is at line 244-249, wrapped in a `div.border.border-dashed` container that is a sibling of the `<h2>Vista Previa` heading, both children of the same parent `<div>`) and adjust the locator to match the actual DOM nesting exactly, e.g.:

```typescript
const preview = userPage.locator('h2:has-text("Vista Previa")').locator('..');
```

Expected after fix: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add e2e/firmas.spec.ts
git commit -m "test: add firmas signature generator e2e spec"
```

---

### Task 7: Reports spec (`@mssql`-tagged) — ⬜ NOT STARTED (needs docker mssql mock; see plan's own note about writing against a production build now, not bun dev)

**Files:**
- Create: `e2e/reports.spec.ts`

**Interfaces:**
- Consumes: `test`/`expect`/`userPage` from `e2e/fixtures.ts`; the local `docker/docker-compose.yml` mock ERP (developer-started, not this task's responsibility to start it) seeded via `docker/mssql/init.sql`/`data.sql`.
- Produces: nothing consumed elsewhere — this is a leaf spec, excluded from default CI via the `@mssql` tag in every test title, per `playwright.config` + `e2e`/`e2e:mssql` scripts from Task 1.

This task cannot fully verify row-level content against `docker/mssql/data.sql` without inspecting that seed data's actual date ranges and values — do that first.

`components/date-range-picker.tsx` and `components/column-manager.tsx` have already been read during plan authoring, so the spec below uses their real DOM structure directly (no guessed selectors):

- **Date range:** two unlabeled `<input type="date">` elements (in DOM order: start, then end) inside a container with visible text `Período`, plus a button named `Aplicar` that must be clicked to trigger the fetch. Target them via `userPage.locator('input[type="date"]')` (`.first()`/`.nth(1)`), not `getByLabel` — there are no `<label>` elements.
- **Column toggle:** each column is a "chip" with an icon-button whose `aria-label` is exactly `Ocultar <label>` (visible) or `Mostrar <label>` (hidden) — `<ColumnDef.label>` is the Spanish display name from `lib/reports/ventas.ts`/`compras.ts`, e.g. `Nº`, `Fecha`. No separate "Columnas" toggle button exists — chips render inline, always visible, under the "Columnas" heading text.

- [ ] **Step 1: Inspect the seed data and the ventas column config to find known-good test values**

Run: `command find docker/mssql -maxdepth 1 -type f`
Run: `grep -m 5 -oE "20[0-9]{2}-[0-9]{2}-[0-9]{2}" docker/mssql/data.sql`
Run: `cat lib/reports/ventas.ts` (get the exact `label` of a non-`alwaysVisible` column to toggle, and confirm `dateColumn`)
Run: `cat lib/reports/compras.ts` (get one `sucursal` selector option value used by seed data, if `COMPRAS_CONFIG` has a `selectors` entry)

Identify one concrete date range (e.g. a month) known to contain both ventas and compras rows. Use these concrete values in the spec below — do not invent placeholder dates. Also record the exact `label` string of the second column in `VENTAS_CONFIG.columns` (sorted by `defaultOrder`) that is not `alwaysVisible` — this is the column the toggle test will hide.

- [ ] **Step 2: Write `e2e/reports.spec.ts`**

```typescript
import { test, expect } from './fixtures';

// @mssql — requires `docker compose -f docker/docker-compose.yml up -d` running locally.
// Excluded from default CI (see playwright.config.ts + `bun run e2e` vs `bun run e2e:mssql`).

test.describe('reports @mssql', () => {
  test('ventas: preview loads rows for the default date range', async ({ userPage }) => {
    await userPage.goto('/reports/ventas');
    await expect(userPage.getByText(/registros/)).toBeVisible({ timeout: 15_000 });
    await expect(userPage.locator('table')).toBeVisible();
  });

  test('ventas: changing the date range refetches the preview', async ({ userPage }) => {
    await userPage.goto('/reports/ventas');
    await expect(userPage.getByText(/registros/)).toBeVisible({ timeout: 15_000 });

    const dateInputs = userPage.locator('input[type="date"]');
    // Values from Step 1 — replace with the concrete range found there.
    await dateInputs.nth(0).fill('<START_DATE_FROM_STEP_1>');
    await dateInputs.nth(1).fill('<END_DATE_FROM_STEP_1>');
    await userPage.getByRole('button', { name: 'Aplicar' }).click();

    await expect(userPage.getByText(/registros/)).toBeVisible({ timeout: 15_000 });
  });

  test('ventas: toggling a column hides it from the preview table', async ({ userPage }) => {
    await userPage.goto('/reports/ventas');
    await expect(userPage.locator('table')).toBeVisible({ timeout: 15_000 });

    // Replace with the exact column label found in Step 1 (a non-alwaysVisible
    // VENTAS_CONFIG column, e.g. whatever the second defaultOrder entry's `label` is).
    const columnLabel = '<COLUMN_LABEL_FROM_STEP_1>';

    await expect(userPage.locator('table thead th', { hasText: columnLabel })).toBeVisible();
    await userPage.getByRole('button', { name: `Ocultar ${columnLabel}` }).click();
    await expect(userPage.locator('table thead th', { hasText: columnLabel })).not.toBeVisible();
  });

  test('compras: export button triggers a file download', async ({ userPage }) => {
    await userPage.goto('/reports/compras');
    await expect(userPage.locator('table')).toBeVisible({ timeout: 15_000 });

    const downloadPromise = userPage.waitForEvent('download');
    await userPage.getByRole('button', { name: '↓ Exportar' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.(xlsx|csv)$/);
  });
});
```

Before running, replace the two `<..._FROM_STEP_1>` placeholders with the concrete values found in Step 1 — this is required, not optional; the file must not be committed with literal placeholder strings still in it (Step 4 below re-checks this).

- [ ] **Step 3: Bring up the mock ERP and run the spec**

First, confirm no placeholder strings remain in the file:

Run: `grep -n "_FROM_STEP_1" e2e/reports.spec.ts`
Expected: no output (both `fill()` calls and `columnLabel` now hold real values from Step 1)

Run: `docker compose -f docker/docker-compose.yml up -d`

Wait for MSSQL to accept connections (first boot can take 30-60s):
Run: `until docker exec profitplus-erp-mock /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'YourStr0ngP@ssw0rd' -C -Q "SELECT 1" 2>/dev/null; do sleep 3; done`

Run: `bun run e2e:mssql`
Expected: 4 passed. Fix selectors/timeouts based on actual failures — this is real data, not scaffolding, so failures here are signal, not something to work around.

Run: `docker compose -f docker/docker-compose.yml down`

- [ ] **Step 4: Confirm the default `bun run e2e` still excludes this file**

Run: `bun run e2e -- --list 2>&1 | grep -c "reports.spec"`
Expected: `0` (grep finds nothing, confirming `--grep-invert @mssql` excluded all 4 tests — every test title contains `@mssql` per Step 2's naming)

- [ ] **Step 5: Commit**

```bash
git add e2e/reports.spec.ts
git commit -m "test: add @mssql-tagged reports e2e spec (excluded from default CI)"
```

---

### Task 8: GitHub Actions PR workflow — ✅ DONE (commit e720457; needs e2e-test GitHub Environment created manually before it can run green)

**Files:**
- Create: `.github/workflows/pr-checks.yml`

**Interfaces:**
- Consumes: `test:unit` script (Task 1), `e2e`/`e2e:seed` scripts (Tasks 1-2), `lint` script (existing `package.json`), `tsconfig.json` (existing, for `tsc --noEmit`).

- [ ] **Step 1: Write `.github/workflows/pr-checks.yml`**

```yaml
name: PR Checks

on:
  pull_request:
    branches: [main]

jobs:
  checks:
    name: Lint, typecheck, unit tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run lint
      - run: bunx tsc --noEmit
      - run: bun run test:unit

  e2e:
    name: Playwright e2e
    runs-on: ubuntu-latest
    services:
      mailhog:
        image: mailhog/mailhog
        ports:
          - 1025:1025
          - 8025:8025
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bunx playwright install --with-deps chromium
      - run: bun run e2e:seed
        env:
          SQLITE_PATH: ./e2e/.tmp
      - run: bun run e2e
        env:
          CI: true
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

Two jobs, not one, per the design spec's rationale: lint/typecheck/unit failures surface in ~1-2 minutes without waiting on browser install + dev server boot + e2e run.

- [ ] **Step 2: Validate the YAML syntax locally**

Run: `bunx js-yaml .github/workflows/pr-checks.yml > /dev/null && echo "valid yaml"` (if `js-yaml` isn't available, use `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/pr-checks.yml'))" && echo valid` instead — either confirms no syntax errors before pushing)

Expected: `valid yaml` (or `valid`)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/pr-checks.yml
git commit -m "ci: add PR workflow for lint, typecheck, unit tests, and e2e"
```

- [ ] **Step 4: Push the branch and open a PR to verify the workflow actually runs green on GitHub**

This step requires a branch + PR, which is a user-visible/shared-state action — confirm with the user before running `git push` and `gh pr create`, per the "Executing actions with care" guidance. Do not push automatically; surface this as the handoff point.

---

### Task 9: `AGENT.md` — ✅ DONE (commit 663b0e1)

**Files:**
- Create: `AGENT.md`

**Interfaces:**
- Consumes: every script name and file path established in Tasks 1-8 — this task is purely documentation, written last so every command it documents has already been run successfully at least once in this plan.

- [ ] **Step 1: Write `AGENT.md`**

```markdown
# AGENT.md — E2E Testing Guide

This file documents the Playwright e2e suite and PR workflow. For app
architecture and conventions, see `AGENTS.md` instead — this file is
scoped to testing only.

## Running e2e tests locally

```bash
bun run e2e:seed   # rebuilds e2e/.tmp/data/exporter.db with 3 fixed test users
bun run e2e        # runs everything except @mssql-tagged specs
bun run e2e:ui     # same, in Playwright's interactive UI mode
```

The dev server, SQLite path, JWT secret, and SMTP target used during
e2e runs all come from `.env.test` (tracked in git — no real secrets in
it), loaded by `playwright.config.ts`'s `webServer.env`. This is
separate from your local `.env.local` — e2e runs never touch your real
`data/app.db`.

Seeded users (fixed, defined in `scripts/e2e-seed.ts`):

| Email | Password | Role |
|---|---|---|
| `admin@e2e.test` | `AdminPass123!` | admin |
| `user@e2e.test` | `UserPass123!` | user |
| `reset-flow@e2e.test` | `ResetFlowPass123!` | user |

`user@e2e.test`'s password must stay stable across the whole suite —
only `reset-flow@e2e.test` is used by tests that change a password
(the full password-reset flow), and admin-triggered password resets in
`admin-users.spec.ts` create and target their own throwaway user
rather than touching any of the three fixed accounts. Follow this
pattern for new specs: if a test mutates auth state, either create a
disposable user in the test itself or use a dedicated fixed account —
never mutate `admin@e2e.test` or `user@e2e.test`.

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

## The `@mssql` tag

Tests in `e2e/reports.spec.ts` need the dockerized mock ERP
(`docker/docker-compose.yml`) with real query results. That stack is
**intentionally excluded from CI** — it's heavy, and we don't want to
add multi-minute SQL Server container boots (plus committed `.bak`
seed files) to every PR run.

Every test that depends on it has `@mssql` in its title. This is not
a Playwright `project` or config option — it's a plain string in
`test()`'s name, filtered with `--grep`/`--grep-invert`. `bun run e2e`
uses `--grep-invert @mssql` (skips them); `bun run e2e:mssql` uses
`--grep @mssql` (runs only them).

To run the `@mssql` tier locally:

```bash
docker compose -f docker/docker-compose.yml up -d
# wait for MSSQL to be ready (first boot ~30-60s), then:
bun run e2e:mssql
docker compose -f docker/docker-compose.yml down
```

When adding a new spec that touches `/reports/*` or anything else
backed by the SQL Server ERP, put `@mssql` in every one of its test
titles, not just the file name — `--grep` matches on the full test
title Playwright prints, which includes the `describe` block name, so
tagging the `describe` block (as `reports.spec.ts` does: `describe('reports @mssql', ...)`)
covers every test inside it in one place.

## Testing philosophy: behavior, not implementation

- Select elements the way a user finds them: `getByRole`, `getByLabel`,
  `getByText`. Never select by CSS class or an added `data-testid` —
  this app's Tailwind classes are styling, not a testing contract, and
  should be free to change without breaking tests.
- Assert on what the user would see: a URL change, a visible message,
  a row in a table, a triggered download — not on internal state,
  network call counts, or component structure.
- One user-observable behavior per `test()`. A test walking five
  unrelated things in one block makes failures hard to localize.
- Don't re-test what's already covered elsewhere. The export buttons
  in `reports.spec.ts` assert a download fires with the right
  extension — they don't assert on file *contents*, because
  `__tests__/unit` and `__tests__/integration/compras-export.integration.test.ts`
  already cover the query→map→CSV pipeline at the unit level. E2e's
  job is "does clicking the button do the right thing end to end,"
  not re-proving correctness that's already proven elsewhere.

## Adding e2e coverage for a new feature

1. One spec file per route or user flow, named after it:
   `e2e/<feature>.spec.ts`.
2. If it needs an authenticated user, import `test`/`expect` from
   `./fixtures` and use the `adminPage`/`userPage` fixtures rather than
   logging in by hand in every test.
3. If it touches the SQL Server ERP, tag the `describe` block (or every
   individual `test()` if there's no shared `describe`) with `@mssql`.
4. If it needs to observe an email, reuse `e2e/helpers/mailhog.ts`; add
   a new helper function there rather than duplicating the polling
   logic in the spec.
5. Run it locally (`bun run e2e -- <file>.spec.ts`, plus Mailhog/docker
   compose if tagged) before committing — the PR workflow will run the
   default tier automatically, but the `@mssql` tier never runs in CI,
   so it's on you to have verified it locally.

## What the PR workflow gates

`.github/workflows/pr-checks.yml` runs on every PR targeting `main`,
as two required jobs:

- **`checks`** — `bun run lint`, `bunx tsc --noEmit`, `bun run test:unit`
  (this excludes `compras-export.integration.test.ts`, which — like
  `@mssql` e2e specs — needs the real MSSQL mock and is run on demand
  via `bun run test:mssql`, never in CI).
- **`e2e`** — the default-tier Playwright suite (`bun run e2e`), with
  Mailhog as a service container. On failure, the HTML report is
  uploaded as a build artifact — download it from the failed run's
  Actions page to see traces/screenshots.

Branch protection requiring these checks to pass before merge is a
GitHub repository setting, configured outside this codebase.
```

- [ ] **Step 2: Verify every command in the file actually matches what's in `package.json`**

Run: `grep -oE '`bun run [a-z:]+`' AGENT.md | sort -u`
Then for each, confirm it exists: `grep -oE '"[a-z:]+":' package.json | sort -u`
Expected: every `bun run X` mentioned in `AGENT.md` has a matching `"X":` script in `package.json` (from Tasks 1-2: `lint`, `test:unit`, `test:mssql`, `e2e`, `e2e:mssql`, `e2e:ui`, `e2e:seed`).

- [ ] **Step 3: Commit**

```bash
git add AGENT.md
git commit -m "docs: add AGENT.md documenting the e2e suite and PR workflow"
```

---

## Self-Review Notes

- **Spec coverage:** every spec section has a task — structure (Tasks 1, 3-7), test data setup (Tasks 1-2), CI workflow (Task 8), testing philosophy (baked into Tasks 3-7's selector choices + reiterated in Task 9), AGENT.md (Task 9), error handling edge cases (Mailhog timeout in Task 4, `@mssql` non-running-docker documented in Task 9 rather than special-cased in code, per spec).
- **Bun test exclusion mechanism:** spec flagged this as unverified; Task 1 Step 5-6 verifies `--path-ignore-patterns` (confirmed present in `bun test --help` output during planning) actually works before later tasks depend on it.
- **Cross-test state coupling:** identified and fixed in Task 4 Step 3 and Task 5 Step 2 — no spec ends up depending on another spec file's mutation of a shared seeded user's password.
- **Component DOM verified during planning:** `profile-client.tsx`, `date-range-picker.tsx`, and `column-manager.tsx` were all read before finalizing Tasks 5 and 7, so those specs' selectors (plain-text assertions for profile; unlabeled `input[type=date]` + `Aplicar` button for date range; `aria-label="Ocultar <label>"/"Mostrar <label>"` chips for column toggling) match real markup, not guesses. The two remaining `<..._FROM_STEP_1>` placeholders in Task 7 are intentional and bounded — they stand for concrete seed-data date values and a column label that can only be known by reading `docker/mssql/data.sql` and `lib/reports/ventas.ts` at execution time (both files exist but their content wasn't loaded during planning); Task 7 Step 3 fails loudly (`grep` check) if they're left unresolved.
