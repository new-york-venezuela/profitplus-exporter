import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UnitsByLineaResponse } from '../../types';

const { default: TrendCard } = await import('../productos/trend-card');
afterEach(cleanup);

const data: UnitsByLineaResponse = {
  nivel: 'linea', trendMode: 'month', lineas: ['Pan', 'Otras'], seriesMeta: {},
  rows: [
    { bucket: '2026-09', units: { Pan: 10, Otras: 2 }, salesGross: { Pan: { bs: 100, usd: 10 }, Otras: { bs: 20, usd: 2 } }, totalSalesGross: { bs: 120, usd: 12 } },
    { bucket: '2026-10', units: { Pan: 20, Otras: 4 }, salesGross: { Pan: { bs: 200, usd: 20 }, Otras: { bs: 40, usd: 4 } }, totalSalesGross: { bs: 240, usd: 24 } },
  ],
} as unknown as UnitsByLineaResponse;
const base = { nivel: 'linea' as const, currency: 'usd' as const, onSeriesClick: () => {} };

describe('Productos TrendCard', () => {
  test('title names the bucket unit and the series level', () => {
    render(<TrendCard {...base} data={data} loading={false} error={null} />);
    expect(screen.getByRole('heading', { name: /Unidades vendidas por mes, por línea/ })).toBeTruthy();
  });
  test('the scale toggle is aria-pressed and switches to 100 %', async () => {
    render(<TrendCard {...base} data={data} loading={false} error={null} />);
    expect(screen.getByRole('button', { name: 'Absoluto' }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.setup().click(screen.getByRole('button', { name: '100 %' }));
    expect(screen.getByRole('button', { name: '100 %' }).getAttribute('aria-pressed')).toBe('true');
  });
  test('loading, error and empty states', () => {
    const { rerender } = render(<TrendCard {...base} data={null} loading error={null} />);
    expect(screen.getByText('Cargando…')).toBeTruthy();
    rerender(<TrendCard {...base} data={null} loading={false} error="Falló" />);
    expect(screen.getByText('Falló')).toBeTruthy();
    rerender(<TrendCard {...base} data={{ ...data, rows: [] }} loading={false} error={null} />);
    expect(screen.getByText('Sin datos disponibles todavía.')).toBeTruthy();
  });
});
