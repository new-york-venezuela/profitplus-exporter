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

// @mssql — the page loads ERP + DWH data; the area flows themselves only need SQLite.
test.describe('mapa sales areas @mssql', () => {
  async function drawSquare(page: import('@playwright/test').Page, box: { x: number; y: number; width: number; height: number }, fx: number, fy: number, size: number) {
    const p = (dx: number, dy: number) => ({ x: box.x + box.width * (fx + dx), y: box.y + box.height * (fy + dy) });
    const pts = [p(0, 0), p(size, 0), p(size, size), p(0, size)];
    for (const pt of pts) await page.mouse.click(pt.x, pt.y);
    await page.mouse.click(pts[0].x, pts[0].y);              // clicking the first point closes the polygon
  }

  test('draw, save, reject an overlapping area, then delete', async ({ adminPage }) => {
    const suffix = Date.now();
    await adminPage.goto('/mapa');
    const map = adminPage.getByTestId('customer-map');
    await expect(map).toBeVisible({ timeout: 20_000 });
    await adminPage.getByRole('tab', { name: /Zonas/ }).click();
    const box = (await map.boundingBox())!;

    // first area
    await adminPage.getByRole('button', { name: 'Dibujar nueva zona' }).click();
    await drawSquare(adminPage, box, 0.2, 0.2, 0.2);
    await adminPage.getByLabel('Nombre').fill(`E2E Zona A ${suffix}`);
    await adminPage.getByRole('button', { name: 'Guardar zona' }).click();
    const list = adminPage.getByRole('list', { name: 'Zonas existentes' });
    await expect(list.getByText(`E2E Zona A ${suffix}`)).toBeVisible();

    // overlapping second area is rejected and names the first
    await adminPage.getByRole('button', { name: 'Dibujar nueva zona' }).click();
    await drawSquare(adminPage, box, 0.3, 0.3, 0.2);
    await adminPage.getByLabel('Nombre').fill(`E2E Zona B ${suffix}`);
    await adminPage.getByRole('button', { name: 'Guardar zona' }).click();
    await expect(adminPage.getByRole('alert')).toContainText(`E2E Zona A ${suffix}`);
    await adminPage.getByRole('button', { name: 'Cancelar' }).click();

    // delete the first
    await list.locator('li', { hasText: `E2E Zona A ${suffix}` }).getByRole('button', { name: 'Eliminar' }).click();
    await adminPage.locator('div.fixed.inset-0').getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(list.getByText(`E2E Zona A ${suffix}`)).not.toBeVisible();
  });

  test('Esc cancels drawing without creating an area', async ({ adminPage }) => {
    await adminPage.goto('/mapa');
    await expect(adminPage.getByTestId('customer-map')).toBeVisible({ timeout: 20_000 });
    await adminPage.getByRole('tab', { name: /Zonas/ }).click();
    await adminPage.getByRole('button', { name: 'Dibujar nueva zona' }).click();
    await expect(adminPage.getByText('Dibujando zona')).toBeVisible();
    await adminPage.keyboard.press('Escape');
    await expect(adminPage.getByText('Dibujando zona')).not.toBeVisible();
  });

  test('layer toggles show the choropleth legend', async ({ adminPage }) => {
    await adminPage.goto('/mapa');
    await expect(adminPage.getByTestId('customer-map')).toBeVisible({ timeout: 20_000 });
    await adminPage.getByLabel('Ingresos por zona').check();
    await expect(adminPage.getByRole('group', { name: 'Leyenda de ingresos por zona' })).toBeVisible();
    await adminPage.getByLabel('Densidad de ingresos').check();
    await adminPage.getByLabel('Clientes (pines)').uncheck();
  });
});
