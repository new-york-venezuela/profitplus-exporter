import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { makeKpis } from '../../components/resumen/__tests__/fixtures';

const { default: TabResumen } = await import('../tab-resumen');

const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as unknown as Response;

const response = {
  kpis: makeKpis(),
  monthlyTrend: [
    { bucket: '2026-09', salesGross: { bs: 1000, usd: 100 }, returnsNet: { bs: 40, usd: 4 }, salesNet: { bs: 960, usd: 96 } },
  ],
  trendMode: 'month',
  agingBuckets: [{ bucket: 'Current', amount: { bs: 1, usd: 1 } }],
  topDebtors: [{ name: 'Deudor SA', outstanding: { bs: 1, usd: 1 } }],
  topCustomers: [],
  topProducts: [],
  salesReps: [],
  snapshotDateKey: 20260930,
};

beforeEach(() => {
  globalThis.fetch = mock(async () => json(null)) as unknown as typeof fetch;
});
afterEach(cleanup);

describe('TabResumen', () => {
  test('loading and error states render without the pace strip', async () => {
    globalThis.fetch = mock(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    render(<TabResumen dateRange="month:2026-09" currency="usd" granularity="month" />);
    expect(screen.getByText('Cargando…')).toBeTruthy();
    expect(screen.queryByText(/Día laborable/)).toBeNull();
  });

  test('error message is shown', async () => {
    globalThis.fetch = mock(async () => json({ error: 'Error al consultar el Data Warehouse' }, false, 500)) as unknown as typeof fetch;
    render(<TabResumen dateRange="30d" currency="usd" granularity="month" />);
    expect(await screen.findByText('Error al consultar el Data Warehouse')).toBeTruthy();
  });

  test('empty body shows the empty state', async () => {
    render(<TabResumen dateRange="30d" currency="bs" granularity="month" />);
    expect(await screen.findByText('Sin datos disponibles todavía.')).toBeTruthy();
  });

  test('renders the four sections in order and drops removed blocks', async () => {
    globalThis.fetch = mock(async () => json(response)) as unknown as typeof fetch;
    render(<TabResumen dateRange="month:2026-09" currency="usd" granularity="month" />);
    const h = [
      await screen.findByRole('heading', { name: 'Ventas del período' }),
      screen.getByRole('heading', { name: 'Clientes' }),
      screen.getByRole('heading', { name: 'Cuentas por cobrar' }),
      screen.getByRole('heading', { name: 'Ventas netas y devoluciones' }),
    ];
    for (let i = 0; i < h.length - 1; i++) {
      expect(h[i].compareDocumentPosition(h[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.queryByText(/Día laborable/)).toBeNull();
    expect(screen.queryByText(/Antigüedad de saldos/)).toBeNull();
    expect(screen.queryByText(/Mayor concentración/)).toBeNull();
    expect(screen.queryByText('Deudor SA')).toBeNull();
  });

  test('does not render Top 10 clientes, Top 10 productos or Desempeño por vendedor', async () => {
    globalThis.fetch = mock(async () => json(response)) as unknown as typeof fetch;
    render(<TabResumen dateRange="month:2026-09" currency="usd" granularity="month" />);
    await screen.findByRole('heading', { name: 'Ventas del período' });
    expect(screen.queryByText('Top 10 clientes')).toBeNull();
    expect(screen.queryByText('Top 10 productos')).toBeNull();
    expect(screen.queryByText('Desempeño por vendedor')).toBeNull();
  });
});
