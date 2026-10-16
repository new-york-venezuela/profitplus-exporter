import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnbilledSection } from '../seguimiento/unbilled-section';
import { visitCompliance } from '@/lib/seguimiento/visit-compliance';
import type { SeguimientoCustomer } from '@/lib/seguimiento/types';

afterEach(cleanup);
const asOf = '2026-10-15';
function cust(name: string, lastInvoiceDate: string | null, intervalDays: number | null): SeguimientoCustomer {
  return {
    customerCode: name, customerName: name, salesRepName: null, routeLabel: 'Ruta 3', groupLabel: null,
    sales: { bs: 0, usd: 0 }, units: 0, avgPrice: null, activeWeeks: [], mix: [], isNew: false, registeredDate: null,
    lastInvoiceDate, visit: visitCompliance({ lastInvoiceDate, intervalDays, asOf }),
  };
}

describe('UnbilledSection', () => {
  test('summarises, lists cards and the print table with the same customers, and counts skipped', () => {
    render(<UnbilledSection asOf={asOf} customers={[
      cust('Mucho', '2026-09-01', 7), cust('Al día', '2026-10-13', 7), cust('Nunca', null, 30), cust('SinFrec', '2026-01-01', null),
    ]} />);
    expect(screen.getByRole('status').textContent).toContain('2 de 3 clientes con frecuencia');
    const section = screen.getByRole('region', { name: 'Clientes sin facturar' });
    const cards = within(section).getAllByRole('listitem');
    expect(cards.map(li => li.textContent)).toEqual([
      expect.stringContaining('Mucho'), expect.stringContaining('Nunca'),
    ]);
    expect(cards[0].textContent).toContain('hace 44 d');
    expect(cards[0].textContent).toContain('Vencido +37 d');
    expect(cards[1].textContent).toContain('Nunca ha comprado');
    const printed = within(section).getAllByRole('row', { hidden: true }).slice(1).map(r => r.textContent);
    expect(printed).toHaveLength(2);
    expect(section.textContent).toContain('1 cliente sin frecuencia de visita no se evalúan');
  });

  test('collapses to 10 cards and expands on demand', async () => {
    const many = Array.from({ length: 12 }, (_, i) => cust(`C${String(i).padStart(2, '0')}`, '2026-09-01', 7));
    render(<UnbilledSection asOf={asOf} customers={many} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    await userEvent.click(screen.getByRole('button', { name: 'Ver los 12' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(12);
  });

  test('empty state', () => {
    render(<UnbilledSection asOf={asOf} customers={[cust('Ok', '2026-10-14', 7)]} />);
    expect(screen.getByRole('status').textContent).toContain('Todos los clientes con frecuencia facturaron');
  });
});

describe('CustomersPrintTable', () => {
  test('one row per customer with visit status text and active weeks', async () => {
    const { CustomersPrintTable } = await import('../seguimiento/customers-print-table');
    const c = { ...cust('Mucho', '2026-09-01', 7), activeWeeks: ['2026-W40', '2026-W41'], isNew: true };
    const headers = [
      { yearWeek: '2026-W40', weekStart: '', weekEnd: '', label: '', isFuture: false },
      { yearWeek: '2026-W41', weekStart: '', weekEnd: '', label: '', isFuture: false },
      { yearWeek: '2026-W42', weekStart: '', weekEnd: '', label: '', isFuture: true },
    ];
    render(<CustomersPrintTable customers={[c, cust('Ok', '2026-10-14', 7)]} headers={headers} currency="usd" />);
    const rows = screen.getAllByRole('row', { hidden: true }).slice(1).map(r => r.textContent ?? '');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Mucho (nuevo)');
    expect(rows[0]).toContain('2/2');
    expect(rows[0]).toContain('Vencida +37 d');
    expect(rows[1]).toContain('Al día');
  });
});
