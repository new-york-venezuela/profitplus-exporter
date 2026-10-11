import { describe, test, expect } from 'bun:test';
import { trimCode, sellerKey, resolveSeller, looseCustomerKey } from '../../../lib/customer-mapping/codes';

describe('codes', () => {
  test('trimCode trims strings and stringifies numbers', () => {
    expect(trimCode('  J-1  ')).toBe('J-1');
    expect(trimCode(15)).toBe('15');
    expect(trimCode(null)).toBe('');
  });
  test('sellerKey ignores leading zeros on numeric codes only', () => {
    expect(sellerKey('000015')).toBe('15');
    expect(sellerKey('15')).toBe('15');
    expect(sellerKey(' a01 ')).toBe('A01');
  });
  test('resolveSeller maps workbook 15 to the ERP code', () => {
    expect(resolveSeller('15', ['000015 '.trim(), '7'])).toBe('000015');
    expect(resolveSeller('99', ['000015', '7'])).toBeNull();
    expect(resolveSeller('', ['7'])).toBeNull();
  });
  test('looseCustomerKey collapses dashes, spaces and case', () => {
    expect(looseCustomerKey('J-301420608-20')).toBe(looseCustomerKey('j30142060820'));
    expect(looseCustomerKey(' J 3014 ')).toBe('J3014');
  });
});
