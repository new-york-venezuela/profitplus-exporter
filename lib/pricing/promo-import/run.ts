import { createPromotion, previewPromotion, type PromotionsDeps } from '../promotions-service';
import { listPromotions } from '../promotions-repo';
import type { Actor } from '../segments-service';
import { promotionStatus } from '../promo-status';
import { buildPromoPlan, type PlannedPromo, type PromoPlan, type PromoPlanContext } from './plan';
import type { PromoDef } from './csv';

export interface PlannedPromoChecked extends PlannedPromo {
  /** A non-cancelled promotion with this name already exists on the same list: the import leaves it alone. */
  alreadyExists: boolean;
}
export interface CheckedPromoPlan extends Omit<PromoPlan, 'promos'> { promos: PlannedPromoChecked[] }

export async function planPromoImport(
  deps: PromotionsDeps, defs: PromoDef[], pending: PromoPlanContext['pending'], today: string,
): Promise<CheckedPromoPlan> {
  const [lists, articles] = await Promise.all([deps.rates.listLists(), deps.rates.listArticles({ limit: 5000 })]);
  const plan = buildPromoPlan(defs, { existing: lists, pending, articles, today });
  const problems = [...plan.problems];
  const known = listPromotions(deps.db).filter(p => promotionStatus(p, today) !== 'cancelled');

  const promos: PlannedPromoChecked[] = [];
  for (const p of plan.promos) {
    if (p.target.kind !== 'existing') { promos.push({ ...p, alreadyExists: false }); continue; }
    const { coPrecio } = p.target;
    const alreadyExists = known.some(k => k.coPrecio === coPrecio && k.name.trim().toUpperCase() === p.name.toUpperCase());
    if (alreadyExists) { promos.push({ ...p, alreadyExists }); continue; }
    // Same dry run the wizard shows: regular price, and per-article rejections (overlap, missing regular rate, mixed currency...).
    const preview = await previewPromotion(deps, {
      kind: 'overlay', name: p.name, reason: p.reason, coPrecio, startsOn: p.startsOn, endsOn: p.endsOn,
      items: p.items.map(i => ({ coArt: i.coArt, monto: i.monto })),
    });
    const byArt = new Map(preview.rows.map(r => [r.coArt, r]));
    const items = p.items.map(i => ({ ...i, regular: byArt.get(i.coArt)?.regular ?? null }));
    for (const r of preview.rows) {
      if (r.status === 'rejected') problems.push(`Promoción «${p.name}», artículo ${r.coArt}: ${r.message}`);
      else if (r.regular !== null && r.promo >= r.regular) plan.warnings.push(`Promoción «${p.name}»: ${r.coArt} promo ${r.promo} no es menor que el regular ${r.regular}`);
    }
    promos.push({ ...p, items, alreadyExists });
  }
  return { promos, problems, warnings: plan.warnings };
}

export interface PromoOutcome { name: string; id: number; status: string; applied: number; items: number; problems: string[]; warning?: string }

/** Creates each promotion not yet in Profit through the same service the wizard uses. Needs every list to exist already. */
export async function applyPromoImport(deps: PromotionsDeps, plan: CheckedPromoPlan, actor: Actor): Promise<PromoOutcome[]> {
  const out: PromoOutcome[] = [];
  for (const p of plan.promos) {
    if (p.alreadyExists || p.target.kind !== 'existing') continue;
    const d = await createPromotion(deps, {
      kind: 'overlay', name: p.name, reason: p.reason, coPrecio: p.target.coPrecio, startsOn: p.startsOn, endsOn: p.endsOn,
      items: p.items.map(i => ({ coArt: i.coArt, monto: i.monto })),
    }, actor);
    out.push({
      name: p.name, id: d.id, status: d.status, applied: d.appliedCount, items: d.itemCount,
      problems: d.items.filter(i => !i.applied && i.message).map(i => `${i.coArt}: ${i.message}`), warning: d.warning,
    });
  }
  return out;
}
