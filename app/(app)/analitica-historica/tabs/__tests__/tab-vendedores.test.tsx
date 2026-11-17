import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

const { default: TabVendedores } = await import('../tab-vendedores');

const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as unknown as Response;

const stats = (over: Record<string, unknown> = {}) => ({
  salesGross: { bs: 600, usd: 60 }, returns: { bs: 60, usd: 6 }, salesNet: { bs: 540, usd: 54 },
  returnRate: 0.1, units: 30, customersServed: 2, storesServed: 6, ...over,
});
const trend = [{
  bucket: '2025-03', salesGross: { bs: 1000, usd: 100 }, returnsNet: { bs: 100, usd: 10 }, salesNet: { bs: 900, usd: 90 },
}];

let calls: string[] = [];
let response: Record<string, unknown>;
beforeEach(() => {
  calls = [];
  response = {
    empty: false,
    rows: [{ salesRepKey: 3, label: 'Ana', ...stats() }, { salesRepKey: null, label: 'Sin vendedor', ...stats({ units: 20 }) }],
    total: stats({ salesGross: { bs: 1200, usd: 120 }, units: 50, customersServed: 5, storesServed: 9 }),
    trend, trendMode: 'month',
  };
  globalThis.fetch = mock(async (url: string) => { calls.push(url); return json(response); }) as unknown as typeof fetch;
});
afterEach(cleanup);

const props = { dateRange: 'month:2025-03', granularity: 'month', returnsBasis: 'devolucion', clienteDimension: 'entidad' } as const;

describe('Historica TabVendedores', () => {
  test('requests the legacy vendedores endpoint and lists sellers with a total row', async () => {
    render(<TabVendedores {...props} currency="bs" />);
    expect(await screen.findByText('Ana')).toBeTruthy();
    expect(calls[0]).toBe('/api/dwh/analitica-historica/vendedores?dateRange=month:2025-03&granularity=month&returnsBasis=devolucion');
    expect(screen.getByText('Sin vendedor')).toBeTruthy();
    expect(screen.getByText('Total')).toBeTruthy();
  });

  test('clicking a seller refetches the trend for that seller', async () => {
    render(<TabVendedores {...props} currency="bs" />);
    fireEvent.click(await screen.findByText('Ana'));
    await waitFor(() => expect(calls.some(u => u.includes('salesRepKey=3'))).toBe(true));
  });

  test('clicking "Sin vendedor" asks for key 0', async () => {
    render(<TabVendedores {...props} currency="bs" />);
    fireEvent.click(await screen.findByText('Sin vendedor'));
    await waitFor(() => expect(calls.some(u => u.includes('salesRepKey=0'))).toBe(true));
  });

  test('shows clients (casa matriz) and stores served in separate columns', async () => {
    render(<TabVendedores {...props} currency="bs" />);
    await screen.findByText('Ana');
    expect(screen.getByText('Clientes atendidos')).toBeTruthy();
    expect(screen.getByText('Tiendas atendidas')).toBeTruthy();
  });

  test('a null USD amount is "Sin datos", never $0', async () => {
    response.rows = [{ salesRepKey: 3, label: 'Ana', ...stats({ salesGross: { bs: 600, usd: null }, salesNet: { bs: 540, usd: null } }) }];
    response.total = stats({ salesGross: { bs: 600, usd: null }, salesNet: { bs: 540, usd: null } });
    render(<TabVendedores {...props} currency="usd" />);
    await screen.findByText('Ana');
    expect(screen.getAllByText('Sin datos').length).toBeGreaterThan(0);
    expect(screen.queryByText('$0')).toBeNull();
  });

  test('an empty range shows the empty state', async () => {
    response = { empty: true, rows: [], total: null, trend: [], trendMode: 'month' };
    render(<TabVendedores {...props} currency="bs" />);
    expect(await screen.findByText(/Sin datos en el período/)).toBeTruthy();
  });

  test('an API error is shown', async () => {
    globalThis.fetch = mock(async () => json({ error: 'Error al consultar el Data Warehouse' }, false, 500)) as unknown as typeof fetch;
    render(<TabVendedores {...props} currency="bs" />);
    expect(await screen.findByText('Error al consultar el Data Warehouse')).toBeTruthy();
  });
});
