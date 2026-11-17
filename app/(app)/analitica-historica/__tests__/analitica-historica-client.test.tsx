import { screen } from '../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';

const pushed: string[] = [];
let search = '';
mock.module('next/navigation', () => ({
  useRouter: () => ({ push: (u: string) => { pushed.push(u); }, replace: (u: string) => { pushed.push(u); } }),
  useSearchParams: () => new URLSearchParams(search),
}));
mock.module('posthog-js', () => ({ default: { capture: () => {} } }));

const { AnaliticaHistoricaClient } = await import('../analitica-historica-client');
const { histPresetRange, HIST_START_KEY, keyToIso, histYears, histYearRange, histLastCompleteYear, histMonthsOfYear, histStepYear, histQuarterRange, histQuartersOfYear, histLastCompleteQuarter } = await import('@/lib/analitica-historica/window');

const lastUrl = () => decodeURIComponent(pushed[pushed.length - 1] ?? '');

beforeEach(() => {
  pushed.length = 0;
  search = '';
  // The mounted tab fetches on render; keep it pending so no real request is made.
  globalThis.fetch = mock(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
});
afterEach(cleanup);

describe('AnaliticaHistoricaClient', () => {
  test('renders the six tabs and the legacy banner', () => {
    render(<AnaliticaHistoricaClient />);
    for (const label of ['Resumen', 'Ventas', 'Devoluciones', 'Clientes', 'Productos', 'Vendedores']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText(/sistema anterior/i).length).toBeGreaterThan(0);
  });

  test('a preset writes the concrete range anchored to the legacy window end', () => {
    render(<AnaliticaHistoricaClient />);
    fireEvent.click(screen.getByRole('button', { name: /^Último mes \(/ }));
    expect(lastUrl()).toContain(`dateRange=${histPresetRange('month')}`);
  });

  test('has the Bs / USD toggle', () => {
    render(<AnaliticaHistoricaClient />);
    expect(screen.getByText('USD')).toBeTruthy();
    fireEvent.click(screen.getByText('USD'));
    expect(lastUrl()).toContain('currency=usd');
  });

  test('custom date inputs are bounded to the legacy window', () => {
    search = `dateRange=${histPresetRange('all')}`;
    render(<AnaliticaHistoricaClient />);
    const start = screen.getByLabelText('Fecha inicial') as HTMLInputElement;
    expect(start.min).toBe(keyToIso(HIST_START_KEY));
  });

  test('the casa matriz / tienda switch shows on Clientes and writes clienteDimension', () => {
    search = 'tab=clientes';
    render(<AnaliticaHistoricaClient />);
    fireEvent.click(screen.getByRole('button', { name: 'Tienda' }));
    expect(lastUrl()).toContain('clienteDimension=tienda');
  });

  test('the casa matriz / tienda switch is hidden where clients are not listed', () => {
    search = 'tab=resumen';
    render(<AnaliticaHistoricaClient />);
    expect(screen.queryByRole('button', { name: 'Tienda' })).toBeNull();
  });

  test('the returns-basis selector shows on Ventas but not on Productos', () => {
    search = 'tab=ventas';
    const { unmount } = render(<AnaliticaHistoricaClient />);
    expect(screen.getByText('Devoluciones', { selector: 'span' })).toBeTruthy();
    unmount();
    search = 'tab=productos';
    render(<AnaliticaHistoricaClient />);
    expect(screen.queryByText('Devoluciones', { selector: 'span' })).toBeNull();
  });

  test('there is no year-to-date preset: "último año" and "año anterior" are whole calendar years', () => {
    render(<AnaliticaHistoricaClient />);
    expect(screen.queryByText(/Año Actual/i)).toBeNull();
    const last = histLastCompleteYear();
    fireEvent.click(screen.getByRole('button', { name: `Último año (${last})` }));
    expect(lastUrl()).toContain(`dateRange=${histPresetRange('last-year')}`);
    expect(lastUrl()).toContain(`dateRange=custom:${last}-01-01:${last}-12-31`);
    fireEvent.click(screen.getByRole('button', { name: `Año anterior (${last - 1})` }));
    expect(lastUrl()).toContain(`dateRange=custom:${last - 1}-01-01:${last - 1}-12-31`);
  });

  test('every year of the data is a chip; a chip selects that whole year', () => {
    render(<AnaliticaHistoricaClient />);
    const group = screen.getByRole('group', { name: 'Año' });
    for (const y of histYears()) expect(group.querySelector(`button[data-year="${y}"]`)).not.toBeNull();
    fireEvent.click(group.querySelector('button[data-year="2024"]')!);
    expect(lastUrl()).toContain('dateRange=custom:2024-01-01:2024-12-31');
  });

  test('the newest year is clamped to where the data ends', () => {
    render(<AnaliticaHistoricaClient />);
    const newest = histYears()[0];
    fireEvent.click(screen.getByRole('group', { name: 'Año' }).querySelector(`button[data-year="${newest}"]`)!);
    expect(lastUrl()).toContain(`dateRange=${histYearRange(newest)}`);
  });

  test('the selected year highlights its chip', () => {
    search = `dateRange=${histYearRange(2024)}`;
    render(<AnaliticaHistoricaClient />);
    const group = screen.getByRole('group', { name: 'Año' });
    expect(group.querySelector('button[data-year="2024"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(group.querySelector('button[data-year="2023"]')!.getAttribute('aria-pressed')).toBe('false');
  });

  test('the months of the selected year are chips and a month chip selects that month', () => {
    search = 'dateRange=month:2024-05';
    render(<AnaliticaHistoricaClient />);
    const months = screen.getByRole('group', { name: 'Meses de 2024' });
    expect(months.querySelectorAll('button')).toHaveLength(12);
    expect(months.querySelector('button[data-month="2024-05"]')!.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(months.querySelector('button[data-month="2024-03"]')!);
    expect(lastUrl()).toContain('dateRange=month:2024-03');
  });

  test('months with no data are disabled (the last, partial year)', () => {
    const newest = histYears()[0];
    search = `dateRange=${histYearRange(newest)}`;
    render(<AnaliticaHistoricaClient />);
    const months = screen.getByRole('group', { name: `Meses de ${newest}` });
    for (const m of histMonthsOfYear(newest)) {
      expect((months.querySelector(`button[data-month="${m.key}"]`) as HTMLButtonElement).disabled).toBe(!m.enabled);
    }
  });

  test('a range spanning years (the default 12 months) lists the months of the newest year', () => {
    render(<AnaliticaHistoricaClient />);
    expect(screen.getByRole('group', { name: `Meses de ${histYears()[0]}` })).toBeTruthy();
  });

  test('a custom range inside one year lists that year\'s months, none highlighted', () => {
    search = 'dateRange=custom:2023-03-10:2023-04-02';
    render(<AnaliticaHistoricaClient />);
    const months = screen.getByRole('group', { name: 'Meses de 2023' });
    expect(months.querySelectorAll('button[aria-pressed="true"]')).toHaveLength(0);
  });

  test('arrows step the selected year back and forward', () => {
    search = `dateRange=${histYearRange(2024)}`;
    render(<AnaliticaHistoricaClient />);
    fireEvent.click(screen.getByRole('button', { name: 'Ir al año anterior' }));
    expect(lastUrl()).toContain(`dateRange=${histStepYear(histYearRange(2024), -1)}`);
    fireEvent.click(screen.getByRole('button', { name: 'Ir al año siguiente' }));
    expect(lastUrl()).toContain(`dateRange=${histStepYear(histYearRange(2024), 1)}`);
  });

  test('with a month selected the year arrows keep the month', () => {
    search = 'dateRange=month:2024-05';
    render(<AnaliticaHistoricaClient />);
    fireEvent.click(screen.getByRole('button', { name: 'Ir al año anterior' }));
    expect(lastUrl()).toContain('dateRange=month:2023-05');
  });

  test('the year arrows are disabled at the ends of the data', () => {
    const years = histYears();
    search = `dateRange=${histYearRange(years[0])}`;
    const first = render(<AnaliticaHistoricaClient />);
    expect((screen.getByRole('button', { name: 'Ir al año siguiente' }) as HTMLButtonElement).disabled).toBe(true);
    first.unmount();
    search = `dateRange=${histYearRange(years[years.length - 1])}`;
    render(<AnaliticaHistoricaClient />);
    expect((screen.getByRole('button', { name: 'Ir al año anterior' }) as HTMLButtonElement).disabled).toBe(true);
  });

  test('there is no "30 días" shortcut', () => {
    render(<AnaliticaHistoricaClient />);
    expect(screen.queryByText('30 días')).toBeNull();
  });

  test('the shortcuts name the period they select', () => {
    render(<AnaliticaHistoricaClient />);
    const last = histLastCompleteYear();
    const { year, quarter } = histLastCompleteQuarter();
    for (const name of ['Todo', '12 meses', `Último año (${last})`, `Año anterior (${last - 1})`, `Último trimestre (T${quarter} ${year})`]) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: /^Último mes \([a-z]{3} \d{4}\)$/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `Último trimestre (T${quarter} ${year})` }));
    expect(lastUrl()).toContain(`dateRange=${histQuarterRange(year, quarter)}`);
  });

  test('the quarters of the selected year are chips and a chip selects that quarter', () => {
    search = 'dateRange=month:2024-05';
    render(<AnaliticaHistoricaClient />);
    const group = screen.getByRole('group', { name: 'Trimestres de 2024' });
    expect(group.querySelectorAll('button')).toHaveLength(4);
    fireEvent.click(group.querySelector('button[data-quarter="2024-Q2"]')!);
    expect(lastUrl()).toContain('dateRange=custom:2024-04-01:2024-06-30');
  });

  test('the selected quarter is highlighted and quarters without data are disabled', () => {
    search = `dateRange=${histQuarterRange(2024, 3)}`;
    const { unmount } = render(<AnaliticaHistoricaClient />);
    expect(screen.getByRole('group', { name: 'Trimestres de 2024' }).querySelector('button[data-quarter="2024-Q3"]')!.getAttribute('aria-pressed')).toBe('true');
    unmount();
    const newest = histYears()[0];
    search = `dateRange=${histYearRange(newest)}`;
    render(<AnaliticaHistoricaClient />);
    const group = screen.getByRole('group', { name: `Trimestres de ${newest}` });
    for (const q of histQuartersOfYear(newest)) {
      expect((group.querySelector(`button[data-quarter="${q.key}"]`) as HTMLButtonElement).disabled).toBe(!q.enabled);
    }
  });

  test('with a quarter selected the year arrows keep the quarter', () => {
    search = `dateRange=${histQuarterRange(2024, 2)}`;
    render(<AnaliticaHistoricaClient />);
    fireEvent.click(screen.getByRole('button', { name: 'Ir al año anterior' }));
    expect(lastUrl()).toContain(`dateRange=${histQuarterRange(2023, 2)}`);
  });
});
