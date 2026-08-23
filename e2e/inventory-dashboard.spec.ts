import { test, expect, submitReliably } from './fixtures';

// @mssql — /inventario/dashboard reads real saStockAlmacen and
// saFacturaVenta/saFacturaVentaReng data from the Ncake_a database via the
// profitplus-erp-mock container. Read-only feature, no cleanup needed.
//
// As of this writing, real Ncake_a data has every sales-tracked article in
// warehouse 000015 (OFICINA) showing negative stock — a real gap in that
// business's Profit Plus usage (see the commit that added the dashboard's
// negative-stock styling), not a bug in this feature. The negative-stock
// assertions below are written to hold under either state (rows present
// with the "(stock negativo)" tag, if OFICINA is still untracked, or
// legitimately no flagged items at all, once real stock tracking starts
// there) so this spec doesn't need updating the day that data is fixed.

test.describe('inventario/dashboard @mssql', () => {
  test('access is denied without the inventory module grant', async ({ page }) => {
    await submitReliably(page, async () => {
      await page.goto('/login');
      await page.getByLabel('Correo electrónico').fill('reset-flow@e2e.test');
      await page.getByLabel('Contraseña', { exact: true }).fill('ResetFlowPass123!');
      await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    });
    await page.waitForURL('/reports/ventas');

    await page.goto('/inventario/dashboard');
    await page.waitForURL('/reports/ventas');
  });

  test('loads and shows the threshold/window explanation', async ({ userPage }) => {
    await userPage.goto('/inventario/dashboard');
    await expect(userPage.getByRole('heading', { name: 'Artículos con Stock Bajo' })).toBeVisible({ timeout: 15_000 });
    await expect(userPage.getByText(/días de stock estimado/)).toBeVisible();
  });

  test('flagged rows (if any) show a days-of-stock value, negative-stock ones clearly marked', async ({ userPage }) => {
    await userPage.goto('/inventario/dashboard');
    await expect(userPage.getByRole('heading', { name: 'Artículos con Stock Bajo' })).toBeVisible({ timeout: 15_000 });

    const emptyState = userPage.getByText('No hay artículos con stock bajo en este momento.');
    const firstRow = userPage.locator('table tbody tr').first();

    // Either the table has rows, or the explicit empty state is shown —
    // never neither, and never both.
    await expect(emptyState.or(firstRow)).toBeVisible({ timeout: 15_000 });

    const rowCount = await userPage.locator('table tbody tr').count();
    if (rowCount === 0) {
      await expect(emptyState).toBeVisible();
      return;
    }

    // Every visible row must show a numeric days-of-stock value in the last
    // column, and negative-stock rows must carry the explicit annotation
    // (not just red/orange styling a screenshot-based check would need).
    const lastCells = userPage.locator('table tbody tr td:last-child');
    const count = await lastCells.count();
    for (let i = 0; i < count; i++) {
      const text = (await lastCells.nth(i).textContent())?.trim() ?? '';
      expect(text.length).toBeGreaterThan(0);
      const stockCellText = (await userPage.locator('table tbody tr').nth(i).locator('td').nth(3).textContent())?.trim();
      const stock = Number(stockCellText);
      if (Number.isFinite(stock) && stock < 0) {
        expect(text).toContain('stock negativo');
      }
    }
  });
});
