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

type Page = import('@playwright/test').Page;

// SearchableSelect is a text input + <li> list (not a native <select>), so pick
// an option by typing the code and clicking the matching list item.
async function pickFromSearchable(page: Page, inputSelector: string, coArt: string) {
  const input = page.locator(inputSelector);
  await input.click();
  await input.fill(coArt);
  await page.locator('ul li', { hasText: coArt }).first().click();
}

// Open the recipe for coArt, creating it first if a previous run didn't leave one.
// Creating redirects straight to the editor.
async function openOrCreateRecipe(page: Page, coArt: string) {
  await page.goto('/recetas');
  await expect(page.getByLabel('Crear receta para un producto')).toBeVisible({ timeout: 10_000 });
  const row = page.getByRole('row', { name: new RegExp(coArt) });
  if (await row.isVisible().catch(() => false)) {
    await row.getByRole('link', { name: /Editar receta/ }).click();
  } else {
    await pickFromSearchable(page, '#new-recipe-article', coArt);
    await page.getByRole('button', { name: 'Crear Receta' }).click();
  }
  await expect(page).toHaveURL(/\/recetas\/\d+/);
}

async function deleteRecipe(page: Page) {
  await page.getByRole('button', { name: 'Eliminar receta' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, eliminar' }).click();
  await page.waitForURL('/recetas');
}

test.describe('recetas @mssql', () => {
  test('creates a recipe, saves ERP + manual lines, and sees a live FIFO cost', async ({ adminPage }) => {
    await openOrCreateRecipe(adminPage, '0000005');

    // Add an ERP-article line using a real raw material with known FIFO layers.
    await adminPage.getByRole('button', { name: '+ Insumo de Profit Plus' }).click();
    await pickFromSearchable(adminPage, '#line-0-item', '0000083');
    await adminPage.locator('#line-0-qty').fill('0.2');

    // Add a manual line for a non-ERP ingredient (e.g. water).
    await adminPage.getByRole('button', { name: '+ Insumo manual' }).click();
    await adminPage.getByPlaceholder('Ej: Agua').fill('Agua');
    await adminPage.locator('#line-1-qty').fill('0.15');
    await adminPage.locator('#line-1-cost').fill('0.05');

    await adminPage.getByRole('button', { name: 'Guardar Receta' }).click();
    await expect(adminPage.getByText('✓ Cambios guardados')).toBeVisible({ timeout: 10_000 });

    // Assert the live cost panel renders a computed USD total.
    await expect(adminPage.getByText('Costo de Fabricación (en vivo)')).toBeVisible();
    await expect(adminPage.getByTestId('cost-total')).toHaveText(/^\$\d+\.\d{4}$/, { timeout: 10_000 });

    // Clean up: delete the recipe so subsequent runs hit the "create" branch again.
    await deleteRecipe(adminPage);
  });

  test('blocks saving an invalid line and points at the field', async ({ adminPage }) => {
    await openOrCreateRecipe(adminPage, '0000005');

    await adminPage.getByRole('button', { name: '+ Insumo manual' }).click();
    await adminPage.getByRole('button', { name: 'Guardar Receta' }).click();
    await expect(adminPage.getByRole('alert').filter({ hasText: 'Corrige' })).toBeVisible();
    await expect(adminPage.getByText('Escribe el nombre del insumo')).toBeVisible();
    await expect(adminPage.getByText('Debe ser mayor que 0')).toBeVisible();

    await deleteRecipe(adminPage);
  });

  // UX invariant (see AGENTS.md → "Recipes / Product Costing (FIFO)"): a
  // line with no purchase history must render as "Sin datos", never as a
  // silent $0.00 — and the recipe must be visibly flagged as incomplete.
  test('a no-purchase-history ingredient shows "Sin datos" and flags the recipe as incomplete, never a silent $0', async ({ adminPage }) => {
    await openOrCreateRecipe(adminPage, '0000001');

    await adminPage.getByRole('button', { name: '+ Insumo de Profit Plus' }).click();
    await pickFromSearchable(adminPage, '#line-0-item', '0000167');
    await adminPage.locator('#line-0-qty').fill('1');
    await adminPage.getByRole('button', { name: 'Guardar Receta' }).click();

    await expect(adminPage.getByText('Costo de Fabricación (en vivo)')).toBeVisible();
    // Shown both on the raw-material summary and the per-line breakdown.
    await expect(adminPage.getByText('Sin datos').first()).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText(/incompleto o estimado/)).toBeVisible();
    // The only line is the no-data ingredient, so the total must read $0.0000
    // (nothing else contributing) — but it must never be presented as if
    // that were a real, reliable cost; the warning banner above is what
    // makes that distinction visible to the user.
    await expect(adminPage.getByTestId('cost-total')).toHaveText('$0.0000');

    await deleteRecipe(adminPage);
  });
});
