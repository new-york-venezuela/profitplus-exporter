import { describe, test, expect } from 'bun:test';
import { KIND_LABEL, dateKeyToIso, enrichCartera, periodActivity, summarizeCartera, visitLabel } from '../cartera';

const base = { visitIntervalDays: 7, registeredDate: '2025-01-10', todayKey: 20261014, kindYear: 2026 };

describe('dateKeyToIso', () => {
  test('formats a YYYYMMDD key', () => expect(dateKeyToIso(20261014)).toBe('2026-10-14'));
});

describe('enrichCartera', () => {
  test('overdue when days since last sale exceed the interval', () => {
    const { visit } = enrichCartera({ ...base, lastSaleDateKey: 20261001 });
    expect(visit).toMatchObject({ status: 'overdue', daysSinceLastInvoice: 13, intervalDays: 7, daysOverdue: 6 });
  });
  test('a NULL frequency is never overdue, however old the last sale', () => {
    const { visit } = enrichCartera({ ...base, visitIntervalDays: null, lastSaleDateKey: 20200101 });
    expect(visit.status).toBe('no_interval');
    expect(visit.daysOverdue).toBeNull();
  });
  test('a frequency but no invoice is no_invoice', () => {
    expect(enrichCartera({ ...base, lastSaleDateKey: null }).visit.status).toBe('no_invoice');
  });
  test('kind: registered before the year or in the cutover batch is patrimonio; later in the year is nuevo', () => {
    expect(enrichCartera({ ...base, lastSaleDateKey: null, registeredDate: '2025-12-31' }).kind).toBe('patrimonio');
    expect(enrichCartera({ ...base, lastSaleDateKey: null, registeredDate: '2026-03-28' }).kind).toBe('patrimonio');
    expect(enrichCartera({ ...base, lastSaleDateKey: null, registeredDate: '2026-04-01' }).kind).toBe('nuevo');
  });
  test('kind is null for a missing or malformed date, never a throw', () => {
    expect(enrichCartera({ ...base, lastSaleDateKey: null, registeredDate: null }).kind).toBeNull();
    expect(enrichCartera({ ...base, lastSaleDateKey: null, registeredDate: '28/03/2026' }).kind).toBeNull();
  });
});

describe('visitLabel / KIND_LABEL', () => {
  test('labels', () => {
    expect(visitLabel(enrichCartera({ ...base, visitIntervalDays: null, lastSaleDateKey: 20261001 }).visit)).toBe('Sin frecuencia');
    expect(visitLabel(enrichCartera({ ...base, lastSaleDateKey: null }).visit)).toBe('Sin facturas');
    expect(visitLabel(enrichCartera({ ...base, lastSaleDateKey: 20261001 }).visit)).toBe('Vencida +6 d');
    expect(visitLabel(enrichCartera({ ...base, lastSaleDateKey: 20261012 }).visit)).toBe('Al día (2 de 7 d)');
    expect(KIND_LABEL.patrimonio).toBe('Patrimonio');
    expect(KIND_LABEL.nuevo).toBe('Nuevo');
  });
});

describe('summarizeCartera', () => {
  const row = (lastSaleDateKey: number | null, visitIntervalDays: number | null, kind: 'nuevo' | 'patrimonio' | null, activeInPeriod: boolean | null) =>
    ({ visit: enrichCartera({ ...base, lastSaleDateKey, visitIntervalDays }).visit, kind, activeInPeriod });
  test('counts compliance, inactive in period and kinds', () => {
    const s = summarizeCartera([
      row(20261001, 7, 'patrimonio', true),   // overdue
      row(20261012, 7, 'nuevo', true),        // ok
      row(20261012, null, 'nuevo', false),    // no interval
      row(null, 7, null, false),              // no invoice
    ]);
    expect(s.compliance).toMatchObject({ total: 4, ok: 1, overdue: 1, noInterval: 1, noInvoice: 1, complianceRate: 0.5 });
    expect(s.inactiveInPeriod).toBe(2);
    expect(s.nuevos).toBe(2);
    expect(s.patrimonio).toBe(1);
  });
  test('nobody has a frequency yet: rate is null and nobody is overdue', () => {
    const s = summarizeCartera([row(20200101, null, 'patrimonio', true), row(null, null, null, false)]);
    expect(s.compliance.overdue).toBe(0);
    expect(s.compliance.complianceRate).toBeNull();
  });
  test('a customer registered after the period (activeInPeriod null) is not counted as inactive in the period', () => {
    expect(summarizeCartera([row(null, 7, 'nuevo', null), row(null, 7, 'patrimonio', false)]).inactiveInPeriod).toBe(1);
  });
  test('empty list', () => {
    expect(summarizeCartera([])).toMatchObject({ inactiveInPeriod: 0, nuevos: 0, patrimonio: 0 });
  });
});

describe('periodActivity', () => {
  test('bought in the period is true regardless of registration', () => {
    expect(periodActivity({ inPeriod: true, registeredDate: '2026-11-05', periodEndKey: 20261031 })).toBe(true);
  });
  test('no purchase and registered on or before the period end is false (inactive in the period)', () => {
    expect(periodActivity({ inPeriod: false, registeredDate: '2026-10-31', periodEndKey: 20261031 })).toBe(false);
    expect(periodActivity({ inPeriod: false, registeredDate: '2020-01-01', periodEndKey: 20261031 })).toBe(false);
  });
  test('no purchase but registered after the period end is null (not applicable)', () => {
    expect(periodActivity({ inPeriod: false, registeredDate: '2026-11-01', periodEndKey: 20261031 })).toBeNull();
  });
  test('a missing or malformed registration date keeps the customer in (false)', () => {
    expect(periodActivity({ inPeriod: false, registeredDate: null, periodEndKey: 20261031 })).toBe(false);
    expect(periodActivity({ inPeriod: false, registeredDate: '01/11/2026', periodEndKey: 20261031 })).toBe(false);
  });
});
