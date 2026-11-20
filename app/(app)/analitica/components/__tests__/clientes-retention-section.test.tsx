import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildBridge } from '../../../../../lib/clientes/estado';
import type { EstadoRow, EstadosResult } from '../../../../../lib/clientes/estados';

mock.module('../../lib/clientes-export', () => ({ downloadCsv: () => {} }));
const { RetentionSection } = await import('../clientes/retention-section');
afterEach(cleanup);

const m = (bs: number, usd: number | null) => ({ bs, usd });
const row = (over: Partial<EstadoRow>): EstadoRow => ({
  customerCode: 'X', customerName: 'X', entityName: null, sellerName: 'Ana', routeNumber: null, groupName: null,
  origen: 'patrimonio', estado: 'retenido', lastSaleDateKey: 20260920, reasonDateKey: null, salesPeriod: m(0, 0), salesPrev: m(0, 0), ...over,
});
const ROWS: EstadoRow[] = [
  row({ customerCode: 'R1', customerName: 'Retenido Pat', estado: 'retenido', salesPeriod: m(200, 20), salesPrev: m(100, 10) }),
  row({ customerCode: 'R2', customerName: 'Retenido Nuevo', estado: 'retenido', origen: 'nuevo', salesPeriod: m(50, 5), salesPrev: m(60, 6) }),
  row({ customerCode: 'C1', customerName: 'Enfriado Pat', estado: 'enfriado', reasonDateKey: 20260920, salesPrev: m(40, 4) }),
  row({ customerCode: 'L1', customerName: 'Perdido Nuevo', estado: 'perdido', origen: 'nuevo', reasonDateKey: 20260915, salesPrev: m(30, 3) }),
  row({ customerCode: 'N1', customerName: 'Nuevo Periodo', estado: 'nuevo_periodo', origen: 'nuevo', reasonDateKey: 20261005, salesPeriod: m(70, 7) }),
  row({ customerCode: 'B1', customerName: 'Recuperado Pat', estado: 'recuperado', salesPeriod: m(90, 9) }),
];
const data = (rows: EstadoRow[] = ROWS, available = true): EstadosResult => ({ available, referenceYear: 2026, rows, bridge: buildBridge(rows.map(r => r.estado)) });
const base = { currency: 'usd' as const, origen: 'todos' as const, onOrigen: () => {} };
const listNames = () => {
  const region = screen.getByRole('region', { name: 'Clientes por estado' });
  return within(region).queryAllByRole('row').slice(1).map(tr => within(tr).getAllByRole('cell')[0]?.textContent ?? '');
};

describe('RetentionSection', () => {
  test('the customer bridge reconciles base and actual', () => {
    render(<RetentionSection {...base} data={data()} />);
    const items = within(screen.getByRole('list', { name: 'Puente de clientes' })).getAllByRole('listitem').map(li => li.textContent);
    expect(items).toEqual(['Base anterior4', 'Enfriados−1', 'Perdidos−1', 'Nuevos+1', 'Recuperados+1', 'Base actual4']);
  });

  test('the sales bridge uses the active currency and reconciles', () => {
    render(<RetentionSection {...base} data={data()} />);
    const items = within(screen.getByRole('list', { name: 'Puente de ventas' })).getAllByRole('listitem').map(li => li.textContent);
    expect(items[0]).toBe('Período anterior$23');
    expect(items[items.length - 1]).toBe('Período actual$41');
  });

  test('the list starts on the accionables (enfriados and perdidos) and a count button filters it to that estado', async () => {
    render(<RetentionSection {...base} data={data()} />);
    expect(listNames().join('|')).toContain('Enfriado Pat');
    expect(listNames().join('|')).toContain('Perdido Nuevo');
    expect(listNames().join('|')).not.toContain('Retenido Pat');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retenido Total' }));
    expect(listNames().join('|')).toContain('Retenido Pat');
    expect(listNames().join('|')).not.toContain('Enfriado Pat');
  });

  test('origen splits each count and a split button also sets the origen', async () => {
    const onOrigen = mock<(o: string) => void>(() => {});
    render(<RetentionSection {...base} data={data()} onOrigen={onOrigen} />);
    const row = screen.getByRole('row', { name: /^Retenido/ });
    expect(within(row).getAllByRole('button').map(b => b.textContent)).toEqual(['1', '1', '2']);
    await userEvent.setup().click(within(row).getByRole('button', { name: 'Retenido Nuevo' }));
    expect(onOrigen).toHaveBeenCalledWith('nuevo');
  });

  test('the origen prop narrows every figure and the list', () => {
    render(<RetentionSection {...base} origen="nuevo" data={data()} />);
    expect(listNames().join('|')).toContain('Perdido Nuevo');
    expect(listNames().join('|')).not.toContain('Enfriado Pat');
    expect(within(screen.getByRole('list', { name: 'Puente de clientes' })).getAllByRole('listitem')[0].textContent).toBe('Base anterior2');
  });

  test('without a previous period it says so and shows no bridge or zeros', () => {
    render(<RetentionSection {...base} data={data([ROWS[4]], false)} />);
    expect(screen.getByText('Sin período anterior comparable')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Puente de clientes' })).toBeNull();
  });

  test('the definition lists all six estados and both origenes', async () => {
    render(<RetentionSection {...base} data={data()} />);
    const def = screen.getByText('¿Cómo se define?').closest('details') as HTMLElement;
    for (const label of ['Nuevo en el período', 'Retenido', 'Recuperado', 'Enfriado', 'Perdido', 'Sin ventas aún', 'Patrimonio', 'Nuevo']) {
      expect(within(def).getAllByText(new RegExp(label)).length).toBeGreaterThan(0);
    }
  });
});
