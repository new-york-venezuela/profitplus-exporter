import { screen } from '../../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { makeKpis } from './fixtures';

const { VentasStrip } = await import('../ventas-strip');
afterEach(cleanup);

describe('VentasStrip', () => {
  test('shows the three cards with average price and rate', () => {
    render(<VentasStrip kpis={makeKpis()} currency="usd" />);
    expect(screen.getByText('Ventas brutas')).toBeTruthy();
    expect(screen.getByText('Devoluciones')).toBeTruthy();
    expect(screen.getByText('Neto')).toBeTruthy();
    expect(screen.getByText(/\$8\.06/)).toBeTruthy();
    expect(screen.getAllByText('Precio promedio').length).toBe(3);
    expect(screen.getByText(/4\.0%/)).toBeTruthy();
    expect(screen.getByText('$100,000')).toBeTruthy();
  });

  test('null return rate renders a dash, not NaN', () => {
    render(<VentasStrip kpis={makeKpis({ returnRate: null })} currency="usd" />);
    expect(document.body.textContent).not.toContain('NaN');
  });
});
