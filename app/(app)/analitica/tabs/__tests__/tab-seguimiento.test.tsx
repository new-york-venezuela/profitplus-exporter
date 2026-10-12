import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { act, cleanup, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FIXTURE_INVOICE_LINES, fixtureResponse } from '../../../../../__tests__/unit/seguimiento/fixture';

const capture = mock((_e: string, _p?: unknown) => {});
mock.module('posthog-js', () => ({ default: { capture } }));
const profileProps: Array<Record<string, unknown>> = [];
mock.module('../seller-profile', () => ({
  default: (props: Record<string, unknown>) => { profileProps.push(props); return <div>Perfil mock {String(props.salesRepKey)}</div>; },
}));
const { default: TabSeguimiento } = await import('../tab-seguimiento');

const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as unknown as Response;
const fetchMock = mock(async (url: string, _init?: RequestInit): Promise<Response> => {
  if (url.includes('section=lines')) return json({ lines: FIXTURE_INVOICE_LINES });
  if (url.includes('section=excluded')) {
    return json({ invoices: [{ customerCode: 'C4', customerName: 'Cadena Raiz', invoiceNumber: 'F9', invoiceDate: '2026-10-05', amountNet: { bs: 9000, usd: 180 } }] });
  }
  const kind = /kind=(\w+)/.exec(url)?.[1] ?? 'vendedor';
  return json(fixtureResponse(kind as 'vendedor' | 'ruta' | 'grupo'));
});
const urls = () => fetchMock.mock.calls.map(c => String(c[0]));

beforeEach(() => {
  fetchMock.mockClear(); capture.mockClear(); profileProps.length = 0;
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
    expect(screen.getByText('Meta de ventas')).toBeTruthy();
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
    expect(profileProps.at(-1)).toMatchObject({ salesRepKey: '1', dateRange: '30d', currency: 'usd', backLabel: 'Seguimiento' });
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
      salesRepKey: '1', periodMonth: '2026-10', salesQuotaUsd: 120, weeklyVisitQuota: 2, newCustomerQuota: 1,
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

  test('Bs currency shows Bs amounts on the cards', async () => {
    await loaded('bs');
    expect(within(screen.getByRole('article', { name: 'Ana' })).getAllByText(/Bs\. 3\.500/).length).toBeGreaterThan(0);
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
