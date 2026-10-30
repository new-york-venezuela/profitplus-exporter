import { screen } from '../../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, within } from '@testing-library/react';
import { visitCompliance } from '@/lib/seguimiento/visit-compliance';
import type { SeguimientoCustomer } from '@/lib/seguimiento/types';
import { NewCustomersTable } from '../new-customers-section';

afterEach(cleanup);

const nuevo: SeguimientoCustomer = {
  customerCode: 'N1', customerName: 'Cliente Nuevo', salesRepName: null, routeLabel: 'Ruta 3', groupLabel: null,
  sales: { bs: 5000, usd: 100 }, units: 20, returns: { bs: 1000, usd: 20 }, returnUnits: 4, net: { bs: 4000, usd: 80 },
  avgPrice: null, activeWeeks: [], mix: [], isNew: true, registeredDate: '2026-10-02', lastInvoiceDate: '2026-10-10',
  visit: visitCompliance({ lastInvoiceDate: '2026-10-10', intervalDays: 7, asOf: '2026-10-14' }),
};

describe('NewCustomersTable', () => {
  test('amount="net" shows each new customer with its net sales', () => {
    render(<NewCustomersTable customers={[nuevo]} currency="usd" monthLabel="octubre 2026" amount="net" />);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Ventas netas' })).toBeTruthy();
    expect(within(table).getByText('$80')).toBeTruthy();
    expect(within(table).queryByText('$100')).toBeNull();
    expect(within(table).getByRole('columnheader', { name: 'Unidades netas' })).toBeTruthy();
    expect(within(table).getByText('16')).toBeTruthy();
  });

  test('default keeps brutas (seller profile behaviour unchanged)', () => {
    render(<NewCustomersTable customers={[nuevo]} currency="usd" monthLabel="octubre 2026" />);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Ventas' })).toBeTruthy();
    expect(within(table).getByText('$100')).toBeTruthy();
  });
});
