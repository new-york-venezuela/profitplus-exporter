import { screen } from '../../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import {
  MixBar, MonthPaceStrip, VisitBadge, WeekDots, WeekStrip,
} from '../visuals';
import { monthPace } from '../../../../../../lib/seguimiento/month-pace';
import { visitCompliance } from '../../../../../../lib/seguimiento/visit-compliance';
import type { WeekCell, WeekHeader } from '../../../../../../lib/seguimiento/types';

afterEach(cleanup);

const headers: WeekHeader[] = [
  { yearWeek: '2026-W41', weekStart: '2026-10-05', weekEnd: '2026-10-11', label: 'S41', isFuture: false },
  { yearWeek: '2026-W42', weekStart: '2026-10-12', weekEnd: '2026-10-18', label: 'S42', isFuture: false },
  { yearWeek: '2026-W43', weekStart: '2026-10-19', weekEnd: '2026-10-25', label: 'S43', isFuture: true },
];
const Z = { bs: 0, usd: 0 };
const amt = { sales: Z, units: 0, returns: Z, returnUnits: 0, net: Z, avgPrice: null };
const cells: WeekCell[] = [
  { yearWeek: '2026-W41', active: 2, assigned: 2, pct: 1, ...amt },
  { yearWeek: '2026-W42', active: 1, assigned: 2, pct: 0.5, ...amt },
  { yearWeek: '2026-W43', active: 0, assigned: 2, pct: null, ...amt },
];

describe('WeekStrip', () => {
  test('one bar per week with the percentage, future weeks without one', () => {
    render(<WeekStrip weeks={cells} headers={headers} />);
    expect(screen.getByTestId('week-bar-2026-W41').getAttribute('data-pct')).toBe('1');
    expect(screen.getByTestId('week-bar-2026-W42').getAttribute('data-pct')).toBe('0.5');
    expect(screen.getByTestId('week-bar-2026-W43').getAttribute('data-pct')).toBe('');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('S42: 50.0%');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('S43: sin datos');
    expect(screen.getByText('S41')).toBeTruthy();
  });
});

describe('WeekDots', () => {
  test('marks the weeks with an invoice', () => {
    render(<WeekDots headers={headers} activeWeeks={['2026-W42']} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Semanas con factura: S42');
  });
  test('says so when there are none', () => {
    render(<WeekDots headers={headers} activeWeeks={[]} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Semanas con factura: ninguna');
  });
});

describe('MixBar', () => {
  test('segments are proportional and labelled', () => {
    render(<MixBar visibleLines={['Panaderia', 'Pizza']} segments={[
      { line: 'Panaderia', share: 0.75, sales: { bs: 75, usd: 1.5 } }, { line: 'Otros', share: 0.25, sales: { bs: 25, usd: 0.5 } },
    ]} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Panaderia 75%, Otros 25%');
    expect(screen.getByTestId('mix-Panaderia').getAttribute('style')).toContain('width: 75%');
  });
  test('empty mix renders a placeholder, not an empty bar', () => {
    render(<MixBar visibleLines={[]} segments={[]} />);
    expect(screen.getByText('Sin ventas')).toBeTruthy();
  });
});

describe('MonthPaceStrip', () => {
  test('working days elapsed and share of the month', () => {
    render(<MonthPaceStrip pace={monthPace('2026-10', '2026-10-14')} />);
    expect(screen.getByText(/Día laborable 10 de 22/)).toBeTruthy();
    expect(screen.getByText(/45\.5% del mes/)).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('45');
  });
});

describe('VisitBadge', () => {
  const asOf = '2026-10-14';
  test('overdue shows the days over, ok is al día', () => {
    const { rerender } = render(<VisitBadge visit={visitCompliance({ lastInvoiceDate: '2026-09-20', intervalDays: 7, asOf })} />);
    expect(screen.getByText('Vencida 17 d')).toBeTruthy();
    rerender(<VisitBadge visit={visitCompliance({ lastInvoiceDate: '2026-10-12', intervalDays: 7, asOf })} />);
    expect(screen.getByText('Al día')).toBeTruthy();
  });
  test('no frequency and no invoice are neutral, never "0 d"', () => {
    const { rerender } = render(<VisitBadge visit={visitCompliance({ lastInvoiceDate: '2026-10-12', intervalDays: null, asOf })} />);
    expect(screen.getByText('Sin frecuencia')).toBeTruthy();
    rerender(<VisitBadge visit={visitCompliance({ lastInvoiceDate: null, intervalDays: 7, asOf })} />);
    expect(screen.getByText('Sin compras')).toBeTruthy();
    expect(screen.queryByText(/0 d/)).toBeNull();
  });
});
