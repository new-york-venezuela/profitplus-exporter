import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const downloadCsv = mock<(name: string, records: unknown[]) => void>(() => {});
mock.module('../../lib/clientes-export', () => ({ downloadCsv }));

const { SegmentedControl } = await import('../clientes/segmented-control');
const { DataTable } = await import('../clientes/data-table');
const { DeltaBadge } = await import('../clientes/delta-badge');

afterEach(() => { cleanup(); downloadCsv.mockClear(); });

interface Row { id: string; name: string; sales: number | null }
const ROWS: Row[] = [
  { id: 'a', name: 'Alfa', sales: 10 },
  { id: 'b', name: 'Beta', sales: null },
  { id: 'c', name: 'Gama', sales: 30 },
];
const COLUMNS = [
  { key: 'name', label: 'Cliente', sortValue: (r: Row) => r.name, render: (r: Row) => r.name },
  { key: 'sales', label: 'Ventas', align: 'right' as const, sortValue: (r: Row) => r.sales, render: (r: Row) => String(r.sales ?? '—') },
];
const names = () => screen.getAllByRole('row').slice(1).map(tr => within(tr).getAllByRole('cell')[0]?.textContent ?? '');

describe('SegmentedControl', () => {
  test('marks the selected option aria-pressed and calls onChange', async () => {
    const onChange = mock<(v: string) => void>(() => {});
    render(<SegmentedControl ariaLabel="Tipo" value="a" options={[{ value: 'a', label: 'Uno' }, { value: 'b', label: 'Dos', count: 3 }]} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Uno' }).getAttribute('aria-pressed')).toBe('true');
    const dos = screen.getByRole('button', { name: /Dos/ });
    expect(dos.getAttribute('aria-pressed')).toBe('false');
    expect(dos.textContent).toContain('3');
    await userEvent.setup().click(dos);
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('DataTable', () => {
  const table = (extra: Record<string, unknown> = {}) => (
    <DataTable<Row> columns={COLUMNS} rows={ROWS} rowKey={r => r.id} emptyMessage="Sin filas" {...extra} />
  );

  test('sorts by header click and sets aria-sort', async () => {
    render(table());
    const header = screen.getByRole('columnheader', { name: /Ventas/ });
    expect(header.getAttribute('aria-sort')).toBe('none');
    await userEvent.setup().click(within(header).getByRole('button'));
    expect(header.getAttribute('aria-sort')).toBe('ascending');
    expect(names()).toEqual(['Alfa', 'Gama', 'Beta']);
  });

  test('puts null sort values last in both directions', async () => {
    render(table({ defaultSort: { key: 'sales', dir: 'desc' } }));
    expect(names()).toEqual(['Gama', 'Alfa', 'Beta']);
    await userEvent.setup().click(within(screen.getByRole('columnheader', { name: /Ventas/ })).getByRole('button'));
    expect(names()).toEqual(['Alfa', 'Gama', 'Beta']);
  });

  test('search filters rows', async () => {
    render(table({ searchText: (r: Row) => r.name }));
    await userEvent.setup().type(screen.getByRole('searchbox'), 'gam');
    expect(names()).toEqual(['Gama']);
  });

  test('shows emptyMessage when no rows', () => {
    render(<DataTable<Row> columns={COLUMNS} rows={[]} rowKey={r => r.id} emptyMessage="Sin filas" />);
    expect(screen.getByText('Sin filas')).toBeTruthy();
  });

  test('expand toggles renderExpanded', async () => {
    render(table({ isExpandable: (r: Row) => r.id === 'a', renderExpanded: () => <span>detalle-a</span> }));
    expect(screen.queryByText('detalle-a')).toBeNull();
    expect(screen.getAllByRole('button', { name: /Expandir/ })).toHaveLength(1);
    await userEvent.setup().click(screen.getByRole('button', { name: /Expandir/ }));
    expect(screen.getByText('detalle-a')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Contraer/ }).getAttribute('aria-expanded')).toBe('true');
  });

  test('export sends the visible rows to downloadCsv', async () => {
    render(table({ searchText: (r: Row) => r.name, exportFile: { name: 'x.csv', toRecord: (r: Row) => ({ cliente: r.name }) } }));
    await userEvent.setup().type(screen.getByRole('searchbox'), 'alf');
    await userEvent.setup().click(screen.getByRole('button', { name: /Exportar CSV/ }));
    expect(downloadCsv).toHaveBeenCalledWith('x.csv', [{ cliente: 'Alfa' }]);
  });
});

describe('DeltaBadge', () => {
  test('shows arrow and sign', () => {
    const { container } = render(<DeltaBadge current={110} previous={100} />);
    expect(container.textContent).toBe('▲ +10.0%');
    cleanup();
    const down = render(<DeltaBadge current={50} previous={100} />);
    expect(down.container.textContent).toBe('▼ −50.0%');
  });
  test('shows sin base for null or zero previous (never 0%)', () => {
    for (const [c, p] of [[10, null], [null, 10], [10, 0]] as const) {
      const { container, unmount } = render(<DeltaBadge current={c} previous={p} />);
      expect(container.textContent).toBe('sin base');
      unmount();
    }
  });
});
