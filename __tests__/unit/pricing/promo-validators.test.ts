import { describe, test, expect } from 'bun:test';
import { validateCreatePromotionBody, validatePatchPromotionBody } from '@/lib/pricing/promo-validators';

const TODAY = '2026-10-03';
const overlay = (extra = {}) => ({
  kind: 'overlay', name: 'Octubre', coPrecio: '01', startsOn: '2026-10-05', endsOn: '2026-10-10',
  items: [{ coArt: 'A1', monto: 5 }], ...extra,
});
const segment = (extra = {}) => ({
  kind: 'segment', name: 'Seg', baseCoPrecio: '01', customerCodes: ['C1'], startsOn: '2026-10-05', endsOn: '2026-10-10',
  items: [{ coArt: 'A1', monto: 5 }], ...extra,
});

describe('validateCreatePromotionBody', () => {
  test('accepts minimal overlay and segment', () => {
    const o = validateCreatePromotionBody(overlay(), TODAY);
    expect(o).toEqual({ ok: true, value: { kind: 'overlay', name: 'Octubre', reason: null, coPrecio: '01', startsOn: '2026-10-05', endsOn: '2026-10-10', items: [{ coArt: 'A1', monto: 5 }] } });
    const s = validateCreatePromotionBody(segment({ reason: 'x' }), TODAY);
    expect(s.ok).toBe(true);
    if (s.ok && s.value.kind === 'segment') expect(s.value.customerCodes).toEqual(['C1']);
  });
  test('accepts start today and one-day promo', () => {
    expect(validateCreatePromotionBody(overlay({ startsOn: TODAY, endsOn: TODAY }), TODAY).ok).toBe(true);
  });
  test('rejects bad dates', () => {
    expect(validateCreatePromotionBody(overlay({ startsOn: '2026-10-02' }), TODAY).ok).toBe(false);
    expect(validateCreatePromotionBody(overlay({ endsOn: '2026-10-04' }), TODAY).ok).toBe(false);
    expect(validateCreatePromotionBody(overlay({ startsOn: 'nope' }), TODAY).ok).toBe(false);
  });
  test('rejects bad items', () => {
    expect(validateCreatePromotionBody(overlay({ items: [] }), TODAY).ok).toBe(false);
    expect(validateCreatePromotionBody(overlay({ items: [{ coArt: 'A1', monto: 1 }, { coArt: 'a1', monto: 2 }] }), TODAY).ok).toBe(false);
    expect(validateCreatePromotionBody(overlay({ items: [{ coArt: 'A1', monto: 0 }] }), TODAY).ok).toBe(false);
    expect(validateCreatePromotionBody(overlay({ items: [{ coArt: 'A1', monto: 1.123456 }] }), TODAY).ok).toBe(false);
    expect(validateCreatePromotionBody(overlay({ items: Array.from({ length: 201 }, (_, i) => ({ coArt: `A${i}`, monto: 1 })) }), TODAY).ok).toBe(false);
  });
  test('rejects bad name, reason, kind', () => {
    expect(validateCreatePromotionBody(overlay({ name: 'x'.repeat(41) }), TODAY).ok).toBe(false);
    expect(validateCreatePromotionBody(overlay({ name: '  ' }), TODAY).ok).toBe(false);
    expect(validateCreatePromotionBody(overlay({ reason: 'x'.repeat(201) }), TODAY).ok).toBe(false);
    expect(validateCreatePromotionBody(overlay({ kind: 'other' }), TODAY).ok).toBe(false);
    expect(validateCreatePromotionBody(null, TODAY).ok).toBe(false);
  });
  test('rejects bad segment customers / base list', () => {
    expect(validateCreatePromotionBody(segment({ customerCodes: [] }), TODAY).ok).toBe(false);
    expect(validateCreatePromotionBody(segment({ customerCodes: ['C1', 'C1'] }), TODAY).ok).toBe(false);
    expect(validateCreatePromotionBody(segment({ customerCodes: ['x'.repeat(17)] }), TODAY).ok).toBe(false);
    expect(validateCreatePromotionBody(segment({ baseCoPrecio: 'x'.repeat(7) }), TODAY).ok).toBe(false);
  });
});

describe('validatePatchPromotionBody', () => {
  test('accepts cancel and change_end', () => {
    expect(validatePatchPromotionBody({ action: 'cancel' }, TODAY)).toEqual({ ok: true, value: { action: 'cancel' } });
    expect(validatePatchPromotionBody({ action: 'change_end', endsOn: '2026-10-03' }, TODAY)).toEqual({ ok: true, value: { action: 'change_end', endsOn: '2026-10-03' } });
  });
  test('rejects past endsOn and unknown action', () => {
    expect(validatePatchPromotionBody({ action: 'change_end', endsOn: '2026-10-02' }, TODAY).ok).toBe(false);
    expect(validatePatchPromotionBody({ action: 'change_end' }, TODAY).ok).toBe(false);
    expect(validatePatchPromotionBody({ action: 'nuke' }, TODAY).ok).toBe(false);
    expect(validatePatchPromotionBody(undefined, TODAY).ok).toBe(false);
  });
});
