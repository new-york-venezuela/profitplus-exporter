import { describe, test, expect } from 'bun:test';
import { buildPlan, assignSegmentCodes, type PlanInput } from '../../../lib/customer-mapping/plan';
import type { ErpCustomerState } from '../../../lib/customer-mapping/erp';
import type { MappingRow } from '../../../lib/customer-mapping/types';

const row = (o: Partial<MappingRow> = {}): MappingRow => ({
  coCli: 'J1', nombre: 'Uno', coVen: '15', grupo: 'Abasto', ruta: 5, frecuencia: 'SEMANAL', ...o,
});
const state = (o: Partial<ErpCustomerState> = {}): ErpCustomerState =>
  ({ coCli: 'J1', coVen: '7', coSeg: '0001', coZon: 'CCS', frecuVist: null, ...o });

const input = (o: Partial<PlanInput> = {}): PlanInput => ({
  rows: [row()],
  customers: new Map([['J1', state()]]),
  activeSellers: ['000015', '7'],
  segments: { byDesc: new Map([['abasto', '0023']]), codes: new Set(['0001', '0023']) },
  zones: new Set(['CCS', '001', 'CCS-11']),
  docs: [
    { kind: 'FACT', docNum: 'F1', coCli: 'J1', coVen: '7', fecEmis: '2026-03-05' },
    { kind: 'FACT', docNum: 'F2', coCli: 'J1', coVen: '000015', fecEmis: '2026-04-01' },
    { kind: 'DEV', docNum: 'D1', coCli: 'J1', coVen: '7', fecEmis: '2026-05-01' },
  ],
  since: '2026-03-01',
  ...o,
});

describe('buildPlan', () => {
  test('resolves workbook seller 15 to ERP 000015 and only changes what differs', () => {
    const p = buildPlan(input());
    expect(p.problems).toEqual([]);
    expect(p.customerSeller).toEqual([{ coCli: 'J1', from: '7', to: '000015' }]);
    expect(p.docSeller.map(d => d.docNum)).toEqual(['F1', 'D1']); // F2 already correct
    expect(p.customerSegment).toEqual([{ coCli: 'J1', from: '0001', to: '0023', grupo: 'Abasto' }]);
    expect(p.segmentsToCreate).toEqual([]);
  });
  test('is empty when the ERP already matches (idempotent input)', () => {
    const p = buildPlan(input({
      customers: new Map([['J1', state({ coVen: '000015', coSeg: '0023', coZon: 'CCS005', frecuVist: 'SEMANAL' })]]),
      zones: new Set(['CCS005']),
      docs: [{ kind: 'FACT', docNum: 'F2', coCli: 'J1', coVen: '000015', fecEmis: '2026-04-01' }],
    }));
    expect(p.customerSeller).toEqual([]);
    expect(p.customerSegment).toEqual([]);
    expect(p.docSeller).toEqual([]);
    expect(p.customerRoute).toEqual([]);
    expect(p.zonesToCreate).toEqual([]);
  });
  test('unknown customer is a problem with a suggestion for a dash/case variant', () => {
    const p = buildPlan(input({
      rows: [row({ coCli: 'j-1' })],
      customers: new Map([['J1', state({ coSeg: null })]]),
    }));
    expect(p.problems[0].kind).toBe('unknown_customer');
    expect(p.problems[0].detail).toContain('J1');
  });
  test('unknown seller is a problem', () => {
    const p = buildPlan(input({ rows: [row({ coVen: '99' })] }));
    expect(p.problems.map(x => x.kind)).toContain('unknown_seller');
  });
  test('a blank seller leaves the customer and its documents alone but still sets group and route', () => {
    const p = buildPlan(input({ rows: [row({ coVen: '' })] }));
    expect(p.problems).toEqual([]);
    expect(p.customerSeller).toEqual([]);
    expect(p.docSeller).toEqual([]);
    expect(p.customerRoute).toHaveLength(1);
  });
  test('missing group is created with a generated code and used for the customer', () => {
    const p = buildPlan(input({ rows: [row({ grupo: 'Tienda Online' })] }));
    expect(p.segmentsToCreate).toEqual([{ coSeg: 'GRP01', segDes: 'Tienda Online' }]);
    expect(p.customerSegment[0].to).toBe('GRP01');
  });
  test('missing groups differing only by case or spacing create ONE segment, first spelling kept', () => {
    const p = buildPlan(input({
      rows: [
        row({ coCli: 'J1', grupo: 'Tienda' }),
        row({ coCli: 'J2', grupo: '  TIENDA ' }),
      ],
      customers: new Map([
        ['J1', state({ coSeg: null })],
        ['J2', state({ coCli: 'J2', coSeg: null })],
      ]),
      docs: [],
    }));
    expect(p.segmentsToCreate).toEqual([{ coSeg: 'GRP01', segDes: 'Tienda' }]);
    expect(p.customerSegment.map(c => c.to)).toEqual(['GRP01', 'GRP01']);
  });
  test('a duplicate mapping row for the same customer is a problem and produces no changes', () => {
    const p = buildPlan(input({
      rows: [row({ coVen: '15' }), row({ coVen: '6', grupo: 'Abasto' })],
      docs: [],
    }));
    expect(p.problems).toEqual([
      { kind: 'duplicate_mapping_row', coCli: 'J1', detail: expect.stringContaining('duplicad') },
    ]);
    // only the first row contributes changes
    expect(p.customerSeller).toEqual([{ coCli: 'J1', from: '7', to: '000015' }]);
    expect(p.customerSegment).toHaveLength(1);
  });
  test('documents before the effective date are left alone', () => {
    const p = buildPlan(input({
      docs: [{ kind: 'FACT', docNum: 'OLD', coCli: 'J1', coVen: '7', fecEmis: '2026-02-28' }],
    }));
    expect(p.docSeller).toEqual([]);
  });
  test('route: creates the missing zone once and moves the customer, normalising the old frequency', () => {
    const p = buildPlan(input({
      rows: [row({ coCli: 'J1', ruta: 5, frecuencia: 'QUINCENAL' }), row({ coCli: 'J2', ruta: 5 })],
      customers: new Map([['J1', state()], ['J2', state({ coCli: 'J2', coZon: 'CCS005', frecuVist: ' semanal ' })]]),
      docs: [],
    }));
    expect(p.zonesToCreate).toEqual([{ coZon: 'CCS005', zonDes: 'Ruta 5' }]);
    expect(p.customerRoute).toEqual([
      { coCli: 'J1', fromZon: 'CCS', fromFrec: null, toZon: 'CCS005', toFrec: 'QUINCENAL' },
    ]); // J2 already has zone CCS005 and SEMANAL (case/space-insensitive): no change
  });
  test('an existing zone is not created again; only frequency changes when the zone already matches', () => {
    const p = buildPlan(input({
      customers: new Map([['J1', state({ coZon: 'CCS005', frecuVist: null })]]),
      zones: new Set(['CCS005']),
    }));
    expect(p.zonesToCreate).toEqual([]);
    expect(p.customerRoute).toEqual([{ coCli: 'J1', fromZon: 'CCS005', fromFrec: null, toZon: 'CCS005', toFrec: 'SEMANAL' }]);
  });
  test('a legacy zone code such as CCS-11 is never reused for route 11', () => {
    const p = buildPlan(input({ rows: [row({ ruta: 11 })] }));
    expect(p.zonesToCreate).toEqual([{ coZon: 'CCS011', zonDes: 'Ruta 11' }]);
    expect(p.customerRoute[0].toZon).toBe('CCS011');
  });
  test('a blank route leaves the zone alone', () => {
    const p = buildPlan(input({ rows: [row({ ruta: null })] }));
    expect(p.problems).toEqual([]);
    expect(p.customerRoute).toEqual([]);
    expect(p.zonesToCreate).toEqual([]);
  });
  test('sellers need not match the route owner: each customer takes its own seller', () => {
    const rows = [row({ coCli: 'J1', coVen: '15' }), row({ coCli: 'J2', coVen: '7' })];
    const customers = new Map(rows.map(r => [r.coCli, state({ coCli: r.coCli, coVen: '99' })]));
    const p = buildPlan(input({ rows, customers, docs: [] }));
    expect(p.problems).toEqual([]);
    expect(p.customerSeller.map(c => [c.coCli, c.to])).toEqual([['J1', '000015'], ['J2', '7']]);
  });
});

describe('assignSegmentCodes', () => {
  test('skips codes already in use and is alphabetical', () => {
    const m = assignSegmentCodes(['Zeta', 'Alfa'], new Set(['GRP01']));
    expect(m.get('Alfa')).toBe('GRP02');
    expect(m.get('Zeta')).toBe('GRP03');
  });
});
