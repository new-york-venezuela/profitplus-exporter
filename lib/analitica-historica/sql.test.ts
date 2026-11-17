import { describe, test, expect } from 'bun:test';
import { histUsdJoin, histReturnsUsdJoin, histSalesWhere, histReturnsWhere } from './sql';

const range = { startKey: 20250101, endKey: 20250131 };

describe('histUsdJoin', () => {
  test('converts through the legacy rates table only', () => {
    const sql = histUsdJoin('fsl');
    expect(sql).toContain('fact.Fact_ExchangeRate_Legacy');
    expect(sql).toContain('fsl.DateKey');
    expect(sql).not.toContain('DocumentExchangeRate');
    expect(sql).not.toMatch(/fact\.Fact_ExchangeRate(?!_Legacy)/);
  });

  test('honours a custom date column and join alias', () => {
    const sql = histUsdJoin('frl', 'OriginalInvoiceDateKey', 'fx2');
    expect(sql).toContain('frl.OriginalInvoiceDateKey');
    expect(sql).toContain(') fx2');
  });

  test('returns convert at the original factura date', () => {
    expect(histReturnsUsdJoin()).toContain('frl.OriginalInvoiceDateKey');
    expect(histReturnsUsdJoin('r', 'x')).toContain(') x');
  });
});

describe('histSalesWhere / histReturnsWhere', () => {
  test('both exclude voided rows', () => {
    expect(histSalesWhere(range)).toContain('fsl.IsVoided = 0');
    expect(histReturnsWhere(range, 'devolucion')).toContain('frl.IsVoided = 0');
  });

  test('sales window on DateKey', () => {
    expect(histSalesWhere(range)).toContain('fsl.DateKey >= 20250101 AND fsl.DateKey <= 20250131');
  });

  test('returns window on the devolución date by default and the original factura date for factura basis', () => {
    expect(histReturnsWhere(range, 'devolucion')).toContain('frl.DateKey >= 20250101');
    expect(histReturnsWhere(range, 'factura')).toContain('frl.OriginalInvoiceDateKey >= 20250101');
    expect(histReturnsWhere(range, 'factura')).not.toContain('frl.DateKey >=');
  });

  test('custom aliases are used', () => {
    expect(histSalesWhere(range, 's')).toContain('s.IsVoided = 0');
    expect(histReturnsWhere(range, 'devolucion', 'r')).toContain('r.DateKey');
  });
});
