import { applyRates, createList, currentOf, type ApplyResult, type ListsDeps } from '../lists-service';
import type { Actor } from '../segments-service';
import { buildImportPlan, type ImportPlan, type PlannedList } from './plan';
import type { ListDef, PriceCell } from './csv';

export async function planImport(deps: ListsDeps, lists: ListDef[], cells: PriceCell[], today: string): Promise<ImportPlan> {
  const [existing, currencies, articles] = await Promise.all([
    deps.erp.listLists(), deps.erp.listCurrencies(), deps.erp.listArticles({ limit: 5000 }),
  ]);
  return buildImportPlan(lists, cells, {
    existing: existing.map(l => ({ coPrecio: l.coPrecio, desPrecio: l.desPrecio, coMone: l.coMone })),
    currencies, articles, today,
  });
}

/** For lists that already exist: the price covering the list's `desde` today, to show before → after in a dry run. */
export async function currentPrices(deps: ListsDeps, list: PlannedList): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!list.existingCoPrecio) return out;
  const rates = await deps.erp.readListRates(list.existingCoPrecio);
  for (const c of list.changes) {
    const m = currentOf(rates.filter(r => r.coArt === c.coArt), list.desde);
    if (m) out.set(c.coArt, m.monto);
  }
  return out;
}

export interface ListOutcome { key: string; coPrecio: string; created: boolean; results: ApplyResult[] }

/** Creates the missing lists, then prices each. Safe to re-run: lists are matched by name and unchanged prices are skipped. */
export async function applyImport(deps: ListsDeps, plan: ImportPlan, actor: Actor): Promise<ListOutcome[]> {
  const outcomes: ListOutcome[] = [];
  for (const l of plan.lists) {
    let coPrecio = l.existingCoPrecio;
    const created = coPrecio === null;
    if (coPrecio === null) coPrecio = (await createList(deps, { mode: 'create', desPrecio: l.nombre, coMone: l.coMone }, actor)).coPrecio;
    const results = await applyRates(deps, coPrecio, {
      effectiveFrom: l.desde, changes: l.changes.map(c => ({ coArt: c.coArt, monto: c.monto })),
    }, actor);
    outcomes.push({ key: l.key, coPrecio, created, results });
  }
  return outcomes;
}
