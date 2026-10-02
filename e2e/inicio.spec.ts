import { test, expect } from './fixtures';

test.describe('welcome page', () => {
  test('plain user sees only the links they can use', async ({ userPage }) => {
    await userPage.goto('/inicio');
    const main = userPage.getByRole('main');
    await expect(main.getByRole('heading', { name: /Bienvenido/ })).toBeVisible();
    await expect(main.getByRole('link', { name: /Ventas/ })).toBeVisible();
    await expect(main.getByRole('link', { name: /Usuarios/ })).toHaveCount(0);
    await expect(main.getByRole('link', { name: /Panel Analítico/ })).toHaveCount(0);
  });

  test('admin also sees admin links', async ({ adminPage }) => {
    await adminPage.goto('/inicio');
    await expect(adminPage.getByRole('main').getByRole('link', { name: /Usuarios/ })).toBeVisible();
  });
});
