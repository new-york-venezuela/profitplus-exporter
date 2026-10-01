// e2e/mapa.spec.ts
import { test, expect } from './fixtures';

test.describe('mapa access', () => {
  test('a user without the geo grant is redirected away from /mapa', async ({ userPage }) => {
    await userPage.goto('/mapa');
    await expect(userPage).toHaveURL(/\/reports\/ventas/);
  });

  test('a user without the geo grant gets 403 from the API', async ({ userPage }) => {
    const res = await userPage.request.get('/api/mapa/clientes');
    expect(res.status()).toBe(403);
  });

  test('admin sees the Mapa de Clientes link', async ({ adminPage }) => {
    await expect(adminPage.getByRole('link', { name: 'Mapa de Clientes' })).toBeVisible();
  });
});

// @mssql — needs the ERP mock + DWH loaded (see e2e/analitica.spec.ts header).
test.describe('mapa @mssql', () => {
  test('loads, filters are URL-synced, and the table view toggles', async ({ adminPage }) => {
    await adminPage.goto('/mapa');
    await expect(adminPage.getByTestId('customer-map')).toBeVisible({ timeout: 20_000 });

    await adminPage.getByLabel('Segmento (Pareto)').selectOption('A');
    await expect(adminPage).toHaveURL(/pareto=A/);
    await expect(adminPage.getByRole('list', { name: 'Filtros activos' }).getByText('Segmento: A')).toBeVisible();

    await adminPage.getByRole('button', { name: 'Tabla' }).click();
    await expect(adminPage.getByRole('table', { name: 'Clientes' })).toBeVisible();

    await adminPage.getByRole('button', { name: /Quitar filtro Segmento: A/ }).click();
    await expect(adminPage).not.toHaveURL(/pareto=/);
  });

  test('create and delete a route', async ({ adminPage }) => {
    const routeName = `E2E Ruta ${Date.now()}`;   // unique, so a failed earlier run cannot cause a 409
    await adminPage.goto('/mapa');
    await adminPage.getByRole('tab', { name: /Rutas/ }).click();

    const panel = adminPage.getByRole('region', { name: 'Rutas' });
    await panel.getByLabel('Nueva ruta').fill(routeName);
    await panel.getByPlaceholder('Vendedor…').click();
    // SearchableSelect renders the "Seleccione vendedor" reset option first, then one button per seller.
    await panel.locator('form ul li button').nth(1).click();
    await panel.getByRole('button', { name: 'Crear ruta' }).click();

    const list = adminPage.getByRole('list', { name: 'Rutas existentes' });
    await expect(list.getByText(routeName)).toBeVisible();

    await list.locator('li', { hasText: routeName }).getByRole('button', { name: 'Eliminar' }).click();
    await expect(adminPage.getByRole('heading', { name: 'Eliminar ruta' })).toBeVisible();   // modal sits above the map
    await adminPage.locator('div.fixed.inset-0').getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(list.getByText(routeName)).not.toBeVisible();
  });
});
