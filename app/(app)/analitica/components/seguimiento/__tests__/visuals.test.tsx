import { screen } from '../../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import {
  MixBar, MonthPaceStrip, NewCustomersChip, QuotaBar, VisitBadge, WeekDots, WeekStrip,
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
const cells: WeekCell[] = [
  { yearWeek: '2026-W41', active: 2, assigned: 2, pct: 1 },
  { yearWeek: '2026-W42', active: 1, assigned: 2, pct: 0.5 },
  { yearWeek: '2026-W43', active: 0, assigned: 2, pct: null },
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

describe('QuotaBar', () => {
  test('fill, target and projection positions on one shared scale', () => {
    render(<QuotaBar actual={{ bs: 3500, usd: 70 }} quotaUsd={100} projected={{ bs: 7700, usd: 154 }} currency="usd" />);
    const bar = screen.getByRole('img');
    expect(bar.getAttribute('aria-label')).toContain('$70');
    expect(bar.getAttribute('aria-label')).toContain('meta $100');
    expect(bar.getAttribute('aria-label')).toContain('proyección $154');
    expect(Number(screen.getByTestId('quota-bar-fill').getAttribute('data-pct'))).toBeCloseTo((70 / 154) * 100, 3);
    expect(Number(screen.getByTestId('quota-bar-target').getAttribute('data-pct'))).toBeCloseTo((100 / 154) * 100, 3);
    expect(Number(screen.getByTestId('quota-bar-projection').getAttribute('data-pct'))).toBe(100);
  });
  test('no quota: "Sin meta" and no bar geometry', () => {
    render(<QuotaBar actual={{ bs: 400, usd: 8 }} quotaUsd={null} projected={null} currency="usd" />);
    expect(screen.getByText('Sin meta')).toBeTruthy();
    expect(screen.queryByTestId('quota-bar-fill')).toBeNull();
  });
  test('zero quota is also "Sin meta"', () => {
    render(<QuotaBar actual={{ bs: 400, usd: 8 }} quotaUsd={0} projected={null} currency="usd" />);
    expect(screen.getByText('Sin meta')).toBeTruthy();
  });
  test('unknown USD sales show a dash, never $0', () => {
    render(<QuotaBar actual={{ bs: 400, usd: null }} quotaUsd={100} projected={{ bs: 880, usd: null }} currency="usd" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('—');
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toContain('$0');
    expect(screen.queryByTestId('quota-bar-projection')).toBeNull();
  });
  test('a shared quota (seller with several routes) is labelled as such', () => {
    render(<QuotaBar actual={{ bs: 100, usd: 2 }} quotaUsd={100} projected={null} currency="usd" shared />);
    expect(screen.getByText('Meta compartida')).toBeTruthy();
  });
  test('partial quota (some sellers without a goal) is flagged', () => {
    render(<QuotaBar actual={{ bs: 100, usd: 2 }} quotaUsd={100} projected={null} currency="usd" partial />);
    expect(screen.getByText('Meta parcial')).toBeTruthy();
  });
  test('Bs currency shows the actual in Bs but the quota stays in USD', () => {
    render(<QuotaBar actual={{ bs: 3500, usd: 70 }} quotaUsd={100} projected={null} currency="bs" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Bs. 3.500');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('meta $100');
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

describe('NewCustomersChip', () => {
  test('met, in progress, none and no goal', () => {
    const { rerender } = render(<NewCustomersChip info={{ count: 2, quota: 2, partial: false }} />);
    expect(screen.getByText('Nuevos 2 / 2').className).toContain('green');
    rerender(<NewCustomersChip info={{ count: 1, quota: 3, partial: false }} />);
    expect(screen.getByText('Nuevos 1 / 3').className).toContain('amber');
    rerender(<NewCustomersChip info={{ count: 0, quota: 3, partial: false }} />);
    expect(screen.getByText('Nuevos 0 / 3').className).toContain('red');
    rerender(<NewCustomersChip info={{ count: 4, quota: null, partial: false }} />);
    expect(screen.getByText('Nuevos 4 (sin meta)').className).toContain('gray');
  });
  test('partial goal gets an asterisk and a tooltip', () => {
    render(<NewCustomersChip info={{ count: 1, quota: 2, partial: true }} />);
    expect(screen.getByText('Nuevos 1 / 2*').getAttribute('title')).toContain('parcial');
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
