import { screen } from '../../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, within } from '@testing-library/react';
import { fixtureResponse } from '../../../../../../__tests__/unit/seguimiento/fixture';
import type { SeguimientoRoot, WeekCell } from '../../../../../../lib/seguimiento/types';
import { WeeklyMatrix } from '../weekly-matrix';

afterEach(cleanup);

const data = fixtureResponse('vendedor');
const ana = data.roots.find(r => r.value === '1')!;

const cell = (yearWeek: string, o: Partial<WeekCell>): WeekCell => {
  const sales = o.sales ?? { bs: 0, usd: 0 };
  return {
    yearWeek, active: 0, assigned: 2, pct: 0,
    sales, units: 0, returns: { bs: 0, usd: 0 }, returnUnits: 0, net: sales, avgPrice: null, ...o,
  };
};
// W40..W42 elapsed, W43/W44 in the future (fixture asOf 2026-10-14).
const weeks: WeekCell[] = [
  cell('2026-W40', { active: 1, pct: 0.5, sales: { bs: 1000, usd: 20 }, units: 10, avgPrice: { bs: 100, usd: 2 } }),
  cell('2026-W41', {
    active: 2, pct: 1, sales: { bs: 1500, usd: 30 }, units: 12, returns: { bs: 100, usd: 2 }, returnUnits: 1,
    net: { bs: 1400, usd: 28 }, avgPrice: { bs: 125, usd: 2.5 },
  }),
  cell('2026-W42', { active: 1, pct: 0.5, sales: { bs: 1000, usd: 20 }, units: 13, avgPrice: { bs: 76.9, usd: 1.54 } }),
  cell('2026-W43', { pct: null }),
  cell('2026-W44', { pct: null }),
];
const root: SeguimientoRoot = { ...ana, weeks };

const rowCells = (name: string) => {
  const row = within(screen.getByRole('table', { name: /semana/i })).getByRole('rowheader', { name }).closest('tr')!;
  return within(row).getAllByRole('cell').map(c => c.textContent ?? '');
};

describe('WeeklyMatrix', () => {
  test('columns Sem 1..5 + Total and every row of the brief', () => {
    render(<WeeklyMatrix root={root} headers={data.weeks} currency="usd" />);
    const table = screen.getByRole('table', { name: /semana/i });
    for (const name of ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Total']) {
      expect(within(table).getByRole('columnheader', { name })).toBeTruthy();
    }
    for (const name of [
      'Clientes asignados', 'Clientes activos', '% activos', 'Brutas USD', 'Brutas unidades',
      'Devoluciones USD', 'Devoluciones unidades', 'Netas USD', 'Netas unidades', 'Precio promedio',
    ]) {
      expect(within(table).getByRole('rowheader', { name })).toBeTruthy();
    }
  });

  test('future weeks are blank, not 0', () => {
    render(<WeeklyMatrix root={root} headers={data.weeks} currency="usd" />);
    for (const name of ['Clientes activos', 'Brutas USD', 'Netas unidades', '% activos']) {
      const cells = rowCells(name);
      expect(cells[3]).toBe('');
      expect(cells[4]).toBe('');
    }
  });

  test('the Total of brutas USD is the sum of the week columns', () => {
    render(<WeeklyMatrix root={root} headers={data.weeks} currency="usd" />);
    expect(rowCells('Brutas USD')).toEqual(['$20', '$30', '$20', '', '', '$70']);
    expect(rowCells('Brutas unidades')[5]).toBe('35');
    expect(rowCells('Devoluciones USD')[5]).toBe('$2');
    expect(rowCells('Netas USD')).toEqual(['$20', '$28', '$20', '', '', '$68']);
    expect(rowCells('Netas unidades')[5]).toBe('34');
  });

  test('a week without units shows a dash as average price, never $0', () => {
    const noUnits = { ...root, weeks: weeks.map((w, i) => (i === 0 ? { ...w, units: 0, sales: { bs: 0, usd: 0 }, avgPrice: null } : w)) };
    render(<WeeklyMatrix root={noUnits} headers={data.weeks} currency="usd" />);
    expect(rowCells('Precio promedio')[0]).toBe('—');
    expect(rowCells('Precio promedio')[1]).toBe('$2.50');
  });

  test('a week with no USD rate shows a dash, not $0', () => {
    const noRate = { ...root, weeks: weeks.map((w, i) => (i === 0 ? { ...w, sales: { bs: 1000, usd: null }, net: { bs: 1000, usd: null } } : w)) };
    render(<WeeklyMatrix root={noRate} headers={data.weeks} currency="usd" />);
    expect(rowCells('Brutas USD')[0]).toBe('—');
  });

  test('assigned and active customers per week, with the month total', () => {
    render(<WeeklyMatrix root={root} headers={data.weeks} currency="usd" />);
    expect(rowCells('Clientes asignados')).toEqual(['2', '2', '2', '', '', '2']);
    expect(rowCells('Clientes activos').slice(0, 3)).toEqual(['1', '2', '1']);
    expect(rowCells('% activos').slice(0, 3)).toEqual(['50.0%', '100.0%', '50.0%']);
    // Ana's customers: C1 active in W41 and W42, C2 in W41 -> 2 distinct of 2
    expect(rowCells('Clientes activos')[5]).toBe('2');
    expect(rowCells('% activos')[5]).toBe('100.0%');
  });

  test('the month total of active customers counts the same group as the assigned ones: never above 100%', () => {
    // A customer listed because it had sales (e.g. inactive) is not assigned: the Total uses activeCustomers,
    // which counts assigned customers only, not the customer list.
    const extra = { ...root.customers[0], customerCode: 'C9', customerName: 'Inactivo con ventas', activeWeeks: ['2026-W41'] };
    const withExtra: SeguimientoRoot = { ...root, customers: [...root.customers, extra], customerCount: 2, activeCustomers: 1 };
    render(<WeeklyMatrix root={withExtra} headers={data.weeks} currency="usd" />);
    expect(rowCells('Clientes activos')[5]).toBe('1');
    expect(rowCells('% activos')[5]).toBe('50.0%');
  });

  test('a response without activeCustomers (cached before it existed) shows a dash, never NaN', () => {
    const old = { ...root } as Partial<SeguimientoRoot>;
    delete old.activeCustomers;
    render(<WeeklyMatrix root={old as SeguimientoRoot} headers={data.weeks} currency="usd" />);
    expect(rowCells('Clientes activos')[5]).toBe('—');
    expect(rowCells('% activos')[5]).toBe('—');
  });

  test('Estimado: a goal with no projected USD reads "Sin datos", not "Sin meta"', () => {
    render(<WeeklyMatrix root={{ ...root, projected: { bs: 7700, usd: null } }} headers={data.weeks} currency="usd" />);
    const est = screen.getByRole('region', { name: 'Estimado' });
    const usdLine = within(est).getByText('Proyección USD').parentElement!;
    expect(within(usdLine).getByText(/meta \$100/)).toBeTruthy();
    expect(within(usdLine).getByText('Sin datos')).toBeTruthy();
    expect(within(usdLine).queryByText('Sin meta')).toBeNull();
  });

  test('Estimado: projected units and USD against the goal, with status', () => {
    render(<WeeklyMatrix root={root} headers={data.weeks} currency="usd" />);
    const est = screen.getByRole('region', { name: 'Estimado' });
    expect(within(est).getByText(/Proyección USD/)).toBeTruthy();
    expect(within(est).getByText('$154')).toBeTruthy();
    expect(within(est).getByText(/meta \$100/)).toBeTruthy();
    expect(within(est).getByText('77')).toBeTruthy();
    expect(within(est).getByText(/meta 100/)).toBeTruthy();
    // $154 of $100 is on goal; 77 of 100 units is below it
    expect(within(est).getByText('En meta')).toBeTruthy();
    expect(within(est).getByText('Bajo meta')).toBeTruthy();
  });

  test('Estimado for a root without goals says so, neutral, never red', () => {
    const ruta = fixtureResponse('ruta').roots[0];
    render(<WeeklyMatrix root={ruta} headers={data.weeks} currency="usd" />);
    const est = screen.getByRole('region', { name: 'Estimado' });
    expect(within(est).getAllByText(/Sin meta/).length).toBeGreaterThan(0);
    expect(within(est).queryByText(/Bajo meta/)).toBeNull();
  });

  test('categories from the root mix, with share and projection', () => {
    render(<WeeklyMatrix root={root} headers={data.weeks} currency="usd" />);
    const cats = screen.getByRole('table', { name: 'Categorías' });
    const pan = within(cats).getByRole('rowheader', { name: 'Panaderia' }).closest('tr')!;
    // Panaderia $60 of $70 brutas; projection scales with the root's ($154 / $70)
    expect(within(pan).getByText('$60')).toBeTruthy();
    expect(within(pan).getByText('85.7%')).toBeTruthy();
    expect(within(pan).getByText('$132')).toBeTruthy();
  });
});
