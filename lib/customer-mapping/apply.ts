import type { ErpGateway } from './erp';
import type { Plan } from './plan';
import type { RunSnapshot, RunStore } from './runs-repo';

export interface ApplyDeps {
  erp: ErpGateway;
  runs: RunStore;
  target: string;           // which ERP database this process points at, e.g. `${DB_SERVER}/${DB_NAME}`
  now?: () => number;
  newId?: () => string;
  log?: (m: string) => void;
}

function snapshotOf(plan: Plan): RunSnapshot {
  const customers = new Map<string, RunSnapshot['customers'][number]>();
  const entry = (coCli: string) => {
    if (!customers.has(coCli)) customers.set(coCli, { coCli });
    return customers.get(coCli)!;
  };
  for (const c of plan.customerSeller) entry(c.coCli).coVen = c.from;
  for (const c of plan.customerSegment) if (c.from) entry(c.coCli).coSeg = c.from;
  for (const c of plan.customerRoute) entry(c.coCli).route = { coZon: c.fromZon, frecuVist: c.fromFrec };
  return {
    customers: [...customers.values()],
    docs: plan.docSeller.map(d => ({ kind: d.kind, docNum: d.docNum, coVen: d.from })),
  };
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function applyPlan(
  deps: ApplyDeps, plan: Plan, meta: { mappingFile: string },
): Promise<{ runId: string; failures: string[] }> {
  if (plan.problems.length > 0) {
    throw new Error(`El plan tiene ${plan.problems.length} problemas; corrija el CSV antes de aplicar`);
  }
  const { erp, runs } = deps;
  const log = deps.log ?? (() => {});
  const runId = (deps.newId ?? (() => crypto.randomUUID()))();

  // Snapshot BEFORE the first write, so a crash mid-run is still recoverable with --rollback.
  runs.create({
    id: runId, createdAt: (deps.now ?? Date.now)(), mappingFile: meta.mappingFile, target: deps.target,
    status: 'pending', snapshot: snapshotOf(plan),
  });

  const failures: string[] = [];
  const attempt = async (label: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { failures.push(`${label}: ${msg(e)}`); }
  };

  for (const s of plan.segmentsToCreate) await attempt(`segmento ${s.segDes}`, () => erp.createSegment(s.coSeg, s.segDes));
  for (const z of plan.zonesToCreate) await attempt(`zona ${z.coZon}`, () => erp.createZone(z.coZon, z.zonDes));
  for (const c of plan.customerSegment) await attempt(`cliente ${c.coCli} segmento`, () => erp.setCustomerSegment(c.coCli, c.to));
  for (const c of plan.customerRoute) await attempt(`cliente ${c.coCli} ruta`, () => erp.setCustomerRoute(c.coCli, c.toZon, c.toFrec));
  for (const c of plan.customerSeller) await attempt(`cliente ${c.coCli} vendedor`, () => erp.setCustomerSeller(c.coCli, c.to));
  let done = 0;
  for (const d of plan.docSeller) {
    await attempt(`${d.kind} ${d.docNum}`, () => erp.setDocSeller(d.kind, d.docNum, d.to));
    if (++done % 200 === 0) log(`  documentos: ${done}/${plan.docSeller.length}`);
  }

  runs.setStatus(runId, failures.length ? 'failed' : 'applied');
  return { runId, failures };
}

export async function rollbackRun(deps: ApplyDeps, runId: string): Promise<{ failures: string[] }> {
  const run = deps.runs.get(runId);
  if (!run) throw new Error(`Corrida ${runId} no encontrada`);
  if (run.status === 'rolled_back') throw new Error(`La corrida ${runId} ya fue revertida`);
  if (run.target !== deps.target) {
    throw new Error(`La corrida ${runId} se aplicó en '${run.target}', pero esta sesión apunta a '${deps.target}'; no se revierte`);
  }

  const failures: string[] = [];
  const attempt = async (label: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { failures.push(`${label}: ${msg(e)}`); }
  };
  for (const c of run.snapshot.customers) {
    if (c.coSeg) await attempt(`cliente ${c.coCli} segmento`, () => deps.erp.setCustomerSegment(c.coCli, c.coSeg!));
    if (c.route) await attempt(`cliente ${c.coCli} ruta`, () => deps.erp.restoreCustomerRoute(c.coCli, c.route!.coZon, c.route!.frecuVist));
    if (c.coVen) await attempt(`cliente ${c.coCli} vendedor`, () => deps.erp.restoreCustomerSeller(c.coCli, c.coVen!));
  }
  for (const d of run.snapshot.docs) await attempt(`${d.kind} ${d.docNum}`, () => deps.erp.setDocSeller(d.kind, d.docNum, d.coVen));

  if (failures.length === 0) deps.runs.setStatus(runId, 'rolled_back');
  return { failures };
}
