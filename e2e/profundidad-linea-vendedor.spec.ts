import { test, expect } from './fixtures';

// @mssql — requires the profitplus-erp-mock container with DWH_AlimentosNY
// migrated and loaded. Depends on the Profundidad de Línea tab existing
// (see e2e/profundidad-linea.spec.ts for the base tab's own coverage).

test.describe('profundidad-linea-vendedor @mssql', () => {
  test('leaderboard renders and scoping to a seller updates the matrix', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=profundidad');

    await expect(adminPage.getByRole('heading', { name: 'Cobertura por vendedor' })).toBeVisible({ timeout: 15_000 });
    const leaderboardSection = adminPage.locator('div', { has: adminPage.getByRole('heading', { name: 'Cobertura por vendedor' }) }).first();
    await expect(leaderboardSection.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const firstSellerName = await leaderboardSection.locator('table tbody tr').first().locator('td').first().textContent();
    await leaderboardSection.locator('table tbody tr').first().getByRole('button', { name: 'Ver detalle' }).click();

    await expect(adminPage.getByText(`Mostrando solo clientes de: ${firstSellerName}`)).toBeVisible({ timeout: 10_000 });

    await adminPage.getByRole('button', { name: 'Volver a vista general' }).click();
    await expect(adminPage.getByText('Mostrando solo clientes de:')).not.toBeVisible();
  });
});
