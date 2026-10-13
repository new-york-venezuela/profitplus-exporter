import { describe, test, expect } from 'bun:test';
import { applyPlan, rollbackRun } from '../../../lib/customer-mapping/apply';
import { buildPlan } from '../../../lib/customer-mapping/plan';
import type { ErpGateway, ErpCustomerState, SellerDoc } from '../../../lib/customer-mapping/erp';
import type { RunRecord, RunStore, RunStatus } from '../../../lib/customer-mapping/runs-repo';
import type { MappingRow } from '../../../lib/customer-mapping/types';

function fakeErp(opts: { failDoc?: string; inactiveSellers?: string[] } = {}) {
  const customers = new Map<string, ErpCustomerState>([
    ['J1', { coCli: 'J1', coVen: '7', coSeg: '0001', coZon: 'CCS', frecuVist: null }],
  ]);
  const zones = new Set<string>(['CCS']);
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
    setCustomerSeller: async (c, v) => {
      if (opts.inactiveSellers?.includes(v)) throw new Error(`Vendedor ${v} no encontrado`);
      customers.get(c)!.coVen = v;
    },
    restoreCustomerSeller: async (c, v) => { customers.get(c)!.coVen = v; },
    setCustomerSegment: async (c, s) => { customers.get(c)!.coSeg = s; },
    setDocSeller: async (_k, n, v) => {
      if (n === opts.failDoc) throw new Error('boom');
      docs.find(d => d.docNum === n)!.coVen = v;
    },
    listZones: async () => new Set(zones),
    createZone: async (c) => { zones.add(c); },
    setCustomerRoute: async (c, z, f) => { customers.get(c)!.coZon = z; customers.get(c)!.frecuVist = f; },
    restoreCustomerRoute: async (c, z, f) => { customers.get(c)!.coZon = z; customers.get(c)!.frecuVist = f; },
  };
  return { erp, customers, docs, zones };
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

const T = 'srv/DB1';

const rows: MappingRow[] = [{
  coCli: 'J1', nombre: 'Uno', coVen: '15', grupo: 'Abasto', ruta: 5, frecuencia: 'QUINCENAL' }];

async function planFrom(erp: ErpGateway) {
  return buildPlan({
    rows, customers: await erp.listCustomers(), activeSellers: await erp.listActiveSellers(),
    segments: await erp.listSegments(), zones: await erp.listZones(),
    docs: await erp.listSellerDocs('2026-03-01'), since: '2026-03-01',
  });
}

describe('applyPlan / rollbackRun', () => {
  test('applies, then a second plan is empty (idempotent)', async () => {
    const { erp, customers, docs, zones } = fakeErp();
    const runs = fakeStore();
    const res = await applyPlan({ erp, runs, target: T, newId: () => 'run1' }, await planFrom(erp), { mappingFile: 'm.csv' });
    expect(res.failures).toEqual([]);
    expect(customers.get('J1')).toMatchObject({ coVen: '000015', coSeg: '0023', coZon: 'CCS005', frecuVist: 'QUINCENAL' });
    expect(zones.has('CCS005')).toBe(true);
    expect(docs.map(d => d.coVen)).toEqual(['000015', '000015']);
    expect(runs.all.get('run1')!.status).toBe('applied');
    const again = await planFrom(erp);
    expect(again.customerSeller.length + again.customerSegment.length + again.docSeller.length +
      again.customerRoute.length + again.zonesToCreate.length).toBe(0);
  });

  test('snapshot is written before any ERP write and rollback restores everything', async () => {
    const { erp, customers, docs, zones } = fakeErp();
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
    erp.createZone = observe(erp.createZone);
    erp.setCustomerRoute = observe(erp.setCustomerRoute);
    const res = await applyPlan({ erp, runs, target: T, newId: () => 'run1' }, await planFrom(erp), { mappingFile: 'm.csv' });
    expect(res.failures).toEqual([]);
    expect(statusesAtWrite.length).toBeGreaterThan(0);
    expect(statusesAtWrite.every(s => s === 'pending')).toBe(true);
    const rb = await rollbackRun({ erp, runs, target: T }, 'run1');
    expect(rb.failures).toEqual([]);
    expect(customers.get('J1')).toMatchObject({ coVen: '7', coSeg: '0001', coZon: 'CCS', frecuVist: null });
    expect(zones.has('CCS005')).toBe(true); // created zones stay after rollback, like created segments
    expect(docs.map(d => d.coVen)).toEqual(['7', '6']);
    expect(runs.all.get('run1')!.status).toBe('rolled_back');
  });

  test('a failing document is reported, the run is marked failed, the rest still applies', async () => {
    const { erp, docs } = fakeErp({ failDoc: 'F1' });
    const runs = fakeStore();
    const res = await applyPlan({ erp, runs, target: T, newId: () => 'run1' }, await planFrom(erp), { mappingFile: 'm.csv' });
    expect(res.failures[0]).toMatch(/F1.*boom/);
    expect(runs.all.get('run1')!.status).toBe('failed');
    expect(docs.find(d => d.docNum === 'F2')!.coVen).toBe('000015');
    expect(runs.all.get('run1')!.snapshot.docs.map(d => d.docNum)).toContain('F1'); // can still roll back
  });

  test('refuses to apply a plan that has problems', async () => {
    const { erp } = fakeErp();
    const plan = await planFrom(erp);
    plan.problems.push({ kind: 'unknown_customer', coCli: 'X', detail: 'x' });
    await expect(applyPlan({ erp, runs: fakeStore(), target: T }, plan, { mappingFile: 'm.csv' })).rejects.toThrow(/problemas/i);
  });

  test('rollback restores customers through restoreCustomerSeller, even when the previous seller is now inactive', async () => {
    const { erp, customers } = fakeErp({ inactiveSellers: ['7'] });
    const runs = fakeStore();
    const res = await applyPlan({ erp, runs, target: T, newId: () => 'run1' }, await planFrom(erp), { mappingFile: 'm.csv' });
    expect(res.failures).toEqual([]);
    let restored = 0;
    const orig = erp.restoreCustomerSeller;
    erp.restoreCustomerSeller = async (c, v) => { restored++; return orig(c, v); };
    const rb = await rollbackRun({ erp, runs, target: T }, 'run1');
    expect(rb.failures).toEqual([]);
    expect(restored).toBe(1);
    expect(customers.get('J1')!.coVen).toBe('7'); // '7' is inactive: setCustomerSeller would have rejected it
    expect(runs.all.get('run1')!.status).toBe('rolled_back');
  });

  test('rolling back a run whose status is failed restores what was applied', async () => {
    const opts: { failDoc?: string } = { failDoc: 'F1' };
    const { erp, customers, docs } = fakeErp(opts);
    const runs = fakeStore();
    await applyPlan({ erp, runs, target: T, newId: () => 'run1' }, await planFrom(erp), { mappingFile: 'm.csv' });
    expect(runs.all.get('run1')!.status).toBe('failed');
    expect(customers.get('J1')).toMatchObject({ coVen: '000015', coSeg: '0023', coZon: 'CCS005', frecuVist: 'QUINCENAL' });
    expect(docs.find(d => d.docNum === 'F2')!.coVen).toBe('000015');
    opts.failDoc = undefined; // the document that failed on apply can be written again
    const rb = await rollbackRun({ erp, runs, target: T }, 'run1');
    expect(rb.failures).toEqual([]);
    expect(customers.get('J1')).toMatchObject({ coVen: '7', coSeg: '0001', coZon: 'CCS', frecuVist: null });
    expect(docs.map(d => d.coVen)).toEqual(['7', '6']);
    expect(runs.all.get('run1')!.status).toBe('rolled_back');
  });

  test('apply records the target and rollback refuses a run applied to a different database', async () => {
    const { erp, customers } = fakeErp();
    const runs = fakeStore();
    await applyPlan({ erp, runs, target: T, newId: () => 'run1' }, await planFrom(erp), { mappingFile: 'm.csv' });
    expect(runs.all.get('run1')!.target).toBe(T);
    await expect(rollbackRun({ erp, runs, target: 'otro/DB2' }, 'run1')).rejects.toThrow(/srv\/DB1.*otro\/DB2/);
    expect(customers.get('J1')).toMatchObject({ coVen: '000015' }); // nothing was touched
    expect(runs.all.get('run1')!.status).toBe('applied');
    const ok = await rollbackRun({ erp, runs, target: T }, 'run1');
    expect(ok.failures).toEqual([]);
  });

  test('rollback restores the previous route through restoreCustomerRoute, including a NULL and a free-text frequency', async () => {
    for (const previous of [null, 'cada dos semanas']) {
      const { erp, customers } = fakeErp();
      customers.get('J1')!.frecuVist = previous;
      const runs = fakeStore();
      await applyPlan({ erp, runs, target: T, newId: () => 'run1' }, await planFrom(erp), { mappingFile: 'm.csv' });
      expect(customers.get('J1')).toMatchObject({ coZon: 'CCS005', frecuVist: 'QUINCENAL' });
      expect(runs.all.get('run1')!.snapshot.customers[0].route).toEqual({ coZon: 'CCS', frecuVist: previous });
      const calls: unknown[][] = [];
      const orig = erp.restoreCustomerRoute;
      erp.restoreCustomerRoute = async (...a) => { calls.push(a); return orig(...a); };
      const rb = await rollbackRun({ erp, runs, target: T }, 'run1');
      expect(rb.failures).toEqual([]);
      expect(calls).toEqual([['J1', 'CCS', previous]]);
      expect(customers.get('J1')).toMatchObject({ coZon: 'CCS', frecuVist: previous });
    }
  });
  test('a run snapshotted before this change (no route field) still rolls back', async () => {
    const { erp, customers } = fakeErp();
    const runs = fakeStore();
    runs.create({ id: 'old', createdAt: 1, mappingFile: 'm.csv', target: T, status: 'applied',
      snapshot: { customers: [{ coCli: 'J1', coVen: '7' }], docs: [] } });
    customers.get('J1')!.coVen = '000015';
    customers.get('J1')!.coZon = 'CCS005';
    const calls: unknown[][] = [];
    erp.restoreCustomerRoute = async (...a) => { calls.push(a); };
    expect((await rollbackRun({ erp, runs, target: T }, 'old')).failures).toEqual([]);
    expect(customers.get('J1')!.coVen).toBe('7');
    expect(calls).toEqual([]); // no route in the snapshot: the route is left alone
    expect(customers.get('J1')!.coZon).toBe('CCS005');
  });
});
