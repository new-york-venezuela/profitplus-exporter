import { describe, test, expect } from 'bun:test';
import { buildMapping, parseSaleDate, type MasterRow, type InvoiceLine } from '../../../lib/customer-mapping/build';

const m = (o: Partial<MasterRow>): MasterRow => ({ codigo: 'J1', cliente: 'Uno', grupo: 'Abasto', tipo: 'Independiente', principal: 'Uno', ...o });
const l = (o: Partial<InvoiceLine>): InvoiceLine => ({ numero: 'F000001', renglon: 1, fecha: '2026-09-01', coCli: 'J1', coVen: '7', tipoDocumento: 'Factura', ...o });
const opts = { effectiveFrom: '2026-03-01' };

describe('parseSaleDate', () => {
  test('accepts Date objects and dd/mm/yyyy text (with leading space)', () => {
    expect(parseSaleDate(new Date(2026, 6, 31, 14, 4))).toBe('2026-07-31');
    expect(parseSaleDate(' 18/09/2026')).toBe('2026-09-18');
    expect(parseSaleDate('01/09/2026')).toBe('2026-09-01');
  });
  test('rejects garbage and impossible dates', () => {
    expect(parseSaleDate('31/02/2026')).toBeNull();
    expect(parseSaleDate('hello')).toBeNull();
    expect(parseSaleDate(null)).toBeNull();
  });
});

describe('buildMapping', () => {
  test('picks the seller of the latest Factura line', () => {
    const { rows, conflicts } = buildMapping([m({})], [
      l({ numero: 'F1', fecha: '2026-09-01', coVen: '7' }),
      l({ numero: 'F2', fecha: '2026-09-24', coVen: '39' }),
      l({ numero: 'F0', fecha: '2026-08-01', coVen: '6' }),
    ], opts);
    expect(rows[0].coVen).toBe('39');
    expect(rows[0].sourceNote).toContain('F2');
    expect(conflicts.filter(c => c.kind === 'multi_seller')).toHaveLength(1);
    expect(conflicts[0].detail).toMatch(/39/);
  });
  test('ignores Devolucion lines when choosing the seller', () => {
    const { rows } = buildMapping([m({})], [
      l({ fecha: '2026-09-01', coVen: '7' }),
      l({ numero: 'D1', fecha: '2026-10-01', coVen: '5', tipoDocumento: 'Devolucion' }),
    ], opts);
    expect(rows[0].coVen).toBe('7');
  });
  test('Factura lines with blank seller are ignored; all-blank means no_invoices', () => {
    const { rows, conflicts } = buildMapping([m({})], [
      l({ numero: 'F1', fecha: '2026-09-01', coVen: '7' }),
      l({ numero: 'F2', fecha: '2026-09-30', coVen: '  ' }),
    ], opts);
    expect(rows[0].coVen).toBe('7');
    expect(conflicts.map(c => c.kind)).not.toContain('multi_seller');

    const blank = buildMapping([m({})], [l({ coVen: '' }), l({ numero: 'F9', coVen: ' ' })], opts);
    expect(blank.rows[0].coVen).toBe('');
    expect(blank.conflicts.map(c => c.kind)).toEqual(['no_invoices']);
  });
  test('customer without invoices gets blank seller and a no_invoices conflict', () => {
    const { rows, conflicts } = buildMapping([m({})], [], opts);
    expect(rows[0].coVen).toBe('');
    expect(conflicts[0].kind).toBe('no_invoices');
  });
  test('missing code is skipped, duplicate code keeps first row', () => {
    const { rows, conflicts } = buildMapping([
      m({ codigo: '', cliente: 'Sin codigo' }),
      m({ codigo: 'J9', cliente: 'Primero' }),
      m({ codigo: 'J9', cliente: 'Segundo' }),
    ], [], opts);
    expect(rows.map(r => r.nombre)).toEqual(['Primero']);
    expect(conflicts.map(c => c.kind)).toContain('missing_code');
    expect(conflicts.map(c => c.kind)).toContain('duplicate_code');
  });
  test('unknown tipo is a conflict and the row is skipped', () => {
    const { rows, conflicts } = buildMapping([m({ tipo: 'Raro' })], [], opts);
    expect(rows).toHaveLength(0);
    expect(conflicts[0].kind).toBe('invalid_type');
  });
  test('output is sorted by code and carries effective_from', () => {
    const { rows } = buildMapping([m({ codigo: 'J2' }), m({ codigo: 'J1' })], [], opts);
    expect(rows.map(r => r.coCli)).toEqual(['J1', 'J2']);
    expect(rows[0].effectiveFrom).toBe('2026-03-01');
  });
});
