import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

const { default: TabVentas } = await import('../tab-ventas');

const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as unknown as Response;

const kpis = {
  salesGross: { bs: 1000, usd: 100 }, returns: { bs: 100, usd: 10 }, salesNet: { bs: 900, usd: 90 }, returnRate: 0.1,
  unitsSold: 50, unitsReturned: 5, customersWithSales: 8, customersWithReturns: 2, customersNet: 7,
};
const row = (over: Record<string, unknown> = {}) => ({
  label: 'Cliente A', value: '7',
  salesGross: { bs: 1000, usd: 100 }, returns: { bs: 100, usd: 10 }, salesNet: { bs: 900, usd: 90 }, returnRate: 0.1, units: 40,
  ...over,
});

let calls: string[] = [];
let groupRows: unknown[] = [row()];
beforeEach(() => {
  calls = [];
  groupRows = [row()];
  globalThis.fetch = mock(async (url: string) => {
    calls.push(url);
    if (url.includes('/resumen')) return json({ empty: false, kpis, trend: [], trendMode: 'month' });
    const groupBy = new URL(`http://x${url}`).searchParams.get('groupBy');
    return json({ groupBy, rows: groupRows });
  }) as unknown as typeof fetch;
});
afterEach(cleanup);

const props = { dateRange: 'month:2025-03', granularity: 'month', returnsBasis: 'devolucion' } as const;

describe('Historica TabVentas', () => {
  test('loads the strip and the cliente table for the range', async () => {
    render(<TabVentas {...props} currency="bs" />);
    expect(await screen.findByText('Cliente A')).toBeTruthy();
    expect(calls.some(u => u.startsWith('/api/dwh/analitica-historica/resumen?dateRange=month:2025-03'))).toBe(true);
    expect(calls.some(u => u.includes('/ventas?') && u.includes('groupBy=cliente') && u.includes('returnsBasis=devolucion'))).toBe(true);
  });

  test('switching the grouping refetches with the new groupBy', async () => {
    render(<TabVentas {...props} currency="bs" />);
    await screen.findByText('Cliente A');
    fireEvent.click(screen.getByText('Línea'));
    await screen.findByText('Cliente A');
    expect(calls.some(u => u.includes('groupBy=linea'))).toBe(true);
  });

  test('clicking a línea drills into its productos with the línea as parentValue', async () => {
    groupRows = [row({ label: 'Panadería', value: 'PAN' })];
    render(<TabVentas {...props} currency="bs" />);
    await screen.findByText('Panadería');
    fireEvent.click(screen.getByRole('button', { name: 'Línea' }));
    await waitFor(() => expect(calls.some(u => u.includes('groupBy=linea'))).toBe(true));
    fireEvent.click(await screen.findByText('Panadería'));
    await waitFor(() => expect(calls.some(u => u.includes('groupBy=producto') && u.includes('parentValue=PAN'))).toBe(true));
  });

  test('a negative net is shown signed and a null USD is "Sin datos"', async () => {
    groupRows = [row({ salesGross: { bs: 0, usd: null }, returns: { bs: 50, usd: null }, salesNet: { bs: -50, usd: null }, returnRate: null })];
    render(<TabVentas {...props} currency="usd" />);
    await screen.findByText('Cliente A');
    expect(screen.getAllByText('Sin datos').length).toBeGreaterThan(0);
    expect(screen.queryByText('$0')).toBeNull();
  });

  test('no rows renders the empty state', async () => {
    groupRows = [];
    render(<TabVentas {...props} currency="bs" />);
    expect(await screen.findByText(/Sin datos en el período/)).toBeTruthy();
  });
});
