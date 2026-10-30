import { screen } from '../../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import type { HistoryPoint } from '../../../../../../lib/seguimiento/types';
import { buildHistoryRows, HistoryChart, historyMonths, HistoryTooltip } from '../history-chart';

afterEach(cleanup);

type Line = NonNullable<HistoryPoint['byLine']>[number];
const line = (name: string | null, usd: number | null, units = 1): Line => ({ line: name, sales: { bs: (usd ?? 2) * 50, usd }, units });
// A point whose brutas are the sum of its lines, as fetchHistory builds it.
const lp = (month: string, lines: Line[]): HistoryPoint => {
  const usds = lines.map(l => l.sales.usd).filter((u): u is number => u !== null);
  return {
    month, byLine: lines, units: lines.reduce((a, l) => a + l.units, 0),
    sales: { bs: lines.reduce((a, l) => a + l.sales.bs, 0), usd: usds.length ? usds.reduce((a, u) => a + u, 0) : null },
    returns: { bs: 0, usd: 0 }, returnUnits: 0,
  };
};

const pt = (month: string, usd: number | null, units: number, retUsd = 10, retUnits = 2): HistoryPoint => ({
  month, sales: { bs: (usd ?? 0) * 50, usd }, units, returns: { bs: retUsd * 50, usd: retUsd }, returnUnits: retUnits,
});

describe('historyMonths', () => {
  test('12 months ending in the end month, across a year boundary', () => {
    const m = historyMonths('2026-02');
    expect(m).toHaveLength(12);
    expect(m[0]).toBe('2025-03');
    expect(m[11]).toBe('2026-02');
  });
});

describe('buildHistoryRows', () => {
  test('a month absent from points is a gap (null), not zero', () => {
    const rows = buildHistoryRows([pt('2026-08', 100, 10), pt('2026-10', 300, 30)], '2026-10', 'usd', '2026-10');
    expect(rows).toHaveLength(12);
    const sep = rows.find(r => r.month === '2026-09')!;
    expect(sep.gross).toBeNull();
    expect(sep.units).toBeNull();
    expect(rows.find(r => r.month === '2026-08')!.gross).toBe(100);
  });

  test('change vs previous month is null for the first point and when the previous month is missing', () => {
    const rows = buildHistoryRows([pt('2026-08', 100, 10), pt('2026-10', 300, 30), pt('2026-09', 150, 20)], '2026-10', 'usd', '');
    const by = (m: string) => rows.find(r => r.month === m)!;
    expect(by('2026-08').change).toBeNull();
    expect(by('2026-09').change).toBeCloseTo(0.5);
    expect(by('2026-10').change).toBeCloseTo(1);
    const gapped = buildHistoryRows([pt('2026-08', 100, 10), pt('2026-10', 300, 30)], '2026-10', 'usd', '');
    expect(gapped.find(r => r.month === '2026-10')!.change).toBeNull();
  });

  test('change is null (never Infinity/NaN) when the previous month is zero or USD is null', () => {
    const zero = buildHistoryRows([pt('2026-09', 0, 0), pt('2026-10', 300, 30)], '2026-10', 'usd', '');
    expect(zero.find(r => r.month === '2026-10')!.change).toBeNull();
    const nul = buildHistoryRows([pt('2026-09', null, 5), pt('2026-10', 300, 30)], '2026-10', 'usd', '');
    expect(nul.find(r => r.month === '2026-10')!.change).toBeNull();
  });

  test('USD null stays null (renders as a dash), Bs currency picks the bs side, net = brutas - devoluciones', () => {
    const usdNull = buildHistoryRows([pt('2026-10', null, 5)], '2026-10', 'usd', '');
    expect(usdNull[11].gross).toBeNull();
    expect(usdNull[11].net).toBeNull();
    const bs = buildHistoryRows([pt('2026-10', 100, 10, 10, 2)], '2026-10', 'bs', '');
    expect(bs[11].gross).toBe(5000);
    expect(bs[11].net).toBe(4500);
    expect(bs[11].netUnits).toBe(8);
  });

  test('only the partial month is labelled (parcial)', () => {
    const rows = buildHistoryRows([pt('2026-10', 1, 1)], '2026-10', 'usd', '2026-10');
    expect(rows[11].label).toContain('parcial');
    expect(rows[11].title).toContain('parcial');
    expect(rows[10].label).not.toContain('parcial');
  });
});

describe('partial month change', () => {
  test('the partial month has no month-over-month change (a partial month is not comparable)', () => {
    const rows = buildHistoryRows([pt('2026-09', 100, 10), pt('2026-10', 50, 5)], '2026-10', 'usd', '2026-10');
    expect(rows[11].change).toBeNull();
    expect(rows[11].unitsChange).toBeNull();
    const closed = buildHistoryRows([pt('2026-09', 100, 10), pt('2026-10', 50, 5)], '2026-10', 'usd', '');
    expect(closed[11].change).toBeCloseTo(-0.5);
  });
});

describe('HistoryChart', () => {
  test('the title names the scope', () => {
    render(<HistoryChart points={[pt('2026-10', 120, 12)]} currency="usd" partialMonth="" scopeLabel="Ana Pérez" />);
    expect(screen.getByRole('heading', { name: 'Mes a mes · Ana Pérez' })).toBeTruthy();
  });

  test('the scope defaults to Total', () => {
    render(<HistoryChart points={[pt('2026-10', 120, 12)]} currency="usd" partialMonth="" />);
    expect(screen.getByRole('heading', { name: 'Mes a mes · Total' })).toBeTruthy();
  });

  test('empty points renders Sin datos', () => {
    render(<HistoryChart points={[]} currency="usd" partialMonth="2026-10" />);
    expect(screen.getByText('Sin datos')).toBeTruthy();
  });

  test('legend names both series, with non-colour cues, and marks the partial month', () => {
    render(<HistoryChart points={[pt('2026-09', 100, 10), pt('2026-10', 120, 12)]} currency="usd" partialMonth="2026-10" />);
    expect(screen.getByText(/Ventas brutas \(USD\)/)).toBeTruthy();
    expect(screen.getByText(/Unidades brutas \(eje der\.\)/)).toBeTruthy();
    expect(screen.getByText(/es parcial/)).toBeTruthy();
  });

  test('legend uses Bs when currency is bs', () => {
    render(<HistoryChart points={[pt('2026-10', 120, 12)]} currency="bs" partialMonth="" />);
    expect(screen.getByText(/Ventas brutas \(Bs\.\)/)).toBeTruthy();
  });
});

describe('stacked segments per month', () => {
  const points = [
    lp('2026-08', [line('Pan', 10), line('Pizza', 50), line(null, 5)]),
    lp('2026-10', [line('Pan', 60), line('Pizza', 20), line('Torta', null), line('Navidad', 1)]),
  ];

  test('each month stacks biggest at the base, Otros on top; the order flips between months', () => {
    const rows = buildHistoryRows(points, '2026-10', 'usd', '');
    const cats = (m: string) => rows.find(r => r.month === m)!.segments.map(s => s.category);
    expect(cats('2026-08')).toEqual(['Pizza', 'Pan', 'Otros']);
    expect(cats('2026-10')).toEqual(['Pan', 'Pizza', 'Navidad', 'Torta']);
  });

  test('the segments add up to the month brutas', () => {
    for (const r of buildHistoryRows(points, '2026-10', 'usd', '').filter(x => x.gross !== null)) {
      expect(r.segments.reduce((a, s) => a + (s.value ?? 0), 0)).toBeCloseTo(r.gross!);
    }
  });

  test('slots: one per visible category in stack order, Otros in the last slot; null USD and gap months stay null', () => {
    const rows = buildHistoryRows(points, '2026-10', 'usd', '');
    const oct = rows.find(r => r.month === '2026-10')!;
    // 4 visible lines (Pan, Pizza, Navidad, Torta) + the Otros slot.
    expect(oct.slots).toHaveLength(5);
    expect(oct.slots.map(s => s?.category ?? null)).toEqual(['Pan', 'Pizza', 'Navidad', 'Torta', null]);
    expect(oct.slots[3]!.value).toBeNull();
    const aug = rows.find(r => r.month === '2026-08')!;
    expect(aug.slots.map(s => s?.category ?? null)).toEqual(['Pizza', 'Pan', null, null, 'Otros']);
    const sep = rows.find(r => r.month === '2026-09')!;
    expect(sep.segments).toEqual([]);
    expect(sep.slots.every(s => s === null)).toBe(true);
  });

  test('a point without byLine (old cached response) stacks its whole brutas as one Otros segment', () => {
    const rows = buildHistoryRows([pt('2026-10', 120, 12)], '2026-10', 'usd', '');
    expect(rows[11].segments).toEqual([{ category: 'Otros', value: 120 }]);
  });

  test('legend lists every category with a pattern swatch, plus Otros and the units line', () => {
    const { container } = render(<HistoryChart points={points} currency="usd" partialMonth="" />);
    const legend = screen.getByRole('list', { name: /Leyenda/ });
    const items = Array.from(legend.querySelectorAll('li')).map(li => li.textContent?.trim());
    // Legend order = the 12-month ranking (Bs total, ties by name), not one month's stack order.
    expect(items).toEqual(['Pan', 'Pizza', 'Torta', 'Navidad', 'Otros', 'Unidades brutas (eje der.)']);
    const fills = Array.from(legend.querySelectorAll('li svg > rect')).map(r => r.getAttribute('fill'));
    expect(fills.slice(0, 5).every(f => f?.startsWith('url(#'))).toBe(true);
    expect(new Set(fills.slice(0, 5)).size).toBe(5);
    expect(container.querySelectorAll('li svg pattern')).toHaveLength(5);
  });

  test('a text table gives every month x category value, — for null, never 0', () => {
    render(<HistoryChart points={points} currency="usd" partialMonth="" />);
    const table = screen.getByRole('table', { name: /por categoría/ });
    const headers = Array.from(table.querySelectorAll('th[scope="col"]')).map(th => th.textContent);
    expect(headers).toEqual(['Mes', 'Pan', 'Pizza', 'Torta', 'Navidad', 'Otros', 'Ventas brutas', 'Unidades brutas']);
    const octRow = Array.from(table.querySelectorAll('tbody tr')).at(-1)!;
    const cells = Array.from(octRow.querySelectorAll('td')).map(td => td.textContent);
    expect(cells[2]).toBe('—'); // Torta, USD null
    expect(cells[4]).toBe('—'); // no Otros this month
    const sepRow = Array.from(table.querySelectorAll('tbody tr'))[10];
    expect(Array.from(sepRow.querySelectorAll('td')).every(td => td.textContent === '—')).toBe(true);
  });
});

describe('HistoryTooltip', () => {
  test('lists each category for the month in stack order, — for a null USD, then brutas / devoluciones / neta / change', () => {
    const rows = buildHistoryRows([
      lp('2026-09', [line('Pan', 10)]),
      lp('2026-10', [line('Pan', 60), line('Pizza', 20), line('Torta', null), line(null, 3)]),
    ], '2026-10', 'usd', '');
    render(<HistoryTooltip active payload={[{ payload: rows[11] }]} currency="usd" />);
    const items = Array.from(screen.getByRole('list', { name: 'Categorías' }).querySelectorAll('li')).map(li => li.textContent);
    expect(items).toHaveLength(4);
    expect(items[0]).toMatch(/^Pan: /);
    expect(items[1]).toMatch(/^Pizza: /);
    expect(items[2]).toBe('Torta: —');
    expect(items[3]).toMatch(/^Otros: /);
    expect(screen.getByText(/^Brutas:/)).toBeTruthy();
    expect(screen.getByText(/^Devoluciones:/)).toBeTruthy();
    expect(screen.getByText(/^Neta:/)).toBeTruthy();
    expect(screen.getByText(/Cambio vs mes anterior/)).toBeTruthy();
  });
});
