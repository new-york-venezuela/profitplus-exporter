import { test, expect, submitReliably } from './fixtures';

// (a) is a server-side redirect on the SQLite grant alone, so it runs in the
// default tier. The rest load the Segmentos workspace, which reads the ERP,
// hence @mssql (see e2e/mapa.spec.ts for the same split).

test.describe('pricing access', () => {
  test('a user without a pricing grant is redirected away from /pricing', async ({ userPage }) => {
    await userPage.goto('/pricing');
    await expect(userPage).toHaveURL('/inicio');
  });
});

test.describe('pricing segments @mssql', () => {
  // Creates a throwaway pricing_view user through the admin API (same
  // endpoints the admin-users spec drives through the UI), then logs in with
  // it in a separate browser context so the seeded users are never modified.
  async function viewerPage(browser: import('@playwright/test').Browser, adminPage: import('@playwright/test').Page) {
    const email = `pricing-view-${Date.now()}@e2e.test`;
    const password = 'PricingView123!';
    const created = await adminPage.request.post('/api/admin/users', {
      data: { email, name: 'Pricing Viewer', password, role: 'user' },
    });
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    const granted = await adminPage.request.put(`/api/admin/users/${id}/modules`, {
      data: { modules: ['pricing_view'] },
    });
    expect(granted.ok()).toBe(true);

    const context = await browser.newContext({ baseURL: 'http://localhost:3000' });
    const page = await context.newPage();
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
    await page.waitForURL('/inicio');
    return { page, context };
  }

  test('a pricing_view user sees the segment rail but no edit buttons', async ({ browser, adminPage }) => {
    const { page, context } = await viewerPage(browser, adminPage);
    try {
      await page.goto('/pricing');
      await expect(page.getByRole('heading', { name: 'Segmentos', exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('button', { name: /Mover a segmento/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Precio especial' })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('the help panel on /pricing shows the segments help', async ({ adminPage }) => {
    await adminPage.goto('/pricing');
    await adminPage.getByRole('button', { name: 'Ayuda de esta página' }).click();

    const dialog = adminPage.getByRole('dialog', { name: 'Panel de ayuda' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Segmentos y listas de precio' })).toBeVisible({ timeout: 10_000 });
  });
});
