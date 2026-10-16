import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { FIXTURE_INVOICE_LINES, fixtureResponse } from '../__tests__/unit/seguimiento/fixture';

// Default suite (no DWH available): the API is mocked with page.route, so these tests cover the
// UI behaviour of the Seguimiento tab end to end (toggle, drill-down, table view, quota editing,
// error state). Real-data coverage is the @mssql describe at the bottom.
// /analitica is gated by hasDwhAccess; only the admin role bypasses it, so use adminPage.

async function mockApi(page: Page, opts: { fail?: boolean } = {}) {
  const seen: string[] = [];
  const posts: unknown[] = [];
  await page.route(/\/api\/dwh\/seguimiento(\?|$)/, async route => {
    const url = new URL(route.request().url());
    seen.push(url.search);
    if (opts.fail) return route.fulfill({ status: 500, json: { error: 'Error al consultar el Data Warehouse' } });
    if (url.searchParams.get('section') === 'lines') return route.fulfill({ json: { lines: FIXTURE_INVOICE_LINES } });
    if (url.searchParams.get('section') === 'excluded') {
      return route.fulfill({ json: { invoices: [{ customerCode: 'C4', customerName: 'Cadena Raiz', invoiceNumber: 'F9', invoiceDate: '2026-10-05', amountNet: { bs: 9000, usd: 180 } }] } });
    }
    const kind = (url.searchParams.get('kind') ?? 'vendedor') as 'vendedor' | 'ruta' | 'grupo';
    return route.fulfill({ json: fixtureResponse(kind) });
  });
  await page.route('**/api/admin/seller-targets', async route => {
    if (route.request().method() === 'POST') {
      posts.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, json: { id: 1 } });
    }
    return route.fulfill({ json: null });
  });
  return { seen, posts };
}

test.describe('seguimiento (mocked API)', () => {
  test('renders seller cards with quota bar, projection marker and week strip; table is hidden', async ({ adminPage }) => {
    await mockApi(adminPage);
    // The page defaults to Bs.; the quota bar label below asserts USD amounts.
    await adminPage.goto('/analitica?tab=seguimiento&currency=usd');
    await expect(adminPage.getByRole('heading', { name: 'Seguimiento de ventas' })).toBeVisible({ timeout: 15_000 });
    const ana = adminPage.getByRole('article', { name: 'Ana' });
    await expect(ana).toBeVisible();
    await expect(ana.getByRole('img', { name: /meta \$100, proyección \$154/ })).toBeVisible();
    await expect(ana.getByTestId('quota-bar-projection')).toBeVisible();
    await expect(ana.getByRole('img', { name: /Activación semanal/ })).toBeVisible();
    await expect(ana.getByText('Nuevos 1 / 1')).toBeVisible();
    await expect(adminPage.getByText(/Día laborable 10 de 22/)).toBeVisible();
    await expect(adminPage.locator('table')).toHaveCount(0);
  });

  test('root toggle switches to routes and groups', async ({ adminPage }) => {
    const { seen } = await mockApi(adminPage);
    await adminPage.goto('/analitica?tab=seguimiento');
    await expect(adminPage.getByRole('article', { name: 'Ana' })).toBeVisible({ timeout: 15_000 });
    await adminPage.getByRole('button', { name: 'Ruta', exact: true }).click();
    await expect(adminPage.getByRole('article', { name: 'Ruta 3' })).toBeVisible();
    await adminPage.getByRole('button', { name: 'Grupo de cliente' }).click();
    await expect(adminPage.getByRole('article', { name: 'Abasto' })).toBeVisible();
    expect(seen.some(s => s.includes('kind=ruta'))).toBe(true);
    expect(seen.some(s => s.includes('kind=grupo'))).toBe(true);
  });

  test('drill-down: seller -> customer -> invoice lines', async ({ adminPage }) => {
    await mockApi(adminPage);
    await adminPage.goto('/analitica?tab=seguimiento');
    const ana = adminPage.getByRole('article', { name: 'Ana' });
    await ana.getByRole('button', { name: 'Ver clientes' }).click();
    await ana.getByRole('button', { name: /Cliente Uno/ }).click();
    const lines = ana.getByRole('region', { name: 'Líneas de factura' });
    await expect(lines.getByText('F000101')).toBeVisible();
    await expect(lines.getByText('Pizza Familiar')).toBeVisible();
  });

  test('table view is one click away and back', async ({ adminPage }) => {
    await mockApi(adminPage);
    await adminPage.goto('/analitica?tab=seguimiento');
    await expect(adminPage.getByRole('article', { name: 'Ana' })).toBeVisible({ timeout: 15_000 });
    await adminPage.getByRole('button', { name: 'Tabla' }).click();
    const table = adminPage.locator('table').first();
    await expect(table.getByRole('columnheader', { name: 'Proyección' })).toBeVisible();
    await expect(table.getByText('Ana')).toBeVisible();
    await adminPage.getByRole('button', { name: 'Tarjetas' }).click();
    await expect(adminPage.locator('table')).toHaveCount(0);
  });

  test('inline quota editing posts the full three-field row for the response month', async ({ adminPage }) => {
    const { posts } = await mockApi(adminPage);
    await adminPage.goto('/analitica?tab=seguimiento');
    const ana = adminPage.getByRole('article', { name: 'Ana' });
    await ana.getByRole('button', { name: 'Editar metas' }).click();
    await ana.getByRole('button', { name: 'Editar meta (100USD)' }).click();
    await ana.getByRole('spinbutton').fill('120');
    await ana.getByRole('button', { name: 'Guardar' }).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toEqual({ salesRepKey: '1', periodMonth: '2026-10', salesQuotaUsd: 120, weeklyVisitQuota: 2, newCustomerQuota: 1, unitsQuota: 100 });
  });

  test('consignment footnote lists the excluded invoices', async ({ adminPage }) => {
    await mockApi(adminPage);
    await adminPage.goto('/analitica?tab=seguimiento');
    await expect(adminPage.getByRole('heading', { name: 'Facturas excluidas — patrón de consignación' })).toBeVisible({ timeout: 15_000 });
    await adminPage.locator('button', { hasText: 'excluidos' }).first().click();
    await expect(adminPage.getByText('F9')).toBeVisible();
  });

  test('a server error shows the message instead of cards', async ({ adminPage }) => {
    await mockApi(adminPage, { fail: true });
    await adminPage.goto('/analitica?tab=seguimiento');
    await expect(adminPage.getByText('Error al consultar el Data Warehouse')).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByRole('article')).toHaveCount(0);
  });

  test('help panel documents Seguimiento', async ({ adminPage }) => {
    await mockApi(adminPage);
    await adminPage.goto('/analitica?tab=seguimiento');
    await adminPage.getByRole('button', { name: 'Ayuda de esta página' }).click();
    const dialog = adminPage.getByRole('dialog', { name: 'Panel de ayuda' });
    await expect(dialog.getByRole('heading', { name: 'Seguimiento', exact: true })).toBeVisible({ timeout: 10_000 });
  });
});

// @mssql: needs the migrated + loaded DWH (`bun run migrate:dwh` + `bun run dwh:incremental-load`,
// plan A's migration 0040 applied). Excluded from default CI; run with `bun run e2e:mssql`.
test.describe('seguimiento @mssql', () => {
  test('tab loads real roots, the month pace and the toggle works', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=seguimiento');
    await expect(adminPage.getByRole('heading', { name: 'Seguimiento de ventas' })).toBeVisible({ timeout: 30_000 });
    await expect(adminPage.getByText(/Día laborable \d+ de \d+/)).toBeVisible();
    await expect(adminPage.getByRole('article').first()).toBeVisible();
    await adminPage.getByRole('button', { name: 'Ruta', exact: true }).click();
    await expect(adminPage.getByRole('article').first()).toBeVisible({ timeout: 30_000 });
    await adminPage.getByRole('button', { name: 'Tabla' }).click();
    await expect(adminPage.locator('table').first()).toBeVisible();
  });

  test('a seller can be opened from the tab and returns to Seguimiento', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=seguimiento');
    await expect(adminPage.getByRole('article').first()).toBeVisible({ timeout: 30_000 });
    await adminPage.getByRole('button', { name: 'Ver perfil' }).first().click();
    await expect(adminPage.getByText('← Volver a Seguimiento')).toBeVisible();
    await adminPage.getByText('← Volver a Seguimiento').click();
    await expect(adminPage.getByRole('heading', { name: 'Seguimiento de ventas' })).toBeVisible();
  });
});
