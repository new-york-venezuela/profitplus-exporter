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
    return { page, context, id };
  }

  test('a pricing_view user sees the segment rail but no edit controls', async ({ browser, adminPage }) => {
    const { page, context, id } = await viewerPage(browser, adminPage);
    try {
      const segs = (await (await page.request.get('/api/pricing/segments')).json()).segments as { tipCli: string; customerCount: number }[];
      const withCustomers = segs.find(s => s.customerCount > 0)!;
      const first = (await (await page.request.get(`/api/pricing/customers?tipCli=${withCustomers.tipCli}&pageSize=1`)).json()).customers[0] as { cliDes: string };

      await page.goto(`/pricing?segment=${withCustomers.tipCli}`);
      await expect(page.getByRole('heading', { name: 'Segmentos', exact: true })).toBeVisible({ timeout: 20_000 });
      // wait until a real customer row is rendered, so the zero-count assertions below are not vacuous
      await expect(page.locator('tbody tr:not([aria-hidden])').first()).toContainText(first.cliDes, { timeout: 20_000 });

      await expect(page.getByRole('button', { name: 'Cambiar lista' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: '+ Nuevo' })).toHaveCount(0);
      await expect(page.getByRole('checkbox')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Mover a segmento/ })).toHaveCount(0);
    } finally {
      await context.close();
      await adminPage.request.delete(`/api/admin/users/${id}`);
    }
  });

  test('an edit user moves a customer to another segment and sees it under Éxito', async ({ adminPage }) => {
    const segs = (await (await adminPage.request.get('/api/pricing/segments')).json()).segments as
      { tipCli: string; desTipo: string; kind: string; customerCount: number }[];
    const source = segs.find(s => s.kind === 'group' && s.customerCount > 0)!;
    const target = segs.find(s => s.kind === 'group' && s.tipCli !== source.tipCli)!;
    const customer = (await (await adminPage.request.get(`/api/pricing/customers?tipCli=${source.tipCli}&pageSize=1`)).json())
      .customers[0] as { coCli: string; cliDes: string };

    try {
      await adminPage.goto(`/pricing?segment=${source.tipCli}`);
      const row = adminPage.locator('tbody tr', { hasText: customer.coCli });
      await expect(row).toBeVisible({ timeout: 20_000 });
      await row.getByRole('checkbox').check();
      await expect(adminPage.getByText('1 seleccionado')).toBeVisible();

      await adminPage.getByRole('button', { name: 'Mover a segmento…' }).click();
      const dialog = adminPage.getByRole('dialog');
      await dialog.getByPlaceholder('Buscar segmento').click();
      await dialog.getByRole('button', { name: target.desTipo, exact: true }).click();
      await dialog.getByRole('button', { name: 'Mover', exact: true }).click();

      const ok = adminPage.locator('section').filter({ has: adminPage.getByRole('heading', { name: /^Éxito/ }) });
      await expect(ok).toContainText(customer.cliDes, { timeout: 20_000 });
    } finally {
      // leave ERP state as found
      const back = await adminPage.request.post('/api/pricing/assignments', { data: { customerCodes: [customer.coCli], targetTipCli: source.tipCli } });
      expect(back.ok()).toBe(true);
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
