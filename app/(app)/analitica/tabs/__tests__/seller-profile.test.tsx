import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Seller360Response } from '../../types';

// Spy on the shared helper while keeping its real behaviour, so the test proves SellerProfile
// persists quotas through saveSellerTargetField (no duplicate POST logic of its own).
const real = await import('../../components/quota-editor');
const realSave = real.saveSellerTargetField;
const saveSpy = mock((args: Parameters<typeof realSave>[0]) => realSave(args));
mock.module('../../components/quota-editor', () => ({
  QuotaEditor: real.QuotaEditor,
  EMPTY_TARGET_ROW: real.EMPTY_TARGET_ROW,
  saveSellerTargetField: saveSpy,
}));
const { default: SellerProfile } = await import('../seller-profile');

const profile: Seller360Response = {
  salesRepKey: '7',
  salesRepName: 'Ana',
  activacion: { weeks: [], entityGrain: 'entity', weeklyVisitQuota: 2 },
  cuota: { salesGross: { bs: 5000, usd: 100 }, quotaUsd: 100, isPartial: false },
  cobranza: { buckets: [], baselineBuckets: [] },
  nuevosClientes: { rows: [], quota: null, isPartial: false, possiblyIncludesPreExistingCustomers: false, factSalesMinDate: null },
  clientesRecuperados: { rows: [] },
  devoluciones: { byProduct: [], byTienda: [] },
  profundidad: { coverage: null },
  usdRate: 50,
};

const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body }) as unknown as Response;
const fetchMock = mock(async (url: string, init?: RequestInit): Promise<Response> => {
  if (url === '/api/admin/seller-targets' && init?.method === 'POST') return json({ ok: true });
  if (url.startsWith('/api/admin/seller-targets')) return json({ salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: null });
  return json(profile);
});

beforeEach(() => {
  fetchMock.mockClear();
  saveSpy.mockClear();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);

describe('SellerProfile quota sales label', () => {
  test('labels the quota sales as invoices issued by the seller, not as the Seguimiento card total', async () => {
    render(<SellerProfile salesRepKey="7" dateRange="month:2026-10" currency="usd" onBack={() => {}} />);
    expect(await screen.findByText('2. Cuota de ventas mensual — ventas facturadas por el vendedor')).toBeTruthy();
    expect(screen.getByText(/según el vendedor del documento/)).toBeTruthy();
    expect(screen.queryByText(/igual que la pestaña Seguimiento/)).toBeNull();
  });
});

describe('SellerProfile quota editing', () => {
  test('saves through the shared helper with the full row, updates the editor and refetches', async () => {
    render(<SellerProfile salesRepKey="7" dateRange="month:2026-10" currency="usd" onBack={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Editar meta (100USD)' }));
    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '150');
    const profileFetchesBefore = fetchMock.mock.calls.filter(c => String(c[0]).startsWith('/api/dwh/vendedor-360')).length;
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect(saveSpy.mock.calls[0][0]).toEqual({
      salesRepKey: '7', periodMonth: '2026-10',
      current: { salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: null },
      field: 'salesQuotaUsd', value: 150,
    });
    const post = fetchMock.mock.calls.find(c => (c[1] as RequestInit | undefined)?.method === 'POST')!;
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual({
      salesRepKey: '7', periodMonth: '2026-10', salesQuotaUsd: 150, weeklyVisitQuota: 2, newCustomerQuota: null,
    });
    await waitFor(() => expect(
      fetchMock.mock.calls.filter(c => String(c[0]).startsWith('/api/dwh/vendedor-360')).length,
    ).toBeGreaterThan(profileFetchesBefore));
  });

  test('a failed save keeps the editor open and does not refetch', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/admin/seller-targets' && init?.method === 'POST') return json({ error: 'x' }, false);
      if (url.startsWith('/api/admin/seller-targets')) return json({ salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: null });
      return json(profile);
    });
    render(<SellerProfile salesRepKey="7" dateRange="month:2026-10" currency="usd" onBack={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Editar meta (2)' }));
    await userEvent.clear(screen.getByRole('spinbutton'));
    await userEvent.type(screen.getByRole('spinbutton'), '3');
    const callsBefore = fetchMock.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('No se pudo guardar la meta')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore + 1); // only the POST
  });
});
