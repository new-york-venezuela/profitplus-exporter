import { describe, expect, test } from 'bun:test';
import { HISTORICO_RETURNS_WINDOW } from '@/lib/dwh/historico-window';

describe('HISTORICO_RETURNS_WINDOW', () => {
  test('windows returns by the devolución date', () => {
    expect(HISTORICO_RETURNS_WINDOW).toBe('AND frl.DateKey BETWEEN 20250101 AND 20251231');
    expect(HISTORICO_RETURNS_WINDOW).not.toContain('OriginalInvoiceDateKey');
  });
});
