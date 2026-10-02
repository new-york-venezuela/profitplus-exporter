import { describe, test, expect } from 'bun:test';
import { validateCreateSegmentBody, validatePatchSegmentBody, validateAssignmentBody } from '@/lib/pricing/validators';

const today = '2026-10-01';
const hex = '0x00000000000A1B2C';

describe('validateCreateSegmentBody', () => {
  test('accepts a group', () => {
    expect(validateCreateSegmentBody({ kind: 'group', desTipo: ' Bodegones ', coPrecio: '07' }, today))
      .toEqual({ ok: true, value: { kind: 'group', desTipo: 'Bodegones', coPrecio: '07' } });
  });
  test('rejects a group name over 60 chars or empty', () => {
    expect(validateCreateSegmentBody({ kind: 'group', desTipo: 'x'.repeat(61), coPrecio: '07' }, today).ok).toBe(false);
    expect(validateCreateSegmentBody({ kind: 'group', desTipo: '  ', coPrecio: '07' }, today).ok).toBe(false);
  });
  test('special needs customer, reason, a FUTURE end date and a list', () => {
    const base = { kind: 'special', customerCoCli: 'C001', reason: 'promo oct', expiresOn: '2026-10-31', coPrecio: '07' };
    expect(validateCreateSegmentBody(base, today).ok).toBe(true);
    expect(validateCreateSegmentBody({ ...base, expiresOn: '2026-10-01' }, today).ok).toBe(false); // today is not future
    expect(validateCreateSegmentBody({ ...base, expiresOn: '2026-09-30' }, today).ok).toBe(false);
    expect(validateCreateSegmentBody({ ...base, expiresOn: '31/10/2026' }, today).ok).toBe(false);
    expect(validateCreateSegmentBody({ ...base, reason: '' }, today).ok).toBe(false);
    expect(validateCreateSegmentBody({ ...base, customerCoCli: '' }, today).ok).toBe(false);
  });
  test('rejects unknown kind and non-objects', () => {
    expect(validateCreateSegmentBody({ kind: 'x' }, today).ok).toBe(false);
    expect(validateCreateSegmentBody(null, today).ok).toBe(false);
  });
});

describe('validatePatchSegmentBody', () => {
  test('rename/repoint require a validador', () => {
    expect(validatePatchSegmentBody({ desTipo: 'Nuevo' }, today).ok).toBe(false);
    expect(validatePatchSegmentBody({ coPrecio: '08', validador: hex }, today).ok).toBe(true);
  });
  test('validador must look like 0x + 16 hex digits', () => {
    expect(validatePatchSegmentBody({ coPrecio: '08', validador: 'abc' }, today).ok).toBe(false);
  });
  test('expiry only change needs no validador; null clears; past rejected', () => {
    expect(validatePatchSegmentBody({ expiresOn: '2026-11-01' }, today).ok).toBe(true);
    expect(validatePatchSegmentBody({ expiresOn: null }, today).ok).toBe(true);
    expect(validatePatchSegmentBody({ expiresOn: '2026-09-01' }, today).ok).toBe(false);
  });
  test('empty body rejected', () => {
    expect(validatePatchSegmentBody({}, today).ok).toBe(false);
  });
});

describe('validateAssignmentBody', () => {
  test('accepts trimmed unique codes', () => {
    expect(validateAssignmentBody({ customerCodes: [' C1 ', 'C1', 'C2'], targetTipCli: '000003' }))
      .toEqual({ ok: true, value: { customerCodes: ['C1', 'C2'], targetTipCli: '000003' } });
  });
  test('rejects empty list, non-strings, >500 codes, missing target', () => {
    expect(validateAssignmentBody({ customerCodes: [], targetTipCli: 'x' }).ok).toBe(false);
    expect(validateAssignmentBody({ customerCodes: [1], targetTipCli: 'x' }).ok).toBe(false);
    expect(validateAssignmentBody({ customerCodes: Array.from({ length: 501 }, (_, i) => `C${i}`), targetTipCli: 'x' }).ok).toBe(false);
    expect(validateAssignmentBody({ customerCodes: ['C1'], targetTipCli: '' }).ok).toBe(false);
  });
});
