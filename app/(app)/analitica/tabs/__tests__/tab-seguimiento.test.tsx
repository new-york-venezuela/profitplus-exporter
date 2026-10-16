import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { act, cleanup, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FIXTURE_INVOICE_LINES, fixtureResponse } from '../../../../../__tests__/unit/seguimiento/fixture';

const capture = mock(() => {});
mock.module('posthog-js', () => ({ default: { capture } }));
const profileProps: Array<Record<string, unknown>> = [];
mock.module('../seller-profile', () => ({
  default: (props: Record<string, unknown>) => { profileProps.push(props); return <div>Perfil mock {String(props.salesRepKey)}</div>; },
}));
const { default: TabSeguimiento } = await import('../tab-seguimiento');

const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as unknown as Response;
const defaultFetch = async (url: string, _init?: RequestInit): Promise<Response> => {
  if (url.includes('section=lines')) return json({ lines: FIXTURE_INVOICE_LINES });
  if (url.includes('section=excluded')) {
    return json({ invoices: [{ customerCode: 'C4', customerName: 'Cadena Raiz', invoiceNumber: 'F9', invoiceDate: '2026-10-05', amountNet: { bs: 9000, usd: 180 } }] });
  }
  const kind = /kind=(\w+)/.exec(url)?.[1] ?? 'vendedor';
  return json(fixtureResponse(kind as 'vendedor' | 'ruta' | 'grupo'));
};
const fetchMock = mock(defaultFetch);
const urls = () => fetchMock.mock.calls.map(c => String(c[0]));

beforeEach(() => {
  fetchMock.mockClear(); fetchMock.mockImplementation(defaultFetch); capture.mockClear(); profileProps.length = 0;
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);

async function loaded(currency: 'bs' | 'usd' = 'usd') {
  const utils = render(<TabSeguimiento dateRange="30d" currency={currency} />);
  await screen.findByRole('heading', { name: 'Seguimiento de ventas' });
  return utils;
}

describe('TabSeguimiento', () => {
  test('loads vendedor roots by default, with month pace, KPIs and one card per seller', async () => {
    await loaded();
    expect(urls()[0]).toContain('kind=vendedor');
    expect(urls()[0]).toContain('dateRange=30d');
    expect(screen.getByRole('article', { name: 'Ana' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Beto' })).toBeTruthy();
    expect(screen.getByText(/Día laborable 10 de 22/)).toBeTruthy();
    expect(screen.getByText('Ventas brutas')).toBeTruthy();
    expect(screen.getByText('Meta de ventas (USD)')).toBeTruthy();
    expect(screen.getByText('Visitas vencidas')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();                      // cards are the default view
  });

  test('each card shows quota bar, projection marker, week strip, mix, new-customers chip and visit badge counts', async () => {
    await loaded();
    const ana = screen.getByRole('article', { name: 'Ana' });
    expect(within(ana).getByRole('img', { name: /Ventas \$70, meta \$100, proyección \$154/ })).toBeTruthy();
    expect(within(ana).getByTestId('quota-bar-projection')).toBeTruthy();
    expect(within(ana).getByRole('img', { name: /Activación semanal/ })).toBeTruthy();
    expect(within(ana).getByRole('img', { name: /Panaderia 86%, Pizza 14%/ })).toBeTruthy();
    expect(within(ana).getByText('Nuevos 1 / 1')).toBeTruthy();
    expect(within(ana).getByText(/Precio prom\./)).toBeTruthy();
  });

  test('each card shows units vs the unit goal, with the projection marker, or says there is no unit goal', async () => {
    await loaded();
    const ana = screen.getByRole('article', { name: 'Ana' });
    expect(within(ana).getByRole('img', { name: 'Unidades 35, meta 100, proyección 77' })).toBeTruthy();
    expect(within(ana).getByTestId('units-bar-target')).toBeTruthy();
    const beto = screen.getByRole('article', { name: 'Beto' });
    expect(within(beto).getByText('Sin meta de unidades')).toBeTruthy();
  });

  test('table view lists units, unit goal, attainment and projected units per root', async () => {
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Tabla' }));
    const table = await screen.findByRole('table');
    for (const name of ['Unidades', 'Meta uds.', 'Avance uds.', 'Proy. uds.']) {
      expect(within(table).getByRole('columnheader', { name })).toBeTruthy();
    }
    const row = within(table).getByRole('button', { name: 'Ana' }).closest('tr')!;
    expect(within(row).getByText('35.0%')).toBeTruthy();   // 35 of 100 units
    expect(within(row).getByText('77')).toBeTruthy();       // projected units
  });

  test('Beto has a goal but no frequency: no overdue count is shown as a number', async () => {
    await loaded();
    const beto = screen.getByRole('article', { name: 'Beto' });
    expect(within(beto).getByText('Nuevos 0 (sin meta)')).toBeTruthy();
    expect(within(beto).getByText(/Sin frecuencia/)).toBeTruthy();
  });

  test('switching the root toggle refetches with the new kind', async () => {
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Ruta' }));
    await waitFor(() => expect(urls().some(u => u.includes('kind=ruta'))).toBe(true));
    expect(await screen.findByRole('article', { name: 'Ruta 3' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver perfil' })).toBeNull();     // profile only for sellers
    await userEvent.click(screen.getByRole('button', { name: 'Grupo de cliente' }));
    expect(await screen.findByRole('article', { name: 'Abasto' })).toBeTruthy();
  });

  test('hierarchy: expand a seller, then a customer to see its invoice lines', async () => {
    await loaded();
    const ana = screen.getByRole('article', { name: 'Ana' });
    await userEvent.click(within(ana).getByRole('button', { name: 'Ver clientes' }));
    expect(within(ana).getByRole('button', { name: /Cliente Uno/ })).toBeTruthy();
    await userEvent.click(within(ana).getByRole('button', { name: /Cliente Uno/ }));
    const region = await within(ana).findByRole('region', { name: 'Líneas de factura' });
    expect(urls().some(u => u.includes('section=lines') && u.includes('customerCode=C1'))).toBe(true);
    expect(within(region).getByText('F000101')).toBeTruthy();
    expect(within(region).getByText('Pizza Familiar')).toBeTruthy();
  });

  test('table view is one click away and lists every root with its numbers', async () => {
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Tabla' }));
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Ana')).toBeTruthy();
    expect(within(table).getByRole('columnheader', { name: 'Ventas' })).toBeTruthy();
    expect(within(table).getByRole('columnheader', { name: 'S41' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Tarjetas' }));
    expect(screen.queryByRole('table')).toBeNull();
  });

  test('"Ver perfil" opens the seller profile with the Seguimiento back label', async () => {
    await loaded();
    await userEvent.click(within(screen.getByRole('article', { name: 'Ana' })).getByRole('button', { name: 'Ver perfil' }));
    expect(await screen.findByText('Perfil mock 1')).toBeTruthy();
    expect(profileProps.at(-1)).toMatchObject({ salesRepKey: '1', dateRange: '30d', currency: 'usd', backLabel: 'Volver a Seguimiento' });
    await act(async () => { (profileProps.at(-1)!.onBack as () => void)(); });
    expect(await screen.findByRole('heading', { name: 'Seguimiento de ventas' })).toBeTruthy();
  });

  test('inline quota editing sends the FULL row for the response month and refetches without cache', async () => {
    await loaded();
    const ana = screen.getByRole('article', { name: 'Ana' });
    await userEvent.click(within(ana).getByRole('button', { name: 'Editar metas' }));
    fetchMock.mockClear();
    await userEvent.click(within(ana).getByRole('button', { name: 'Editar meta (100USD)' }));
    const input = within(ana).getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '120');
    await userEvent.click(within(ana).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(c => String(c[0]) === '/api/admin/seller-targets')).toBe(true));
    const post = fetchMock.mock.calls.find(c => String(c[0]) === '/api/admin/seller-targets')!;
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual({
      salesRepKey: '1', periodMonth: '2026-10', salesQuotaUsd: 120, weeklyVisitQuota: 2, newCustomerQuota: 1, unitsQuota: 100,
    });
    await waitFor(() => expect(fetchMock.mock.calls.filter(c => String(c[0]).includes('/api/dwh/seguimiento')).length).toBeGreaterThan(0));
    const refetch = fetchMock.mock.calls.find(c => String(c[0]).includes('/api/dwh/seguimiento'))!;
    expect((refetch[1] as RequestInit | undefined)?.cache).toBe('no-store');
  });

  test('consignment footnote lists the excluded invoices of that seller on demand', async () => {
    await loaded();
    expect(screen.getByRole('heading', { name: 'Facturas excluidas — patrón de consignación' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Beto: .* excluidos/ }));
    expect(await screen.findByText('F9')).toBeTruthy();
    expect(urls().some(u => u.includes('section=excluded') && u.includes('rootValue=2'))).toBe(true);
  });

  test('units sold and projected units are their own KPIs, each with the consignment figure', async () => {
    await loaded();
    const sold = screen.getByText('Unidades vendidas').parentElement!;
    expect(within(sold).getByText('39')).toBeTruthy();
    expect(within(sold).getByText('39.0% de la meta (100) · Con consignación: 139')).toBeTruthy();  // goal comes from Ana's 100-unit quota
    const proj = screen.getByText('Proyección de unidades').parentElement!;
    expect(within(proj).getByText('86')).toBeTruthy();
    expect(within(proj).getByText('85.8% de la meta · Con consignación: 306')).toBeTruthy();
  });

  test('a response without the units fields (cached before they existed) renders a dash, never NaN', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const res = await defaultFetch(url, init);
      if (!url.includes('/api/dwh/seguimiento') || url.includes('section=')) return res;
      const body = await res.json();
      for (const k of ['projectedUnits', 'projectedUnitsWithConsignment', 'unitsWithConsignment']) delete body.total[k];
      return json(body);
    });
    await loaded();
    expect(document.body.textContent).not.toContain('NaN');
    expect(within(screen.getByText('Proyección de unidades').parentElement!).getByText('—')).toBeTruthy();
  });

  test('Ventas brutas shows the total including consignment in its subtitle', async () => {
    await loaded();
    const card = screen.getByText('Ventas brutas').parentElement!;
    expect(within(card).getByText(/Con consignación:/)).toBeTruthy();
    expect(screen.queryByText('Consignación (varios vendedores)')).toBeNull();
  });

  test('Bs currency shows Bs sales, but every figure compared with the USD goal stays in USD', async () => {
    await loaded('bs');
    expect(screen.getAllByText(/^Bs\. /).length).toBeGreaterThan(0);             // KPI "Ventas brutas"
    const ana = screen.getByRole('article', { name: 'Ana' });
    expect(within(ana).getByRole('img', { name: 'Ventas $70, meta $100, proyección $154' })).toBeTruthy();
    expect(within(ana).getByText('Meta en USD')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Tabla' }));
    const table = await screen.findByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Meta (USD)' })).toBeTruthy();
  });

  test('the consignment toggle reports whether its invoice list is open', async () => {
    await loaded();
    expect(screen.getByRole('heading', { level: 3, name: 'Facturas excluidas — patrón de consignación' })).toBeTruthy();
    const toggle = screen.getByRole('button', { name: /Beto: .* excluidos/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  test('server error shows the message and no cards', async () => {
    fetchMock.mockImplementationOnce(async () => json({ error: 'Error al consultar el Data Warehouse' }, false, 500));
    render(<TabSeguimiento dateRange="30d" currency="usd" />);
    expect(await screen.findByText('Error al consultar el Data Warehouse')).toBeTruthy();
    expect(screen.queryByRole('article')).toBeNull();
  });

  test('a month without data shows an empty state, not zeros', async () => {
    fetchMock.mockImplementationOnce(async () => json({ ...fixtureResponse('vendedor'), roots: [] }));
    render(<TabSeguimiento dateRange="30d" currency="usd" />);
    expect(await screen.findByText('Sin datos para este mes.')).toBeTruthy();
  });
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
const excludedBody = (invoiceNumber: string) => ({
  invoices: [{ customerCode: 'C4', customerName: 'Cadena Raiz', invoiceNumber, invoiceDate: '2026-10-05', amountNet: { bs: 9000, usd: 180 } }],
});

describe('TabSeguimiento review fixes', () => {
  test('two quota saves back to back (refetch still pending) keep both edits in the second POST', async () => {
    await loaded();
    const ana = screen.getByRole('article', { name: 'Ana' });
    await userEvent.click(within(ana).getByRole('button', { name: 'Editar metas' }));
    // From here on the post-save refetch never returns, so the card keeps the pre-save targets.
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/admin/seller-targets') return json({ ok: true });
      if (url.includes('/api/dwh/seguimiento') && !url.includes('section=')) return new Promise<Response>(() => {});
      return defaultFetch(url, init);
    });
    await userEvent.click(within(ana).getByRole('button', { name: 'Editar meta (100USD)' }));
    await userEvent.clear(within(ana).getByRole('spinbutton'));
    await userEvent.type(within(ana).getByRole('spinbutton'), '120');
    await userEvent.click(within(ana).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(c => String(c[0]) === '/api/admin/seller-targets').length).toBe(1));

    await userEvent.click(within(ana).getByRole('button', { name: 'Editar meta (2)' }));
    await userEvent.clear(within(ana).getByRole('spinbutton'));
    await userEvent.type(within(ana).getByRole('spinbutton'), '5');
    await userEvent.click(within(ana).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(c => String(c[0]) === '/api/admin/seller-targets').length).toBe(2));
    const second = fetchMock.mock.calls.filter(c => String(c[0]) === '/api/admin/seller-targets')[1];
    expect(JSON.parse(String((second[1] as RequestInit).body))).toEqual({
      salesRepKey: '1', periodMonth: '2026-10', salesQuotaUsd: 120, weeklyVisitQuota: 5, newCustomerQuota: 1, unitsQuota: 100,
    });
    expect(within(ana).getByRole('button', { name: 'Editar meta (120USD)' })).toBeTruthy();
  });

  test('a stale excluded-invoices response never replaces the latest one', async () => {
    await loaded();
    const first = deferred<Response>();
    const second = deferred<Response>();
    const pending = [first, second];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url.includes('section=excluded') ? pending.shift()!.promise : defaultFetch(url, init));
    const toggle = screen.getByRole('button', { name: /Beto: .* excluidos/ });
    await userEvent.click(toggle);          // open: request 1 (slow)
    await userEvent.click(toggle);          // close
    await userEvent.click(toggle);          // reopen: request 2
    await act(async () => { second.resolve(json(excludedBody('F-NEW'))); });
    expect(await screen.findByText('F-NEW')).toBeTruthy();
    await act(async () => { first.resolve(json(excludedBody('F-OLD'))); });
    expect(screen.queryByText('F-OLD')).toBeNull();
    expect(screen.getByText('F-NEW')).toBeTruthy();
  });

  test('a failed excluded-invoices request shows an error, not "Sin facturas."', async () => {
    await loaded();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url.includes('section=excluded') ? json({ error: 'boom' }, false, 500) : defaultFetch(url, init));
    await userEvent.click(screen.getByRole('button', { name: /Beto: .* excluidos/ }));
    expect(await screen.findByText('No se pudieron cargar las facturas excluidas')).toBeTruthy();
    expect(screen.queryByText('Sin facturas.')).toBeNull();
  });

  test('invoice lines from a previous date range are dropped and refetched for the new one', async () => {
    const { rerender } = await loaded();
    const slow = deferred<Response>();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url.includes('section=lines') && url.includes('dateRange=30d') ? slow.promise : defaultFetch(url, init));
    let ana = screen.getByRole('article', { name: 'Ana' });
    await userEvent.click(within(ana).getByRole('button', { name: 'Ver clientes' }));
    await userEvent.click(within(ana).getByRole('button', { name: /Cliente Uno/ }));

    rerender(<TabSeguimiento dateRange="month:2026-09" currency="usd" />);
    await waitFor(() => expect(urls().some(u => u.includes('dateRange=month%3A2026-09') && !u.includes('section='))).toBe(true));
    await act(async () => { slow.resolve(json({ lines: FIXTURE_INVOICE_LINES })); });

    ana = await screen.findByRole('article', { name: 'Ana' });
    await userEvent.click(within(ana).getByRole('button', { name: 'Ver clientes' }));
    await userEvent.click(within(ana).getByRole('button', { name: /Cliente Uno/ }));
    await waitFor(() => expect(urls().some(u => u.includes('section=lines') && u.includes('dateRange=month%3A2026-09'))).toBe(true));
  });

  test('invoice-lines requests do not send the unused kind param', async () => {
    await loaded();
    const ana = screen.getByRole('article', { name: 'Ana' });
    await userEvent.click(within(ana).getByRole('button', { name: 'Ver clientes' }));
    await userEvent.click(within(ana).getByRole('button', { name: /Cliente Uno/ }));
    await within(ana).findByRole('region', { name: 'Líneas de factura' });
    const linesUrl = urls().find(u => u.includes('section=lines'))!;
    expect(linesUrl).not.toContain('kind=');
  });

  test('a failed load keeps the toggles so another grouping can be chosen', async () => {
    fetchMock.mockImplementationOnce(async () => json({ error: 'Error al consultar el Data Warehouse' }, false, 500));
    render(<TabSeguimiento dateRange="30d" currency="usd" />);
    expect(await screen.findByText('Error al consultar el Data Warehouse')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Ruta' }));
    expect(await screen.findByRole('article', { name: 'Ruta 3' })).toBeTruthy();
    expect(screen.queryByText('Error al consultar el Data Warehouse')).toBeNull();
  });
});
