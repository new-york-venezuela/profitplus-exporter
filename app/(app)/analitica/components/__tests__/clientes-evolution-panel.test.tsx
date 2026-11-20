import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UnitsByLineaResponse } from '../../types';

const { EvolutionPanel } = await import('../clientes/evolution-panel');

const data = (nivel: 'linea' | 'sku'): UnitsByLineaResponse => ({
  nivel, trendMode: 'month', lineas: nivel === 'linea' ? ['Pan', 'Otras'] : ['Pan campesino', 'Otras'], seriesMeta: {},
  rows: [
    { bucket: '2026-09', units: { [nivel === 'linea' ? 'Pan' : 'Pan campesino']: 10, Otras: 2 },
      salesGross: { [nivel === 'linea' ? 'Pan' : 'Pan campesino']: { bs: 100, usd: 10 }, Otras: { bs: 20, usd: 2 } }, totalSalesGross: { bs: 120, usd: 12 } },
    { bucket: '2026-10', units: { [nivel === 'linea' ? 'Pan' : 'Pan campesino']: 20, Otras: 4 },
      salesGross: { [nivel === 'linea' ? 'Pan' : 'Pan campesino']: { bs: 200, usd: null }, Otras: { bs: 40, usd: 4 } }, totalSalesGross: { bs: 240, usd: null } },
  ],
} as unknown as UnitsByLineaResponse);

const fetchMock = mock<(url: string) => Promise<Response>>(async url => ({ ok: true, json: async () => data(url.includes('nivel=sku') ? 'sku' : 'linea') }) as unknown as Response);
beforeEach(() => {
  fetchMock.mockClear();
  fetchMock.mockImplementation(async url => ({ ok: true, json: async () => data(url.includes('nivel=sku') ? 'sku' : 'linea') }) as unknown as Response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);

const base = { filterKey: 'e:12', dateRange: 'month:2026-10', granularity: 'month' as const, currency: 'usd' as const };
const urls = () => fetchMock.mock.calls.map(c => String(c[0]));
const showTable = async () => userEvent.setup().click(await screen.findByRole('button', { name: 'Ver tabla' }));

describe('EvolutionPanel', () => {
  test('requests the customer\'s product series with its scope, nivel and granularity', async () => {
    render(<EvolutionPanel {...base} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const url = urls()[0];
    expect(url).toContain('section=porLineaMes');
    expect(url).toContain('tienda=e%3A12');
    expect(url).toContain('nivel=linea');
    expect(url).toContain('granularity=month');
    expect(url).toContain('dateRange=month%3A2026-10');
  });

  test('switching Línea to SKU refetches at SKU level', async () => {
    render(<EvolutionPanel {...base} />);
    await screen.findByRole('button', { name: 'Ver tabla' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'SKU' }));
    await waitFor(() => expect(urls().some(u => u.includes('nivel=sku'))).toBe(true));
    expect(screen.getByRole('button', { name: 'SKU' }).getAttribute('aria-pressed')).toBe('true');
  });

  test('the table shows sales in the active currency; an unknown USD is a dash, never 0', async () => {
    render(<EvolutionPanel {...base} />);
    await showTable();
    const table = screen.getByRole('table');
    expect(within(table).getByText('$10')).toBeTruthy();
    expect(within(table).getAllByText('—')).toHaveLength(1);   // Oct 26 Pan has no USD
  });

  test('Unidades switches the table to units', async () => {
    render(<EvolutionPanel {...base} />);
    await showTable();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Unidades' }));
    const table = screen.getByRole('table');
    expect(within(table).getByText('20')).toBeTruthy();
    expect(within(table).queryByText('—')).toBeNull();
  });

  test('the table follows the currency toggle', async () => {
    render(<EvolutionPanel {...base} currency="bs" />);
    await showTable();
    expect(within(screen.getByRole('table')).getByText('Bs. 200')).toBeTruthy();
  });

  test('the chart type toggle (Líneas | Barras) is aria-pressed and defaults to Barras', async () => {
    render(<EvolutionPanel {...base} />);
    await screen.findByRole('button', { name: 'Ver tabla' });
    expect(screen.getByRole('button', { name: 'Barras' }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Líneas' }));
    expect(screen.getByRole('button', { name: 'Líneas' }).getAttribute('aria-pressed')).toBe('true');
  });

  test('a failed request shows the error with a retry; an empty customer says there is no data', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, json: async () => ({ error: 'Falló' }) }) as unknown as Response);
    const { unmount } = render(<EvolutionPanel {...base} />);
    expect(await screen.findByText('Falló')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));
    unmount();
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ ...data('linea'), rows: [], lineas: [] }) }) as unknown as Response);
    render(<EvolutionPanel {...base} />);
    expect(await screen.findByText('Sin ventas de productos en el período.')).toBeTruthy();
  });
});
