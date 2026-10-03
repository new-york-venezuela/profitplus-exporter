import { test, expect, submitReliably } from './fixtures';
import sql from 'mssql';
import fs from 'fs';
import path from 'path';

// The viewer test only reads SQLite (promotions) and the help markdown, so it runs in the default tier.
// The edit test builds a promotion through the wizard (preview reads the ERP) on a THROWAWAY list that it
// clones first, so it never touches a real list: @mssql, local mock ERP only. Segment-kind promotions
// are deliberately not created here (they move real customers).

function loadDbEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(path.resolve(__dirname, '..', '.env.local'), 'utf-8').split('\n')) {
    const m = /^(DB_[A-Z_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const iso = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test.describe('pricing promotions (view)', () => {
  test('a pricing_view user sees the promotions list but no edit controls, and the help panel', async ({ browser, adminPage }) => {
    const email = `pricing-promo-view-${Date.now()}@e2e.test`;
    const password = 'PricingView123!';
    const created = await adminPage.request.post('/api/admin/users', {
      data: { email, name: 'Pricing Promo Viewer', password, role: 'user' },
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

      await page.goto('/pricing?tab=promociones');
      await expect(page.getByRole('tab', { name: 'Promociones', selected: true })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('navigation', { name: 'Promociones' })).toBeVisible({ timeout: 20_000 });
      // the list has finished loading (so the zero-count assertions below are not vacuous)
      await expect(page.getByText('Selecciona una promoción para ver su detalle')).toBeVisible({ timeout: 20_000 });

      await expect(page.getByRole('button', { name: /Nueva promoción/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Cancelar', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Cambiar fecha de fin' })).toHaveCount(0);

      await page.getByRole('button', { name: 'Ayuda de esta página' }).click();
      const dialog = page.getByRole('dialog', { name: 'Panel de ayuda' });
      await expect(dialog.getByRole('heading', { name: 'Promociones de precio: los dos tipos' })).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
      await adminPage.request.delete(`/api/admin/users/${id}`);
    }
  });
});

test.describe('pricing promotions @mssql', () => {
  const env = loadDbEnv();
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

  test('an edit user creates an overlay promotion on a cloned list, then cancels it', async ({ adminPage }) => {
    test.skip(env.DB_SERVER !== 'localhost', 'writes to the ERP: local mock only');
    const listName = `E2E clon ${Date.now()}`;
    const promoName = `E2E promo ${Date.now()}`;

    // 1. throwaway list: clone of an existing one (captured right away so afterAll can clean up)
    await adminPage.goto('/pricing?tab=listas');
    await expect.poll(() => new URL(adminPage.url()).searchParams.get('list'), { timeout: 20_000 }).toBeTruthy();
    await expect(adminPage.locator('tbody tr:not([aria-hidden])').first()).toBeVisible({ timeout: 20_000 });
    await adminPage.getByRole('button', { name: 'Clonar', exact: true }).click();
    await adminPage.getByRole('textbox', { name: 'Nombre', exact: true }).fill(listName);
    const cloned = adminPage.waitForResponse(r => r.url().endsWith('/api/pricing/lists') && r.request().method() === 'POST');
    await adminPage.getByRole('button', { name: 'Clonar lista', exact: true }).click();
    createdCo = (await (await cloned).json()).priceList?.coPrecio ?? null;
    expect(createdCo).toBeTruthy();
    const listLabel = `${createdCo} · ${listName}`;

    // 2. wizard
    await adminPage.goto('/pricing?tab=promociones');
    await adminPage.getByRole('button', { name: /Nueva promoción/ }).click();
    await expect(adminPage.getByRole('heading', { name: 'Paso 1: Qué' })).toBeVisible({ timeout: 20_000 });
    await adminPage.getByLabel('Nombre de la promoción').fill(promoName);
    const picker = adminPage.getByRole('textbox', { name: 'Lista de precios' });
    await picker.click({ timeout: 8_000 });
    await picker.fill(listName, { timeout: 8_000 });
    await adminPage.getByRole('button', { name: listLabel, exact: true }).click({ timeout: 8_000 });
    await adminPage.getByRole('button', { name: 'Siguiente' }).click();

    await expect(adminPage.getByRole('heading', { name: 'Paso 2: Artículos y precio' })).toBeVisible();
    const row = adminPage.locator('tbody tr:not([aria-hidden])').first();
    const price = row.getByRole('textbox').first();
    await expect(price).toBeEnabled({ timeout: 20_000 });
    await price.fill('1,23');
    await price.press('Enter');
    await expect(adminPage.getByText('1 artículo con precio promocional')).toBeVisible();
    await adminPage.getByRole('button', { name: 'Siguiente' }).click();

    await expect(adminPage.getByRole('heading', { name: 'Paso 3: Fechas' })).toBeVisible();
    await adminPage.getByLabel('Inicio').fill(iso(2));
    await adminPage.getByLabel('Fin (inclusive)').fill(iso(4));
    await expect(adminPage.getByText('Termina en 4 días')).toBeVisible();
    await adminPage.getByRole('button', { name: 'Siguiente' }).click();

    await expect(adminPage.getByRole('heading', { name: 'Paso 4: Revisión' })).toBeVisible();
    const apply = adminPage.getByRole('button', { name: 'Aplicar', exact: true });
    await expect(apply).toBeEnabled({ timeout: 20_000 });
    await apply.click();

    // 3. listed as scheduled, then cancelled
    await expect(adminPage.getByRole('heading', { name: promoName })).toBeVisible({ timeout: 20_000 });
    await expect(adminPage.getByText('Programada').first()).toBeVisible();
    await adminPage.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await adminPage.getByRole('button', { name: 'Cancelar promoción', exact: true }).click();
    await expect(adminPage.getByText('Cancelada').first()).toBeVisible({ timeout: 20_000 });
  });
});
