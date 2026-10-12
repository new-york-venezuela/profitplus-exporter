import { describe, test, expect } from 'bun:test';
import { csvToMapping, mappingToCsv, parseCsv, routeOwnersToCsv } from '../../../lib/customer-mapping/csv';
import { deriveRouteOwners } from '../../../lib/customer-mapping/route-owners';
import type { MappingRow } from '../../../lib/customer-mapping/types';

const row = (o: Partial<MappingRow> = {}): MappingRow => ({
  coCli: 'J507294439', nombre: 'COCHINA ENVIDIA, C.A', coVen: '15', grupo: 'Restaurante',
  ruta: 5, frecuencia: 'SEMANAL', effectiveFrom: '2026-03-01', sourceNote: 'última factura F009606 2026-09-24', ...o,
});

describe('mapping csv', () => {
  test('parseCsv handles BOM, CRLF, quoted commas and escaped quotes', () => {
    const text = '﻿a,b\r\n"x, y","he said ""hi"""\r\n';
    expect(parseCsv(text)).toEqual([['a', 'b'], ['x, y', 'he said "hi"']]);
  });
  test('header is exactly the spec columns', () => {
    const header = mappingToCsv([row()]).replace('﻿', '').split('\r\n')[0];
    expect(header).toBe('co_cli,nombre,co_ven,grupo,ruta,frecuencia,effective_from,source_note');
  });
  test('round-trips rows including commas in names, blank co_ven and null ruta', () => {
    const rows = [row(), row({ coCli: 'J1', nombre: 'Plain', coVen: '', ruta: null, frecuencia: 'QUINCENAL' })];
    const back = csvToMapping(mappingToCsv(rows));
    expect(back.errors).toEqual([]);
    expect(back.rows).toEqual(rows);
  });
  test('blank frecuencia defaults to SEMANAL; "Ruta 7" text is accepted', () => {
    const csv = mappingToCsv([row()]).replace(',5,SEMANAL,', ',Ruta 7,,');
    const { rows, errors } = csvToMapping(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ ruta: 7, frecuencia: 'SEMANAL' });
  });
  test('reports bad ruta, bad frecuencia, missing group, bad date and duplicate code', () => {
    const csv = mappingToCsv([row(), row()])
      .replace(',5,SEMANAL,', ',cinco,Diaria,').replace(/Restaurante/, '').replace('2026-03-01', '03/01/2026');
    const text = csvToMapping(csv).errors.join('\n');
    expect(text).toMatch(/ruta/);
    expect(text).toMatch(/frecuencia/);
    expect(text).toMatch(/grupo/);
    expect(text).toMatch(/effective_from/);
    expect(text).toMatch(/duplicad/i);
  });
  test('"5.0" in the ruta column is reported as an invalid ruta, not a crash', () => {
    const csv = mappingToCsv([row()]).replace(',5,SEMANAL,', ',5.0,SEMANAL,');
    const { rows, errors } = csvToMapping(csv);
    expect(errors.join('\n')).toMatch(/ruta inválida '5\.0'/);
    expect(rows[0].ruta).toBeNull();
  });
  test('rejects a file with the PR #12 header', () => {
    const old = 'co_cli,nombre,co_ven,grupo,tipo_cliente,cliente_principal,effective_from,source_note\nJ1,x,7,G,Cadena,P,2026-03-01,\n';
    expect(csvToMapping(old).errors[0]).toMatch(/encabezado/i);
  });
});

describe('routeOwnersToCsv', () => {
  test('one line per route with owner, counts and status', () => {
    const owners = deriveRouteOwners([
      { coCli: 'A', coVen: '7', ruta: 4 }, { coCli: 'B', coVen: '7', ruta: 4 }, { coCli: 'C', coVen: '9', ruta: 4 },
      { coCli: 'D', coVen: '7', ruta: 5 }, { coCli: 'E', coVen: '9', ruta: 5 },
      { coCli: 'F', coVen: '', ruta: 6 },
    ]);
    const table = parseCsv(routeOwnersToCsv(owners));
    expect(table[0]).toEqual(['ruta', 'zona', 'propietario', 'clientes', 'vendedores', 'estado']);
    expect(table[1]).toEqual(['4', 'CCS004', '7', '3', '7:2 | 9:1', 'varios_vendedores']);
    expect(table[2]).toEqual(['5', 'CCS005', '', '2', '7:1 | 9:1', 'empate']);
    expect(table[3]).toEqual(['6', 'CCS006', '', '1', '', 'sin_vendedor']);
  });
});
