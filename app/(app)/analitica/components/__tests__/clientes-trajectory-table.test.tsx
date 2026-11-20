import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TrayectoriaRow } from '../../../../../lib/clientes/trayectoria';

mock.module('../../lib/clientes-export', () => ({ downloadCsv: () => {} }));
const { TrajectoryTable } = await import('../clientes/trajectory-table');
afterEach(cleanup);

const m = (bs: number, usd: number | null) => ({ bs, usd });
const r = (over: Partial<TrayectoriaRow>): TrayectoriaRow => ({
  key: 'e:1', filterKey: 'e:1', parentKey: null, kind: 'entidad', name: 'Gama', code: null, storeCount: 2,
  sales: m(1000, 100), salesPrev: m(800, 80), units: 50, unitsPrev: 40, orders: 10, lastOrderKey: 20261020, newStoresCount: 0, ...over,
});
const ROWS: TrayectoriaRow[] = [
  r({}),
  r({ key: 't:G1', filterKey: 't:G1', parentKey: 'e:1', kind: 'tienda', name: 'Gama Centro', code: 'G1', storeCount: 1, sales: m(600, 60) }),
  r({ key: 't:G2', filterKey: 't:G2', parentKey: 'e:1', kind: 'tienda', name: 'Gama Este', code: 'G2', storeCount: 1, sales: m(400, 40), newStoresCount: 1 }),
  r({ key: 'e:2', filterKey: 'e:2', name: 'Unica', storeCount: 1, sales: m(300, 30), salesPrev: m(300, 30) }),
  r({ key: 't:U1', filterKey: 't:U1', parentKey: 'e:2', kind: 'tienda', name: 'Unica Tienda', code: 'U1', storeCount: 1, sales: m(300, 30) }),
];
const ESTADOS = new Map([['G1', 'retenido' as const], ['G2', 'nuevo_periodo' as const], ['U1', 'enfriado' as const]]);
const base = { currency: 'usd' as const, selectedKey: null, onSelect: () => {}, estadoByCode: ESTADOS };

describe('TrajectoryTable', () => {
  test('chain row expands to its stores', async () => {
    render(<TrajectoryTable {...base} rows={ROWS} dim="entidad" />);
    expect(screen.queryByText('Gama Centro')).toBeNull();
    await userEvent.setup().click(screen.getAllByRole('button', { name: /Expandir/ })[0]);
    expect(screen.getByText('Gama Centro')).toBeTruthy();
    expect(screen.getByText('Gama Este')).toBeTruthy();
  });

  test('a one-store chain is not expandable', () => {
    render(<TrajectoryTable {...base} rows={ROWS} dim="entidad" />);
    expect(screen.getAllByRole('button', { name: /Expandir/ })).toHaveLength(1);
  });

  test('delta shows sin base when the previous period is missing', () => {
    render(<TrajectoryTable {...base} rows={[r({ salesPrev: null, storeCount: 1 })]} dim="entidad" />);
    expect(screen.getByText('sin base')).toBeTruthy();
  });

  test('delta is arrow and sign against the previous period', () => {
    render(<TrajectoryTable {...base} rows={[r({ storeCount: 1 })]} dim="entidad" />);
    expect(screen.getByText('▲ +25.0%')).toBeTruthy();
  });

  test('selecting a row reports its filterKey; selecting it again clears', async () => {
    const onSelect = mock<(k: string | null) => void>(() => {});
    const { rerender } = render(<TrajectoryTable {...base} rows={ROWS} dim="entidad" onSelect={onSelect} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Seleccionar Gama' }));
    expect(onSelect).toHaveBeenCalledWith('e:1');
    rerender(<TrajectoryTable {...base} rows={ROWS} dim="entidad" onSelect={onSelect} selectedKey="e:1" />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Seleccionar Gama' }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('button', { name: 'Seleccionar Gama' }).getAttribute('aria-pressed')).toBe('true');
  });

  test('the new-stores chip appears only when greater than zero', () => {
    render(<TrajectoryTable {...base} rows={[r({ newStoresCount: 2 }), r({ key: 'e:9', filterKey: 'e:9', name: 'Otra', newStoresCount: 0 })]} dim="entidad" />);
    expect(screen.getAllByText(/tiendas nuevas/)).toHaveLength(1);
  });

  test('dim tienda lists stores flat with their Estado', () => {
    render(<TrajectoryTable {...base} rows={ROWS} dim="tienda" />);
    expect(screen.queryByRole('button', { name: /Expandir/ })).toBeNull();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Gama Centro')).toBeTruthy();
    expect(within(table).queryByText('Unica')).toBeNull();
    expect(within(table).getByText('Enfriado')).toBeTruthy();
  });

  describe('with renderEvolution', () => {
    const renderEvolution = (r: TrayectoriaRow) => <span>evolución de {r.name}</span>;

    test('every row can be opened, including a one-store chain', () => {
      render(<TrajectoryTable {...base} rows={ROWS} dim="entidad" renderEvolution={renderEvolution} />);
      expect(screen.getAllByRole('button', { name: /Expandir/ })).toHaveLength(2);   // Gama and Unica
    });

    test('opening a chain shows its evolution and then its stores', async () => {
      render(<TrajectoryTable {...base} rows={ROWS} dim="entidad" renderEvolution={renderEvolution} />);
      await userEvent.setup().click(screen.getAllByRole('button', { name: /Expandir/ })[0]);
      expect(screen.getByText('evolución de Gama')).toBeTruthy();
      expect(screen.getByText('Gama Centro')).toBeTruthy();
    });

    test('opening a one-store chain shows only its evolution', async () => {
      render(<TrajectoryTable {...base} rows={ROWS} dim="entidad" renderEvolution={renderEvolution} />);
      await userEvent.setup().click(screen.getAllByRole('button', { name: /Expandir/ })[1]);
      expect(screen.getByText('evolución de Unica')).toBeTruthy();
      expect(screen.queryByText('Unica Tienda')).toBeNull();
    });

    test('in the tienda view each store opens its own evolution', async () => {
      render(<TrajectoryTable {...base} rows={ROWS} dim="tienda" renderEvolution={renderEvolution} />);
      await userEvent.setup().click(screen.getAllByRole('button', { name: /Expandir/ })[0]);
      expect(screen.getByText(/evolución de (Gama Centro|Gama Este|Unica Tienda)/)).toBeTruthy();
    });
  });
});
