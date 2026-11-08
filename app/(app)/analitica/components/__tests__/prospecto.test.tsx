import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

mock.module('posthog-js', () => ({ default: { capture: () => {}, identify: () => {} } }));
mock.module('next/dynamic', () => ({ default: () => () => null }));

const { default: TabProspecto } = await import('../../tabs/tab-prospecto');

const OPTIONS = {
  types: [{ code: 'SUP', name: 'Supermercado', count: 12 }],
  routes: [{ number: 7, name: 'Ruta 7', customers: 20 }],
};

function result(over: Record<string, unknown> = {}) {
  return {
    tier: 'type_route',
    peerCount: 6,
    lowPeers: false,
    units: { median: 10, p25: 8, p75: 14 },
    mix: [{ productCode: 'A', productName: 'Pan Canilla', share: 1, costUsd: 3.92 }],
    benefit: { medianUsd: 16.8, p25Usd: 13.44, p75Usd: 23.52, incomplete: false },
    peers: [{ code: 'C1', name: 'Tienda Uno', routeNumber: 7, weeklyUnits: 10, weeklyBenefitUsd: 16.8 }],
    excludedNoRoute: 0,
    suggestedRoute: null,
    ...over,
  };
}

let urls: string[] = [];
function mockFetch(res: Record<string, unknown>) {
  urls = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    const body = url.includes('section=options') ? OPTIONS : res;
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
}

const props = { dateRange: '30d', currency: 'usd', granularity: 'month', returnsBasis: 'devolucion' } as unknown as React.ComponentProps<typeof TabProspecto>;

async function fill() {
  render(<TabProspecto {...props} />);
  await screen.findByRole('option', { name: /Supermercado/ });
  await userEvent.selectOptions(screen.getByLabelText('Tipo de tienda'), 'SUP');
  const route = screen.getByRole('textbox', { name: 'Ruta' });
  await userEvent.click(route);
  await userEvent.click(await screen.findByRole('button', { name: /Ruta 7/ }));
}

beforeEach(() => { urls = []; });
afterEach(cleanup);

describe('TabProspecto', () => {
  test('renders the headline from the API and the 12-week note', async () => {
    mockFetch(result());
    await fill();
    expect((await screen.findAllByText('$16,80')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('10,0').length).toBeGreaterThan(0);
    expect(screen.getByText('Últimas 12 semanas completas')).toBeTruthy();
    expect(screen.getByText('Tienda Uno', { exact: false })).toBeTruthy();
    expect(urls.some(u => u.includes('tipo=SUP') && u.includes('ruta=7') && u.includes('margen=30'))).toBe(true);
  });

  test('shows low-peers, incomplete and no-route banners', async () => {
    mockFetch(result({
      peerCount: 3, lowPeers: true, excludedNoRoute: 4,
      benefit: { medianUsd: 5, p25Usd: 4, p75Usd: 6, incomplete: true },
    }));
    await fill();
    expect(await screen.findByText(/Pocos pares \(3\): tómelo como referencia/)).toBeTruthy();
    expect(screen.getByText(/Algunos productos no tienen costo \(Sin datos\)/)).toBeTruthy();
    expect(screen.getByText(/4 clientes sin ruta \(de todos los tipos\) no se consideraron/)).toBeTruthy();
  });

  test('benefit null with peers says "Sin datos de costo" and never shows $0', async () => {
    mockFetch(result({ benefit: null, mix: [{ productCode: 'A', productName: 'Pan', share: 1, costUsd: null }] }));
    await fill();
    expect(await screen.findByText('Sin datos de costo')).toBeTruthy();
    expect(screen.queryByText(/\$0/)).toBeNull();
    expect(screen.queryByText('Sin pares suficientes')).toBeNull();
  });

  test('zero peers says "Sin pares suficientes" and never shows $0', async () => {
    mockFetch(result({ peerCount: 0, lowPeers: true, units: null, mix: [], benefit: null, peers: [] }));
    await fill();
    expect((await screen.findAllByText('Sin pares suficientes')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/\$0/)).toBeNull();
    expect(screen.queryByText('Sin datos de costo')).toBeNull();
  });

  test('changing the margin refetches with margen= in the URL', async () => {
    mockFetch(result());
    await fill();
    await screen.findAllByText('$16,80');
    { const m = screen.getByLabelText('Margen de la tienda (%)'); await userEvent.clear(m); await userEvent.type(m, '40'); }
    await waitFor(() => expect(urls.some(u => u.includes('margen=40'))).toBe(true), { timeout: 2000 });
  });

  test('an invalid margin shows an inline error and does not fetch', async () => {
    mockFetch(result());
    await fill();
    await screen.findAllByText('$16,80');
    const before = urls.length;
    { const m = screen.getByLabelText('Margen de la tienda (%)'); await userEvent.clear(m); await userEvent.type(m, '100'); }
    expect(await screen.findByText(/Margen inválido/)).toBeTruthy();
    await new Promise(r => setTimeout(r, 600));
    expect(urls.length).toBe(before);
  });
});
