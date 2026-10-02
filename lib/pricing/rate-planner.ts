import { addDaysIso } from './dates';

export interface RateRow {
  coArt: string; coPrecio: string; coAlma: string;
  desde: string; hasta: string | null; monto: number; coMone: string | null; validador: string;
}
export type RateOp =
  | { type: 'insert'; desde: string; hasta: string | null; monto: number }
  | { type: 'update'; row: RateRow; set: { desde?: string; hasta?: string | null; monto?: number } };
export type RatePlan = { ok: true; skipped: boolean; ops: RateOp[] } | { ok: false; error: string };

const fail = (error: string): RatePlan => ({ ok: false, error });
const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/**
 * Optimistic stale-grid check: does the monto of the row covering `today` equal what the user saw?
 * `undefined` = no check; `null` = the user saw no row covering today.
 */
export function matchesExpectedCurrent(rows: RateRow[], today: string, expected: number | null | undefined): boolean {
  if (expected === undefined) return true;
  const covering = rows.find(r => r.desde <= today && (r.hasta === null || r.hasta >= today));
  if (expected === null) return covering === undefined;
  return covering !== undefined && same(covering.monto, expected);
}

export function planRatePeriod(
  existing: RateRow[],
  p: { from: string; to: string | null; monto: number; today: string },
): RatePlan {
  if (!(p.monto > 0)) return fail('El precio debe ser mayor que cero');
  if (p.from < p.today) return fail('La fecha de inicio no puede ser anterior a hoy');
  if (p.to !== null && p.to < p.from) return fail('La fecha de fin no puede ser anterior a la de inicio');

  const rows = [...existing].sort((a, b) => a.desde.localeCompare(b.desde));
  const covering = rows.find(r => r.desde <= p.from && (r.hasta === null || r.hasta >= p.from));
  const later = rows.filter(r => r.desde > p.from);

  if (p.to === null) {
    if (covering) {
      if (same(covering.monto, p.monto)) return { ok: true, skipped: true, ops: [] };
      if (covering.desde === p.from) return { ok: true, skipped: false, ops: [{ type: 'update', row: covering, set: { monto: p.monto } }] };
      return {
        ok: true, skipped: false, ops: [
          { type: 'update', row: covering, set: { hasta: addDaysIso(p.from, -1) } },
          { type: 'insert', desde: p.from, hasta: covering.hasta, monto: p.monto },
        ],
      };
    }
    return { ok: true, skipped: false, ops: [{ type: 'insert', desde: p.from, hasta: later[0] ? addDaysIso(later[0].desde, -1) : null, monto: p.monto }] };
  }

  // Bounded period: split the regular rate into regular → promo → regular-continuation.
  if (!covering) return fail('No hay una tarifa regular vigente para esa fecha');
  if (later.some(r => r.desde <= p.to!)) return fail('Hay un cambio programado dentro del período');
  if (covering.hasta !== null && covering.hasta < p.to) return fail('El período excede la vigencia de la tarifa actual');

  if (covering.desde === p.from && same(covering.monto, p.monto) && covering.hasta === p.to) {
    return { ok: true, skipped: true, ops: [] };
  }
  // Same promo already materialised as its own row (previous apply)?
  const exact = rows.find(r => r.desde === p.from && r.hasta === p.to && same(r.monto, p.monto));
  if (exact) return { ok: true, skipped: true, ops: [] };

  const ops: RateOp[] = [];
  const needsContinuation = covering.hasta === null || covering.hasta > p.to;
  if (covering.desde === p.from) {
    ops.push({ type: 'update', row: covering, set: { monto: p.monto, hasta: p.to } });
  } else {
    ops.push({ type: 'update', row: covering, set: { hasta: addDaysIso(p.from, -1) } });
    ops.push({ type: 'insert', desde: p.from, hasta: p.to, monto: p.monto });
  }
  if (needsContinuation) ops.push({ type: 'insert', desde: addDaysIso(p.to, 1), hasta: covering.hasta, monto: covering.monto });
  return { ok: true, skipped: false, ops };
}
