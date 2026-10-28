import type { PromoDef } from './csv';

export interface PromoPlanContext {
  existing: { coPrecio: string; desPrecio: string }[];
  /** Lists defined in lists.csv/prices.csv. Resolved by key; once one exists in Profit (by name) it is treated as existing. */
  pending: { key: string; nombre: string; desde: string; prices: Map<string, number> }[];
  articles: { coArt: string; artDes: string }[];
  today: string;
}
export type PromoTarget =
  | { kind: 'existing'; coPrecio: string; desPrecio: string }
  | { kind: 'pending'; key: string; nombre: string; desde: string };
export interface PlannedPromoItem { coArt: string; artDes: string; monto: number; regular: number | null }
export interface PlannedPromo {
  name: string; reason: string | null; startsOn: string; endsOn: string; target: PromoTarget; items: PlannedPromoItem[];
}
export interface PromoPlan { promos: PlannedPromo[]; problems: string[]; warnings: string[] }

const norm = (s: string) => s.trim().toUpperCase();

function resolveTarget(lista: string, ctx: PromoPlanContext): PromoTarget | null {
  const k = norm(lista);
  const existingByName = new Map(ctx.existing.map(l => [norm(l.desPrecio), l]));
  const pending = ctx.pending.find(p => norm(p.key) === k);
  if (pending) {
    const already = existingByName.get(norm(pending.nombre));
    return already
      ? { kind: 'existing', coPrecio: already.coPrecio, desPrecio: already.desPrecio }
      : { kind: 'pending', key: pending.key, nombre: pending.nombre, desde: pending.desde };
  }
  const found = ctx.existing.find(l => norm(l.coPrecio) === k) ?? existingByName.get(k);
  return found ? { kind: 'existing', coPrecio: found.coPrecio, desPrecio: found.desPrecio } : null;
}

const targetId = (t: PromoTarget) => (t.kind === 'existing' ? `E:${t.coPrecio}` : `P:${t.key}`);

export function buildPromoPlan(defs: PromoDef[], ctx: PromoPlanContext): PromoPlan {
  const problems: string[] = [];
  const warnings: string[] = [];
  const articles = new Map(ctx.articles.map(a => [norm(a.coArt), a]));
  const promos: PlannedPromo[] = [];

  for (const def of defs) {
    const at = `Promoción «${def.name}»`;
    if (def.desde < ctx.today) problems.push(`${at}: «desde» (${def.desde}) no puede ser anterior a hoy (${ctx.today})`);
    const target = resolveTarget(def.lista, ctx);
    if (!target) { problems.push(`${at}: la lista «${def.lista}» no existe en Profit ni en lists.csv`); continue; }
    if (target.kind === 'pending' && def.desde < target.desde) {
      problems.push(`${at}: empieza ${def.desde}, antes de que la lista «${target.key}» tenga precio regular (${target.desde})`);
    }
    const pendingPrices = target.kind === 'pending' ? ctx.pending.find(p => p.key === target.key)!.prices : null;
    const items: PlannedPromoItem[] = [];
    for (const it of def.items) {
      const art = articles.get(norm(it.coArt));
      if (!art) { problems.push(`${at}: artículo inexistente o anulado en Profit: ${it.coArt}`); continue; }
      const regular = pendingPrices ? pendingPrices.get(norm(art.coArt)) ?? null : null;
      if (pendingPrices && regular === null) problems.push(`${at}: ${art.coArt} no tiene precio regular en la lista «${target.kind === 'pending' ? target.key : ''}»`);
      if (regular !== null && it.monto >= regular) warnings.push(`${at}: ${art.coArt} promo ${it.monto} no es menor que el regular ${regular}`);
      items.push({ coArt: art.coArt, artDes: art.artDes, monto: it.monto, regular });
    }
    promos.push({ name: def.name, reason: def.reason, startsOn: def.desde, endsOn: def.hasta, target, items });
  }

  // Two promotions on the same list and article must not overlap in time.
  const ranges = new Map<string, { name: string; from: string; to: string }[]>();
  for (const p of promos) {
    for (const it of p.items) {
      const key = `${targetId(p.target)}\u0000${it.coArt}`;
      const mine = { name: p.name, from: p.startsOn, to: p.endsOn };
      for (const o of ranges.get(key) ?? []) {
        if (o.from <= mine.to && mine.from <= o.to) problems.push(`«${o.name}» y «${p.name}» se solapan en el artículo ${it.coArt}`);
      }
      ranges.set(key, [...(ranges.get(key) ?? []), mine]);
    }
  }
  return { promos, problems, warnings };
}
