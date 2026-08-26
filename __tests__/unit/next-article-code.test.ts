import { describe, test, expect } from 'bun:test';
import { suggestNextArticleCode } from '@/lib/inventory/next-article-code';

describe('suggestNextArticleCode', () => {
  test('returns 0000001 when there are no existing codes', () => {
    expect(suggestNextArticleCode([])).toBe('0000001');
  });

  test('returns one past the highest numeric code, zero-padded to 7 digits', () => {
    expect(suggestNextArticleCode(['0000001', '0000166', '0000050'])).toBe('0000167');
  });

  test('ignores non-numeric codes when computing the max', () => {
    expect(suggestNextArticleCode(['0000010', 'ABC-1', '0000020'])).toBe('0000021');
  });

  test('pads past 7 digits without truncating once codes exceed 9999999', () => {
    expect(suggestNextArticleCode(['9999999'])).toBe('10000000');
  });
});
