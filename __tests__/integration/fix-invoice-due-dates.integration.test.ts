import { describe, test, expect } from 'bun:test';
import { parseArgs } from '@/scripts/fix-invoice-due-dates';

describe('fix-invoice-due-dates parseArgs', () => {
  test('parses required flags without --apply', () => {
    const opts = parseArgs(['--customer=J-306725024-6', '--from=2026-01-01', '--to=2026-09-19']);
    expect(opts).toEqual({
      customer: 'J-306725024-6',
      from: '2026-01-01',
      to: '2026-09-19',
      apply: false,
    });
  });

  test('parses --apply flag', () => {
    const opts = parseArgs(['--customer=J-306725024-6', '--from=2026-01-01', '--to=2026-09-19', '--apply']);
    expect(opts.apply).toBe(true);
  });

  test('throws when --customer is missing', () => {
    expect(() => parseArgs(['--from=2026-01-01', '--to=2026-09-19'])).toThrow(/--customer/);
  });

  test('throws when --from is missing', () => {
    expect(() => parseArgs(['--customer=J-306725024-6', '--to=2026-09-19'])).toThrow(/--from/);
  });

  test('throws when --to is missing', () => {
    expect(() => parseArgs(['--customer=J-306725024-6', '--from=2026-01-01'])).toThrow(/--to/);
  });
});
