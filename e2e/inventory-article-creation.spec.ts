import { test, expect } from './fixtures';
import sql from 'mssql';

// @mssql — submitting the create-article form calls pApiCrearArticuloInventario
// and the warehouse-assignment endpoint against the real Ncake_a database via
// the profitplus-erp-mock container. Profit Plus has no article-deletion flow
// in the app itself, so the "creating an article…" test below cleans up its
// own saStockAlmacen/saArtUnidad/saArticulo rows directly via a raw MSSQL
// connection at the end of the test — the same DELETE pattern already proven
// safe by __tests__/integration/pApiCrearArticuloInventario.integration.test.ts's
// cleanupArticle() helper. A prior whole-branch review found 6 accumulated
// "Producto E2E Test *" rows left behind by repeated runs during this
// branch's development and had to clean them up by hand; this is a real fix
// for that, not an accepted trade-off.

function buildTestConfig(): sql.config {
  return {
    server: process.env.DB_SERVER!,
    port: parseInt(process.env.DB_PORT ?? '1433'),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
    },
  };
}

async function cleanupArticleByName(artDes: string): Promise<void> {
  const pool = await new sql.ConnectionPool(buildTestConfig()).connect();
  try {
    const result = await pool.request()
      .input('artDes', sql.VarChar(120), artDes)
      .query(`SELECT co_art FROM saArticulo WHERE art_des = @artDes`);
    for (const row of result.recordset) {
      const coArt = (row.co_art as string);
      await pool.request().input('a', sql.Char(30), coArt).query(`DELETE FROM saStockAlmacen WHERE co_art = @a`);
      await pool.request().input('a', sql.Char(30), coArt).query(`DELETE FROM saArtUnidad WHERE co_art = @a`);
      await pool.request().input('a', sql.Char(30), coArt).query(`DELETE FROM saArticulo WHERE co_art = @a`);
    }
  } finally {
    await pool.close();
  }
}

test.describe('inventario/articulos — crear artículo @mssql', () => {
  // The create-article panel's field labels ("Nombre", "Línea", "Categoría", …)
  // are intentionally short and reappear elsewhere on this page — as substrings
  // of the top-of-page línea/categoría filter labels, and (once the panel is
  // open) as substrings of every table row's "Nombre <coArt> (<coAlma>)"
  // aria-label. Playwright's getByLabel does a case-insensitive substring
  // match, so unscoped lookups resolve to multiple elements once real item
  // rows are on the page. Scoping to the panel (data-testid="create-article-panel"
  // in articulos-client.tsx) keeps the field labels unscoped/plain in the UI
  // while making the locators unambiguous.
  function createPanel(page: import('@playwright/test').Page) {
    return page.getByTestId('create-article-panel');
  }

  test('form validation: submit disabled until all required fields are filled', async ({ userPage }) => {
    await userPage.goto('/inventario/articulos');
    await userPage.getByRole('button', { name: '+ Crear artículo nuevo' }).click();
    const panel = createPanel(userPage);

    const submitButton = userPage.getByRole('button', { name: 'Crear artículo' });
    await expect(submitButton).toBeDisabled();

    await expect(panel.getByLabel('Código')).not.toHaveValue('');

    await panel.getByLabel('Nombre').fill('Producto E2E Test');
    await expect(submitButton).toBeDisabled();

    await panel.getByLabel('Tipo').selectOption('M');
    await expect(submitButton).toBeDisabled();

    const lineaSelect = panel.getByLabel('Línea', { exact: true });
    await expect(lineaSelect.locator('option')).not.toHaveCount(1, { timeout: 15_000 });
    const lineaOptions = await lineaSelect.locator('option').all();
    await lineaSelect.selectOption({ index: 1 });
    void lineaOptions;
    await expect(submitButton).toBeDisabled();

    const sublineaSelect = panel.getByLabel('Sub-línea');
    await expect(sublineaSelect.locator('option')).not.toHaveCount(1, { timeout: 15_000 });
    await sublineaSelect.selectOption({ index: 1 });
    await expect(submitButton).toBeDisabled();

    await panel.getByLabel('Categoría').selectOption({ index: 1 });
    await expect(submitButton).toBeDisabled();

    await panel.getByLabel('Unidad').selectOption({ index: 1 });
    await expect(submitButton).toBeDisabled();

    await panel.getByLabel('Almacén inicial').selectOption({ index: 1 });
    await expect(submitButton).toBeEnabled();
  });

  test('Sub-línea options are empty until a Línea is chosen', async ({ userPage }) => {
    await userPage.goto('/inventario/articulos');
    await userPage.getByRole('button', { name: '+ Crear artículo nuevo' }).click();
    const panel = createPanel(userPage);

    const sublineaSelect = panel.getByLabel('Sub-línea');
    await expect(sublineaSelect.locator('option')).toHaveCount(1); // just the placeholder

    const lineaSelect = panel.getByLabel('Línea', { exact: true });
    await expect(lineaSelect.locator('option')).not.toHaveCount(1, { timeout: 15_000 });
    await lineaSelect.selectOption({ index: 1 });

    await expect(sublineaSelect.locator('option')).not.toHaveCount(1, { timeout: 15_000 });
  });

  test('creating an article makes it appear in the items list at 0 stock', async ({ userPage }) => {
    const uniqueName = `Producto E2E Test ${Date.now()}`;
    try {
      await userPage.goto('/inventario/articulos');
      await userPage.getByRole('button', { name: '+ Crear artículo nuevo' }).click();
      const panel = createPanel(userPage);

      const codigoInput = panel.getByLabel('Código');
      await expect(codigoInput).not.toHaveValue('', { timeout: 15_000 });
      const suggestedCode = await codigoInput.inputValue();
      expect(suggestedCode).toMatch(/^\d{7,}$/);

      await panel.getByLabel('Nombre').fill(uniqueName);
      await panel.getByLabel('Tipo').selectOption('M');
      await panel.getByLabel('Línea', { exact: true }).selectOption({ index: 1 });
      await expect(panel.getByLabel('Sub-línea').locator('option')).not.toHaveCount(1, { timeout: 15_000 });
      await panel.getByLabel('Sub-línea').selectOption({ index: 1 });
      await panel.getByLabel('Categoría').selectOption({ index: 1 });
      await panel.getByLabel('Unidad').selectOption({ index: 1 });
      await panel.getByLabel('Almacén inicial').selectOption({ index: 1 });

      await userPage.getByRole('button', { name: 'Crear artículo' }).click();
      await expect(userPage.getByText(/Artículo .* creado/)).toBeVisible({ timeout: 15_000 });

      await userPage.reload();
      // The article name renders as an <input value="…">, not text content, so
      // a `tr` locator with `hasText` (which matches textContent only) can
      // never find this row — locate by the row's Nombre input value instead,
      // matching the aria-label convention from inventory-items.spec.ts.
      const nameInput = userPage.locator(`input[value="${uniqueName}"]`);
      await expect(nameInput).toBeVisible({ timeout: 15_000 });
      const newRow = userPage.locator('tr', { has: nameInput });
      await expect(newRow.locator('td').nth(4)).toHaveText('0');
    } finally {
      // Delete the real saStockAlmacen/saArtUnidad/saArticulo rows this test
      // created — uniqueName is generated fresh per run (Date.now()-suffixed),
      // so this can never match a real, non-test article.
      await cleanupArticleByName(uniqueName);
    }
  });
});
