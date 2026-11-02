import { describe, expect, test } from 'bun:test';
import { partitionByScope, scopeViolations } from '@/lib/pricing/xlsx/scope';

const erp = [
  { coArt: 'PAN01 ', artDes: 'Pan', coCat: null, catDes: null },
  { coArt: 'pas01', artDes: 'Pastel', coCat: null, catDes: null },
  { coArt: 'PIZ01', artDes: 'Pizza', coCat: null, catDes: null },
  { coArt: 'ACEITE', artDes: 'Aceite', coCat: null, catDes: null },
  { coArt: 'NUEVO', artDes: 'Nuevo', coCat: null, catDes: null },
];
const dwh = [
  { productCode: 'PAN01', lineName: 'Panaderia', categoryName: 'Fresco' },
  { productCode: 'PAS01', lineName: 'Pasteleria', categoryName: 'Congelado' },
  { productCode: 'piz01', lineName: 'Pizza', categoryName: 'Congelado' },
  { productCode: 'ACEITE', lineName: 'Materia Prima', categoryName: 'Fresco' },
];

describe('partitionByScope', () => {
  const r = partitionByScope(erp, dwh);
  test('includes the three sellable lines regardless of category', () => {
    expect(r.inScope.map((a) => [a.coArt, a.line, a.category])).toEqual([
      ['PAN01', 'Panaderia', 'Fresco'],
      ['pas01', 'Pasteleria', 'Congelado'],
      ['PIZ01', 'Pizza', 'Congelado'],
    ]);
  });
  test('excludes Materia Prima', () => {
    expect(r.inScope.some((a) => a.coArt === 'ACEITE')).toBe(false);
    expect(r.unclassified.some((a) => a.coArt === 'ACEITE')).toBe(false);
  });
  test('ERP article absent from DWH is unclassified', () => {
    expect(r.unclassified.map((a) => a.coArt)).toEqual(['NUEVO']);
  });
});

describe('scopeViolations', () => {
  const { inScope } = partitionByScope(erp, dwh);
  test('flags out-of-scope code', () => {
    expect(scopeViolations(['ACEITE'], inScope, 'Fila 3')).toEqual([
      'Fila 3: ACEITE no es un producto terminado (Panadería/Pastelería/Pizza)',
    ]);
  });
  test('accepts in-scope code', () => {
    expect(scopeViolations(['PAN01'], inScope, 'Fila 3')).toEqual([]);
  });
});
