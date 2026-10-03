// lib/pricing/promotions-service.ts
import type { AppDb } from '@/lib/geo/routes-repo';
import type { Promotion, PromotionCustomer, PromotionItem } from '@/lib/db/schema';
import type { CreatePromotionInput, PatchPromotionInput } from './promo-validators';
import { planRatePeriod, same, type RatePlan, type RateRow } from './rate-planner';
import { continuationMonto, findMaterialisedPromo, planCancelPromo, planChangePromoEnd } from './promo-planner';
import { promotionStatus, strandedItems, type PromotionStatus } from './promo-status';
import { addDaysIso, daysBetweenIso, todayIso } from './dates';
import { buildSegmentName, formatShortDate } from './segment-name';
import { appendAudit, getSegmentMeta, getSegmentMetaMap, setSegmentExpiry, upsertSegmentMeta } from './segments-repo';
import {
  cancelPromotion, getPromotion, insertCustomers, insertItems, insertPromotion, listCustomers, listItems,
  listPromotions, listTrackedPromoRows, markCustomerMoved, setPromotionEnd, setPromotionTipCli, updateItem,
} from './promotions-repo';
import {
  cloneList, currentOf, getListDto, isMixedCurrency, MIXED_CURRENCY_MSG, resolveArticleWarehouse,
  type CloneRow, type ListsDeps, type RatesErp,
} from './lists-service';
import { createSegmentInErp, NotFoundError, ValidationError, type Actor, type SegmentErp } from './segments-service';

export interface PromotionsDeps { rates: RatesErp; segments: SegmentErp; db: AppDb; now?: () => Date }
export interface PromotionItemDto {
  coArt: string; artDes: string; promoMonto: number; regularMonto: number | null; applied: boolean; message: string | null;
  appliedFrom: string | null; appliedTo: string | null; cancelledOn: string | null;
}
export interface PromotionDto {
  id: number; name: string; reason: string | null; kind: 'overlay' | 'segment'; coPrecio: string; desPrecio: string | null;
  baseCoPrecio: string | null; tipCli: string | null; startsOn: string; endsOn: string;
  status: PromotionStatus; daysLeft: number | null;
  itemCount: number; appliedCount: number; partial: boolean;
  customerCount: number; movedCount: number;
}
export interface PromotionDetailDto extends PromotionDto {
  items: PromotionItemDto[];
  customers: { coCli: string; cliDes: string; previousTipCli: string; moved: boolean }[];
  warning?: string;
}
export interface PreviewRow { coArt: string; artDes: string; regular: number | null; promo: number; status: 'ok' | 'rejected'; message: string | null }
export interface PreviewCustomer { coCli: string; cliDes: string; previousTipCli: string }

const AMBIGUOUS_MSG = 'El artículo tiene tarifas en varios almacenes en esta lista';
const GENERIC_ITEM_ERROR = 'Error al aplicar el precio de este artículo';
const CONFLICT_MSG = 'Conflicto: la tarifa fue modificada por otro usuario; reintente';
const MISSING_REGULAR_MSG = 'Falta el precio regular registrado de este artículo';
const NO_WAREHOUSE_MSG = 'No se conoce el almacén de este artículo';
const NO_CURRENCY_MSG = 'La lista no tiene moneda definida';
const CANCELLING_MSG = 'La promoción se está cancelando; vuelve a cancelar para completar';
const INTERNAL_WARNING = 'Promoción procesada en Profit pero faltan registros internos; avise a un administrador';
const DETAIL_WARNING = 'Promoción creada; no se pudieron leer los nombres desde Profit. Recargue para verlos';
const SEGMENT_WARNING = 'No se pudo crear el segmento especial en Profit; reintente la promoción';

const clock = (d: PromotionsDeps) => (d.now ?? (() => new Date()))();
const today = (d: PromotionsDeps) => todayIso(clock(d));
const listsDeps = (d: PromotionsDeps): ListsDeps => ({ erp: d.rates, db: d.db, now: d.now });

/** SQLite write that must not fail the request once the ERP has been touched. */
function tryDb(label: string, fn: () => void): boolean {
  try { fn(); return true; } catch (e) { console.error(`Pricing: ${label}:`, e); return false; }
}

// ---------- reading ----------

/**
 * An applied item whose tracked end differs from the promotion's still needs converging. Once the promotion has ended,
 * only items whose promo row still reaches today or later (stranded by a partly failed shortening) are pending.
 */
const isPending = (p: Promotion, i: PromotionItem, t: string) =>
  i.appliedFrom !== null && i.cancelledOn === null && i.appliedTo !== p.endsOn
  && (t <= p.endsOn || (i.appliedTo ?? '') >= t);

function toDto(p: Promotion, items: PromotionItem[], customers: PromotionCustomer[], desPrecio: string | null, t: string): PromotionDto {
  const status = promotionStatus(p, t);
  const appliedCount = items.filter(i => i.applied === 1).length;
  const movedCount = customers.filter(c => c.moved === 1).length;
  const unfinished = appliedCount < items.length || items.some(i => isPending(p, i, t) || i.cancelledOn !== null)
    || (p.kind === 'segment' && movedCount < customers.length);
  return {
    id: p.id, name: p.name, reason: p.reason, kind: p.kind, coPrecio: p.coPrecio, desPrecio,
    baseCoPrecio: p.baseCoPrecio, tipCli: p.tipCli, startsOn: p.startsOn, endsOn: p.endsOn,
    status, daysLeft: status === 'scheduled' || status === 'active' ? daysBetweenIso(t, p.endsOn) : null,
    itemCount: items.length, appliedCount, partial: status !== 'cancelled' && unfinished,
    customerCount: customers.length, movedCount,
  };
}

export async function listPromotionDtos(deps: PromotionsDeps): Promise<PromotionDto[]> {
  const t = today(deps);
  const names = new Map((await deps.rates.listLists()).map(l => [l.coPrecio, l.desPrecio]));
  return listPromotions(deps.db)
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn) || b.id - a.id)
    .map(p => toDto(p, listItems(deps.db, p.id), listCustomers(deps.db, p.id), names.get(p.coPrecio) ?? null, t));
}

export async function getPromotionDetail(deps: PromotionsDeps, id: number, warning?: string): Promise<PromotionDetailDto> {
  const p = getPromotion(deps.db, id);
  if (!p) throw new NotFoundError('Promoción no encontrada');
  const items = listItems(deps.db, id);
  const customers = listCustomers(deps.db, id);
  const [articles, list, custNames] = await Promise.all([
    deps.rates.listArticles({ limit: 5000 }),
    deps.rates.getList(p.coPrecio),
    Promise.all(customers.map(c => deps.segments.getCustomer(c.coCli))),
  ]);
  const names = new Map(articles.map(a => [a.coArt, a.artDes]));
  return {
    ...toDto(p, items, customers, list?.desPrecio ?? null, today(deps)),
    items: items.map(i => ({
      coArt: i.coArt, artDes: names.get(i.coArt) ?? i.coArt, promoMonto: i.promoMonto,
      regularMonto: i.regularMonto, applied: i.applied === 1, message: i.message,
      appliedFrom: i.appliedFrom, appliedTo: i.appliedTo, cancelledOn: i.cancelledOn,
    })),
    customers: customers.map((c, k) => ({ coCli: c.coCli, cliDes: custNames[k]?.cliDes ?? c.coCli, previousTipCli: c.previousTipCli, moved: c.moved === 1 })),
    ...(warning ? { warning } : {}),
  };
}

/** Detail built from SQLite only (no ERP names): used when the ERP reads fail after the writes already succeeded. */
function localDetail(deps: PromotionsDeps, id: number, warning: string): PromotionDetailDto {
  const p = getPromotion(deps.db, id)!;
  const items = listItems(deps.db, id);
  const customers = listCustomers(deps.db, id);
  return {
    ...toDto(p, items, customers, null, today(deps)),
    items: items.map(i => ({
      coArt: i.coArt, artDes: i.coArt, promoMonto: i.promoMonto, regularMonto: i.regularMonto, applied: i.applied === 1,
      message: i.message, appliedFrom: i.appliedFrom, appliedTo: i.appliedTo, cancelledOn: i.cancelledOn,
    })),
    customers: customers.map(c => ({
      coCli: c.coCli, cliDes: c.coCli, previousTipCli: c.previousTipCli, moved: c.moved === 1,
    })),
    warning,
  };
}

// ---------- per-article inspection (shared by preview and apply) ----------

interface RateCtx {
  deps: PromotionsDeps; coPrecio: string; coMone: string | null; t: string;
  byArt: Map<string, RateRow[]>; fallbackAlma?: string | null;
}

async function makeCtx(deps: PromotionsDeps, coPrecio: string, coMone: string | null): Promise<RateCtx> {
  const byArt = new Map<string, RateRow[]>();
  for (const r of await deps.rates.readListRates(coPrecio)) {
    const a = byArt.get(r.coArt);
    if (a) a.push(r); else byArt.set(r.coArt, [r]);
  }
  return { deps, coPrecio, coMone, t: today(deps), byArt };
}

type Inspection = { ok: true; coAlma: string; rows: RateRow[]; covering: RateRow | null } | { ok: false; message: string };

async function inspectArticle(ctx: RateCtx, coArt: string, at: string): Promise<Inspection> {
  const all = ctx.byArt.get(coArt) ?? [];
  if (all.length === 0 && ctx.fallbackAlma === undefined) {
    ctx.fallbackAlma = (await ctx.deps.rates.dominantWarehouse(ctx.coPrecio)) ?? (await ctx.deps.rates.dominantWarehouse()) ?? 'TODOS';
  }
  const w = resolveArticleWarehouse(all, ctx.fallbackAlma ?? null, null);
  if ('ambiguous' in w) return { ok: false, message: AMBIGUOUS_MSG };
  const rows = all.filter(r => r.coAlma === w.coAlma);
  const covering = currentOf(rows, at);
  if (ctx.coMone && isMixedCurrency(covering, ctx.coMone)) return { ok: false, message: MIXED_CURRENCY_MSG };
  return { ok: true, coAlma: w.coAlma, rows, covering };
}

async function runPlan(
  ctx: RateCtx, coArt: string, coAlma: string, user: string, plan: (rows: RateRow[]) => RatePlan,
): Promise<{ ok: boolean; message: string | null }> {
  try {
    const out = await ctx.deps.rates.applyPlanned({ coPrecio: ctx.coPrecio, coArt, coAlma, coMone: ctx.coMone, user, today: ctx.t }, plan);
    if (out.outcome === 'success' || out.outcome === 'skipped') return { ok: true, message: null };
    if (out.outcome === 'rejected') return { ok: false, message: out.message };
    return { ok: false, message: CONFLICT_MSG };
  } catch (e) {
    console.error(`Pricing: rate write failed on list ${ctx.coPrecio}, article ${coArt}:`, e);
    return { ok: false, message: GENERIC_ITEM_ERROR };
  }
}

// ---------- apply (create / retry) ----------

type ItemPatch = Parameters<typeof updateItem>[3];

/**
 * Applies the promo from max(startsOn, today) to endsOn. Progress (appliedFrom/appliedTo) is recorded only after the
 * ERP write; if that record is lost, a promo row already sitting in the ERP is detected and recorded instead of rewritten.
 */
async function computeApply(ctx: RateCtx, promo: Promotion, item: PromotionItem, user: string): Promise<ItemPatch> {
  const effFrom = promo.startsOn > ctx.t ? promo.startsOn : ctx.t;
  const ins = await inspectArticle(ctx, item.coArt, effFrom);
  if (!ins.ok) return { applied: false, message: ins.message };
  const existing = findMaterialisedPromo(ins.rows, { froms: [promo.startsOn, effFrom], to: promo.endsOn, monto: item.promoMonto });
  const c = ins.covering;
  const isPromoRow = !!c && c.hasta === promo.endsOn && same(c.monto, item.promoMonto);
  const regularMonto = existing || isPromoRow || !c
    ? item.regularMonto ?? continuationMonto(ins.rows, promo.endsOn)
    : c.monto;
  const done = (from: string, message: string | null): ItemPatch =>
    ({ coAlma: ins.coAlma, regularMonto, applied: true, appliedFrom: from, appliedTo: promo.endsOn, message });
  if (existing) return done(existing.desde, null);

  const r = await runPlan(ctx, item.coArt, ins.coAlma, user, rows =>
    planRatePeriod(rows, { from: effFrom, to: promo.endsOn, monto: item.promoMonto, today: ctx.t }));
  if (!r.ok) return { coAlma: ins.coAlma, regularMonto, applied: false, message: r.message };
  return done(effFrom, effFrom > promo.startsOn ? `Aplicada desde hoy (inicio original: ${formatShortDate(promo.startsOn, ctx.t)})` : null);
}

async function applyItem(ctx: RateCtx, promo: Promotion, item: PromotionItem, user: string): Promise<void> {
  // A cancellation may have started since the items were listed: never write a promo row for a cancelled item.
  const fresh = listItems(ctx.deps.db, promo.id).find(i => i.coArt === item.coArt);
  if (!fresh || fresh.cancelledOn !== null || getPromotion(ctx.deps.db, promo.id)?.cancelledAt != null) return;
  let patch: ItemPatch;
  try {
    patch = await computeApply(ctx, promo, item, user);
  } catch (e) {
    console.error(`Pricing: applying promotion ${promo.id} item ${item.coArt} failed:`, e);
    patch = { applied: false, message: GENERIC_ITEM_ERROR };
  }
  tryDb(`promotion ${promo.id} item ${item.coArt} state`, () => updateItem(ctx.deps.db, promo.id, item.coArt, patch));
}

async function applyItems(deps: PromotionsDeps, promo: Promotion, items: PromotionItem[], user: string): Promise<void> {
  if (items.length === 0) return;
  const coMone = (await getListDto(listsDeps(deps), promo.coPrecio)).coMone;
  if (!coMone) {
    for (const i of items) tryDb(`item ${i.coArt} message`, () => updateItem(deps.db, promo.id, i.coArt, { applied: false, message: NO_CURRENCY_MSG }));
    return;
  }
  const ctx = await makeCtx(deps, promo.coPrecio, coMone);
  for (const item of items) await applyItem(ctx, promo, item, user);
}

// ---------- change end / cancel (per item, resumable) ----------

/** Cancel plan that is a no-op when the promo row was already trimmed/repriced by an earlier attempt that was not recorded. */
function planCancelIdempotent(rows: RateRow[], p: { from: string; to: string; regularMonto: number; today: string }): RatePlan {
  const whole = rows.find(r => r.desde === p.from && r.hasta === p.to);
  if (whole && p.today <= p.from && same(whole.monto, p.regularMonto)) return { ok: true, skipped: true, ops: [] };
  const trimmed = rows.find(r => r.desde === p.from && r.hasta !== null && r.hasta < p.to);
  if (trimmed && rows.some(r => r.desde === addDaysIso(trimmed.hasta!, 1) && r.hasta === p.to && same(r.monto, p.regularMonto))) {
    return { ok: true, skipped: true, ops: [] };
  }
  return planCancelPromo(rows, p);
}

/** If the promo row already ends at the new date (an earlier attempt that was not recorded), nothing to do. */
function planChangeEndIdempotent(rows: RateRow[], p: { from: string; to: string; newTo: string; regularMonto: number; today: string }): RatePlan {
  if (p.newTo !== p.to && rows.some(r => r.desde === p.from && r.hasta === p.newTo)) return { ok: true, skipped: true, ops: [] };
  return planChangePromoEnd(rows, p);
}

const recordItem = (ctx: RateCtx, promo: Promotion, item: PromotionItem, patch: ItemPatch) =>
  tryDb(`item ${item.coArt} progress`, () => updateItem(ctx.deps.db, promo.id, item.coArt, patch));

/**
 * Cancels an item with no recorded promo row: a row may still be in the ERP (lost SQLite record, or a concurrent
 * retry), so the locked rows are searched for it and it is cancelled if found.
 */
async function cancelUnrecordedItem(
  ctx: RateCtx, promo: Promotion, item: PromotionItem, user: string,
): Promise<boolean> {
  const ins = await inspectArticle(ctx, item.coArt, promo.startsOn);
  if (ins.ok) {
    const r = await runPlan(ctx, item.coArt, ins.coAlma, user, rows => {
      const live = rows.find(x =>
        x.hasta === promo.endsOn && x.desde >= promo.startsOn && same(x.monto, item.promoMonto));
      if (!live) return { ok: true, skipped: true, ops: [] };
      const regularMonto = item.regularMonto ?? continuationMonto(rows, promo.endsOn);
      if (regularMonto === null) return { ok: false, error: MISSING_REGULAR_MSG };
      return planCancelIdempotent(rows, { from: live.desde, to: promo.endsOn, regularMonto, today: ctx.t });
    });
    if (!r.ok) { recordItem(ctx, promo, item, { message: r.message }); return false; }
  }
  return recordItem(ctx, promo, item, { cancelledOn: ctx.t, message: null });
}

async function cancelItem(ctx: RateCtx, promo: Promotion, item: PromotionItem, user: string): Promise<boolean> {
  if (item.cancelledOn !== null) return true;
  if (item.appliedFrom === null || item.appliedTo === null) return cancelUnrecordedItem(ctx, promo, item, user);
  const { appliedFrom: from, appliedTo: to } = item;
  const r = item.coAlma
    ? await runPlan(ctx, item.coArt, item.coAlma, user, rows => {
      const regularMonto = item.regularMonto ?? continuationMonto(rows, to);
      return regularMonto === null ? { ok: false, error: MISSING_REGULAR_MSG } : planCancelIdempotent(rows, { from, to, regularMonto, today: ctx.t });
    })
    : { ok: false, message: NO_WAREHOUSE_MSG };
  if (!r.ok) { recordItem(ctx, promo, item, { message: r.message }); return false; }
  return recordItem(ctx, promo, item, { cancelledOn: ctx.t, message: null });
}

/** Moves one item's tracked promo row to end at `newTo`. */
async function convergeItem(ctx: RateCtx, promo: Promotion, item: PromotionItem, newTo: string, user: string): Promise<boolean> {
  if (item.appliedFrom === null || item.appliedTo === null || item.appliedTo === newTo) return true;
  const { appliedFrom: from, appliedTo: to } = item;
  const r = item.coAlma
    ? await runPlan(ctx, item.coArt, item.coAlma, user, rows => {
      const regularMonto = item.regularMonto ?? continuationMonto(rows, to);
      return regularMonto === null ? { ok: false, error: MISSING_REGULAR_MSG } : planChangeEndIdempotent(rows, { from, to, newTo, regularMonto, today: ctx.t });
    })
    : { ok: false, message: NO_WAREHOUSE_MSG };
  if (!r.ok) { recordItem(ctx, promo, item, { message: r.message }); return false; }
  return recordItem(ctx, promo, item, { appliedTo: newTo, message: null });
}

/** After the promotion ended: a promo row still running (a shortening that failed for it) stops yesterday. */
async function trimStrandedItem(ctx: RateCtx, promo: Promotion, item: PromotionItem, user: string): Promise<boolean> {
  const { appliedFrom: from, appliedTo: to } = item as PromotionItem & { appliedFrom: string; appliedTo: string };
  const r = item.coAlma
    ? await runPlan(ctx, item.coArt, item.coAlma, user, rows => {
      const regularMonto = item.regularMonto ?? continuationMonto(rows, to);
      if (regularMonto === null) return { ok: false, error: MISSING_REGULAR_MSG };
      return planCancelIdempotent(rows, { from, to, regularMonto, today: ctx.t });
    })
    : { ok: false, message: NO_WAREHOUSE_MSG };
  if (!r.ok) { recordItem(ctx, promo, item, { message: r.message }); return false; }
  const until = addDaysIso(ctx.t, -1);
  const message = `Precio promocional aplicado hasta ${formatShortDate(until, ctx.t)}`;
  return recordItem(ctx, promo, item, { appliedTo: until, message });
}

async function itemCtx(deps: PromotionsDeps, promo: Promotion): Promise<RateCtx> {
  return makeCtx(deps, promo.coPrecio, (await getListDto(listsDeps(deps), promo.coPrecio)).coMone);
}

// ---------- preview ----------

async function resolveCustomers(deps: PromotionsDeps, codes: string[]): Promise<PreviewCustomer[]> {
  const out: PreviewCustomer[] = [];
  for (const code of codes) {
    const c = await deps.segments.getCustomer(code);
    if (!c) throw new NotFoundError(`Cliente no encontrado: ${code}`);
    out.push({ coCli: c.coCli, cliDes: c.cliDes, previousTipCli: c.tipCli });
  }
  return out;
}

export async function previewPromotion(
  deps: PromotionsDeps, input: CreatePromotionInput,
): Promise<{ rows: PreviewRow[]; customers: PreviewCustomer[] }> {
  const coPrecio = input.kind === 'overlay' ? input.coPrecio : input.baseCoPrecio;
  const list = await getListDto(listsDeps(deps), coPrecio);
  const customers = input.kind === 'segment' ? await resolveCustomers(deps, input.customerCodes) : [];
  const ctx = await makeCtx(deps, coPrecio, list.coMone);
  // A segment promotion is planned against the price its cloned list will start with (one open row from today).
  const clone = input.kind === 'segment'
    ? new Map((await segmentCloneRows(deps, coPrecio, ctx.t)).map(r => [r.coArt, r]))
    : null;
  const names = new Map((await deps.rates.listArticles({ limit: 5000 })).map(a => [a.coArt, a.artDes]));
  const rows: PreviewRow[] = [];
  for (const it of input.items) {
    const base = { coArt: it.coArt, artDes: names.get(it.coArt) ?? it.coArt, promo: it.monto };
    const ins = await inspectArticle(ctx, it.coArt, input.startsOn);
    if (!ins.ok) { rows.push({ ...base, regular: null, status: 'rejected', message: ins.message }); continue; }
    const c = clone?.get(it.coArt);
    const synth = (r: CloneRow): RateRow =>
      ({ ...r, coPrecio, desde: ctx.t, hasta: null, coMone: list.coMone, validador: '' });
    const planRows: RateRow[] = !clone ? ins.rows : c ? [synth(c)] : [];
    const plan = planRatePeriod(planRows, { from: input.startsOn, to: input.endsOn, monto: it.monto, today: ctx.t });
    const regular = clone ? c?.monto ?? null : ins.covering?.monto ?? null;
    rows.push(plan.ok ? { ...base, regular, status: 'ok', message: null } : { ...base, regular, status: 'rejected', message: plan.error });
  }
  return { rows, customers };
}

// ---------- segment machinery ----------

/**
 * Rows the segment promotion's list is cloned with, all starting today: each article/warehouse covered today in the
 * base list keeps today's price, except when today's row is an app-tracked overlay promo row, which is replaced by
 * the regular price that follows it. Base-list changes scheduled after today are not copied (the clone is a snapshot).
 */
async function segmentCloneRows(deps: PromotionsDeps, baseCoPrecio: string, t: string): Promise<CloneRow[]> {
  const groups = new Map<string, RateRow[]>();
  for (const r of await deps.rates.readListRates(baseCoPrecio)) {
    const k = `${r.coArt}\u0000${r.coAlma}`;
    const g = groups.get(k);
    if (g) g.push(r); else groups.set(k, [r]);
  }
  const tracked = listTrackedPromoRows(deps.db, baseCoPrecio);
  const out: CloneRow[] = [];
  for (const rs of groups.values()) {
    const cov = currentOf(rs, t);
    if (!cov) continue;
    const promo = cov.hasta === null ? undefined : tracked.find(x =>
      x.coArt === cov.coArt && x.appliedFrom === cov.desde && x.appliedTo === cov.hasta
      && (x.coAlma === null || x.coAlma === cov.coAlma));
    const monto = promo ? continuationMonto(rs, cov.hasta!) ?? promo.regularMonto ?? cov.monto : cov.monto;
    out.push({ coArt: cov.coArt, coAlma: cov.coAlma, monto });
  }
  return out;
}

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

/** Creates the promotion's special segment (ERP + meta). Returns a warning when something could not be completed. */
async function ensureSegment(deps: PromotionsDeps, promo: Promotion, actor: Actor): Promise<string | undefined> {
  const t = today(deps);
  const nowMs = clock(deps).getTime();
  let tipCli: string;
  try {
    const desTipo = buildSegmentName({ customerName: promo.name, reason: '', endsOn: promo.endsOn, today: t });
    tipCli = await createSegmentInErp({ erp: deps.segments, db: deps.db, now: deps.now }, { desTipo, coPrecio: promo.coPrecio, user: actor.erpUser });
  } catch (e) {
    console.error(`Pricing: creating the segment of promotion ${promo.id} failed:`, e);
    return SEGMENT_WARNING;
  }
  if (!tryDb(`link segment ${tipCli} to promotion ${promo.id}`, () => setPromotionTipCli(deps.db, promo.id, tipCli))) return INTERNAL_WARNING;
  // Special segments belong to one customer (or another promotion): never a fallback for the rest.
  let special: (tipCli: string) => boolean = () => false;
  tryDb('segment metadata read', () => {
    const metas = getSegmentMetaMap(deps.db);
    special = x => metas.get(x)?.kind === 'special';
  });
  const fallback = mostCommon(listCustomers(deps.db, promo.id).map(c => c.previousTipCli).filter(x => !special(x)));
  const ok = tryDb(`metadata of segment ${tipCli}`, () => {
    upsertSegmentMeta(deps.db, {
      tipCli, kind: 'special', customerCoCli: null, reason: promo.name, expiresAt: promo.endsOn,
      fallbackTipCli: fallback, previousTipCli: null, createdBy: actor.id, createdAt: nowMs,
    });
    appendAudit(deps.db, { userId: actor.id, action: 'segment_create', target: tipCli, after: { promotionId: promo.id, kind: 'special', expiresOn: promo.endsOn }, now: nowMs });
  });
  return ok ? undefined : INTERNAL_WARNING;
}

/** Moves every not-yet-moved customer into the promotion segment. Returns false if an internal write failed. */
async function moveCustomers(deps: PromotionsDeps, promo: Promotion, actor: Actor): Promise<boolean> {
  let internalOk = true;
  const nowMs = clock(deps).getTime();
  for (const c of listCustomers(deps.db, promo.id).filter(x => x.moved === 0)) {
    try {
      const r = await deps.segments.moveCustomer(c.coCli, promo.tipCli!, actor.erpUser);
      if (r.outcome !== 'success') { console.error(`Pricing: customer ${c.coCli} not moved (${r.outcome}) for promotion ${promo.id}`); continue; }
    } catch (e) {
      console.error(`Pricing: moving customer ${c.coCli} for promotion ${promo.id} failed:`, e);
      continue;
    }
    internalOk = tryDb(`customer move ${c.coCli}`, () => {
      markCustomerMoved(deps.db, promo.id, c.coCli, true);
      appendAudit(deps.db, { userId: actor.id, action: 'customer_move', target: c.coCli, before: { tipCli: c.previousTipCli }, after: { tipCli: promo.tipCli }, now: nowMs });
    }) && internalOk;
  }
  return internalOk;
}

/** Sends moved customers back. A customer no longer in the promotion segment is left where it is. Returns true when all are reverted. */
async function revertCustomers(deps: PromotionsDeps, promo: Promotion, actor: Actor): Promise<boolean> {
  const nowMs = clock(deps).getTime();
  const fallback = promo.tipCli ? getSegmentMeta(deps.db, promo.tipCli)?.fallbackTipCli ?? null : null;
  let allOk = true;
  for (const c of listCustomers(deps.db, promo.id).filter(x => x.moved === 1)) {
    try {
      const current = await deps.segments.getCustomer(c.coCli);
      if (current && current.tipCli === promo.tipCli) {
        const target = (await deps.segments.getSegment(c.previousTipCli)) ? c.previousTipCli : fallback;
        if (!target || !(await deps.segments.getSegment(target))) { console.error(`Pricing: no segment to return customer ${c.coCli} to`); allOk = false; continue; }
        const r = await deps.segments.moveCustomer(c.coCli, target, actor.erpUser);
        if (r.outcome !== 'success') { console.error(`Pricing: customer ${c.coCli} not reverted (${r.outcome})`); allOk = false; continue; }
        tryDb(`customer revert audit ${c.coCli}`, () =>
          appendAudit(deps.db, { userId: actor.id, action: 'customer_move', target: c.coCli, before: { tipCli: promo.tipCli }, after: { tipCli: target }, now: nowMs }));
      }
      markCustomerMoved(deps.db, promo.id, c.coCli, false);
    } catch (e) {
      console.error(`Pricing: reverting customer ${c.coCli} of promotion ${promo.id} failed:`, e);
      allOk = false;
    }
  }
  return allOk;
}

// ---------- create ----------

const summary = (p: Promotion, items: PromotionItem[], customers: PromotionCustomer[]) => ({
  name: p.name, kind: p.kind, coPrecio: p.coPrecio, startsOn: p.startsOn, endsOn: p.endsOn,
  items: items.length, applied: items.filter(i => i.applied === 1).length, customers: customers.length,
});

async function prepareTarget(deps: PromotionsDeps, input: CreatePromotionInput, actor: Actor, t: string): Promise<{
  coPrecio: string; baseCoPrecio: string | null; customers: PreviewCustomer[]; warning?: string;
}> {
  if (input.kind === 'overlay') {
    const list = await getListDto(listsDeps(deps), input.coPrecio);
    if (!list.coMone) throw new ValidationError(NO_CURRENCY_MSG);
    return { coPrecio: input.coPrecio, baseCoPrecio: null, customers: [] };
  }
  await getListDto(listsDeps(deps), input.baseCoPrecio);
  const customers = await resolveCustomers(deps, input.customerCodes);
  const promoList = await cloneList(listsDeps(deps), {
    mode: 'clone', sourceCoPrecio: input.baseCoPrecio, desPrecio: `PROMO ${input.name}`.slice(0, 60),
    percent: null, effectiveFrom: t, rows: await segmentCloneRows(deps, input.baseCoPrecio, t),
  }, actor);
  return { coPrecio: promoList.coPrecio, baseCoPrecio: input.baseCoPrecio, customers, warning: promoList.warning };
}

/*
 * Failure windows (ERP is not transactional with SQLite):
 *  - overlay: nothing touches the ERP before the promotion row exists, so a failure leaves nothing orphaned.
 *  - segment: the promo list is cloned in the ERP BEFORE the promotion row can be inserted (it needs the list code).
 *    If that insert throws, the cloned list is orphaned (logged by the caller's error path, no promotion to retry).
 *  - segment: if the special segment is created in the ERP but linking it (tipCli) fails, the segment is orphaned and
 *    customers are not moved; tipCli is persisted immediately after the ERP create to keep this window minimal.
 *  - rate writes: progress (appliedFrom/appliedTo) is recorded after each ERP write; if only that record fails, a retry
 *    finds the promo row already in the ERP and records it instead of rewriting.
 */
export async function createPromotion(deps: PromotionsDeps, input: CreatePromotionInput, actor: Actor): Promise<PromotionDetailDto> {
  const t = today(deps);
  const nowMs = clock(deps).getTime();
  const target = await prepareTarget(deps, input, actor, t);

  const id = insertPromotion(deps.db, {
    name: input.name, reason: input.reason, kind: input.kind, coPrecio: target.coPrecio, baseCoPrecio: target.baseCoPrecio,
    tipCli: null, startsOn: input.startsOn, endsOn: input.endsOn, cancelledAt: null, createdBy: actor.id, createdAt: nowMs,
  });
  insertItems(deps.db, id, input.items.map(i => ({ coArt: i.coArt, promoMonto: i.monto })));
  insertCustomers(deps.db, id, target.customers.map(c => ({ coCli: c.coCli, previousTipCli: c.previousTipCli })));

  let promo = getPromotion(deps.db, id)!;
  await applyItems(deps, promo, listItems(deps.db, id), actor.erpUser);

  let warning = target.warning;
  if (promo.kind === 'segment') {
    warning = (await ensureSegment(deps, promo, actor)) ?? warning;
    promo = getPromotion(deps.db, id)!;
    if (promo.tipCli && !(await moveCustomers(deps, promo, actor))) warning ??= INTERNAL_WARNING;
  }
  if (!tryDb(`audit of promotion ${id}`, () =>
    appendAudit(deps.db, { userId: actor.id, action: 'promotion_create', target: String(id), after: summary(promo, listItems(deps.db, id), listCustomers(deps.db, id)), now: nowMs }))) {
    warning ??= INTERNAL_WARNING;
  }
  try {
    return await getPromotionDetail(deps, id, warning);
  } catch (e) {
    console.error(`Pricing: promotion ${id} created but reading its detail from Profit failed:`, e);
    return localDetail(deps, id, warning ?? DETAIL_WARNING);
  }
}

// ---------- patch ----------

function requireOpen(deps: PromotionsDeps, id: number): Promotion {
  const promo = getPromotion(deps.db, id);
  if (!promo) throw new NotFoundError('Promoción no encontrada');
  const status = promotionStatus(promo, today(deps));
  if (status === 'ended' || status === 'cancelled') {
    throw new ValidationError(status === 'ended' ? 'La promoción ya terminó' : 'La promoción ya fue cancelada');
  }
  return promo;
}

/** Resumable: progress is stored per item (cancelledOn). The promotion is cancelled, and customers return, only when every item is. */
async function cancel(deps: PromotionsDeps, promo: Promotion, actor: Actor): Promise<string | undefined> {
  const ctx = await itemCtx(deps, promo);
  let allOk = true;
  for (const item of listItems(deps.db, promo.id)) allOk = (await cancelItem(ctx, promo, item, actor.erpUser)) && allOk;
  if (!allOk) return undefined;
  if (promo.kind === 'segment' && !(await revertCustomers(deps, promo, actor))) return undefined;

  const nowMs = clock(deps).getTime();
  let warning: string | undefined;
  if (!tryDb(`mark promotion ${promo.id} cancelled`, () => cancelPromotion(deps.db, promo.id, nowMs))) return INTERNAL_WARNING;
  if (promo.tipCli && !tryDb(`expiry of segment ${promo.tipCli}`, () => setSegmentExpiry(deps.db, promo.tipCli!, addDaysIso(ctx.t, -1)))) warning = INTERNAL_WARNING;
  if (!tryDb(`cancel audit ${promo.id}`, () => appendAudit(deps.db, { userId: actor.id, action: 'promotion_cancel', target: String(promo.id), before: { endsOn: promo.endsOn }, after: { cancelled: true }, now: nowMs }))) warning = INTERNAL_WARNING;
  return warning;
}

async function changeEnd(deps: PromotionsDeps, promo: Promotion, newTo: string, actor: Actor): Promise<string | undefined> {
  const t = today(deps);
  if (newTo < (promo.startsOn > t ? promo.startsOn : t)) throw new ValidationError('La nueva fecha de fin no puede ser anterior al inicio ni a hoy');
  if (newTo === promo.endsOn) return undefined;
  const items = listItems(deps.db, promo.id);
  if (items.some(i => i.cancelledOn !== null)) throw new ValidationError(CANCELLING_MSG);

  const applied = items.filter(i => i.appliedFrom !== null);
  const ctx = await itemCtx(deps, promo);
  let anyOk = applied.length === 0;
  for (const item of applied) anyOk = (await convergeItem(ctx, promo, item, newTo, actor.erpUser)) || anyOk;
  if (!anyOk) return undefined; // nothing changed in the ERP: keep the old end; items show why

  let warning: string | undefined;
  if (!tryDb(`end of promotion ${promo.id}`, () => setPromotionEnd(deps.db, promo.id, newTo))) return INTERNAL_WARNING;
  if (promo.tipCli && !tryDb(`expiry of segment ${promo.tipCli}`, () => setSegmentExpiry(deps.db, promo.tipCli!, newTo))) warning = INTERNAL_WARNING;
  if (!tryDb(`extend audit ${promo.id}`, () => appendAudit(deps.db, { userId: actor.id, action: 'promotion_extend', target: String(promo.id), before: { endsOn: promo.endsOn }, after: { endsOn: newTo }, now: clock(deps).getTime() }))) warning = INTERNAL_WARNING;
  return warning;
}

export async function patchPromotion(deps: PromotionsDeps, id: number, input: PatchPromotionInput, actor: Actor): Promise<PromotionDetailDto> {
  const promo = requireOpen(deps, id);
  const warning = input.action === 'cancel' ? await cancel(deps, promo, actor) : await changeEnd(deps, promo, input.endsOn, actor);
  return getPromotionDetail(deps, id, warning);
}

// ---------- retry ----------

/** Applies unapplied items, converges items whose end differs from the promotion's, creates/moves the segment customers. */
export async function retryPromotion(deps: PromotionsDeps, id: number, actor: Actor): Promise<PromotionDetailDto> {
  const found = getPromotion(deps.db, id);
  if (!found) throw new NotFoundError('Promoción no encontrada');
  const t = today(deps);
  if (promotionStatus(found, t) === 'ended') {
    // Only items whose promo row outlived a shortened end can still be fixed: stop them yesterday.
    const stranded = strandedItems(found, listItems(deps.db, id), t);
    if (stranded.length === 0) throw new ValidationError('La promoción ya terminó');
    const ctx = await itemCtx(deps, found);
    for (const item of stranded) await trimStrandedItem(ctx, found, item, actor.erpUser);
    return getPromotionDetail(deps, id);
  }
  let promo = requireOpen(deps, id);
  const items = listItems(deps.db, id);
  if (items.some(i => i.cancelledOn !== null)) throw new ValidationError(CANCELLING_MSG);

  await applyItems(deps, promo, items.filter(i => i.appliedFrom === null), actor.erpUser);
  const pending = items.filter(i => isPending(promo, i, t));
  if (pending.length > 0) {
    const ctx = await itemCtx(deps, promo);
    for (const item of pending) await convergeItem(ctx, promo, item, promo.endsOn, actor.erpUser);
  }
  let warning: string | undefined;
  if (promo.kind === 'segment') {
    if (!promo.tipCli) { warning = await ensureSegment(deps, promo, actor); promo = getPromotion(deps.db, id)!; }
    if (promo.tipCli && !(await moveCustomers(deps, promo, actor))) warning ??= INTERNAL_WARNING;
  }
  return getPromotionDetail(deps, id, warning);
}
