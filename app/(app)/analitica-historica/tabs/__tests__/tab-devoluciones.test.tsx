import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

const { default: TabDevoluciones } = await import('../tab-devoluciones');

const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as unknown as Response;

const kpis = {
  salesGross: { bs: 1000, usd: 100 }, returns: { bs: 100, usd: 10 }, salesNet: { bs: 900, usd: 90 }, returnRate: 0.1,
  unitsSold: 50, unitsReturned: 5, customersWithSales: 8, customersWithReturns: 2, customersNet: 7, entitiesWithSales: 4, entitiesWithReturns: 1, entitiesNet: 3,
};
const row = (over: Record<string, unknown> = {}) => ({
  label: 'Cliente A', value: '7', returns: { bs: 100, usd: 10 }, salesGross: { bs: 1000, usd: 100 }, returnRate: 0.1, unitsReturned: 5, ...over,
});

let calls: string[] = [];
let response: unknown;
beforeEach(() => {
  calls = [];
  response = { empty: false, groupBy: 'cliente', kpis, rows: [row()] };
  globalThis.fetch = mock(async (url: string) => { calls.push(url); return json(response); }) as unknown as typeof fetch;
});
afterEach(cleanup);

const props = { dateRange: 'month:2025-03', granularity: 'month', returnsBasis: 'devolucion', clienteDimension: 'entidad' } as const;

describe('Historica TabDevoluciones', () => {
  test('requests the legacy devoluciones endpoint for the range, basis and grouping', async () => {
    render(<TabDevoluciones {...props} currency="bs" />);
    expect(await screen.findByText('Cliente A')).toBeTruthy();
    expect(calls[0]).toBe('/api/dwh/analitica-historica/devoluciones?dateRange=month:2025-03&granularity=month&returnsBasis=devolucion&clienteDimension=entidad&groupBy=cliente');
  });

  test('the basis note follows the selector', async () => {
    render(<TabDevoluciones {...props} returnsBasis="factura" currency="bs" />);
    await screen.findByText('Cliente A');
    expect(screen.getAllByText(/por fecha de factura/).length).toBeGreaterThan(0);
  });

  test('switching to Producto refetches with groupBy=sku', async () => {
    render(<TabDevoluciones {...props} currency="bs" />);
    await screen.findByText('Cliente A');
    fireEvent.click(screen.getByRole('button', { name: 'Producto' }));
    await waitFor(() => expect(calls.some(u => u.includes('groupBy=sku'))).toBe(true));
  });

  test('a null USD amount is "Sin datos", never $0', async () => {
    response = { empty: false, groupBy: 'cliente', kpis: { ...kpis, returns: { bs: 100, usd: null } }, rows: [row({ returns: { bs: 100, usd: null }, salesGross: { bs: 1000, usd: null } })] };
    render(<TabDevoluciones {...props} currency="usd" />);
    await screen.findByText('Cliente A');
    expect(screen.getAllByText('Sin datos').length).toBeGreaterThan(0);
    expect(screen.queryByText('$0')).toBeNull();
  });

  test('an empty range shows the empty state', async () => {
    response = { empty: true, groupBy: 'cliente', kpis: null, rows: [] };
    render(<TabDevoluciones {...props} currency="bs" />);
    expect(await screen.findByText(/Sin datos en el período/)).toBeTruthy();
  });

  test('no returns in the period shows a message instead of an empty table', async () => {
    response = { empty: false, groupBy: 'cliente', kpis, rows: [] };
    render(<TabDevoluciones {...props} currency="bs" />);
    expect(await screen.findByText(/Sin devoluciones/)).toBeTruthy();
  });
});
