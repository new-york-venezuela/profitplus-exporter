import { addDaysIso } from './dates';
import { same, type RatePlan, type RateRow } from './rate-planner';

const fail = (error: string): RatePlan => ({ ok: false, error });

export function planCancelPromo(existing: RateRow[], p: { from: string; to: string; regularMonto: number; today: string }): RatePlan {
  const promo = existing.find(r => r.desde === p.from && r.hasta === p.to);
  if (!promo) return fail('No se encontró la fila de la promoción (¿fue modificada manualmente?)');
  if (p.today > p.to) return fail('La promoción ya terminó');
  // Not started, or starting today: reprice the whole row to the regular amount (history stays in the app record).
  if (p.today <= p.from) return { ok: true, skipped: false, ops: [{ type: 'update', row: promo, set: { monto: p.regularMonto } }] };
  // Active: keep the elapsed days at the promo price, the rest at the regular price.
  return {
    ok: true, skipped: false, ops: [
      { type: 'update', row: promo, set: { hasta: addDaysIso(p.today, -1) } },
      { type: 'insert', desde: p.today, hasta: p.to, monto: p.regularMonto },
    ],
  };
}

export function planChangePromoEnd(existing: RateRow[], p: { from: string; to: string; newTo: string; regularMonto: number; today: string }): RatePlan {
  const promo = existing.find(r => r.desde === p.from && r.hasta === p.to);
  if (!promo) return fail('No se encontró la fila de la promoción (¿fue modificada manualmente?)');
  if (p.today > p.to) return fail('La promoción ya terminó');
  if (p.newTo === p.to) return { ok: true, skipped: true, ops: [] };
  if (p.newTo < p.from) return fail('La nueva fecha de fin no puede ser anterior al inicio');
  if (p.newTo < p.today) return fail('La nueva fecha de fin no puede ser anterior a hoy');

  const cont = existing.find(r => r.desde === addDaysIso(p.to, 1));
  const newContFrom = addDaysIso(p.newTo, 1);

  if (p.newTo > p.to) {
    if (!cont) return fail('No hay una tarifa regular posterior para extender la promoción');
    if (cont.hasta !== null && cont.hasta < newContFrom) return fail('La nueva fecha excede la vigencia de la tarifa regular');
    return { ok: true, skipped: false, ops: [
      { type: 'update', row: promo, set: { hasta: p.newTo } },
      { type: 'update', row: cont, set: { desde: newContFrom } },
    ] };
  }
  // shorten
  if (cont) {
    return { ok: true, skipped: false, ops: [
      { type: 'update', row: promo, set: { hasta: p.newTo } },
      { type: 'update', row: cont, set: { desde: newContFrom } },
    ] };
  }
  return { ok: true, skipped: false, ops: [
    { type: 'update', row: promo, set: { hasta: p.newTo } },
    { type: 'insert', desde: newContFrom, hasta: p.to, monto: p.regularMonto },
  ] };
}

/** A promo row already written in the ERP: ends at `to`, starts at one of `froms`, priced at `monto`. */
export function findMaterialisedPromo(rows: RateRow[], p: { froms: string[]; to: string; monto: number }): RateRow | undefined {
  return rows.find(r => r.hasta === p.to && p.froms.includes(r.desde) && same(r.monto, p.monto));
}

/** Monto of the regular continuation row that starts the day after `to`, if any. */
export function continuationMonto(rows: RateRow[], to: string): number | null {
  return rows.find(r => r.desde === addDaysIso(to, 1))?.monto ?? null;
}
