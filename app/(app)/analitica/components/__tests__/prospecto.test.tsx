import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

mock.module('posthog-js', () => ({ default: { capture: () => {}, identify: () => {} } }));
// Stub for the client-only pin picker: a button that confirms a fixed pin.
mock.module('next/dynamic', () => ({
  default: () => function PinStub({ onConfirm }: { onConfirm: (p: { lat: number; lng: number }) => void }) {
    return <button type="button" onClick={() => onConfirm({ lat: 10.5, lng: -66.9 })}>stub-confirmar-pin</button>;
  },
}));

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
let failMain = false;
let suggestRoute: number | null = 7;
let networkFail = false;
let hold: Promise<void> | null = null;
function mockFetch(res: Record<string, unknown>) {
  urls = [];
  failMain = false;
  networkFail = false;
  hold = null;
  suggestRoute = 7;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.includes('section=suggest')) return new Response(JSON.stringify({ route: suggestRoute }), { status: 200 });
    if (!url.includes('section=options') && networkFail) throw new TypeError('network down');
    if (!url.includes('section=options') && hold) await hold;
    if (!url.includes('section=options') && failMain) return new Response(JSON.stringify({ error: 'Falló la consulta' }), { status: 500 });
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
    await waitFor(() => expect(urls.some(u => new URL(u, 'http://x').searchParams.get('margen') === '40')).toBe(true), { timeout: 2000 });
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

  test('a failed request clears the previous result and shows the error', async () => {
    mockFetch(result());
    await fill();
    await screen.findAllByText('$16,80');
    failMain = true;
    const m = screen.getByLabelText('Margen de la tienda (%)');
    await userEvent.clear(m);
    await userEvent.type(m, '45');
    expect(await screen.findByText('Falló la consulta', {}, { timeout: 2000 })).toBeTruthy();
    expect(screen.queryByText('$16,80')).toBeNull();
    expect(screen.queryByText('Tienda Uno', { exact: false })).toBeNull();
  });

  test('a network error clears the previous result and shows the error', async () => {
    mockFetch(result());
    await fill();
    await screen.findAllByText('$16,80');
    networkFail = true;
    const m = screen.getByLabelText('Margen de la tienda (%)');
    await userEvent.clear(m);
    await userEvent.type(m, '46');
    expect(await screen.findByText('No se pudo conectar con el servidor', {}, { timeout: 2000 })).toBeTruthy();
    expect(screen.queryByText('$16,80')).toBeNull();
    expect(screen.queryByText('Tienda Uno', { exact: false })).toBeNull();
  });

  test('an in-flight request shows Cargando… and no stale result', async () => {
    mockFetch(result());
    await fill();
    await screen.findAllByText('$16,80');
    let release: () => void = () => {};
    hold = new Promise<void>(r => { release = r; });
    const m = screen.getByLabelText('Margen de la tienda (%)');
    await userEvent.clear(m);
    await userEvent.type(m, '47');
    expect(await screen.findByText('Cargando…', {}, { timeout: 2000 })).toBeTruthy();
    expect(screen.queryByText('$16,80')).toBeNull();
    expect(screen.queryByText('Tienda Uno', { exact: false })).toBeNull();
    release();
    expect((await screen.findAllByText('$16,80')).length).toBeGreaterThan(0);
  });

  test('static warnings are role=status, not alerts; only the margin error is an alert', async () => {
    mockFetch(result({ peerCount: 3, lowPeers: true }));
    await fill();
    const banner = await screen.findByText(/Pocos pares \(3\)/);
    expect(banner.closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(/unidades brutas \(sin devoluciones\)/)).toBeTruthy();
    expect(screen.getByText('Beneficio/sem. (mezcla típica)')).toBeTruthy();
  });

  test('shows the top 15 peers with a Ver todos toggle', async () => {
    const peers = Array.from({ length: 20 }, (_, i) => ({
      code: `C${i}`, name: `Tienda ${i}`, routeNumber: 7, weeklyUnits: 10, weeklyBenefitUsd: 1,
    }));
    mockFetch(result({ peers, peerCount: 20 }));
    await fill();
    await screen.findByText('Tienda 0', { exact: false });
    expect(screen.queryByText('Tienda 15', { exact: false })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Ver todos (20)' }));
    expect(screen.getByText('Tienda 19', { exact: false })).toBeTruthy();
  });

  test('an invalid margin hides the previous result', async () => {
    mockFetch(result());
    await fill();
    await screen.findAllByText('$16,80');
    const m = screen.getByLabelText('Margen de la tienda (%)');
    await userEvent.clear(m);
    await userEvent.type(m, '100');
    expect(await screen.findByText(/Corrija el margen/)).toBeTruthy();
    expect(screen.queryByText('$16,80')).toBeNull();
  });

  test('confirming a pin pre-fills the suggested route and later requests carry lat/lng', async () => {
    mockFetch(result());
    render(<TabProspecto {...props} />);
    await screen.findByRole('option', { name: /Supermercado/ });
    await userEvent.selectOptions(screen.getByLabelText('Tipo de tienda'), 'SUP');
    await userEvent.click(screen.getByRole('button', { name: 'Marcar en el mapa' }));
    await userEvent.click(await screen.findByRole('button', { name: 'stub-confirmar-pin' }));
    expect(await screen.findByText(/Ruta sugerida: 7/)).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Ruta' }) as HTMLInputElement).value).toMatch(/Ruta 7/);
    await waitFor(() => expect(urls.some(u => u.includes('section=suggest') && u.includes('lat=10.5') && u.includes('lng=-66.9'))).toBe(true));
    await waitFor(() => expect(urls.some(u => !u.includes('section=') && u.includes('ruta=7') && u.includes('lat=10.5') && u.includes('lng=-66.9'))).toBe(true));
  });
});
