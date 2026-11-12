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
  if (url.includes('section=history')) return json({ points: [{ month: '2026-09', sales: { bs: 5000, usd: 100 }, units: 10, returns: { bs: 0, usd: 0 }, returnUnits: 0 }] });
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
const grid = () => screen.getByRole('table', { name: 'Cuadrícula de seguimiento' });
async function select(name: string) {
  await userEvent.click(within(grid()).getByRole('button', { name: new RegExp(`^${name}`) }));
  return screen.findByRole('region', { name: `Detalle de ${name}` });
}

describe('TabSeguimiento', () => {
  test('loads vendedor roots by default: month pace and one grid row per seller, goal cards on top', async () => {
    await loaded();
    expect(urls()[0]).toContain('kind=vendedor');
    expect(urls()[0]).toContain('dateRange=30d');
    expect(within(grid()).getByRole('button', { name: /^Ana/ })).toBeTruthy();
    expect(within(grid()).getByRole('button', { name: /^Beto/ })).toBeTruthy();
    expect(screen.getByText(/Día laborable 10 de 22/)).toBeTruthy();
    // the two goal KPI cards sit above the grid
    expect(screen.getByRole('region', { name: 'Ventas brutas' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Unidades vendidas' })).toBeTruthy();
    expect(screen.queryByText('Visitas vencidas')).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
    // nothing selected yet: no detail
    expect(screen.queryByRole('region', { name: /^Detalle de/ })).toBeNull();
  });

  test('grid status: Ana projects $154 of $100 (En meta); Beto $18 of $50 (Bajo meta)', async () => {
    await loaded();
    const anaRow = within(grid()).getByRole('button', { name: /^Ana/ }).closest('tr')!;
    expect(within(anaRow).getAllByTestId('grid-status')[0].textContent).toContain('En meta');
    expect(within(anaRow).getByText('35 / 100')).toBeTruthy();
    const betoRow = within(grid()).getByRole('button', { name: /^Beto/ }).closest('tr')!;
    expect(within(betoRow).getAllByTestId('grid-status')[0].textContent).toContain('Bajo meta');
  });

  test('selecting a seller shows matrix, estimado, categories, new customers and customers; captures the event', async () => {
    await loaded();
    const detail = await select('Ana');
    expect(capture).toHaveBeenCalledWith('seguimiento_root_selected', { kind: 'vendedor' });
    expect(within(detail).getByRole('table', { name: /semana/i })).toBeTruthy();
    expect(within(detail).getByRole('region', { name: 'Estimado' })).toBeTruthy();
    expect(within(detail).getByRole('table', { name: 'Categorías' })).toBeTruthy();
    expect(within(detail).getByRole('heading', { name: 'Clientes nuevos' })).toBeTruthy();
    expect(within(detail).getByRole('heading', { name: 'Clientes' })).toBeTruthy();
    expect(within(detail).getByRole('button', { name: 'Cliente Uno' })).toBeTruthy();
    expect(within(detail).getAllByRole('img', { name: /Semanas con factura/ }).length).toBe(2);
    // clicking the selected row again closes the detail
    await userEvent.click(within(grid()).getByRole('button', { name: /^Ana/ }));
    expect(screen.queryByRole('region', { name: 'Detalle de Ana' })).toBeNull();
  });

  test('switching the root toggle refetches with the new kind and drops the selection', async () => {
    await loaded();
    await select('Ana');
    await userEvent.click(screen.getByRole('button', { name: 'Ruta' }));
    await waitFor(() => expect(urls().some(u => u.includes('kind=ruta'))).toBe(true));
    expect(capture).toHaveBeenCalledWith('seguimiento_root_changed', { kind: 'ruta' });
    expect(await within(grid()).findByRole('button', { name: /^Ruta 3/ })).toBeTruthy();
    expect(screen.queryByRole('region', { name: /^Detalle de/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Grupo de cliente' }));
    expect(await within(grid()).findByRole('button', { name: /^Abasto/ })).toBeTruthy();
  });

  test('selecting a route renders the same detail: matrix and customer list, no seller actions', async () => {
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Ruta' }));
    await within(grid()).findByRole('button', { name: /^Ruta 3/ });
    const detail = await select('Ruta 3');
    expect(within(detail).getByRole('table', { name: /semana/i })).toBeTruthy();
    expect(within(detail).getByRole('button', { name: 'Cliente Dos' })).toBeTruthy();
    expect(within(detail).getByRole('button', { name: 'Cliente Uno' })).toBeTruthy();
    expect(within(detail).queryByRole('button', { name: 'Ver perfil' })).toBeNull();
    expect(within(detail).queryByRole('button', { name: 'Editar metas' })).toBeNull();
    const routeRow = within(grid()).getByRole('button', { name: /^Ruta 3/ }).closest('tr')!;
    expect(within(routeRow).queryByTestId('grid-status')).toBeNull();
  });

  test('a selected group shows its detail too', async () => {
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Grupo de cliente' }));
    await within(grid()).findByRole('button', { name: /^Abasto/ });
    const detail = await select('Abasto');
    expect(within(detail).getByRole('table', { name: /semana/i })).toBeTruthy();
    expect(within(detail).getByRole('button', { name: 'Cliente Uno' })).toBeTruthy();
  });

  test('hierarchy: select a seller, then a customer to see its invoice lines', async () => {
    await loaded();
    const detail = await select('Ana');
    await userEvent.click(within(detail).getByRole('button', { name: 'Cliente Uno' }));
    const region = await within(detail).findByRole('region', { name: 'Líneas de factura' });
    expect(urls().some(u => u.includes('section=lines') && u.includes('customerCode=C1'))).toBe(true);
    expect(within(region).getByText('F000101')).toBeTruthy();
    expect(within(region).getByText('Pizza Familiar')).toBeTruthy();
  });

  test('"Ver perfil" opens the seller profile with the Seguimiento back label', async () => {
    await loaded();
    const detail = await select('Ana');
    await userEvent.click(within(detail).getByRole('button', { name: 'Ver perfil' }));
    expect(await screen.findByText('Perfil mock 1')).toBeTruthy();
    expect(profileProps.at(-1)).toMatchObject({ salesRepKey: '1', dateRange: '30d', currency: 'usd', backLabel: 'Volver a Seguimiento' });
    await act(async () => { (profileProps.at(-1)!.onBack as () => void)(); });
    expect(await screen.findByRole('heading', { name: 'Seguimiento de ventas' })).toBeTruthy();
  });

  test('inline quota editing sends the FULL row for the response month, refetches without cache and keeps the selection', async () => {
    await loaded();
    const detail = await select('Ana');
    await userEvent.click(within(detail).getByRole('button', { name: 'Editar metas' }));
    fetchMock.mockClear();
    await userEvent.click(within(detail).getByRole('button', { name: 'Editar meta (100USD)' }));
    const input = within(detail).getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '120');
    await userEvent.click(within(detail).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(c => String(c[0]) === '/api/admin/seller-targets')).toBe(true));
    const post = fetchMock.mock.calls.find(c => String(c[0]) === '/api/admin/seller-targets')!;
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual({
      salesRepKey: '1', periodMonth: '2026-10', salesQuotaUsd: 120, weeklyVisitQuota: 2, newCustomerQuota: 1, unitsQuota: 100,
    });
    await waitFor(() => expect(fetchMock.mock.calls.filter(c => String(c[0]).includes('/api/dwh/seguimiento')).length).toBeGreaterThan(0));
    const refetch = fetchMock.mock.calls.find(c => String(c[0]).includes('/api/dwh/seguimiento'))!;
    expect((refetch[1] as RequestInit | undefined)?.cache).toBe('no-store');
    expect(await screen.findByRole('region', { name: 'Detalle de Ana' })).toBeTruthy();
  });

  test('consignment footnote lists the excluded invoices of that seller on demand', async () => {
    await loaded();
    expect(screen.getByRole('heading', { name: 'Facturas excluidas — patrón de consignación' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Beto: .* excluidos/ }));
    expect(await screen.findByText('F9')).toBeTruthy();
    expect(urls().some(u => u.includes('section=excluded') && u.includes('rootValue=2'))).toBe(true);
  });

  test('a response without the units fields (cached before they existed) renders a dash, never NaN', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const res = await defaultFetch(url, init);
      if (!url.includes('/api/dwh/seguimiento') || url.includes('section=')) return res;
      const body = await res.json();
      for (const k of ['projectedUnits', 'projectedUnitsWithConsignment', 'unitsWithConsignment']) delete body.total[k];
      for (const r of body.roots) delete r.projectedUnits;
      return json(body);
    });
    await loaded();
    await select('Ana');
    expect(document.body.textContent).not.toContain('NaN');
  });

  test('Bs currency shows Bs amounts, but the goal comparison in Estimado stays in USD', async () => {
    await loaded('bs');
    expect(within(grid()).getAllByText(/^Bs\. /).length).toBeGreaterThan(0);
    const detail = await select('Ana');
    const est = within(detail).getByRole('region', { name: 'Estimado' });
    expect(within(est).getByText('$154')).toBeTruthy();
    expect(within(est).getByText(/meta \$100/)).toBeTruthy();
  });

  test('the consignment toggle reports whether its invoice list is open', async () => {
    await loaded();
    expect(screen.getByRole('heading', { level: 3, name: 'Facturas excluidas — patrón de consignación' })).toBeTruthy();
    const toggle = screen.getByRole('button', { name: /Beto: .* excluidos/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  test('server error shows the message and no grid', async () => {
    fetchMock.mockImplementationOnce(async () => json({ error: 'Error al consultar el Data Warehouse' }, false, 500));
    render(<TabSeguimiento dateRange="30d" currency="usd" />);
    expect(await screen.findByText('Error al consultar el Data Warehouse')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
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
    const ana = await select('Ana');
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
    let ana = await select('Ana');
    await userEvent.click(within(ana).getByRole('button', { name: /Cliente Uno/ }));

    rerender(<TabSeguimiento dateRange="month:2026-09" currency="usd" />);
    await waitFor(() => expect(urls().some(u => u.includes('dateRange=month%3A2026-09') && !u.includes('section='))).toBe(true));
    await act(async () => { slow.resolve(json({ lines: FIXTURE_INVOICE_LINES })); });

    // the new month's data drops the selection; select Ana again once it is on screen
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Detalle de Ana' })).toBeNull());
    ana = await select('Ana');
    await userEvent.click(within(ana).getByRole('button', { name: /Cliente Uno/ }));
    await waitFor(() => expect(urls().some(u => u.includes('section=lines') && u.includes('dateRange=month%3A2026-09'))).toBe(true));
  });

  test('invoice-lines requests do not send the unused kind param', async () => {
    await loaded();
    const ana = await select('Ana');
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
    expect(await within(grid()).findByRole('button', { name: /^Ruta 3/ })).toBeTruthy();
    expect(screen.queryByText('Error al consultar el Data Warehouse')).toBeNull();
  });

  test('history is requested for the total (no rootValue) and then for the selected root', async () => {
    await loaded();
    await screen.findByRole('region', { name: 'Historial mes a mes' });
    const first = urls().find(u => u.includes('section=history'))!;
    expect(first).toContain('kind=vendedor');
    expect(first).not.toContain('rootValue');
    await select('Ana');
    await waitFor(() => expect(urls().some(u => u.includes('section=history') && u.includes('rootValue=1'))).toBe(true));
  });

  test('a history error shows a message while the grid still renders', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('section=history')) return json({ error: 'boom' }, false, 500);
      return defaultFetch(url);
    });
    await loaded();
    expect(await screen.findByText('No se pudo cargar el historial mes a mes')).toBeTruthy();
    expect(within(grid()).getByRole('button', { name: /^Ana/ })).toBeTruthy();
  });

  test('while history is pending it reads "Cargando historial…", never a "Sin datos" flash', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('section=history')) return new Promise<Response>(() => {});
      return defaultFetch(url);
    });
    await loaded();
    expect(screen.getByText('Cargando historial…')).toBeTruthy();
    expect(screen.queryByText('Sin datos')).toBeNull();
  });

  test('the history title names the selected root, Total otherwise', async () => {
    await loaded();
    expect(await screen.findByRole('heading', { name: 'Mes a mes · Total' })).toBeTruthy();
    await select('Ana');
    expect(await screen.findByRole('heading', { name: /^Mes a mes · Ana/ })).toBeTruthy();
  });

  test('Clientes nuevos shows net sales', async () => {
    await loaded();
    const detail = await select('Ana');
    const heading = within(detail).getByRole('heading', { name: 'Clientes nuevos' });
    const table = heading.parentElement!.querySelector('table')!;
    expect(within(table).getByRole('columnheader', { name: 'Ventas netas' })).toBeTruthy();
  });
});
