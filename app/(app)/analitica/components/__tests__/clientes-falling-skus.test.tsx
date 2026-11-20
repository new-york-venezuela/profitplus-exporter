import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor, within } from '@testing-library/react';
import { parseClientesParams, type ClientesParams } from '../../lib/clientes-params';
import type { CatalogoRow } from '../../types';

const { FallingSkus } = await import('../clientes/falling-skus');

const m = (bs: number, usd: number | null) => ({ bs, usd });
const sku = (code: string, over: Partial<CatalogoRow>): CatalogoRow => ({
  key: code, label: `Producto ${code}`, code, linea: 'Pan', sublinea: 'Dulce', salesGross: m(100, 10), returns: m(0, 0), salesNet: m(100, 10),
  units: 10, monthCount: 1, avgUnitsPerMonth: 10, avgPrice: m(10, 1), returnRate: null, clientCount: 2, posCount: 2, sharePct: 0.1, pareto: 'A',
  prevNet: m(200, 20), trendPct: -0.5, ...over,
});
let rows: CatalogoRow[] = [];
const fetchMock = mock<(url: string) => Promise<Response>>(async () => ({ ok: true, json: async () => ({ nivel: 'sku', rows }) }) as unknown as Response);
beforeEach(() => {
  rows = [];
  fetchMock.mockClear();
  fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ nivel: 'sku', rows }) }) as unknown as Response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);

const params = (qs = ''): ClientesParams => parseClientesParams(new URLSearchParams(qs));
const base = { dateRange: 'month:2026-10', currency: 'usd' as const };

describe('FallingSkus', () => {
  test('requests SKUs at the scope (tienda, grupo, ruta) and ignores the product drill', async () => {
    render(<FallingSkus {...base} params={params('tienda=e:12&grupo=S1&ruta=3&lineas=Pan&nivel=sublinea')} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('section=catalogo');
    expect(url).toContain('nivel=sku');
    expect(url).toContain('tienda=e%3A12');
    expect(url).toContain('ruta=3');
    expect(url).not.toContain('lineas=');
  });

  test('lists the most negative trend first', async () => {
    rows = [sku('A', { trendPct: -0.2 }), sku('B', { trendPct: -0.8 }), sku('C', { trendPct: -0.5 })];
    render(<FallingSkus {...base} params={params()} />);
    const items = await screen.findAllByRole('listitem');
    expect(items.map(li => within(li).getByRole('link').textContent)).toEqual(['Producto B', 'Producto C', 'Producto A']);
  });

  test('excludes growing SKUs and SKUs without a prior base (null is never a drop)', async () => {
    rows = [
      sku('UP', { trendPct: 0.4 }),
      sku('NOBASE', { trendPct: null, prevNet: null }),
      sku('ZERO', { trendPct: -1, prevNet: m(0, 0) }),
      sku('DOWN', { trendPct: -0.3 }),
    ];
    render(<FallingSkus {...base} params={params()} />);
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('Producto DOWN');
  });

  test('each link opens Productos with the SKU, the scope and the range', async () => {
    rows = [sku('P1', {})];
    render(<FallingSkus {...base} params={params('tienda=e:12&grupo=S1')} />);
    const link = await screen.findByRole('link', { name: 'Producto P1' });
    const url = new URL(link.getAttribute('href') as string, 'http://x');
    expect(url.pathname).toBe('/analitica');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ tab: 'productos', q: 'P1', nivel: 'sku', tienda: 'e:12', grupo: 'S1', dateRange: 'month:2026-10' });
  });

  test('empty scope says there is no data; no falling SKU says so too', async () => {
    const { unmount } = render(<FallingSkus {...base} params={params()} />);
    expect(await screen.findByText('Sin datos de productos para este alcance.')).toBeTruthy();
    unmount();
    rows = [sku('UP', { trendPct: 0.4 })];
    render(<FallingSkus {...base} params={params()} />);
    expect(await screen.findByText('Ningún SKU cae frente al período anterior.')).toBeTruthy();
  });
});
