import { describe, test, expect } from 'bun:test';
import { summarizeCompliance, visitCompliance } from '../../../lib/seguimiento/visit-compliance';

const asOf = '2026-10-14';

describe('visitCompliance', () => {
  test('within the interval is ok; exactly on the interval is still ok', () => {
    expect(visitCompliance({ lastInvoiceDate: '2026-10-12', intervalDays: 7, asOf }))
      .toEqual({ status: 'ok', daysSinceLastInvoice: 2, intervalDays: 7, daysOverdue: 0 });
    expect(visitCompliance({ lastInvoiceDate: '2026-10-07', intervalDays: 7, asOf }).status).toBe('ok');
  });
  test('one day past the interval is overdue by one', () => {
    expect(visitCompliance({ lastInvoiceDate: '2026-10-06', intervalDays: 7, asOf }))
      .toEqual({ status: 'overdue', daysSinceLastInvoice: 8, intervalDays: 7, daysOverdue: 1 });
  });
  test('a null, undefined, zero or NaN interval is never overdue and never 0 days', () => {
    for (const intervalDays of [null, undefined, 0, -3, NaN]) {
      const v = visitCompliance({ lastInvoiceDate: '2020-01-01', intervalDays, asOf });
      expect(v.status).toBe('no_interval');
      expect(v.intervalDays).toBeNull();
      expect(v.daysOverdue).toBeNull();
      expect(v.daysSinceLastInvoice).toBeGreaterThan(2000);
    }
  });
  test('a valid interval with no invoice is no_invoice', () => {
    expect(visitCompliance({ lastInvoiceDate: null, intervalDays: 15, asOf }))
      .toEqual({ status: 'no_invoice', daysSinceLastInvoice: null, intervalDays: 15, daysOverdue: null });
  });
  test('no interval and no invoice has no days at all', () => {
    expect(visitCompliance({ lastInvoiceDate: null, intervalDays: null, asOf }))
      .toEqual({ status: 'no_interval', daysSinceLastInvoice: null, intervalDays: null, daysOverdue: null });
  });
  test('a last invoice after asOf clamps to 0 days', () => {
    expect(visitCompliance({ lastInvoiceDate: '2026-10-20', intervalDays: 7, asOf }).daysSinceLastInvoice).toBe(0);
  });
});

describe('summarizeCompliance', () => {
  test('counts each status and computes the rate over ok + overdue only', () => {
    const items = [
      visitCompliance({ lastInvoiceDate: '2026-10-13', intervalDays: 7, asOf }),
      visitCompliance({ lastInvoiceDate: '2026-10-12', intervalDays: 7, asOf }),
      visitCompliance({ lastInvoiceDate: '2026-09-01', intervalDays: 7, asOf }),
      visitCompliance({ lastInvoiceDate: null, intervalDays: 7, asOf }),
      visitCompliance({ lastInvoiceDate: '2026-10-01', intervalDays: null, asOf }),
    ];
    expect(summarizeCompliance(items)).toEqual({ total: 5, ok: 2, overdue: 1, noInterval: 1, noInvoice: 1, complianceRate: 2 / 3 });
  });
  test('nobody has a frequency yet: rate is null, not 0', () => {
    const items = [visitCompliance({ lastInvoiceDate: '2026-10-01', intervalDays: null, asOf })];
    expect(summarizeCompliance(items).complianceRate).toBeNull();
    expect(summarizeCompliance([]).complianceRate).toBeNull();
  });
});
