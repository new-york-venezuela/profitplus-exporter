import { describe, test, expect } from 'bun:test';
import { buildMatrizExportRows, MATRIZ_EXPORT_COLUMNS } from '../export-rows';

describe('buildMatrizExportRows', () => {
  test('joins a sales row with its matching returns row and computes both return rates', () => {
    const salesRows = [{
      SalesRepName: 'Juan Pérez', LegalEntityName: 'Plazas', CustomerName: 'Plazas San Bernardino',
      ProductName: 'Queso Fresco 1kg', LineName: 'Fresco', SubLineName: 'Quesos', CategoryName: 'Lácteos',
      WeekStartDate: '2026-09-21', YearMonth: '2026-09',
      IngresoBs: 15000, IngresoUsd: 125, Unidades: 40,
    }];
    const returnsRows = [{
      SalesRepName: 'Juan Pérez', LegalEntityName: 'Plazas', CustomerName: 'Plazas San Bernardino',
      ProductName: 'Queso Fresco 1kg', WeekStartDate: '2026-09-21',
      DevolucionBs: 1500, DevolucionUsd: 12.5, DevolucionUnidades: 4,
    }];

    const rows = buildMatrizExportRows(salesRows, returnsRows);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      Vendedor: 'Juan Pérez', Entidad: 'Plazas', Tienda: 'Plazas San Bernardino',
      Producto: 'Queso Fresco 1kg', Línea: 'Fresco', Sublínea: 'Quesos', Categoría: 'Lácteos',
      Semana: '2026-09-21', Mes: '2026-09',
      'Ingreso USD': 125, Unidades: 40,
      'Devolución USD': 12.5, 'Devolución Unidades': 4,
      'Tasa Devolución USD': 0.1, 'Tasa Devolución Unidades': 0.1,
    });
  });

  test('a sales row with no matching returns gets null/blank return-rate columns, not a crash', () => {
    const salesRows = [{
      SalesRepName: 'Ana Gómez', LegalEntityName: 'Excelsior', CustomerName: 'Excelsior Centro',
      ProductName: 'Jamón 500g', LineName: 'Fresco', SubLineName: 'Embutidos', CategoryName: 'Charcutería',
      WeekStartDate: '2026-09-14', YearMonth: '2026-09',
      IngresoBs: 8000, IngresoUsd: 66.67, Unidades: 20,
    }];

    const rows = buildMatrizExportRows(salesRows, []);

    expect(rows).toHaveLength(1);
    expect(rows[0]['Devolución USD']).toBe(0);
    expect(rows[0]['Devolución Unidades']).toBe(0);
    expect(rows[0]['Tasa Devolución USD']).toBe(null);
    expect(rows[0]['Tasa Devolución Unidades']).toBe(null);
  });

  test('MATRIZ_EXPORT_COLUMNS matches every key buildMatrizExportRows produces', () => {
    const salesRows = [{
      SalesRepName: 'X', LegalEntityName: 'X', CustomerName: 'X',
      ProductName: 'X', LineName: null, SubLineName: null, CategoryName: null,
      WeekStartDate: '2026-01-05', YearMonth: '2026-01',
      IngresoBs: 100, IngresoUsd: 1, Unidades: 1,
    }];
    const rows = buildMatrizExportRows(salesRows, []);
    const columnKeys = new Set(MATRIZ_EXPORT_COLUMNS.map(c => c.key));
    for (const key of Object.keys(rows[0])) {
      expect(columnKeys.has(key)).toBe(true);
    }
  });
});
