import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';

// Decouple from the strip's copy (plan B owns it): expose the props the strip receives.
mock.module('../seguimiento/visuals', () => ({
  MonthPaceStrip: ({ pace }: { pace: unknown }) => <pre data-testid="pace">{JSON.stringify(pace)}</pre>,
}));
const { ResumenPace } = await import('../resumen-pace');

afterEach(cleanup);
const pace = () => JSON.parse(screen.getByTestId('pace').textContent!);

describe('ResumenPace', () => {
  test('a month range paces that month as of today', () => {
    render(<ResumenPace dateRange="month:2026-10" today="2026-10-14" />);
    expect(pace()).toMatchObject({ month: '2026-10', asOf: '2026-10-14', workingDaysInMonth: 22, workingDaysElapsed: 10 });
  });
  test('a closed past month is fully elapsed', () => {
    render(<ResumenPace dateRange="month:2026-09" today="2026-10-14" />);
    expect(pace()).toMatchObject({ month: '2026-09', asOf: '2026-09-30', workingDaysElapsed: 22, workingDaysInMonth: 22, fractionElapsed: 1 });
  });
  test('trailing windows use the current month', () => {
    render(<ResumenPace dateRange="30d" today="2026-10-14" />);
    expect(pace()).toMatchObject({ month: '2026-10', workingDaysElapsed: 10 });
  });
  test('a future month has nothing elapsed (0, not NaN)', () => {
    render(<ResumenPace dateRange="month:2027-01" today="2026-10-14" />);
    expect(pace()).toMatchObject({ month: '2027-01', workingDaysElapsed: 0, fractionElapsed: 0 });
  });
});
