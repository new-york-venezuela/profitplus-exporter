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
  test('Ventas tab renders all three sections at once and Entidad/Tienda toggles the cliente section', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=ventas');

    // Part 1 flattening: all three sections render immediately, no toggle
    // click required. Assert all three section headings are visible
    // simultaneously (not one-at-a-time behind a button).
    await expect(adminPage.getByRole('heading', { name: 'Por mes' })).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByRole('heading', { name: 'Por cliente' })).toBeVisible();
    // exact: true — a later "Comparar ventas por línea" chart section (not
    // present when this assertion was first written) also has a heading
    // whose text contains "por línea", making the loose match ambiguous.
    await expect(adminPage.getByRole('heading', { name: 'Por línea', exact: true })).toBeVisible();

    // The cliente section's own "Agrupar por" <select> (GroupedDrilldownTable)
    // still toggles Entidad/Tienda grain, same underlying mechanism as before
    // flattening — just no longer gated behind a separate view-selector click.
    // With all three sections rendered at once, "Por línea" has its own
    // "Agrupar por" select too, so scope to the cliente section specifically.
    const clienteSection = adminPage.locator('section', { has: adminPage.getByRole('heading', { name: 'Por cliente' }) });
    const groupBySelect = clienteSection.getByLabel('Agrupar por:');
    await expect(groupBySelect).toBeVisible();
    await expect(groupBySelect).toHaveValue('cliente_entidad');
    await expect(clienteSection.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });
    const entidadRowCount = await clienteSection.locator('table tbody tr').count();

    await groupBySelect.selectOption('cliente_tienda');
    await expect(clienteSection.locator('table tbody tr')).not.toHaveCount(0);
    const tiendaRowCount = await clienteSection.locator('table tbody tr').count();
    expect(tiendaRowCount).toBeGreaterThanOrEqual(entidadRowCount);
  });

  test('Devoluciones tab renders all three sections at once and the cliente section supports Entidad grain', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=devoluciones');

    // Part 1 flattening: no "Por Cliente" button to click — all three
    // sections (vendedor/producto/cliente) render immediately.
    await expect(adminPage.getByRole('heading', { name: 'Por vendedor' })).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByRole('heading', { name: 'Por producto' })).toBeVisible();
    await expect(adminPage.getByRole('heading', { name: 'Por cliente' })).toBeVisible();

    // The cliente section defaults to Entidad grain already (same default as
    // before flattening) — assert the table renders without error and has
    // at least one row, same structural check as the original test (exact
    // chain names depend on whatever ERP test data is loaded).
    const clienteSection = adminPage.locator('section', { has: adminPage.getByRole('heading', { name: 'Por cliente' }) });
    await expect(clienteSection.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });
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
    await expect(adminPage.getByRole('heading', { name: 'Margen Operativo' })).toBeVisible({ timeout: 15_000 });
    // Task 7's proxy KPI row (above this card) also has its own "Ingresos
    // operativos" tile, so scope these assertions to the Margen Operativo
    // card section specifically, not the whole page. Both the card's own
    // bg-white wrapper <div> and its nested header-row flex <div> match a
    // bare `div` `has:` filter (ambiguous ordering), so target the card's
    // own wrapper class directly instead of relying on .first()/.last().
    const margenCard = adminPage.locator('div.bg-white', { has: adminPage.getByRole('heading', { name: 'Margen Operativo' }) });
    await expect(margenCard.getByText('Ingresos operativos', { exact: true })).toBeVisible();
    await expect(margenCard.getByText('Gastos operativos', { exact: true })).toBeVisible();
    // The section heading (<h2>), this KPI's own label (<p>), and Task 7's
    // new "Margen Operativo %" label are all "Margen Operativo" text nodes
    // or superstrings of it — scope to the paragraph label with an exact
    // match to avoid matching "Margen Operativo %" too.
    await expect(margenCard.getByText('Margen Operativo', { exact: true }).and(adminPage.locator('p'))).toBeVisible();
    await expect(margenCard.getByText('Intereses', { exact: true })).toBeVisible();
    await expect(margenCard.getByText('Impuestos', { exact: true })).toBeVisible();
    await expect(margenCard.getByText('Utilidad neta', { exact: true })).toBeVisible();

    // The D&A/cost-center caveat tooltip lives on the card's info icon.
    await expect(adminPage.locator('[title*="depreciación"]').first()).toBeVisible();

    // Proxy gross-margin waterfall renders (Part 2 of docs/superpowers/specs/
    // 2026-09-15-analitica-ui-and-margin-design.md — Ingresos → Compras →
    // Utilidad Bruta → Otros Gastos Operativos → Margen Operativo; the old
    // always-0 Fact_Sales-based Bruto/Descuento/Neto/COGS waterfall is gone).
    const chart = adminPage.getByRole('application');
    await expect(chart).toBeVisible();
    const chartText = await chart.textContent();
    expect(chartText).toContain('Ingresos');
    expect(chartText).toContain('Compras');
    expect(chartText).toContain('Utilidad Bruta');
    expect(chartText).toContain('Otros Gastos Operativos');
    expect(chartText).toContain('Margen Operativo');
    expect(chartText).not.toContain('EBITDA');
    expect(chartText).not.toContain('Descuento');

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

  test('Finanzas tab shows Utilidad Bruta (proxy) and Margen Operativo % with the proxy tooltip note', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=finanzas&dateRange=custom:2024-01-01:2026-12-31');

    // New KPI cards from the Part 2 restructure.
    await expect(adminPage.getByText('Utilidad bruta (proxy)', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText('Margen bruto (proxy)', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Margen Operativo %', { exact: true })).toBeVisible();

    // Both KPI cards render a "%" value next to their amount, per the
    // spec's "KPI cards show % next to both Utilidad Bruta and Margen
    // Operativo amounts" requirement — assert the cards' own values contain
    // a percent sign (not just presence of the label).
    const margenBrutoCard = adminPage.locator('div', { has: adminPage.getByText('Margen bruto (proxy)', { exact: true }) }).last();
    await expect(margenBrutoCard).toContainText('%');
    const margenOperativoPctCard = adminPage.locator('div', { has: adminPage.getByText('Margen Operativo %', { exact: true }) }).last();
    await expect(margenOperativoPctCard).toContainText('%');

    // The inline proxy note is visible near the waterfall.
    await expect(adminPage.getByText('Compras se usa como proxy de costo directo', { exact: false })).toBeVisible();
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
    // Both the card's own heading ("Margen Operativo") and one of its KPI
    // labels (also "Margen Operativo") are present simultaneously, so a bare
    // `getByText('Margen Operativo')` would be a strict-mode violation (it
    // matches both the <h2> heading and the KPI <p> label) — the heading role
    // scopes this to the <h2> only.
    await expect(adminPage.getByRole('heading', { name: 'Margen Operativo' })).toBeVisible({ timeout: 15_000 });
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

  test('Compras tab renders all three sections at once, month-click filters proveedores, and a línea breakdown expands', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=compras');

    // Part 1 flattening: all three sections render immediately.
    await expect(adminPage.getByRole('heading', { name: 'Por mes' })).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByRole('heading', { name: 'Por proveedor' })).toBeVisible();
    await expect(adminPage.getByRole('heading', { name: 'Por línea' })).toBeVisible();

    const chart = adminPage.getByRole('application');
    await expect(chart).toBeVisible({ timeout: 15_000 });

    // Same two recharts+Playwright quirks as the original test: the entrance
    // animation grows each bar from 0 height over ~1.5s, and some months in
    // the seeded data have near-zero totals — wait past the animation and
    // click the last (most recent, most likely non-trivial) bar.
    const bars = chart.locator('.recharts-bar-rectangle path');
    await expect(bars.first()).toBeVisible({ timeout: 15_000 });
    await adminPage.waitForTimeout(1_500);
    await bars.last().click({ force: true });

    // Clicking a month bar no longer swaps sections (there's only one
    // layout) — it scopes+scrolls to the always-visible "Por proveedor"
    // section, whose heading now shows the selected month.
    const proveedorSection = adminPage.locator('section#compras-proveedor-section');
    await expect(proveedorSection.getByRole('heading')).toContainText('Por proveedor —');
    await expect(proveedorSection.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    // "Por línea" has its own "Agrupar por" select too, so scope to the
    // proveedor section specifically.
    const groupBySelect = proveedorSection.getByLabel('Agrupar por:');
    await expect(groupBySelect).toBeVisible();
    await expect(groupBySelect).toHaveValue('proveedor');

    // "Por línea" section — expand the first row's producto breakdown.
    const lineaSection = adminPage.locator('section', { has: adminPage.getByRole('heading', { name: 'Por línea' }) });
    const outerRows = lineaSection.locator('table.min-w-full.text-sm > tbody > tr');
    await expect(outerRows.first()).toBeVisible({ timeout: 15_000 });

    await lineaSection.getByLabel('Desglosar por:').selectOption('producto');
    const firstOuterRow = outerRows.first();
    const expandButton = firstOuterRow.locator('button[aria-label="Expandir"]');
    await expect(expandButton).toBeVisible();

    const parentMoneyCell = firstOuterRow.locator('td').nth(-2);
    const parentAmountBs = await parentMoneyCell.textContent();

    await expandButton.click();

    const breakdownRows = firstOuterRow.locator('xpath=following-sibling::tr[1]').locator('table tbody tr');
    await expect(breakdownRows.first()).toBeVisible({ timeout: 15_000 });

    const productoAmountBs = await breakdownRows.first().locator('td').last().textContent();

    await adminPage.getByRole('button', { name: 'USD' }).click();

    await expect(parentMoneyCell).not.toHaveText(parentAmountBs ?? '');
    await expect(parentMoneyCell).toContainText('$');

    // Toggling currency remounts each section's GroupedDrilldownTable while
    // its own fetch is in flight (same effect-dependency-on-currency pattern
    // as every other tab), collapsing the expanded row — re-expand before
    // reading its fresh money cell.
    const expandButtonAfterToggle = outerRows.first().locator('button[aria-label="Expandir"]');
    await expect(expandButtonAfterToggle).toBeVisible({ timeout: 15_000 });
    await expandButtonAfterToggle.click();

    const breakdownRowsAfterToggle = outerRows.first().locator('xpath=following-sibling::tr[1]').locator('table tbody tr');
    const productoMoneyCellAfterToggle = breakdownRowsAfterToggle.first().locator('td').last();
    await expect(productoMoneyCellAfterToggle).toBeVisible({ timeout: 15_000 });

    await expect(productoMoneyCellAfterToggle).not.toHaveText(productoAmountBs ?? '');
    await expect(productoMoneyCellAfterToggle).toContainText('$');
  });

  test('CxC tab renders the weekday, DSO trend, aging trend charts and the avg-días-de-pago debtor column', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=cxc');

    // Existing AR aging chart + top-debtors table still render (baseline,
    // unaffected by this task's additions).
    await expect(adminPage.getByRole('heading', { name: 'Antigüedad de saldos (AR Aging)' })).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByRole('heading', { name: 'Mayor concentración de crédito' })).toBeVisible();

    // New top-debtors column (Part 3e) — header always renders even when
    // the table has 0 rows in a given seed, so this doesn't depend on
    // topDebtors being non-empty.
    await expect(adminPage.getByRole('columnheader', { name: 'Días prom. de pago' })).toBeVisible();

    // New weekday x vencimiento chart (Part 3b) — always renders its
    // ChartCard heading; the chart itself may show an EmptyState if no
    // Fact_Collections row has a resolvable DueDateKey in this seed, so this
    // asserts the heading and card presence rather than bar content.
    await expect(adminPage.getByRole('heading', { name: 'Cobros por día de semana y estado de vencimiento' })).toBeVisible();

    // New DSO trend chart (Part 3c).
    await expect(adminPage.getByRole('heading', { name: 'Tendencia de DSO (Days Sales Outstanding)' })).toBeVisible();

    // New aging bucket trend chart (Part 3d).
    await expect(adminPage.getByRole('heading', { name: 'Tendencia de antigüedad de saldos' })).toBeVisible();
  });
});
