import { describe, test, expect } from 'bun:test';
import { planCancelPromo, planChangePromoEnd } from '@/lib/pricing/promo-planner';
import type { RateRow } from '@/lib/pricing/rate-planner';

const row = (desde: string, hasta: string | null, monto: number): RateRow =>
  ({ coArt: 'A', coPrecio: '08', coAlma: '000015', desde, hasta, monto, coMone: 'USD', validador: '0x01' });

const regularBefore = row('2026-03-15', '2026-10-04', 4);
const promo = row('2026-10-05', '2026-10-15', 3);
const cont = row('2026-10-16', null, 4);
const rows = [regularBefore, promo, cont];

// Utility function to apply ops to rows (for invariant testing).
function applyOps(inputRows: RateRow[], ops: any[]): RateRow[] {
  let result = [...inputRows];
  for (const op of ops) {
    if (op.type === 'update') {
      const rowIdx = result.findIndex(r => r === op.row);
      if (rowIdx !== -1) {
        result[rowIdx] = { ...result[rowIdx], ...op.set };
      }
    } else if (op.type === 'insert') {
      result.push({
        coArt: promo.coArt,
        coPrecio: promo.coPrecio,
        coAlma: promo.coAlma,
        desde: op.desde,
        hasta: op.hasta,
        monto: op.monto,
        coMone: promo.coMone,
        validador: promo.validador,
      });
    }
  }
  return result.sort((a, b) => a.desde.localeCompare(b.desde));
}

// Verify invariant: no overlaps and continuous coverage.
function assertCoverageInvariant(originalRows: RateRow[], resultRows: RateRow[]) {
  // Find the earliest desde and last hasta of the input.
  const earliestDesde = originalRows.reduce((min, r) => (r.desde < min ? r.desde : min), originalRows[0].desde);
  const lastHasta = originalRows.reduce((max, r) => {
    if (r.hasta === null) return max;
    return r.hasta > max ? r.hasta : max;
  }, '');

  // Check no overlaps and continuous coverage.
  for (let i = 0; i < resultRows.length - 1; i++) {
    const curr = resultRows[i];
    const next = resultRows[i + 1];

    // No overlap: next row should start at or after curr row's hasta + 1 day.
    if (curr.hasta !== null) {
      const dayAfterCurr = new Date(Date.UTC(
        parseInt(curr.hasta.split('-')[0]),
        parseInt(curr.hasta.split('-')[1]) - 1,
        parseInt(curr.hasta.split('-')[2]) + 1
      ));
      const nextStart = new Date(Date.UTC(
        parseInt(next.desde.split('-')[0]),
        parseInt(next.desde.split('-')[1]) - 1,
        parseInt(next.desde.split('-')[2])
      ));
      expect(nextStart.getTime()).toBeGreaterThanOrEqual(dayAfterCurr.getTime());

      // Check no gap: next should start exactly on dayAfterCurr.
      expect(nextStart.getTime()).toBe(dayAfterCurr.getTime());
    }
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
