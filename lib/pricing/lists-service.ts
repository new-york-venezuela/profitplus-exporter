// lib/pricing/lists-service.ts
import type { AppDb } from '@/lib/geo/routes-repo';
import type { ApplyOutcome, ArticleRow, PriceListRow } from './rates-erp';
import type { RateRow } from './rate-planner';
import type { ApplyRatesInput, CreateListInput, RenameListInput } from './list-validators';
import { todayIso } from './dates';
import { priceFromPercent } from './rates-math';
import { nextPriceListCode } from './list-code';
import { getListMeta, getListMetaMap, setListMeta } from './lists-repo';
import { appendAudit } from './segments-repo';
import { ConflictError, NotFoundError, ValidationError, type Actor } from './segments-service';

export interface RatesErp {
  listLists(): Promise<PriceListRow[]>;
  getList(coPrecio: string): Promise<PriceListRow | null>;
  listCodes(): Promise<string[]>;
  listCurrencies(): Promise<string[]>;
  readListRates(coPrecio: string): Promise<RateRow[]>;
  readArticleRates(coArt: string): Promise<RateRow[]>;
  dominantWarehouse(coPrecio?: string): Promise<string | null>;
  listArticles(p: { search?: string }): Promise<ArticleRow[]>;
  getCustomerPriceList(coCli: string): Promise<{ coCli: string; cliDes: string; tipCli: string; coPrecio: string | null } | null>;
  applyRatePeriod(a: { coPrecio: string; coArt: string; coAlma: string; coMone: string | null; from: string; to: string | null; monto: number; today: string; user: string }): Promise<ApplyOutcome>;
  createList(p: { coPrecio: string; desPrecio: string; user: string }): Promise<void>;
  updateList(p: { coPrecio: string; desPrecio: string; validador: string; user: string }): Promise<'success' | 'conflict'>;
  cloneList(p: { coPrecio: string; desPrecio: string; coMone: string | null; from: string; rows: { coArt: string; coAlma: string; monto: number }[]; user: string }): Promise<void>;
}

export interface ListsDeps { erp: RatesErp; db: AppDb; now?: () => Date }
export interface PriceListDto extends PriceListRow { coMone: string | null; isEmpty: boolean }
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
const clock = (d: ListsDeps) => (d.now ?? (() => new Date()))();
const today = (d: ListsDeps) => todayIso(clock(d));

const currentOf = (rows: RateRow[], t: string) => rows.find(r => r.desde <= t && (r.hasta === null || t <= r.hasta)) ?? null;
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

async function getListDto(deps: ListsDeps, coPrecio: string): Promise<PriceListDto> {
  const row = await deps.erp.getList(coPrecio);
  if (!row) throw new NotFoundError('Lista de precios no encontrada');
  return toDto(row, getListMeta(deps.db, coPrecio)?.coMone);
}

function requireCurrency(list: PriceListDto): string {
  if (!list.coMone) throw new ValidationError('La lista no tiene moneda definida');
  return list.coMone;
}

export async function listPriceListDtos(deps: ListsDeps): Promise<{ priceLists: PriceListDto[]; currencies: string[] }> {
  const [rows, currencies] = [await deps.erp.listLists(), await deps.erp.listCurrencies()];
  const metas = getListMetaMap(deps.db);
  return { priceLists: rows.map(r => toDto(r, metas.get(r.coPrecio)?.coMone)), currencies };
}

export async function getRatesGrid(deps: ListsDeps, coPrecio: string, compareTo: string | null): Promise<GridData> {
  const list = await getListDto(deps, coPrecio);
  const t = today(deps);
  const [rates, articles] = [await deps.erp.readListRates(coPrecio), await deps.erp.listArticles({})];
  const refRates = compareTo ? groupBy(await deps.erp.readListRates(compareTo), r => r.coArt) : null;
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
    else referenceMonto = currentOf(refRates.get(coArt) ?? [], t)?.monto ?? null;
    rows.push({
      coArt, artDes: a?.artDes ?? coArt, catDes: a?.catDes ?? null,
      coAlma: ambiguous ? null : [...warehouses][0] ?? null, ambiguous,
      current: cur(current), next: nxt(next), referenceMonto,
    });
  }
  rows.sort((x, y) => x.artDes.localeCompare(y.artDes));
  return { list, rows, referenceCoPrecio: compareTo };
}

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
      const warehouses = [...new Set(rs.map(r => r.coAlma))];
      if (warehouses.length > 1) { results.push({ coArt: change.coArt, outcome: 'rejected', message: AMBIGUOUS_MSG }); continue; }
      let coAlma = warehouses[0];
      if (!coAlma) {
        if (fallbackAlma === undefined) fallbackAlma = (await deps.erp.dominantWarehouse(coPrecio)) ?? (await deps.erp.dominantWarehouse()) ?? 'TODOS';
        coAlma = fallbackAlma;
      }
      const before = currentOf(rs, input.effectiveFrom)?.monto ?? null;
      const out = await deps.erp.applyRatePeriod({
        coPrecio, coArt: change.coArt, coAlma, coMone, from: input.effectiveFrom, to: null,
        monto: change.monto, today: t, user: actor.erpUser,
      });
      if (out.outcome === 'rejected') results.push({ coArt: change.coArt, outcome: 'rejected', message: out.message });
      else {
        results.push({ coArt: change.coArt, outcome: out.outcome });
        if (out.outcome === 'success') done.push({ coArt: change.coArt, before, after: change.monto });
      }
    } catch (e) {
      results.push({ coArt: change.coArt, outcome: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }
  if (done.length > 0) {
    appendAudit(deps.db, {
      userId: actor.id, action: 'rates_apply', target: coPrecio,
      after: { effectiveFrom: input.effectiveFrom, changes: done }, now: clock(deps).getTime(),
    });
  }
  return results;
}

export async function createList(
  deps: ListsDeps, input: Extract<CreateListInput, { mode: 'create' }>, actor: Actor,
): Promise<PriceListDto> {
  const coPrecio = nextPriceListCode(await deps.erp.listCodes());
  await deps.erp.createList({ coPrecio, desPrecio: input.desPrecio, user: actor.erpUser });
  const nowMs = clock(deps).getTime();
  setListMeta(deps.db, { coPrecio, coMone: input.coMone, createdBy: actor.id, createdAt: nowMs });
  appendAudit(deps.db, { userId: actor.id, action: 'list_create', target: coPrecio, after: { desPrecio: input.desPrecio, coMone: input.coMone }, now: nowMs });
  return getListDto(deps, coPrecio);
}

export async function cloneList(
  deps: ListsDeps, input: Extract<CreateListInput, { mode: 'clone' }>, actor: Actor,
): Promise<PriceListDto> {
  const source = await getListDto(deps, input.sourceCoPrecio);
  const coMone = requireCurrency(source);
  const t = today(deps);
  const current = (await deps.erp.readListRates(input.sourceCoPrecio))
    .filter(r => r.desde <= t && (r.hasta === null || t <= r.hasta));
  const rows = current.map(r => ({
    coArt: r.coArt, coAlma: r.coAlma,
    monto: input.percent === null ? r.monto : priceFromPercent(r.monto, input.percent),
  }));
  if (rows.length === 0) throw new ValidationError('La lista de origen no tiene tarifas vigentes para copiar');

  const coPrecio = nextPriceListCode(await deps.erp.listCodes());
  await deps.erp.cloneList({ coPrecio, desPrecio: input.desPrecio, coMone, from: input.effectiveFrom, rows, user: actor.erpUser });
  const nowMs = clock(deps).getTime();
  setListMeta(deps.db, { coPrecio, coMone, createdBy: actor.id, createdAt: nowMs });
  appendAudit(deps.db, {
    userId: actor.id, action: 'list_clone', target: coPrecio, before: input.sourceCoPrecio,
    after: { coPrecio, percent: input.percent, from: input.effectiveFrom, count: rows.length }, now: nowMs,
  });
  return getListDto(deps, coPrecio);
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
  const [rates, listRows] = [await deps.erp.readArticleRates(coArt), await deps.erp.listLists()];
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
