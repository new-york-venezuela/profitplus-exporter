import { test, expect } from './fixtures';

// @mssql — requires the profitplus-erp-mock container running locally with
// DWH_AlimentosNY migrated and loaded (bun run migrate:dwh +
// bun run dwh:incremental-load). Excluded from default `bun run e2e`; run
// via `bun run e2e:mssql`. See e2e/analitica.spec.ts for the established
// pattern this file follows.

test.describe('profundidad-linea @mssql', () => {
  test('tab renders the matrix with segment columns and tier badges', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=profundidad');

    await expect(adminPage.getByRole('heading', { name: 'Profundidad de Línea' })).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText('Cadena', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Independientes', { exact: true })).toBeVisible();
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });
  });

  test('drilling línea -> sublínea -> sku updates the breadcrumb', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=profundidad');
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const firstRowLink = adminPage.locator('table tbody tr').first().locator('button').first();
    const lineaName = await firstRowLink.textContent();
    await firstRowLink.click();

    await expect(adminPage.locator('nav').getByText(lineaName ?? '', { exact: true })).toBeVisible();
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });
  });

  test('clicking a segment penetration cell expands a gap list', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=profundidad');
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const firstRow = adminPage.locator('table tbody tr').first();
    // Second <td> is the Cadena penetration cell (first is the product label).
    const cadenaCellButton = firstRow.locator('td').nth(1).locator('button');
    await cadenaCellButton.click();

    // Either a gap list or the "ninguna entidad" message must appear.
    await expect(
      adminPage.getByText(/Entidades en CADENA que no compran|Ninguna entidad activa está sin comprar/)
    ).toBeVisible({ timeout: 10_000 });
  });

  test('adjusting the first-line threshold changes tier badges', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=profundidad');
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const thresholdInput = adminPage.locator('label', { hasText: 'Primera línea' }).locator('input');
    await thresholdInput.fill('0');
    await expect(adminPage.locator('table tbody').getByText('Primera línea').first()).toBeVisible({ timeout: 15_000 });
  });
});
