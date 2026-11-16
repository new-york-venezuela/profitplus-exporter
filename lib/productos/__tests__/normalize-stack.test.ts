import { describe, expect, test } from 'bun:test';
import { normalizeStack } from '../normalize-stack';

describe('normalizeStack', () => {
  test('values sum to 1 per bucket', () => {
    const out = normalizeStack([{ a: 1, b: 3 }], ['a', 'b']);
    expect(out[0]).toEqual({ a: 0.25, b: 0.75 });
  });
  test('zero-total bucket stays all zeros', () => {
    expect(normalizeStack([{ a: 0, b: 0 }], ['a', 'b'])[0]).toEqual({ a: 0, b: 0 });
  });
  test('missing keys count as 0 and input is not mutated', () => {
    const rows = [{ a: 2 }];
    const out = normalizeStack(rows, ['a', 'b']);
    expect(out[0]).toEqual({ a: 1, b: 0 });
    expect(rows[0]).toEqual({ a: 2 });
  });
});
