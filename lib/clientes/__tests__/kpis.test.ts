import { describe, expect, test } from 'bun:test';
import { buildKpis } from '../kpis';
import { buildEstados } from '../estados';
import type { TrayectoriaRow } from '../trayectoria';
import type { CoberturaResponse, CoberturaRowView } from '@/app/(app)/analitica/types';

const noVisit = { status: 'no_interval' as const, daysSinceLastInvoice: null, intervalDays: null, daysOverdue: null };
const base: CoberturaRowView = {
  customerCode: 'X', customerName: 'X', entityName: null, sellerCode: null, sellerName: null,
  lastSaleDateKey: null, entityLastSaleDateKey: null, daysSinceLastSale: null,
  avgMonthlyUsd: null, avgMonthlyUnits: null, monthsWithSales: 0, status: 'never',
  routeNumber: null, groupCode: null, groupName: null, kind: 'patrimonio', visit: noVisit, activeInPeriod: false,
  registeredDate: '2026-01-10', firstSaleDateKey: 20260110, daysToFirstSale: 0, salesPeriod: { bs: 0, usd: 0 },
  salesPrev: { bs: 0, usd: 0 }, boughtPrev: false, stickiness: 'sin_frecuencia',
};
const row = (over: Partial<CoberturaRowView>): CoberturaRowView => ({ ...base, ...over });
const cobertura = (rows: CoberturaRowView[], over: Partial<CoberturaResponse> = {}): CoberturaResponse => ({
  rows, asOfDateKey: 20261120, windowStartDateKey: 20251121, lapsedAfterDays: 30, kindYear: 2026, prevPeriodAvailable: true,
  periodStartDateKey: 20261001, periodEndDateKey: 20261031, ...over,
});
const trow = (key: string, sales: { bs: number; usd: number | null }, salesPrev: { bs: number; usd: number | null } | null, kind: 'entidad' | 'tienda' = 'entidad'): TrayectoriaRow => ({
  key, filterKey: key, parentKey: kind === 'entidad' ? null : 'e:1', kind, name: key, code: null, storeCount: 1, sales, salesPrev,
  units: 0, unitsPrev: null, orders: 0, lastOrderKey: null, newStoresCount: 0,
});

const ROWS = [
  row({ customerCode: 'KEEP', activeInPeriod: true, boughtPrev: true, kind: 'patrimonio', stickiness: 'constante' }),
  row({ customerCode: 'COOL', activeInPeriod: false, boughtPrev: true, lastSaleDateKey: 20260920, kind: 'patrimonio', visit: { ...noVisit, intervalDays: 30 } }),
  row({ customerCode: 'LOST', activeInPeriod: false, boughtPrev: true, lastSaleDateKey: 20260920, kind: 'patrimonio', visit: { ...noVisit, intervalDays: 7 } }),
  row({ customerCode: 'NEW', activeInPeriod: true, kind: 'nuevo', firstSaleDateKey: 20261005, lastSaleDateKey: 20261005, stickiness: 'constante' }),
];
const kpi = (cards: ReturnType<typeof buildKpis>, id: string) => cards.find(c => c.id === id)!;

describe('buildKpis', () => {
  const resp = cobertura(ROWS);
  const cards = buildKpis({
    cobertura: resp,
    estados: buildEstados(resp),
    trayectoria: [trow('e:1', { bs: 100, usd: 10 }, { bs: 80, usd: 8 }), trow('t:A', { bs: 100, usd: 10 }, { bs: 80, usd: 8 }, 'tienda')],
    currency: 'usd',
  });

  test('returns the five cards in order', () => {
    expect(cards.map(c => c.id)).toEqual(['ventas', 'activos', 'patrimonio', 'nuevos', 'perdidos']);
  });
  test('ventas sums only chain rows in the active currency (stores are not double counted)', () => {
    expect(kpi(cards, 'ventas')).toMatchObject({ current: 10, previous: 8, value: '$10' });
  });
  test('ventas is null when any chain USD is unknown (never a partial total)', () => {
    const c = buildKpis({ cobertura: resp, estados: buildEstados(resp), trayectoria: [trow('e:1', { bs: 5, usd: null }, { bs: 1, usd: 1 })], currency: 'usd' });
    expect(kpi(c, 'ventas')).toMatchObject({ current: null, value: '—' });
  });
  test('ventas has no previous without a previous period', () => {
    const c = buildKpis({ cobertura: resp, estados: buildEstados(resp), trayectoria: [trow('e:1', { bs: 100, usd: 10 }, null)], currency: 'usd' });
    expect(kpi(c, 'ventas').previous).toBeNull();
  });
  test('activos counts customers that bought in the period; previous those that bought before', () => {
    expect(kpi(cards, 'activos')).toMatchObject({ current: 2, previous: 3 });
  });
  test('perdidos equals enfriados + perdidos of the bridge', () => {
    expect(kpi(cards, 'perdidos')).toMatchObject({ current: 2, value: '2' });
    expect(kpi(cards, 'perdidos').hint).toContain('1 enfriados');
    expect(kpi(cards, 'perdidos').hint).toContain('1 perdidos');
  });
  test('patrimonio shows the retained share of the previous buyers', () => {
    expect(kpi(cards, 'patrimonio')).toMatchObject({ value: '33.3%', windowTag: 'período' });
  });
  test('nuevos shows how many new customers are constantes', () => {
    expect(kpi(cards, 'nuevos')).toMatchObject({ value: '1 de 1', windowTag: 'hoy' });
  });
  test('without a previous period the comparison cards say so instead of showing zero', () => {
    const none = cobertura(ROWS, { prevPeriodAvailable: false });
    const c = buildKpis({ cobertura: none, estados: buildEstados(none), trayectoria: null, currency: 'usd' });
    expect(kpi(c, 'perdidos')).toMatchObject({ value: '—', current: null });
    expect(kpi(c, 'patrimonio')).toMatchObject({ value: '—' });
    expect(kpi(c, 'activos').previous).toBeNull();
    expect(kpi(c, 'ventas').value).toBe('—');
  });
  test('every card carries a window tag and a basis note', () => {
    for (const c of cards) {
      expect(['período', '12m', 'histórico', 'hoy']).toContain(c.windowTag);
      expect(c.basis.length).toBeGreaterThan(0);
    }
    expect(kpi(cards, 'ventas').basis).toContain('consignación');
  });
});
