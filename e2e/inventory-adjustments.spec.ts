import { test, expect, submitReliably } from './fixtures';

// @mssql — /inventario/ajustes reads real saStockAlmacen rows and, on
// submit, calls pApiCrearAjusteInventario against the real Ncake_a
// database via the profitplus-erp-mock container (see docker/README.md).
//
// "Register adjustment" tests below submit a real +1 recount, then a real
// -1 recount, so the article's actual stock nets back to its original
// value by the end of the spec. There is no delete/void flow in the app
// (by design — see mssql-migrations/0002_pApiCrearAjusteInventario.sql),
// so each run does leave two small, real saAjuste/saAjusteReng rows behind
// — net-zero stock impact, accepted as harmless audit noise rather than
// worked around.

test.describe('inventario/ajustes @mssql', () => {
  test('access is denied without the inventory module grant', async ({ page }) => {
    // reset-flow@e2e.test's password stays ResetFlowPass123! only as long as
    // this doesn't run in the same invocation as password-reset.spec.ts's
    // full-flow test, which changes it — see inventory-items.spec.ts's
    // equivalent test for the full explanation.
    await submitReliably(page, async () => {
      await page.goto('/login');
      await page.getByLabel('Correo electrónico').fill('reset-flow@e2e.test');
      await page.getByLabel('Contraseña', { exact: true }).fill('ResetFlowPass123!');
      await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    });
    await page.waitForURL('/reports/ventas');

    await page.goto('/inventario/ajustes');
    await page.waitForURL('/reports/ventas');
  });

  async function waitForRowsLoaded(page: import('@playwright/test').Page): Promise<number> {
    const emptyState = page.getByText('No hay artículos que coincidan con la búsqueda.');
    const firstRow = page.locator('table tbody tr').first();
    await expect(emptyState.or(firstRow)).toBeVisible({ timeout: 15_000 });
    return page.locator('table tbody tr').count();
  }

  async function selectFirstRow(page: import('@playwright/test').Page) {
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });
    await firstRow.click();
  }

  test('selecting an article shows its current stock and disables submit until a count is entered', async ({ userPage }) => {
    await userPage.goto('/inventario/ajustes');
    const rowCount = await waitForRowsLoaded(userPage);
    test.skip(rowCount < 1, 'No artículo/almacén rows available in this data');

    await selectFirstRow(userPage);
    await expect(userPage.locator('[aria-label="Stock actual"]')).toBeVisible();

    const submitButton = userPage.getByRole('button', { name: 'Registrar Ajuste' });
    await expect(submitButton).toBeDisabled();
  });

  test('entering a count equal to current stock keeps submit disabled (no-op guard)', async ({ userPage }) => {
    await userPage.goto('/inventario/ajustes');
    const rowCount = await waitForRowsLoaded(userPage);
    test.skip(rowCount < 1, 'No artículo/almacén rows available in this data');

    await selectFirstRow(userPage);

    const stockText = await userPage.locator('[aria-label="Stock actual"]').textContent();
    const currentStock = Number(stockText?.trim());
    expect(Number.isFinite(currentStock)).toBe(true);

    await userPage.getByLabel('Stock contado').fill(String(currentStock));
    await expect(userPage.getByRole('button', { name: 'Registrar Ajuste' })).toBeDisabled();
  });

  test('searching narrows the table to matching articles', async ({ userPage }) => {
    await userPage.goto('/inventario/ajustes');
    const totalRows = await waitForRowsLoaded(userPage);
    test.skip(totalRows < 1, 'No artículo/almacén rows available in this data');

    const firstRow = userPage.locator('table tbody tr').first();
    const coArt = (await firstRow.locator('td').first().textContent())?.trim();
    if (!coArt) throw new Error('Could not read co_art from the first row');

    await userPage.getByLabel('Buscar artículo').fill(coArt);
    const filteredRows = await userPage.locator('table tbody tr').count();
    expect(filteredRows).toBeGreaterThan(0);
    expect(filteredRows).toBeLessThanOrEqual(totalRows);

    const filteredCoArts = await userPage.locator('table tbody tr td:first-child').allTextContents();
    for (const value of filteredCoArts) {
      expect(value.trim()).toBe(coArt);
    }
  });

  test('registering a surplus then a matching shortage nets stock back to its original value', async ({ userPage }) => {
    await userPage.goto('/inventario/ajustes');
    const rowCount = await waitForRowsLoaded(userPage);
    test.skip(rowCount < 1, 'No artículo/almacén rows available in this data');

    await selectFirstRow(userPage);

    const stockText = await userPage.locator('[aria-label="Stock actual"]').textContent();
    const originalStock = Number(stockText?.trim());
    expect(Number.isFinite(originalStock)).toBe(true);

    // Surplus of 1.
    await userPage.getByLabel('Stock contado').fill(String(originalStock + 1));
    await expect(userPage.getByText(/Se registrará un sobrante de 1\./)).toBeVisible();
    await userPage.getByRole('button', { name: 'Registrar Ajuste' }).click();
    await expect(userPage.getByText(/^Ajuste .* registrado/)).toBeVisible({ timeout: 15_000 });
    const stockAfterSurplusText = await userPage.locator('[aria-label="Stock actual"]').textContent();
    expect(Number(stockAfterSurplusText?.trim())).toBe(originalStock + 1);

    // Shortage of 1, back to the original value.
    await userPage.getByLabel('Stock contado').fill(String(originalStock));
    await expect(userPage.getByText(/Se registrará un faltante de 1\./)).toBeVisible();
    await userPage.getByRole('button', { name: 'Registrar Ajuste' }).click();
    await expect(userPage.getByText(/^Ajuste .* registrado/)).toBeVisible({ timeout: 15_000 });

    await userPage.reload();
    await selectFirstRow(userPage);
    const finalStockText = await userPage.locator('[aria-label="Stock actual"]').textContent();
    expect(Number(finalStockText?.trim())).toBe(originalStock);
  });
});
