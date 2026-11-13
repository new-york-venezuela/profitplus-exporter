// Pure rule for repairing AJUS cost layers inflated by the 0002 doubling bug (see migrations/mssql/0020, 0021).
// No I/O: the ERP read and the pApi* writes live in ajuste-cost-repair-erp.ts.

export interface OpenAjusLayer {
  id: string;
  coArt: string;
  description: string;
  fecha: string;
  remaining: number;
  costo: number;
  /** Latest COMP/PROV cost on or before the layer's date: what the proc would have used with the 0020 fix. */
  refCosto: number | null;
  refFecha: string | null;
}

export interface LayerFix {
  id: string;
  coArt: string;
  description: string;
  fecha: string;
  remaining: number;
  costoOld: number;
  costoNew: number;
  refFecha: string | null;
  /** inflada = layer above the reference (doubling bug); subvaluada = far below it (copy of a tiny extra purchase line). */
  reason: 'inflada' | 'subvaluada';
}

export interface ReviewItem { id: string; coArt: string; description: string; costo: number; reason: string }

export interface RepairPlan { fixes: LayerFix[]; review: ReviewItem[]; untouched: number }

/** A layer this many times above (or below, as 1/n) its purchase reference is wrong (doubling gives >= 2x). */
export const DEFAULT_MIN_RATIO = 1.5;

export function planAjusteCostRepair(
  layers: OpenAjusLayer[],
  opts: { minRatio?: number } = {},
): RepairPlan {
  const minRatio = opts.minRatio ?? DEFAULT_MIN_RATIO;
  const plan: RepairPlan = { fixes: [], review: [], untouched: 0 };

  for (const l of layers) {
    if (l.remaining <= 0) { plan.untouched++; continue; }
    if (l.refCosto === null || l.refCosto <= 0) {
      plan.review.push({
        id: l.id, coArt: l.coArt, description: l.description, costo: l.costo,
        reason: 'sin costo de compra (COMP/PROV) anterior a la capa: corregir a mano',
      });
      continue;
    }
    const inflated = l.costo >= l.refCosto * minRatio;
    const undervalued = l.costo * minRatio <= l.refCosto;
    if (!inflated && !undervalued) { plan.untouched++; continue; }
    plan.fixes.push({
      id: l.id, coArt: l.coArt, description: l.description, fecha: l.fecha, remaining: l.remaining,
      costoOld: l.costo, costoNew: l.refCosto, refFecha: l.refFecha,
      reason: inflated ? 'inflada' : 'subvaluada',
    });
  }
  return plan;
}
