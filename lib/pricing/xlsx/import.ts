import type { AppDb } from '@/lib/geo/routes-repo';
import type { ImportPlan } from '@/lib/pricing/list-import/plan';
import { planImport } from '@/lib/pricing/list-import/run';
import { planPromoImport, type CheckedPromoPlan } from '@/lib/pricing/promo-import/run';
import { planTipoCliente } from '@/lib/pricing/tipo-cliente-apply/run';
import type { TipoClientePlan } from '@/lib/pricing/tipo-cliente-apply/plan';
import { currentOf, type RatesErp } from '@/lib/pricing/lists-service';
import type { SegmentErp } from '@/lib/pricing/segments-service';
import { compileDiscounts, type DiscountSet } from '@/lib/pricing/xlsx/discounts';
import { NEW_LIST_SENTINEL, relabel, type ParsedWorkbook } from '@/lib/pricing/xlsx/parse-workbook';

export { parseWorkbook, type ParsedWorkbook } from '@/lib/pricing/xlsx/parse-workbook';

export interface WorkbookDeps { rates: RatesErp; segments: SegmentErp; db: AppDb }

export interface WorkbookPlan {
  lists: ImportPlan;
  promos: CheckedPromoPlan;
  /** null while any customer targets a list that does not exist in Profit yet (see `warnings`). */
  customers: TipoClientePlan | null;
  discounts: { sets: DiscountSet[]; errors: string[] };
  warnings: string[];
  problems: string[];
}

const norm = (s: string) => s.trim().toUpperCase();
const relabelAll = (xs: string[]) => xs.map(relabel);

/** Type-list price maps for compileDiscounts, resolved ahead of time because compileDiscounts is synchronous. */
async function typeListResolver(deps: WorkbookDeps, parsed: ParsedWorkbook, today: string) {
  const [segments, lists] = await Promise.all([deps.segments.listSegments(), deps.rates.listLists()]);
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
  for (const coCli of new Set(parsed.discounts.map(d => d.coCli))) {
    const asOf = parsed.discounts.find(d => d.coCli === coCli)!.desde;
    const target = targetOf.get(norm(coCli)) ?? '';
    let prices: Map<string, number> | null = null;
    if (target.startsWith(NEW_LIST_SENTINEL)) {
      const key = target.slice(NEW_LIST_SENTINEL.length);
      prices = new Map(parsed.cells.filter(c => c.key === key).map(c => [c.coArt, c.monto]));
    } else {
      const coPrecio = target ? coPrecioOfTarget(target) : (await deps.rates.getCustomerPriceList(coCli))?.coPrecio?.trim() ?? null;
      if (coPrecio) prices = new Map(await listPrices(coPrecio, asOf));
    }
    resolved.set(coCli, prices);
  }
  return (coCli: string) => resolved.get(coCli) ?? null;
}

/** Dry-run plan of the whole workbook. Reads from Profit and SQLite only; never writes. */
export async function planWorkbook(deps: WorkbookDeps, parsed: ParsedWorkbook, today: string): Promise<WorkbookPlan> {
  const empty: WorkbookPlan = {
    lists: { lists: [], problems: [] },
    promos: { promos: [], problems: [], warnings: [] },
    customers: null,
    discounts: { sets: [], errors: [] },
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
  if (pendingTargets.length) {
    const keys = [...new Set(pendingTargets.map(c => c.target.slice(NEW_LIST_SENTINEL.length)))].map(k => `«${k}»`).join(', ');
    warnings.push(`${pendingTargets.length} cliente(s) apuntan a listas nuevas (${keys}) que aún no existen en Profit; no se pueden planificar hasta crearlas.`);
  } else {
    customers = await planTipoCliente(deps, parsed.customers);
  }

  const discounts = parsed.discounts.length
    ? compileDiscounts(parsed.discounts, await typeListResolver(deps, parsed, today))
    : empty.discounts;

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
    ...discounts.errors.map(e => `Descuentos por cliente: ${e}`),
  ];
  return plan;
}
