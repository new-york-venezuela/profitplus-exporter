import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';

const { default: TabResumen } = await import('../tab-resumen');

const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as unknown as Response;

const kpis = (usd: number | null) => ({
  salesGross: { bs: 1000, usd },
  returns: { bs: 100, usd: usd === null ? null : 10 },
  salesNet: { bs: 900, usd: usd === null ? null : 90 },
  returnRate: 0.1,
  unitsSold: 50,
  unitsReturned: 5,
  customersWithSales: 8,
  customersWithReturns: 2,
  customersNet: 7,
  entitiesWithSales: 4,
  entitiesWithReturns: 1,
  entitiesNet: 3,
});

const body = (usd: number | null) => ({
  empty: false,
  kpis: kpis(usd),
  trend: [{
    bucket: '2025-03',
    salesGross: { bs: 1000, usd },
    returnsNet: { bs: 100, usd: usd === null ? null : 10 },
    salesNet: { bs: 900, usd: usd === null ? null : 90 },
  }],
  trendMode: 'month',
});

const props = { dateRange: 'month:2025-03', granularity: 'month', returnsBasis: 'devolucion', clienteDimension: 'entidad' } as const;

beforeEach(() => { globalThis.fetch = mock(async () => json(body(100))) as unknown as typeof fetch; });
afterEach(cleanup);

describe('Historica TabResumen', () => {
  test('requests the legacy resumen endpoint with the range, granularity and basis', async () => {
    render(<TabResumen {...props} currency="bs" />);
    await screen.findByText('Ventas brutas');
    const url = (globalThis.fetch as unknown as { mock: { calls: string[][] } }).mock.calls[0][0];
    expect(url).toBe('/api/dwh/analitica-historica/resumen?dateRange=month:2025-03&granularity=month&returnsBasis=devolucion');
  });

  test('shows the Ventas strip with Bs amounts', async () => {
    render(<TabResumen {...props} currency="bs" />);
    expect(await screen.findByText('Bs. 1.000')).toBeTruthy();
  });

  test('clients are counted by casa matriz and stores separately', async () => {
    render(<TabResumen {...props} currency="bs" />);
    await screen.findByText('Ventas brutas');
    expect(screen.getAllByText('Clientes (casa matriz)').length).toBe(3);
    expect(screen.getAllByText('Tiendas').length).toBe(3);
    expect(screen.getByText('4')).toBeTruthy(); // entitiesWithSales
    expect(screen.getByText('8')).toBeTruthy(); // customersWithSales (stores)
  });

  test('USD with no exchange rate renders "Sin datos", never $0', async () => {
    globalThis.fetch = mock(async () => json(body(null))) as unknown as typeof fetch;
    render(<TabResumen {...props} currency="usd" />);
    await screen.findByText('Ventas brutas');
    expect(screen.getAllByText('Sin datos').length).toBeGreaterThan(0);
    expect(screen.queryByText('$0')).toBeNull();
  });

  test('an empty range renders the empty state', async () => {
    globalThis.fetch = mock(async () => json({ empty: true, kpis: null, trend: [], trendMode: 'month' })) as unknown as typeof fetch;
    render(<TabResumen {...props} currency="bs" />);
    expect(await screen.findByText(/Sin datos en el período/)).toBeTruthy();
  });

  test('an API error is shown', async () => {
    globalThis.fetch = mock(async () => json({ error: 'Error al consultar el Data Warehouse' }, false, 500)) as unknown as typeof fetch;
    render(<TabResumen {...props} currency="bs" />);
    expect(await screen.findByText('Error al consultar el Data Warehouse')).toBeTruthy();
  });
});
