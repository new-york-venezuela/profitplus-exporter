import { test, expect } from './fixtures';

// @mssql — requires the profitplus-erp-mock container running locally with
// DWH_AlimentosNY migrated and loaded (bun run migrate:dwh +
// bun run dwh:incremental-load). Excluded from default `bun run e2e`; run
// via `bun run e2e:mssql`. See e2e/analitica.spec.ts for the established
// pattern this file follows.
//
// A later plan (seller x depth-of-line coverage) added a second table
// ("Cobertura por vendedor" leaderboard) to this same page, above the
// matrix. A bare `table tbody tr` (or div-based ancestor scoping by
// "contains this heading") intermittently resolved against the wrong
// table — confirmed live across several attempts, including one where
// several nested divs in the actual markup satisfied a `has: heading`
// filter simultaneously (a title-only wrapper div with no table, and the
// real card div that does have one), so `.first()`/`.last()` picked
// inconsistently. Scoping directly off the matrix table's own unique
// column header ("Producto", not present in the leaderboard's
// Vendedor/Entidades/... columns) is unambiguous regardless of div
// nesting, and is what every test below now uses.
function matrixTable(page: import('@playwright/test').Page) {
  return page.locator('table').filter({ has: page.getByRole('columnheader', { name: 'Producto' }) });
}

// For the breadcrumb <nav>, which lives in the same card as the table but
// isn't inside the <table> itself — walk up from the table to its card
// ancestor (the `bg-white border...` div from tab-profundidad.tsx).
function matrixCard(page: import('@playwright/test').Page) {
  return matrixTable(page).locator('xpath=ancestor::div[contains(@class, "bg-white")][1]');
}

test.describe('profundidad-linea @mssql', () => {
  test('tab renders the matrix with segment columns and tier badges', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=profundidad');

    await expect(adminPage.getByRole('heading', { name: 'Profundidad de Línea' })).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText('Cadena', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Independientes', { exact: true })).toBeVisible();
    await expect(matrixTable(adminPage).locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });
  });

  test('drilling línea -> sublínea -> sku updates the breadcrumb', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=profundidad');
    const table = matrixTable(adminPage);
    await expect(table.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const firstRowLink = table.locator('tbody tr').first().locator('button').first();
    const lineaName = await firstRowLink.textContent();
    await firstRowLink.click();

    // Explicit timeout, matching the other network-dependent assertions in
    // this test: the default 5s occasionally wasn't enough margin for the
    // breadcrumb update to land under heavy parallel test-suite load.
    await expect(matrixCard(adminPage).locator('nav').getByText(lineaName ?? '', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(matrixTable(adminPage).locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });
  });

  test('clicking a segment penetration cell expands a gap list', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=profundidad');
    const table = matrixTable(adminPage);
    await expect(table.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const firstRow = table.locator('tbody tr').first();
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
    const table = matrixTable(adminPage);
    await expect(table.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const thresholdInput = adminPage.locator('label', { hasText: 'Primera línea' }).locator('input');
    await thresholdInput.fill('0');
    await expect(matrixTable(adminPage).locator('tbody').getByText('Primera línea').first()).toBeVisible({ timeout: 15_000 });
  });
});
