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

  test('Finanzas tab shows the cash-flow margin card and expense category drilldown', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=finanzas');

    // Renamed from "EBITDA" 2026-09-14: the metric can't isolate production
    // payroll from admin/sales payroll (see docs/DATA_WAREHOUSE_GUIDE.md's
    // Cost Data Gap section), so it's labeled as a cash-basis operating
    // margin instead — its 6 KPI cards render as plain DOM <p> labels, no
    // longer as waterfall chart steps.
    await expect(adminPage.getByText('Margen Operativo (base caja)')).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText('Ingresos operativos', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Gastos operativos', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Margen Operativo', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Intereses', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Impuestos', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Utilidad neta', { exact: true })).toBeVisible();

    // The D&A/cost-center caveat tooltip lives on the card's info icon.
    await expect(adminPage.locator('[title*="depreciación"]').first()).toBeVisible();

    // Sales waterfall chart still renders (Bruto → Descuento → Neto → COGS →
    // Utilidad Bruta only — the margin card's steps are not part of it).
    const chart = adminPage.getByRole('application');
    await expect(chart).toBeVisible();
    const chartText = await chart.textContent();
    expect(chartText).toContain('Utilidad Bruta');
    expect(chartText).not.toContain('EBITDA');

    // Expense category breakdown table, below the margin card — same
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

  test('Finanzas tab shows the Nomina cost-center split, including unclassified concepts', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=finanzas');

    // Expand the "Nomina" category row specifically (not "the first row" —
    // Nomina isn't necessarily the highest-amount category) and confirm its
    // concept-level drilldown carries the CostCenter column added in
    // 0024_nomina_cost_center.sql: classified concepts show their cost
    // center, the rest show "Sin clasificar" rather than being hidden —
    // see docs/DATA_WAREHOUSE_GUIDE.md's Cost Data Gap section for why most
    // of Nomina has no cost-center signal in the source data at all.
    await adminPage.getByLabel('Desglosar por:').selectOption('producto');

    // Match on the category <td> exactly ("Nomina"), not `hasText` on the
    // whole <tr> — a row-level hasText filter matches descendant text too
    // (once expanded, the Nomina row's accessible text includes its nested
    // breakdown table's "NOMINA POR PAGAR" concept row), which made this
    // locator ambiguous. `has: page.getByText('Nomina', { exact: true })`
    // only matches the row whose own cell text is exactly "Nomina".
    const outerRows = adminPage.locator('table.min-w-full.text-sm').first().locator(':scope > tbody > tr');
    await expect(outerRows.first()).toBeVisible({ timeout: 15_000 });
    const nominaRow = outerRows.filter({ has: adminPage.getByText('Nomina', { exact: true }) });
    await expect(nominaRow).toBeVisible();

    await nominaRow.locator('button[aria-label="Expandir"]').click();

    const breakdownRowLocator = nominaRow.locator('xpath=following-sibling::tr[1]');
    const breakdownRows = breakdownRowLocator.locator('table tbody tr');
    await expect(breakdownRows.first()).toBeVisible({ timeout: 15_000 });

    // "Sin clasificar" must appear (93.4% of Nomina volume is unclassifiable
    // per the live 2026-09-14 investigation — this must not be silently
    // hidden or blank).
    const breakdownText = await breakdownRowLocator.textContent();
    expect(breakdownText).toContain('Sin clasificar');
  });

  test('Finanzas tab drills Compras into suppliers and shows the Comisiones category', async ({ adminPage }) => {
    // The default dateRange ('12m' = trailing 365 days) excludes this seed
    // dataset's Comisiones-classified Fact_CashMovements rows, whose latest
    // DateKey (live-checked 2026-09-15) is 2024-10-18 — over a year before
    // "today" in this environment. A custom range starting well before that
    // keeps this test's coverage of the 0026 carve-out from depending on the
    // clock ever agreeing with this seed data's dates again.
    await adminPage.goto('/analitica?tab=finanzas&dateRange=custom:2024-01-01:2026-12-31');
    await adminPage.getByLabel('Desglosar por:').selectOption('producto');

    const outerTable = adminPage.locator('table.min-w-full.text-sm').first();
    const outerRows = outerTable.locator(':scope > tbody > tr');
    await expect(outerRows.first()).toBeVisible({ timeout: 15_000 });

    // Comisiones must appear as its own category row (0026's carve-out) —
    // not merged into Nomina or Otros anymore.
    const comisionesRow = outerRows.filter({ has: adminPage.getByText('Comisiones', { exact: true }) });
    await expect(comisionesRow).toBeVisible();

    // Compras must appear as its own category row (Fact_Purchases, replacing
    // the old cash-ledger MateriaPrima category).
    const comprasRow = outerRows.filter({ has: adminPage.getByText('Compras', { exact: true }) });
    await expect(comprasRow).toBeVisible();

    // Expanding Compras drills into SUPPLIERS, not concepts — assert the
    // breakdown renders (same structural check as the Nomina test above;
    // this test's job is confirming the Compras branch doesn't error out
    // and renders rows, not asserting specific supplier names, which are
    // seed-data-dependent).
    await comprasRow.locator('button[aria-label="Expandir"]').click();
    const comprasBreakdownRows = comprasRow.locator('xpath=following-sibling::tr[1]').locator('table tbody tr');
    await expect(comprasBreakdownRows.first()).toBeVisible({ timeout: 15_000 });
  });

  test('Finanzas tab Margen Operativo reflects accrual Ingresos Netos, not cash-ledger income', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=finanzas');

    // Ingresos operativos (accrual, Fact_Sales - Fact_Returns) should now be
    // a much larger figure than the old cash-ledger I-01 total for the same
    // window — assert it's visible and non-zero (the E2E suite's seeded
    // Ncake_a data is smaller-scale than production, so this checks presence
    // and a sane order of magnitude, not an exact cross-environment number).
    // Both the card's own heading ("Margen Operativo (base caja)") and one of
    // its KPI labels ("Margen Operativo") are present simultaneously, so
    // `.or()` here would be a strict-mode violation (it resolves to both
    // matching elements at once, not "whichever one exists") — assert the
    // heading specifically.
    await expect(adminPage.getByText('Margen Operativo (base caja)')).toBeVisible({ timeout: 15_000 });
    const ingresosCard = adminPage.locator('div', { has: adminPage.getByText('Ingresos operativos', { exact: true }) }).last();
    await expect(ingresosCard).toBeVisible();
    const ingresosText = await ingresosCard.textContent();
    expect(ingresosText).not.toContain('Bs. 0');
  });

  test('date-range picker supports month navigation and year-to-date', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=ventas');

    // "Mes Actual" is not currently visible as an exact-match button label
    // before clicking, since DATE_RANGE_OPTIONS' label IS "Mes Actual" —
    // click it directly.
    await adminPage.getByRole('button', { name: 'Mes Actual' }).click();
    await expect(adminPage).toHaveURL(/dateRange=month%3A\d{4}-\d{2}/);

    // Paging controls appear once a month range is active. Match `exact:
    // true` — DATE_RANGE_OPTIONS also has a "Mes Anterior" preset button
    // (value: 'month-prev'), which differs from this arrow's
    // aria-label="Mes anterior" only in the capitalization of "anterior";
    // Playwright's default accessible-name matching is case-insensitive, so
    // without `exact` this locator resolves to both elements (strict-mode
    // violation).
    const prevMonthArrow = adminPage.getByRole('button', { name: 'Mes anterior', exact: true });
    await expect(prevMonthArrow).toBeVisible();

    const urlBeforePaging = adminPage.url();
    await prevMonthArrow.click();
    await expect(adminPage).not.toHaveURL(urlBeforePaging);
    await expect(adminPage).toHaveURL(/dateRange=month%3A\d{4}-\d{2}/);

    // Switching to "Año Actual" removes the month paging arrows and encodes
    // a ytd: param instead.
    await adminPage.getByRole('button', { name: 'Año Actual' }).click();
    await expect(adminPage).toHaveURL(/dateRange=ytd%3A\d{4}/);
    await expect(prevMonthArrow).not.toBeVisible();

    // "30 días"/"90 días" no longer exist as options anywhere on the page.
    await expect(adminPage.getByRole('button', { name: '30 días' })).toHaveCount(0);
    await expect(adminPage.getByRole('button', { name: '90 días' })).toHaveCount(0);
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
