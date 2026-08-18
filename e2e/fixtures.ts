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
