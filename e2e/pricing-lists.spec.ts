import { test, expect, submitReliably } from './fixtures';
import sql from 'mssql';
import fs from 'fs';
import path from 'path';

// Everything here reads or writes the ERP (the Listas tab loads price lists from
// Profit Plus), hence @mssql. The write test only runs against the local mock ERP.

function loadDbEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(path.resolve(__dirname, '..', '.env.local'), 'utf-8').split('\n')) {
    const m = /^(DB_[A-Z_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  return env;
}

test.describe('pricing lists @mssql', () => {
  async function viewerPage(browser: import('@playwright/test').Browser, adminPage: import('@playwright/test').Page) {
    const email = `pricing-lists-view-${Date.now()}@e2e.test`;
    const password = 'PricingView123!';
    const created = await adminPage.request.post('/api/admin/users', {
      data: { email, name: 'Pricing Lists Viewer', password, role: 'user' },
    });
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    const granted = await adminPage.request.put(`/api/admin/users/${id}/modules`, { data: { modules: ['pricing_view'] } });
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
    return { page, context, id };
  }

  test('a pricing_view user sees the rates grid read-only', async ({ browser, adminPage }) => {
    const { page, context, id } = await viewerPage(browser, adminPage);
    try {
      const lists = (await (await page.request.get('/api/pricing/lists')).json()).priceLists as { coPrecio: string; rateCount: number }[];
      const withRates = lists.find(l => l.rateCount > 0)!;
      await page.goto(`/pricing?tab=listas&list=${withRates.coPrecio}`);
      await expect(page.getByRole('heading', { name: 'Tarifas de la lista' }).or(page.getByRole('region', { name: 'Tarifas de la lista' }))).toBeVisible({ timeout: 20_000 });
      // a real data row is rendered, so the zero-count assertions below are not vacuous
      await expect(page.locator('tbody tr:not([aria-hidden])').first().getByRole('textbox').first()).toBeDisabled({ timeout: 20_000 });

      await expect(page.getByRole('button', { name: 'Aplicar', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: '+ Nueva lista' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Clonar' })).toBeDisabled();
      await expect(page.getByRole('checkbox', { name: /Seleccionar/ })).toHaveCount(0);

      await page.getByRole('button', { name: 'Ayuda de esta página' }).click();
      const dialog = page.getByRole('dialog', { name: 'Panel de ayuda' });
      await expect(dialog.getByRole('heading', { name: 'Listas de precio y tarifas' })).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
      await adminPage.request.delete(`/api/admin/users/${id}`);
    }
  });

  test.describe('edit user', () => {
    const env = loadDbEnv();
    const listName = `E2E lista ${Date.now()}`;
    let createdCo: string | null = null;

    test.afterAll(async () => {
      if (!createdCo || env.DB_SERVER !== 'localhost') return;
      const pool = await new sql.ConnectionPool({
        server: env.DB_SERVER, port: parseInt(env.DB_PORT ?? '1433'), database: env.DB_NAME,
        user: env.DB_USER, password: env.DB_PASSWORD,
        options: { encrypt: env.DB_ENCRYPT === 'true', trustServerCertificate: env.DB_TRUST_SERVER_CERT !== 'false' },
      }).connect();
      try {
        await pool.request().input('l', sql.Char(6), createdCo)
          .query('DELETE FROM saArtPrecio WHERE co_precio = @l; DELETE FROM saTipoPrecio WHERE co_precio = @l');
      } finally { await pool.close(); }
    });

    // A brand-new list is empty and the grid only lists articles that already have a rate, so the
    // throwaway list is made through Clonar (which also exercises that dialog); its rows are then
    // removed in afterAll. The price change uses a FUTURE date, so no current price is touched.
    test('clones a list, stages a price and applies it as a scheduled change', async ({ adminPage }) => {
      test.skip(env.DB_SERVER !== 'localhost', 'writes to the ERP: local mock only');
      const lists = (await (await adminPage.request.get('/api/pricing/lists')).json()).priceLists as
        { coPrecio: string; rateCount: number; coMone: string | null }[];
      const source = lists.find(l => l.rateCount > 0 && l.coMone)!;
      const d = new Date(Date.now() + 2 * 86_400_000);
      const future = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      await adminPage.goto(`/pricing?tab=listas&list=${source.coPrecio}`);
      await expect(adminPage.locator('tbody tr:not([aria-hidden])').first()).toBeVisible({ timeout: 20_000 });
      await adminPage.getByRole('button', { name: 'Clonar', exact: true }).click();
      await adminPage.getByRole('textbox', { name: 'Nombre', exact: true }).fill(listName);
      await adminPage.getByRole('button', { name: 'Clonar lista' }).click();

      await expect.poll(() => new URL(adminPage.url()).searchParams.get('list'), { timeout: 20_000 }).not.toBe(source.coPrecio);
      createdCo = new URL(adminPage.url()).searchParams.get('list');
      await expect(adminPage.getByRole('heading', { name: new RegExp(listName) })).toBeVisible({ timeout: 20_000 });

      const row = adminPage.locator('tbody tr:not([aria-hidden])').first();
      const input = row.getByRole('textbox').first();
      await expect(input).toBeEnabled({ timeout: 20_000 });
      await input.fill('9999,99');
      await input.press('Enter');
      await expect(adminPage.getByText('1 cambio pendiente')).toBeVisible();

      await adminPage.getByLabel('Vigente desde:', { exact: true }).fill(future);
      await adminPage.getByRole('button', { name: 'Aplicar', exact: true }).click();
      await expect(adminPage.getByText('Programado')).toBeVisible();
      await adminPage.getByRole('button', { name: /^Confirmar 1 cambio/ }).click();
      await expect(adminPage.getByRole('heading', { name: /^Éxito/ })).toBeVisible({ timeout: 20_000 });
      await adminPage.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
      await expect(adminPage.getByText('0 cambios pendientes')).toBeVisible();
    });
  });
});
