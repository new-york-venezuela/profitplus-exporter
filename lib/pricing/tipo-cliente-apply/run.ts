import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import type { AppDb } from '@/lib/geo/routes-repo';
import type { RatesErp } from '../lists-service';
import { createSegment, type Actor, type SegmentErp } from '../segments-service';
import { appendAudit, getSegmentMetaMap } from '../segments-repo';
import { buildTipoClientePlan, type PlanCustomer, type PlanSegment, type TipoClientePlan } from './plan';
import type { TipoClienteRow } from './csv';

export interface TipoClienteDeps { segments: SegmentErp; rates: RatesErp; db: AppDb }

export async function planTipoCliente(deps: TipoClienteDeps, rows: TipoClienteRow[]): Promise<TipoClientePlan> {
  const [segs, lists] = await Promise.all([deps.segments.listSegments(), deps.rates.listLists()]);
  const metas = getSegmentMetaMap(deps.db);
  const segments: PlanSegment[] = segs.map(s => ({
    tipCli: s.tipCli, desTipo: s.desTipo, coPrecio: s.coPrecio, special: metas.get(s.tipCli)?.kind === 'special',
  }));
  const customers = new Map<string, PlanCustomer>();
  for (const r of rows) {
    if (!r.target) continue;
    const c = await deps.segments.getCustomer(r.coCli);
    if (c) customers.set(r.coCli.trim().toUpperCase(), c);
  }
  return buildTipoClientePlan(rows, {
    customers, segments,
    lists: lists.map(l => ({ coPrecio: l.coPrecio, desPrecio: l.desPrecio, coMone: l.coMone, rateCount: l.rateCount })),
  });
}

export interface MoveOutcome { coCli: string; nombre: string; to: string; outcome: 'success' | 'conflict' | 'error'; message?: string }
export interface ApplyResult { createdSegments: { coPrecio: string; tipCli: string }[]; moves: MoveOutcome[] }

/**
 * Creates the missing segments, then moves each customer through the same ERP procedure as the Segmentos tab.
 * Every success is appended to `runFile` (JSON lines) as it happens so an interrupted run can still be rolled back.
 */
export async function applyTipoCliente(deps: TipoClienteDeps, plan: TipoClientePlan, actor: Actor, runFile: string): Promise<ApplyResult> {
  const created = new Map<string, string>();
  const createdSegments: ApplyResult['createdSegments'] = [];
  for (const s of plan.segmentsToCreate) {
    const { segment } = await createSegment({ erp: deps.segments, db: deps.db }, { kind: 'group', desTipo: s.desTipo, coPrecio: s.coPrecio }, actor);
    created.set(s.coPrecio, segment.tipCli);
    createdSegments.push({ coPrecio: s.coPrecio, tipCli: segment.tipCli });
    appendFileSync(runFile, `${JSON.stringify({ type: 'segment', coPrecio: s.coPrecio, tipCli: segment.tipCli })}\n`);
  }

  const moves: MoveOutcome[] = [];
  for (const m of plan.moves) {
    const to = m.toTipCli ?? created.get(m.createForList ?? '') ?? '';
    try {
      const r = await deps.segments.moveCustomer(m.coCli, to, actor.erpUser);
      moves.push({ coCli: m.coCli, nombre: m.nombre, to, outcome: r.outcome, message: r.message });
      if (r.outcome === 'success') {
        appendFileSync(runFile, `${JSON.stringify({ type: 'move', coCli: m.coCli, from: m.fromTipCli, to })}\n`);
        try {
          appendAudit(deps.db, { userId: actor.id, action: 'customer_move', target: m.coCli, before: { tipCli: m.fromTipCli }, after: { tipCli: to }, now: Date.now() });
        } catch (e) { console.error(`Audit write failed for ${m.coCli}:`, e); }
      }
    } catch (e) {
      console.error(`Move failed for ${m.coCli}:`, e);
      moves.push({ coCli: m.coCli, nombre: m.nombre, to, outcome: 'error', message: 'Error al mover el cliente' });
    }
  }
  return { createdSegments, moves };
}

export interface RollbackResult { restored: number; skipped: { coCli: string; reason: string }[] }

/** Sends customers back to their previous segment, unless someone moved them elsewhere since. Created segments are kept. */
export async function rollbackTipCliente(deps: TipoClienteDeps, runFile: string, actor: Actor): Promise<RollbackResult> {
  if (!existsSync(runFile)) throw new Error(`No existe el registro de la corrida: ${runFile}`);
  const lines = readFileSync(runFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as { type: string; coCli?: string; from?: string; to?: string });
  const out: RollbackResult = { restored: 0, skipped: [] };
  for (const l of lines.filter(x => x.type === 'move').reverse()) {
    const coCli = l.coCli!;
    const current = await deps.segments.getCustomer(coCli);
    if (!current) { out.skipped.push({ coCli, reason: 'el cliente ya no existe' }); continue; }
    if (current.tipCli.trim() !== l.to!.trim()) { out.skipped.push({ coCli, reason: `ahora está en ${current.tipCli}, no en ${l.to}; no se toca` }); continue; }
    const r = await deps.segments.moveCustomer(coCli, l.from!, actor.erpUser);
    if (r.outcome === 'success') out.restored++; else out.skipped.push({ coCli, reason: r.outcome });
  }
  return out;
}
