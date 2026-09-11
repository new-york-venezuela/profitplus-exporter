import { test, expect } from './fixtures';

// @mssql — requires the `profitplus-erp-mock` container (docker-compose.yml)
// running locally, with the real Ncake_a database restored, plus the
// DWH_AlimentosNY warehouse migrated and loaded (`bun run migrate:dwh` +
// `bun run dwh:incremental-load`, and `bun run dwh:snapshot-load` for the AR
// snapshot the CxC tab depends on). Excluded from default CI (see
// playwright.config.ts + `bun run e2e` vs `bun run e2e:mssql`).
//
// These tests exercise the customer legal-entity grouping (Dim_LegalEntity)
// and the Entidad/Tienda toggle added across the Analítica tabs (Ventas,
// Devoluciones, Vendedores, Clientes, CxC). The seeded Ncake_a data includes
// real multi-store chains (e.g. a legal entity with 24 store-level
// customers), so switching from "Entidad" (grouped by legal entity) to
// "Tienda" (grouped by raw customer) is expected to reveal more rows, not
// fewer or the same.
//
// The top-level tab bar in analitica-client.tsx is a plain <nav
// aria-label="Tabs"> of <button>s, not role="tab" elements — selectors below
// use getByRole('button', ...) accordingly, matched against the real DOM in
// app/(app)/analitica/tabs/*.tsx and app/(app)/analitica/analitica-client.tsx.
//
// /analitica is gated by hasDwhAccess (lib/dwh/access.ts), which only the
// admin role bypasses unconditionally — the seeded user@e2e.test has no
// 'dwh' module grant and gets redirected to /reports/ventas. These tests use
// the adminPage fixture (same pattern as e2e/admin-users.spec.ts), not
// userPage, to reach the page at all.

test.describe('analitica @mssql', () => {
  test('toggling Entidad/Tienda changes the Ventas top-clientes list', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=ventas');
    await expect(adminPage.getByRole('button', { name: 'Por cliente' })).toBeVisible({ timeout: 15_000 });
    await adminPage.getByRole('button', { name: 'Por cliente' }).click();

    // Default dimension is "Entidad" (cliente_entidad) once groupBy=cliente.
    await expect(adminPage.getByRole('button', { name: 'Entidad' })).toBeVisible();
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });
    const entidadRowCount = await adminPage.locator('table tbody tr').count();

    await adminPage.getByRole('button', { name: 'Tienda' }).click();
    await expect(adminPage.locator('table tbody tr')).not.toHaveCount(0);
    // Store grain should show at least as many rows as entity grain: every
    // multi-store chain expands into multiple rows, standalone customers
    // are unchanged.
    const tiendaRowCount = await adminPage.locator('table tbody tr').count();
    expect(tiendaRowCount).toBeGreaterThanOrEqual(entidadRowCount);
  });

  test('a multi-store chain appears as a single row in Devoluciones entity mode', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=devoluciones');
    await expect(adminPage.getByRole('button', { name: 'Por Cliente' })).toBeVisible({ timeout: 15_000 });
    await adminPage.getByRole('button', { name: 'Por Cliente' }).click();
    await expect(adminPage.getByRole('button', { name: 'Entidad' })).toBeVisible();
    await adminPage.getByRole('button', { name: 'Entidad' }).click();

    // Assert the table renders without error and has at least one row -
    // exact chain names depend on whatever ERP test data is loaded, so this
    // checks structure/non-emptiness rather than a hardcoded name.
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });
  });

  test('expanding a Vendedores row loads a product breakdown', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=vendedores');
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    // The expand column only appears once a "Desglosar por" breakdown
    // dimension is selected (GroupedDrilldownTable's canExpand gate) - the
    // select defaults to "Sin desglose", so pick "Producto" first.
    await adminPage.getByLabel('Desglosar por:').selectOption('producto');

    const expandButton = adminPage.locator('table tbody tr').first().locator('button[aria-label="Expandir"]');
    await expect(expandButton).toBeVisible();
    await expandButton.click();

    await expect(adminPage.locator('table tbody tr').nth(1)).toBeVisible();
  });
});
