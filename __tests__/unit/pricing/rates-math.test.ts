import { describe, test, expect } from 'bun:test';
import { roundHalfUp, priceFromPercent, percentFromPrice, parseDecimalInput, parsePercentInput, bulkNewPrices } from '@/lib/pricing/rates-math';

describe('roundHalfUp', () => {
  test('rounds .5 up even where binary floats misbehave', () => {
    expect(roundHalfUp(1.005)).toBe(1.01);
    expect(roundHalfUp(2.675)).toBe(2.68);
    expect(roundHalfUp(12.9952)).toBe(13);
    expect(roundHalfUp(0.125, 2)).toBe(0.13);
  });
});

describe('price <-> percent', () => {
  test('priceFromPercent', () => {
    expect(priceFromPercent(12.4, 4.8)).toBe(13);
    expect(priceFromPercent(100, -8)).toBe(92);
  });
  test('percentFromPrice is derived from the rounded price', () => {
    expect(percentFromPrice(12.4, 13)).toBe(4.84);
    const price = priceFromPercent(10, 5.01);   // 10.501 -> 10.5
    expect(price).toBe(10.5);
    expect(percentFromPrice(10, price)).toBe(5);
  });
  test('null/zero reference gives null', () => {
    expect(percentFromPrice(null, 5)).toBeNull();
    expect(percentFromPrice(0, 5)).toBeNull();
  });
});

describe('parsing', () => {
  test('decimal comma, decimal point, thousands dots', () => {
    expect(parseDecimalInput('12,40')).toBe(12.4);
    expect(parseDecimalInput('12.40')).toBe(12.4);
    expect(parseDecimalInput('1.234,50')).toBe(1234.5);
    expect(parseDecimalInput(' 7 ')).toBe(7);
  });
  test('garbage and empty are null', () => {
    expect(parseDecimalInput('')).toBeNull();
    expect(parseDecimalInput('abc')).toBeNull();
    expect(parseDecimalInput('1,2,3')).toBeNull();
  });
  test('percent accepts sign and % symbol', () => {
    expect(parsePercentInput('+4,8%')).toBe(4.8);
    expect(parsePercentInput('-3')).toBe(-3);
    expect(parsePercentInput('4.8 %')).toBe(4.8);
    expect(parsePercentInput('x')).toBeNull();
  });
});

describe('bulkNewPrices', () => {
  test('percent applies to each row reference and skips rows without one', () => {
    const out = bulkNewPrices([{ coArt: 'A', reference: 10 }, { coArt: 'B', reference: null }, { coArt: 'C', reference: 20 }], { type: 'percent', pct: 10 });
    expect(out).toEqual({ A: 11, C: 22 });
  });
  test('set applies one price to every row', () => {
    expect(bulkNewPrices([{ coArt: 'A', reference: null }, { coArt: 'B', reference: 3 }], { type: 'set', monto: 5 })).toEqual({ A: 5, B: 5 });
  });
  test('results that would be ≤ 0 are dropped', () => {
    expect(bulkNewPrices([{ coArt: 'A', reference: 10 }], { type: 'percent', pct: -100 })).toEqual({});
  });
});
