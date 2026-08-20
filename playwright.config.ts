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
    // Build once, then serve the production build (`next start`) instead of
    // `next dev`. Dev mode compiles each route on its first request; under
    // `fullyParallel`, several workers hit different cold routes at once and
    // that on-demand compile is slow/racy enough to fail real tests (clicks
    // landing before hydration, requests timing out mid-compile). A
    // production build has no such window — every route is already compiled
    // before the first test runs. `--webpack`: `serverExternalPackages`
    // (next.config.ts) needs it for `bcrypt`/`mssql` to resolve correctly;
    // confirmed via `next build --webpack` succeeding cleanly.
    command: 'bun --bun run next build --webpack && bun --bun run next start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: loadEnvTest(),
  },
});
