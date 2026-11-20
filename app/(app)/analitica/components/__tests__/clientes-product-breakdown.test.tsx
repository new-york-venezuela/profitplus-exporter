import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseClientesParams, type ClientesParams } from '../../lib/clientes-params';

// The chart itself is not clickable in happy-dom: a stub exposes onSeriesClick as buttons.
mock.module('../productos/trend-card', () => ({
  default: ({ onSeriesClick }: { onSeriesClick: (s: string) => void }) => (
    <div>
      <button onClick={() => onSeriesClick('Pan')}>serie Pan</button>
      <button onClick={() => onSeriesClick('Otras')}>serie Otras</button>
    </div>
  ),
}));
mock.module('../productos/customer-accordion', () => ({ default: () => <span>clientes del producto</span> }));
const { ProductBreakdown } = await import('../clientes/product-breakdown');

const catalogo = { nivel: 'linea', rows: [
  { key: 'Pan', label: 'Pan', code: null, linea: 'Pan', sublinea: '', salesGross: { bs: 100, usd: 10 }, returns: { bs: 0, usd: 0 }, salesNet: { bs: 100, usd: 10 },
    units: 5, monthCount: 1, avgUnitsPerMonth: 5, avgPrice: { bs: 20, usd: 2 }, returnRate: null, clientCount: 1, posCount: 1, sharePct: 1, pareto: 'A', prevNet: null, trendPct: null },
] };
const fetchMock = mock<(url: string) => Promise<Response>>(async url => ({ ok: true, json: async () => (url.includes('section=catalogo') ? catalogo : { rows: [], lineas: [], trendMode: 'month', nivel: 'linea', seriesMeta: {} }) }) as unknown as Response);
beforeEach(() => {
  fetchMock.mockClear();
  fetchMock.mockImplementation(async url => ({ ok: true, json: async () => (url.includes('section=catalogo') ? catalogo : { rows: [], lineas: [], trendMode: 'month', nivel: 'linea', seriesMeta: {} }) }) as unknown as Response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);

const params = (qs = ''): ClientesParams => parseClientesParams(new URLSearchParams(qs));
const base = { dateRange: 'month:2026-10', granularity: 'month' as const, currency: 'usd' as const };
const calls = (pred: (u: string) => boolean) => fetchMock.mock.calls.map(c => String(c[0])).filter(pred);

describe('ProductBreakdown', () => {
  test('requests the catalogo and the trend with the Clientes scope', async () => {
    render(<ProductBreakdown {...base} params={params('tienda=e:12&grupo=S1&ruta=3')} onParams={() => {}} />);
    await waitFor(() => expect(calls(u => u.includes('section=catalogo'))).toHaveLength(1));
    const url = calls(u => u.includes('section=catalogo'))[0];
    expect(url).toContain('tienda=e%3A12');
    expect(url).toContain('grupo=S1');
    expect(url).toContain('ruta=3');
    expect(calls(u => u.includes('section=porLineaMes') && u.includes('granularity=month'))).toHaveLength(1);
  });

  test('selecting another chain changes the product request', async () => {
    const { rerender } = render(<ProductBreakdown {...base} params={params('tienda=e:12')} onParams={() => {}} />);
    await waitFor(() => expect(calls(u => u.includes('section=catalogo'))).toHaveLength(1));
    rerender(<ProductBreakdown {...base} params={params('tienda=e:99')} onParams={() => {}} />);
    await waitFor(() => expect(calls(u => u.includes('section=catalogo') && u.includes('tienda=e%3A99'))).toHaveLength(1));
  });

  test('clicking a línea segment drills to its sublíneas', async () => {
    const onParams = mock<(p: Partial<ClientesParams>) => void>(() => {});
    render(<ProductBreakdown {...base} params={params()} onParams={onParams} />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'serie Pan' }));
    expect(onParams).toHaveBeenCalledWith({ lineas: ['Pan'], sublineas: [], nivel: 'sublinea' });
  });

  test('clicking Otras does nothing', async () => {
    const onParams = mock<(p: Partial<ClientesParams>) => void>(() => {});
    render(<ProductBreakdown {...base} params={params()} onParams={onParams} />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'serie Otras' }));
    expect(onParams).not.toHaveBeenCalled();
  });

  test('a drilled view offers to clear the product filter', async () => {
    const onParams = mock<(p: Partial<ClientesParams>) => void>(() => {});
    render(<ProductBreakdown {...base} params={params('lineas=Pan&nivel=sublinea')} onParams={onParams} />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Quitar filtro de producto' }));
    expect(onParams).toHaveBeenCalledWith({ lineas: [], sublineas: [], q: '', nivel: 'linea' });
  });

  test('an API error shows the message', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, json: async () => ({ error: 'Falló la consulta' }) }) as unknown as Response);
    render(<ProductBreakdown {...base} params={params()} onParams={() => {}} />);
    expect((await screen.findAllByText('Falló la consulta')).length).toBeGreaterThan(0);
  });
});
