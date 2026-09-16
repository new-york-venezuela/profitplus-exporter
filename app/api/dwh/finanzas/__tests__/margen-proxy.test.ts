import { describe, test, expect } from 'bun:test';
import { computeMargenProxy } from '../margen-proxy';

describe('computeMargenProxy', () => {
  test('computes Utilidad Bruta and Margen Operativo from ingresos/compras/gastosOperativos', () => {
    const result = computeMargenProxy({ ingresos: 1000, compras: 400, gastosOperativos: 600 });
    expect(result.ingresos).toBe(1000);
    expect(result.compras).toBe(400);
    expect(result.utilidadBruta).toBe(600); // 1000 - 400
    expect(result.margenBrutoRate).toBeCloseTo(0.6, 5); // 600 / 1000
    expect(result.otrosGastosOperativos).toBe(200); // 600 - 400
    expect(result.margenOperativo).toBe(400); // 600 - 200
    expect(result.margenOperativoRate).toBeCloseTo(0.4, 5); // 400 / 1000
  });

  test('margenOperativo equals ingresos - gastosOperativos (matches the existing ebitda calc)', () => {
    const result = computeMargenProxy({ ingresos: 1000, compras: 400, gastosOperativos: 600 });
    expect(result.margenOperativo).toBe(1000 - 600);
  });

  test('rates are null when ingresos is 0 (avoids division by zero)', () => {
    const result = computeMargenProxy({ ingresos: 0, compras: 0, gastosOperativos: 0 });
    expect(result.margenBrutoRate).toBeNull();
    expect(result.margenOperativoRate).toBeNull();
  });

  test('handles compras greater than gastosOperativos (otrosGastosOperativos can go negative, e.g. a refund-heavy period)', () => {
    const result = computeMargenProxy({ ingresos: 1000, compras: 700, gastosOperativos: 600 });
    expect(result.otrosGastosOperativos).toBe(-100);
    expect(result.margenOperativo).toBe(1000 - 600);
  });
});
