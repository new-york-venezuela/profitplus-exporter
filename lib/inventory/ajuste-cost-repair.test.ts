import { describe, test, expect } from 'bun:test';
import { planAjusteCostRepair, type OpenAjusLayer } from './ajuste-cost-repair';

const layer = (o: Partial<OpenAjusLayer>): OpenAjusLayer => ({
  id: 'L1', coArt: '0000170', description: 'Harina', fecha: '2026-10-29', remaining: 405,
  costo: 8773.0624, refCosto: 619.6408, refFecha: '2026-10-05', ...o,
});

describe('planAjusteCostRepair', () => {
  test('fixes an inflated open layer to the purchase cost in force on its date', () => {
    const plan = planAjusteCostRepair([layer({})]);
    expect(plan.fixes).toEqual([expect.objectContaining({ id: 'L1', costoOld: 8773.0624, costoNew: 619.6408 })]);
    expect(plan.review).toHaveLength(0);
  });

  test('also fixes a layer far BELOW its reference (copy of a tiny extra purchase line)', () => {
    const plan = planAjusteCostRepair([layer({ costo: 20, refCosto: 651.82304 })]);
    expect(plan.fixes).toEqual([expect.objectContaining({ costoOld: 20, costoNew: 651.82304, reason: 'subvaluada' })]);
  });

  test('marks an inflated fix as inflada', () => {
    expect(planAjusteCostRepair([layer({})]).fixes[0].reason).toBe('inflada');
  });

  test('leaves a layer alone when it is not meaningfully above the reference', () => {
    const plan = planAjusteCostRepair([layer({ costo: 650, refCosto: 619.6408 })]);
    expect(plan.fixes).toHaveLength(0);
    expect(plan.untouched).toBe(1);
  });

  test('sends a layer with no purchase reference to review, never fixes it', () => {
    const plan = planAjusteCostRepair([layer({ refCosto: null, refFecha: null })]);
    expect(plan.fixes).toHaveLength(0);
    expect(plan.review).toEqual([expect.objectContaining({ id: 'L1', reason: expect.stringContaining('sin costo de compra') })]);
  });

  test('ignores layers with nothing left to consume', () => {
    const plan = planAjusteCostRepair([layer({ remaining: 0 })]);
    expect(plan.fixes).toHaveLength(0);
    expect(plan.untouched).toBe(1);
  });

  test('threshold is configurable', () => {
    const l = layer({ costo: 700, refCosto: 619.6408 });
    expect(planAjusteCostRepair([l], { minRatio: 1.1 }).fixes).toHaveLength(1);
    expect(planAjusteCostRepair([l]).fixes).toHaveLength(0);
    const low = layer({ costo: 500, refCosto: 619.6408 });
    expect(planAjusteCostRepair([low], { minRatio: 1.1 }).fixes[0].reason).toBe('subvaluada');
  });
});
