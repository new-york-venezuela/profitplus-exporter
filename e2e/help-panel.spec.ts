import { test, expect } from './fixtures';

// The help panel's data source (content/help/*.md served via GET
// /api/help/[page]) is pure SQLite-session-gated filesystem reads — no
// MSSQL dependency — so this belongs in the default tier, unlike the
// inventory pages it appears on.

test.describe('help panel', () => {
  test('opens, shows page-specific content, and closes on /inventario/articulos', async ({ userPage }) => {
    await userPage.goto('/inventario/articulos');
    await userPage.getByRole('button', { name: 'Ayuda de esta página' }).click();

    const dialog = userPage.getByRole('dialog', { name: 'Panel de ayuda' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Glosario de campos' })).toBeVisible({ timeout: 10_000 });

    await userPage.getByRole('button', { name: 'Cerrar ayuda' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('shows different content on /inventario/ajustes', async ({ userPage }) => {
    await userPage.goto('/inventario/ajustes');
    await userPage.getByRole('button', { name: 'Ayuda de esta página' }).click();

    const dialog = userPage.getByRole('dialog', { name: 'Panel de ayuda' });
    await expect(dialog.getByRole('heading', { name: 'Sobrante y faltante, ¿qué significan?' })).toBeVisible({ timeout: 10_000 });
  });

  test('shows different content on /inventario/dashboard', async ({ userPage }) => {
    await userPage.goto('/inventario/dashboard');
    await userPage.getByRole('button', { name: 'Ayuda de esta página' }).click();

    const dialog = userPage.getByRole('dialog', { name: 'Panel de ayuda' });
    await expect(dialog.getByRole('heading', { name: /Sobre el .stock negativo./ })).toBeVisible({ timeout: 10_000 });
  });

  test('clicking the backdrop also closes the panel', async ({ userPage }) => {
    await userPage.goto('/inventario/articulos');
    await userPage.getByRole('button', { name: 'Ayuda de esta página' }).click();

    const dialog = userPage.getByRole('dialog', { name: 'Panel de ayuda' });
    await expect(dialog).toBeVisible();

    // Click well outside the panel (it's a right-side slide-over, so the
    // far left of the viewport is always backdrop).
    await userPage.mouse.click(20, 300);
    await expect(dialog).not.toBeVisible();
  });
});
