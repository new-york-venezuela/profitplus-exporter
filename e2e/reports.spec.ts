import { test, expect } from './fixtures';

// @mssql — requires the `profitplus-erp-mock` container (docker-compose.yml)
// running locally, with the real Ncake_a database restored (a production
// backup, not synthetic seed data — see docker/README.md). Excluded from
// default CI (see playwright.config.ts + `bun run e2e` vs `bun run e2e:mssql`).
//
// Real Ncake_a sales/purchase data spans into July 2026. /reports/ventas and
// /reports/compras both default to the *previous calendar month*
// (lib/dates.ts's getPreviousMonthRange()) — so as long as these tests run
// before September 2026, that default window already covers real data
// without needing to touch the date picker at all. The explicit-range test
// below still re-applies the same July 2026 span to exercise the
// Aplicar/refetch path, not because it's a different range. If this starts
// failing after September 2026, it's the date assumption, not a real bug —
// update the default-range test to pass an explicit past range instead of
// relying on "previous calendar month" always landing on real data.
//
// Selectors below match the exact "N registros" summary span, not a loose
// /registros/ regex — with real (not toy) data volume, the page also shows
// a "Mostrando 100 de N registros" pagination line containing the same
// word, which a loose regex matches ambiguously (Playwright strict mode).

test.describe('reports @mssql', () => {
  test('ventas: preview loads rows for the default date range', async ({ userPage }) => {
    await userPage.goto('/reports/ventas');
    await expect(userPage.getByText(/^\d+ registros$/)).toBeVisible({ timeout: 15_000 });
    await expect(userPage.locator('table')).toBeVisible();
  });

  test('ventas: changing the date range refetches the preview', async ({ userPage }) => {
    await userPage.goto('/reports/ventas');
    await expect(userPage.getByText(/^\d+ registros$/)).toBeVisible({ timeout: 15_000 });

    const dateInputs = userPage.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-07-01');
    await dateInputs.nth(1).fill('2026-07-20');
    await userPage.getByRole('button', { name: 'Aplicar' }).click();

    await expect(userPage.getByText(/^\d+ registros$/)).toBeVisible({ timeout: 15_000 });
  });

  test('ventas: toggling a column hides it from the preview table', async ({ userPage }) => {
    await userPage.goto('/reports/ventas');
    await expect(userPage.locator('table')).toBeVisible({ timeout: 15_000 });

    // FECHA (fecha_emis, defaultOrder: 1) — the first non-alwaysVisible
    // column in VENTAS_CONFIG.columns (lib/reports/ventas.ts); ITEM
    // (defaultOrder: 0) is alwaysVisible and can't be toggled.
    const columnLabel = 'FECHA';

    await expect(userPage.locator('table thead th', { hasText: columnLabel })).toBeVisible();
    await userPage.getByRole('button', { name: `Ocultar ${columnLabel}` }).click();
    await expect(userPage.locator('table thead th', { hasText: columnLabel })).not.toBeVisible();
  });

  test('compras: export button triggers a file download', async ({ userPage }) => {
    await userPage.goto('/reports/compras');
    await expect(userPage.locator('table')).toBeVisible({ timeout: 15_000 });

    const downloadPromise = userPage.waitForEvent('download');
    await userPage.getByRole('button', { name: '↓ Exportar' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.(xlsx|csv)$/);
  });
});
