import { describe, test, expect } from 'bun:test';
import {
  HISTORICO_FROM_KEY, HISTORICO_RETURNS_WINDOW, HISTORICO_SALES_WINDOW, HISTORICO_TO_KEY,
} from '../../../lib/dwh/historico-window';

describe('Histórico window', () => {
  test('is exactly calendar 2025', () => {
    expect(HISTORICO_FROM_KEY).toBe(20250101);
    expect(HISTORICO_TO_KEY).toBe(20251231);
  });
  test('sales and returns use the same bounds on their own date columns', () => {
    expect(HISTORICO_SALES_WINDOW).toBe('AND fsl.DateKey BETWEEN 20250101 AND 20251231');
    expect(HISTORICO_RETURNS_WINDOW).toBe('AND frl.OriginalInvoiceDateKey BETWEEN 20250101 AND 20251231');
  });
});
