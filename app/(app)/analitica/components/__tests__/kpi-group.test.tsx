import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { KpiGroup } from '../kpi-group';
import { KpiCard } from '../kpi-card';

afterEach(cleanup);

describe('KpiGroup', () => {
  test('renders its title as a labelled region with its children', () => {
    render(
      <KpiGroup title="Ventas" tone="sales">
        <KpiCard label="Ventas brutas" value="Bs. 100" />
        <KpiCard label="Unidades vendidas" value="54.170" />
      </KpiGroup>,
    );
    const region = screen.getByRole('region', { name: 'Ventas' });
    expect(region.textContent).toContain('Ventas brutas');
    expect(region.textContent).toContain('54.170');
  });

  test('tone drives the panel colour, and each tone is distinct', () => {
    const { container, rerender } = render(<KpiGroup title="A" tone="sales"><span /></KpiGroup>);
    const sales = container.querySelector('section')!.className;
    rerender(<KpiGroup title="A" tone="returns"><span /></KpiGroup>);
    const returns = container.querySelector('section')!.className;
    expect(sales).toContain('border-blue');
    expect(returns).toContain('border-red');
    expect(sales).not.toBe(returns);
  });

  test('columns prop switches the grid layout', () => {
    const { container } = render(<KpiGroup title="A" tone="customers" columns={4}><span /></KpiGroup>);
    expect(container.querySelector('section > div')!.className).toContain('md:grid-cols-4');
  });
});

describe('KpiCard', () => {
  test('shows label, value, subtitle and tooltip', () => {
    render(<KpiCard label="Pendiente por cobrar" value="Bs. 58.319.035" subtitle="al 16/09/2026" title="Saldo pendiente" />);
    expect(screen.getByText('Pendiente por cobrar')).toBeTruthy();
    expect(screen.getByText('Bs. 58.319.035')).toBeTruthy();
    expect(screen.getByText('al 16/09/2026')).toBeTruthy();
    expect(screen.getByTitle('Saldo pendiente')).toBeTruthy();
  });

  test('warn tone and a null delta render without crashing', () => {
    render(<KpiCard label="Tasa" value="9%" tone="warn" delta={{ pct: null, label: 'vs. período anterior' }} />);
    expect(screen.getByText('9%').className).toContain('text-orange-600');
    expect(screen.getByText(/vs\. período anterior/).textContent).toContain('—');
  });

  test('valueClassName overrides the big-number style', () => {
    render(<KpiCard label="Cliente" value="AUTOMERCADOS" valueClassName="text-base font-bold" />);
    expect(screen.getByText('AUTOMERCADOS').className).toContain('text-base');
  });
});
