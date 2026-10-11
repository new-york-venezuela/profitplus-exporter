import { describe, test, expect } from 'bun:test';
import { parseCsv, mappingToCsv, csvToMapping } from '../../../lib/customer-mapping/csv';
import type { MappingRow } from '../../../lib/customer-mapping/types';

const row = (o: Partial<MappingRow> = {}): MappingRow => ({
  coCli: 'J507294439', nombre: 'COCHINA ENVIDIA, C.A', coVen: '15', grupo: 'Restaurante',
  tipoCliente: 'Independiente', clientePrincipal: 'COCHINA ENVIDIA, C.A',
  effectiveFrom: '2026-03-01', sourceNote: 'latest invoice F009606 2026-09-24', ...o,
});

describe('mapping csv', () => {
  test('parseCsv handles BOM, CRLF, quoted commas and escaped quotes', () => {
    const text = '﻿a,b\r\n"x, y","he said ""hi"""\r\n';
    expect(parseCsv(text)).toEqual([['a', 'b'], ['x, y', 'he said "hi"']]);
  });
  test('round-trips rows including commas in names and blank co_ven', () => {
    const rows = [row(), row({ coCli: 'J1', nombre: 'Plain', coVen: '' })];
    const back = csvToMapping(mappingToCsv(rows));
    expect(back.errors).toEqual([]);
    expect(back.rows).toEqual(rows);
  });
  test('reports bad type, missing group, bad date and duplicate code', () => {
    const csv = mappingToCsv([row(), row()])
      .replace('Independiente', 'Otro').replace(/Restaurante/, '').replace('2026-03-01', '03/01/2026');
    const { errors } = csvToMapping(csv);
    expect(errors.join('\n')).toMatch(/tipo_cliente/);
    expect(errors.join('\n')).toMatch(/grupo/);
    expect(errors.join('\n')).toMatch(/effective_from/);
    expect(errors.join('\n')).toMatch(/duplicad/i);
  });
  test('rejects a file whose header does not match', () => {
    expect(csvToMapping('a,b\n1,2\n').errors[0]).toMatch(/encabezado/i);
  });
});
