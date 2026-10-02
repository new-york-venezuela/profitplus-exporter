// lib/pricing/segments-service.ts
import type { AppDb } from '@/lib/geo/routes-repo';
import type { SegmentMeta } from '@/lib/db/schema';
import type { SegmentRow } from './tipo-cliente';
import type { CreateSegmentInput, PatchSegmentInput, AssignmentInput } from './validators';
import { buildSegmentName, nextTipCliCode } from './segment-name';
import { daysBetweenIso, todayIso } from './dates';
import { appendAudit, getSegmentMeta, getSegmentMetaMap, setSegmentExpiry, upsertSegmentMeta } from './segments-repo';

export class NotFoundError extends Error { status = 404 as const; constructor(m: string) { super(m); this.name = 'NotFoundError'; } }
export class ConflictError extends Error { status = 409 as const; constructor(m: string) { super(m); this.name = 'ConflictError'; } }
export class ValidationError extends Error { status = 400 as const; constructor(m: string) { super(m); this.name = 'ValidationError'; } }

export type SegmentMoveResult = { coCli: string; outcome: 'success' | 'conflict' | 'error'; message?: string; previousTipCli?: string };

export interface SegmentErp {
  listCodes(): Promise<string[]>;
  listSegments(): Promise<SegmentRow[]>;
  getSegment(tipCli: string): Promise<SegmentRow | null>;
  createSegment(p: { tipCli: string; desTipo: string; coPrecio: string; user: string }): Promise<void>;
  updateSegment(p: { tipCli: string; desTipo: string | null; coPrecio: string | null; validador: string; user: string }): Promise<'success' | 'conflict'>;
  getCustomer(coCli: string): Promise<{ coCli: string; cliDes: string; tipCli: string } | null>;
  moveCustomer(coCli: string, targetTipCli: string, user: string): Promise<SegmentMoveResult>;
}

export interface ServiceDeps { erp: SegmentErp; db: AppDb; now?: () => Date }
export interface Actor { id: string; erpUser: string }

export interface SegmentDto {
  tipCli: string; desTipo: string; coPrecio: string; desPrecio: string | null;
  customerCount: number; validador: string;
  kind: 'group' | 'special'; expiresAt: string | null; reason: string | null;
  customerCoCli: string | null; fallbackTipCli: string | null; daysLeft: number | null;
}

const today = (d: ServiceDeps) => todayIso((d.now ?? (() => new Date()))());

function toDto(row: SegmentRow, meta: SegmentMeta | undefined, todayStr: string): SegmentDto {
  const expiresAt = meta?.expiresAt ?? null;
  return {
    ...row,
    kind: meta?.kind ?? 'group',
    expiresAt,
    reason: meta?.reason ?? null,
    customerCoCli: meta?.customerCoCli ?? null,
    fallbackTipCli: meta?.fallbackTipCli ?? null,
    daysLeft: expiresAt ? daysBetweenIso(todayStr, expiresAt) : null,
  };
}

export async function listSegmentDtos(deps: ServiceDeps): Promise<SegmentDto[]> {
  const [rows, metas] = [await deps.erp.listSegments(), getSegmentMetaMap(deps.db)];
  const t = today(deps);
  return rows.map(r => toDto(r, metas.get(r.tipCli), t));
}

export async function getSegmentDto(deps: ServiceDeps, tipCli: string): Promise<SegmentDto> {
  const row = await deps.erp.getSegment(tipCli);
  if (!row) throw new NotFoundError('Segmento no encontrado');
  return toDto(row, getSegmentMeta(deps.db, tipCli), today(deps));
}

export async function createSegment(
  deps: ServiceDeps, input: CreateSegmentInput, actor: Actor,
): Promise<{ segment: SegmentDto; move?: SegmentMoveResult }> {
  const t = today(deps);
  const nowMs = (deps.now ?? (() => new Date()))().getTime();

  if (input.kind === 'group') {
    const tipCli = nextTipCliCode(await deps.erp.listCodes());
    await deps.erp.createSegment({ tipCli, desTipo: input.desTipo, coPrecio: input.coPrecio, user: actor.erpUser });
    upsertSegmentMeta(deps.db, { tipCli, kind: 'group', createdBy: actor.id, createdAt: nowMs });
    appendAudit(deps.db, { userId: actor.id, action: 'segment_create', target: tipCli, after: { desTipo: input.desTipo, coPrecio: input.coPrecio, kind: 'group' }, now: nowMs });
    return { segment: await getSegmentDto(deps, tipCli) };
  }

  const customer = await deps.erp.getCustomer(input.customerCoCli);
  if (!customer) throw new NotFoundError('Cliente no encontrado');
  const desTipo = buildSegmentName({ customerName: customer.cliDes, reason: input.reason, endsOn: input.expiresOn, today: t });
  const tipCli = nextTipCliCode(await deps.erp.listCodes());

  await deps.erp.createSegment({ tipCli, desTipo, coPrecio: input.coPrecio, user: actor.erpUser });
  upsertSegmentMeta(deps.db, {
    tipCli, kind: 'special', customerCoCli: customer.coCli, reason: input.reason, expiresAt: input.expiresOn,
    fallbackTipCli: input.fallbackTipCli ?? customer.tipCli, previousTipCli: customer.tipCli,
    createdBy: actor.id, createdAt: nowMs,
  });
  appendAudit(deps.db, { userId: actor.id, action: 'segment_create', target: tipCli, after: { desTipo, coPrecio: input.coPrecio, kind: 'special', expiresOn: input.expiresOn }, now: nowMs });

  const move = await deps.erp.moveCustomer(customer.coCli, tipCli, actor.erpUser);
  if (move.outcome === 'success') {
    appendAudit(deps.db, { userId: actor.id, action: 'customer_move', target: customer.coCli, before: { tipCli: customer.tipCli }, after: { tipCli }, now: nowMs });
  }
  return { segment: await getSegmentDto(deps, tipCli), move };
}

export async function patchSegment(deps: ServiceDeps, tipCli: string, input: PatchSegmentInput, actor: Actor): Promise<SegmentDto> {
  const current = await deps.erp.getSegment(tipCli);
  if (!current) throw new NotFoundError('Segmento no encontrado');
  const before = { desTipo: current.desTipo, coPrecio: current.coPrecio }; // snapshot: adapters may return live objects
  const nowMs = (deps.now ?? (() => new Date()))().getTime();

  if (input.expiresOn !== undefined) {
    const meta = getSegmentMeta(deps.db, tipCli);
    if (!meta || meta.kind !== 'special') throw new ValidationError('Solo los segmentos especiales tienen vencimiento');
  }

  if (input.desTipo !== undefined || input.coPrecio !== undefined) {
    const outcome = await deps.erp.updateSegment({
      tipCli, desTipo: input.desTipo ?? null, coPrecio: input.coPrecio ?? null,
      validador: input.validador!, user: actor.erpUser,
    });
    if (outcome === 'conflict') throw new ConflictError('El segmento fue modificado por otro usuario; recargue e intente de nuevo');
    if (input.coPrecio !== undefined && input.coPrecio !== before.coPrecio) {
      appendAudit(deps.db, { userId: actor.id, action: 'segment_repoint', target: tipCli, before: { coPrecio: before.coPrecio }, after: { coPrecio: input.coPrecio }, now: nowMs });
    }
    if (input.desTipo !== undefined && input.desTipo !== before.desTipo) {
      appendAudit(deps.db, { userId: actor.id, action: 'segment_rename', target: tipCli, before: { desTipo: before.desTipo }, after: { desTipo: input.desTipo }, now: nowMs });
    }
  }

  if (input.expiresOn !== undefined) setSegmentExpiry(deps.db, tipCli, input.expiresOn);
  return getSegmentDto(deps, tipCli);
}

export async function assignCustomers(deps: ServiceDeps, input: AssignmentInput, actor: Actor): Promise<SegmentMoveResult[]> {
  const target = await deps.erp.getSegment(input.targetTipCli);
  if (!target) throw new NotFoundError('Segmento destino no encontrado');
  const nowMs = (deps.now ?? (() => new Date()))().getTime();

  const results: SegmentMoveResult[] = [];
  for (const coCli of input.customerCodes) {
    const r = await deps.erp.moveCustomer(coCli, input.targetTipCli, actor.erpUser);
    if (r.outcome === 'success' && r.previousTipCli && r.previousTipCli !== input.targetTipCli) {
      appendAudit(deps.db, { userId: actor.id, action: 'customer_move', target: coCli, before: { tipCli: r.previousTipCli }, after: { tipCli: input.targetTipCli }, now: nowMs });
    }
    results.push(r);
  }
  return results;
}
