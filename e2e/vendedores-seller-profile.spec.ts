import { test, expect } from './fixtures';

// @mssql — requires the profitplus-erp-mock container with DWH_AlimentosNY
// migrated and loaded, same as every other analitica tab (see
// e2e/analitica.spec.ts's header comment for the general DWH e2e setup this
// file relies on). Reuses this suite's adminPage fixture (e2e/fixtures.ts)
// and the same ?tab=vendedores direct-navigation pattern as
// e2e/vendedores-consignment.spec.ts and e2e/analitica.spec.ts — the tab bar
// in analitica-client.tsx reads its active tab from the `tab` query param,
// so no tab-button click is needed to land on Vendedores.

test.describe('vendedores-seller-profile @mssql', () => {
  test('clicking a seller name opens their profile and back returns to the list', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=vendedores');
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    await adminPage.getByText('Ver perfil').first().click();
    await expect(adminPage.getByText('← Volver a Vendedores')).toBeVisible();
    await expect(adminPage.getByText('Activación')).toBeVisible();
    await adminPage.getByText('← Volver a Vendedores').click();
    await expect(adminPage.getByText('Ver perfil').first()).toBeVisible();
  });
});
