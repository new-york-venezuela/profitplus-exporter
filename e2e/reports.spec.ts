import { test, expect } from './fixtures';

// @mssql — requires the `profitplus-erp-mock` container (docker-compose.yml)
// running locally, with the real Ncake_a database restored (a production
// backup, not synthetic seed data — see docker/README.md). Excluded from
// default CI (see playwright.config.ts + `bun run e2e` vs `bun run e2e:mssql`).
//
// Real Ncake_a sales/purchase data spans into July 2026. /reports/ventas and
// /reports/compras both default to the *previous calendar month*
// (lib/dates.ts's getPreviousMonthRange(), read server-side in each
// page.tsx and passed into <ReportPage defaultDates={...}> — there's no
// URL-driven date range, so a test can't just navigate with
// ?startDate=...) — that default only lands on real data while "now" is
// within a few months of the fixture's own range, and per this comment's
// own original prediction, broke once "now" passed September 2026
// (confirmed live 2026-09-22: getPreviousMonthRange() resolves to August
// 2026, entirely outside the fixture's March-July 2026 data). Fixed by
// explicitly setting the date picker to a real-data range (via
// applyJulyRange below) in every test that needs rows to render, rather
// than relying on the implicit default. This keeps the tests correct
// regardless of how much further "now" drifts past this fixture's fixed
// date range — update the hardcoded July 2026 dates below if this fixture
// is ever refreshed with a different date span.
//
// Selectors below match the exact "N registros" summary span, not a loose
// /registros/ regex — with real (not toy) data volume, the page also shows
// a "Mostrando 100 de N registros" pagination line containing the same
// word, which a loose regex matches ambiguously (Playwright strict mode).

async function applyJulyRange(page: import('@playwright/test').Page): Promise<void> {
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill('2026-07-01');
  await dateInputs.nth(1).fill('2026-07-20');
  await page.getByRole('button', { name: 'Aplicar' }).click();
}

test.describe('reports @mssql', () => {
  test('ventas: preview loads rows for the default date range', async ({ userPage }) => {
    await userPage.goto('/reports/ventas');
    await applyJulyRange(userPage);
    await expect(userPage.getByText(/^\d+ registros$/)).toBeVisible({ timeout: 15_000 });
    await expect(userPage.locator('table')).toBeVisible();
  });

  test('ventas: changing the date range refetches the preview', async ({ userPage }) => {
    await userPage.goto('/reports/ventas');
    await applyJulyRange(userPage);
    await expect(userPage.getByText(/^\d+ registros$/)).toBeVisible({ timeout: 15_000 });

    // Narrow to a shorter window within the same real-data month, to
    // confirm Aplicar actually refetches rather than just re-rendering.
    const dateInputs = userPage.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-07-01');
    await dateInputs.nth(1).fill('2026-07-05');
    await userPage.getByRole('button', { name: 'Aplicar' }).click();

    await expect(userPage.getByText(/^\d+ registros$/)).toBeVisible({ timeout: 15_000 });
  });

  test('ventas: toggling a column hides it from the preview table', async ({ userPage }) => {
    await userPage.goto('/reports/ventas');
    await applyJulyRange(userPage);
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
    await applyJulyRange(userPage);
    await expect(userPage.locator('table')).toBeVisible({ timeout: 15_000 });

    const downloadPromise = userPage.waitForEvent('download');
    await userPage.getByRole('button', { name: '↓ Exportar' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.(xlsx|csv)$/);
  });
});
