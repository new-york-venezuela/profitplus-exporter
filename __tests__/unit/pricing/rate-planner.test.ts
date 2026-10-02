import { describe, test, expect } from 'bun:test';
import { planRatePeriod, type RateRow } from '@/lib/pricing/rate-planner';

const row = (desde: string, hasta: string | null, monto: number): RateRow =>
  ({ coArt: 'A', coPrecio: '08', coAlma: '000015', desde, hasta, monto, coMone: 'USD', validador: '0x0000000000000001' });
const today = '2026-10-01';

describe('unbounded change (Plan 2)', () => {
  test('1. no current row → insert open-ended', () => {
    expect(planRatePeriod([], { from: '2026-10-01', to: null, monto: 5, today })).toEqual({ ok: true, skipped: false, ops: [{ type: 'insert', desde: '2026-10-01', hasta: null, monto: 5 }] });
  });
  test('2. current started earlier → close it the day before and insert', () => {
    const cur = row('2026-03-15', null, 4);
    const plan = planRatePeriod([cur], { from: '2026-10-05', to: null, monto: 5, today });
    expect(plan).toEqual({ ok: true, skipped: false, ops: [
      { type: 'update', row: cur, set: { hasta: '2026-10-04' } },
      { type: 'insert', desde: '2026-10-05', hasta: null, monto: 5 },
    ] });
  });
  test('3. current started exactly on from → update monto in place (same-day re-edit)', () => {
    const cur = row('2026-10-01', null, 4);
    expect(planRatePeriod([cur], { from: '2026-10-01', to: null, monto: 5, today })).toEqual({ ok: true, skipped: false, ops: [{ type: 'update', row: cur, set: { monto: 5 } }] });
  });
  test('4. later scheduled row bounds the new one', () => {
    const cur = row('2026-03-15', '2026-10-31', 4);
    const later = row('2026-11-01', null, 6);
    const plan = planRatePeriod([later, cur], { from: '2026-10-05', to: null, monto: 5, today });
    expect(plan).toEqual({ ok: true, skipped: false, ops: [
      { type: 'update', row: cur, set: { hasta: '2026-10-04' } },
      { type: 'insert', desde: '2026-10-05', hasta: '2026-10-31', monto: 5 },
    ] });
  });
  test('4b. no covering row but a later row exists → insert ends the day before it', () => {
    const later = row('2026-11-01', null, 6);
    expect(planRatePeriod([later], { from: '2026-10-05', to: null, monto: 5, today }))
      .toEqual({ ok: true, skipped: false, ops: [{ type: 'insert', desde: '2026-10-05', hasta: '2026-10-31', monto: 5 }] });
  });
  test('5. same price → skipped', () => {
    expect(planRatePeriod([row('2026-03-15', null, 5)], { from: '2026-10-05', to: null, monto: 5, today })).toEqual({ ok: true, skipped: true, ops: [] });
  });
  test('ended rows are not "covering"', () => {
    const old = row('2026-01-01', '2026-02-28', 3);
    expect(planRatePeriod([old], { from: '2026-10-01', to: null, monto: 5, today }).ok).toBe(true);
  });
});

describe('validation', () => {
  test('past start rejected', () => expect(planRatePeriod([], { from: '2026-09-30', to: null, monto: 5, today }).ok).toBe(false));
  test('non-positive monto rejected', () => expect(planRatePeriod([], { from: '2026-10-01', to: null, monto: 0, today }).ok).toBe(false));
  test('end before start rejected', () => expect(planRatePeriod([row('2026-01-01', null, 4)], { from: '2026-10-10', to: '2026-10-09', monto: 5, today }).ok).toBe(false));
});

describe('bounded period (promotions, Plan 3)', () => {
  test('promo inside an open-ended regular row → close, promo, continuation', () => {
    const cur = row('2026-03-15', null, 4);
    expect(planRatePeriod([cur], { from: '2026-10-05', to: '2026-10-15', monto: 3, today })).toEqual({ ok: true, skipped: false, ops: [
      { type: 'update', row: cur, set: { hasta: '2026-10-04' } },
      { type: 'insert', desde: '2026-10-05', hasta: '2026-10-15', monto: 3 },
      { type: 'insert', desde: '2026-10-16', hasta: null, monto: 4 },
    ] });
  });
  test('promo starting on the covering row start → that row becomes the promo, continuation after', () => {
    const cur = row('2026-10-01', null, 4);
    expect(planRatePeriod([cur], { from: '2026-10-01', to: '2026-10-15', monto: 3, today })).toEqual({ ok: true, skipped: false, ops: [
      { type: 'update', row: cur, set: { monto: 3, hasta: '2026-10-15' } },
      { type: 'insert', desde: '2026-10-16', hasta: null, monto: 4 },
    ] });
  });
  test('promo reaching the end of a bounded covering row needs no continuation', () => {
    const cur = row('2026-03-15', '2026-10-15', 4);
    const plan = planRatePeriod([cur, row('2026-10-16', null, 6)], { from: '2026-10-05', to: '2026-10-15', monto: 3, today });
    expect(plan).toEqual({ ok: true, skipped: false, ops: [
      { type: 'update', row: cur, set: { hasta: '2026-10-04' } },
      { type: 'insert', desde: '2026-10-05', hasta: '2026-10-15', monto: 3 },
    ] });
  });
  test('continuation keeps the covering row original hasta', () => {
    const cur = row('2026-03-15', '2026-12-31', 4);
    const plan = planRatePeriod([cur], { from: '2026-10-05', to: '2026-10-15', monto: 3, today });
    expect(plan.ok && plan.ops[2]).toEqual({ type: 'insert', desde: '2026-10-16', hasta: '2026-12-31', monto: 4 });
  });
  test('rejects when a later row starts inside the window', () => {
    const plan = planRatePeriod([row('2026-03-15', '2026-10-09', 4), row('2026-10-10', null, 6)], { from: '2026-10-05', to: '2026-10-15', monto: 3, today });
    expect(plan.ok).toBe(false);
  });
  test('rejects when there is no regular rate to split', () => {
    expect(planRatePeriod([], { from: '2026-10-05', to: '2026-10-15', monto: 3, today }).ok).toBe(false);
  });
  test('identical promo already present → skipped', () => {
    const promo = row('2026-10-05', '2026-10-15', 3);
    expect(planRatePeriod([row('2026-03-15', '2026-10-04', 4), promo, row('2026-10-16', null, 4)], { from: '2026-10-05', to: '2026-10-15', monto: 3, today }))
      .toEqual({ ok: true, skipped: true, ops: [] });
  });
});
