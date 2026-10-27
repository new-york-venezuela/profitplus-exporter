import { test, expect, submitReliably } from './fixtures';

// A customer with open FACT rows in the restored Ncake_a ERP copy.
const CUSTOMER = 'J412473875';

test.describe('estados de cuenta access', () => {
  test('a user without the grant is redirected and the API returns 403', async ({ userPage }) => {
    await userPage.goto('/estados-de-cuenta');
    await expect(userPage).toHaveURL(/\/reports\/ventas/);
    const res = await userPage.request.get('/api/statements/customers');
    expect(res.status()).toBe(403);
  });

  test('an unauthenticated request gets 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    try {
      const res = await ctx.get('/api/statements/customers');
      expect(res.status()).toBe(401);
    } finally {
      await ctx.dispose();
    }
  });

  test('a user with the statements grant can open the page', async ({ browser, adminPage }) => {
    const email = `statements-user-${Date.now()}@e2e.test`;
    const password = 'StatementsUser123!';
    const created = await adminPage.request.post('/api/admin/users', {
      data: { email, name: 'Statements Viewer', password, role: 'user' },
    });
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    const granted = await adminPage.request.put(`/api/admin/users/${id}/modules`, { data: { modules: ['statements'] } });
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
      await page.goto('/estados-de-cuenta');
      await expect(page).toHaveURL(/\/estados-de-cuenta/);
      await expect(page.getByRole('heading', { name: 'Estados de cuenta' })).toBeVisible({ timeout: 20_000 });
    } finally {
      await context.close();
    }
  });
});

test.describe('estados de cuenta pdf @mssql', () => {
  test('admin picks a customer and downloads a PDF', async ({ adminPage }) => {
    await adminPage.goto('/estados-de-cuenta');
    const input = adminPage.getByLabel('Cliente');
    await expect(input).toBeVisible({ timeout: 30_000 });
    await input.click();
    await input.fill(CUSTOMER);
    await adminPage.locator('ul li', { hasText: CUSTOMER }).first().click();

    const [download] = await Promise.all([
      adminPage.waitForEvent('download', { timeout: 60_000 }),
      adminPage.getByText('Descargar PDF').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^\S+-.+\.pdf$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c as Buffer);
    expect(Buffer.concat(chunks).subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  test('unknown customer code returns 404 with an error body', async ({ adminPage }) => {
    const res = await adminPage.request.get('/api/statements/ZZZZ-NOPE');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });
});
