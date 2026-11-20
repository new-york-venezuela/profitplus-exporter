import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClientesTrendGrupoResponse } from '../../../../../lib/clientes/grupo-trend';

const { GroupTrendChart } = await import('../clientes/group-trend-chart');
afterEach(cleanup);

const data: ClientesTrendGrupoResponse = {
  granularity: 'month', trendMode: 'month',
  series: [{ code: 'S2', name: 'Restaurante' }, { code: 'S1', name: 'Abasto' }],
  rows: [
    { bucketKey: '2026-09', label: 'Sep 26', sales: { S2: { bs: 500, usd: 50 }, S1: { bs: 100, usd: 10 } } },
    { bucketKey: '2026-10', label: 'Oct 26', sales: { S2: { bs: 400, usd: 40 }, S1: { bs: 200, usd: null } } },
  ],
};
const base = { currency: 'usd' as const, loading: false, error: null, onRetry: () => {} };

describe('GroupTrendChart', () => {
  test('Ver tabla lists every series and bucket; an unknown USD is a dash, never 0', async () => {
    render(<GroupTrendChart {...base} data={data} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver tabla' }));
    const table = screen.getByRole('table');
    expect(within(table).getByText('Restaurante')).toBeTruthy();
    expect(within(table).getByText('Abasto')).toBeTruthy();
    expect(within(table).getByText('$50')).toBeTruthy();
    expect(within(table).getAllByText('—')).toHaveLength(1);
  });

  test('the table follows the currency toggle', async () => {
    render(<GroupTrendChart {...base} currency="bs" data={data} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver tabla' }));
    expect(within(screen.getByRole('table')).getByText('Bs. 500')).toBeTruthy();
  });

  test('error shows retry; empty shows no data; loading keeps the previous data dimmed', async () => {
    const onRetry = mock(() => {});
    const { rerender } = render(<GroupTrendChart {...base} data={null} error="Falló" onRetry={onRetry} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    rerender(<GroupTrendChart {...base} data={{ ...data, rows: [], series: [] }} />);
    expect(screen.getByText('Sin datos disponibles todavía.')).toBeTruthy();
    rerender(<GroupTrendChart {...base} data={data} loading />);
    expect(screen.getByTestId('grupo-trend-body').className).toContain('opacity-60');
  });
});
