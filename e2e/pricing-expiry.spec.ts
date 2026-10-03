import { test, expect, submitReliably } from './fixtures';

// Health lists read live ERP data, so this is @mssql; the settings/visibility checks run against the local mock.
test.describe('pricing expiry @mssql', () => {
  test('a pricing_view user sees the health sections and the help, but not the alert settings', async ({ browser, adminPage }) => {
    const email = `pricing-expiry-view-${Date.now()}@e2e.test`;
    const password = 'PricingView123!';
    const created = await adminPage.request.post('/api/admin/users', {
      data: { email, name: 'Pricing Expiry Viewer', password, role: 'user' },
    });
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    const granted = await adminPage.request.put(`/api/admin/users/${id}/modules`, { data: { modules: ['pricing_view'] } });
    expect(granted.ok()).toBe(true);

    const context = await browser.newContext({ baseURL: 'http://localhost:3000' });
    const page = await context.newPage();
    try {
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

      await page.goto('/pricing?tab=vencimientos');
      await expect(page.getByRole('tab', { name: 'Vencimientos', selected: true })).toBeVisible({ timeout: 20_000 });
      for (const name of ['Terminan pronto', 'Vencidas sin revertir', 'Sin precio vigente', 'Estado del barrido']) {
        await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 20_000 });
      }
      await expect(page.getByRole('button', { name: 'Alertas por correo' })).toHaveCount(0);

      // the alert settings API is admin only, even for a viewer
      const res = await page.request.get('/api/pricing/alert-settings');
      expect(res.status()).toBe(403);

      await page.getByRole('button', { name: 'Ayuda de esta página' }).click();
      const dialog = page.getByRole('dialog', { name: 'Panel de ayuda' });
      await expect(dialog.getByRole('heading', { name: '¿Qué es esta pestaña?' })).toBeVisible({ timeout: 10_000 });
      await expect(dialog.getByRole('heading', { name: 'La tarea nocturna y el barrido' })).toBeVisible();
    } finally {
      await context.close();
      await adminPage.request.delete(`/api/admin/users/${id}`);
    }
  });

  test('an admin sees and can open the alert settings, and the timeline view renders', async ({ adminPage }) => {
    await adminPage.goto('/pricing?tab=vencimientos');
    await expect(adminPage.getByRole('heading', { name: 'Estado del barrido' })).toBeVisible({ timeout: 20_000 });
    await adminPage.getByRole('button', { name: 'Alertas por correo' }).click();
    await expect(adminPage.getByLabel('Avisar con (días de anticipación)')).toBeVisible({ timeout: 10_000 });
    await adminPage.keyboard.press('Escape');
    await expect(adminPage.getByLabel('Avisar con (días de anticipación)')).toHaveCount(0);

    await adminPage.getByRole('tab', { name: 'Línea de tiempo' }).click();
    await expect(adminPage.getByRole('button', { name: 'Mes siguiente' })).toBeVisible({ timeout: 20_000 });
  });
});
