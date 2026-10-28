import { describe, test, expect } from 'bun:test';
import { parseListsCsv, parsePricesCsv } from '@/lib/pricing/list-import/csv';
import { buildImportPlan } from '@/lib/pricing/list-import/plan';

const LISTS = 'lista,nombre,moneda,desde\r\nA,Mayorista USD,USD,2026-11-01\r\nB,Cadenas USD,usd,2026-11-01\r\n';
const ctx = {
  existing: [{ coPrecio: '09', desPrecio: 'mayorista usd', coMone: 'USD' }],
  currencies: ['BSD', 'USD'],
  articles: [{ coArt: 'ART-1', artDes: 'Harina' }, { coArt: 'ART-2', artDes: 'Arroz' }],
  today: '2026-10-28',
};

describe('parseListsCsv', () => {
  test('parses rows and uppercases the currency', () => {
    const r = parseListsCsv(LISTS);
    expect(r.errors).toEqual([]);
    expect(r.lists.map(l => [l.key, l.coMone])).toEqual([['A', 'USD'], ['B', 'USD']]);
  });
  test('rejects duplicate names, bad dates and semicolon files', () => {
    expect(parseListsCsv('lista,nombre,moneda,desde\nA,X,USD,2026-11-01\nB,x,USD,2026-11-01').errors[0]).toContain('nombre repetido');
    expect(parseListsCsv('lista,nombre,moneda,desde\nA,X,USD,01/11/2026').errors[0]).toContain('AAAA-MM-DD');
    expect(parseListsCsv('lista;nombre;moneda;desde\nA;X;USD;2026-11-01').errors[0]).toContain('delimitado por comas');
  });
});

describe('parsePricesCsv', () => {
  test('wide format: blanks are skipped, nombre column ignored', () => {
    const r = parsePricesCsv('co_art,nombre,A,B\nART-1,Harina,12.4,11.9\nART-2,Arroz,,8.75\n', ['A', 'B']);
    expect(r.errors).toEqual([]);
    expect(r.cells.map(c => `${c.coArt}/${c.key}/${c.monto}`)).toEqual(['ART-1/A/12.4', 'ART-1/B/11.9', 'ART-2/B/8.75']);
  });
  test('rejects decimal commas, zero, >5 decimals, duplicates, unknown and missing list columns', () => {
    const bad = parsePricesCsv('co_art,A\nX,"12,5"\nY,0\nZ,1.123456\nX,3\n', ['A']);
    expect(bad.errors.length).toBe(4);
    expect(parsePricesCsv('co_art,A,C\nX,1,1\n', ['A']).errors[0]).toContain('«C»');
    expect(parsePricesCsv('co_art,A\nX,1\n', ['A', 'B']).errors[0]).toContain('«B»');
  });
});

describe('buildImportPlan', () => {
  const lists = parseListsCsv(LISTS).lists;
  const cells = parsePricesCsv('co_art,A,B\nART-1,12.4,11.9\nART-2,,8.75\n', ['A', 'B']).cells;

  test('matches an existing list by name (case-insensitive) and plans new ones', () => {
    const p = buildImportPlan(lists, cells, ctx);
    expect(p.problems).toEqual([]);
    expect(p.lists.map(l => [l.key, l.existingCoPrecio, l.changes.length])).toEqual([['A', '09', 1], ['B', null, 2]]);
  });
  test('reports unknown articles once, past dates, bad currency, currency clash and empty lists', () => {
    const p = buildImportPlan(
      [{ key: 'A', nombre: 'Mayorista USD', coMone: 'BSD', desde: '2026-10-01' }, { key: 'C', nombre: 'Vacía', coMone: 'EUR', desde: '2026-11-01' }],
      [{ line: 2, coArt: 'NOPE', key: 'A', monto: 1 }, { line: 3, coArt: 'NOPE', key: 'C', monto: 1 }],
      ctx,
    );
    expect(p.problems.filter(x => x.includes('NOPE')).length).toBe(1);
    expect(p.problems.some(x => x.includes('anterior a hoy'))).toBe(true);
    expect(p.problems.some(x => x.includes('«EUR»'))).toBe(true);
    expect(p.problems.some(x => x.includes('ya existe'))).toBe(true);
    expect(p.problems.some(x => x.includes('ningún precio'))).toBe(true);
  });
});
