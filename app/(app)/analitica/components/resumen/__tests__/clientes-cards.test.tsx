import { screen } from '../../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { makeKpis } from './fixtures';

const { ClientesCards } = await import('../clientes-cards');
afterEach(cleanup);

describe('ClientesCards', () => {
  test('total, activos with % of total, nuevos', () => {
    render(<ClientesCards kpis={makeKpis()} />);
    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getByText('Activos')).toBeTruthy();
    expect(screen.getByText('Nuevos')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByText('90')).toBeTruthy();
    expect(screen.getByText(/90\.0% del total/)).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
  });

  test('zero total gives no percentage', () => {
    render(<ClientesCards kpis={makeKpis({ customersTotal: 0, activeCustomers: 0 })} />);
    expect(document.body.textContent).not.toContain('NaN');
  });
});
