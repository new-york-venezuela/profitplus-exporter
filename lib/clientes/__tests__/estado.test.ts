import { describe, expect, test } from 'bun:test';
import { buildBridge, classifyEstado, daysBetweenKeys, type EstadoInput } from '../estado';

const P = { periodStartKey: 20261001, periodEndKey: 20261031, todayKey: 20261120 };
const input = (over: Partial<EstadoInput>): EstadoInput => ({
  firstInvoiceKey: 20260101, lastInvoiceKey: 20261015, boughtInPeriod: false, boughtInPrev: false, visitIntervalDays: 30, ...P, ...over,
});

describe('classifyEstado', () => {
  test('nuevo_periodo when the first invoice ever is inside P', () => {
    expect(classifyEstado(input({ firstInvoiceKey: 20261005, boughtInPeriod: true }))).toBe('nuevo_periodo');
  });
  test('retenido when bought in P and in P-1', () => {
    expect(classifyEstado(input({ boughtInPeriod: true, boughtInPrev: true }))).toBe('retenido');
  });
  test('recuperado when bought in P, not in P-1, with earlier purchases', () => {
    expect(classifyEstado(input({ boughtInPeriod: true, boughtInPrev: false }))).toBe('recuperado');
  });
  test('enfriado when bought in P-1, not in P, and the gap is within 3 visit windows', () => {
    expect(classifyEstado(input({ boughtInPrev: true, lastInvoiceKey: 20260920, visitIntervalDays: 30 }))).toBe('enfriado');
  });
  test('perdido past 3 visit windows (gap measured to the period end)', () => {
    expect(classifyEstado(input({ boughtInPrev: true, lastInvoiceKey: 20260920, visitIntervalDays: 7 }))).toBe('perdido');
  });
  test('the limit is strictly greater than 3 windows', () => {
    // Sep 30 -> Oct 31 is 31 days: > 3x10 = 30 is perdido, 3x11 = 33 is not.
    expect(classifyEstado(input({ boughtInPrev: true, lastInvoiceKey: 20260930, visitIntervalDays: 10 }))).toBe('perdido');
    expect(classifyEstado(input({ boughtInPrev: true, lastInvoiceKey: 20260930, visitIntervalDays: 11 }))).toBe('enfriado');
  });
  test('an unfinished period measures the gap to today', () => {
    const open = { periodStartKey: 20261101, periodEndKey: 20261130, todayKey: 20261120 };
    expect(classifyEstado(input({ ...open, boughtInPrev: true, lastInvoiceKey: 20261015, visitIntervalDays: 7 }))).toBe('perdido');
    expect(classifyEstado(input({ ...open, boughtInPrev: true, lastInvoiceKey: 20261015, visitIntervalDays: 30 }))).toBe('enfriado');
  });
  test('no visit frequency never reaches perdido (stays enfriado)', () => {
    expect(classifyEstado(input({ boughtInPrev: true, lastInvoiceKey: 20260901, visitIntervalDays: null }))).toBe('enfriado');
  });
  test('sin_ventas when never invoiced', () => {
    expect(classifyEstado(input({ firstInvoiceKey: null, lastInvoiceKey: null }))).toBe('sin_ventas');
  });
  test('null when silent in P and P-1 but with history (not part of the bridge)', () => {
    expect(classifyEstado(input({ boughtInPeriod: false, boughtInPrev: false }))).toBeNull();
  });
});

describe('daysBetweenKeys', () => {
  test('counts calendar days between YYYYMMDD keys', () => {
    expect(daysBetweenKeys(20260930, 20261031)).toBe(31);
    expect(daysBetweenKeys(20261231, 20270101)).toBe(1);
  });
});

describe('buildBridge', () => {
  test('reconciles base and actual', () => {
    const b = buildBridge(['retenido', 'retenido', 'enfriado', 'perdido', 'nuevo_periodo', 'nuevo_periodo', 'recuperado', 'sin_ventas', null]);
    expect(b).toEqual({ base: 4, enfriados: 1, perdidos: 1, nuevos: 2, recuperados: 1, actual: 5 });
    expect(b.base - b.enfriados - b.perdidos + b.nuevos + b.recuperados).toBe(b.actual);
  });
});
