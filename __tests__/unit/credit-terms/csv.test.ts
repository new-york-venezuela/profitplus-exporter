import { describe, test, expect } from 'bun:test';
import { parseCreditTermsCsv } from '../../../lib/credit-terms/csv';

const HEADER = 'co_cli,nombre,dias_cred,source,note';
const file = (...lines: string[]) => [HEADER, ...lines].join('\r\n') + '\r\n';

describe('credit terms csv', () => {
  test('parses rows with BOM and CRLF', () => {
    const text = '﻿' + file('J001,"UNICASA, C.A.",15,override,"Ops 21, user 15"', 'J002,OTRO,,skip,');
    const { rows, errors } = parseCreditTermsCsv(text);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { coCli: 'J001', nombre: 'UNICASA, C.A.', diasCred: 15, source: 'override', note: 'Ops 21, user 15' },
      { coCli: 'J002', nombre: 'OTRO', diasCred: null, source: 'skip', note: '' },
    ]);
  });

  test('rejects a wrong header', () => {
    const { rows, errors } = parseCreditTermsCsv('a,b\r\nx,y\r\n');
    expect(rows).toEqual([]);
    expect(errors[0]).toContain('Encabezado inválido');
  });

  test('rejects duplicate co_cli', () => {
    const { errors } = parseCreditTermsCsv(file('J001,A,7,exact,', 'J001,B,7,exact,'));
    expect(errors).toContain('línea 3: co_cli duplicado J001');
  });

  test('rejects an unknown source', () => {
    const { errors } = parseCreditTermsCsv(file('J001,A,7,guess,'));
    expect(errors).toContain('línea 2: source inválido "guess"');
  });

  test('rejects days outside 7/15/21/35', () => {
    const { errors } = parseCreditTermsCsv(file('J001,A,10,exact,'));
    expect(errors).toContain('línea 2: dias_cred inválido "10" (7, 15, 21 o 35)');
  });

  test('rejects empty days on a non skip/review row', () => {
    const { errors } = parseCreditTermsCsv(file('J001,A,,exact,'));
    expect(errors).toContain('línea 2: dias_cred vacío para source exact');
  });

  test('rejects days on a skip row', () => {
    const { errors } = parseCreditTermsCsv(file('J001,A,7,skip,'));
    expect(errors).toContain('línea 2: una fila skip no lleva dias_cred');
  });
});
