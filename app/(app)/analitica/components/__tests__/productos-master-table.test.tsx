import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogoRow } from '../../types';

const { default: MasterTable, RETURN_RATE_WARN, RETURN_RATE_ALERT } = await import('../productos/master-table');
const { default: ParetoBadge } = await import('../productos/pareto-badge');

afterEach(cleanup);

function row(over: Partial<CatalogoRow>): CatalogoRow {
  return {
    key: 'K', label: 'K', code: null, linea: 'Panaderia', sublinea: '',
    salesGross: { bs: 1000, usd: 20 }, returns: { bs: 0, usd: 0 }, salesNet: { bs: 1000, usd: 20 },
    units: 100, monthCount: 1, avgUnitsPerMonth: 100, avgPrice: { bs: 10, usd: 0.2 },
    returnRate: 0, clientCount: 1, posCount: 1, sharePct: 0.5, pareto: 'A', prevNet: null, trendPct: null,
    ...over,
  };
}

// Net high / units low vs net low / units high, so the two default sorts differ.
const ROWS: CatalogoRow[] = [
  row({ key: 'Pizza', label: 'Pizza', salesNet: { bs: 200, usd: 4 }, salesGross: { bs: 200, usd: 4 }, units: 900, pareto: 'B' }),
  row({ key: 'Panaderia', label: 'Panaderia', salesNet: { bs: 800, usd: 16 }, units: 50, pareto: 'A' }),
  row({ key: 'Pasteleria', label: 'Pasteleria', salesNet: { bs: 500, usd: 10 }, units: 300, pareto: 'C' }),
];

type Props = Parameters<typeof MasterTable>[0];
function renderTable(over: Partial<Props> = {}) {
  return render(
    <MasterTable rows={ROWS} currency="bs" metric="ventas" nivel="linea" loading={false} error={null} {...over} />,
  );
}

function bodyLabels(): string[] {
  const table = screen.getByRole('table', { name: 'Catálogo de productos' });
  return within(table).getAllByRole('row').slice(1).map(r => within(r).getAllByRole('cell')[0].querySelector('[data-label]')!.textContent!);
}

describe('MasterTable', () => {
  test('exports the return-rate thresholds', () => {
    expect(RETURN_RATE_WARN).toBe(0.04);
    expect(RETURN_RATE_ALERT).toBe(0.08);
  });

  test('renders the columns in the specified order', () => {
    renderTable();
    const headers = screen.getAllByRole('columnheader').map(h => h.textContent!.replace(/[▲▼↕]/g, '').trim());
    expect(headers).toEqual([
      'Línea', 'Pareto', 'Ventas netas', 'Ventas brutas', 'Tasa dev.', 'Unidades', 'Unid./mes', 'Precio prom.', 'Alcance',
    ]);
  });

  test('identity header follows the nivel', () => {
    renderTable({ nivel: 'sku' });
    expect(screen.getAllByRole('columnheader')[0].textContent).toContain('SKU');
  });

  test('default sort with metric=ventas is net descending', () => {
    renderTable();
    expect(bodyLabels()).toEqual(['Panaderia', 'Pasteleria', 'Pizza']);
    expect(screen.getByRole('columnheader', { name: /Ventas netas/ }).getAttribute('aria-sort')).toBe('descending');
  });

  test('default sort with metric=unidades is units descending', () => {
    renderTable({ metric: 'unidades' });
    expect(bodyLabels()).toEqual(['Pizza', 'Pasteleria', 'Panaderia']);
    expect(screen.getByRole('columnheader', { name: /^Unidades/ }).getAttribute('aria-sort')).toBe('descending');
  });

  test('clicking a header toggles between descending and ascending', async () => {
    renderTable();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Ventas netas/ }));
    expect(bodyLabels()).toEqual(['Pizza', 'Pasteleria', 'Panaderia']);
    expect(screen.getByRole('columnheader', { name: /Ventas netas/ }).getAttribute('aria-sort')).toBe('ascending');
    await user.click(screen.getByRole('button', { name: /Ventas netas/ }));
    expect(bodyLabels()).toEqual(['Panaderia', 'Pasteleria', 'Pizza']);
    await user.click(screen.getByRole('button', { name: /^Unidades/ }));
    expect(bodyLabels()).toEqual(['Pizza', 'Pasteleria', 'Panaderia']);
    expect(screen.getByRole('columnheader', { name: /Ventas netas/ }).getAttribute('aria-sort')).toBe('none');
  });

  test('null values sort last in both directions', async () => {
    renderTable({
      currency: 'usd',
      rows: [
        row({ key: 'N', label: 'Nulo', salesNet: { bs: 9999, usd: null }, pareto: null }),
        row({ key: 'A', label: 'Alto', salesNet: { bs: 1, usd: 50 } }),
        row({ key: 'B', label: 'Bajo', salesNet: { bs: 1, usd: 5 } }),
      ],
    });
    expect(bodyLabels()).toEqual(['Alto', 'Bajo', 'Nulo']);
    await userEvent.setup().click(screen.getByRole('button', { name: /Ventas netas/ }));
    expect(bodyLabels()).toEqual(['Bajo', 'Alto', 'Nulo']);
  });

  test('Pareto badge shows A/B/C and "—" for null', () => {
    renderTable({ rows: [...ROWS, row({ key: 'X', label: 'Sin clase', pareto: null })] });
    for (const c of ['A', 'B', 'C']) expect(screen.getByTitle(`Clase Pareto ${c}`).textContent).toBe(c);
    const nullRow = screen.getByText('Sin clase').closest('tr')!;
    expect(within(nullRow).getAllByRole('cell')[1].textContent).toBe('—');
  });

  test('return-rate cell: neutral at exactly 4%, amber above 4%, red above 8%, "—" when null', () => {
    renderTable({
      rows: [
        row({ key: 'n', label: 'n', returnRate: 0.04 }),
        row({ key: 'w', label: 'w', returnRate: 0.05 }),
        row({ key: 'a', label: 'a', returnRate: 0.09 }),
        row({ key: 'x', label: 'x', returnRate: null }),
      ],
    });
    const rateCell = (label: string) => within(screen.getByText(label, { selector: '[data-label]' }).closest('tr')!).getAllByRole('cell')[4];
    expect(rateCell('n').querySelector('[data-tone]')!.getAttribute('data-tone')).toBe('neutral');
    expect(rateCell('n').textContent).toContain('4.0%');
    expect(rateCell('w').querySelector('[data-tone]')!.getAttribute('data-tone')).toBe('warn');
    expect(rateCell('w').querySelector('[data-tone]')!.className).toContain('amber');
    expect(rateCell('a').querySelector('[data-tone]')!.getAttribute('data-tone')).toBe('alert');
    expect(rateCell('a').querySelector('[data-tone]')!.className).toContain('red');
    expect(rateCell('x').textContent).toBe('—');
  });

  test('null USD net renders "Sin datos", never $0', () => {
    renderTable({ currency: 'usd', rows: [row({ key: 'N', label: 'Nulo', salesNet: { bs: 100, usd: null }, salesGross: { bs: 100, usd: null }, sharePct: null, pareto: null })] });
    const cells = within(screen.getByText('Nulo').closest('tr')!).getAllByRole('cell');
    expect(cells[2].textContent).toContain('Sin datos');
    expect(cells[2].textContent).not.toContain('$0');
    expect(cells[3].textContent).toContain('Sin datos');
  });

  test('net shows the share of total; gross shows returns in red', () => {
    renderTable({ rows: [row({ key: 'P', label: 'P', salesGross: { bs: 1000, usd: 20 }, returns: { bs: 80, usd: 2 }, salesNet: { bs: 920, usd: 18 }, sharePct: 0.25 })] });
    const cells = within(screen.getByText('P', { selector: '[data-label]' }).closest('tr')!).getAllByRole('cell');
    expect(cells[2].textContent).toContain('25.0% del total');
    const ret = cells[3].querySelector('[data-returns]')!;
    expect(ret.textContent).toContain('80');
    expect(ret.className).toContain('text-red');
  });

  test('Línea › Sublínea pills and the code only at nivel=sku', () => {
    const sku = row({ key: 'A1', label: 'Pan Baguette', code: 'A1', linea: 'Panaderia', sublinea: 'Artesanal' });
    renderTable({ nivel: 'sku', rows: [sku] });
    expect(screen.getByTitle('Panaderia › Artesanal')).toBeTruthy();
    expect(screen.getByText('A1')).toBeTruthy();
    cleanup();
    renderTable({ nivel: 'linea', rows: [{ ...sku, code: null }] });
    expect(screen.queryByTitle('Panaderia › Artesanal')).toBeNull();
    cleanup();
    renderTable({ nivel: 'sublinea', rows: [{ ...sku, code: null }] });
    expect(screen.queryByTitle('Panaderia › Artesanal')).toBeNull();
  });

  test('reach reads "X clientes · Y tiendas"', () => {
    renderTable({ rows: [row({ clientCount: 3, posCount: 12 })] });
    expect(screen.getByText('3 clientes · 12 tiendas')).toBeTruthy();
  });

  test('empty state', () => {
    renderTable({ rows: [] });
    expect(screen.getByText('Sin productos para los filtros seleccionados.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  test('error state', () => {
    renderTable({ error: 'Error al consultar el Data Warehouse' });
    expect(screen.getByRole('alert').textContent).toContain('Error al consultar el Data Warehouse');
    expect(screen.queryByRole('table')).toBeNull();
  });

  test('loading state', () => {
    renderTable({ loading: true, rows: [] });
    expect(screen.getByText('Cargando…')).toBeTruthy();
  });
});

describe('ParetoBadge', () => {
  test('renders the class or a dash', () => {
    render(<ParetoBadge value="B" />);
    expect(screen.getByTitle('Clase Pareto B').textContent).toBe('B');
    cleanup();
    const { container } = render(<ParetoBadge value={null} />);
    expect(container.textContent).toBe('—');
  });

  test('average price with zero units is "Sin datos", never a zero price', () => {
    renderTable({ rows: [row({ key: 'Z', label: 'Z', units: 0, avgPrice: { bs: 0, usd: 0 } })] });
    const cells = within(screen.getByRole('table', { name: 'Catálogo de productos' })).getAllByRole('row')[1].querySelectorAll('td');
    expect(cells[7].textContent).toBe('Sin datos');
  });
});
