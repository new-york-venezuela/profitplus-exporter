import { describe, test, expect } from 'bun:test';
import { nextPriceListCode } from '@/lib/pricing/list-code';
describe('nextPriceListCode', () => {
  test('next free 2-digit code, ignoring non-numeric and 4-digit codes', () => {
    expect(nextPriceListCode(['01','02','05','10','2023','TP1151'])).toBe('11');
  });
  test('first code is 01', () => expect(nextPriceListCode([])).toBe('01'));
  test('falls back to 6-digit when 99 is taken', () => expect(nextPriceListCode(['99'])).toBe('000100'));
  test('trims padding', () => expect(nextPriceListCode(['10  '])).toBe('11'));
});
