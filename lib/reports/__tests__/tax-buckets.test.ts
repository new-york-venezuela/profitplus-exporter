import { describe, expect, test } from 'bun:test';
import { EXEMPT_TIPO_IMP, splitTaxBuckets } from '../tax-buckets';

describe('splitTaxBuckets', () => {
  test('empty lines -> null', () => {
    expect(splitTaxBuckets([])).toBeNull();
  });
  test('single IVA line', () => {
    expect(splitTaxBuckets([{ tipoImp: '1', base: 100, iva: 16 }])).toEqual({ base: 100, exento: 0, iva: 16 });
  });
  test('exempt-only gives real zeros', () => {
    expect(splitTaxBuckets([{ tipoImp: EXEMPT_TIPO_IMP, base: 50, iva: 0 }])).toEqual({ base: 0, exento: 50, iva: 0 });
  });
  test('exempt iva is ignored', () => {
    expect(splitTaxBuckets([{ tipoImp: EXEMPT_TIPO_IMP, base: 50, iva: 9 }])).toEqual({ base: 0, exento: 50, iva: 0 });
  });
  test('exempt line with null base -> exento null, not 0', () => {
    expect(splitTaxBuckets([{ tipoImp: EXEMPT_TIPO_IMP, base: null, iva: null }])).toEqual({ base: 0, exento: null, iva: 0 });
  });
  test('null taxed base nulls base and iva buckets only', () => {
    const r = splitTaxBuckets([
      { tipoImp: '1', base: null, iva: 5 },
      { tipoImp: '1', base: 10, iva: null },
      { tipoImp: EXEMPT_TIPO_IMP, base: 7, iva: null },
    ]);
    expect(r).toEqual({ base: null, exento: 7, iva: null });
  });
  test('cent rounding is exact', () => {
    expect(splitTaxBuckets([{ tipoImp: '1', base: 1.15, iva: 0.1 }, { tipoImp: '1', base: 0.1, iva: 0.1 }, { tipoImp: '1', base: 0.1, iva: 0.1 }])).toEqual({ base: 1.35, exento: 0, iva: 0.3 });
  });
  test('mixed lines sum with 2-decimal rounding', () => {
    const r = splitTaxBuckets([
      { tipoImp: '1', base: 0.1, iva: 0.1 },
      { tipoImp: '1', base: 0.2, iva: 0.2 },
      { tipoImp: EXEMPT_TIPO_IMP, base: 0.1, iva: 0 },
      { tipoImp: EXEMPT_TIPO_IMP, base: 0.2, iva: 0 },
    ]);
    expect(r).toEqual({ base: 0.3, exento: 0.3, iva: 0.3 });
  });
});
