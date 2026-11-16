import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GroupShareMatrix } from '@/lib/productos/group-share';

const { GroupShareMatrixTable } = await import('../productos/group-share-matrix');

afterEach(cleanup);

const matrix: GroupShareMatrix = {
  columns: [
    { code: 'A', name: 'Alfa', salesBs: 100, units: 900 },
    { code: 'B', name: 'Beta', salesBs: 900, units: 100 },
  ],
  rows: [{
    label: 'Pan', totalBs: 1000, totalUsd: 20, totalUnits: 1000,
    cells: {
      A: { salesBs: 100, salesUsd: 2, share: 0.1, units: 900, unitShare: 0.9 },
      B: { salesBs: 900, salesUsd: null, share: 0.9, units: 100, unitShare: 0.1 },
    },
  }],
};

function renderMatrix(over: Partial<React.ComponentProps<typeof GroupShareMatrixTable>> = {}) {
  const onToggle = mock(() => {});
  render(<GroupShareMatrixTable matrix={matrix} currency="usd" metric="ventas" rowHeader="Línea" open onToggle={onToggle} {...over} />);
  return onToggle;
}

describe('GroupShareMatrixTable', () => {
  test('ventas: net value, Sin datos for null USD, share muted', () => {
    renderMatrix();
    expect(screen.getByText('$2')).toBeTruthy();
    expect(screen.getByText('Sin datos')).toBeTruthy();
    expect(screen.getByText('10.0%')).toBeTruthy();
  });
  test('unidades: units and unit share, columns ordered by units desc', () => {
    renderMatrix({ metric: 'unidades' });
    expect(screen.getByText('900')).toBeTruthy();
    expect(screen.getByText('90.0%')).toBeTruthy();
    const heads = screen.getAllByRole('columnheader').map(h => h.textContent);
    expect(heads).toEqual(['Línea', 'Alfa', 'Beta', 'Total']);
  });
  test('ventas: columns ordered by sales desc', () => {
    renderMatrix();
    const heads = screen.getAllByRole('columnheader').map(h => h.textContent);
    expect(heads).toEqual(['Línea', 'Beta', 'Alfa', 'Total']);
  });
  test('shading proportional to share', () => {
    renderMatrix();
    const alpha = (text: string) => {
      const td = screen.getByText(text).closest('td')!;
      return Number(/rgba\([^)]*,\s*([\d.]+)\)/.exec(td.getAttribute('style') ?? '')?.[1]);
    };
    expect(alpha('10.0%')).toBeGreaterThan(0);
    expect(alpha('90.0%')).toBeGreaterThan(alpha('10.0%'));
  });
  test('collapse: aria-expanded, body hidden, callback fired', async () => {
    const onToggle = renderMatrix({ open: false });
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('table')).toBeNull();
    await userEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
  test('an empty matrix shows the empty state, no table', () => {
    renderMatrix({ matrix: { columns: [], rows: [] } });
    expect(screen.getByText('Sin datos disponibles todavía.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
  test('absent cell is a dash, bs currency formats Bs.', () => {
    const m = { ...matrix, rows: [{ ...matrix.rows[0], cells: { B: matrix.rows[0].cells.B } }] };
    renderMatrix({ matrix: m, currency: 'bs' });
    expect(screen.getAllByText('—').length).toBe(1);
    expect(screen.getAllByText(/^Bs\. 900$/).length).toBe(1);
  });
  test('open shows table', () => {
    renderMatrix();
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('table')).toBeTruthy();
  });
});
