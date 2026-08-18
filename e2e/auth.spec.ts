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
