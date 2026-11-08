import { describe, expect, test } from 'bun:test';
import { DEFAULT_RETURNS_BASIS, RETURNS_BASIS_TABS, resolveReturnsBasis } from '../returns-basis';

describe('resolveReturnsBasis', () => {
  test('defaults to devolucion for missing or invalid values', () => {
    expect(DEFAULT_RETURNS_BASIS).toBe('devolucion');
    expect(resolveReturnsBasis(null)).toBe('devolucion');
    expect(resolveReturnsBasis('')).toBe('devolucion');
    expect(resolveReturnsBasis('garbage')).toBe('devolucion');
  });
  test('accepts factura and devolucion', () => {
    expect(resolveReturnsBasis('factura')).toBe('factura');
    expect(resolveReturnsBasis('devolucion')).toBe('devolucion');
  });
  test('selector tabs are exactly resumen, ventas, devoluciones', () => {
    expect([...RETURNS_BASIS_TABS].sort()).toEqual(['devoluciones', 'resumen', 'ventas']);
  });
});
