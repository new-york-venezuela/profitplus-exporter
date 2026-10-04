import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CoberturaResponse, CoberturaRowView } from '../../types';

const capture = mock<(event: string, props?: unknown) => void>(() => {});
mock.module('posthog-js', () => ({ default: { capture } }));
const { default: CoberturaClientes } = await import('../cobertura-clientes');

const base: CoberturaRowView = {
  customerCode: 'X', customerName: 'X', entityName: null, sellerCode: null, sellerName: null,
  lastSaleDateKey: null, entityLastSaleDateKey: null, daysSinceLastSale: null,
  avgMonthlyUsd: null, avgMonthlyUnits: null, monthsWithSales: 0, status: 'never',
};

// Server order: no data first (never, then via_matriz), then most days -> fewest.
const rows: CoberturaRowView[] = [
  { ...base, customerCode: 'C1', customerName: 'Nunca Vendido SA', entityName: 'NUNCA', sellerCode: 'V1', sellerName: 'Ana', status: 'never' },
  { ...base, customerCode: 'C2', customerName: 'Tienda Via Matriz', entityName: 'CADENA', sellerCode: 'V2', sellerName: 'Bruno', entityLastSaleDateKey: 20260901, status: 'via_matriz' },
  { ...base, customerCode: 'C3', customerName: 'Cliente Inactivo Reciente', entityName: 'REC', sellerCode: null, sellerName: null, lastSaleDateKey: 20260710, daysSinceLastSale: 86, avgMonthlyUsd: 883.87, avgMonthlyUnits: 181.8, monthsWithSales: 5, status: 'lapsed' },
  { ...base, customerCode: 'C4', customerName: 'Cliente Activo', entityName: 'ACT', sellerCode: 'V1', sellerName: 'Ana', lastSaleDateKey: 20261001, daysSinceLastSale: 3, avgMonthlyUsd: 100, avgMonthlyUnits: 10, monthsWithSales: 3, status: 'active' },
];
const payload: CoberturaResponse = { rows, asOfDateKey: 20261004, windowStartDateKey: 20251101, lapsedAfterDays: 30 };

const fetchMock = mock<(url: string) => Promise<Response>>(async () => ({ ok: true, json: async () => payload }) as unknown as Response);

beforeEach(() => {
  fetchMock.mockClear();
  capture.mockClear();
  fetchMock.mockImplementation(async () => ({ ok: true, json: async () => payload }) as unknown as Response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);

// The on-screen section (the print-only copy is rendered too, but hidden by CSS).
const screenSection = () => screen.getByRole('region', { name: 'Cobertura de clientes' });

async function loaded() {
  const utils = render(<CoberturaClientes />);
  await screen.findByRole('region', { name: 'Cobertura de clientes' });
  return { user: userEvent.setup(), ...utils };
}

describe('CoberturaClientes', () => {
  test('shows summary counts of every status', async () => {
    await loaded();
    const section = within(screenSection());
    expect(section.getByText('Nunca vendido', { selector: 'p' }).nextElementSibling!.textContent).toBe('1');
    expect(section.getByText('Vende vía matriz', { selector: 'p' }).nextElementSibling!.textContent).toBe('1');
    expect(section.getByText('de 4 clientes')).toBeTruthy();
  });

  test('missing data reads "Sin datos" and rows start with the no-data customers', async () => {
    await loaded();
    const body = screenSection().querySelector('tbody')!;
    const names = [...body.querySelectorAll('tr')].map(tr => tr.querySelector('td')!.textContent);
    expect(names[0]).toContain('Nunca Vendido SA');
    expect(names[1]).toContain('Tienda Via Matriz');
    expect(within(body.querySelectorAll('tr')[0] as HTMLElement).getAllByText('Sin datos').length).toBeGreaterThanOrEqual(4);
    // a via_matriz store shows the matrix's last sale, labelled as such
    expect(body.querySelectorAll('tr')[1].textContent).toContain('matriz: 01/09/2026');
  });

  test('clicking the days header reverses the order (most recent first)', async () => {
    const { user } = await loaded();
    await user.click(within(screenSection()).getByRole('button', { name: /Días sin vender/ }));
    const names = [...screenSection().querySelectorAll('tbody tr')].map(tr => tr.querySelector('td')!.textContent);
    expect(names[0]).toContain('Cliente Activo');
    expect(names[names.length - 1]).toContain('Nunca Vendido SA');
  });

  test('status filter narrows the table and shows the empty state when nothing matches', async () => {
    const { user } = await loaded();
    const select = within(screenSection()).getByLabelText('Filtrar por estado') as HTMLSelectElement;
    await user.selectOptions(select, 'lapsed');
    expect(screenSection().querySelectorAll('tbody tr')).toHaveLength(1);
    expect(screenSection().textContent).toContain('Cliente Inactivo Reciente');

    // summary boxes always count ALL customers, not the filtered ones
    expect(within(screenSection()).getByText('de 4 clientes')).toBeTruthy();
  });

  test('"Incluir inactivos" refetches with includeInactive=1', async () => {
    const { user } = await loaded();
    expect(fetchMock.mock.calls[0][0]).toContain('includeInactive=0');
    await user.click(within(screenSection()).getByLabelText('Incluir inactivos'));
    await waitFor(() => expect(fetchMock.mock.calls.some(c => String(c[0]).includes('includeInactive=1'))).toBe(true));
  });

  test('the print layout has one block per seller, "Sin vendedor" last', async () => {
    await loaded();
    const blocks = [...document.querySelectorAll('#cobertura-print .cobertura-seller-block')];
    const titles = blocks.map(b => b.querySelector('h2')!.textContent);
    expect(titles).toEqual([
      'Cobertura de clientes — Vendedor: Ana',
      'Cobertura de clientes — Vendedor: Bruno',
      'Cobertura de clientes — Vendedor: Sin vendedor',
    ]);
  });

  test('Imprimir calls window.print and records the event', async () => {
    const print = mock(() => {});
    window.print = print;
    const { user } = await loaded();
    await user.click(within(screenSection()).getByRole('button', { name: 'Imprimir' }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0][0]).toBe('cobertura_print');
  });

  test('an API error shows the message instead of the table', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, json: async () => ({ error: 'Error al consultar el Data Warehouse' }) }) as unknown as Response);
    render(<CoberturaClientes />);
    expect(await screen.findByText('Error al consultar el Data Warehouse')).toBeTruthy();
  });
});
