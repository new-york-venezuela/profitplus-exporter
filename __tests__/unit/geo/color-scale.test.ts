import { describe, test, expect } from 'bun:test';
import { buildScale } from '@/lib/geo/color-scale';

const HEX = /^#[0-9a-f]{6}$/;
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe('buildScale', () => {
  test('min is lightest, max is darkest, values in between are monotonic', () => {
    const s = buildScale([0, 50, 100]);
    expect(s.min).toBe(0);
    expect(s.max).toBe(100);
    const lums = [0, 25, 50, 75, 100].map(v => luminance(s.colorFor(v)));
    for (let i = 1; i < lums.length; i++) expect(lums[i]).toBeLessThan(lums[i - 1]);
    expect(s.colorFor(0)).toMatch(HEX);
  });
  test('values outside the range clamp', () => {
    const s = buildScale([10, 20]);
    expect(s.colorFor(-5)).toBe(s.colorFor(10));
    expect(s.colorFor(999)).toBe(s.colorFor(20));
  });
  test('legend breaks span min..max with the requested number of stops', () => {
    expect(buildScale([0, 100], 5).breaks).toEqual([0, 25, 50, 75, 100]);
  });
  test('all values equal: single break, lightest colour, no NaN', () => {
    const s = buildScale([7, 7, 7]);
    expect(s.breaks).toEqual([7]);
    expect(s.colorFor(7)).toMatch(HEX);
  });
  test('empty input and non-finite values are ignored safely', () => {
    const empty = buildScale([]);
    expect(empty).toMatchObject({ min: 0, max: 0, breaks: [0] });
    expect(buildScale([NaN, 5, Infinity]).max).toBe(5);
  });
});
