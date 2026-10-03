import { describe, test, expect } from 'bun:test';
import { validateAlertSettingsBody } from '@/lib/pricing/alert-validators';

const ok = { enabled: true, daysAhead: 7, recipients: null };

describe('validateAlertSettingsBody', () => {
  test('accepts and normalises', () => {
    expect(validateAlertSettingsBody(ok)).toEqual({ ok: true, value: ok });
    expect(validateAlertSettingsBody({ ...ok, recipients: undefined })).toEqual({ ok: true, value: ok });
    expect(validateAlertSettingsBody({ enabled: false, daysAhead: 60, recipients: [' A@X.com ', 'a@x.com', 'b@y.org'] }))
      .toEqual({ ok: true, value: { enabled: false, daysAhead: 60, recipients: ['a@x.com', 'b@y.org'] } });
    expect(validateAlertSettingsBody({ ...ok, recipients: [] })).toEqual({ ok: true, value: { ...ok, recipients: [] } });
  });
  test('rejects bad shapes', () => {
    for (const b of [null, [], 'x', 1]) expect(validateAlertSettingsBody(b).ok).toBe(false);
  });
  test('rejects non-boolean enabled', () => {
    for (const enabled of ['true', 1, undefined, null]) expect(validateAlertSettingsBody({ ...ok, enabled }).ok).toBe(false);
  });
  test('rejects daysAhead outside 1..60 or non-integer', () => {
    for (const daysAhead of [0, 61, 1.5, '7', NaN, undefined]) expect(validateAlertSettingsBody({ ...ok, daysAhead }).ok).toBe(false);
    expect(validateAlertSettingsBody({ ...ok, daysAhead: 1 }).ok).toBe(true);
  });
  test('rejects bad recipients', () => {
    for (const recipients of ['a@x.com', ['nope'], ['a@x'], [5], [''], ['a b@x.com'], [`${'a'.repeat(120)}@x.com`]]) {
      expect(validateAlertSettingsBody({ ...ok, recipients }).ok).toBe(false);
    }
    expect(validateAlertSettingsBody({ ...ok, recipients: Array.from({ length: 51 }, (_, i) => `u${i}@x.com`) }).ok).toBe(false);
    expect(validateAlertSettingsBody({ ...ok, recipients: Array.from({ length: 50 }, (_, i) => `u${i}@x.com`) }).ok).toBe(true);
  });
});
