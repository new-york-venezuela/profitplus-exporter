import { describe, test, expect } from 'bun:test';
import { buildPlan, assignSegmentCodes, type PlanInput } from '../../../lib/customer-mapping/plan';
import type { MappingRow } from '../../../lib/customer-mapping/types';

const row = (o: Partial<MappingRow> = {}): MappingRow => ({
  coCli: 'J1', nombre: 'Uno', coVen: '15', grupo: 'Abasto', tipoCliente: 'Independiente',
  clientePrincipal: 'Uno', effectiveFrom: '2026-03-01', sourceNote: '', ...o,
});

const input = (o: Partial<PlanInput> = {}): PlanInput => ({
  rows: [row()],
  customers: new Map([['J1', { coCli: 'J1', coVen: '7', coSeg: '0001' }]]),
  activeSellers: ['000015', '7'],
  segments: { byDesc: new Map([['abasto', '0023']]), codes: new Set(['0001', '0023']) },
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
      customers: new Map([['J1', { coCli: 'J1', coVen: '000015', coSeg: '0023' }]]),
      docs: [{ kind: 'FACT', docNum: 'F2', coCli: 'J1', coVen: '000015', fecEmis: '2026-04-01' }],
    }));
    expect(p.customerSeller).toEqual([]);
    expect(p.customerSegment).toEqual([]);
    expect(p.docSeller).toEqual([]);
  });
  test('unknown customer is a problem with a suggestion for a dash/case variant', () => {
    const p = buildPlan(input({
      rows: [row({ coCli: 'j-1' })],
      customers: new Map([['J1', { coCli: 'J1', coVen: '7', coSeg: null }]]),
    }));
    expect(p.problems[0].kind).toBe('unknown_customer');
    expect(p.problems[0].detail).toContain('J1');
  });
  test('unknown seller is a problem', () => {
    const p = buildPlan(input({ rows: [row({ coVen: '99' })] }));
    expect(p.problems.map(x => x.kind)).toContain('unknown_seller');
  });
  test('blank seller updates the group but leaves seller and documents alone', () => {
    const p = buildPlan(input({ rows: [row({ coVen: '' })] }));
    expect(p.customerSeller).toEqual([]);
    expect(p.docSeller).toEqual([]);
    expect(p.customerSegment).toHaveLength(1);
  });
  test('missing group is created with a generated code and used for the customer', () => {
    const p = buildPlan(input({ rows: [row({ grupo: 'Tienda Online' })] }));
    expect(p.segmentsToCreate).toEqual([{ coSeg: 'GRP01', segDes: 'Tienda Online' }]);
    expect(p.customerSegment[0].to).toBe('GRP01');
  });
  test('documents before the effective date are left alone', () => {
    const p = buildPlan(input({
      docs: [{ kind: 'FACT', docNum: 'OLD', coCli: 'J1', coVen: '7', fecEmis: '2026-02-28' }],
    }));
    expect(p.docSeller).toEqual([]);
  });
});

describe('assignSegmentCodes', () => {
  test('skips codes already in use and is alphabetical', () => {
    const m = assignSegmentCodes(['Zeta', 'Alfa'], new Set(['GRP01']));
    expect(m.get('Alfa')).toBe('GRP02');
    expect(m.get('Zeta')).toBe('GRP03');
  });
});
