import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { useSyncExternalStore } from 'react';
import { cleanup, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClientesFiltersResponse, CoberturaResponse, CoberturaRowView } from '../../types';

// The tab keeps its state in the URL: a tiny stateful router so that replace() re-renders subscribers.
let search = '';
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
mock.module('next/navigation', () => ({
  useRouter: () => ({ replace: (u: string) => { search = u.split('?')[1] ?? ''; listeners.forEach(l => l()); }, push: () => {} }),
  useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => search)),
  usePathname: () => '/analitica',
}));
mock.module('posthog-js', () => ({ default: { capture: () => {} } }));
mock.module('../../components/seguimiento/visuals', () => ({
  VisitBadge: ({ visit }: { visit: { status: string } }) => <span>{visit.status}</span>,
}));
const downloadCsv = mock<(name: string, records: unknown[]) => void>(() => {});
mock.module('../../lib/clientes-export', () => ({ downloadCsv }));
const { default: TabClientes } = await import('../tab-clientes');

const noVisit = { status: 'no_interval' as const, daysSinceLastInvoice: null, intervalDays: null, daysOverdue: null };
const base: CoberturaRowView = {
  customerCode: 'X', customerName: 'X', entityName: null, sellerCode: null, sellerName: null,
  lastSaleDateKey: null, entityLastSaleDateKey: null, daysSinceLastSale: null,
  avgMonthlyUsd: null, avgMonthlyUnits: null, monthsWithSales: 0, status: 'never',
  routeNumber: null, groupCode: null, groupName: null, kind: null, visit: noVisit, activeInPeriod: true,
  registeredDate: null, firstSaleDateKey: null, daysToFirstSale: null, salesPeriod: { bs: 0, usd: 0 }, salesPrev: null, boughtPrev: null, stickiness: 'sin_frecuencia',
};
const cobertura: CoberturaResponse = {
  rows: [
    { ...base, customerCode: 'C1', customerName: 'Uno Abasto', groupCode: 'S1', groupName: 'Abasto', status: 'lapsed', lastSaleDateKey: 20260701, daysSinceLastSale: 90 },
    { ...base, customerCode: 'C2', customerName: 'Dos Abasto', groupCode: 'S1', groupName: 'Abasto', status: 'active', lastSaleDateKey: 20261001, daysSinceLastSale: 3 },
    { ...base, customerCode: 'C3', customerName: 'Tres Resto', groupCode: 'S2', groupName: 'Restaurante', status: 'lapsed', lastSaleDateKey: 20260601, daysSinceLastSale: 120 },
  ],
  asOfDateKey: 20261004, windowStartDateKey: 20251101, lapsedAfterDays: 30, kindYear: 2026, prevPeriodAvailable: true,
};
const filters: ClientesFiltersResponse = {
  groups: [{ value: 'S1', label: 'Abasto' }, { value: 'S2', label: 'Restaurante' }],
  routes: [{ value: '3', label: 'Ruta 3' }],
};

const money = (bs: number) => ({ bs, usd: bs / 10 });
const pareto = (name: string, gross: number, segment: 'A' | 'B' | 'C') => ({
  name, salesGross: money(gross), returnsNet: money(0), salesNet: money(gross), returnRate: null, pareto: segment,
});
let paretoRows: ReturnType<typeof pareto>[] = [];
let churnedRows: { name: string; lastPurchaseDateKey: number; lostRevenue: { bs: number; usd: number } }[] = [];

function bodyFor(url: string): unknown {
  if (url.includes('/cobertura')) return cobertura;
  if (url.includes('section=filters')) return filters;
  if (url.includes('section=trend')) return { rows: [] };
  if (url.includes('section=churned')) return { rows: churnedRows, available: true };
  return { rows: paretoRows, paretoThresholds: { a: 0.2, b: 0.5 } };
}
const fetchMock = mock<(url: string) => Promise<Response>>(async url => ({ ok: true, json: async () => bodyFor(url) }) as unknown as Response);

beforeEach(() => {
  search = 'detalle=1';
  paretoRows = [];
  churnedRows = [];
  downloadCsv.mockClear();
  fetchMock.mockClear();
  fetchMock.mockImplementation(async url => ({ ok: true, json: async () => bodyFor(url) }) as unknown as Response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);

const calls = (pred: (u: string) => boolean) => fetchMock.mock.calls.map(c => String(c[0])).filter(pred);
const coberturaSection = () => screen.getByRole('region', { name: 'Cobertura de clientes' });

describe('TabClientes', () => {
  test('changing the group keeps Cobertura mounted: its local filters survive and /cobertura is not refetched', async () => {
    render(<TabClientes dateRange="month:2026-10" currency="usd" granularity="day" />);
    await screen.findByRole('region', { name: 'Cobertura de clientes' });
    const user = userEvent.setup();

    await user.selectOptions(within(coberturaSection()).getByLabelText('Filtrar por estado'), 'lapsed');
    expect(coberturaSection().querySelectorAll('tbody tr')).toHaveLength(2);
    expect(calls(u => u.includes('/cobertura'))).toHaveLength(1);

    await user.click(screen.getByRole('textbox', { name: 'Filtrar por grupo' }));
    await user.click(await screen.findByRole('button', { name: 'Abasto' }));

    // The Pareto list, trend and churned reload with the scope...
    await waitFor(() => {
      expect(calls(u => !u.includes('/cobertura') && !u.includes('section=') && u.includes('grupo=S1'))).toHaveLength(1);
      expect(calls(u => u.includes('section=trend') && u.includes('grupo=S1'))).toHaveLength(1);
      expect(calls(u => u.includes('section=churned') && u.includes('grupo=S1'))).toHaveLength(1);
    });
    // ...while Cobertura filters client-side: same fetch, status filter kept, now scoped to S1.
    expect(calls(u => u.includes('/cobertura'))).toHaveLength(1);
    expect((within(coberturaSection()).getByLabelText('Filtrar por estado') as HTMLSelectElement).value).toBe('lapsed');
    const names = [...coberturaSection().querySelectorAll('tbody tr')].map(tr => tr.querySelector('td')!.firstChild!.textContent);
    expect(names).toEqual(['Uno Abasto']);
  });

  test('the date range reaches the Cobertura request', async () => {
    render(<TabClientes dateRange="month:2026-10" currency="usd" granularity="day" />);
    await screen.findByRole('region', { name: 'Cobertura de clientes' });
    expect(calls(u => u.includes('/cobertura'))[0]).toContain('dateRange=month%3A2026-10');
  });

  test('renders the scope bar and the Q1 heading', async () => {
    render(<TabClientes dateRange="month:2026-10" currency="usd" granularity="day" />);
    expect(screen.getByRole('heading', { name: '¿Cómo evolucionan las ventas?' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Filtrar por grupo' })).toBeTruthy();
    expect(screen.getByText(/Año de referencia: 2026/)).toBeTruthy();
    await screen.findByRole('region', { name: 'Cobertura de clientes' });
  });

  test('the granularity reaches the trend request', async () => {
    render(<TabClientes dateRange="month:2026-10" currency="usd" granularity="week" />);
    await waitFor(() => expect(calls(u => u.includes('section=trend') && u.includes('granularity=week'))).toHaveLength(1));
  });

  test('Detalle operativo is collapsed by default and opens when detalle=1', async () => {
    search = '';
    const { container, unmount } = render(<TabClientes dateRange="month:2026-10" currency="usd" granularity="day" />);
    expect((container.querySelector('details') as HTMLDetailsElement).open).toBe(false);
    unmount();
    search = 'detalle=1';
    const again = render(<TabClientes dateRange="month:2026-10" currency="usd" granularity="day" />);
    expect((again.container.querySelector('details') as HTMLDetailsElement).open).toBe(true);
  });

  test('keeps previous data visible while a filter change reloads', async () => {
    fetchMock.mockImplementation(async url => {
      if (url.includes('section=trend')) {
        const body = { rows: [{ bucketKey: '2026-10-01', label: '1 Oct', activeCustomers: 5, churnRate: null }, { bucketKey: '2026-10-02', label: '2 Oct', activeCustomers: 6, churnRate: 0 }], granularity: 'day' };
        if (url.includes('grupo=S1')) return new Promise<Response>(() => {});
        return { ok: true, json: async () => body } as unknown as Response;
      }
      return { ok: true, json: async () => bodyFor(url) } as unknown as Response;
    });
    render(<TabClientes dateRange="month:2026-10" currency="usd" granularity="day" />);
    await screen.findByRole('button', { name: 'Ver tabla' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('textbox', { name: 'Filtrar por grupo' }));
    await user.click(await screen.findByRole('button', { name: 'Abasto' }));
    await waitFor(() => expect(calls(u => u.includes('section=trend') && u.includes('grupo=S1'))).toHaveLength(1));
    expect(screen.getByRole('button', { name: 'Ver tabla' })).toBeTruthy();
    expect(screen.queryByText('Cargando…')).toBeNull();
  });

  test('a failed trend request shows a retry button that refetches', async () => {
    fetchMock.mockImplementation(async url => {
      if (url.includes('section=trend')) return { ok: false, json: async () => ({ error: 'Falló' }) } as unknown as Response;
      return { ok: true, json: async () => bodyFor(url) } as unknown as Response;
    });
    render(<TabClientes dateRange="month:2026-10" currency="usd" granularity="day" />);
    const retry = await screen.findByRole('button', { name: 'Reintentar' });
    const before = calls(u => u.includes('section=trend')).length;
    await userEvent.setup().click(retry);
    await waitFor(() => expect(calls(u => u.includes('section=trend')).length).toBe(before + 1));
  });

  test('Pareto headers are buttons that expose aria-sort', async () => {
    paretoRows = [pareto('Alfa', 100, 'A'), pareto('Beta', 300, 'B')];
    render(<TabClientes dateRange="month:2026-10" currency="usd" granularity="day" />);
    const region = await screen.findByRole('region', { name: 'Pareto de clientes' });
    const header = await within(region).findByRole('columnheader', { name: /Ventas netas/ });
    expect(header.getAttribute('aria-sort')).toBe('none');
    await userEvent.setup().click(within(header).getByRole('button'));
    expect(header.getAttribute('aria-sort')).toBe('ascending');
  });

  test('Pareto search filters rows', async () => {
    paretoRows = [pareto('Alfa', 100, 'A'), pareto('Beta', 300, 'B')];
    render(<TabClientes dateRange="month:2026-10" currency="usd" granularity="day" />);
    const region = await screen.findByRole('region', { name: 'Pareto de clientes' });
    await within(region).findByText('Beta');
    await userEvent.setup().type(within(region).getByRole('searchbox'), 'alf');
    expect(within(region).queryByText('Beta')).toBeNull();
    expect(within(region).getByText('Alfa')).toBeTruthy();
  });

  test('duplicate customer names render two rows', async () => {
    paretoRows = [pareto('Mismo', 100, 'A'), pareto('Mismo', 90, 'B')];
    render(<TabClientes dateRange="month:2026-10" currency="usd" granularity="day" />);
    const region = await screen.findByRole('region', { name: 'Pareto de clientes' });
    await waitFor(() => expect(within(region).getAllByText('Mismo')).toHaveLength(2));
  });

  test('the segment filter is aria-pressed and narrows the rows', async () => {
    paretoRows = [pareto('Alfa', 100, 'A'), pareto('Beta', 300, 'B')];
    render(<TabClientes dateRange="month:2026-10" currency="usd" granularity="day" />);
    const region = await screen.findByRole('region', { name: 'Pareto de clientes' });
    await within(region).findByText('Beta');
    await userEvent.setup().click(within(region).getByRole('button', { name: /^A/ }));
    expect(within(region).queryByText('Beta')).toBeNull();
    expect(within(region).getByRole('button', { name: /^A/ }).getAttribute('aria-pressed')).toBe('true');
  });

  test('Perdidos can be exported (downloadCsv called with the rows)', async () => {
    churnedRows = [{ name: 'Gama Centro', lastPurchaseDateKey: 20260915, lostRevenue: { bs: 500, usd: 50 } }];
    render(<TabClientes dateRange="month:2026-10" currency="usd" granularity="day" />);
    const region = await screen.findByRole('region', { name: 'Clientes perdidos' });
    await within(region).findByText('Gama Centro');
    await userEvent.setup().click(within(region).getByRole('button', { name: /Exportar CSV/ }));
    expect(downloadCsv).toHaveBeenCalledTimes(1);
    expect((downloadCsv.mock.calls[0][1] as { Cliente: string }[])[0].Cliente).toBe('Gama Centro');
  });
});
