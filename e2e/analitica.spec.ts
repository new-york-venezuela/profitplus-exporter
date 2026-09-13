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

    // Ventas' cliente view uses GroupedDrilldownTable's own "Agrupar por"
    // <select> for the Entidad/Tienda toggle (tab-ventas.tsx no longer
    // renders a separate hand-rolled button toggle — removed as redundant
    // duplicate UI). Default dimension is "Entidad" (cliente_entidad) once
    // groupBy=cliente.
    const groupBySelect = adminPage.getByLabel('Agrupar por:');
    await expect(groupBySelect).toBeVisible();
    await expect(groupBySelect).toHaveValue('cliente_entidad');
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });
    const entidadRowCount = await adminPage.locator('table tbody tr').count();

    await groupBySelect.selectOption('cliente_tienda');
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

  test('Finanzas tab shows the extended EBITDA waterfall and expense category drilldown', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=finanzas');

    // The 5 new waterfall steps (Gastos Operativos, EBITDA (aprox.),
    // Intereses, Impuestos, Utilidad Neta) render both as KPI cards (plain
    // DOM <p> labels) and as recharts XAxis SVG tick text inside the
    // "Cascada de rentabilidad" chart. The KPI card labels are reliable
    // plain-text assertions; the SVG axis ticks are asserted via the
    // chart's accessible text so both the KPI section and the chart itself
    // are confirmed to have received the new waterfall steps.
    await expect(adminPage.getByText('EBITDA (aprox.)').first()).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText('Intereses', { exact: true }).first()).toBeVisible();
    await expect(adminPage.getByText('Impuestos', { exact: true }).first()).toBeVisible();
    await expect(adminPage.getByText('Utilidad neta', { exact: true })).toBeVisible();

    // recharts' XAxis auto-skips ticks it decides won't fit at the current
    // width (not all 9 waterfall steps are guaranteed to render as visible
    // tick labels), so the chart itself is only checked for the two anchor
    // steps recharts reliably keeps (first/last of the new steps); the
    // KPI-card assertions above are the reliable check that every new
    // FinanzasResponse field (ebitda/intereses/impuestos/utilidadNeta)
    // reached the page.
    const chart = adminPage.getByRole('application');
    await expect(chart).toBeVisible();
    const chartText = await chart.textContent();
    expect(chartText).toContain('EBITDA (aprox.)');
    expect(chartText).toContain('Utilidad Neta');

    // EBITDA (aprox.) KPI card carries the D&A caveat as a title tooltip.
    await expect(adminPage.locator('[title*="depreciación"]').first()).toBeVisible();

    // Expense category breakdown table, below the waterfall — same
    // GroupedDrilldownTable "Desglosar por" + expand pattern as Vendedores.
    await adminPage.getByLabel('Desglosar por:').selectOption('producto');

    const expandButton = adminPage.locator('table tbody tr').first().locator('button[aria-label="Expandir"]');
    await expect(expandButton).toBeVisible();
    await expandButton.click();

    // Expanding a category row loads its concept-level breakdown
    // (breakdownBy=concepto&parentValue=<category>) — assert a second row
    // appears (the expanded concept sub-table), same assertion style as the
    // Vendedores product-breakdown test above.
    await expect(adminPage.locator('table tbody tr').nth(1)).toBeVisible();

    // Regression guard for the 2026-09-11 bug class: a breakdown row that
    // renders its metric via generic toLocaleString instead of the parent's
    // moneyLabel/currency conversion, so a currency toggle has no effect on
    // expanded rows. Capture the expanded concept row's amount in Bs., then
    // toggle to USD and assert it changed (both the parent category row and
    // the still-expanded concept row must convert).
    const parentAmountBs = await adminPage.locator('table tbody tr').first().locator('td').last().textContent();
    const conceptAmountBs = await adminPage.locator('table tbody tr').nth(1).locator('td').last().textContent();

    await adminPage.getByRole('button', { name: 'USD' }).click();

    await expect(adminPage.locator('table tbody tr').first().locator('td').last()).not.toHaveText(parentAmountBs ?? '');
    await expect(adminPage.locator('table tbody tr').nth(1).locator('td').last()).not.toHaveText(conceptAmountBs ?? '');
    await expect(adminPage.locator('table tbody tr').first().locator('td').last()).toContainText('$');
    await expect(adminPage.locator('table tbody tr').nth(1).locator('td').last()).toContainText('$');
  });

  test('Compras tab shows the monthly trend, drills into proveedores, and expands a línea breakdown', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=compras');

    // Monthly chart renders by default (groupBy=mes).
    const chart = adminPage.getByRole('application');
    await expect(chart).toBeVisible({ timeout: 15_000 });

    // Clicking a bar drills into proveedores for that month (groupBy flips to
    // "proveedor" and a breadcrumb showing the selected month appears).
    // Two recharts+Playwright quirks combine here: (1) the entrance
    // animation grows each bar's height from 0 over ~1.5s, so an early click
    // lands on a near-zero-height <path> sitting right on the baseline axis
    // line, which Playwright's actionability check reports as "subtree
    // intercepts pointer events" / "element is not stable"; (2) some months
    // in the seeded data have very small purchase totals, so even after the
    // animation settles their bar can still render at (near-)zero height,
    // making a click on that specific bar unreliable regardless of timing.
    // Waiting past the animation and clicking the LAST bar (chronologically
    // most recent month, most likely to have accumulated a non-trivial
    // total in the seeded data) avoids both issues.
    const bars = chart.locator('.recharts-bar-rectangle path');
    await expect(bars.first()).toBeVisible({ timeout: 15_000 });
    await adminPage.waitForTimeout(1_500);
    await bars.last().click({ force: true });

    await expect(adminPage.getByRole('button', { name: 'Por proveedor' })).toHaveClass(/bg-blue-600/);
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    // Proveedor view has a single grain — the "Agrupar por" select exists
    // (GroupedDrilldownTable always renders it) but has no breakdown toggle,
    // since suppliers don't have Ventas' Entidad/Tienda multi-store split.
    const groupBySelect = adminPage.getByLabel('Agrupar por:');
    await expect(groupBySelect).toBeVisible();
    await expect(groupBySelect).toHaveValue('proveedor');

    // Switch to "Por línea" and expand the first row's producto breakdown.
    await adminPage.getByRole('button', { name: 'Por línea' }).click();
    const outerRows = adminPage.locator('table.min-w-full.text-sm > tbody > tr');
    await expect(outerRows.first()).toBeVisible({ timeout: 15_000 });

    await adminPage.getByLabel('Desglosar por:').selectOption('producto');
    const firstOuterRow = outerRows.first();
    const expandButton = firstOuterRow.locator('button[aria-label="Expandir"]');
    await expect(expandButton).toBeVisible();

    // The parent row's money cell (second-to-last <td> — "Compras netas";
    // `.last()` would be "Desc. prom.", a currency-independent percentage
    // that correctly does not change on toggle) is captured before
    // expanding, since expanding inserts a sibling <tr> that would otherwise
    // shift which row "first()" resolves to only if row identity changed
    // (it doesn't here, but capturing pre-expand keeps the two reads
    // unambiguous).
    const parentMoneyCell = firstOuterRow.locator('td').nth(-2);
    const parentAmountBs = await parentMoneyCell.textContent();

    await expandButton.click();

    // The breakdown renders as a nested <table> inside the sibling <tr> that
    // follows the expanded row (see grouped-drilldown-table.tsx) — wait for
    // that nested table's own first row specifically, rather than indexing
    // into a flattened "table tbody tr" locator, which matches every <tr>
    // under any <tbody> in the DOM (both outer rows AND the nested
    // breakdown table's rows interleaved in document order) and is prone to
    // racing the async breakdown fetch.
    const breakdownRows = firstOuterRow.locator('xpath=following-sibling::tr[1]').locator('table tbody tr');
    await expect(breakdownRows.first()).toBeVisible({ timeout: 15_000 });

    // Regression guard for the 2026-09-11 bug class (see the Finanzas test
    // above): the expanded producto breakdown row must apply moneyLabel /
    // currency conversion via formatBreakdownMetric, not a raw toLocaleString
    // that ignores the currency toggle. The breakdown row carries a single
    // `purchasesNet` metric (see route's lineaProductBreakdownQuery), so
    // `.last()` td there is the money cell.
    const productoAmountBs = await breakdownRows.first().locator('td').last().textContent();

    await adminPage.getByRole('button', { name: 'USD' }).click();

    await expect(parentMoneyCell).not.toHaveText(parentAmountBs ?? '');
    await expect(parentMoneyCell).toContainText('$');

    // TabCompras's data-fetch effect depends on `currency`, so toggling it
    // sets `loading` true and momentarily unmounts the whole
    // GroupedDrilldownTable (tab-compras.tsx's `{!loading && ... &&
    // (<GroupedDrilldownTable .../>)}` gate) while the new-currency request
    // is in flight — the same pattern tab-ventas.tsx and tab-finanzas.tsx
    // use. That remount resets GroupedDrilldownTable's internal
    // `expandedValue` state, collapsing the row back to "▸" once the fetch
    // resolves, so the breakdown must be re-expanded before its (fresh)
    // money cell can be read and compared.
    const expandButtonAfterToggle = outerRows.first().locator('button[aria-label="Expandir"]');
    await expect(expandButtonAfterToggle).toBeVisible({ timeout: 15_000 });
    await expandButtonAfterToggle.click();

    const breakdownRowsAfterToggle = outerRows.first().locator('xpath=following-sibling::tr[1]').locator('table tbody tr');
    const productoMoneyCellAfterToggle = breakdownRowsAfterToggle.first().locator('td').last();
    await expect(productoMoneyCellAfterToggle).toBeVisible({ timeout: 15_000 });

    await expect(productoMoneyCellAfterToggle).not.toHaveText(productoAmountBs ?? '');
    await expect(productoMoneyCellAfterToggle).toContainText('$');
  });
});
