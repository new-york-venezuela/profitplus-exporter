import { describe, test, expect } from 'bun:test';
import { money, moneyLabel, moneyTooltip } from '../format';

describe('money', () => {
  test('formats the bs side with Venezuelan locale grouping, no decimals', () => {
    expect(money({ bs: 1234567, usd: 30000 }, 'bs')).toBe('1.234.567');
  });

  test('formats the usd side with US locale grouping', () => {
    expect(money({ bs: 1234567, usd: 30864 }, 'usd')).toBe('30,864');
  });

  test('returns an em dash when the requested currency side is null', () => {
    expect(money({ bs: 1234567, usd: null }, 'usd')).toBe('—');
  });
});

describe('moneyLabel', () => {
  test('prefixes bs amounts with "Bs. "', () => {
    expect(moneyLabel({ bs: 1000, usd: 25 }, 'bs')).toBe('Bs. 1.000');
  });

  test('prefixes usd amounts with "$"', () => {
    expect(moneyLabel({ bs: 1000, usd: 25 }, 'usd')).toBe('$25');
  });

  test('shows an em dash (no "$" prefix collision) when usd is null', () => {
    expect(moneyLabel({ bs: 1000, usd: null }, 'usd')).toBe('—');
  });
});

describe('moneyTooltip', () => {
  test('formats a plain numeric value already selected by the caller', () => {
    expect(moneyTooltip(1000, 'bs')).toBe('Bs. 1.000');
  });

  test('unwraps a Recharts-style single-element array value', () => {
    expect(moneyTooltip([1000], 'bs')).toBe('Bs. 1.000');
  });

  test('formats a usd-side value the same way', () => {
    expect(moneyTooltip(2000, 'usd')).toBe('$2,000');
  });
});
