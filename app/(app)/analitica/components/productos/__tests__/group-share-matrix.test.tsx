import { screen } from '../../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, within } from '@testing-library/react';
import { GroupShareMatrixTable } from '../group-share-matrix';
import type { GroupShareMatrix } from '@/lib/productos/group-share';

afterEach(cleanup);

const matrix: GroupShareMatrix = {
  columns: [
    { code: 'S1', name: 'Abasto', salesBs: 3500 },
    { code: 'S2', name: 'Restaurante', salesBs: 700 },
    { code: '__sin_grupo__', name: 'Sin grupo', salesBs: 300 },
  ],
  rows: [
    { label: 'Panaderia', totalBs: 4200, totalUsd: 84, cells: {
      S1: { salesBs: 3500, salesUsd: 70, share: 3500 / 4200 },
      S2: { salesBs: 400, salesUsd: 8, share: 400 / 4200 },
      __sin_grupo__: { salesBs: 300, salesUsd: null, share: 300 / 4200 },
    } },
    { label: 'Pizza', totalBs: 700, totalUsd: 14, cells: { S2: { salesBs: 700, salesUsd: 14, share: 1 } } },
  ],
};

describe('GroupShareMatrixTable', () => {
  test('renders the row header, one column per group and Total', () => {
    render(<GroupShareMatrixTable matrix={matrix} currency="bs" rowHeader="Línea" />);
    const table = screen.getByRole('table', { name: 'Participación por grupo de cliente' });
    const headers = within(table).getAllByRole('columnheader').map(h => h.textContent);
    expect(headers).toEqual(['Línea', 'Abasto', 'Restaurante', 'Sin grupo', 'Total']);
  });
  test('cells show whole-percent shares; an absent pair is "—", never 0%', () => {
    render(<GroupShareMatrixTable matrix={matrix} currency="bs" rowHeader="Línea" />);
    const rows = screen.getAllByRole('row').slice(1);
    const pizza = within(rows[1]).getAllByRole('cell').map(c => c.textContent);
    expect(pizza).toEqual(['Pizza', '—', '100%', '—', 'Bs. 700']);
    const pan = within(rows[0]).getAllByRole('cell').map(c => c.textContent);
    expect(pan.slice(0, 4)).toEqual(['Panaderia', '83%', '10%', '7%']);
  });
  test('the cell tooltip carries the amount in the selected currency; null USD reads "—"', () => {
    const { rerender } = render(<GroupShareMatrixTable matrix={matrix} currency="usd" rowHeader="Línea" />);
    expect(screen.getByTitle('$70')).toBeTruthy();
    expect(screen.getByTitle('—')).toBeTruthy();         // Sin grupo has no USD
    rerender(<GroupShareMatrixTable matrix={matrix} currency="bs" rowHeader="Línea" />);
    expect(screen.getByTitle(/^Bs\. 3\.?500$/)).toBeTruthy();       // es-VE may or may not group 4-digit numbers
  });
  test('an empty matrix shows the empty state, no table', () => {
    render(<GroupShareMatrixTable matrix={{ columns: [], rows: [] }} currency="bs" rowHeader="Línea" />);
    expect(screen.getByText('Sin datos disponibles todavía.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
