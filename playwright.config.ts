import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const E2E_ENV_KEYS = [
  'SQLITE_PATH',
  'JWT_SECRET',
  'JWT_EXPIRY_DAYS',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM_NAME',
  'SMTP_FROM_EMAIL',
  'PASSWORD_RESET_TOKEN_EXPIRY_MINUTES',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_APP_NAME',
  'NODE_ENV',
] as const;

function loadEnvTest(): Record<string, string> {
  // CI: these come from the "e2e-test" GitHub Environment's secrets, set as
  // step env in the workflow — never from the tracked .env.test file, so
  // real per-environment values (should this graduate beyond throwaway
  // fixtures) stay in GitHub's secret store, not the repo.
  if (process.env.CI) {
    const env: Record<string, string> = {};
    for (const key of E2E_ENV_KEYS) {
      const value = process.env[key];
      if (value === undefined) throw new Error(`Missing required e2e env var in CI: ${key}`);
      env[key] = value;
    }
    return env;
  }

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
    // Serve the production build (`next start`) instead of `next dev`. Dev
    // mode compiles each route on its first request; under `fullyParallel`,
    // several workers hit different cold routes at once and that on-demand
    // compile is slow/racy enough to fail real tests (clicks landing before
    // hydration, requests timing out mid-compile). A production build has
    // no such window — every route is already compiled before the first
    // test runs. `--webpack`: `serverExternalPackages` (next.config.ts)
    // needs it for `bcrypt`/`mssql` to resolve correctly; confirmed via
    // `next build --webpack` succeeding cleanly.
    //
    // CI builds as its own workflow step (clearer failure attribution, and
    // the build only has to happen once even if a job/step retries) and
    // this just starts the already-built app; locally, build+start in one
    // command keeps `bun run e2e` a single-step happy path.
    command: process.env.CI
      ? 'bun --bun run next start'
      : 'bun --bun run next build --webpack && bun --bun run next start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: loadEnvTest(),
  },
});
