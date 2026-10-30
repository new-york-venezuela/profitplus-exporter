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
    expect(screen.getByText('85')).toBeTruthy();
    expect(screen.getByText(/85\.0% del total/)).toBeTruthy();
    expect(screen.getAllByText(/Sin consignación/).length).toBe(3);
    expect(screen.getByText('7')).toBeTruthy();
  });

  test('Activos counts customer codes from the same set as Total, never legal entities', () => {
    // 150 legal entities (consignment included) must not leak into the share.
    render(<ClientesCards kpis={makeKpis({ customersTotal: 100, activeCustomerCodes: 100, activeCustomers: 150 })} />);
    expect(screen.getByText(/100\.0% del total/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('150');
  });

  test('zero total gives no percentage', () => {
    render(<ClientesCards kpis={makeKpis({ customersTotal: 0, activeCustomers: 0 })} />);
    expect(document.body.textContent).not.toContain('NaN');
  });
});
