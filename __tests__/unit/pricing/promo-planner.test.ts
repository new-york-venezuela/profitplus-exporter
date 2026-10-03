import { describe, test, expect } from 'bun:test';
import { continuationMonto, findMaterialisedPromo, planCancelPromo, planChangePromoEnd } from '@/lib/pricing/promo-planner';
import { addDaysIso, daysBetweenIso } from '@/lib/pricing/dates';
import type { RateOp, RateRow } from '@/lib/pricing/rate-planner';

const row = (desde: string, hasta: string | null, monto: number): RateRow =>
  ({ coArt: 'A', coPrecio: '08', coAlma: '000015', desde, hasta, monto, coMone: 'USD', validador: '0x01' });

const regularBefore = row('2026-03-15', '2026-10-04', 4);
const promo = row('2026-10-05', '2026-10-15', 3);
const cont = row('2026-10-16', null, 4);
const rows = [regularBefore, promo, cont];

// Utility function to apply ops to rows (for invariant testing).
function applyOps(inputRows: RateRow[], ops: RateOp[]): RateRow[] {
  const current = new Map<RateRow, RateRow>(inputRows.map(r => [r, r]));
  const inserted: RateRow[] = [];
  for (const op of ops) {
    if (op.type === 'update') {
      const base = current.get(op.row);
      if (!base) throw new Error('update op targets a row that is not in the input');
      current.set(op.row, { ...base, ...op.set });
    } else {
      inserted.push({ ...inputRows[0], desde: op.desde, hasta: op.hasta, monto: op.monto });
    }
  }
  return [...current.values(), ...inserted].sort((a, b) => a.desde.localeCompare(b.desde));
}

const FAR_FUTURE = '2100-01-01';
const endOf = (r: RateRow) => r.hasta ?? FAR_FUTURE;

/** Every day from the earliest `desde` to the end of the chain is covered by exactly one row, and the end is unchanged. */
function assertCoverageInvariant(originalRows: RateRow[], resultRows: RateRow[]) {
  const start = originalRows.reduce((min, r) => (r.desde < min ? r.desde : min), originalRows[0].desde);
  const originalEnd = originalRows.reduce((max, r) => (endOf(r) > max ? endOf(r) : max), start);
  const resultEnd = resultRows.reduce((max, r) => (endOf(r) > max ? endOf(r) : max), start);
  expect(resultEnd).toBe(originalEnd);
  const days = daysBetweenIso(start, resultEnd);
  for (let i = 0; i <= days; i++) {
    const day = addDaysIso(start, i);
    const covering = resultRows.filter(r => r.desde <= day && day <= endOf(r)).length;
    if (covering !== 1) throw new Error(`day ${day} is covered by ${covering} rows`);
  }
}

describe('planCancelPromo', () => {
  test('before start → promo row is repriced to the regular amount (no gap)', () => {
    const result = planCancelPromo(rows, { from: '2026-10-05', to: '2026-10-15', regularMonto: 4, today: '2026-10-01' });
    expect(result).toEqual({ ok: true, skipped: false, ops: [{ type: 'update', row: promo, set: { monto: 4 } }] });
    if (result.ok) {
      const resultRows = applyOps(rows, result.ops);
      assertCoverageInvariant(rows, resultRows);
    }
  });

  test('starting today → same: reprice in place', () => {
    const result = planCancelPromo(rows, { from: '2026-10-05', to: '2026-10-15', regularMonto: 4, today: '2026-10-05' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const resultRows = applyOps(rows, result.ops);
      assertCoverageInvariant(rows, resultRows);
    }
  });

  test('active → promo keeps elapsed days, remaining days at regular price', () => {
    const result = planCancelPromo(rows, { from: '2026-10-05', to: '2026-10-15', regularMonto: 4, today: '2026-10-09' });
    expect(result).toEqual({ ok: true, skipped: false, ops: [
      { type: 'update', row: promo, set: { hasta: '2026-10-08' } },
      { type: 'insert', desde: '2026-10-09', hasta: '2026-10-15', monto: 4 },
    ] });
    if (result.ok) {
      const resultRows = applyOps(rows, result.ops);
      assertCoverageInvariant(rows, resultRows);
    }
  });

  test('ended promo cannot be cancelled', () => {
    expect(planCancelPromo(rows, { from: '2026-10-05', to: '2026-10-15', regularMonto: 4, today: '2026-10-16' }).ok).toBe(false);
  });

  test('promo row not found (edited by hand) → error', () => {
    expect(planCancelPromo([regularBefore, cont], { from: '2026-10-05', to: '2026-10-15', regularMonto: 4, today: '2026-10-01' }).ok).toBe(false);
  });
});

describe('planChangePromoEnd', () => {
  const p = { from: '2026-10-05', to: '2026-10-15', regularMonto: 4 };

  test('extend: promo hasta moves and the continuation starts later', () => {
    const result = planChangePromoEnd(rows, { ...p, newTo: '2026-10-20', today: '2026-10-09' });
    expect(result).toEqual({ ok: true, skipped: false, ops: [
      { type: 'update', row: promo, set: { hasta: '2026-10-20' } },
      { type: 'update', row: cont, set: { desde: '2026-10-21' } },
    ] });
    if (result.ok) {
      const resultRows = applyOps(rows, result.ops);
      assertCoverageInvariant(rows, resultRows);
    }
  });

  test('shorten: continuation starts earlier', () => {
    const result = planChangePromoEnd(rows, { ...p, newTo: '2026-10-12', today: '2026-10-09' });
    expect(result).toEqual({ ok: true, skipped: false, ops: [
      { type: 'update', row: promo, set: { hasta: '2026-10-12' } },
      { type: 'update', row: cont, set: { desde: '2026-10-13' } },
    ] });
    if (result.ok) {
      const resultRows = applyOps(rows, result.ops);
      assertCoverageInvariant(rows, resultRows);
    }
  });

  test('shorten when the promo reached the end of its regular row (no continuation) → insert one at regular price', () => {
    const result = planChangePromoEnd([regularBefore, promo], { ...p, newTo: '2026-10-12', today: '2026-10-09' });
    expect(result).toEqual({ ok: true, skipped: false, ops: [
      { type: 'update', row: promo, set: { hasta: '2026-10-12' } },
      { type: 'insert', desde: '2026-10-13', hasta: '2026-10-15', monto: 4 },
    ] });
    if (result.ok) {
      const resultRows = applyOps([regularBefore, promo], result.ops);
      assertCoverageInvariant([regularBefore, promo], resultRows);
    }
  });

  test('extend with no continuation row → error', () => {
    expect(planChangePromoEnd([regularBefore, promo], { ...p, newTo: '2026-10-20', today: '2026-10-09' }).ok).toBe(false);
  });

  test('extend past the continuation own end → error', () => {
    const boundedCont = row('2026-10-16', '2026-10-18', 4);
    expect(planChangePromoEnd([regularBefore, promo, boundedCont], { ...p, newTo: '2026-10-20', today: '2026-10-09' }).ok).toBe(false);
  });

  test('new end in the past, before from, equal to current, or promo already ended → error/skip', () => {
    expect(planChangePromoEnd(rows, { ...p, newTo: '2026-10-08', today: '2026-10-09' }).ok).toBe(false);
    expect(planChangePromoEnd(rows, { ...p, newTo: '2026-10-04', today: '2026-10-01' }).ok).toBe(false);
    expect(planChangePromoEnd(rows, { ...p, newTo: '2026-10-15', today: '2026-10-09' })).toEqual({ ok: true, skipped: true, ops: [] });
    expect(planChangePromoEnd(rows, { ...p, newTo: '2026-10-20', today: '2026-10-16' }).ok).toBe(false);
  });
});

describe('findMaterialisedPromo / continuationMonto', () => {
  const rows = [regularBefore, promo, cont];
  test('finds the promo row by end, start candidates and monto', () => {
    expect(findMaterialisedPromo(rows, { froms: ['2026-10-05'], to: '2026-10-15', monto: 3 })).toBe(promo);
    expect(findMaterialisedPromo(rows, { froms: ['2026-10-01', '2026-10-05'], to: '2026-10-15', monto: 3 })).toBe(promo);
    expect(findMaterialisedPromo(rows, { froms: ['2026-10-06'], to: '2026-10-15', monto: 3 })).toBeUndefined();
    expect(findMaterialisedPromo(rows, { froms: ['2026-10-05'], to: '2026-10-15', monto: 9 })).toBeUndefined();
  });
  test('continuation monto is the row starting the day after', () => {
    expect(continuationMonto(rows, '2026-10-15')).toBe(cont.monto);
    expect(continuationMonto(rows, '2026-10-14')).toBeNull();
  });
});
