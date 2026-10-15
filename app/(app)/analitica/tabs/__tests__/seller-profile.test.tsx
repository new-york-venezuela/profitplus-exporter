import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Seller360Response } from '../../types';
import { fixtureResponse } from '../../../../../__tests__/unit/seguimiento/fixture';

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
  salesRepKey: '1',
  salesRepName: 'Ana',
  activacion: { weeks: [], entityGrain: 'entity', weeklyVisitQuota: 2 },
  cuota: { salesGross: { bs: 5000, usd: 100 }, quotaUsd: 100, isPartial: false },
  cobranza: {
    buckets: [{ bucket: 'Current', amount: { bs: 600, usd: 12 } }, { bucket: '31-60', amount: { bs: 400, usd: 8 } }],
    baselineBuckets: [],
  },
  nuevosClientes: { rows: [], quota: null, isPartial: false, possiblyIncludesPreExistingCustomers: false, factSalesMinDate: null },
  clientesRecuperados: { rows: [] },
  devoluciones: { byProduct: [], byTienda: [] },
  profundidad: { coverage: null },
  usdRate: 50,
};

const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body }) as unknown as Response;
const defaultFetch = async (url: string, init?: RequestInit): Promise<Response> => {
  if (url === '/api/admin/seller-targets' && init?.method === 'POST') return json({ ok: true });
  if (url.startsWith('/api/admin/seller-targets')) return json({ salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: 1 });
  if (url.startsWith('/api/dwh/seguimiento')) return json(fixtureResponse('vendedor'));
  return json(profile);
};
const fetchMock = mock(defaultFetch);
const calls = (prefix: string) => fetchMock.mock.calls.filter(c => String(c[0]).startsWith(prefix));

beforeEach(() => {
  fetchMock.mockClear();
  fetchMock.mockImplementation(defaultFetch);
  saveSpy.mockClear();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);

const renderProfile = (key = '1') => render(<SellerProfile salesRepKey={key} dateRange="month:2026-10" currency="usd" onBack={() => {}} />);
const card = (label: string) => screen.getByText(label).parentElement!;

describe('SellerProfile scorecard', () => {
  test('shows the Seguimiento figures for the seller with a status chip per card', async () => {
    renderProfile();
    await screen.findByRole('heading', { level: 1, name: 'Ana' });
    expect(within(card('Ventas del mes')).getByText('$70')).toBeTruthy();       // same as the Seguimiento root sales
    expect(within(card('Ventas del mes')).getByText('70.0% de la meta')).toBeTruthy();
    expect(within(card('Proyección al cierre')).getByText('154.0% de la meta')).toBeTruthy();
    expect(within(card('Unidades vendidas')).getByText('35')).toBeTruthy();
    expect(within(card('Proyección de unidades')).getByText('77')).toBeTruthy();   // 35 units x 22 / 10 working days
    expect(within(card('Clientes activos (semana actual)')).getByText('1 de 2')).toBeTruthy();
    expect(within(card('Nuevos clientes')).getByText('1 / 1')).toBeTruthy();
    expect(within(card('Cobranza vencida')).getByText('40.0%')).toBeTruthy();    // (400 of 1000) outside the Current bucket
    expect(calls('/api/dwh/seguimiento')[0][0]).toContain('kind=vendedor');
  });

  test('"Con consignación" appears only for a seller whose chains bill at the root', async () => {
    renderProfile('1');
    await screen.findByRole('heading', { level: 1, name: 'Ana' });
    expect(screen.queryByText(/Con consignación/)).toBeNull();
    cleanup();
    renderProfile('2');
    await screen.findByRole('heading', { level: 1, name: 'Beto' });
    expect(within(card('Ventas del mes')).getByText(/Con consignación: \$188/)).toBeTruthy();
  });

  test('"Qué mirar" lists the rule-based findings', async () => {
    renderProfile();
    expect(await screen.findByText(/Va camino a cumplir la meta: proyección al 154% \(ventas al 70%\)/)).toBeTruthy();
  });

  test('a seller with no customers or sales this month gets an empty state, not an error', async () => {
    renderProfile('99');
    expect(await screen.findByText(/no tiene clientes asignados ni ventas/)).toBeTruthy();
    expect(screen.queryByText('Ventas del mes')).toBeNull();
  });

  test('a failing detail request keeps the scorecard and flags the missing cobranza', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url.startsWith('/api/dwh/vendedor-360') ? json({ error: 'boom' }, false) : defaultFetch(url, init));
    renderProfile();
    await screen.findByRole('heading', { level: 1, name: 'Ana' });
    expect(within(card('Ventas del mes')).getByText('$70')).toBeTruthy();
    expect(await screen.findByText(/No se pudo cargar cobranza, devoluciones y cobertura: boom/)).toBeTruthy();
    expect(within(card('Cobranza vencida')).getByText('No disponible')).toBeTruthy();
  });

  test('detail sections are collapsed except activation and customers, and open on click', async () => {
    renderProfile();
    await screen.findByRole('heading', { level: 1, name: 'Ana' });
    const mix = screen.getByRole('button', { name: /Mix por línea/ });
    expect(mix.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: /Activación semanal/ }).getAttribute('aria-expanded')).toBe('true');
    await userEvent.click(mix);
    expect(mix.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('SellerProfile quota editing', () => {
  test('one "Editar metas" panel saves through the shared helper with the full row and refetches Seguimiento without cache', async () => {
    renderProfile();
    await userEvent.click(await screen.findByRole('button', { name: 'Editar metas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Editar meta (100USD)' }));
    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '150');
    const before = calls('/api/dwh/seguimiento').length;
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect(saveSpy.mock.calls[0][0]).toEqual({
      salesRepKey: '1', periodMonth: '2026-10',
      current: { salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: 1 },
      field: 'salesQuotaUsd', value: 150,
    });
    await waitFor(() => expect(calls('/api/dwh/seguimiento').length).toBeGreaterThan(before));
    const refetch = calls('/api/dwh/seguimiento').at(-1)!;
    expect((refetch[1] as RequestInit | undefined)?.cache).toBe('no-store');
  });

  test('a failed save keeps the editor open and does not refetch', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url === '/api/admin/seller-targets' && init?.method === 'POST' ? json({ error: 'x' }, false) : defaultFetch(url, init));
    renderProfile();
    await userEvent.click(await screen.findByRole('button', { name: 'Editar metas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Editar meta (2)' }));
    await userEvent.clear(screen.getByRole('spinbutton'));
    await userEvent.type(screen.getByRole('spinbutton'), '3');
    const callsBefore = fetchMock.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('No se pudo guardar la meta')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore + 1); // only the POST
  });
});
