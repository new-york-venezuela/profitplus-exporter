import { describe, expect, test } from 'bun:test';
import { buildGrupoRows } from '../grupos';
import type { CoberturaRowView } from '@/app/(app)/analitica/types';

const noVisit = { status: 'no_interval' as const, daysSinceLastInvoice: null, intervalDays: null, daysOverdue: null };
const base: CoberturaRowView = {
  customerCode: 'X', customerName: 'X', entityName: null, sellerCode: null, sellerName: null,
  lastSaleDateKey: null, entityLastSaleDateKey: null, daysSinceLastSale: null,
  avgMonthlyUsd: null, avgMonthlyUnits: null, monthsWithSales: 0, status: 'never',
  routeNumber: 1, groupCode: 'S1', groupName: 'Abasto', kind: 'patrimonio', visit: noVisit, activeInPeriod: false,
  registeredDate: '2026-01-10', firstSaleDateKey: 20260110, daysToFirstSale: 0, salesPeriod: { bs: 0, usd: 0 },
  salesPrev: { bs: 0, usd: 0 }, boughtPrev: false, stickiness: 'sin_frecuencia',
};
const row = (over: Partial<CoberturaRowView>): CoberturaRowView => ({ ...base, ...over });
const m = (bs: number, usd: number | null) => ({ bs, usd });
const NONE = { grupo: null, ruta: null, origen: 'todos' as const };

const ROWS = [
  row({ customerCode: 'A1', groupCode: 'S1', groupName: 'Abasto', routeNumber: 1, activeInPeriod: true, boughtPrev: true, kind: 'patrimonio', salesPeriod: m(300, 30), salesPrev: m(200, 20) }),
  row({ customerCode: 'A2', groupCode: 'S1', groupName: 'Abasto', routeNumber: 2, activeInPeriod: true, boughtPrev: false, kind: 'nuevo', salesPeriod: m(100, 10), salesPrev: m(0, 0) }),
  row({ customerCode: 'A3', groupCode: 'S1', groupName: 'Abasto', routeNumber: 1, activeInPeriod: false, boughtPrev: true, kind: 'patrimonio', salesPeriod: m(0, 0), salesPrev: m(100, 10) }),
  row({ customerCode: 'R1', groupCode: 'S2', groupName: 'Restaurante', routeNumber: 1, activeInPeriod: true, boughtPrev: true, kind: 'patrimonio', salesPeriod: m(600, 60), salesPrev: m(700, 70) }),
  row({ customerCode: 'U1', groupCode: null, groupName: null, routeNumber: null, activeInPeriod: true, boughtPrev: false, kind: 'nuevo', salesPeriod: m(0, 0), salesPrev: m(0, 0) }),
];
const by = (rows: ReturnType<typeof buildGrupoRows>, key: string) => rows.find(r => r.key === key)!;

describe('buildGrupoRows', () => {
  test('groups by grupo with sales, activos and the patrimonio / nuevos split', () => {
    const out = buildGrupoRows(ROWS, 'grupo', NONE, 'usd', true);
    expect(out.map(r => r.key)).toEqual(['S2', 'S1', '']);   // sales descending, "Sin grupo" included
    expect(by(out, 'S1')).toMatchObject({ name: 'Abasto', activos: 2, patrimonio: 1, nuevos: 1, activosPrev: 2 });
    expect(by(out, 'S1').sales).toEqual(m(400, 40));
    expect(by(out, 'S1').salesPrev).toEqual(m(300, 30));
    expect(by(out, '').name).toBe('Sin grupo');
  });

  test('by grupo ignores the grupo filter but applies ruta', () => {
    const out = buildGrupoRows(ROWS, 'grupo', { ...NONE, grupo: 'S2', ruta: 2 }, 'usd', true);
    expect(out.map(r => r.key)).toEqual(['S1']);
    expect(out[0].activos).toBe(1);
  });

  test('by ruta ignores the ruta filter but applies grupo', () => {
    const out = buildGrupoRows(ROWS, 'ruta', { ...NONE, grupo: 'S1', ruta: 99 }, 'usd', true);
    expect(out.map(r => r.name).sort()).toEqual(['Ruta 1', 'Ruta 2']);
    expect(out.find(r => r.name === 'Ruta 1')!.sales).toEqual(m(300, 30));
  });

  test('origen narrows every row', () => {
    const out = buildGrupoRows(ROWS, 'grupo', { ...NONE, origen: 'nuevo' }, 'usd', true);
    expect(by(out, 'S1')).toMatchObject({ activos: 1, nuevos: 1, patrimonio: 0 });
    expect(out.find(r => r.key === 'S2')).toBeUndefined();
  });

  test('share of total is in the active currency and sums to 1', () => {
    const out = buildGrupoRows(ROWS, 'grupo', NONE, 'usd', true);
    expect(by(out, 'S2').shareOfTotal).toBeCloseTo(0.6);
    expect(out.reduce((s, r) => s + (r.shareOfTotal ?? 0), 0)).toBeCloseTo(1);
  });

  test('a null USD makes the share null (never a partial total)', () => {
    const out = buildGrupoRows([row({ customerCode: 'Q', salesPeriod: m(5, null) }), ...ROWS], 'grupo', NONE, 'usd', true);
    expect(out.every(r => r.shareOfTotal === null)).toBe(true);
    expect(buildGrupoRows([row({ customerCode: 'Q', salesPeriod: m(5, null) }), ...ROWS], 'grupo', NONE, 'bs', true)[0].shareOfTotal).not.toBeNull();
  });

  test('churn is the share of last period buyers that did not buy now; null without a previous period', () => {
    expect(by(buildGrupoRows(ROWS, 'grupo', NONE, 'usd', true), 'S1').churnRate).toBeCloseTo(0.5);   // A3 of A1+A3
    const none = buildGrupoRows(ROWS, 'grupo', NONE, 'usd', false);
    expect(none.every(r => r.churnRate === null && r.salesPrev === null && r.activosPrev === null)).toBe(true);
  });

  test('a scope that matches nobody returns no rows (no NaN)', () => {
    expect(buildGrupoRows(ROWS, 'grupo', { ...NONE, ruta: 77 }, 'usd', true)).toEqual([]);
  });
});
