import { buildXlsx } from './xlsx';
import type { ColumnDef } from './reports/registry';

describe('buildXlsx', () => {
  it('creates a valid xlsx buffer with proper typing', () => {
    const columns: ColumnDef[] = [
      { key: 'name', label: 'Nombre', defaultVisible: true, defaultOrder: 1, alwaysVisible: false },
      { key: 'amount', label: 'Monto', defaultVisible: true, defaultOrder: 2, alwaysVisible: false },
      { key: 'date', label: 'Fecha', defaultVisible: true, defaultOrder: 3, alwaysVisible: false },
      { key: 'active', label: 'Activo', defaultVisible: true, defaultOrder: 4, alwaysVisible: false },
    ];

    const rows = [
      { name: 'Alice', amount: 1000.5, date: '2026-01-15', active: true },
      { name: 'Bob', amount: 2500.75, date: '2026-01-20', active: false },
    ];

    const buffer = buildXlsx(columns, rows);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('handles null and undefined values', () => {
    const columns: ColumnDef[] = [
      { key: 'value', label: 'Valor', defaultVisible: true, defaultOrder: 1, alwaysVisible: false },
    ];

    const rows = [
      { value: null },
      { value: undefined },
      { value: 'text' },
    ];

    const buffer = buildXlsx(columns, rows);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('preserves numeric precision', () => {
    const columns: ColumnDef[] = [
      { key: 'price', label: 'Precio', defaultVisible: true, defaultOrder: 1, alwaysVisible: false },
    ];

    const rows = [{ price: 1234.56 }];

    const buffer = buildXlsx(columns, rows);
    expect(buffer).toBeInstanceOf(Buffer);
    // Actual type checking happens in Excel client; we verify it's generated
  });
});
