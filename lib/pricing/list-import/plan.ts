import type { ListDef, PriceCell } from './csv';

export interface ExistingList { coPrecio: string; desPrecio: string; coMone: string | null }
export interface PlanContext {
  existing: ExistingList[];
  currencies: string[];
  articles: { coArt: string; artDes: string }[];
  today: string;
}
export interface PlannedList {
  key: string; nombre: string; coMone: string; desde: string;
  /** Set when a list with this exact name already exists in Profit: the import prices that list instead of creating one. */
  existingCoPrecio: string | null;
  changes: { coArt: string; artDes: string; monto: number }[];
}
export interface ImportPlan { lists: PlannedList[]; problems: string[] }

const norm = (s: string) => s.trim().toUpperCase();

export function buildImportPlan(lists: ListDef[], cells: PriceCell[], ctx: PlanContext): ImportPlan {
  const problems: string[] = [];
  const articles = new Map(ctx.articles.map(a => [norm(a.coArt), a]));
  const byName = new Map(ctx.existing.map(l => [norm(l.desPrecio), l]));

  // Cell-level article check once per article, not once per list.
  const unknown = new Set<string>();
  for (const c of cells) if (!articles.has(norm(c.coArt))) unknown.add(c.coArt);
  for (const a of unknown) problems.push(`Artículo inexistente o anulado en Profit: ${a}`);

  const planned: PlannedList[] = lists.map(def => {
    if (def.desde < ctx.today) problems.push(`Lista «${def.key}»: «desde» (${def.desde}) no puede ser anterior a hoy (${ctx.today})`);
    if (!ctx.currencies.includes(def.coMone)) problems.push(`Lista «${def.key}»: moneda «${def.coMone}» no válida (${ctx.currencies.join(', ')})`);
    const existing = byName.get(norm(def.nombre)) ?? null;
    if (existing?.coMone && existing.coMone !== def.coMone) {
      problems.push(`Lista «${def.key}»: ya existe «${existing.desPrecio}» (${existing.coPrecio}) en ${existing.coMone}, no en ${def.coMone}`);
    }
    const changes = cells.filter(c => c.key === def.key && articles.has(norm(c.coArt)))
      .map(c => ({ coArt: articles.get(norm(c.coArt))!.coArt, artDes: articles.get(norm(c.coArt))!.artDes, monto: c.monto }));
    if (changes.length === 0) problems.push(`Lista «${def.key}»: no tiene ningún precio en prices.csv`);
    return { key: def.key, nombre: def.nombre, coMone: def.coMone, desde: def.desde, existingCoPrecio: existing?.coPrecio ?? null, changes };
  });
  return { lists: planned, problems };
}
