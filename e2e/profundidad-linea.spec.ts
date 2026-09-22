import { test, expect } from './fixtures';

// @mssql — requires the profitplus-erp-mock container running locally with
// DWH_AlimentosNY migrated and loaded (bun run migrate:dwh +
// bun run dwh:incremental-load). Excluded from default `bun run e2e`; run
// via `bun run e2e:mssql`. See e2e/analitica.spec.ts for the established
// pattern this file follows.
//
// All table locators below are scoped to the "Profundidad de Línea" card
// specifically (via matrixSection), not a bare `table tbody tr` — a later
// plan (seller x depth-of-line coverage) added a second table to this same
// page (the "Cobertura por vendedor" leaderboard, above the matrix), and an
// unscoped selector intermittently resolved to that table's first row
// instead of the matrix's, causing a spurious failure when the leaderboard
// happened to mount/render first. See e2e/profundidad-linea-vendedor.spec.ts
// for that table's own coverage, and its own div-scoping for the same reason.

function matrixSection(page: import('@playwright/test').Page) {
  return page.locator('div', { has: page.getByRole('heading', { name: 'Profundidad de Línea' }) }).first();
}

test.describe('profundidad-linea @mssql', () => {
  test('tab renders the matrix with segment columns and tier badges', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=profundidad');

    await expect(adminPage.getByRole('heading', { name: 'Profundidad de Línea' })).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText('Cadena', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Independientes', { exact: true })).toBeVisible();
    await expect(matrixSection(adminPage).locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });
  });

  test('drilling línea -> sublínea -> sku updates the breadcrumb', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=profundidad');
    const section = matrixSection(adminPage);
    await expect(section.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const firstRowLink = section.locator('table tbody tr').first().locator('button').first();
    const lineaName = await firstRowLink.textContent();
    await firstRowLink.click();

    // Explicit timeout, matching the other network-dependent assertions in
    // this test: the default 5s occasionally wasn't enough margin for the
    // breadcrumb update to land under heavy parallel test-suite load.
    await expect(section.locator('nav').getByText(lineaName ?? '', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(section.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });
  });

  test('clicking a segment penetration cell expands a gap list', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=profundidad');
    const section = matrixSection(adminPage);
    await expect(section.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const firstRow = section.locator('table tbody tr').first();
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
    const section = matrixSection(adminPage);
    await expect(section.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const thresholdInput = adminPage.locator('label', { hasText: 'Primera línea' }).locator('input');
    await thresholdInput.fill('0');
    await expect(section.locator('table tbody').getByText('Primera línea').first()).toBeVisible({ timeout: 15_000 });
  });
});
