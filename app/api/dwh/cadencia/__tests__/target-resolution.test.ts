import { describe, test, expect } from 'bun:test';
import { resolveTarget } from '../target-resolution';

describe('resolveTarget', () => {
  test('entity-specific override takes precedence over segment default', () => {
    const entityOverrides = new Map([[1, 7]]);
    const segmentDefaults = new Map([['CADENA', 14]]);
    expect(resolveTarget(1, 'CADENA', entityOverrides, segmentDefaults)).toBe(7);
  });

  test('falls back to segment default when no entity override exists', () => {
    const entityOverrides = new Map<number, number>();
    const segmentDefaults = new Map([['CADENA', 14]]);
    expect(resolveTarget(1, 'CADENA', entityOverrides, segmentDefaults)).toBe(14);
  });

  test('returns null when neither an override nor a segment default exists', () => {
    const entityOverrides = new Map<number, number>();
    const segmentDefaults = new Map<string, number>();
    expect(resolveTarget(1, 'CADENA', entityOverrides, segmentDefaults)).toBeNull();
  });

  test('returns null when segment is null and no entity override exists', () => {
    const entityOverrides = new Map<number, number>();
    const segmentDefaults = new Map([['CADENA', 14]]);
    expect(resolveTarget(1, null, entityOverrides, segmentDefaults)).toBeNull();
  });
});
