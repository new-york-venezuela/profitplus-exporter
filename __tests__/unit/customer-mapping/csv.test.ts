import { describe, test, expect } from 'bun:test';
import { csvToMapping, parseCsv } from '../../../lib/customer-mapping/csv';

const HEADER = 'co_cli,nombre,co_ven,grupo,ruta,frecuencia';
const ROW = 'J507294439,"COCHINA ENVIDIA, C.A",000015,Restaurante,5,SEMANAL';
const file = (...lines: string[]) => [HEADER, ...lines].join('\r\n') + '\r\n';

describe('mapping csv', () => {
  test('parseCsv handles BOM, CRLF, quoted commas and escaped quotes', () => {
    const text = '﻿a,b\r\n"x, y","he said ""hi"""\r\n';
    expect(parseCsv(text)).toEqual([['a', 'b'], ['x, y', 'he said "hi"']]);
  });
  test('parses rows including commas in names, blank co_ven and blank ruta', () => {
    const { rows, errors } = csvToMapping(file(ROW, 'J1,Plain,,Abasto,,QUINCENAL'));
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { coCli: 'J507294439', nombre: 'COCHINA ENVIDIA, C.A', coVen: '000015', grupo: 'Restaurante', ruta: 5, frecuencia: 'SEMANAL' },
      { coCli: 'J1', nombre: 'Plain', coVen: '', grupo: 'Abasto', ruta: null, frecuencia: 'QUINCENAL' },
    ]);
  });
  test('blank frecuencia defaults to SEMANAL; "Ruta 7" text is accepted', () => {
    const { rows, errors } = csvToMapping(file('J1,x,007,Abasto,Ruta 7,'));
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ ruta: 7, frecuencia: 'SEMANAL' });
  });
  test('reports bad ruta, bad frecuencia, missing group and duplicate code', () => {
    const text = csvToMapping(file('J1,x,007,,cinco,Diaria', 'J1,x,007,Abasto,5,SEMANAL')).errors.join('\n');
    expect(text).toMatch(/ruta/);
    expect(text).toMatch(/frecuencia/);
    expect(text).toMatch(/grupo/);
    expect(text).toMatch(/duplicad/i);
  });
  test('"5.0" in the ruta column is reported as an invalid ruta, not a crash', () => {
    const { rows, errors } = csvToMapping(file('J1,x,007,Abasto,5.0,SEMANAL'));
    expect(errors.join('\n')).toMatch(/ruta inválida '5\.0'/);
    expect(rows[0].ruta).toBeNull();
  });
  test('rejects a file with the previous header', () => {
    const old = 'co_cli,nombre,co_ven,grupo,ruta,frecuencia,effective_from,source_note\nJ1,x,7,G,5,SEMANAL,2026-03-01,\n';
    expect(csvToMapping(old).errors[0]).toMatch(/encabezado/i);
  });
});
