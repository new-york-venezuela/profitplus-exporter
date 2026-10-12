import { describe, test, expect } from 'bun:test';
import { diffCsv, assertConfirmedDb, deriveSince } from '../../../lib/customer-mapping/diff-csv';
import type { Plan } from '../../../lib/customer-mapping/plan';

const plan: Plan = {
  segmentsToCreate: [{ coSeg: 'GRP01', segDes: 'Abasto' }],
  customerSegment: [{ coCli: 'J1', from: null, to: 'GRP01', grupo: 'Abasto' }],
  customerSeller: [{ coCli: 'J1', from: '01', to: '15' }],
  docSeller: [{ kind: 'FACT', docNum: '100', coCli: 'J1', from: '01', to: '15' }],
  zonesToCreate: [{ coZon: 'CCS005', zonDes: 'Ruta 5' }],
  customerRoute: [{ coCli: 'J1', fromZon: 'CCS', fromFrec: null, toZon: 'CCS005', toFrec: 'SEMANAL' }],
  problems: [
    { kind: 'unknown_customer', coCli: 'J9', detail: 'no existe' },
    { kind: 'duplicate_mapping_row', coCli: 'J2', detail: 'repetido' },
  ],
};

describe('diffCsv', () => {
  const lines = diffCsv(plan).replace('﻿', '').split('\r\n');
  test('header', () => expect(lines[0]).toBe('kind,key,from,to'));
  test('one row per change kind', () => {
    expect(lines).toContain('crear_segmento,GRP01,,Abasto');
    expect(lines).toContain('cliente_segmento,J1,,GRP01 (Abasto)');
    expect(lines).toContain('cliente_vendedor,J1,01,15');
    expect(lines.some(l => l.startsWith('doc_FACT,'))).toBe(true);
    expect(lines).toContain('crear_zona,CCS005,,Ruta 5');
    expect(lines).toContain('cliente_ruta,J1,CCS/,CCS005/SEMANAL');
  });
  test('problem rows are prefixed', () => {
    expect(lines).toContain('PROBLEMA_unknown_customer,J9,,no existe');
    expect(lines).toContain('PROBLEMA_duplicate_mapping_row,J2,,repetido');
  });
});

describe('assertConfirmedDb', () => {
  test('matches', () => expect(() => assertConfirmedDb('Ncake_a', 'Ncake_a')).not.toThrow());
  test('missing', () => expect(() => assertConfirmedDb(undefined, 'Ncake_a')).toThrow(/--confirm-db/));
  test('mismatch', () => expect(() => assertConfirmedDb('prod', 'Ncake_a')).toThrow(/Ncake_a/));
  test('undefined dbName', () => {
    expect(() => assertConfirmedDb('x', undefined)).toThrow(/DB_NAME/);
    expect(() => assertConfirmedDb(undefined, undefined)).toThrow();
  });
});

describe('deriveSince', () => {
  const r = (d: string) => ({ coCli: 'J1', nombre: '', coVen: '1', grupo: 'g', ruta: 5, frecuencia: 'SEMANAL' as const, effectiveFrom: d, sourceNote: '' });
  test('empty throws', () => expect(() => deriveSince([])).toThrow(/filas/));
  test('mixed throws', () => expect(() => deriveSince([r('2026-03-01'), r('2026-04-01')])).toThrow(/effective_from/));
  test('single', () => expect(deriveSince([r('2026-03-01'), r('2026-03-01')])).toBe('2026-03-01'));
});
