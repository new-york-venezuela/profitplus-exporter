// e2e/mapa.spec.ts
import { test, expect } from './fixtures';
import sql from 'mssql';
import path from 'path';
import fs from 'fs';
import { updateCustomerLocation } from '../lib/geo/erp-location';
import { formatCoordinates } from '../lib/geo/coordinates';

test.describe('mapa access', () => {
  test('a user without the geo grant is redirected away from /mapa', async ({ userPage }) => {
    await userPage.goto('/mapa');
    await expect(userPage).toHaveURL(/\/reports\/ventas/);
  });

  test('a user without the geo grant gets 403 from the API', async ({ userPage }) => {
    const res = await userPage.request.get('/api/mapa/clientes');
    expect(res.status()).toBe(403);
  });

  test('admin sees the Mapa de Clientes link', async ({ adminPage }) => {
    await expect(adminPage.getByRole('link', { name: 'Mapa de Clientes' })).toBeVisible();
  });
});

// @mssql — needs the ERP mock + DWH loaded (see e2e/analitica.spec.ts header).
test.describe('mapa @mssql', () => {
  test('loads, filters are URL-synced, and the table view toggles', async ({ adminPage }) => {
    await adminPage.goto('/mapa');
    await expect(adminPage.getByTestId('customer-map')).toBeVisible({ timeout: 20_000 });

    await adminPage.getByLabel('Segmento (Pareto)').selectOption('A');
    await expect(adminPage).toHaveURL(/pareto=A/);
    await expect(adminPage.getByRole('list', { name: 'Filtros activos' }).getByText('Segmento: A')).toBeVisible();

    await adminPage.getByRole('button', { name: 'Tabla' }).click();
    await expect(adminPage.getByRole('table', { name: 'Clientes' })).toBeVisible();

    await adminPage.getByRole('button', { name: /Quitar filtro Segmento: A/ }).click();
    await expect(adminPage).not.toHaveURL(/pareto=/);
  });

  test('create and delete a route', async ({ adminPage }) => {
    const routeName = `E2E Ruta ${Date.now()}`;   // unique, so a failed earlier run cannot cause a 409
    await adminPage.goto('/mapa');
    await adminPage.getByRole('tab', { name: /Rutas/ }).click();

    const panel = adminPage.getByRole('region', { name: 'Rutas' });
    await panel.getByLabel('Nueva ruta').fill(routeName);
    await panel.getByPlaceholder('Vendedor…').click();
    // SearchableSelect renders the "Seleccione vendedor" reset option first, then one button per seller.
    await panel.locator('form ul li button').nth(1).click();
    await panel.getByRole('button', { name: 'Crear ruta' }).click();

    const list = adminPage.getByRole('list', { name: 'Rutas existentes' });
    await expect(list.getByText(routeName)).toBeVisible();

    await list.locator('li', { hasText: routeName }).getByRole('button', { name: 'Eliminar' }).click();
    await expect(adminPage.getByRole('heading', { name: 'Eliminar ruta' })).toBeVisible();   // modal sits above the map
    await adminPage.locator('div.fixed.inset-0').getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(list.getByText(routeName)).not.toBeVisible();
  });
});

// @mssql — the page loads ERP + DWH data; the area flows themselves only need SQLite.
test.describe('mapa sales areas @mssql', () => {
  async function drawSquare(page: import('@playwright/test').Page, box: { x: number; y: number; width: number; height: number }, fx: number, fy: number, size: number) {
    const p = (dx: number, dy: number) => ({ x: box.x + box.width * (fx + dx), y: box.y + box.height * (fy + dy) });
    const pts = [p(0, 0), p(size, 0), p(size, size), p(0, size)];
    for (const pt of pts) await page.mouse.click(pt.x, pt.y);
    await page.mouse.click(pts[0].x, pts[0].y);              // clicking the first point closes the polygon
  }

  test('draw, save, reject an overlapping area, then delete', async ({ adminPage }) => {
    const suffix = Date.now();
    await adminPage.goto('/mapa');
    const map = adminPage.getByTestId('customer-map');
    await expect(map).toBeVisible({ timeout: 20_000 });
    await adminPage.getByRole('tab', { name: /Zonas/ }).click();
    const box = (await map.boundingBox())!;

    // first area
    await adminPage.getByRole('button', { name: 'Dibujar nueva zona' }).click();
    await drawSquare(adminPage, box, 0.2, 0.2, 0.2);
    await adminPage.getByLabel('Nombre').fill(`E2E Zona A ${suffix}`);
    await adminPage.getByRole('button', { name: 'Guardar zona' }).click();
    const list = adminPage.getByRole('list', { name: 'Zonas existentes' });
    await expect(list.getByText(`E2E Zona A ${suffix}`)).toBeVisible();

    // overlapping second area is rejected and names the first
    await adminPage.getByRole('button', { name: 'Dibujar nueva zona' }).click();
    await drawSquare(adminPage, box, 0.3, 0.3, 0.2);
    await adminPage.getByLabel('Nombre').fill(`E2E Zona B ${suffix}`);
    await adminPage.getByRole('button', { name: 'Guardar zona' }).click();
    await expect(adminPage.locator('p[role="alert"]')).toContainText(`E2E Zona A ${suffix}`);
    await adminPage.getByRole('button', { name: 'Cancelar' }).click();

    // delete the first
    await list.locator('li', { hasText: `E2E Zona A ${suffix}` }).getByRole('button', { name: 'Eliminar' }).click();
    await adminPage.locator('div.fixed.inset-0').getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(list.getByText(`E2E Zona A ${suffix}`)).not.toBeVisible();
  });

  test('Esc cancels drawing without creating an area', async ({ adminPage }) => {
    await adminPage.goto('/mapa');
    await expect(adminPage.getByTestId('customer-map')).toBeVisible({ timeout: 20_000 });
    await adminPage.getByRole('tab', { name: /Zonas/ }).click();
    await adminPage.getByRole('button', { name: 'Dibujar nueva zona' }).click();
    await expect(adminPage.getByText('Dibujando zona')).toBeVisible();
    await adminPage.keyboard.press('Escape');
    await expect(adminPage.getByText('Dibujando zona')).not.toBeVisible();
  });

  test('layer toggles show the choropleth legend', async ({ adminPage }) => {
    await adminPage.goto('/mapa');
    await expect(adminPage.getByTestId('customer-map')).toBeVisible({ timeout: 20_000 });
    await adminPage.getByLabel('Ingresos por zona').check();
    await expect(adminPage.getByRole('group', { name: 'Leyenda de ingresos por zona' })).toBeVisible();
    await adminPage.getByLabel('Densidad de ingresos').check();
    await adminPage.getByLabel('Clientes (pines)').uncheck();
  });
});

// Seeds real coordinates (via the app's own updateCustomerLocation) for a few
// customers that have sales, so pins, area matching, the choropleth and the
// discrepancias panel are exercised with real points. Runs serially: it
// mutates shared ERP state (saCliente.campo1) and creates/deletes one area.
function dbConfig(): sql.config {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(path.resolve(__dirname, '..', '.env.test'), 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq !== -1) env[t.slice(0, eq)] = t.slice(eq + 1);
  }
  const e = { ...env, ...process.env };
  return {
    server: e.DB_SERVER!, port: parseInt(e.DB_PORT ?? '1433'), database: e.DB_NAME!, user: e.DB_USER!, password: e.DB_PASSWORD!,
    options: { encrypt: e.DB_ENCRYPT === 'true', trustServerCertificate: e.DB_TRUST_SERVER_CERT !== 'false' },
  };
}

interface Seeded { coCli: string; name: string; coVen: string; original: string | null }

test.describe.serial('mapa with seeded coordinates @mssql', () => {
  let erp: sql.ConnectionPool;
  let seeded: Seeded[] = [];
  let sellerName = '';
  let expectedUnlocated = 0;
  const areaName = `E2E Zona Pines ${Date.now()}`;
  const PERIOD = 'custom:2000-01-01:2099-12-31';   // whatever sales the mock holds, regardless of today's date

  test.beforeAll(async () => {
    erp = await new sql.ConnectionPool(dbConfig()).connect();
    const dwh = await new sql.ConnectionPool({ ...dbConfig(), database: 'DWH_AlimentosNY' }).connect();
    try {
      // Customers with the most sales, so they carry revenue in the popup / choropleth.
      const top = await dwh.request().query(`
        SELECT TOP 40 RTRIM(c.CustomerCode) AS coCli
        FROM fact.Fact_Sales fs JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
        WHERE fs.IsVoided = 0 GROUP BY RTRIM(c.CustomerCode) ORDER BY COUNT(*) DESC`);
      const rows: Seeded[] = [];
      for (const { coCli } of top.recordset as { coCli: string }[]) {
        const r = await erp.request().input('c', sql.VarChar(16), coCli).query(
          `SELECT RTRIM(co_cli) AS coCli, RTRIM(cli_des) AS name, RTRIM(co_ven) AS coVen, RTRIM(campo1) AS original
           FROM saCliente WHERE co_cli = @c AND inactivo = 0 AND (campo1 IS NULL OR campo1 NOT LIKE 'Coordenadas:%')`);
        if (r.recordset[0]) rows.push(r.recordset[0] as Seeded);
      }
      // Need >= 2 distinct sellers so some customers differ from the area's seller.
      const firstSeller = rows[0]?.coVen;
      const different = rows.find(r => r.coVen !== firstSeller);
      if (!rows.length || !different) throw new Error('mock ERP lacks sold customers with 2+ distinct sellers');
      const sameSeller = rows.filter(r => r.coVen === firstSeller).slice(0, 2);
      seeded = [...sameSeller, different, rows.filter(r => r !== different && !sameSeller.includes(r))[0]].slice(0, 4);
      const v = await erp.request().input('v', sql.VarChar(6), firstSeller).query(`SELECT RTRIM(ven_des) AS n FROM saVendedor WHERE co_ven = @v`);
      sellerName = v.recordset[0].n;
    } finally {
      await dwh.close();
    }

    const origins: [number, number][] = [[10.46, -66.93], [10.51, -66.93], [10.46, -66.88], [10.51, -66.88]];   // ~0.05° box in Caracas
    for (const [i, c] of seeded.entries()) {
      await updateCustomerLocation(erp, { coCli: c.coCli, campo1: formatCoordinates({ lat: origins[i][0], lng: origins[i][1] }) });
    }
    const total = await erp.request().query(`SELECT COUNT(*) AS n FROM saCliente WHERE inactivo = 0 AND (campo1 IS NULL OR campo1 NOT LIKE 'Coordenadas:%')`);
    expectedUnlocated = total.recordset[0].n;
  });

  test.afterAll(async () => {
    try {
      for (const c of seeded) {
        if (c.original !== null) await updateCustomerLocation(erp, { coCli: c.coCli, campo1: c.original });
        else {
          // updateCustomerLocation treats NULL as "leave unchanged", so restoring a NULL needs a direct UPDATE.
          await erp.request().input('c', sql.Char(16), c.coCli).query(`UPDATE saCliente SET campo1 = NULL WHERE co_cli = @c`);
        }
      }
    } finally {
      await erp?.close();
    }
  });

  test('pins, popup, area around pins, seller mismatches and choropleth legend', async ({ adminPage }) => {
    test.setTimeout(90_000);
    await adminPage.goto(`/mapa?dateRange=${encodeURIComponent(PERIOD)}`);
    const map = adminPage.getByTestId('customer-map');
    await expect(map).toBeVisible({ timeout: 20_000 });

    // Pins appear and the unlocated count dropped by exactly the seeded customers.
    const pins = adminPage.locator('.leaflet-marker-icon');
    await expect(pins).toHaveCount(4, { timeout: 20_000 });
    await expect(adminPage.getByRole('tab', { name: `Sin ubicación (${expectedUnlocated})` })).toBeVisible();

    // Popup shows name, segment and revenue.
    const first = seeded[0];
    await adminPage.locator('.leaflet-marker-icon').and(adminPage.locator(`[title="${first.name}"]`)).click();
    const popup = adminPage.locator('.leaflet-popup-content');
    await expect(popup.getByText(first.name, { exact: true })).toBeVisible();
    await expect(popup.getByText('Segmento')).toBeVisible();
    await expect(popup.locator('dt', { hasText: 'Ingresos' }).locator('+ dd')).toHaveText(/^USD\s*[\d.,]+$/);
    await adminPage.locator('.leaflet-popup-close-button').click();   // an open popup would swallow the drawing clicks
    await expect(popup).toHaveCount(0);

    // Draw an area around all pins.
    await adminPage.getByRole('tab', { name: /Zonas/ }).click();
    await adminPage.getByRole('button', { name: 'Dibujar nueva zona' }).click();
    const boxes = await pins.evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
    const m = (await map.boundingBox())!;
    const pad = 45;
    const minX = Math.max(m.x + 10, Math.min(...boxes.map(b => b.x)) - pad), maxX = Math.min(m.x + m.width - 10, Math.max(...boxes.map(b => b.x)) + pad);
    const minY = Math.max(m.y + 10, Math.min(...boxes.map(b => b.y)) - pad), maxY = Math.min(m.y + m.height - 10, Math.max(...boxes.map(b => b.y)) + pad);
    const ring = [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }];
    for (const pt of ring) await adminPage.mouse.click(pt.x, pt.y);
    await adminPage.mouse.click(ring[0].x, ring[0].y);

    await adminPage.getByLabel('Nombre').fill(areaName);
    await adminPage.getByRole('group', { name: 'Vendedores de la zona' }).getByLabel(sellerName, { exact: true }).check();
    await adminPage.getByRole('button', { name: 'Guardar zona' }).click();
    const list = adminPage.getByRole('list', { name: 'Zonas existentes' });
    await expect(list.getByText(areaName)).toBeVisible();
    await expect(list.locator('li', { hasText: areaName })).toContainText('4 clientes');

    // Discrepancias: customers whose seller differs from the area's seller.
    const mismatched = seeded.filter(c => c.coVen !== seeded[0].coVen);
    await adminPage.getByRole('tab', { name: new RegExp(`Discrepancias \\(${mismatched.length}\\)`) }).click();
    const mismatchList = adminPage.getByRole('list', { name: 'Clientes con vendedor distinto al de la zona' });
    await expect(mismatchList.locator('li')).toHaveCount(mismatched.length);
    for (const c of mismatched) await expect(mismatchList.getByText(c.name, { exact: true })).toBeVisible();
    await expect(adminPage.getByRole('list', { name: 'Clientes fuera de toda zona' }).locator('li')
      .filter({ hasText: seeded[0].name })).toHaveCount(0);

    // Choropleth legend.
    await adminPage.getByLabel('Ingresos por zona').check();
    await expect(adminPage.getByRole('group', { name: 'Leyenda de ingresos por zona' })).toBeVisible();

    // Cleanup: delete the area.
    await adminPage.getByRole('tab', { name: /Zonas/ }).click();
    await list.locator('li', { hasText: areaName }).getByRole('button', { name: 'Eliminar' }).click();
    await adminPage.locator('div.fixed.inset-0').getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(list.getByText(areaName)).not.toBeVisible();
  });

  test.afterEach(async ({ adminPage }, testInfo) => {
    // If the test failed before its own cleanup, remove the area through the API.
    if (testInfo.status === testInfo.expectedStatus) return;
    const res = await adminPage.request.get('/api/mapa/zonas');
    if (!res.ok()) return;
    const body = await res.json();
    const areas: { id: number; name: string }[] = Array.isArray(body) ? body : body.areas ?? [];
    for (const a of areas.filter(x => x.name === areaName)) await adminPage.request.delete(`/api/mapa/zonas/${a.id}`);
  });
});

// Changes a customer's seller through the modal (real pApiActualizarVendedorCliente
// write on the mock ERP) and restores co_ven + audit columns afterwards.
test.describe.serial('mapa change seller @mssql', () => {
  let erp: sql.ConnectionPool;
  let customer: { coCli: string; name: string; coVen: string; coUsMo: string; feUsMo: Date } | null = null;
  let newSeller: { coVen: string; name: string } | null = null;

  test.beforeAll(async () => {
    erp = await new sql.ConnectionPool(dbConfig()).connect();
    // Unique-named active customer whose seller is active, plus a different active seller that has customers.
    const c = await erp.request().query(`
      SELECT TOP 1 RTRIM(c.co_cli) AS coCli, RTRIM(c.cli_des) AS name, RTRIM(c.co_ven) AS coVen, c.co_us_mo AS coUsMo, c.fe_us_mo AS feUsMo
      FROM saCliente c JOIN saVendedor v ON v.co_ven = c.co_ven AND v.inactivo = 0
      WHERE c.inactivo = 0 AND (SELECT COUNT(*) FROM saCliente d WHERE d.cli_des = c.cli_des) = 1
      ORDER BY c.co_cli DESC`);
    customer = c.recordset[0] ?? null;
    if (!customer) throw new Error('mock ERP lacks a suitable customer');
    const s = await erp.request().input('cur', sql.VarChar(6), customer.coVen).query(`
      SELECT TOP 1 RTRIM(v.co_ven) AS coVen, RTRIM(v.ven_des) AS name FROM saVendedor v
      WHERE v.inactivo = 0 AND v.co_ven <> @cur AND EXISTS (SELECT 1 FROM saCliente k WHERE k.co_ven = v.co_ven AND k.inactivo = 0)
      ORDER BY v.co_ven`);
    newSeller = s.recordset[0] ?? null;
    if (!newSeller) throw new Error('mock ERP lacks a second active seller with customers');
  });

  test.afterAll(async () => {
    try {
      if (customer) {
        await erp.request()
          .input('c', sql.Char(16), customer.coCli).input('v', sql.Char(6), customer.coVen)
          .input('u', sql.Char(6), customer.coUsMo).input('f', sql.DateTime, customer.feUsMo)
          .query(`UPDATE saCliente SET co_ven=@v, co_us_mo=@u, fe_us_mo=@f WHERE co_cli=@c`);
      }
    } finally {
      await erp?.close();
    }
  });

  test('Cancelar closes without changes; Guardar changes the seller and reloads the table', async ({ adminPage }) => {
    test.setTimeout(60_000);
    const c = customer!, s = newSeller!;
    await adminPage.goto('/mapa');
    await expect(adminPage.getByTestId('customer-map')).toBeVisible({ timeout: 20_000 });
    await adminPage.getByRole('button', { name: 'Tabla' }).click();
    const table = adminPage.getByRole('table', { name: 'Clientes' });
    const row = table.locator('tr', { has: adminPage.getByRole('button', { name: c.name, exact: true }) });
    const openModal = () => row.getByRole('button', { name: `Cambiar vendedor de ${c.name}` }).click();

    await openModal();
    const dialog = adminPage.locator('div.fixed.inset-0');
    await expect(dialog.getByRole('heading', { name: 'Cambiar vendedor' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Seleccione un vendedor');   // field error, nothing sent
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toHaveCount(0);

    await openModal();
    await dialog.getByPlaceholder('Buscar vendedor…').click();
    await dialog.getByRole('button', { name: new RegExp(`· ${s.coVen}$`) }).click();
    await dialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(dialog).toHaveCount(0, { timeout: 15_000 });
    await expect(row).toContainText(s.name);

    const after = await erp.request().input('c', sql.Char(16), c.coCli).query(`SELECT RTRIM(co_ven) AS coVen FROM saCliente WHERE co_cli = @c`);
    expect(after.recordset[0].coVen).toBe(s.coVen);
  });
});
