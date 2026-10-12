import { describe, test, expect } from 'bun:test';
import { buildSeguimiento, rootOf } from '../../../lib/seguimiento/aggregate';
import { parseRootKind } from '../../../lib/seguimiento/types';
import { FIXTURE_CUSTOMERS, fixtureInput } from './fixture';

describe('parseRootKind / rootOf', () => {
  test('unknown kinds fall back to vendedor', () => {
    expect(parseRootKind('ruta')).toBe('ruta');
    expect(parseRootKind('grupo')).toBe('grupo');
    expect(parseRootKind('x')).toBe('vendedor');
    expect(parseRootKind(null)).toBe('vendedor');
  });
  test('roots for customers without seller, route or group', () => {
    const blank = { salesRepKey: null, salesRepName: null, zoneCode: 'CCS', routeNumber: null, segmentCode: null, segmentName: null };
    expect(rootOf('vendedor', blank)).toEqual({ value: 'sin-vendedor', label: 'Sin vendedor' });
    expect(rootOf('ruta', blank)).toEqual({ value: 'sin-ruta', label: 'Sin ruta' });      // 'CCS' is a region, not a route
    expect(rootOf('grupo', blank)).toEqual({ value: 'sin-grupo', label: 'Sin grupo' });
  });
});

describe('buildSeguimiento: vendedor roots', () => {
  const out = buildSeguimiento(fixtureInput('vendedor'));
  const ana = out.roots.find(r => r.label === 'Ana')!;
  const beto = out.roots.find(r => r.label === 'Beto')!;

  test('pace, weeks and visible lines', () => {
    expect(out.pace).toMatchObject({ workingDaysInMonth: 22, workingDaysElapsed: 10 });
    expect(out.weeks.map(w => [w.yearWeek, w.isFuture])).toEqual([
      ['2026-W40', false], ['2026-W41', false], ['2026-W42', false], ['2026-W43', true], ['2026-W44', true],
    ]);
    expect(out.visibleLines).toEqual(['Panaderia', 'Pizza', 'Pasteleria']); // consignment sales do not rank lines
  });

  test('roots are sorted by sales (Bs) desc', () => {
    expect(out.roots.map(r => r.label)).toEqual(['Ana', 'Beto']);
  });

  test('Ana: sales, units, average price, quota, attainment and projection', () => {
    expect(ana.customerCount).toBe(2);
    expect(ana.sales).toEqual({ bs: 3500, usd: 70 });
    expect(ana.units).toBe(35);
    expect(ana.avgPrice).toEqual({ bs: 100, usd: 2 });
    expect(ana.salesQuotaUsd).toBe(100);
    expect(ana.attainment).toBeCloseTo(0.7, 10);
    expect(ana.projected!.usd).toBeCloseTo(154, 10);
    expect(ana.projectedAttainment).toBeCloseTo(1.54, 10);
    expect(ana.quotaShared).toBe(false);
    expect(ana.salesRepKey).toBe('1');
    expect(ana.targets).toEqual({ salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: 1 });
  });

  test('Ana: weekly activation counts customers with an invoice that ISO week; future weeks have no pct', () => {
    expect(ana.weeks).toEqual([
      { yearWeek: '2026-W40', active: 0, assigned: 2, pct: 0 },
      { yearWeek: '2026-W41', active: 2, assigned: 2, pct: 1 },
      { yearWeek: '2026-W42', active: 1, assigned: 2, pct: 0.5 },
      { yearWeek: '2026-W43', active: 0, assigned: 2, pct: null },
      { yearWeek: '2026-W44', active: 0, assigned: 2, pct: null },
    ]);
  });

  test('Ana: category mix, new customers and visit compliance', () => {
    expect(ana.mix.map(m => [m.line, Number(m.share.toFixed(4))])).toEqual([['Panaderia', 0.8571], ['Pizza', 0.1429]]);
    expect(ana.newCustomers).toEqual({ count: 1, quota: 1, partial: false });     // C1 registered in October; C2 is the migration batch
    expect(ana.compliance).toMatchObject({ total: 2, ok: 1, overdue: 1, complianceRate: 0.5 });
  });

  test('Ana customers: sorted by sales, flags and visit status', () => {
    expect(ana.customers.map(c => c.customerCode)).toEqual(['C2', 'C1']);
    const c1 = ana.customers.find(c => c.customerCode === 'C1')!;
    expect(c1).toMatchObject({ isNew: true, routeLabel: 'Ruta 3', groupLabel: 'Abasto', activeWeeks: ['2026-W41', '2026-W42'] });
    expect(c1.visit.status).toBe('ok');
    expect(ana.customers.find(c => c.customerCode === 'C2')!.visit).toMatchObject({ status: 'overdue', daysOverdue: 17 });
  });

  test('Beto: consignment root sales are excluded, inactive customers do not count, no frequency means no overdue', () => {
    expect(beto.customerCount).toBe(1);                       // C3 only (C4 consignment, C5 inactive)
    expect(beto.sales).toEqual({ bs: 400, usd: 8 });
    expect(beto.excludedSales).toEqual({ bs: 9000, usd: 180 });
    expect(beto.customers.map(c => c.customerCode)).toEqual(['C3']);
    expect(beto.attainment).toBeCloseTo(0.16, 10);
    expect(beto.compliance).toMatchObject({ noInterval: 1, overdue: 0, complianceRate: null });
    expect(beto.newCustomers).toEqual({ count: 0, quota: null, partial: false });
    expect(beto.weeks[1]).toMatchObject({ assigned: 1, active: 0 });       // C4's W41 invoice is not C3's
  });

  test('total counts every customer once and sums quotas over distinct sellers', () => {
    expect(out.total.customerCount).toBe(3);
    expect(out.total.sales).toEqual({ bs: 3900, usd: 78 });
    expect(out.total.excludedSales).toEqual({ bs: 9000, usd: 180 });
    expect(out.total.salesQuotaUsd).toBe(150);
    expect(out.total.weeks[1]).toMatchObject({ active: 2, assigned: 3 });
    expect(out.total.newCustomers).toEqual({ count: 1, quota: 1, partial: true });
    expect(out.total.compliance).toMatchObject({ total: 3, ok: 1, overdue: 1, noInterval: 1 });
  });
});

describe('buildSeguimiento: route and group roots', () => {
  test('route roots follow the customer\'s current zone and label Ruta N', () => {
    const out = buildSeguimiento(fixtureInput('ruta'));
    expect(out.roots.map(r => [r.value, r.label, r.customerCount])).toEqual([['CCS003', 'Ruta 3', 2], ['CCS004', 'Ruta 4', 1]]);
    expect(out.roots.every(r => r.salesRepKey === null && r.targets === null)).toBe(true);
    expect(out.roots[1].excludedSales).toEqual({ bs: 9000, usd: 180 });
  });

  test('a seller serving two routes marks both route quotas as shared', () => {
    const extra = { ...FIXTURE_CUSTOMERS[0], customerCode: 'C6', customerName: 'Otro', zoneCode: 'CCS004', routeNumber: 4, registeredDate: '2020-01-01' };
    const input = fixtureInput('ruta');
    const out = buildSeguimiento({ ...input, customers: [...input.customers, extra] });
    expect(out.roots.map(r => r.quotaShared)).toEqual([true, true]);
    expect(out.roots[1].salesQuotaUsd).toBe(150);           // sellers 2 and 1
    expect(out.total.salesQuotaUsd).toBe(150);              // total never double counts
  });

  test('group roots use the ERP segment', () => {
    const out = buildSeguimiento(fixtureInput('grupo'));
    expect(out.roots.map(r => [r.label, r.customerCount])).toEqual([['Abasto', 2], ['Restaurante', 1]]);
    expect(out.roots[0].salesQuotaUsd).toBe(100);
  });
});

describe('buildSeguimiento: degenerate input', () => {
  test('no data: empty roots, zero total, no NaN', () => {
    const out = buildSeguimiento({ ...fixtureInput('vendedor'), customers: [], lineSales: [], weekActivity: [], consignmentRootCodes: [] });
    expect(out.roots).toEqual([]);
    expect(out.total).toMatchObject({ customerCount: 0, sales: { bs: 0, usd: 0 }, avgPrice: null, attainment: null, mix: [] });
    expect(out.total.weeks.every(w => w.pct === null)).toBe(true);
  });

  test('usd null (no exchange rate) keeps usd null: no attainment, no projection usd', () => {
    const input = fixtureInput('vendedor');
    const lineSales = input.lineSales.map(l => ({ ...l, sales: { bs: l.sales.bs, usd: null } }));
    const ana = buildSeguimiento({ ...input, lineSales }).roots.find(r => r.label === 'Ana')!;
    expect(ana.sales.usd).toBeNull();
    expect(ana.attainment).toBeNull();
    expect(ana.projected!.usd).toBeNull();
    expect(ana.projectedAttainment).toBeNull();
    expect(ana.avgPrice!.usd).toBeNull();
  });

  test('a zero quota is treated as no goal (no division by zero)', () => {
    const input = fixtureInput('vendedor');
    const targets = new Map(input.targets).set('1', { salesQuotaUsd: 0, weeklyVisitQuota: null, newCustomerQuota: null });
    const ana = buildSeguimiento({ ...input, targets }).roots.find(r => r.label === 'Ana')!;
    expect(ana.salesQuotaUsd).toBe(0);
    expect(ana.attainment).toBeNull();
    expect(ana.projectedAttainment).toBeNull();
  });

  test('asOf before the month (and before its first ISO week): nothing elapsed, projection null, every week is future', () => {
    const ana = buildSeguimiento({ ...fixtureInput('vendedor'), asOf: '2026-09-27' }).roots.find(r => r.label === 'Ana')!;
    expect(ana.projected).toBeNull();
    expect(ana.weeks.every(w => w.pct === null)).toBe(true);
  });
});

describe('buildSeguimiento: weekly activation keys (review carry-forward)', () => {
  test('week keys use the Dim_Date.YearWeek format and the month\'s first ISO week starts before the 1st', () => {
    const out = buildSeguimiento(fixtureInput('vendedor'));
    expect(out.weeks.every(w => /^\d{4}-W\d{2}$/.test(w.yearWeek))).toBe(true);
    expect(out.weeks[0]).toMatchObject({ yearWeek: '2026-W40', weekStart: '2026-09-28', weekEnd: '2026-10-04' });
  });

  test('an invoice in the first ISO week before the 1st (W40) makes the customer active that week', () => {
    const input = fixtureInput('vendedor');
    const weekActivity = [...input.weekActivity, { customerCode: 'C2', yearWeek: '2026-W40' }];
    const ana = buildSeguimiento({ ...input, weekActivity }).roots.find(r => r.label === 'Ana')!;
    expect(ana.weeks[0]).toEqual({ yearWeek: '2026-W40', active: 1, assigned: 2, pct: 0.5 });
  });

  test('activity in weeks outside the month, or from unknown/inactive customers, is ignored', () => {
    const input = fixtureInput('vendedor');
    const weekActivity = [
      ...input.weekActivity,
      { customerCode: 'C1', yearWeek: '2026-W39' },   // not a week of October
      { customerCode: 'ZZ', yearWeek: '2026-W40' },   // not in the customer list
      { customerCode: 'C5', yearWeek: '2026-W40' },   // inactive: not assigned
    ];
    const out = buildSeguimiento({ ...input, weekActivity });
    expect(out.total.weeks[0]).toMatchObject({ active: 0, assigned: 3 });
    expect(out.roots.find(r => r.label === 'Ana')!.customers.find(c => c.customerCode === 'C1')!.activeWeeks)
      .toEqual(['2026-W41', '2026-W42']);
  });
});
