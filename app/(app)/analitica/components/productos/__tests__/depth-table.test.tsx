import { screen } from '../../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, within } from '@testing-library/react';
import { DepthTable } from '../depth-table';
import type { ProfundidadLineaRow } from '../../../types';

afterEach(cleanup);

const row = (over: Partial<ProfundidadLineaRow>): ProfundidadLineaRow => ({
  sku: 'Pan Baguette', clientCount: 8, clientShare: 0.8, storeCount: 9, storeShare: 0.75,
  avgMonthlyPrice: { bs: 50, usd: 1 }, avgMonthlyUnits: 100, returnRate: 0.01, tier: 'primera', ...over,
});

describe('DepthTable', () => {
  test('shows presence, tier badge and rates per product', () => {
    render(<DepthTable currency="usd" rows={[row({}), row({ sku: 'Rara', tier: 'addon', clientShare: 0.1, clientCount: 1, returnRate: null })]} />);
    const rows = within(screen.getByRole('table', { name: 'Presencia por producto' })).getAllByRole('row').slice(1);
    const first = within(rows[0]).getAllByRole('cell').map(c => c.textContent);
    expect(first[0]).toBe('Pan Baguette');
    expect(first[1]).toContain('8');
    expect(first[1]).toContain('80.0%');
    expect(first[3]).toBe('Primera línea');
    expect(first[4]).toBe('$1');
    const second = within(rows[1]).getAllByRole('cell').map(c => c.textContent);
    expect(second[3]).toBe('Addon');
    expect(second[6]).toBe('—');                                 // null return rate
  });
  test('sin-ventas and segunda labels', () => {
    render(<DepthTable currency="bs" rows={[row({ tier: 'segunda' }), row({ sku: 'X', tier: 'sin-ventas' })]} />);
    expect(screen.getByText('Segunda línea')).toBeTruthy();
    expect(screen.getByText('Sin ventas')).toBeTruthy();
  });
  test('hideTier (a tienda filter is active) replaces the tier badge with a dash', () => {
    render(<DepthTable currency="usd" hideTier rows={[row({})]} />);
    const cells = within(within(screen.getByRole('table', { name: 'Presencia por producto' })).getAllByRole('row')[1]).getAllByRole('cell');
    expect(cells[3].textContent).toBe('—');
    expect(screen.queryByText('Primera línea')).toBeNull();
  });
  test('no rows renders the empty state', () => {
    render(<DepthTable currency="bs" rows={[]} />);
    expect(screen.getByText('Sin datos disponibles todavía.')).toBeTruthy();
  });
});
