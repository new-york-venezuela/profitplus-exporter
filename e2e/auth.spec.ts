import { test, expect, submitReliably } from './fixtures';

// These two tests duplicate the login interaction inline (rather than using
// the `adminPage`/`userPage` fixtures) because they assert on the login
// page itself. `submitReliably` guards against the hydration race explained
// in fixtures.ts.
async function submitLogin(page: import('@playwright/test').Page, email: string, password: string) {
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
