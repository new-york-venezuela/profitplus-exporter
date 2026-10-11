import { describe, test, expect } from 'bun:test';
import { applyPlan, rollbackRun } from '../../../lib/customer-mapping/apply';
import { buildPlan } from '../../../lib/customer-mapping/plan';
import type { ErpGateway, ErpCustomerState, SellerDoc } from '../../../lib/customer-mapping/erp';
import type { RunRecord, RunStore, RunStatus } from '../../../lib/customer-mapping/runs-repo';
import type { MappingRow } from '../../../lib/customer-mapping/types';

function fakeErp(opts: { failDoc?: string } = {}) {
  const customers = new Map<string, ErpCustomerState>([['J1', { coCli: 'J1', coVen: '7', coSeg: '0001' }]]);
  const docs: SellerDoc[] = [
    { kind: 'FACT', docNum: 'F1', coCli: 'J1', coVen: '7', fecEmis: '2026-03-05' },
    { kind: 'FACT', docNum: 'F2', coCli: 'J1', coVen: '6', fecEmis: '2026-04-05' },
  ];
  const segs = new Map<string, string>([['abasto', '0023']]);
  const erp: ErpGateway = {
    listCustomers: async () => new Map([...customers].map(([k, v]) => [k, { ...v }])),
    listActiveSellers: async () => ['000015', '7', '6'],
    listSegments: async () => ({ byDesc: new Map(segs), codes: new Set(['0001', '0023']) }),
    listSellerDocs: async () => docs.map(d => ({ ...d })),
    createSegment: async (c, d) => { segs.set(d.toLowerCase(), c); },
    setCustomerSeller: async (c, v) => { customers.get(c)!.coVen = v; },
    setCustomerSegment: async (c, s) => { customers.get(c)!.coSeg = s; },
    setDocSeller: async (_k, n, v) => {
      if (n === opts.failDoc) throw new Error('boom');
      docs.find(d => d.docNum === n)!.coVen = v;
    },
  };
  return { erp, customers, docs };
}

function fakeStore(): RunStore & { all: Map<string, RunRecord> } {
  const all = new Map<string, RunRecord>();
  return {
    all,
    create: r => { all.set(r.id, r); },
    get: id => all.get(id),
    setStatus: (id, s: RunStatus) => { all.get(id)!.status = s; },
  };
}

const rows: MappingRow[] = [{
  coCli: 'J1', nombre: 'Uno', coVen: '15', grupo: 'Abasto', tipoCliente: 'Independiente',
  clientePrincipal: 'Uno', effectiveFrom: '2026-03-01', sourceNote: '',
}];

async function planFrom(erp: ErpGateway) {
  return buildPlan({
    rows, customers: await erp.listCustomers(), activeSellers: await erp.listActiveSellers(),
    segments: await erp.listSegments(), docs: await erp.listSellerDocs('2026-03-01'), since: '2026-03-01',
  });
}

describe('applyPlan / rollbackRun', () => {
  test('applies, then a second plan is empty (idempotent)', async () => {
    const { erp, customers, docs } = fakeErp();
    const runs = fakeStore();
    const res = await applyPlan({ erp, runs, newId: () => 'run1' }, await planFrom(erp), { mappingFile: 'm.csv' });
    expect(res.failures).toEqual([]);
    expect(customers.get('J1')).toMatchObject({ coVen: '000015', coSeg: '0023' });
    expect(docs.map(d => d.coVen)).toEqual(['000015', '000015']);
    expect(runs.all.get('run1')!.status).toBe('applied');
    const again = await planFrom(erp);
    expect(again.customerSeller.length + again.customerSegment.length + again.docSeller.length).toBe(0);
  });

  test('snapshot is written before any ERP write and rollback restores everything', async () => {
    const { erp, customers, docs } = fakeErp();
    const runs = fakeStore();
    // Record the run status observed at every ERP write; all must be 'pending' (snapshot already stored).
    const statusesAtWrite: (string | undefined)[] = [];
    const observe = <A extends unknown[], R>(fn: (...a: A) => Promise<R>) => async (...a: A) => {
      statusesAtWrite.push(runs.all.get('run1')?.status);
      return fn(...a);
    };
    erp.createSegment = observe(erp.createSegment);
    erp.setCustomerSegment = observe(erp.setCustomerSegment);
    erp.setCustomerSeller = observe(erp.setCustomerSeller);
    erp.setDocSeller = observe(erp.setDocSeller);
    const res = await applyPlan({ erp, runs, newId: () => 'run1' }, await planFrom(erp), { mappingFile: 'm.csv' });
    expect(res.failures).toEqual([]);
    expect(statusesAtWrite.length).toBeGreaterThan(0);
    expect(statusesAtWrite.every(s => s === 'pending')).toBe(true);
    const rb = await rollbackRun({ erp, runs }, 'run1');
    expect(rb.failures).toEqual([]);
    expect(customers.get('J1')).toMatchObject({ coVen: '7', coSeg: '0001' });
    expect(docs.map(d => d.coVen)).toEqual(['7', '6']);
    expect(runs.all.get('run1')!.status).toBe('rolled_back');
  });

  test('a failing document is reported, the run is marked failed, the rest still applies', async () => {
    const { erp, docs } = fakeErp({ failDoc: 'F1' });
    const runs = fakeStore();
    const res = await applyPlan({ erp, runs, newId: () => 'run1' }, await planFrom(erp), { mappingFile: 'm.csv' });
    expect(res.failures[0]).toMatch(/F1.*boom/);
    expect(runs.all.get('run1')!.status).toBe('failed');
    expect(docs.find(d => d.docNum === 'F2')!.coVen).toBe('000015');
    expect(runs.all.get('run1')!.snapshot.docs.map(d => d.docNum)).toContain('F1'); // can still roll back
  });

  test('refuses to apply a plan that has problems', async () => {
    const { erp } = fakeErp();
    const plan = await planFrom(erp);
    plan.problems.push({ kind: 'unknown_customer', coCli: 'X', detail: 'x' });
    await expect(applyPlan({ erp, runs: fakeStore() }, plan, { mappingFile: 'm.csv' })).rejects.toThrow(/problemas/i);
  });
});
