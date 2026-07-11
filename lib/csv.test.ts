import { describe, test, expect } from 'bun:test';
import { buildCsv } from './csv';
import type { ColumnDef } from './reports/registry';

const cols: ColumnDef[] = [
  { key: 'ruc',    label: 'RUC',          defaultVisible: true, defaultOrder: 0 },
  { key: 'nombre', label: 'Razón Social',  defaultVisible: true, defaultOrder: 1 },
  { key: 'monto',  label: 'Monto',         defaultVisible: true, defaultOrder: 2 },
];

describe('buildCsv', () => {
  test('first character is UTF-8 BOM (U+FEFF)', () => {
    expect(buildCsv(cols, []).charCodeAt(0)).toBe(0xfeff);
  });

  test('header row matches column labels', () => {
    const lines = buildCsv(cols, []).slice(1).split('\r\n');
    expect(lines[0]).toBe('RUC,Razón Social,Monto');
  });

  test('data row with Spanish characters (Ñ, á, etc.)', () => {
    const rows = [{ ruc: 'J-12345678-9', nombre: 'Empresa Ñoño S.A.', monto: 1500.50 }];
    const lines = buildCsv(cols, rows).slice(1).split('\r\n');
    expect(lines[1]).toBe('J-12345678-9,Empresa Ñoño S.A.,1500.5');
  });

  test('quotes fields containing commas', () => {
    const rows = [{ ruc: '123', nombre: 'Empresa, S.A.', monto: 100 }];
    const lines = buildCsv(cols, rows).slice(1).split('\r\n');
    expect(lines[1]).toBe('123,"Empresa, S.A.",100');
  });

  test('escapes double-quotes inside quoted fields', () => {
    const rows = [{ ruc: '123', nombre: 'Empresa "El Rey"', monto: 100 }];
    const lines = buildCsv(cols, rows).slice(1).split('\r\n');
    expect(lines[1]).toBe('123,"Empresa ""El Rey""",100');
  });

  test('null and undefined become empty strings', () => {
    const rows = [{ ruc: null, nombre: undefined, monto: 0 }];
    const lines = buildCsv(cols, rows).slice(1).split('\r\n');
    expect(lines[1]).toBe(',,0');
  });

  test('uses CRLF line endings (RFC 4180)', () => {
    const csv = buildCsv(cols, [{ ruc: 'A', nombre: 'B', monto: 1 }]);
    expect(csv.slice(1)).toContain('\r\n');
  });
});
