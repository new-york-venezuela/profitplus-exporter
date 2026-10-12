import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

// Default suite (no DWH): every /api/dwh/* call is mocked with page.route. /analitica is gated by
// hasDwhAccess; only the admin role bypasses it, so use adminPage. Real-data coverage is the @mssql
// describe at the bottom (needs the migrated + loaded DWH; `bun run e2e:mssql`).

const DWH_ERROR = { error: 'Error al consultar el Data Warehouse' };

async function failAllDwh(page: Page) {
  await page.route(/\/api\/dwh\//, route => route.fulfill({ status: 500, json: DWH_ERROR }));
}

const noVisit = { status: 'no_interval', daysSinceLastInvoice: 3, intervalDays: null, daysOverdue: null };
const row = (over: Record<string, unknown>) => ({
  customerCode: 'X', customerName: 'X', entityName: null, sellerCode: 'V1', sellerName: 'Ana',
  lastSaleDateKey: 20261012, entityLastSaleDateKey: null, daysSinceLastSale: 3, avgMonthlyUsd: 100, avgMonthlyUnits: 10,
  monthsWithSales: 3, status: 'active', routeNumber: 3, groupCode: 'S1', groupName: 'Abasto', kind: 'patrimonio',
  visit: noVisit, activeInPeriod: true, ...over,
});
const COBERTURA = {
  rows: [
    row({ customerCode: 'C1', customerName: 'Cliente Uno', visit: { status: 'overdue', daysSinceLastInvoice: 20, intervalDays: 7, daysOverdue: 13 }, daysSinceLastSale: 20 }),
    row({ customerCode: 'C2', customerName: 'Cliente Dos', routeNumber: 4, groupCode: 'S2', groupName: 'Restaurante', kind: 'nuevo' }),
    row({ customerCode: 'C3', customerName: 'Cliente Tres', activeInPeriod: false, visit: { status: 'ok', daysSinceLastInvoice: 3, intervalDays: 7, daysOverdue: 0 } }),
  ],
  asOfDateKey: 20261015, windowStartDateKey: 20251101, lapsedAfterDays: 30, kindYear: 2026,
};

async function mockClientes(page: Page) {
  const seen: string[] = [];
  await page.route(/\/api\/dwh\/clientes\/cobertura/, route => route.fulfill({ json: COBERTURA }));
  await page.route(/\/api\/dwh\/clientes\?/, route => {
    const url = new URL(route.request().url());
    seen.push(url.search);
    const section = url.searchParams.get('section');
    if (section === 'filters') {
      return route.fulfill({ json: { groups: [{ value: 'S1', label: 'Abasto' }, { value: 'S2', label: 'Restaurante' }], routes: [{ value: '3', label: 'Ruta 3' }, { value: '4', label: 'Ruta 4' }] } });
    }
    if (section === 'trend') return route.fulfill({ json: { rows: [] } });
    if (section === 'churned') return route.fulfill({ json: { rows: [], available: true } });
    return route.fulfill({ json: { rows: [{ name: 'Cliente Uno', salesGross: { bs: 100, usd: 2 }, returnsNet: { bs: 0, usd: 0 }, salesNet: { bs: 100, usd: 2 }, returnRate: 0, pareto: 'A' }], paretoThresholds: { a: 0.2, b: 0.5 } } });
  });
  return seen;
}

const PROFUNDIDAD = { rows: [{ sku: 'Pan Baguette', clientCount: 8, clientShare: 0.8, storeCount: 9, storeShare: 0.75, avgMonthlyPrice: { bs: 50, usd: 1 }, avgMonthlyUnits: 100, returnRate: 0.01, tier: 'primera' }] };
const GRUPOS = {
  level: 'linea',
  columns: [{ code: 'S1', name: 'Abasto', salesBs: 3500 }, { code: 'S2', name: 'Restaurante', salesBs: 400 }, { code: '__sin_grupo__', name: 'Sin grupo', salesBs: 300 }],
  rows: [{ label: 'Panaderia', totalBs: 4200, totalUsd: 84, cells: {
    S1: { salesBs: 3500, salesUsd: 70, share: 3500 / 4200 }, S2: { salesBs: 400, salesUsd: 8, share: 400 / 4200 }, __sin_grupo__: { salesBs: 300, salesUsd: null, share: 300 / 4200 },
  } }],
};

async function mockProductos(page: Page) {
  const seen: string[] = [];
  await page.route(/\/api\/dwh\/productos(\?|$)/, route => {
    const url = new URL(route.request().url());
    seen.push(url.search);
    const p = url.searchParams;
    if (p.get('tiendas') === '1') return route.fulfill({ json: { tiendas: [] } });
    if (p.get('categorias') === '1') return route.fulfill({ json: { categorias: ['Congelado', 'Fresco'] } });
    if (p.get('section') === 'profundidad') return route.fulfill({ json: PROFUNDIDAD });
    if (p.get('section') === 'porLineaMes') return route.fulfill({ json: { rows: [], lineas: [], trendMode: 'month' } });
    if (p.get('section') === 'grupos') return route.fulfill({ json: GRUPOS });
    return route.fulfill({ json: {
      rows: [{ sku: '', linea: 'Panaderia', sublinea: '', rotacion: 1200, salesShare: 1, salesGross: { bs: 1000, usd: 20 }, returns: { bs: 0, usd: 0 }, salesNet: { bs: 1000, usd: 20 }, margin: null }],
      groupBy: 'linea', breadcrumb: [{ label: 'Líneas', groupBy: 'linea' }],
    } });
  });
  return seen;
}

test.describe('analitica consolidation (mocked API)', () => {
  test('Resumen shows the month-pace strip even while the API fails', async ({ adminPage }) => {
    await failAllDwh(adminPage);
    await adminPage.goto('/analitica');
    await expect(adminPage.getByText(/Día laborable \d+ de \d+/)).toBeVisible({ timeout: 15_000 });
  });

  test('Clientes: visit KPIs, overdue and inactive-in-period lists, "Sin frecuencia" instead of overdue', async ({ adminPage }) => {
    await mockClientes(adminPage);
    await adminPage.goto('/analitica?tab=clientes');
    const section = adminPage.getByRole('region', { name: 'Cobertura de clientes' });
    await expect(section).toBeVisible({ timeout: 15_000 });
    await expect(section.getByText('Visitas vencidas')).toBeVisible();
    await expect(section.getByText('1 sin frecuencia')).toBeVisible();              // Cliente Dos has no frequency
    await section.getByLabel('Filtrar por visita').selectOption('overdue');
    await expect(section.locator('tbody tr')).toHaveCount(1);
    await expect(section.locator('tbody tr').first()).toContainText('Cliente Uno');
    await section.getByLabel('Filtrar por visita').selectOption('no_interval');
    await expect(section.locator('tbody tr').first()).toContainText('Cliente Dos');
    await section.getByLabel('Filtrar por visita').selectOption('');
    await section.getByLabel('Sin compras en el período').check();
    await expect(section.locator('tbody tr')).toHaveCount(1);
    await expect(section.locator('tbody tr').first()).toContainText('Cliente Tres');
  });

  test('Clientes: the group filter narrows the cobertura table and is sent to the API', async ({ adminPage }) => {
    const seen = await mockClientes(adminPage);
    await adminPage.goto('/analitica?tab=clientes');
    const section = adminPage.getByRole('region', { name: 'Cobertura de clientes' });
    await expect(section.locator('tbody tr')).toHaveCount(3, { timeout: 15_000 });
    await adminPage.getByRole('textbox', { name: 'Filtrar por grupo' }).click();
    await adminPage.getByRole('button', { name: 'Restaurante' }).click();
    await expect(section.locator('tbody tr')).toHaveCount(1);
    await expect(section.locator('tbody tr').first()).toContainText('Cliente Dos');
    await expect.poll(() => seen.some(s => s.includes('grupo=S2'))).toBe(true);
    await adminPage.getByRole('textbox', { name: 'Filtrar por ruta' }).click();
    await adminPage.getByRole('button', { name: 'Ruta 3' }).click();
    await expect.poll(() => seen.some(s => s.includes('grupo=S2') && s.includes('ruta=3'))).toBe(true);
    await expect(section.getByText('Ningún cliente coincide con los filtros.')).toBeVisible();
  });

  test('Productos: category filter reaches every request; matrix and tier badge render', async ({ adminPage }) => {
    const seen = await mockProductos(adminPage);
    await adminPage.goto('/analitica?tab=productos');
    await expect(adminPage.getByRole('table', { name: 'Participación por grupo de cliente' })).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByRole('columnheader', { name: 'Abasto' })).toBeVisible();
    await expect(adminPage.getByRole('columnheader', { name: 'Sin grupo' })).toBeVisible();
    await expect(adminPage.getByRole('cell', { name: '83%' })).toBeVisible();
    await expect(adminPage.getByText('Primera línea')).toBeVisible();
    await adminPage.getByLabel('Filtrar por categoría').selectOption('Fresco');
    await expect.poll(() => seen.some(s => s.includes('section=grupos') && s.includes('categoria=Fresco'))).toBe(true);
    await expect.poll(() => seen.some(s => s.includes('section=profundidad') && s.includes('categoria=Fresco'))).toBe(true);
    await expect.poll(() => seen.some(s => !s.includes('section=') && s.includes('categoria=Fresco'))).toBe(true);
  });

  test('Productos: drilling into a line re-scopes the matrix to sub-lines', async ({ adminPage }) => {
    const seen = await mockProductos(adminPage);
    await adminPage.goto('/analitica?tab=productos');
    await expect(adminPage.locator('#productos-drilldown-section')).toBeVisible({ timeout: 15_000 });
    await adminPage.locator('#productos-drilldown-section').getByText('Panaderia').click();
    await expect.poll(() => seen.some(s => s.includes('section=grupos') && s.includes('groupBy=sublinea') && s.includes('linea=Panaderia'))).toBe(true);
  });

  test('Histórico states the 2025 window', async ({ adminPage }) => {
    await failAllDwh(adminPage);
    await adminPage.goto('/analitica?tab=historico');
    await expect(adminPage.getByText('Datos del sistema anterior (enero – diciembre 2025)')).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText(/enero 2025 – febrero 2026/)).toHaveCount(0);
    await expect(adminPage.getByRole('navigation', { name: 'Tabs' }).getByRole('button', { name: 'Histórico 2025' })).toBeVisible();
  });
});

async function expectFallsBackToResumen(page: Page, key: string, retiredLabel: string) {
  await failAllDwh(page);
  await page.goto(`/analitica?tab=${key}`);
  const tabs = page.getByRole('navigation', { name: 'Tabs' });
  await expect(tabs.getByRole('button', { name: 'Resumen' })).toHaveClass(/border-blue-600/, { timeout: 15_000 });
  await expect(tabs.getByRole('button', { name: retiredLabel })).toHaveCount(0);
  await expect(page.getByText(/Tab not found/)).toHaveCount(0);
}

test.describe('retired tabs (mocked API)', () => {
  test('?tab=vendedores opens Resumen and the tab is gone from the bar', async ({ adminPage }) => {
    await expectFallsBackToResumen(adminPage, 'vendedores', 'Vendedores');
  });
});

// @mssql: needs the migrated + loaded DWH (plan A's migration 0040 applied). Excluded from default CI.
test.describe('analitica consolidation @mssql', () => {
  test('Resumen shows the month pace', async ({ adminPage }) => {
    await adminPage.goto('/analitica');
    await expect(adminPage.getByText(/Día laborable \d+ de \d+/)).toBeVisible({ timeout: 30_000 });
  });

  test('Clientes shows the group/route filters and the visit KPIs on real data', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=clientes');
    await expect(adminPage.getByRole('textbox', { name: 'Filtrar por grupo' })).toBeVisible({ timeout: 30_000 });
    await expect(adminPage.getByRole('textbox', { name: 'Filtrar por ruta' })).toBeVisible();
    await expect(adminPage.getByText('Cumplimiento de visitas')).toBeVisible({ timeout: 30_000 });
  });

  test('Productos shows the category filter and the group matrix on real data', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=productos');
    await expect(adminPage.getByLabel('Filtrar por categoría')).toBeVisible({ timeout: 30_000 });
    await expect(adminPage.getByRole('table', { name: 'Participación por grupo de cliente' })).toBeVisible({ timeout: 30_000 });
    await adminPage.getByLabel('Filtrar por categoría').selectOption({ index: 1 });
    await expect(adminPage.getByRole('table', { name: 'Participación por grupo de cliente' })).toBeVisible({ timeout: 30_000 });
  });

  test('Histórico loads and only shows months of 2025', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=historico');
    await expect(adminPage.getByText('Datos del sistema anterior (enero – diciembre 2025)')).toBeVisible({ timeout: 30_000 });
    await expect(adminPage.getByText(/Ene 26|Feb 26/)).toHaveCount(0);
  });
});
