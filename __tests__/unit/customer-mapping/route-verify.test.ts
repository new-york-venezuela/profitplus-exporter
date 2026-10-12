import { describe, expect, test } from 'bun:test';
import { compareRouteDim, type DimRouteRow } from '../../../lib/customer-mapping/dwh';
import type { MappingRow } from '../../../lib/customer-mapping/types';

const row = (o: Partial<MappingRow>): MappingRow => ({
  coCli: 'J1', nombre: 'x', coVen: '7', grupo: 'G', ruta: 5, frecuencia: 'SEMANAL', effectiveFrom: '2026-03-01', sourceNote: '', ...o,
});
const dim = (o: Partial<DimRouteRow>): DimRouteRow => ({ coCli: 'J1', zone: 'CCS005', frequency: 'SEMANAL', rep: '000007', ...o });

describe('compareRouteDim', () => {
  test('a matching dimension (seller compared without leading zeros, case-insensitive code) has no mismatches', () => {
    expect(compareRouteDim([row({ coCli: ' j1 ' })], [dim({})])).toEqual([]);
  });
  test('reports zone, frequency and seller separately', () => {
    const out = compareRouteDim([row({ frecuencia: 'MENSUAL' })], [dim({ zone: 'CCS', rep: '9' })]);
    expect(out).toEqual([
      { coCli: 'J1', field: 'ZoneCode', expected: 'CCS005', actual: 'CCS' },
      { coCli: 'J1', field: 'VisitFrequency', expected: 'MENSUAL', actual: 'SEMANAL' },
      { coCli: 'J1', field: 'DefaultSalesRepCode', expected: '7', actual: '9' },
    ]);
  });
  test('rows without ruta or seller skip that comparison; customers missing from the dimension are ignored', () => {
    expect(compareRouteDim([row({ ruta: null, coVen: '' })], [dim({ zone: 'CCS', rep: '9' })])).toEqual([]);
    expect(compareRouteDim([row({ coCli: 'J2' })], [dim({})])).toEqual([]);
  });
  test('the dimension frequency is compared trimmed and upper-cased', () => {
    expect(compareRouteDim([row({})], [dim({ frequency: ' semanal  ' })])).toEqual([]);
    expect(compareRouteDim([row({})], [dim({ frequency: ' mensual ' })])).toEqual([
      { coCli: 'J1', field: 'VisitFrequency', expected: 'SEMANAL', actual: ' mensual ' },
    ]);
  });
  test('a NULL dimension frequency is a mismatch', () => {
    expect(compareRouteDim([row({})], [dim({ frequency: null })])).toEqual([
      { coCli: 'J1', field: 'VisitFrequency', expected: 'SEMANAL', actual: null },
    ]);
  });
});
