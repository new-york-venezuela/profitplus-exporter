import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GrupoRow } from '../../../../../lib/clientes/grupos';

mock.module('../../lib/clientes-export', () => ({ downloadCsv: () => {} }));
const { GroupTable } = await import('../clientes/group-table');
afterEach(cleanup);

const m = (bs: number, usd: number | null) => ({ bs, usd });
const g = (over: Partial<GrupoRow>): GrupoRow => ({
  key: 'S1', name: 'Abasto', sales: m(400, 40), salesPrev: m(300, 30), shareOfTotal: 0.4, activos: 10, activosPrev: 12,
  nuevos: 2, patrimonio: 8, churnRate: 0.25, ...over,
});
const ROWS: GrupoRow[] = [
  g({}),
  g({ key: 'S2', name: 'Restaurante', sales: m(600, 60), salesPrev: m(700, 70), shareOfTotal: 0.6, activos: 5, churnRate: 0 }),
  g({ key: '', name: 'Sin grupo', sales: m(0, 0), salesPrev: m(0, 0), shareOfTotal: 0, activos: 0, activosPrev: 0, churnRate: null }),
];
const base = { currency: 'usd' as const, by: 'grupo' as const, selectedKey: null, onSelect: () => {} };
const names = () => screen.getAllByRole('row').slice(1).map(tr => within(tr).getAllByRole('cell')[0].textContent ?? '');

describe('GroupTable', () => {
  test('rows are ranked by the change in sales, biggest gain first', () => {
    render(<GroupTable {...base} rows={ROWS} />);
    expect(names()[0]).toContain('Abasto');       // +10 vs -10
    expect(names()[1]).toContain('Sin grupo');    // 0 (no base to compare is not a loss)
    expect(names()[2]).toContain('Restaurante');
  });

  test('the share bar has accessible text, not only colour', () => {
    render(<GroupTable {...base} rows={ROWS} />);
    expect(screen.getByRole('meter', { name: 'Participación de Abasto' }).getAttribute('aria-valuenow')).toBe('40');
    expect(screen.getByText('40.0%')).toBeTruthy();
  });

  test('selecting a row reports its key; the selected row is pressed and clicking it clears', async () => {
    const onSelect = mock<(k: string | null) => void>(() => {});
    const { rerender } = render(<GroupTable {...base} rows={ROWS} onSelect={onSelect} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Seleccionar Abasto' }));
    expect(onSelect).toHaveBeenCalledWith('S1');
    rerender(<GroupTable {...base} rows={ROWS} onSelect={onSelect} selectedKey="S1" />);
    expect(screen.getByRole('button', { name: 'Seleccionar Abasto' }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Seleccionar Abasto' }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  test('the row without a code cannot be selected as a filter', () => {
    render(<GroupTable {...base} rows={ROWS} />);
    expect(screen.queryByRole('button', { name: 'Seleccionar Sin grupo' })).toBeNull();
    expect(screen.getByText('Sin grupo')).toBeTruthy();
  });

  test('delta shows sin base without a previous period and churn shows a dash', () => {
    render(<GroupTable {...base} rows={[g({ salesPrev: null, activosPrev: null, churnRate: null })]} />);
    expect(screen.getByText('sin base')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  test('empty rows show the message', () => {
    render(<GroupTable {...base} rows={[]} />);
    expect(screen.getByText('Ningún grupo con clientes en este alcance.')).toBeTruthy();
  });
});
