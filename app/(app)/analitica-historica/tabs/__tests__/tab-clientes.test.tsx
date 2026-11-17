import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { default: TabClientes } = await import('../tab-clientes');

const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as unknown as Response;

const row = (over: Record<string, unknown> = {}) => ({
  key: 'e1', code: 'C001', name: 'Cliente A', firstInvoiceKey: 20200315, lastInvoiceKey: 20250310, invoices: 4, stores: 2,
  salesGross: { bs: 1000, usd: 100 }, returns: { bs: 100, usd: 10 }, salesNet: { bs: 900, usd: 90 },
  returnRate: 0.1, units: 40, sharePct: 0.9, pareto: 'A', status: 'activo', ...over,
});

let calls: string[] = [];
let response: unknown;
beforeEach(() => {
  calls = [];
  response = { empty: false, rows: [row(), row({ key: 'e2', code: 'C002', name: 'Sin compras SA', status: 'sin_compras', invoices: 0, stores: 0, salesGross: { bs: 0, usd: 0 }, returns: { bs: 0, usd: 0 }, salesNet: { bs: 0, usd: 0 }, sharePct: null, pareto: 'C', returnRate: null, units: 0 })] };
  globalThis.fetch = mock(async (url: string) => { calls.push(url); return json(response); }) as unknown as typeof fetch;
});
afterEach(cleanup);

const props = { dateRange: 'month:2025-03', granularity: 'month', returnsBasis: 'devolucion', clienteDimension: 'entidad' } as const;

describe('Historica TabClientes', () => {
  test('requests the legacy clientes endpoint and lists customers with their dates', async () => {
    render(<TabClientes {...props} currency="bs" />);
    expect(await screen.findByText('Cliente A')).toBeTruthy();
    expect(calls[0]).toBe('/api/dwh/analitica-historica/clientes?dateRange=month:2025-03&returnsBasis=devolucion&clienteDimension=entidad');
    expect(screen.getAllByText('15/03/2020').length).toBeGreaterThan(0);
    expect(screen.getAllByText('10/03/2025').length).toBeGreaterThan(0);
  });

  test('shows how many stores of each casa matriz bought', async () => {
    render(<TabClientes {...props} currency="bs" />);
    await screen.findByText('Cliente A');
    expect(screen.getByText('2 tiendas')).toBeTruthy();
  });

  test('the per-store dimension is requested and shows no store count', async () => {
    render(<TabClientes {...props} clienteDimension="tienda" currency="bs" />);
    await screen.findByText('Cliente A');
    expect(calls[0]).toContain('clienteDimension=tienda');
    expect(screen.queryByText('2 tiendas')).toBeNull();
  });

  test('the "Sin compras" pill keeps only customers with no purchase in the period', async () => {
    render(<TabClientes {...props} currency="bs" />);
    await screen.findByText('Cliente A');
    fireEvent.click(screen.getByRole('button', { name: /Sin compras en el período/ }));
    expect(screen.queryByText('Cliente A')).toBeNull();
    expect(screen.getByText('Sin compras SA')).toBeTruthy();
  });

  test('a customer with only returns shows its negative net signed', async () => {
    response = { empty: false, rows: [row({ name: 'Solo dev', invoices: 0, salesGross: { bs: 0, usd: 0 }, returns: { bs: 50, usd: 5 }, salesNet: { bs: -50, usd: -5 }, sharePct: -0.05, pareto: 'C', returnRate: null, status: 'sin_compras' })] };
    render(<TabClientes {...props} currency="bs" />);
    await screen.findByText('Solo dev');
    expect(screen.getByText('Bs. -50')).toBeTruthy();
    expect(screen.getByText('-5,0%')).toBeTruthy();
  });

  test('a null USD amount is "Sin datos", never $0', async () => {
    response = { empty: false, rows: [row({ salesGross: { bs: 1000, usd: null }, returns: { bs: 0, usd: null }, salesNet: { bs: 1000, usd: null } })] };
    render(<TabClientes {...props} currency="usd" />);
    await screen.findByText('Cliente A');
    expect(screen.getAllByText('Sin datos').length).toBeGreaterThan(0);
    expect(screen.queryByText('$0')).toBeNull();
  });

  test('submitting the search box refetches with q', async () => {
    render(<TabClientes {...props} currency="bs" />);
    await screen.findByText('Cliente A');
    await userEvent.type(screen.getByLabelText('Buscar cliente'), 'pan');
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(calls.some(u => u.includes('&q=pan'))).toBe(true));
  });

  test('an empty range shows the empty state', async () => {
    response = { empty: true, rows: [] };
    render(<TabClientes {...props} currency="bs" />);
    expect(await screen.findByText(/Sin datos en el período/)).toBeTruthy();
  });
});
