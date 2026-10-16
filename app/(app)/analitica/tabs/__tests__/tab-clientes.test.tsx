import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClientesFiltersResponse, CoberturaResponse, CoberturaRowView } from '../../types';

mock.module('posthog-js', () => ({ default: { capture: () => {} } }));
mock.module('../../components/seguimiento/visuals', () => ({
  VisitBadge: ({ visit }: { visit: { status: string } }) => <span>{visit.status}</span>,
}));
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

function bodyFor(url: string): unknown {
  if (url.includes('/cobertura')) return cobertura;
  if (url.includes('section=filters')) return filters;
  if (url.includes('section=trend')) return { rows: [] };
  if (url.includes('section=churned')) return { rows: [], available: true };
  return { rows: [], paretoThresholds: { a: 0.2, b: 0.5 } };
}
const fetchMock = mock<(url: string) => Promise<Response>>(async url => ({ ok: true, json: async () => bodyFor(url) }) as unknown as Response);

beforeEach(() => {
  fetchMock.mockClear();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);

const calls = (pred: (u: string) => boolean) => fetchMock.mock.calls.map(c => String(c[0])).filter(pred);
const coberturaSection = () => screen.getByRole('region', { name: 'Cobertura de clientes' });

describe('TabClientes', () => {
  test('changing the group keeps Cobertura mounted: its local filters survive and /cobertura is not refetched', async () => {
    render(<TabClientes dateRange="month:2026-10" currency="usd" />);
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
    render(<TabClientes dateRange="month:2026-10" currency="usd" />);
    await screen.findByRole('region', { name: 'Cobertura de clientes' });
    expect(calls(u => u.includes('/cobertura'))[0]).toContain('dateRange=month%3A2026-10');
  });
});
