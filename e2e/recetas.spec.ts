import { test, expect } from './fixtures';

// @mssql — reads/writes only this app's own SQLite recipes tables, but the
// live cost computation reads real saCostoHistoricoEntrada/saTasa rows from
// the restored Ncake_a database via the profitplus-erp-mock container (see
// docker/README.md). Uses adminPage since role === 'admin' bypasses every
// module gate — no need to seed a 'recipes' grant for this test.
//
// Real article codes confirmed present in the restored backup, each chosen
// because it has the specific data shape this suite needs:
// '0000005' (Baguette 4 Granos 220gr) / '0000001' (Cheese Cake Plain 1500gr)
//   — distinct finished-good (tipo='V') articles, each with a real
//   saStockAlmacen row (required to appear in /api/inventory/items's
//   ITEMS_QUERY_BASE, which inner-joins saStockAlmacen) — kept as two
//   different articles so the two tests below can run in parallel without
//   colliding on the same recipe.
// '0000083' (Harina Panadera 45Kg Atlas) — has real saCostoHistoricoEntrada
//   layers, for the "real FIFO cost" path.
// '0000167' (Cebolla en Hojuela) — has a saStockAlmacen row but zero
//   saCostoHistoricoEntrada rows, for the "no purchase history" path. Note
//   this is NOT the same as '0000080' (Harina de trigo para pizzas 1 kg),
//   which also has zero cost layers but has no saStockAlmacen row at all —
//   that fails a level earlier (never appears in the ingredient picker).

function existingRecipeLink(page: import('@playwright/test').Page, coArt: string) {
  return page.getByRole('row', { name: new RegExp(coArt) }).getByRole('link', { name: 'Editar / Costo' });
}

test.describe('recetas @mssql', () => {
  test('creates a recipe, saves ERP + manual lines, and sees a live FIFO cost', async ({ adminPage }) => {
    await adminPage.goto('/recetas');
    // The create dropdown and the recipes table render from the same
    // client-side load — waiting for the dropdown to appear means the
    // table has settled too, so the row check right after it isn't racing
    // the initial fetch (a bare .isVisible() doesn't auto-wait/retry the
    // way expect().toBeVisible() does, so without this it can read "not
    // visible" just because the page hasn't finished loading yet).
    await expect(adminPage.getByLabel('Crear receta para un producto')).toBeVisible({ timeout: 10_000 });

    // Create a recipe for a real finished-good article. If a previous run
    // left this recipe behind (no delete-in-test-teardown convention in
    // this suite — see inventory-adjustments.spec.ts), skip straight to it
    // instead of failing on the duplicate-coArt rejection.
    const alreadyExists = await adminPage.getByRole('row', { name: /0000005/ }).isVisible().catch(() => false);

    if (!alreadyExists) {
      await adminPage.getByLabel('Crear receta para un producto').selectOption('0000005');
      await adminPage.getByRole('button', { name: 'Crear Receta' }).click();
      await expect(adminPage.getByRole('row', { name: /0000005/ })).toBeVisible({ timeout: 10_000 });
    }

    await existingRecipeLink(adminPage, '0000005').click();
    await expect(adminPage).toHaveURL(/\/recetas\/\d+/);

    // Add an ERP-article line using a real raw material with known FIFO layers.
    await adminPage.getByRole('button', { name: '+ Insumo de Profit Plus' }).click();
    await adminPage.locator('select').last().selectOption('0000083');
    const erpQuantityInput = adminPage.locator('input[type="number"]').nth(0);
    await erpQuantityInput.fill('0.2');

    // Add a manual line for a non-ERP ingredient (e.g. water).
    await adminPage.getByRole('button', { name: '+ Insumo manual' }).click();
    await adminPage.getByPlaceholder('Ej: Agua').fill('Agua');
    const manualQuantityInput = adminPage.locator('input[type="number"]').nth(1);
    await manualQuantityInput.fill('0.15');
    const manualCostInput = adminPage.locator('input[type="number"]').nth(2);
    await manualCostInput.fill('0.05');

    await adminPage.getByRole('button', { name: 'Guardar Receta' }).click();

    // Assert the live cost panel renders a computed USD total.
    await expect(adminPage.getByText('Costo de Fabricación (en vivo)')).toBeVisible();
    await expect(adminPage.getByText(/^\$\d+\.\d{4}$/)).toBeVisible({ timeout: 10_000 });

    // Clean up: delete the recipe so subsequent runs hit the "create" branch again.
    adminPage.once('dialog', dialog => dialog.accept());
    await adminPage.getByRole('button', { name: 'Eliminar receta' }).click();
    await adminPage.waitForURL('/recetas');
  });

  // UX invariant (see AGENTS.md → "Recipes / Product Costing (FIFO)"): a
  // line with no purchase history must render as "Sin datos", never as a
  // silent $0.00 — and the recipe must be visibly flagged as incomplete.
  test('a no-purchase-history ingredient shows "Sin datos" and flags the recipe as incomplete, never a silent $0', async ({ adminPage }) => {
    await adminPage.goto('/recetas');
    await expect(adminPage.getByLabel('Crear receta para un producto')).toBeVisible({ timeout: 10_000 });

    const alreadyExists = await adminPage.getByRole('row', { name: /0000001/ }).isVisible().catch(() => false);

    if (!alreadyExists) {
      await adminPage.getByLabel('Crear receta para un producto').selectOption('0000001');
      await adminPage.getByRole('button', { name: 'Crear Receta' }).click();
      await expect(adminPage.getByRole('row', { name: /0000001/ })).toBeVisible({ timeout: 10_000 });
    }

    await existingRecipeLink(adminPage, '0000001').click();
    await expect(adminPage).toHaveURL(/\/recetas\/\d+/);

    await adminPage.getByRole('button', { name: '+ Insumo de Profit Plus' }).click();
    await adminPage.locator('select').last().selectOption('0000167');
    await adminPage.locator('input[type="number"]').nth(0).fill('1');
    await adminPage.getByRole('button', { name: 'Guardar Receta' }).click();

    await expect(adminPage.getByText('Costo de Fabricación (en vivo)')).toBeVisible();
    await expect(adminPage.getByText('Sin datos')).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText(/incompleto o estimado/)).toBeVisible();
    // The only line is the no-data ingredient, so the total must read $0.0000
    // (nothing else contributing) — but it must never be presented as if
    // that were a real, reliable cost; the warning banner above is what
    // makes that distinction visible to the user.
    await expect(adminPage.getByText('$0.0000')).toBeVisible();

    adminPage.once('dialog', dialog => dialog.accept());
    await adminPage.getByRole('button', { name: 'Eliminar receta' }).click();
    await adminPage.waitForURL('/recetas');
  });
});
