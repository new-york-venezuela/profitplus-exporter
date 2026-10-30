import { screen } from '../../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import type { MonthlyTrendRow } from '../../../types';

const { SalesReturnsChart, buildChartRows } = await import('../sales-returns-chart');
afterEach(cleanup);

const rows: MonthlyTrendRow[] = [
  { bucket: '2026-08', salesGross: { bs: 1000, usd: 100 }, returnsNet: { bs: 40, usd: 4 }, salesNet: { bs: 960, usd: 96 } },
  { bucket: '2026-09', salesGross: { bs: 0, usd: 0 }, returnsNet: { bs: 0, usd: 0 }, salesNet: { bs: 0, usd: 0 } },
];

describe('SalesReturnsChart', () => {
  test('rate is null when gross is zero, never NaN', () => {
    const data = buildChartRows(rows, 'month', 'usd');
    expect(data[0].rate).toBeCloseTo(0.04);
    expect(data[1].rate).toBeNull();
    expect(data[0].net).toBe(96);
    expect(data[0].returns).toBe(4);
    expect(data[0].gross).toBe(100);
    expect(JSON.stringify(data)).not.toContain('NaN');
  });

  test('legend names the rate and a hatch pattern exists for returns', () => {
    const { container } = render(<SalesReturnsChart rows={rows} trendMode="month" currency="usd" />);
    expect(screen.getByText(/Tasa de devolución/)).toBeTruthy();
    expect(screen.getByText('Devoluciones')).toBeTruthy();
    expect(container.querySelector('pattern#returns-hatch')).toBeTruthy();
  });

  test('empty rows show the empty state', () => {
    render(<SalesReturnsChart rows={[]} trendMode="month" currency="usd" />);
    expect(screen.getByText('Sin datos disponibles todavía.')).toBeTruthy();
  });
});
