import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogoRow } from '../../types';

// Recharts draws nothing useful in happy-dom, so stub it: Scatter renders one
// button per datum wired to the real onClick prop, axes render their label.
mock.module('recharts', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Pass,
    ScatterChart: Pass,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ZAxis: () => null,
    ReferenceLine: () => null,
    Cell: () => null,
    XAxis: ({ label }: { label?: { value?: string } }) => <span data-axis="x">{label?.value}</span>,
    YAxis: ({ label }: { label?: { value?: string } }) => <span data-axis="y">{label?.value}</span>,
    Scatter: ({ data, onClick }: { data: { key: string; label: string }[]; onClick: (p: unknown) => void }) => (
      <div>
        {data.map(d => (
          <button key={d.key} type="button" data-bubble={d.key} onClick={() => onClick(d)}>{d.label}</button>
        ))}
      </div>
    ),
  };
});

const { default: BubblePlot } = await import('../productos/bubble-plot');

afterEach(cleanup);

function row(over: Partial<CatalogoRow>): CatalogoRow {
  return {
    key: 'K', label: 'K', code: null, linea: 'L', sublinea: '',
    salesGross: { bs: 1000, usd: 20 }, returns: { bs: 0, usd: 0 }, salesNet: { bs: 1000, usd: 20 },
    units: 100, monthCount: 2, avgUnitsPerMonth: 50, avgPrice: { bs: 10, usd: 0.2 },
    returnRate: 0.05, clientCount: 1, posCount: 1, sharePct: 0.5, pareto: 'A', prevNet: null, trendPct: 0.1,
    ...over,
  };
}

describe('BubblePlot', () => {
  test('legend shows A/B/C; "Sin clase" only when a null-class item is plotted', () => {
    const { rerender } = render(<BubblePlot rows={[row({ key: 'a', pareto: 'A' })]} currency="bs" onSelect={() => {}} />);
    const legend = screen.getByLabelText('Leyenda de clases Pareto');
    expect(legend.textContent).toContain('A');
    expect(legend.textContent).toContain('B');
    expect(legend.textContent).toContain('C');
    expect(legend.textContent).not.toContain('Sin clase');
    rerender(<BubblePlot rows={[row({ key: 'a', pareto: null })]} currency="bs" onSelect={() => {}} />);
    expect(screen.getByLabelText('Leyenda de clases Pareto').textContent).toContain('Sin clase');
  });

  test('clicking a bubble calls onSelect with its key', async () => {
    const picks: string[] = [];
    render(<BubblePlot rows={[row({ key: 'a', label: 'Alfa' }), row({ key: 'b', label: 'Beta' })]} currency="bs" onSelect={k => picks.push(k)} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Beta' }));
    expect(picks).toEqual(['b']);
  });

  test('notes: "N sin datos" and the top-150 note', () => {
    const rows = [
      ...Array.from({ length: 152 }, (_, i) => row({ key: `k${i}`, label: `k${i}`, salesNet: { bs: i + 1, usd: i + 1 } })),
      row({ key: 'x', label: 'x', trendPct: null }),
      row({ key: 'y', label: 'y', trendPct: null }),
    ];
    render(<BubblePlot rows={rows} currency="bs" onSelect={() => {}} />);
    expect(screen.getByText('2 sin datos')).toBeTruthy();
    expect(screen.getByText('Mostrando los 150 principales')).toBeTruthy();
  });

  test('no notes when everything is plotted', () => {
    render(<BubblePlot rows={[row({ key: 'a' })]} currency="bs" onSelect={() => {}} />);
    expect(screen.queryByText(/sin datos/)).toBeNull();
    expect(screen.queryByText(/Mostrando/)).toBeNull();
  });

  test('Y toggle switches the axis label and the missing count', async () => {
    const user = userEvent.setup();
    const rows = [row({ key: 'a' }), row({ key: 'b', returnRate: null })];
    const { container } = render(<BubblePlot rows={rows} currency="bs" onSelect={() => {}} />);
    expect(container.querySelector('[data-axis="y"]')!.textContent).toBe('Tendencia vs. período anterior');
    expect(screen.queryByText(/sin datos/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Tasa de devolución' }));
    expect(container.querySelector('[data-axis="y"]')!.textContent).toBe('Tasa de devolución');
    expect(screen.getByText('1 sin datos')).toBeTruthy();
    expect(within(container).getByRole('button', { name: 'Tasa de devolución' }).getAttribute('aria-pressed')).toBe('true');
  });

  test('caption explains the axes', () => {
    render(<BubblePlot rows={[row({})]} currency="bs" onSelect={() => {}} />);
    const caption = screen.getByText(/Eje X:/).textContent!;
    expect(caption).toContain('unidades por mes');
    expect(caption).toContain('ventas netas');
  });
});
