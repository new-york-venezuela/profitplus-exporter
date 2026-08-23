import { test, expect, submitReliably } from './fixtures';

// @mssql — /inventario/articulos reads/writes real saArticulo rows in the
// Ncake_a database via the profitplus-erp-mock container. See
// docker/README.md and reports.spec.ts's header comment for what that
// container actually is (a real production backup, not synthetic data).
//
// The editing test mutates a real article's art_des/ref fields through the
// actual UI (not direct SQL) and restores the original values the same way
// before finishing, so the spec is self-cleaning even though it writes to
// shared data. It always acts on whichever article renders as the first
// row rather than a hardcoded co_art, so it stays valid if the catalog
// changes — but that also means it depends on at least one article having
// stock in a warehouse the app can see (true for the current Ncake_a data;
// see lib/inventory's empty-allowlist-means-all-warehouses fallback).

test.describe('inventario/articulos @mssql', () => {
  test('access is denied without the inventory module grant', async ({ page }) => {
    // reset-flow@e2e.test has no inventory module grant (see scripts/e2e-seed.ts).
    await submitReliably(page, async () => {
      await page.goto('/login');
      await page.getByLabel('Correo electrónico').fill('reset-flow@e2e.test');
      await page.getByLabel('Contraseña', { exact: true }).fill('ResetFlowPass123!');
      await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    });
    await page.waitForURL('/reports/ventas');

    await page.goto('/inventario/articulos');
    await page.waitForURL('/reports/ventas');
  });

  test('lists real articles with their current stock', async ({ userPage }) => {
    await userPage.goto('/inventario/articulos');
    await expect(userPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const rowCount = await userPage.locator('table tbody tr').count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('filtering by línea narrows the visible rows', async ({ userPage }) => {
    await userPage.goto('/inventario/articulos');
    await expect(userPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const totalRows = await userPage.locator('table tbody tr').count();

    const lineaSelect = userPage.getByLabel('Línea');
    const options = await lineaSelect.locator('option').allTextContents();
    // First option is always "Todas" (see articulos-client.tsx); need at
    // least one real línea option to exercise the filter meaningfully.
    test.skip(options.length < 2, 'No línea options available to filter by in this data');

    await lineaSelect.selectOption({ index: 1 });
    const filteredRows = await userPage.locator('table tbody tr').count();
    expect(filteredRows).toBeLessThanOrEqual(totalRows);
    expect(filteredRows).toBeGreaterThan(0);
  });

  // An article can render as more than one row (one per warehouse it has
  // stock in — see articulos-client.tsx's rowKey), so aria-labels are
  // `${field} ${coArt} (${coAlma})`, unique per row. This helper reads the
  // first row's own label back rather than assuming co_art alone identifies
  // a row.
  async function firstRowNameLabel(page: import('@playwright/test').Page): Promise<string> {
    const firstNameInput = page.locator('input[aria-label^="Nombre "]').first();
    await expect(firstNameInput).toBeVisible({ timeout: 15_000 });
    const label = await firstNameInput.getAttribute('aria-label');
    if (!label) throw new Error('First row Nombre input has no aria-label');
    return label.replace(/^Nombre /, '');
  }

  test('editing a safe field on the first article saves and persists, then is restored', async ({ userPage }) => {
    await userPage.goto('/inventario/articulos');
    const rowSuffix = await firstRowNameLabel(userPage);

    const nameField = userPage.getByLabel(`Nombre ${rowSuffix}`);
    const originalName = await nameField.inputValue();
    const newName = `${originalName} [e2e-test]`;

    await nameField.fill(newName);
    await expect(nameField).toHaveValue(newName);

    const saveButton = userPage.locator('table tbody tr', { has: nameField })
      .getByRole('button', { name: /^Guardar /, exact: false });
    await saveButton.click();
    await expect(userPage.getByText('Guardando…')).not.toBeVisible({ timeout: 10_000 });

    // Reload to confirm the save actually persisted server-side, not just
    // local component state.
    await userPage.reload();
    await expect(userPage.getByLabel(`Nombre ${rowSuffix}`)).toHaveValue(newName, { timeout: 15_000 });

    // Restore the original value through the same UI flow.
    const nameFieldAfterReload = userPage.getByLabel(`Nombre ${rowSuffix}`);
    await nameFieldAfterReload.fill(originalName);
    await expect(nameFieldAfterReload).toHaveValue(originalName);
    const saveButtonAfterReload = userPage.locator('table tbody tr', { has: nameFieldAfterReload })
      .getByRole('button', { name: /^Guardar /, exact: false });
    await saveButtonAfterReload.click();
    await expect(userPage.getByText('Guardando…')).not.toBeVisible({ timeout: 10_000 });

    await userPage.reload();
    await expect(userPage.getByLabel(`Nombre ${rowSuffix}`)).toHaveValue(originalName, { timeout: 15_000 });
  });

  test('attempting to save an over-length reference shows a validation error', async ({ userPage }) => {
    await userPage.goto('/inventario/articulos');
    const rowSuffix = await firstRowNameLabel(userPage);

    // ref is varchar(20) in saArticulo (see lib/inventory/item-fields.ts's
    // ITEM_FIELD_MAX_LEN) — 21 chars is one over the real column width.
    const refField = userPage.getByLabel(`Referencia ${rowSuffix}`);
    const originalRef = await refField.inputValue();
    await refField.fill('A'.repeat(21));
    await expect(refField).toHaveValue('A'.repeat(21));

    const saveButton = userPage.locator('table tbody tr', { has: refField })
      .getByRole('button', { name: /^Guardar /, exact: false });
    await saveButton.click();

    await expect(userPage.getByText(/máximo 20 caracteres/)).toBeVisible({ timeout: 10_000 });

    // The failed save shouldn't have changed anything server-side; restore
    // the field to its original value for test hygiene regardless.
    await refField.fill(originalRef);
  });
});
