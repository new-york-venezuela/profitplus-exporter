import { test as base, expect, type Page } from '@playwright/test';

// Every form in this app is a React-controlled <form> with no `action` and
// unnamed inputs. On a cold dev-server compile, a click can land before
// React finishes hydrating and wiring up its handlers: the browser then
// falls back to a native form submit, which — since the inputs have no
// `name` — always produces a URL ending in a bare, empty `?` (e.g.
// `/login?`, distinct from a legitimate query string like
// `/password-reset?token=...`). `submitReliably` re-runs the caller's
// fill+click from scratch whenever that empty-`?` signature shows up.
export async function submitReliably(page: Page, fillAndClick: () => Promise<void>): Promise<void> {
  await expect(async () => {
    await fillAndClick();
    await page.waitForLoadState('domcontentloaded');
    expect(page.url().endsWith('?')).toBe(false);
  }).toPass({ timeout: 20_000 });
}

async function loginAs(page: Page, email: string, password: string) {
  await submitReliably(page, async () => {
    await page.goto('/login');
    const emailField = page.getByLabel('Correo electrónico');
    const passwordField = page.getByLabel('Contraseña', { exact: true });
    await emailField.fill(email);
    await expect(emailField).toHaveValue(email);
    await passwordField.fill(password);
    await expect(passwordField).toHaveValue(password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  });
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
