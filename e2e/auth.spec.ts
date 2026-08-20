import { test, expect } from './fixtures';

// Submits the login form, retrying if the click races React's state flush
// from `.fill()` (see fixtures.ts's `loginAs` for the full explanation).
// These two tests duplicate the interaction inline because they assert on
// the login page itself rather than via the `adminPage`/`userPage` fixtures.
async function submitLogin(page: import('@playwright/test').Page, email: string, password: string) {
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
}

test.describe('login', () => {
  test('shows an error on invalid credentials', async ({ page }) => {
    await submitLogin(page, 'admin@e2e.test', 'wrong-password');

    await expect(page.getByText('Credenciales inválidas')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('logs in successfully and redirects to reports', async ({ page }) => {
    await submitLogin(page, 'user@e2e.test', 'UserPass123!');

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
