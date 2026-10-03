// lib/pricing/lists-service.ts
import type { AppDb } from '@/lib/geo/routes-repo';
import type { ApplyOutcome, ArticleRow, PriceListRow } from './rates-erp';
import type { RatePlan, RateRow } from './rate-planner';
import type { ApplyRatesInput, CreateListInput, RenameListInput } from './list-validators';
import { isValidIsoDate, todayIso } from './dates';
import { priceFromPercent } from './rates-math';
import { nextPriceListCode } from './list-code';
import { getListMeta, getListMetaMap, setListMeta } from './lists-repo';
import { appendAudit } from './segments-repo';
import { findOpenPromotionItem } from './promotions-repo';
import { formatShortDate } from './segment-name';
import { ConflictError, NotFoundError, ValidationError, type Actor } from './segments-service';

export interface RatesErp {
  listLists(): Promise<PriceListRow[]>;
  getList(coPrecio: string): Promise<PriceListRow | null>;
  listCodes(): Promise<string[]>;
  listCurrencies(): Promise<string[]>;
  readListRates(coPrecio: string): Promise<RateRow[]>;
  readArticleRates(coArt: string): Promise<RateRow[]>;
  dominantWarehouse(coPrecio?: string): Promise<string | null>;
  listArticles(p: { search?: string; limit?: number }): Promise<ArticleRow[]>;
  getCustomerPriceList(coCli: string): Promise<{ coCli: string; cliDes: string; tipCli: string; coPrecio: string | null } | null>;
  applyRatePeriod(a: { coPrecio: string; coArt: string; coAlma: string; coMone: string | null; from: string; to: string | null; monto: number; today: string; user: string; expectedCurrent?: number | null }): Promise<ApplyOutcome>;
  applyPlanned(a: { coPrecio: string; coArt: string; coAlma: string; coMone: string | null; user: string; expectedCurrent?: number | null; today?: string }, plan: (rows: RateRow[]) => RatePlan): Promise<ApplyOutcome>;
  createList(p: { coPrecio: string; desPrecio: string; user: string }): Promise<void>;
  updateList(p: { coPrecio: string; desPrecio: string; validador: string; user: string }): Promise<'success' | 'conflict'>;
  cloneList(p: { coPrecio: string; desPrecio: string; coMone: string | null; from: string; rows: { coArt: string; coAlma: string; monto: number }[]; user: string }): Promise<void>;
}

export interface ListsDeps { erp: RatesErp; db: AppDb; now?: () => Date }
export interface PriceListDto extends PriceListRow { coMone: string | null; isEmpty: boolean; warning?: string }
export interface GridRow {
  coArt: string; artDes: string; catDes: string | null; coAlma: string | null; ambiguous: boolean;
  current: { monto: number; desde: string; hasta: string | null } | null;
  next: { monto: number; desde: string } | null;
  referenceMonto: number | null;
}
export interface GridData { list: PriceListDto; rows: GridRow[]; referenceCoPrecio: string | null }
export type ApplyResult = { coArt: string; outcome: 'success' | 'skipped' | 'conflict' | 'rejected' | 'error'; message?: string };
export interface ArticlePrices {
  coArt: string;
  lists: {
    coPrecio: string; desPrecio: string; coMone: string | null;
    current: { monto: number; desde: string; hasta: string | null } | null;
    next: { monto: number; desde: string } | null;
    history: { monto: number; desde: string; hasta: string | null }[];
  }[];
  effective: { coCli: string; cliDes: string; coPrecio: string; desPrecio: string; monto: number } | null;
}

const AMBIGUOUS_MSG = 'El artículo tiene tarifas en varios almacenes en esta lista';
const GENERIC_APPLY_ERROR = 'Error al aplicar el precio de este artículo';
export const MIXED_CURRENCY_MSG = 'El artículo tiene una moneda distinta a la de la lista';
const META_WARNING = 'Lista creada en Profit pero sin metadatos de moneda; avise a un administrador';
const clock = (d: ListsDeps) => (d.now ?? (() => new Date()))();
const today = (d: ListsDeps) => todayIso(clock(d));

export const currentOf = (rows: RateRow[], t: string) => rows.find(r => r.desde <= t && (r.hasta === null || t <= r.hasta)) ?? null;
/** A covering row priced in another currency than the target list can't be written to it. */
export const isMixedCurrency = (covering: RateRow | null, coMone: string) => !!covering?.coMone && covering.coMone !== coMone;
const nextOf = (rows: RateRow[], t: string) => rows.filter(r => r.desde > t).sort((a, b) => a.desde.localeCompare(b.desde))[0] ?? null;
const cur = (r: RateRow | null) => (r ? { monto: r.monto, desde: r.desde, hasta: r.hasta } : null);
const nxt = (r: RateRow | null) => (r ? { monto: r.monto, desde: r.desde } : null);

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const i of items) { const k = key(i); const a = m.get(k); if (a) a.push(i); else m.set(k, [i]); }
  return m;
}

function toDto(row: PriceListRow, metaMone: string | undefined): PriceListDto {
  return { ...row, coMone: row.coMone ?? metaMone ?? null, isEmpty: row.rateCount === 0 && row.segmentCount === 0 };
}

export async function getListDto(deps: ListsDeps, coPrecio: string): Promise<PriceListDto> {
  const row = await deps.erp.getList(coPrecio);
  if (!row) throw new NotFoundError('Lista de precios no encontrada');
  return toDto(row, getListMeta(deps.db, coPrecio)?.coMone);
}

function requireCurrency(list: PriceListDto): string {
  if (!list.coMone) throw new ValidationError('La lista no tiene moneda definida');
  return list.coMone;
}

export async function listPriceListDtos(deps: ListsDeps): Promise<{ priceLists: PriceListDto[]; currencies: string[] }> {
  const [rows, currencies] = await Promise.all([deps.erp.listLists(), deps.erp.listCurrencies()]);
  const metas = getListMetaMap(deps.db);
  return { priceLists: rows.map(r => toDto(r, metas.get(r.coPrecio)?.coMone)), currencies };
}

export async function getRatesGrid(deps: ListsDeps, coPrecio: string, compareTo: string | null): Promise<GridData> {
  const list = await getListDto(deps, coPrecio);
  const t = today(deps);
  if (compareTo && !(await deps.erp.getList(compareTo))) throw new NotFoundError('Lista de comparación no encontrada');
  const [rates, articles, refAll] = await Promise.all([
    deps.erp.readListRates(coPrecio), deps.erp.listArticles({ limit: 5000 }),
    compareTo ? deps.erp.readListRates(compareTo) : Promise.resolve(null),
  ]);
  const refRates = refAll ? groupBy(refAll, r => r.coArt) : null;
  const names = new Map(articles.map(a => [a.coArt, a]));

  const rows: GridRow[] = [];
  for (const [coArt, rs] of groupBy(rates, r => r.coArt)) {
    const warehouses = new Set(rs.map(r => r.coAlma));
    const ambiguous = warehouses.size > 1;
    const a = names.get(coArt);
    const current = ambiguous ? null : currentOf(rs, t);
    const next = ambiguous ? null : nextOf(rs, t);
    let referenceMonto: number | null;
    if (ambiguous) referenceMonto = null;
    else if (refRates === null) referenceMonto = current?.monto ?? null;
    else {
      const rr = refRates.get(coArt) ?? [];
      referenceMonto = new Set(rr.map(r => r.coAlma)).size > 1 ? null : currentOf(rr, t)?.monto ?? null;
    }
    rows.push({
      coArt, artDes: a?.artDes ?? coArt, catDes: a?.catDes ?? null,
      coAlma: ambiguous ? null : [...warehouses][0] ?? null, ambiguous,
      current: cur(current), next: nxt(next), referenceMonto,
    });
  }
  // Unpriced rows: every catalog article with no row in this list (a new/empty list must be priceable).
  const priced = new Set(rows.map(r => r.coArt));
  for (const a of articles) {
    if (priced.has(a.coArt)) continue;
    let referenceMonto: number | null = null;
    if (refRates !== null) {
      const rr = refRates.get(a.coArt) ?? [];
      referenceMonto = new Set(rr.map(r => r.coAlma)).size > 1 ? null : currentOf(rr, t)?.monto ?? null;
    }
    rows.push({ coArt: a.coArt, artDes: a.artDes, catDes: a.catDes, coAlma: null, ambiguous: false, current: null, next: null, referenceMonto });
  }
  rows.sort((x, y) => x.artDes.localeCompare(y.artDes));
  return { list, rows, referenceCoPrecio: compareTo };
}

/** Warehouse an article's rates live in: its own (single) warehouse, else the list's / install's dominant one, else 'TODOS'. */
export function resolveArticleWarehouse(
  rowsOfArticleInList: RateRow[], listDominant: string | null, installDominant: string | null,
): { coAlma: string } | { ambiguous: true } {
  const warehouses = [...new Set(rowsOfArticleInList.map(r => r.coAlma))];
  if (warehouses.length > 1) return { ambiguous: true };
  if (warehouses.length === 1 && warehouses[0]) return { coAlma: warehouses[0] };
  return { coAlma: listDominant ?? installDominant ?? 'TODOS' };
}

/**
 * An open-ended regular write would split a tracked promo row and lose the promo's continuation, so a regular change on
 * an article in a scheduled/active promotion of the same list is refused until the promotion ends or is cancelled.
 */
const promotionBlockMessage = (name: string, until: string, t: string) =>
  `Artículo en la promoción «${name}» hasta ${formatShortDate(until, t)}; `
  + 'cambie el precio después del fin o cancele la promoción';

export async function applyRates(deps: ListsDeps, coPrecio: string, input: ApplyRatesInput, actor: Actor): Promise<ApplyResult[]> {
  const list = await getListDto(deps, coPrecio);
  const coMone = requireCurrency(list);
  const t = today(deps);
  const rates = groupBy(await deps.erp.readListRates(coPrecio), r => r.coArt);
  let fallbackAlma: string | undefined;

  const results: ApplyResult[] = [];
  const done: { coArt: string; before: number | null; after: number }[] = [];
  for (const change of input.changes) {
    try {
      const rs = rates.get(change.coArt) ?? [];
      if (rs.length === 0 && fallbackAlma === undefined) fallbackAlma = (await deps.erp.dominantWarehouse(coPrecio)) ?? (await deps.erp.dominantWarehouse()) ?? 'TODOS';
      const warehouse = resolveArticleWarehouse(rs, fallbackAlma ?? null, null);
      if ('ambiguous' in warehouse) { results.push({ coArt: change.coArt, outcome: 'rejected', message: AMBIGUOUS_MSG }); continue; }
      const coAlma = warehouse.coAlma;
      const covering = currentOf(rs, input.effectiveFrom) ?? currentOf(rs, t);
      if (isMixedCurrency(covering, coMone)) { results.push({ coArt: change.coArt, outcome: 'rejected', message: MIXED_CURRENCY_MSG }); continue; }
      const promo = findOpenPromotionItem(deps.db, coPrecio, change.coArt, input.effectiveFrom);
      if (promo) {
        const message = promotionBlockMessage(promo.name, promo.appliedTo, t);
        results.push({ coArt: change.coArt, outcome: 'rejected', message });
        continue;
      }
      const before = currentOf(rs, input.effectiveFrom)?.monto ?? null;
      const out = await deps.erp.applyRatePeriod({
        coPrecio, coArt: change.coArt, coAlma, coMone, from: input.effectiveFrom, to: null,
        monto: change.monto, today: t, user: actor.erpUser, expectedCurrent: change.expected,
      });
      if (out.outcome === 'rejected') results.push({ coArt: change.coArt, outcome: 'rejected', message: out.message });
      else {
        results.push({ coArt: change.coArt, outcome: out.outcome });
        if (out.outcome === 'success') done.push({ coArt: change.coArt, before, after: change.monto });
      }
    } catch (e) {
      console.error(`Pricing: apply failed for list ${coPrecio}, article ${change.coArt}:`, e);
      // only messages raised by our own procedures (RAISERROR → number 50000) are safe to show
      const raised = typeof e === 'object' && e !== null && (e as { number?: unknown }).number === 50000 && e instanceof Error;
      results.push({ coArt: change.coArt, outcome: 'error', message: raised ? (e as Error).message : GENERIC_APPLY_ERROR });
    }
  }
  if (done.length > 0) {
    try {
      appendAudit(deps.db, {
        userId: actor.id, action: 'rates_apply', target: coPrecio,
        after: { effectiveFrom: input.effectiveFrom, changes: done }, now: clock(deps).getTime(),
      });
    } catch (e) {
      console.error(`Pricing: rates applied to list ${coPrecio} but the audit write failed:`, e);
    }
  }
  return results;
}

export async function createList(
  deps: ListsDeps, input: Extract<CreateListInput, { mode: 'create' }>, actor: Actor,
): Promise<PriceListDto> {
  if (!(await deps.erp.listCurrencies()).includes(input.coMone)) throw new ValidationError('Moneda no válida');
  const coPrecio = nextPriceListCode(await deps.erp.listCodes());
  await deps.erp.createList({ coPrecio, desPrecio: input.desPrecio, user: actor.erpUser });
  const nowMs = clock(deps).getTime();
  let warning: string | undefined;
  try {
    setListMeta(deps.db, { coPrecio, coMone: input.coMone, createdBy: actor.id, createdAt: nowMs });
    appendAudit(deps.db, { userId: actor.id, action: 'list_create', target: coPrecio, after: { desPrecio: input.desPrecio, coMone: input.coMone }, now: nowMs });
  } catch (e) {
    console.error(`Pricing: list ${coPrecio} created in ERP but metadata write failed:`, e);
    warning = META_WARNING;
  }
  return { ...(await getListDto(deps, coPrecio)), ...(warning ? { warning } : {}) };
}

export interface CloneRow { coArt: string; coAlma: string; monto: number }

/**
 * `asOf` (default today) picks which row of the source is copied: the one covering that date.
 * `rows` replaces that selection entirely (segment promotions compute their own, see promotions-service).
 * Neither is part of the HTTP validator: only server callers can set them.
 */
export async function cloneList(
  deps: ListsDeps,
  input: Extract<CreateListInput, { mode: 'clone' }> & { asOf?: string; rows?: CloneRow[] },
  actor: Actor,
): Promise<PriceListDto> {
  if (input.asOf !== undefined && !isValidIsoDate(input.asOf)) throw new ValidationError('Fecha de referencia no válida');
  const source = await getListDto(deps, input.sourceCoPrecio);
  const coMone = requireCurrency(source);
  const t = input.asOf ?? today(deps);
  const picked = input.rows ?? (await deps.erp.readListRates(input.sourceCoPrecio))
    .filter(r => r.desde <= t && (r.hasta === null || t <= r.hasta));
  const rows = picked.map(r => ({
    coArt: r.coArt, coAlma: r.coAlma,
    monto: input.percent === null ? r.monto : priceFromPercent(r.monto, input.percent),
  }));
  if (rows.length === 0) throw new ValidationError('La lista de origen no tiene tarifas vigentes para copiar');

  const coPrecio = nextPriceListCode(await deps.erp.listCodes());
  await deps.erp.cloneList({ coPrecio, desPrecio: input.desPrecio, coMone, from: input.effectiveFrom, rows, user: actor.erpUser });
  const nowMs = clock(deps).getTime();
  let warning: string | undefined;
  try {
    setListMeta(deps.db, { coPrecio, coMone, createdBy: actor.id, createdAt: nowMs });
    appendAudit(deps.db, {
      userId: actor.id, action: 'list_clone', target: coPrecio, before: input.sourceCoPrecio,
      after: { coPrecio, percent: input.percent, from: input.effectiveFrom, count: rows.length }, now: nowMs,
    });
  } catch (e) {
    console.error(`Pricing: list ${coPrecio} cloned in ERP but metadata write failed:`, e);
    warning = META_WARNING;
  }
  return { ...(await getListDto(deps, coPrecio)), ...(warning ? { warning } : {}) };
}

export async function renameList(deps: ListsDeps, coPrecio: string, input: RenameListInput, actor: Actor): Promise<PriceListDto> {
  await getListDto(deps, coPrecio);
  const r = await deps.erp.updateList({ coPrecio, desPrecio: input.desPrecio, validador: input.validador, user: actor.erpUser });
  if (r === 'conflict') throw new ConflictError('La lista fue modificada por otro usuario; recargue e intente de nuevo');
  return getListDto(deps, coPrecio);
}

export async function searchArticles(deps: ListsDeps, search: string): Promise<ArticleRow[]> {
  return deps.erp.listArticles({ search });
}

export async function getArticlePrices(deps: ListsDeps, coArt: string, customerCoCli: string | null): Promise<ArticlePrices> {
  const t = today(deps);
  const customer = customerCoCli ? await deps.erp.getCustomerPriceList(customerCoCli) : null;
  if (customerCoCli && !customer) throw new NotFoundError('Cliente no encontrado');
  const [rates, listRows] = await Promise.all([deps.erp.readArticleRates(coArt), deps.erp.listLists()]);
  const metas = getListMetaMap(deps.db);
  const byList = groupBy(rates, r => r.coPrecio);

  const lists: ArticlePrices['lists'] = [];
  for (const [coPrecio, rs] of byList) {
    const l = listRows.find(x => x.coPrecio === coPrecio);
    lists.push({
      coPrecio, desPrecio: l?.desPrecio ?? coPrecio, coMone: l?.coMone ?? metas.get(coPrecio)?.coMone ?? null,
      current: cur(currentOf(rs, t)), next: nxt(nextOf(rs, t)),
      history: rs.filter(r => r.hasta !== null && r.hasta < t).sort((a, b) => b.desde.localeCompare(a.desde))
        .map(r => ({ monto: r.monto, desde: r.desde, hasta: r.hasta })),
    });
  }
  lists.sort((a, b) => a.coPrecio.localeCompare(b.coPrecio));

  let effective: ArticlePrices['effective'] = null;
  if (customer?.coPrecio) {
    const l = lists.find(x => x.coPrecio === customer.coPrecio);
    if (l?.current) effective = { coCli: customer.coCli, cliDes: customer.cliDes, coPrecio: l.coPrecio, desPrecio: l.desPrecio, monto: l.current.monto };
  }
  return { coArt, lists, effective };
}
