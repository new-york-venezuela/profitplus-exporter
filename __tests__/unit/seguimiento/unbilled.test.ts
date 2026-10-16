import { describe, expect, test } from 'bun:test';
import { frequencyLabel, selectUnbilled } from '@/lib/seguimiento/unbilled';
import { visitCompliance } from '@/lib/seguimiento/visit-compliance';
import type { SeguimientoCustomer } from '@/lib/seguimiento/types';

const asOf = '2026-10-15';
function cust(name: string, lastInvoiceDate: string | null, intervalDays: number | null): SeguimientoCustomer {
  return {
    customerCode: name, customerName: name, salesRepName: null, routeLabel: null, groupLabel: null,
    sales: { bs: 0, usd: 0 }, units: 0, avgPrice: null, activeWeeks: [], mix: [], isNew: false, registeredDate: null,
    lastInvoiceDate, visit: visitCompliance({ lastInvoiceDate, intervalDays, asOf }),
  };
}

describe('selectUnbilled', () => {
  test('lists overdue by days overdue desc, never-bought last, counts no-frequency apart', () => {
    const r = selectUnbilled([
      cust('Al día', '2026-10-12', 7),
      cust('Poco', '2026-10-05', 7),
      cust('Mucho', '2026-09-01', 7),
      cust('Nunca', null, 15),
      cust('SinFrec', '2026-01-01', null),
    ]);
    expect(r.rows.map(x => x.customerName)).toEqual(['Mucho', 'Poco', 'Nunca']);
    expect(r.skippedNoFrequency).toBe(1);
    expect(r.withFrequency).toBe(4);
  });
  test('a customer exactly at its interval is not overdue', () => {
    expect(selectUnbilled([cust('Justo', '2026-10-08', 7)]).rows).toHaveLength(0);
  });
});

describe('frequencyLabel', () => {
  test('maps the three intervals', () => {
    expect([7, 15, 30, 10, null].map(frequencyLabel)).toEqual(['Semanal', 'Quincenal', 'Mensual', 'Cada 10 d', 'Sin frecuencia']);
  });
});
