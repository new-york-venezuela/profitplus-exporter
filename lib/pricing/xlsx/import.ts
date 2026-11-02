import type { AppDb } from '@/lib/geo/routes-repo';
import type { ImportPlan } from '@/lib/pricing/list-import/plan';
import { planImport } from '@/lib/pricing/list-import/run';
import { planPromoImport, type CheckedPromoPlan } from '@/lib/pricing/promo-import/run';
import { planTipoCliente } from '@/lib/pricing/tipo-cliente-apply/run';
import type { TipoClientePlan } from '@/lib/pricing/tipo-cliente-apply/plan';
import { currentOf, type RatesErp } from '@/lib/pricing/lists-service';
import type { SegmentErp } from '@/lib/pricing/segments-service';
import { compileDiscounts, type DiscountSet } from '@/lib/pricing/xlsx/discounts';
import {
  classifyCustomer, describeDiscountSets, discountDateIssues, groupDiscountTargets, loadTypeContext, pricesAsOf,
  PROMO_SEGMENT_MSG, staleSpecialLists, type StaleCheck,
} from '@/lib/pricing/xlsx/discounts-run';
import { NEW_LIST_SENTINEL, relabel, type ParsedWorkbook } from '@/lib/pricing/xlsx/parse-workbook';

export { parseWorkbook, type ParsedWorkbook } from '@/lib/pricing/xlsx/parse-workbook';

export interface WorkbookDeps { rates: RatesErp; segments: SegmentErp; db: AppDb }

export interface WorkbookPlan {
  lists: ImportPlan;
  promos: CheckedPromoPlan;
  /** null while any customer targets a list that does not exist in Profit yet (see `warnings`). */
  customers: TipoClientePlan | null;
  /**
   * `lines`: one dry-run line per special list; `stale`: existing special lists that no longer match their type list;
   * `types`: the type list each customer's overrides were computed against (by trimmed upper-case co_cli; a list not
   * created yet is `@<key>`), checked again live before the discounts step writes.
   */
  discounts: { sets: DiscountSet[]; errors: string[]; lines: string[]; stale: string[]; types: Map<string, { coPrecio: string; desPrecio: string }> };
  warnings: string[];
  problems: string[];
}

const norm = (s: string) => s.trim().toUpperCase();
const relabelAll = (xs: string[]) => xs.map(relabel);

/**
 * Each discounted customer's type list (and its prices) for compileDiscounts, resolved ahead of time because
 * compileDiscounts is synchronous. The type is the Clientes target when there is one, else the customer's live
 * segment seen through any discount segment of a previous run (resolveCustomerType).
 */
async function typeListResolver(deps: WorkbookDeps, parsed: ParsedWorkbook, today: string) {
  const [segments, lists, typeCtx] = await Promise.all([deps.segments.listSegments(), deps.rates.listLists(), loadTypeContext(deps)]);
  const targetOf = new Map(parsed.customers.map(c => [norm(c.coCli), c.target]));
  const rateCache = new Map<string, Map<string, number>>();

  const listPrices = async (coPrecio: string, asOf: string) => {
    const k = `${coPrecio}|${asOf}`;
    let m = rateCache.get(k);
    if (!m) {
      m = new Map();
      for (const r of await deps.rates.readListRates(coPrecio)) {
        if (currentOf([r], asOf)) m.set(r.coArt.trim(), r.monto);
      }
      rateCache.set(k, m);
    }
    return m;
  };

  /** Mirrors planTipoCliente's reading of tip_cli_nuevo: `L:` forces a list; a bare value is a segment, else a list code or name. */
  const coPrecioOfTarget = (raw: string): string | null => {
    const forced = /^L:/i.test(raw);
    const value = (forced ? raw.slice(2) : raw).trim();
    const seg = forced ? undefined : segments.find(s => norm(s.tipCli) === norm(value));
    if (seg) return seg.coPrecio;
    return (lists.find(l => norm(l.coPrecio) === norm(value)) ?? lists.find(l => norm(l.desPrecio) === norm(value)))?.coPrecio ?? null;
  };

  const resolved = new Map<string, Map<string, number> | null>();
  const types = new Map<string, { coPrecio: string; desPrecio: string }>();
  const errors = new Map<string, string>();
  for (const coCli of new Set(parsed.discounts.map(d => d.coCli))) {
    const asOf = today; // the special list is a snapshot of the type list as of the run date
    const target = targetOf.get(norm(coCli)) ?? '';
    let prices: Map<string, number> | null = null;
    if (target.startsWith(NEW_LIST_SENTINEL)) {
      const key = target.slice(NEW_LIST_SENTINEL.length);
      prices = new Map(parsed.cells.filter(c => c.key === key).map(c => [c.coArt, c.monto]));
      const def = parsed.lists.find(l => norm(l.key) === norm(key));
      types.set(coCli, { coPrecio: `@${key}`, desPrecio: def?.nombre ?? key });
    } else {
      let coPrecio: string | null;
      if (target) coPrecio = coPrecioOfTarget(target);
      else {
        const cur = await deps.segments.getCustomer(coCli);
        const cls = cur ? classifyCustomer(typeCtx, cur.tipCli) : { kind: 'unknown' as const };
        if (cls.kind === 'promo') errors.set(coCli, `cliente ${coCli}: ${PROMO_SEGMENT_MSG}`);
        coPrecio = cls.kind === 'type' || cls.kind === 'discount' ? cls.type?.coPrecio ?? null : null;
      }
      const list = coPrecio ? lists.find(l => norm(l.coPrecio) === norm(coPrecio!)) : undefined;
      if (coPrecio) prices = new Map(await listPrices(coPrecio, asOf));
      if (list) types.set(coCli, { coPrecio: list.coPrecio.trim(), desPrecio: list.desPrecio.trim() });
    }
    resolved.set(coCli, prices);
  }
  return {
    prices: (coCli: string) => resolved.get(coCli) ?? null,
    typeOf: (coCli: string) => types.get(coCli) ?? null,
    types,
    /** Customer-specific reasons that replace compileDiscounts' generic «no se pudo determinar su lista de tipo». */
    errors,
    lists,
  };
}

/** Dry-run lines per special list, and a notice for each existing special list that drifted from its type list. */
async function describeDiscounts(
  deps: WorkbookDeps, sets: DiscountSet[], r: Awaited<ReturnType<typeof typeListResolver>>, today: string,
): Promise<{ lines: string[]; stale: string[] }> {
  const lines = describeDiscountSets(sets, r.lists.map(l => l.desPrecio), r.typeOf);
  const checks: StaleCheck[] = [];
  for (const t of groupDiscountTargets(sets, r.typeOf).targets) {
    if (t.type.coPrecio.startsWith('@')) continue; // type list not created yet
    const same = r.lists.filter(l => norm(l.desPrecio) === norm(t.name));
    if (same.length !== 1) continue;
    const asOf = today;
    checks.push({
      name: t.name, typeName: t.type.desPrecio, overridden: t.set.overrides.keys(),
      special: await pricesAsOf(deps.rates, same[0].coPrecio.trim(), asOf),
      type: await pricesAsOf(deps.rates, t.type.coPrecio, asOf),
    });
  }
  return { lines, stale: staleSpecialLists(checks) };
}

/** Dry-run plan of the whole workbook. Reads from Profit and SQLite only; never writes. */
export async function planWorkbook(deps: WorkbookDeps, parsed: ParsedWorkbook, today: string): Promise<WorkbookPlan> {
  const empty: WorkbookPlan = {
    lists: { lists: [], problems: [] },
    promos: { promos: [], problems: [], warnings: [] },
    customers: null,
    discounts: { sets: [], errors: [], lines: [], stale: [], types: new Map() },
    warnings: [],
    problems: [...parsed.errors],
  };
  if (parsed.errors.length) return empty;

  const lists = parsed.lists.length
    ? await planImport({ erp: deps.rates, db: deps.db }, parsed.lists, parsed.cells, today)
    : empty.lists;
  const pending = parsed.lists.map(l => ({
    key: l.key, nombre: l.nombre, desde: l.desde,
    prices: new Map(parsed.cells.filter(c => c.key === l.key).map(c => [norm(c.coArt), c.monto])),
  }));
  const promos = parsed.promos.length ? await planPromoImport(deps, parsed.promos, pending, today) : empty.promos;

  const warnings: string[] = [];
  const pendingTargets = parsed.customers.filter(c => c.target.startsWith(NEW_LIST_SENTINEL));
  let customers: TipoClientePlan | null = null;
  let newListProblems: string[] = [];
  if (pendingTargets.length) {
    const keys = [...new Set(pendingTargets.map(c => c.target.slice(NEW_LIST_SENTINEL.length)))].map(k => `«${k}»`).join(', ');
    warnings.push(`${pendingTargets.length} cliente(s) apuntan a listas nuevas (${keys}) que aún no existen en Profit; no se pueden planificar hasta crearlas.`);
    // Validate what can be validated now so nothing is written before a bad row is found.
    const others = await planTipoCliente(deps, parsed.customers.filter(c => !c.target.startsWith(NEW_LIST_SENTINEL)));
    newListProblems = [...others.problems];
    for (const c of pendingTargets) {
      if (!(await deps.segments.getCustomer(c.coCli))) newListProblems.push(`Clientes: línea ${c.line} (${c.coCli}): el cliente no existe en Profit`);
    }
  } else {
    customers = await planTipoCliente(deps, parsed.customers);
  }

  let discounts = empty.discounts;
  if (parsed.discounts.length) {
    const resolver = await typeListResolver(deps, parsed, today);
    const compiled = compileDiscounts(parsed.discounts, resolver.prices);
    const generic = new Set([...resolver.errors.keys()].map(c => `cliente ${c}: no se pudo determinar su lista de tipo`));
    const dates = discountDateIssues(compiled.sets, today);
    discounts = {
      sets: compiled.sets,
      errors: [...compiled.errors.filter(e => !generic.has(e)), ...resolver.errors.values(), ...dates.errors],
      ...(await describeDiscounts(deps, compiled.sets, resolver, today)),
      types: new Map([...resolver.types].map(([c, t]) => [norm(c), t])),
    };
  }

  const plan: WorkbookPlan = {
    lists: { ...lists, problems: relabelAll(lists.problems) },
    promos: { ...promos, problems: relabelAll(promos.problems), warnings: relabelAll(promos.warnings) },
    customers,
    discounts,
    warnings: [...warnings, ...relabelAll(promos.warnings), ...(customers?.warnings ?? [])],
    problems: [],
  };
  plan.problems = [
    ...plan.lists.problems,
    ...plan.promos.problems,
    ...(customers?.problems ?? []),
    ...newListProblems,
    ...discounts.errors.map(e => `Descuentos por cliente: ${e}`),
  ];
  return plan;
}
