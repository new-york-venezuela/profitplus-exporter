import { describe, test, expect } from 'bun:test';
import { money, moneyLabel, moneyTooltip } from '../format';

describe('money', () => {
  test('formats bs with Venezuelan locale grouping, no decimals', () => {
    expect(money(1234567, 'bs')).toBe('1.234.567');
  });

  test('formats usd with US locale grouping when no rate is given', () => {
    expect(money(1234567, 'usd')).toBe('1,234,567');
  });

  test('converts to usd by dividing by the exchange rate when both are given', () => {
    expect(money(100000, 'usd', 40)).toBe('2,500');
  });

  test('does not convert usd when rate is omitted', () => {
    expect(money(100000, 'usd')).toBe('100,000');
  });

  test('defaults to bs formatting when currency is omitted', () => {
    expect(money(1234567)).toBe('1.234.567');
  });
});

describe('moneyLabel', () => {
  test('prefixes bs amounts with "Bs. "', () => {
    expect(moneyLabel(1000, 'bs')).toBe('Bs. 1.000');
  });

  test('prefixes usd amounts with "$"', () => {
    expect(moneyLabel(1000, 'usd')).toBe('$1,000');
  });

  test('applies the exchange rate before formatting', () => {
    expect(moneyLabel(80000, 'usd', 40)).toBe('$2,000');
  });
});

describe('moneyTooltip', () => {
  test('formats a plain numeric value', () => {
    expect(moneyTooltip(1000, 'bs')).toBe('Bs. 1.000');
  });

  test('unwraps a Recharts-style single-element array value', () => {
    expect(moneyTooltip([1000], 'bs')).toBe('Bs. 1.000');
  });

  test('applies currency conversion the same as moneyLabel', () => {
    expect(moneyTooltip(80000, 'usd', 40)).toBe('$2,000');
  });
});
