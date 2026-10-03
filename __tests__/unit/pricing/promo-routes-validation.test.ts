// Route contract: the validator failure paths each promotion route turns into a 400, plus id parsing.
import { describe, test, expect } from 'bun:test';
import { validateCreatePromotionBody, validatePatchPromotionBody } from '@/lib/pricing/promo-validators';
import { parsePromotionId } from '@/lib/pricing/route-params';

const TODAY = '2026-10-03';
const base = { kind: 'overlay', name: 'Octubre', coPrecio: '01', startsOn: '2026-10-05', endsOn: '2026-10-10', items: [{ coArt: 'A1', monto: 5 }] };
const bad = (b: unknown) => validateCreatePromotionBody(b, TODAY);

describe('create/preview body failures (400)', () => {
  test('non-object body', () => { expect(bad(null).ok).toBe(false); expect(bad([]).ok).toBe(false); });
  test('past start', () => { expect(bad({ ...base, startsOn: '2026-10-02' }).ok).toBe(false); });
  test('endsOn before startsOn', () => { expect(bad({ ...base, endsOn: '2026-10-04' }).ok).toBe(false); });
  test('empty items', () => { expect(bad({ ...base, items: [] }).ok).toBe(false); });
  test('duplicate items', () => { expect(bad({ ...base, items: [{ coArt: 'A1', monto: 1 }, { coArt: 'A1', monto: 2 }] }).ok).toBe(false); });
  test('name over 40', () => { expect(bad({ ...base, name: 'x'.repeat(41) }).ok).toBe(false); });
  test('segment kind without customers', () => {
    expect(bad({ ...base, kind: 'segment', baseCoPrecio: '01', customerCodes: [] }).ok).toBe(false);
  });
  test('unknown kind', () => { expect(bad({ ...base, kind: 'other' }).ok).toBe(false); });
});

describe('patch body', () => {
  test('unknown action fails', () => { expect(validatePatchPromotionBody({ action: 'nuke' }, TODAY).ok).toBe(false); });
  test('change_end in the past fails', () => { expect(validatePatchPromotionBody({ action: 'change_end', endsOn: '2026-10-01' }, TODAY).ok).toBe(false); });
  test('cancel and change_end pass', () => {
    expect(validatePatchPromotionBody({ action: 'cancel' }, TODAY).ok).toBe(true);
    expect(validatePatchPromotionBody({ action: 'change_end', endsOn: '2026-10-09' }, TODAY).ok).toBe(true);
  });
});

describe('parsePromotionId', () => {
  test('positive integers', () => { expect(parsePromotionId('12')).toBe(12); expect(parsePromotionId('1')).toBe(1); });
  test('everything else is null', () => {
    for (const raw of ['0', '-1', '1.5', 'abc', '12abc', '', ' 3', '1e2', '99999999999999999999']) expect(parsePromotionId(raw)).toBeNull();
  });
});
