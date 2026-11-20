import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClientesTrendRow } from '../../types';

const { ActivityTrendChart } = await import('../clientes/activity-trend-chart');

afterEach(cleanup);

const ROWS: ClientesTrendRow[] = [
  { bucketKey: '2026-W41', label: 'S41', activeCustomers: 8, churnRate: 0.2 },
  { bucketKey: '2026-W42', label: 'S42', activeCustomers: 12, churnRate: null },
];
const base = { granularity: 'week' as const, loading: false, error: null, onRetry: () => {} };

describe('ActivityTrendChart', () => {
  test('Ver tabla shows the values (null churn as a dash)', async () => {
    render(<ActivityTrendChart {...base} rows={ROWS} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver tabla' }));
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('S41')).toBeTruthy();
    expect(screen.getByText('20.0%')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
  });

  test('a single bucket renders text, not a chart', () => {
    render(<ActivityTrendChart {...base} rows={[{ bucketKey: 'range', label: 'Total del período', activeCustomers: 42, churnRate: null }]} />);
    expect(screen.getByText(/Total del período/)).toBeTruthy();
    expect(screen.getByText(/42 clientes activos/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver tabla' })).toBeNull();
  });

  test('error shows a retry button that calls onRetry', async () => {
    const onRetry = mock(() => {});
    render(<ActivityTrendChart {...base} rows={[]} error="No se pudo conectar" onRetry={onRetry} />);
    expect(screen.getByText('No se pudo conectar')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('empty data without error says there is no data', () => {
    render(<ActivityTrendChart {...base} rows={[]} />);
    expect(screen.getByText(/Sin datos/)).toBeTruthy();
  });

  test('previous data stays visible (dimmed) while loading', () => {
    render(<ActivityTrendChart {...base} rows={ROWS} loading />);
    expect(screen.getByRole('button', { name: 'Ver tabla' })).toBeTruthy();
    expect(screen.getByTestId('trend-body').className).toContain('opacity-60');
  });
});
