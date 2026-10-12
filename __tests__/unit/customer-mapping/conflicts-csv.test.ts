import { describe, test, expect } from 'bun:test';
import { conflictsToCsv, parseCsv } from '../../../lib/customer-mapping/csv';
import type { Conflict } from '../../../lib/customer-mapping/types';

describe('conflictsToCsv', () => {
  test('every row carries co_cli, nombre, kind and detail', () => {
    const conflicts: Conflict[] = [
      { coCli: 'J1', nombre: 'Uno, C.A.', kind: 'multi_seller', detail: 'vendedores 6,7 → se usa 7' },
      { coCli: 'J2', nombre: 'Dos', kind: 'no_invoices', detail: 'sin facturas' },
    ];
    const table = parseCsv(conflictsToCsv(conflicts));
    expect(table[0]).toEqual(['co_cli', 'nombre', 'kind', 'detail']);
    expect(table.slice(1).map(r => r[0])).toEqual(['J1', 'J2']);
    expect(table[1]).toEqual(['J1', 'Uno, C.A.', 'multi_seller', 'vendedores 6,7 → se usa 7']);
  });
});
