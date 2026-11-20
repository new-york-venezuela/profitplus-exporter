import { describe, expect, test } from 'bun:test';
import { buildEstados } from '../estados';
import type { CoberturaResponse, CoberturaRowView } from '@/app/(app)/analitica/types';

const noVisit = { status: 'no_interval' as const, daysSinceLastInvoice: null, intervalDays: null, daysOverdue: null };
const base: CoberturaRowView = {
  customerCode: 'X', customerName: 'X', entityName: null, sellerCode: null, sellerName: null,
  lastSaleDateKey: null, entityLastSaleDateKey: null, lastSaleAtPeriodEndKey: null, daysSinceLastSale: null,
  avgMonthlyUsd: null, avgMonthlyUnits: null, monthsWithSales: 0, status: 'never',
  routeNumber: null, groupCode: null, groupName: null, kind: 'patrimonio', visit: noVisit, activeInPeriod: false,
  registeredDate: '2026-01-10', firstSaleDateKey: 20260110, daysToFirstSale: 0, salesPeriod: { bs: 0, usd: 0 },
  salesPrev: { bs: 0, usd: 0 }, boughtPrev: false, stickiness: 'sin_frecuencia',
};
const row = (over: Partial<CoberturaRowView>): CoberturaRowView => ({ ...base, ...over });
const response = (rows: CoberturaRowView[], over: Partial<CoberturaResponse> = {}): CoberturaResponse => ({
  rows, asOfDateKey: 20261120, windowStartDateKey: 20251121, lapsedAfterDays: 30, kindYear: 2026, prevPeriodAvailable: true,
  periodStartDateKey: 20261001, periodEndDateKey: 20261031, ...over,
});
const estadoOf = (r: ReturnType<typeof buildEstados>, code: string) => r.rows.find(x => x.customerCode === code)?.estado;

const FIXTURE = [
  row({ customerCode: 'NEW', activeInPeriod: true, firstSaleDateKey: 20261005, kind: 'nuevo', salesPeriod: { bs: 100, usd: 10 } }),
  row({ customerCode: 'KEEP', activeInPeriod: true, boughtPrev: true, salesPeriod: { bs: 200, usd: 20 }, salesPrev: { bs: 180, usd: 18 } }),
  row({ customerCode: 'BACK', activeInPeriod: true, boughtPrev: false }),
  row({ customerCode: 'COOL', activeInPeriod: false, boughtPrev: true, lastSaleDateKey: 20260920, lastSaleAtPeriodEndKey: 20260920, visit: { ...noVisit, intervalDays: 30 }, salesPrev: { bs: 50, usd: 5 } }),
  row({ customerCode: 'LOST', activeInPeriod: false, boughtPrev: true, lastSaleDateKey: 20260920, lastSaleAtPeriodEndKey: 20260920, visit: { ...noVisit, intervalDays: 7 } }),
  row({ customerCode: 'NEVER', firstSaleDateKey: null, lastSaleDateKey: null, activeInPeriod: false }),
  row({ customerCode: 'GONE', activeInPeriod: false, boughtPrev: false, lastSaleDateKey: 20260301 }),
  row({ customerCode: 'LATE', activeInPeriod: null, kind: 'posterior', firstSaleDateKey: null, registeredDate: '2027-01-02' }),
];

describe('buildEstados', () => {
  const r = buildEstados(response(FIXTURE));
  test('classifies each customer', () => {
    expect(estadoOf(r, 'NEW')).toBe('nuevo_periodo');
    expect(estadoOf(r, 'KEEP')).toBe('retenido');
    expect(estadoOf(r, 'BACK')).toBe('recuperado');
    expect(estadoOf(r, 'COOL')).toBe('enfriado');
    expect(estadoOf(r, 'LOST')).toBe('perdido');
    expect(estadoOf(r, 'NEVER')).toBe('sin_ventas');
  });
  test('customers silent in both periods are not listed; a customer registered after the range end is not either', () => {
    expect(r.rows.map(x => x.customerCode)).not.toContain('GONE');
    expect(r.rows.map(x => x.customerCode)).not.toContain('LATE');
  });
  test('the bridge reconciles base and actual', () => {
    expect(r.bridge).toEqual({ base: 3, enfriados: 1, perdidos: 1, nuevos: 1, recuperados: 1, actual: 3 });
    expect(r.available).toBe(true);
    expect(r.referenceYear).toBe(2026);
  });
  test('reason date: first invoice for nuevo, last invoice for enfriado and perdido', () => {
    const by = (c: string) => r.rows.find(x => x.customerCode === c)!;
    expect(by('NEW').reasonDateKey).toBe(20261005);
    expect(by('COOL').reasonDateKey).toBe(20260920);
    expect(by('KEEP').reasonDateKey).toBeNull();
  });
  test('judges perdido by the last invoice on or before the period end, not by a later purchase', () => {
    const back = row({
      customerCode: 'BACK2', activeInPeriod: false, boughtPrev: true, lastSaleDateKey: 20261110, lastSaleAtPeriodEndKey: 20260920,
      visit: { ...noVisit, intervalDays: 7 },
    });
    const out = buildEstados(response([back]));
    expect(out.rows[0].estado).toBe('perdido');
    expect(out.rows[0].reasonDateKey).toBe(20260920);   // never a date after the period
  });
  test('keeps origen and the sales figures untouched (null USD stays null)', () => {
    const out = buildEstados(response([row({ customerCode: 'Z', activeInPeriod: true, boughtPrev: true, kind: 'nuevo', salesPeriod: { bs: 5, usd: null } })]));
    expect(out.rows[0].origen).toBe('nuevo');
    expect(out.rows[0].salesPeriod).toEqual({ bs: 5, usd: null });
  });
  test('without a previous period only nuevo_periodo and sin_ventas can be told', () => {
    const none = buildEstados(response(FIXTURE, { prevPeriodAvailable: false }));
    expect(none.available).toBe(false);
    expect(none.rows.map(x => x.estado).sort()).toEqual(['nuevo_periodo', 'sin_ventas']);
    expect(none.bridge).toEqual({ base: 0, enfriados: 0, perdidos: 0, nuevos: 1, recuperados: 0, actual: 1 });
  });
});
