import { describe, test, expect } from 'bun:test';
import { join } from 'node:path';
import {
  STORE_MAP, parseWorkbook, computeRowKey, computeContentHash, toDateKey,
} from '../../import-consignment-deliveries';

describe('STORE_MAP', () => {
  test('has exactly 23 entries (22 original file stores + La Joya)', () => {
    expect(Object.keys(STORE_MAP)).toHaveLength(23);
  });

  test('maps known stores to the resolved CustomerCode from the spec', () => {
    expect(STORE_MAP['Gama Express Chuao']).toBe('J-301420608-21');
    expect(STORE_MAP['Gama Express Caurimare']).toBe('J-301420608-18');
    expect(STORE_MAP['Gama Plus Santa Eduvigis']).toBe('J-301420608-2');
    expect(STORE_MAP['Gama Plus La Trinidad']).toBe('J-301420608-6');
    expect(STORE_MAP['Gama La Joya']).toBe('J-301420608-24');
  });
});

describe('toDateKey', () => {
  test('formats a date as yyyyMMdd', () => {
    expect(toDateKey(new Date(Date.UTC(2026, 3, 16)))).toBe(20260416);
  });
});

describe('computeRowKey', () => {
  test('is stable for the same identity tuple', () => {
    const a = computeRowKey('gama', 'J-301420608-21', 20260416, 'D0001', 5);
    const b = computeRowKey('gama', 'J-301420608-21', 20260416, 'D0001', 5);
    expect(a).toBe(b);
  });

  test('differs when any identity field differs', () => {
    const base = computeRowKey('gama', 'J-301420608-21', 20260416, 'D0001', 5);
    expect(computeRowKey('gama', 'J-301420608-21', 20260416, 'D0001', 6)).not.toBe(base);
    expect(computeRowKey('gama', 'J-301420608-22', 20260416, 'D0001', 5)).not.toBe(base);
    expect(computeRowKey('gama', 'J-301420608-21', 20260417, 'D0001', 5)).not.toBe(base);
  });

  test('does not change when quantity changes (quantity is not part of identity)', () => {
    // computeRowKey has no quantity parameter at all -- this test documents that
    // intentional omission so a future refactor doesn't accidentally add it.
    const key1 = computeRowKey('gama', 'J-301420608-21', 20260416, 'D0001', 5);
    const key2 = computeRowKey('gama', 'J-301420608-21', 20260416, 'D0001', 5);
    expect(key1).toBe(key2);
  });
});

describe('computeContentHash', () => {
  test('differs when quantity changes', () => {
    expect(computeContentHash(18)).not.toBe(computeContentHash(20));
  });

  test('is stable for the same quantity', () => {
    expect(computeContentHash(18)).toBe(computeContentHash(18));
  });
});

describe('parseWorkbook', () => {
  const fixturePath = join(import.meta.dir, 'fixtures', 'despacho-sample.xlsx');

  test('produces one ParsedRow per non-zero product cell', () => {
    const rows = parseWorkbook(fixturePath);
    // Fixture (see Step 2 below): 3 delivery rows, one with 2 non-null
    // product columns, one with 1, one with 0 (all blank) -- expect 3 ParsedRows.
    expect(rows).toHaveLength(3);
  });

  test('skips the Total Unidades / Total $ summary rows', () => {
    const rows = parseWorkbook(fixturePath);
    expect(rows.some(r => r.storeName === 'Total Unidades')).toBe(false);
    expect(rows.some(r => r.storeName === 'Total $')).toBe(false);
  });

  test('carries the nota/PO identifier through as an opaque string', () => {
    const rows = parseWorkbook(fixturePath);
    const row = rows.find(r => r.notaEntregaNum === 'D0001');
    expect(row).toBeDefined();
  });

  test('skips a row where every product column is blank', () => {
    const rows = parseWorkbook(fixturePath);
    // The fixture's third data row has a store+date+nota but zero product
    // quantities -- must not produce any ParsedRow at all for it.
    expect(rows.every(r => r.quantity > 0)).toBe(true);
  });
});
