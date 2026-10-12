import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CoberturaResponse, CoberturaRowView } from '../../types';

const capture = mock<(event: string, props?: unknown) => void>(() => {});
mock.module('posthog-js', () => ({ default: { capture } }));
mock.module('../seguimiento/visuals', () => ({
  VisitBadge: ({ visit }: { visit: { status: string } }) => <span data-testid="visit-badge">{visit.status}</span>,
}));
const { default: CoberturaClientes } = await import('../cobertura-clientes');

const noVisit = { status: 'no_interval' as const, daysSinceLastInvoice: null, intervalDays: null, daysOverdue: null };
const base: CoberturaRowView = {
  customerCode: 'X', customerName: 'X', entityName: null, sellerCode: null, sellerName: null,
  lastSaleDateKey: null, entityLastSaleDateKey: null, daysSinceLastSale: null,
  avgMonthlyUsd: null, avgMonthlyUnits: null, monthsWithSales: 0, status: 'never',
  routeNumber: null, groupCode: null, groupName: null, kind: null, visit: noVisit, activeInPeriod: true,
};

// Server order: no data first (never, then via_matriz), then most days -> fewest.
const rows: CoberturaRowView[] = [
  { ...base, customerCode: 'C1', customerName: 'Nunca Vendido SA', entityName: 'NUNCA', sellerCode: 'V1', sellerName: 'Ana', status: 'never',
    routeNumber: 3, groupCode: 'S1', groupName: 'Abasto', kind: 'patrimonio', activeInPeriod: false,
    visit: { status: 'no_invoice', daysSinceLastInvoice: null, intervalDays: 7, daysOverdue: null } },
  { ...base, customerCode: 'C2', customerName: 'Tienda Via Matriz', entityName: 'CADENA', sellerCode: 'V2', sellerName: 'Bruno', entityLastSaleDateKey: 20260901, status: 'via_matriz',
    routeNumber: 4, groupCode: 'S2', groupName: 'Restaurante', kind: 'nuevo' },
  { ...base, customerCode: 'C3', customerName: 'Cliente Inactivo Reciente', entityName: 'REC', sellerCode: null, sellerName: null, lastSaleDateKey: 20260710, daysSinceLastSale: 86,
    avgMonthlyUsd: 883.87, avgMonthlyUnits: 181.8, monthsWithSales: 5, status: 'lapsed',
    routeNumber: 3, groupCode: 'S1', groupName: 'Abasto', kind: 'patrimonio', activeInPeriod: false,
    visit: { status: 'overdue', daysSinceLastInvoice: 86, intervalDays: 30, daysOverdue: 56 } },
  { ...base, customerCode: 'C4', customerName: 'Cliente Activo', entityName: 'ACT', sellerCode: 'V1', sellerName: 'Ana', lastSaleDateKey: 20261001, daysSinceLastSale: 3,
    avgMonthlyUsd: 100, avgMonthlyUnits: 10, monthsWithSales: 3, status: 'active',
    routeNumber: 4, groupCode: 'S2', groupName: 'Restaurante', kind: 'nuevo',
    visit: { status: 'ok', daysSinceLastInvoice: 3, intervalDays: 7, daysOverdue: 0 } },
];
const payload: CoberturaResponse = { rows, asOfDateKey: 20261004, windowStartDateKey: 20251101, lapsedAfterDays: 30, kindYear: 2026 };

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

describe('CoberturaClientes: cartera additions', () => {
  test('visit KPIs: overdue count with the sin-frecuencia subtitle and the compliance rate', async () => {
    await loaded();
    const section = within(screenSection());
    expect(section.getByText('Visitas vencidas').nextElementSibling!.textContent).toBe('1');
    expect(section.getByText('1 sin frecuencia')).toBeTruthy();                 // only C2 has no frequency; C1 has one but no invoice
    expect(section.getByText('Cumplimiento de visitas').nextElementSibling!.textContent).toBe('50%');
    // selector: the checkbox filter shares this label text.
    expect(section.getByText('Sin compras en el período', { selector: 'p' }).nextElementSibling!.textContent).toBe('2');
    expect(section.getByText('Clientes nuevos').nextElementSibling!.textContent).toBe('2');
    expect(section.getByText('2 patrimonio')).toBeTruthy();
  });

  test('the visit filter lists only overdue customers, most overdue first', async () => {
    const { user } = await loaded();
    await user.selectOptions(within(screenSection()).getByLabelText('Filtrar por visita'), 'overdue');
    const names = [...screenSection().querySelectorAll('tbody tr')].map(tr => tr.querySelector('td')!.textContent);
    expect(names).toHaveLength(1);
    expect(names[0]).toContain('Cliente Inactivo Reciente');
  });

  test('"Sin frecuencia" filter and the inactive-in-period checkbox narrow the table', async () => {
    const { user } = await loaded();
    await user.selectOptions(within(screenSection()).getByLabelText('Filtrar por visita'), 'no_interval');
    expect(screenSection().querySelectorAll('tbody tr')).toHaveLength(1);
    expect(screenSection().textContent).toContain('Tienda Via Matriz');
    await user.selectOptions(within(screenSection()).getByLabelText('Filtrar por visita'), '');
    await user.click(within(screenSection()).getByLabelText('Sin compras en el período'));
    const names = [...screenSection().querySelectorAll('tbody tr')].map(tr => tr.querySelector('td')!.textContent);
    expect(names.some(n => n!.includes('Nunca Vendido SA'))).toBe(true);
    expect(names.some(n => n!.includes('Cliente Activo'))).toBe(false);
  });

  test('grupo/ruta props scope both the table and the KPIs', async () => {
    render(<CoberturaClientes grupo="S1" ruta={null} />);
    await screen.findByRole('region', { name: 'Cobertura de clientes' });
    expect(screenSection().querySelectorAll('tbody tr')).toHaveLength(2);            // C1 and C3 are S1
    expect(within(screenSection()).getByText('de 2 clientes')).toBeTruthy();
  });

  test('ruta/grupo/tipo cells fall back to "Sin ruta" / "Sin grupo" / "—"', async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ ...payload, rows: [{ ...base, customerCode: 'Z', customerName: 'Zeta' }] }) }) as unknown as Response);
    await loaded();
    const row = screenSection().querySelector('tbody tr')!;
    expect(row.textContent).toContain('Sin ruta');
    expect(row.textContent).toContain('Sin grupo');
  });

  test('nobody has a frequency: the compliance rate reads "—", not 0%', async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ ...payload, rows: rows.map(r => ({ ...r, visit: noVisit })) }) }) as unknown as Response);
    await loaded();
    const section = within(screenSection());
    expect(section.getByText('Visitas vencidas').nextElementSibling!.textContent).toBe('0');
    expect(section.getByText('Cumplimiento de visitas').nextElementSibling!.textContent).toBe('—');
    expect(section.getByText('Sin frecuencia asignada')).toBeTruthy();
  });

  test('Visita sort: most overdue first, ties (no days overdue) broken by customer name', async () => {
    // Server order reversed so the tie-break cannot come from a stable sort of the input.
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ ...payload, rows: [...rows].reverse() }) }) as unknown as Response);
    const { user } = await loaded();
    await user.click(within(screenSection()).getByRole('button', { name: /Visita/ }));
    const names = [...screenSection().querySelectorAll('tbody tr')].map(tr => tr.querySelector('td')!.firstChild!.textContent);
    expect(names).toEqual(['Cliente Inactivo Reciente', 'Cliente Activo', 'Nunca Vendido SA', 'Tienda Via Matriz']);
  });

  test('dateRange is sent to the API and a change refetches', async () => {
    const { rerender } = render(<CoberturaClientes dateRange="month:2026-10" />);
    await screen.findByRole('region', { name: 'Cobertura de clientes' });
    expect(fetchMock.mock.calls[0][0]).toContain('dateRange=month%3A2026-10');
    rerender(<CoberturaClientes dateRange="month:2026-09" />);
    await waitFor(() => expect(fetchMock.mock.calls.some(c => String(c[0]).includes('month%3A2026-09'))).toBe(true));
  });
});
