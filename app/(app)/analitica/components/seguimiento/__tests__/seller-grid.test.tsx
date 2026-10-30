import { screen } from '../../../../../../test/dom-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fixtureResponse } from '../../../../../../__tests__/unit/seguimiento/fixture';
import type { SeguimientoRoot } from '../../../../../../lib/seguimiento/types';
import { STATUS_STYLES } from '../../../../../../lib/seguimiento/grid-status';
import { SellerGrid } from '../seller-grid';

afterEach(cleanup);

const vendedor = fixtureResponse('vendedor');
const ana = vendedor.roots.find(r => r.value === '1')!;

// Luis: 62% of the goal at the projection, 1,960 of 3,200 units.
const luis: SeguimientoRoot = {
  ...ana,
  value: '7', label: 'Luis Gómez', salesRepKey: '7', routeLabels: ['Ruta 7'],
  sales: { bs: 500000, usd: 10000 }, projected: { bs: 775000, usd: 15500 }, salesQuotaUsd: 25000,
  units: 1960, unitsQuota: 3200, projectedUnits: 2800, returnUnits: 40, netUnits: 1920,
  returns: { bs: 10000, usd: 200 }, net: { bs: 490000, usd: 9800 }, returnRate: 0.02,
  avgPrice: { bs: 255, usd: 5.1 },
  newCustomers: { count: 0, quota: 3, partial: false },
};
const noGoal: SeguimientoRoot = {
  ...ana,
  value: '8', label: 'Sin Meta Pérez', salesRepKey: '8', routeLabels: [],
  salesQuotaUsd: null, unitsQuota: null, attainment: null, projectedAttainment: null,
  newCustomers: { count: 1, quota: null, partial: false },
};

const rowOf = (name: string) => screen.getByRole('button', { name: new RegExp(name) }).closest('tr')!;

describe('SellerGrid', () => {
  test('a seller projected at 62% of the goal shows "Bajo meta" with its icon, not colour alone', () => {
    render(<SellerGrid roots={[luis]} total={vendedor.total} kind="vendedor" currency="usd" selected={null} onSelect={() => {}} />);
    const status = within(rowOf('Luis Gómez')).getAllByTestId('grid-status')[0];
    expect(status.textContent).toContain('✕');
    expect(status.textContent).toContain('Bajo meta');
    // light and dark colours both come from STATUS_STYLES through CSS variables
    const style = status.getAttribute('style') ?? '';
    expect(style).toContain(STATUS_STYLES.bad.light.fg);
    expect(style).toContain(STATUS_STYLES.bad.dark.bg);
  });

  test('a seller with no goal shows "Sin meta", never "Bajo meta" or 0%', () => {
    render(<SellerGrid roots={[noGoal]} total={vendedor.total} kind="vendedor" currency="usd" selected={null} onSelect={() => {}} />);
    const row = rowOf('Sin Meta Pérez');
    expect(within(row).getAllByText('Sin meta').length).toBeGreaterThan(0);
    expect(within(row).queryByText(/Bajo meta/)).toBeNull();
    expect(row.textContent).not.toContain('/ 0');
    for (const s of within(row).getAllByTestId('grid-status')) {
      expect(s.textContent).toContain('Sin meta');
      expect(s.getAttribute('style') ?? '').not.toContain(STATUS_STYLES.bad.light.bg);
    }
  });

  test('units are absolute, sold / goal', () => {
    render(<SellerGrid roots={[luis]} total={vendedor.total} kind="vendedor" currency="usd" selected={null} onSelect={() => {}} />);
    // es-VE grouping (same as every other unit figure in Analítica): 1,960 / 3,200
    expect(within(rowOf('Luis Gómez')).getByText('1.960 / 3.200')).toBeTruthy();
  });

  test('every column of the brief is there; brutas, devoluciones (with rate) and netas all show', () => {
    render(<SellerGrid roots={[luis]} total={vendedor.total} kind="vendedor" currency="usd" selected={null} onSelect={() => {}} />);
    for (const name of ['Vendedor', 'Brutas', 'Devoluciones', 'Netas', 'Unidades', 'Clientes activos', 'Nuevos', 'Precio prom.', 'Proyección']) {
      expect(screen.getByRole('columnheader', { name })).toBeTruthy();
    }
    const row = rowOf('Luis Gómez');
    expect(within(row).getByText('Ruta 7')).toBeTruthy();
    expect(within(row).getByText('$10,000')).toBeTruthy();
    expect(within(row).getByText('$200')).toBeTruthy();
    expect(within(row).getByText('2.0%')).toBeTruthy();
    expect(within(row).getByText('$9,800')).toBeTruthy();
    expect(within(row).getByText('$15,500')).toBeTruthy();
    expect(within(row).getByText('$5.10')).toBeTruthy();
    expect(within(row).getByText('0 / 3')).toBeTruthy();
    // current week (S42) active customers of the assigned ones
    expect(within(row).getByText('1 / 2')).toBeTruthy();
  });

  test('a null USD amount renders a dash, never $0', () => {
    const noRate: SeguimientoRoot = { ...luis, sales: { bs: 500000, usd: null }, net: { bs: 490000, usd: null }, projected: { bs: 775000, usd: null } };
    render(<SellerGrid roots={[noRate]} total={vendedor.total} kind="vendedor" currency="usd" selected={null} onSelect={() => {}} />);
    const row = rowOf('Luis Gómez');
    expect(row.textContent).not.toContain('$0');
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0);
  });

  test('route rows carry no goal and no status', () => {
    const ruta = fixtureResponse('ruta');
    render(<SellerGrid roots={ruta.roots} total={ruta.total} kind="ruta" currency="usd" selected={null} onSelect={() => {}} />);
    expect(screen.getByRole('columnheader', { name: 'Ruta' })).toBeTruthy();
    for (const label of ['Ruta 3', 'Ruta 4']) {
      const row = rowOf(label);
      expect(within(row).queryByTestId('grid-status')).toBeNull();
      expect(within(row).queryByText(/Bajo meta|En meta|Cerca/)).toBeNull();
    }
    expect(screen.getByText(/Las metas se definen por vendedor/)).toBeTruthy();
  });

  test('clicking a row selects that root; the selected row is marked', async () => {
    const onSelect = mock<(v: string) => void>(() => {});
    const { rerender } = render(<SellerGrid roots={vendedor.roots} total={vendedor.total} kind="vendedor" currency="usd" selected={null} onSelect={onSelect} />);
    await userEvent.click(within(rowOf('Beto')).getByText('Ruta 4'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('2');
    rerender(<SellerGrid roots={vendedor.roots} total={vendedor.total} kind="vendedor" currency="usd" selected="2" onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: /Beto/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Ana/ }).getAttribute('aria-pressed')).toBe('false');
  });

  test('the Total row compares the sum of the sellers\' goals and is not selectable', () => {
    render(<SellerGrid roots={vendedor.roots} total={vendedor.total} kind="vendedor" currency="usd" selected={null} onSelect={() => {}} />);
    const total = screen.getByRole('rowheader', { name: 'Total' }).closest('tr')!;
    expect(within(total).queryByRole('button')).toBeNull();
    expect(within(total).getAllByTestId('grid-status').length).toBeGreaterThan(0);
  });
});
