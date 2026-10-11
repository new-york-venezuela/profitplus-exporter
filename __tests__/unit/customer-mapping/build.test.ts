import { describe, test, expect } from 'bun:test';
import {
  buildMapping, parseSaleDate, type InvoiceLine, type MasterRow, type TrackingRow,
} from '../../../lib/customer-mapping/build';

const m = (o: Partial<MasterRow> = {}): MasterRow => ({ codigo: 'J1', cliente: 'Uno', grupo: 'Abasto', ...o });
const l = (o: Partial<InvoiceLine> = {}): InvoiceLine => ({
  numero: 'F000001', renglon: 1, fecha: '2026-09-01', coCli: 'J1', coVen: '7', tipoDocumento: 'Factura', ...o,
});
const t = (o: Partial<TrackingRow> = {}): TrackingRow => ({ codigo: 'J1', ruta: 5, frecuencia: 'Semanal', fila: 3, ...o });
const opts = { effectiveFrom: '2026-03-01' };
const kinds = (c: { kind: string }[]) => c.map(x => x.kind);

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

describe('buildMapping: seller and group', () => {
  test('picks the seller of the latest Factura line', () => {
    const { rows, conflicts } = buildMapping([m()], [
      l({ numero: 'F1', fecha: '2026-09-01', coVen: '7' }),
      l({ numero: 'F2', fecha: '2026-09-24', coVen: '39' }),
      l({ numero: 'F0', fecha: '2026-08-01', coVen: '6' }),
    ], [t()], opts);
    expect(rows[0].coVen).toBe('39');
    expect(rows[0].sourceNote).toContain('F2');
    expect(conflicts.filter(c => c.kind === 'multi_seller')).toHaveLength(1);
  });
  test('ignores Devolucion lines and blank-seller Factura lines', () => {
    const { rows, conflicts } = buildMapping([m()], [
      l({ numero: 'F1', fecha: '2026-09-01', coVen: '7' }),
      l({ numero: 'D1', fecha: '2026-10-01', coVen: '5', tipoDocumento: 'Devolucion' }),
      l({ numero: 'F2', fecha: '2026-09-30', coVen: '  ' }),
    ], [t()], opts);
    expect(rows[0].coVen).toBe('7');
    expect(kinds(conflicts)).not.toContain('multi_seller');
  });
  test('group comes from the master; tipo/principal no longer exist on the row', () => {
    const { rows } = buildMapping([m({ grupo: ' Farmacia ' })], [l()], [t()], opts);
    expect(rows[0].grupo).toBe('Farmacia');
    expect(Object.keys(rows[0]).sort()).toEqual(
      ['coCli', 'coVen', 'effectiveFrom', 'frecuencia', 'grupo', 'nombre', 'ruta', 'sourceNote']);
  });
  test('missing code is skipped, duplicate code keeps the first row', () => {
    const { rows, conflicts } = buildMapping([
      m({ codigo: '', cliente: 'Sin codigo' }),
      m({ codigo: 'J9', cliente: 'Primero' }),
      m({ codigo: 'J9', cliente: 'Segundo' }),
    ], [l({ coCli: 'J9' })], [t({ codigo: 'J9' })], opts);
    expect(rows.map(r => r.nombre)).toEqual(['Primero']);
    expect(kinds(conflicts)).toContain('missing_code');
    expect(kinds(conflicts)).toContain('duplicate_code');
  });
  test('output is sorted by code and carries effective_from', () => {
    const { rows } = buildMapping([m({ codigo: 'J2' }), m({ codigo: 'J1' })], [],
      [t({ codigo: 'J2' }), t({ codigo: 'J1' })], opts);
    expect(rows.map(r => r.coCli)).toEqual(['J1', 'J2']);
    expect(rows[0].effectiveFrom).toBe('2026-03-01');
  });
  test('sales-sheet codes missing from the master are flagged once; loose match is only a hint', () => {
    const { rows, conflicts } = buildMapping([m({ codigo: 'J30142', cliente: 'Cliente X' })], [
      l({ coCli: 'J30142' }), l({ coCli: 'J-30142-20', numero: 'F2' }), l({ coCli: 'J-30142-20', numero: 'F3' }),
    ], [t({ codigo: 'J30142' })], opts);
    expect(rows.map(r => r.coCli)).toEqual(['J30142']);
    const miss = conflicts.filter(c => c.kind === 'sales_code_not_in_master');
    expect(miss.map(c => c.coCli)).toEqual(['J-30142-20']);
    expect(miss[0].detail).toContain('J30142');
  });
});

describe('buildMapping: tracking workbook (route and frequency)', () => {
  test('route and frequency come from the tracking row; frequency is normalised', () => {
    const { rows } = buildMapping([m()], [l()], [t({ ruta: 12, frecuencia: 'Quincenal' })], opts);
    expect(rows[0]).toMatchObject({ ruta: 12, frecuencia: 'QUINCENAL' });
  });
  test('route cell formats: text, padded text, "Ruta N", float', () => {
    for (const cell of ['5', ' 5 ', 'Ruta 5', 5.0]) {
      const { rows } = buildMapping([m()], [l()], [t({ ruta: cell })], opts);
      expect(rows[0].ruta).toBe(5);
    }
  });
  test('blank frequency defaults to SEMANAL; unknown frequency is a conflict and SEMANAL', () => {
    const blank = buildMapping([m()], [l()], [t({ frecuencia: null })], opts);
    expect(blank.rows[0].frecuencia).toBe('SEMANAL');
    expect(kinds(blank.conflicts)).not.toContain('invalid_frequency');
    const bad = buildMapping([m()], [l()], [t({ frecuencia: 'Diaria' })], opts);
    expect(bad.rows[0].frecuencia).toBe('SEMANAL');
    expect(kinds(bad.conflicts)).toContain('invalid_frequency');
  });
  test('blank or invalid route keeps the row with ruta null and a conflict', () => {
    const blank = buildMapping([m()], [l()], [t({ ruta: null })], opts);
    expect(blank.rows[0].ruta).toBeNull();
    expect(kinds(blank.conflicts)).toContain('missing_route');
    for (const bad of ['abc', 0, 1000]) {
      const r = buildMapping([m()], [l()], [t({ ruta: bad })], opts);
      expect(r.rows[0].ruta).toBeNull();
      expect(kinds(r.conflicts)).toEqual(expect.arrayContaining(['invalid_route', 'missing_route']));
    }
  });
  test('"5.0" text (decimal-looking route) surfaces as invalid_route, never a crash', () => {
    for (const cell of ['5.0', '5.5', ' 5,0 ']) {
      const r = buildMapping([m()], [l()], [t({ ruta: cell })], opts);
      expect(r.rows[0].ruta).toBeNull();
      expect(kinds(r.conflicts)).toEqual(expect.arrayContaining(['invalid_route', 'missing_route']));
    }
  });
  test('non-string, non-number route cells (Date, boolean) are invalid, never a crash', () => {
    for (const cell of [new Date(2026, 0, 5), true]) {
      const r = buildMapping([m()], [l()], [t({ ruta: cell })], opts);
      expect(r.rows[0].ruta).toBeNull();
      expect(kinds(r.conflicts)).toContain('invalid_route');
    }
  });
  test('master customers absent from the tracking workbook are omitted with a conflict', () => {
    const { rows, conflicts } = buildMapping([m({ codigo: 'J1' }), m({ codigo: 'J2' })], [], [t({ codigo: 'J1' })], opts);
    expect(rows.map(r => r.coCli)).toEqual(['J1']);
    expect(conflicts.filter(c => c.kind === 'not_in_tracking').map(c => c.coCli)).toEqual(['J2']);
  });
  test('tracking codes not in the master are reported, never matched loosely', () => {
    const { rows, conflicts } = buildMapping([m({ codigo: 'J30142', cliente: 'Cliente X' })], [],
      [t({ codigo: 'J30142' }), t({ codigo: 'J-30142', fila: 9 }), t({ codigo: '172', fila: 10 })], opts);
    expect(rows).toHaveLength(1);
    const miss = conflicts.filter(c => c.kind === 'route_code_not_in_master');
    expect(miss.map(c => c.coCli)).toEqual(['J-30142', '172']);
    expect(miss[0].detail).toContain('J30142');
    expect(miss[1].detail).not.toMatch(/parecido/);
  });
  test('duplicate tracking rows: identical are merged, different blank the route', () => {
    const same = buildMapping([m()], [l()], [t(), t({ fila: 4 })], opts);
    expect(same.rows[0].ruta).toBe(5);
    expect(kinds(same.conflicts)).not.toContain('duplicate_tracking_row');
    const diff = buildMapping([m()], [l()], [t(), t({ fila: 4, ruta: 6 })], opts);
    expect(diff.rows[0].ruta).toBeNull();
    expect(kinds(diff.conflicts)).toEqual(expect.arrayContaining(['duplicate_tracking_row', 'missing_route']));
  });
});

describe('buildMapping: route owners', () => {
  const customers = [m({ codigo: 'A' }), m({ codigo: 'B' }), m({ codigo: 'C' }), m({ codigo: 'D' })];
  const track = ['A', 'B', 'C', 'D'].map((codigo, i) => t({ codigo, fila: i + 3 }));
  test('the majority seller owns the route; stragglers and customers without invoices are reassigned', () => {
    const { rows, conflicts, owners } = buildMapping(customers, [
      l({ coCli: 'A', coVen: '7', numero: 'F1' }), l({ coCli: 'B', coVen: '7', numero: 'F2' }),
      l({ coCli: 'C', coVen: '9', numero: 'F3' }),
    ], track, opts);
    expect(rows.map(r => r.coVen)).toEqual(['7', '7', '7', '7']);
    expect(owners[0]).toMatchObject({ route: 5, owner: '7', tie: false });
    expect(rows[2].sourceNote).toContain('vendedor de la ruta 5: 7');
    expect(rows[3].sourceNote).toContain('vendedor de la ruta 5: 7');
    const over = conflicts.filter(c => c.kind === 'seller_overridden_by_route_owner');
    expect(over.map(c => c.coCli)).toEqual(['C']); // D had no seller: note only, no override conflict
    expect(over[0].detail).toContain('9');
    expect(kinds(conflicts)).toContain('no_invoices');
  });
  test('a tied route keeps each customer seller and records one route_owner_tie', () => {
    const { rows, conflicts } = buildMapping(customers.slice(0, 2), [
      l({ coCli: 'A', coVen: '7', numero: 'F1' }), l({ coCli: 'B', coVen: '9', numero: 'F2' }),
    ], track.slice(0, 2), opts);
    expect(rows.map(r => r.coVen)).toEqual(['7', '9']);
    const tie = conflicts.filter(c => c.kind === 'route_owner_tie');
    expect(tie).toHaveLength(1);
    expect(tie[0]).toMatchObject({ coCli: '', nombre: 'Ruta 5' });
  });
  test('a route where nobody has invoices is reported and keeps blank sellers', () => {
    const { rows, conflicts } = buildMapping(customers.slice(0, 2), [], track.slice(0, 2), opts);
    expect(rows.map(r => r.coVen)).toEqual(['', '']);
    expect(kinds(conflicts)).toContain('route_without_owner');
  });
});
