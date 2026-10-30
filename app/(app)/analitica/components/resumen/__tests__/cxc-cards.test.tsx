import { screen } from '../../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { makeKpis } from './fixtures';

const { CxcCards } = await import('../cxc-cards');
afterEach(cleanup);

describe('CxcCards', () => {
  test('four cards with values', () => {
    render(<CxcCards kpis={makeKpis()} currency="usd" />);
    expect(screen.getByText('Saldo inicial')).toBeTruthy();
    expect(screen.getByText(/Facturación/)).toBeTruthy();
    expect(screen.getByText(/sin IVA/)).toBeTruthy();
    expect(screen.getByText(/Cobros/)).toBeTruthy();
    expect(screen.getByText('Pendiente')).toBeTruthy();
    expect(screen.getByText('$150,000')).toBeTruthy();
    expect(screen.getByText('$200,000')).toBeTruthy();
  });

  test('Saldo inicial names the snapshot date it was read from', () => {
    render(<CxcCards kpis={makeKpis()} currency="usd" openingLabel="al 25/09/2026" />);
    expect(screen.getByText('al 25/09/2026')).toBeTruthy();
    expect(screen.queryByText(/día anterior al período/)).toBeNull();
  });

  test('Saldo inicial says "sin snapshot" when there is none', () => {
    render(<CxcCards kpis={makeKpis({ receivableOpening: null })} currency="usd" />);
    expect(screen.getByText('Sin snapshot')).toBeTruthy();
  });

  test('null receivable and opening render Sin datos, never $0', () => {
    render(<CxcCards kpis={makeKpis({ receivable: null, receivableOpening: null })} currency="usd" />);
    expect(screen.getAllByText('Sin datos').length).toBe(2);
    expect(document.body.textContent).not.toContain('$0');
  });
});
