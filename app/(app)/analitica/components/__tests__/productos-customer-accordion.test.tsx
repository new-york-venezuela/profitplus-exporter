import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClienteRow, ProductoClientesResponse } from '../../types';

const { default: CustomerAccordion } = await import('../productos/customer-accordion');

import { OVERDUE_FACTOR, OVERDUE_LOOKBACK_MONTHS, OVERDUE_MIN_ORDERS } from '@/lib/productos/customer-breakdown';

afterEach(cleanup);

function cli(over: Partial<ClienteRow>): ClienteRow {
  return {
    id: 'C', name: 'Cliente', group: { code: 'G1', name: 'Autoservicio' }, posItem: 2, posTotal: 5,
    net: { bs: 1000, usd: 20 }, sharePct: 0.25, units: 40, avgPrice: { bs: 25, usd: 0.5 },
    returnRate: 0.01, returnWarn: false, highReturn: false, orders: 6,
    lastOrderDate: '2026-11-01', daysSinceLastOrder: 15, avgGapDays: 7, overdue: false,
    ...over,
  };
}

function data(rows: ClienteRow[], over: Partial<ProductoClientesResponse> = {}): ProductoClientesResponse {
  return { nivel: 'sku', key: 'X', itemNet: { bs: 4000, usd: 80 }, itemReturnRate: 0.02, top3SharePct: 0.62, rows, ...over };
}

const ROWS = [
  cli({ id: 'A', name: 'Alfa' }),
  cli({ id: 'B', name: 'Beta', highReturn: true, returnRate: 0.09, returnWarn: true }),
  cli({ id: 'C', name: 'Gama', overdue: true, daysSinceLastOrder: 40 }),
  cli({ id: 'D', name: 'Delta', overdue: null, lastOrderDate: null, daysSinceLastOrder: null, avgGapDays: null }),
];

function show(rows = ROWS, over: Partial<ProductoClientesResponse> = {}, currency: 'bs' | 'usd' = 'bs') {
  return render(<CustomerAccordion state={{ status: 'ready', data: data(rows, over) }} currency={currency} />);
}

const names = () => screen.queryAllByTestId('cliente-row').map(r => r.querySelector('[data-name]')!.textContent);

describe('CustomerAccordion', () => {
  test('shows loading and error states', () => {
    const { unmount } = render(<CustomerAccordion state={{ status: 'loading' }} currency="bs" />);
    expect(screen.getByText('Cargando clientes…')).toBeTruthy();
    unmount();
    render(<CustomerAccordion state={{ status: 'error', error: 'Boom' }} currency="bs" />);
    expect(screen.getByRole('alert').textContent).toContain('Boom');
  });

  test('callout with top-3 share, hidden when null', () => {
    const { unmount } = show();
    expect(screen.getByText(/Los 3 principales clientes concentran 62\.0% de las ventas netas de este ítem/)).toBeTruthy();
    unmount();
    show(ROWS, { top3SharePct: null });
    expect(screen.queryByText(/principales clientes concentran/)).toBeNull();
  });

  test('legend defines Vencido from the exported constants', () => {
    show();
    const legend = screen.getByTestId('overdue-legend').textContent!;
    expect(legend).toContain(`más de ${OVERDUE_FACTOR} veces el intervalo promedio`);
    expect(legend).toContain(`últimos ${OVERDUE_LOOKBACK_MONTHS} meses, mínimo ${OVERDUE_MIN_ORDERS} pedidos`);
    expect(legend).toContain(`Sin historial = menos de ${OVERDUE_MIN_ORDERS} pedidos`);
  });

  test('pills carry counts and filter rows', async () => {
    show();
    expect(names()).toEqual(['Alfa', 'Beta', 'Gama', 'Delta']);
    await userEvent.click(screen.getByRole('button', { name: /Alta devolución \(>4 %\) \(1\)/ }));
    expect(names()).toEqual(['Beta']);
    await userEvent.click(screen.getByRole('button', { name: /Vencido \/ en riesgo \(1\)/ }));
    expect(names()).toEqual(['Gama']);
    await userEvent.click(screen.getByRole('button', { name: /Todos \(4\)/ }));
    expect(names()).toHaveLength(4);
  });

  test('empty filter shows a message', async () => {
    show([cli({ id: 'A', name: 'Alfa' })]);
    await userEvent.click(screen.getByRole('button', { name: /Vencido \/ en riesgo \(0\)/ }));
    expect(screen.getByText('Ningún cliente coincide con este filtro.')).toBeTruthy();
  });

  test('POS as X / Y and group badge', () => {
    show();
    const r = screen.getAllByTestId('cliente-row')[0];
    expect(r.textContent).toContain('2 / 5');
    expect(r.textContent).toContain('Autoservicio');
  });

  test('overdue states: Sin historial, Vencido with days and date', () => {
    show();
    const rows = screen.getAllByTestId('cliente-row');
    expect(rows[3].textContent).toContain('Sin historial');
    expect(rows[2].textContent).toContain('Vencido');
    expect(rows[2].textContent).toContain('Hace 40 días');
    expect(rows[0].textContent).not.toContain('Vencido');
    expect(rows[0].textContent).toContain('2026-11-01');
  });

  test('return warning marker has an accessible label', () => {
    show();
    const rows = screen.getAllByTestId('cliente-row');
    expect(within(rows[1]).getByRole('img', { name: 'Devolución más de 2 veces el promedio del ítem' })).toBeTruthy();
    expect(within(rows[0]).queryByRole('img')).toBeNull();
  });

  test('null USD renders Sin datos, never $0', () => {
    show([cli({ net: { bs: 100, usd: null }, avgPrice: { bs: 5, usd: null } })], {}, 'usd');
    const r = screen.getByTestId('cliente-row');
    expect(r.textContent).toContain('Sin datos');
    expect(r.textContent).not.toContain('$0');
  });

  test('negative net and share render signed as is', () => {
    show([cli({ net: { bs: -50, usd: -1 }, sharePct: -0.012 })]);
    expect(screen.getByTestId('cliente-row').textContent).toContain('−1.2%');
  });
});
