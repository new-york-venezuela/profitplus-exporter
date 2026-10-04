import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntidadTreeTable, { type TreeChildRequest } from '../entidad-tree-table';
import type { DrilldownColumn } from '../grouped-drilldown-table';
import type { VentasRow } from '../../types';

afterEach(cleanup);

const row = (label: string, value: string, units: number): VentasRow & { label: string; value: string } => ({
  label,
  value,
  salesGross: { bs: units * 10, usd: units },
  returns: { bs: 0, usd: 0 },
  salesNet: { bs: units * 10, usd: units },
  returnRate: null,
  avgDiscount: null,
  units,
});

const columns: DrilldownColumn<VentasRow & { label: string; value: string }>[] = [
  { key: 'units', label: 'Unidades', align: 'right', format: r => `${r.units} u` },
];

const entidades = [row('FARMATODO CA', '2', 100), row('PLAZA S C.A', '5', 40)];

function setup(fetchChildren: (req: TreeChildRequest) => Promise<VentasRow[]>) {
  render(<EntidadTreeTable rows={entidades} columns={columns} fetchChildren={fetchChildren} />);
  return userEvent.setup();
}

describe('EntidadTreeTable', () => {
  test('renders every Entidad with the shared columns and an always-present expander', () => {
    setup(async () => []);
    expect(screen.getByText('FARMATODO CA')).toBeTruthy();
    expect(screen.getByText('100 u')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Ver tiendas' })).toHaveLength(2);
  });

  test('expanding an Entidad fetches its tiendas once and re-expanding uses the cache', async () => {
    const fetchChildren = mock(async (req: TreeChildRequest) =>
      req.level === 'tienda' ? [row('FARMATODO (Melia)', 'T-1', 60), row('FARMATODO (Plaza)', 'T-2', 40)] : [],
    );
    const user = setup(fetchChildren);

    await user.click(screen.getAllByRole('button', { name: 'Ver tiendas' })[0]);
    expect(await screen.findByText('FARMATODO (Melia)')).toBeTruthy();
    expect(fetchChildren).toHaveBeenCalledTimes(1);
    expect(fetchChildren.mock.calls[0][0]).toEqual({ level: 'tienda', entityKey: '2' });
    // Children use the same column formatter as the parent rows.
    expect(screen.getByText('60 u')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Ocultar tiendas' }));
    expect(screen.queryByText('FARMATODO (Melia)')).toBeNull();
    await user.click(screen.getAllByRole('button', { name: 'Ver tiendas' })[0]);
    expect(await screen.findByText('FARMATODO (Melia)')).toBeTruthy();
    expect(fetchChildren).toHaveBeenCalledTimes(1);
  });

  test('a tienda expands to its productos with the entity key and store code', async () => {
    const fetchChildren = mock(async (req: TreeChildRequest) =>
      req.level === 'tienda' ? [row('Tienda Melia', 'T-1', 60)] : [row('Pan integral 600gr', '77', 25)],
    );
    const user = setup(fetchChildren);

    await user.click(screen.getAllByRole('button', { name: 'Ver tiendas' })[0]);
    await user.click(await screen.findByRole('button', { name: 'Ver productos' }));
    expect(await screen.findByText('Pan integral 600gr')).toBeTruthy();
    expect(screen.getByText('25 u')).toBeTruthy();
    expect(fetchChildren.mock.calls[1][0]).toEqual({ level: 'producto', entityKey: '2', storeCode: 'T-1' });
  });

  test('shows a loading line, then an empty message when there are no tiendas', async () => {
    let resolve!: (rows: VentasRow[]) => void;
    const user = setup(() => new Promise<VentasRow[]>(r => { resolve = r; }));
    await user.click(screen.getAllByRole('button', { name: 'Ver tiendas' })[0]);
    expect(screen.getByText('Cargando tiendas…')).toBeTruthy();
    resolve([]);
    expect(await screen.findByText('Sin tiendas con ventas en el período.')).toBeTruthy();
  });

  test('a failed fetch shows an error with a retry that recovers', async () => {
    let calls = 0;
    const fetchChildren = mock(async () => {
      calls += 1;
      if (calls === 1) throw new Error('boom');
      return [row('Tienda recuperada', 'T-9', 10)];
    });
    const user = setup(fetchChildren);

    await user.click(screen.getAllByRole('button', { name: 'Ver tiendas' })[0]);
    expect(await screen.findByText(/No se pudo cargar el desglose/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByText('Tienda recuperada')).toBeTruthy());
    expect(fetchChildren).toHaveBeenCalledTimes(2);
  });

  test('no rows shows the empty state', () => {
    render(<EntidadTreeTable rows={[]} columns={columns} fetchChildren={async () => []} />);
    expect(screen.getByText('Sin datos disponibles todavía.')).toBeTruthy();
  });
});
