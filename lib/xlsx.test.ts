import { describe, test, expect } from 'bun:test';
import * as XLSX from 'xlsx';
import { buildXlsx } from './xlsx';
import type { ColumnDef } from './reports/registry';

describe('buildXlsx', () => {
  test('creates a valid xlsx buffer with proper typing', () => {
    const columns: ColumnDef[] = [
      { key: 'name', label: 'Nombre', defaultVisible: true, defaultOrder: 1, alwaysVisible: false },
      { key: 'amount', label: 'Monto', defaultVisible: true, defaultOrder: 2, alwaysVisible: false, type: 'number' },
      { key: 'active', label: 'Activo', defaultVisible: true, defaultOrder: 3, alwaysVisible: false },
    ];

    const rows = [
      { name: 'Alice', amount: 1000.5, active: true },
      { name: 'Bob', amount: 2500.75, active: false },
    ];

    const buffer = buildXlsx(columns, rows);

    // Read back and verify types
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];

    // Header row (A1, B1, C1)
    expect(ws['A1'].v).toBe('Nombre');
    expect(ws['B1'].v).toBe('Monto');
    expect(ws['C1'].v).toBe('Activo');

    // Data row 1: text, number, boolean
    expect(ws['A2'].t).toBe('s');
    expect(ws['A2'].v).toBe('Alice');
    expect(ws['B2'].t).toBe('n');
    expect(ws['B2'].v).toBe(1000.5);
    expect(ws['C2'].t).toBe('b');
    expect(ws['C2'].v).toBe(true);

    // Data row 2: text, number, boolean
    expect(ws['A3'].t).toBe('s');
    expect(ws['A3'].v).toBe('Bob');
    expect(ws['B3'].t).toBe('n');
    expect(ws['B3'].v).toBe(2500.75);
    expect(ws['C3'].t).toBe('b');
    expect(ws['C3'].v).toBe(false);
  });

  test('handles null and undefined values', () => {
    const columns: ColumnDef[] = [
      { key: 'value', label: 'Valor', defaultVisible: true, defaultOrder: 1, alwaysVisible: false },
    ];

    const rows = [
      { value: null },
      { value: undefined },
      { value: 'text' },
    ];

    const buffer = buildXlsx(columns, rows);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];

    // Null and undefined become empty strings
    expect(ws['A2'].v).toBe('');
    expect(ws['A3'].v).toBe('');
    expect(ws['A4'].v).toBe('text');
  });

  test('preserves numeric precision', () => {
    const columns: ColumnDef[] = [
      { key: 'price', label: 'Precio', defaultVisible: true, defaultOrder: 1, alwaysVisible: false, type: 'number' },
    ];

    const rows = [{ price: 1234.56 }];

    const buffer = buildXlsx(columns, rows);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];

    expect(ws['A2'].t).toBe('n');
    expect(ws['A2'].v).toBe(1234.56);
  });
});
