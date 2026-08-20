import { test as base, expect, type Page } from '@playwright/test';

// The login form's inputs are React-controlled with no `name` attribute and
// the <form> has no `action`. On a cold dev-server compile, a click can
// land before React finishes hydrating and wiring up its handlers, which
// surfaces as one of two failures: (a) the browser falls back to a native
// form submit — visible as a `/login?` URL — reloading the page and
// discarding whatever was typed, or (b) hydration attached the handler but
// hadn't yet flushed the `.fill()`-driven state update, so `handleSubmit`
// reads stale empty state and the API 400s with "Email y contraseña
// requeridos". Both are detectable after the fact (no reliable hydration
// signal exists to wait on beforehand), so retry the whole exchange from a
// fresh `/login` load whenever either shows up.
async function loginAs(page: Page, email: string, password: string) {
  await expect(async () => {
    await page.goto('/login');
    const emailField = page.getByLabel('Correo electrónico');
    const passwordField = page.getByLabel('Contraseña', { exact: true });
    await emailField.fill(email);
    await expect(emailField).toHaveValue(email);
    await passwordField.fill(password);
    await expect(passwordField).toHaveValue(password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForLoadState('domcontentloaded');
    expect(new URL(page.url()).search).toBe('');
    await expect(page.getByText('Email y contraseña requeridos')).not.toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
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
