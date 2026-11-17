import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { default: TabProductos } = await import('../tab-productos');

const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as unknown as Response;

const row = (over: Record<string, unknown> = {}) => ({
  key: 'Panadería', label: 'Panadería', code: null, linea: 'Panadería', sublinea: '',
  salesGross: { bs: 1000, usd: 100 }, returns: { bs: 100, usd: 10 }, salesNet: { bs: 900, usd: 90 },
  units: 100, monthCount: 2, avgUnitsPerMonth: 50, avgPrice: { bs: 10, usd: 1 }, returnRate: 0.1,
  clientCount: 5, posCount: 5, sharePct: 1, pareto: 'A', prevNet: null, trendPct: null, ...over,
});

let calls: string[] = [];
let catalogo: unknown;
beforeEach(() => {
  calls = [];
  catalogo = { nivel: 'linea', rows: [row()] };
  globalThis.fetch = mock(async (url: string) => {
    calls.push(url);
    if (url.includes('section=filtros')) {
      return json({ lineas: ['Panadería', 'Sin línea'], sublineas: [{ linea: 'Panadería', sublinea: 'Pan' }], categorias: ['Fresco'] });
    }
    return json(catalogo);
  }) as unknown as typeof fetch;
});
afterEach(cleanup);

const props = { dateRange: 'month:2025-03', granularity: 'month', returnsBasis: 'devolucion' } as const;
const catalogoCalls = () => calls.filter(u => u.includes('section=catalogo'));

describe('Historica TabProductos', () => {
  test('requests the legacy catalogo with the range, basis, nivel and currency', async () => {
    render(<TabProductos {...props} currency="bs" />);
    await screen.findByText('Panadería');
    expect(catalogoCalls()[0]).toBe('/api/dwh/analitica-historica/productos?section=catalogo&dateRange=month:2025-03&returnsBasis=devolucion&nivel=linea&currency=bs');
  });

  test('shows reach as distinct customers, not "tiendas"', async () => {
    render(<TabProductos {...props} currency="bs" />);
    await screen.findByText('Panadería');
    expect(screen.getByText('5 clientes')).toBeTruthy();
    expect(screen.queryByText(/tiendas/)).toBeNull();
  });

  test('switching the level refetches with the new nivel', async () => {
    render(<TabProductos {...props} currency="bs" />);
    await screen.findByText('Panadería');
    fireEvent.click(screen.getByRole('button', { name: 'SKU' }));
    await waitFor(() => expect(catalogoCalls().some(u => u.includes('nivel=sku'))).toBe(true));
  });

  test('switching the metric to Unidades only re-sorts: no new request', async () => {
    render(<TabProductos {...props} currency="bs" />);
    await screen.findByText('Panadería');
    // The control bar comes first; the table header also has an "Unidades" sort button.
    fireEvent.click(screen.getAllByRole('button', { name: 'Unidades' })[0]);
    expect(screen.getAllByRole('button', { name: 'Unidades' })[0].getAttribute('aria-pressed')).toBe('true');
    expect(catalogoCalls()).toHaveLength(1);
  });

  test('searching sends q', async () => {
    render(<TabProductos {...props} currency="bs" />);
    await screen.findByText('Panadería');
    await userEvent.type(screen.getByLabelText('Buscar producto'), 'pan');
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(catalogoCalls().some(u => u.includes('&q=pan'))).toBe(true));
  });

  test('a product with only returns shows its negative net and null USD is "Sin datos"', async () => {
    catalogo = { nivel: 'linea', rows: [row({ salesGross: { bs: 0, usd: null }, returns: { bs: 30, usd: null }, salesNet: { bs: -30, usd: null }, units: 0, pareto: 'C', returnRate: null, sharePct: -0.1 })] };
    render(<TabProductos {...props} currency="usd" />);
    await screen.findByText('Panadería');
    expect(screen.getAllByText('Sin datos').length).toBeGreaterThan(0);
    expect(screen.queryByText('$0')).toBeNull();
  });

  test('an API error is shown', async () => {
    globalThis.fetch = mock(async () => json({ error: 'Error al consultar el Data Warehouse' }, false, 500)) as unknown as typeof fetch;
    render(<TabProductos {...props} currency="bs" />);
    expect(await screen.findByText('Error al consultar el Data Warehouse')).toBeTruthy();
  });
});
