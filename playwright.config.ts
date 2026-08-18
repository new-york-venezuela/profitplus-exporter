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
    // --webpack: Turbopack's dev server cannot resolve/load the native `bcrypt`
    // addon as an external module at runtime (`serverExternalPackages` in
    // next.config.ts is respected for detection but the resulting require() of
    // the "external" chunk fails: "Failed to load external module bcrypt-<hash>").
    // Confirmed via a clean A/B: identical login request 500s under Turbopack,
    // 200s under webpack. This makes every login-dependent e2e spec unrunnable.
    // TODO: drop --webpack once upstream Next.js/Turbopack fixes native-addon
    // external module resolution in dev (same class of bug as the
    // staticGenerationRetryCount workaround already documented in next.config.ts).
    command: 'bun --bun run next dev --webpack',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: loadEnvTest(),
  },
});
