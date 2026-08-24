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
    // Its password stays ResetFlowPass123! only as long as this doesn't run in
    // the same invocation as password-reset.spec.ts's full-flow test, which
    // changes it — safe today since that spec isn't @mssql-tagged and `bun run
    // e2e`/`bun run e2e:mssql` are mutually exclusive, but a future change to
    // that split would need this login to move to a dedicated account.
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

  test('setting stock_min above stock_max shows the CK_saArticulo_Stock error', async ({ userPage }) => {
    await userPage.goto('/inventario/articulos');
    const rowSuffix = await firstRowNameLabel(userPage);

    const minField = userPage.getByLabel(`Mín ${rowSuffix}`);
    const maxField = userPage.getByLabel(`Máx ${rowSuffix}`);
    const originalMin = await minField.inputValue();
    const originalMax = await maxField.inputValue();

    // saArticulo has a live CK_saArticulo_Stock CHECK constraint enforcing
    // stock_min <= stock_max (see app/api/inventory/items/[co_art]/route.ts's
    // error.number === 547 handling). Force a violation regardless of the
    // row's real current values by setting min above whatever max already is.
    const forcedMax = Number(originalMax) || 0;
    await maxField.fill(String(forcedMax));
    await minField.fill(String(forcedMax + 1));
    await expect(minField).toHaveValue(String(forcedMax + 1));

    const saveButton = userPage.locator('table tbody tr', { has: minField })
      .getByRole('button', { name: /^Guardar /, exact: false });
    await saveButton.click();

    // The DB's own constraint-violation message is surfaced verbatim by the
    // route (not a fixed app-authored string), so match loosely on the
    // constraint name rather than exact wording.
    await expect(userPage.getByText(/CK_saArticulo_Stock/)).toBeVisible({ timeout: 10_000 });

    // The failed save shouldn't have changed anything server-side; restore
    // both fields to their original values for test hygiene regardless.
    await minField.fill(originalMin);
    await maxField.fill(originalMax);
  });

  test('shows a non-blocking inline warning when Mín exceeds Máx', async ({ userPage }) => {
    await userPage.goto('/inventario/articulos');
    const rowSuffix = await firstRowNameLabel(userPage);

    const minField = userPage.getByLabel(`Mín ${rowSuffix}`);
    const maxField = userPage.getByLabel(`Máx ${rowSuffix}`);
    const originalMin = await minField.inputValue();
    const originalMax = await maxField.inputValue();

    const forcedMax = Number(originalMax) || 0;
    await maxField.fill(String(forcedMax));
    await minField.fill(String(forcedMax + 1));
    await expect(minField).toHaveValue(String(forcedMax + 1));

    const row = userPage.locator('table tbody tr', { has: minField });
    await expect(row.getByText('El mínimo no puede ser mayor que el máximo')).toBeVisible();

    // Must stay enabled — this is a warning, not a block. The existing test
    // 'setting stock_min above stock_max shows the CK_saArticulo_Stock error'
    // depends on being able to click Guardar in exactly this state.
    const saveButton = row.getByRole('button', { name: /^Guardar /, exact: false });
    await expect(saveButton).toBeEnabled();

    // Restore original values for test hygiene; no save occurred so nothing
    // server-side changed, but leave the UI as it was found.
    await minField.fill(originalMin);
    await maxField.fill(originalMax);
  });

  test('Ajustar link on Artículos preselects the same article in Ajustes', async ({ userPage }) => {
    await userPage.goto('/inventario/articulos');
    const firstRow = userPage.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });
    const coArt = (await firstRow.locator('td').first().textContent())?.trim();

    await firstRow.getByRole('link', { name: 'Ajustar stock →' }).click();
    await userPage.waitForURL(/\/inventario\/ajustes\?co_art=/);

    await expect(userPage.getByText(new RegExp(`Ajustando.*${coArt}`))).toBeVisible({ timeout: 10_000 });
  });
});
