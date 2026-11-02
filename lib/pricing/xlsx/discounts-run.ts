import type { AppDb } from '@/lib/geo/routes-repo';
import { todayIso } from '@/lib/pricing/dates';
import { cloneList, currentOf, type ListsDeps, type RatesErp } from '@/lib/pricing/lists-service';
import { segmentCloneRows } from '@/lib/pricing/promotions-service';
import { getSegmentMetaMap } from '@/lib/pricing/segments-repo';
import {
  assignCustomers, createSegment, patchSegment, type Actor, type SegmentErp, type ServiceDeps,
} from '@/lib/pricing/segments-service';
import type { DiscountSet } from '@/lib/pricing/xlsx/discounts';

/** List and segment names in Profit are at most 60 characters. */
const MAX_NAME = 60;
export const DISCOUNT_REASON = 'Descuento por artículo';
/** `Desc <8 hex>[-<type list>] · <type list name>`: the names `specialListName` produces. */
const SPECIAL_NAME_RE = /^Desc [0-9a-f]{8}(?:-\S+)? · /i;

const norm = (s: string) => s.trim().toUpperCase();
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function specialListName(typeListName: string, key: string): string {
  return `Desc ${key} · ${typeListName.trim()}`.slice(0, MAX_NAME).trimEnd();
}

export const isSpecialListName = (name: string) => SPECIAL_NAME_RE.test(name.trim());

// ---------- the customer's type (segment + list), seen through a discount segment ----------

export interface TypeContext {
  segments: { tipCli: string; coPrecio: string; kind: 'group' | 'special'; fallbackTipCli: string | null }[];
  lists: { coPrecio: string; desPrecio: string }[];
}
export interface CustomerType { tipCli: string; coPrecio: string; desPrecio: string }

export async function loadTypeContext(deps: { rates: RatesErp; segments: SegmentErp; db: AppDb }): Promise<TypeContext> {
  const [segs, lists] = await Promise.all([deps.segments.listSegments(), deps.rates.listLists()]);
  const metas = getSegmentMetaMap(deps.db);
  return {
    segments: segs.map(s => {
      const m = metas.get(s.tipCli.trim());
      return { tipCli: s.tipCli.trim(), coPrecio: s.coPrecio.trim(), kind: m?.kind ?? 'group', fallbackTipCli: m?.fallbackTipCli ?? null };
    }),
    lists: lists.map(l => ({ coPrecio: l.coPrecio.trim(), desPrecio: l.desPrecio.trim() })),
  };
}

export const PROMO_SEGMENT_MSG = 'el cliente está en un segmento especial de promoción; muévalo primero a su segmento de tipo';

/**
 * How the customer's current segment relates to its type:
 * - `type`: an ordinary segment (it is the type);
 * - `discount`: a segment of a special discount list made by this importer (`type` is what it unwraps to, or null);
 * - `promo`: any other special segment (a promotion or a one-off special price): its list is not a type list;
 * - `unknown`: the segment or its list is not in Profit.
 */
export type CustomerClass =
  | { kind: 'type'; type: CustomerType }
  | { kind: 'discount'; type: CustomerType | null; tipCli: string }
  | { kind: 'promo'; tipCli: string }
  | { kind: 'unknown' };

export function classifyCustomer(ctx: TypeContext, currentTipCli: string): CustomerClass {
  const seg = ctx.segments.find(s => norm(s.tipCli) === norm(currentTipCli));
  const list = seg && ctx.lists.find(l => norm(l.coPrecio) === norm(seg.coPrecio));
  if (!seg || !list) return { kind: 'unknown' };
  if (isSpecialListName(list.desPrecio)) return { kind: 'discount', type: resolveCustomerType(ctx, currentTipCli), tipCli: seg.tipCli };
  if (seg.kind === 'special') return { kind: 'promo', tipCli: seg.tipCli };
  return { kind: 'type', type: { tipCli: seg.tipCli, coPrecio: list.coPrecio, desPrecio: list.desPrecio } };
}

/**
 * The customer's type: its segment and list, unless the segment points at a special discount list (a previous run of
 * this importer), in which case the type is the segment it would go back to — the special segment's fallback, or,
 * for a shared (permanent) discount segment, the only ordinary segment of the type list named in the special list's
 * name (prefix match when that name was truncated). Null when it cannot be told.
 */
export function resolveCustomerType(ctx: TypeContext, currentTipCli: string): CustomerType | null {
  const segOf = (t: string) => ctx.segments.find(s => norm(s.tipCli) === norm(t));
  const listOf = (c: string) => ctx.lists.find(l => norm(l.coPrecio) === norm(c));
  const typeOfSeg = (t: string): CustomerType | null => {
    const s = segOf(t);
    const l = s && listOf(s.coPrecio);
    return s && l ? { tipCli: s.tipCli, coPrecio: l.coPrecio, desPrecio: l.desPrecio } : null;
  };

  const direct = typeOfSeg(currentTipCli);
  const seg = segOf(currentTipCli);
  if (direct && seg && seg.kind === 'special' && !isSpecialListName(direct.desPrecio)) return null; // promotion segment
  if (!direct || !seg || !isSpecialListName(direct.desPrecio)) return direct;

  if (seg.fallbackTipCli) {
    const fb = typeOfSeg(seg.fallbackTipCli);
    if (fb && !isSpecialListName(fb.desPrecio)) return fb;
  }
  const typeName = norm(direct.desPrecio.replace(SPECIAL_NAME_RE, ''));
  const ordinary = ctx.lists.filter(l => !isSpecialListName(l.desPrecio));
  let hits = ordinary.filter(l => norm(l.desPrecio) === typeName);
  if (!hits.length) hits = ordinary.filter(l => norm(l.desPrecio).startsWith(typeName));
  if (hits.length !== 1) return null;
  const segs = ctx.segments.filter(s => s.kind !== 'special' && norm(s.coPrecio) === norm(hits[0].coPrecio));
  return segs.length === 1 ? { tipCli: segs[0].tipCli, coPrecio: hits[0].coPrecio, desPrecio: hits[0].desPrecio } : null;
}

// ---------- grouping: one special list per (discount set, type list) ----------

export interface DiscountTarget {
  set: DiscountSet;
  /** set.key, plus `-<type coPrecio>` when the set's customers belong to more than one type list. */
  key: string;
  type: { coPrecio: string; desPrecio: string };
  name: string;
  customers: DiscountSet['customers'];
}

export function groupDiscountTargets(
  sets: DiscountSet[], typeOf: (coCli: string) => { coPrecio: string; desPrecio: string } | null,
): { targets: DiscountTarget[]; unresolved: string[] } {
  const targets: DiscountTarget[] = [];
  const unresolved: string[] = [];
  for (const set of sets) {
    const byType = new Map<string, { type: { coPrecio: string; desPrecio: string }; customers: DiscountSet['customers'] }>();
    for (const c of set.customers) {
      const type = typeOf(c.coCli);
      if (!type) { unresolved.push(c.coCli); continue; }
      const g = byType.get(norm(type.coPrecio));
      if (g) g.customers.push(c); else byType.set(norm(type.coPrecio), { type, customers: [c] });
    }
    for (const g of byType.values()) {
      const key = byType.size > 1 ? `${set.key}-${g.type.coPrecio}` : set.key;
      targets.push({ set, key, type: g.type, name: specialListName(g.type.desPrecio, key), customers: g.customers });
    }
  }
  return { targets, unresolved };
}

// ---------- dry-run helpers ----------

export function describeDiscountSets(
  sets: DiscountSet[], existingListNames: string[], typeOf: (coCli: string) => { coPrecio: string; desPrecio: string } | null,
): string[] {
  const existing = new Set(existingListNames.map(norm));
  return groupDiscountTargets(sets, typeOf).targets.map(t => {
    const who = t.customers.map(c => `${c.coCli} (${c.hasta === null ? 'permanente' : `hasta ${c.hasta}`})`).join(', ');
    const n = t.set.overrides.size;
    return `lista especial «${t.name}»: ${existing.has(norm(t.name)) ? 'ya existe' : 'se creará'} — ${n} ${n === 1 ? 'artículo distinto' : 'artículos distintos'} del tipo — clientes: ${who}`;
  });
}

export interface StaleCheck {
  name: string; typeName: string;
  /** Current price per co_art in the special list and in its type list. */
  special: Map<string, number>; type: Map<string, number>;
  /** Articles the discount overrides: they are meant to differ. */
  overridden: Iterable<string>;
}

/** One notice per special list whose non-overridden prices no longer match its type list (a special list is a snapshot). */
export function staleSpecialLists(checks: StaleCheck[]): string[] {
  const out: string[] = [];
  for (const c of checks) {
    const skip = new Set([...c.overridden].map(norm));
    let n = 0;
    for (const coArt of new Set([...c.special.keys(), ...c.type.keys()])) {
      if (skip.has(norm(coArt))) continue;
      const a = c.special.get(coArt);
      const b = c.type.get(coArt);
      if (a === undefined || b === undefined || Math.abs(a - b) > 1e-9) n++;
    }
    if (n > 0) {
      out.push(`lista especial «${c.name}»: ${n} ${n === 1 ? 'artículo sin descuento tiene' : 'artículos sin descuento tienen'} un precio distinto al de «${c.typeName}». `
        + 'La lista NO se sincroniza automáticamente: conserva los precios anteriores para los artículos sin descuento. '
        + 'Para actualizarla cree una lista de descuento nueva (por ejemplo, cambiando un precio de descuento) o pida una herramienta de re-sincronización');
    }
  }
  return out;
}

/** Price per co_art of the rows covering `asOf`. */
export async function pricesAsOf(rates: RatesErp, coPrecio: string, asOf: string): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  for (const r of await rates.readListRates(coPrecio)) if (currentOf([r], asOf)) m.set(r.coArt.trim(), r.monto);
  return m;
}

/**
 * `desde` must be today (the run date): the customer is moved when the workbook is applied, so a past `desde` would
 * back-date the special list and a future one would leave the customer without prices until then. A dated discount
 * becomes a special segment, which must expire after today (same rule as the Segmentos tab).
 */
export function discountDateIssues(sets: DiscountSet[], today: string): { errors: string[] } {
  const errors: string[] = [];
  for (const s of sets) {
    const arts = [...s.overrides.keys()].join(', ');
    for (const c of s.customers) {
      if (c.desde !== today) {
        errors.push(`cliente ${c.coCli} (artículos ${arts}): «desde» ${c.desde} debe ser hoy (${today}); las fechas futuras o pasadas aún no están soportadas`);
      }
      if (c.hasta !== null && c.hasta <= today) {
        errors.push(`cliente ${c.coCli}: «hasta» ${c.hasta} debe ser posterior a hoy (${today}); un descuento con fecha de fin necesita un segmento especial que venza después de hoy`);
      }
    }
  }
  return { errors };
}

// ---------- apply ----------

export type DiscountCustomerOutcome = { coCli: string; outcome: 'success' | 'conflict' | 'error'; message?: string };
export interface DiscountOutcome { key: string; coPrecio: string; reusedList: boolean; customers: DiscountCustomerOutcome[] }
export type TypeOf = (coCli: string) => Promise<{ coPrecio: string; tipCli: string } | null> | { coPrecio: string; tipCli: string } | null;

/** The type list's rows covering `desde` (overlay promo rows replaced by the regular price, as segment promotions do), overrides applied. */
async function specialRows(deps: { lists: ListsDeps }, typeCoPrecio: string, desde: string, overrides: Map<string, number>) {
  const rows = await segmentCloneRows({ rates: deps.lists.erp, db: deps.lists.db }, typeCoPrecio, desde);
  for (const [coArt, monto] of overrides) {
    const hit = rows.filter(r => norm(r.coArt) === norm(coArt));
    if (!hit.length) throw new Error(`el artículo ${coArt} no tiene precio vigente en la lista ${typeCoPrecio} al ${desde}`);
    for (const r of hit) r.monto = monto;
  }
  return rows;
}

/**
 * Creates (or reuses, by name) one special list per discount set and type list, then puts its customers on it:
 * permanent customers share one group segment named like the list; dated customers each get a special segment that
 * expires on `hasta` and falls back to their type segment (the nightly sweep moves them back). The list starts today.
 * A customer already in its target segment is left alone (a dated one only gets its expiry updated when `hasta`
 * changed), so a re-run writes nothing; one sitting in any other discount segment is an error, never re-moved.
 * A failing customer never stops the others.
 */
export async function applyDiscountSets(
  deps: { lists: ListsDeps; segments: ServiceDeps }, sets: DiscountSet[], typeOf: TypeOf, actor: Actor,
): Promise<DiscountOutcome[]> {
  const out: DiscountOutcome[] = [];
  const allLists = await deps.lists.erp.listLists();
  const typeLists = new Map(allLists.map(l => [norm(l.coPrecio), l]));
  const today = todayIso((deps.lists.now ?? (() => new Date()))());

  // Resolve every customer's type before any write.
  const types = new Map<string, { coPrecio: string; tipCli: string; desPrecio: string } | string>();
  for (const s of sets) {
    for (const c of s.customers) {
      try {
        const t = await typeOf(c.coCli);
        const l = t && typeLists.get(norm(t.coPrecio));
        types.set(c.coCli, t && l ? { ...t, desPrecio: l.desPrecio } : 'no se pudo determinar el tipo (segmento y lista) del cliente');
      } catch (e) {
        types.set(c.coCli, errMsg(e));
      }
    }
  }
  const typeFor = (coCli: string) => { const t = types.get(coCli); return typeof t === 'object' ? t : null; };
  const { targets } = groupDiscountTargets(sets, typeFor);
  for (const s of sets) {
    const bad = s.customers.filter(c => !typeFor(c.coCli));
    if (bad.length) out.push({ key: s.key, coPrecio: '', reusedList: false, customers: bad.map(c => ({ coCli: c.coCli, outcome: 'error', message: types.get(c.coCli) as string })) });
  }

  for (const t of targets) {
    const result: DiscountOutcome = { key: t.key, coPrecio: '', reusedList: false, customers: [] };
    out.push(result);
    /** Service warnings for the list / group segment: shown on each successful customer of this list. */
    const warnings: string[] = [];
    const ok = (coCli: string, message?: string): DiscountCustomerOutcome => {
      const m = [message, ...warnings].filter(Boolean).join('; ');
      return { coCli, outcome: 'success', ...(m ? { message: m } : {}) };
    };
    const failAll = (cs: DiscountSet['customers'], message: string) => {
      for (const c of cs) result.customers.push({ coCli: c.coCli, outcome: 'error', message });
    };

    // 1. the special list
    try {
      const same = (await deps.lists.erp.listLists()).filter(l => norm(l.desPrecio) === norm(t.name));
      if (same.length > 1) throw new Error(`hay ${same.length} listas llamadas «${t.name}» (${same.map(l => l.coPrecio).join(', ')}); deje una sola`);
      if (same.length === 1) {
        result.coPrecio = same[0].coPrecio.trim();
        result.reusedList = true;
      } else {
        const rows = await specialRows(deps, t.type.coPrecio, today, t.set.overrides);
        const created = await cloneList(deps.lists, {
          mode: 'clone', sourceCoPrecio: t.type.coPrecio, desPrecio: t.name, percent: null, effectiveFrom: today, rows,
        }, actor);
        result.coPrecio = created.coPrecio;
        if (created.warning) warnings.push(created.warning);
      }
    } catch (e) {
      failAll(t.customers, `no se pudo crear la lista especial «${t.name}»: ${errMsg(e)}`);
      continue;
    }

    const segs = await deps.segments.erp.listSegments();
    const listName = (coPrecio: string) => allLists.find(l => norm(l.coPrecio) === norm(coPrecio))?.desPrecio ?? '';
    /** The customer's current segment, when it belongs to an importer discount list. */
    const currentDiscount = async (coCli: string) => {
      const cur = await deps.segments.erp.getCustomer(coCli);
      if (!cur) throw new Error('el cliente no existe en Profit');
      const seg = segs.find(s => norm(s.tipCli) === norm(cur.tipCli));
      return { cur, seg: seg && isSpecialListName(listName(seg.coPrecio)) ? seg : null };
    };
    const inOtherDiscount = (desTipo: string) => `el cliente ya está en el descuento «${desTipo.trim()}»; muévalo primero al segmento de tipo`;

    // 2. permanent customers: one shared group segment named like the list
    const permanent = t.customers.filter(c => c.hasta === null);
    if (permanent.length) {
      let groupTipCli: string | null = null;
      try {
        const metas = getSegmentMetaMap(deps.segments.db);
        const desTipo = t.name.slice(0, MAX_NAME);
        const found = segs.filter(s => norm(s.desTipo) === norm(desTipo) && norm(s.coPrecio) === norm(result.coPrecio)
          && metas.get(s.tipCli.trim())?.kind !== 'special');
        if (found[0]) groupTipCli = found[0].tipCli.trim();
        else {
          const created = await createSegment(deps.segments, { kind: 'group', desTipo, coPrecio: result.coPrecio }, actor);
          groupTipCli = created.segment.tipCli;
          if (created.warning) warnings.push(created.warning);
        }
      } catch (e) {
        failAll(permanent, `no se pudo crear el segmento de «${t.name}»: ${errMsg(e)}`);
      }
      if (groupTipCli) {
        for (const c of permanent) {
          try {
            const { cur, seg } = await currentDiscount(c.coCli);
            if (norm(cur.tipCli) === norm(groupTipCli)) { result.customers.push(ok(c.coCli)); continue; }
            if (seg) { result.customers.push({ coCli: c.coCli, outcome: 'error', message: inOtherDiscount(seg.desTipo) }); continue; }
            const [r] = await assignCustomers(deps.segments, { customerCodes: [c.coCli], targetTipCli: groupTipCli }, actor);
            result.customers.push(r.outcome === 'success' ? ok(c.coCli, r.message) : { coCli: c.coCli, outcome: r.outcome, ...(r.message ? { message: r.message } : {}) });
          } catch (e) {
            result.customers.push({ coCli: c.coCli, outcome: 'error', message: errMsg(e) });
          }
        }
      }
    }

    // 3. dated customers: their own special segment (createSegment also moves the customer)
    for (const c of t.customers.filter(x => x.hasta !== null)) {
      try {
        const { seg } = await currentDiscount(c.coCli);
        if (seg) {
          const meta = getSegmentMetaMap(deps.segments.db).get(seg.tipCli.trim());
          const own = meta?.kind === 'special' && norm(meta.customerCoCli ?? '') === norm(c.coCli) && norm(seg.coPrecio) === norm(result.coPrecio);
          if (!own) { result.customers.push({ coCli: c.coCli, outcome: 'error', message: inOtherDiscount(seg.desTipo) }); continue; }
          if (meta!.expiresAt === c.hasta) { result.customers.push(ok(c.coCli)); continue; }
          await patchSegment(deps.segments, seg.tipCli.trim(), { expiresOn: c.hasta }, actor);
          result.customers.push(ok(c.coCli, `vencimiento actualizado a ${c.hasta}`));
          continue;
        }
        const { move, warning } = await createSegment(deps.segments, {
          kind: 'special', customerCoCli: c.coCli, reason: DISCOUNT_REASON, expiresOn: c.hasta!,
          coPrecio: result.coPrecio, fallbackTipCli: typeFor(c.coCli)!.tipCli,
        }, actor);
        // Without its metadata the special segment never expires (the sweep reads expiresAt/fallback from it).
        if (warning) result.customers.push({ coCli: c.coCli, outcome: 'error', message: warning });
        else if (move?.outcome === 'success') result.customers.push(ok(c.coCli, move.message));
        else result.customers.push({ coCli: c.coCli, outcome: move?.outcome ?? 'error', ...(move?.message ? { message: move.message } : {}) });
      } catch (e) {
        result.customers.push({ coCli: c.coCli, outcome: 'error', message: errMsg(e) });
      }
    }
    // keep the customers in the order of the set
    const order = new Map(t.customers.map((c, i) => [c.coCli, i]));
    result.customers.sort((a, b) => (order.get(a.coCli) ?? 0) - (order.get(b.coCli) ?? 0));
  }
  return out;
}
