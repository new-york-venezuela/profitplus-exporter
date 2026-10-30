import { screen } from '../../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import type { HistoryPoint } from '../../../../../../lib/seguimiento/types';
import { buildHistoryRows, HistoryChart, historyMonths } from '../history-chart';

afterEach(cleanup);

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
    expect(screen.getByText(/parcial/)).toBeTruthy();
  });

  test('legend uses Bs when currency is bs', () => {
    render(<HistoryChart points={[pt('2026-10', 120, 12)]} currency="bs" partialMonth="" />);
    expect(screen.getByText(/Ventas brutas \(Bs\.\)/)).toBeTruthy();
  });
});
