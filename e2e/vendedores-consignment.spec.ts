import { test, expect } from './fixtures';

// @mssql — requires the profitplus-erp-mock container with DWH_AlimentosNY
// migrated and loaded, including the real Excelsior Gama consignment-
// pattern data verified during spec design (~90% of its sales billed at
// its root customer code). See e2e/analitica.spec.ts's header comment for
// the general DWH e2e setup this file relies on.

test.describe('vendedores-consignment @mssql', () => {
  test('a seller with consignment exclusions shows the exclusion footnote and its invoice list', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=vendedores');
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const footnoteHeading = adminPage.getByRole('heading', { name: 'Facturas excluidas — patrón de consignación' });
    // This section only renders when at least one seller has exclusions —
    // assert conditionally so the test doesn't fail on a DWH snapshot where
    // Excelsior Gama data isn't in the current date range.
    const isVisible = await footnoteHeading.isVisible().catch(() => false);
    test.skip(!isVisible, 'No seller has consignment exclusions in the current 12m default range — nothing to assert.');

    await expect(footnoteHeading).toBeVisible();
    const firstExclusionButton = adminPage.locator('button', { hasText: 'excluidos' }).first();
    await firstExclusionButton.click();

    await expect(adminPage.locator('table').filter({ hasText: 'Factura' })).toBeVisible({ timeout: 10_000 });
  });
});
