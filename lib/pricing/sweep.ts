// lib/pricing/sweep.ts
import type { AppDb } from '@/lib/geo/routes-repo';
import type { SegmentMoveResult } from './segments-service';
import { todayIso } from './dates';
import { appendAudit, getSegmentMetaMap } from './segments-repo';
import { findPromotionCustomerPrevious } from './promotions-repo';

export interface SweepErp {
  getSegment(tipCli: string): Promise<{ tipCli: string } | null>;
  listCustomersInSegment(tipCli: string): Promise<{ coCli: string; cliDes: string }[]>;
  moveCustomer(coCli: string, targetTipCli: string, user: string): Promise<SegmentMoveResult>;
}

/** `skipped` is kept for the summary shape but is always 0: every customer found is either moved or failed. */
export interface SweepSummary { segmentsChecked: number; moved: number; skipped: number; failed: number; errors: string[] }

/**
 * First candidate (promotion previous, meta previous, meta fallback) that exists, is not the expired segment and is not
 * another expired special segment (a customer sent there would only be swept again; a still-valid special segment, e.g.
 * the customer's own, is a correct destination).
 */
export function pickRevertTarget(
  p: { promotionPrevious: string | undefined; metaPrevious: string | null; metaFallback: string | null },
  exists: (tipCli: string) => boolean,
  expiredTipCli?: string,
  isExpiredSpecial: (tipCli: string) => boolean = () => false,
): string | null {
  for (const c of [p.promotionPrevious, p.metaPrevious, p.metaFallback]) {
    const t = c?.trim();
    if (t && t !== expiredTipCli?.trim() && !isExpiredSpecial(t) && exists(t)) return t;
  }
  return null;
}

export async function runSweep(
  deps: { erp: SweepErp; db: AppDb; now?: () => Date },
  actor: { id: string; erpUser: string },
): Promise<SweepSummary> {
  const today = todayIso((deps.now ?? (() => new Date()))());
  const summary: SweepSummary = { segmentsChecked: 0, moved: 0, skipped: 0, failed: 0, errors: [] };
  const isExpired = (m: { kind: string; expiresAt: string | null }) =>
    m.kind === 'special' && m.expiresAt !== null && m.expiresAt < today;
  const metas = getSegmentMetaMap(deps.db);
  const expired = [...metas.values()].filter(isExpired);
  const expiredCodes = new Set(expired.map(m => m.tipCli.trim()));

  const existsCache = new Map<string, boolean>();
  const exists = async (t: string): Promise<boolean> => {
    if (!existsCache.has(t)) existsCache.set(t, (await deps.erp.getSegment(t)) !== null);
    return existsCache.get(t)!;
  };

  for (const meta of expired) {
    summary.segmentsChecked++;
    let customers: { coCli: string; cliDes: string }[];
    try {
      customers = await deps.erp.listCustomersInSegment(meta.tipCli);
    } catch (err) {
      console.error(`[sweep] list customers failed for ${meta.tipCli}:`, err);
      summary.failed++;
      summary.errors.push(`Segmento ${meta.tipCli}: no se pudo listar los clientes`);
      continue;
    }
    for (const c of customers) {
      const promotionPrevious = findPromotionCustomerPrevious(deps.db, meta.tipCli, c.coCli);
      const candidates = [promotionPrevious, meta.previousTipCli, meta.fallbackTipCli];
      const known = new Set<string>();
      try {
        for (const cand of candidates) {
          const t = cand?.trim();
          if (t && t !== meta.tipCli.trim() && !expiredCodes.has(t) && (await exists(t))) known.add(t);
        }
      } catch (err) {
        console.error(`[sweep] segment lookup failed for ${c.coCli}:`, err);
        summary.failed++;
        summary.errors.push(`Cliente ${c.coCli}: no se pudo verificar el segmento destino`);
        continue;
      }
      const target = pickRevertTarget(
        { promotionPrevious, metaPrevious: meta.previousTipCli, metaFallback: meta.fallbackTipCli },
        t => known.has(t), meta.tipCli, t => expiredCodes.has(t),
      );
      if (!target) {
        summary.failed++;
        summary.errors.push(`Cliente ${c.coCli}: sin segmento destino valido para salir de ${meta.tipCli}`);
        continue;
      }
      try {
        const res = await deps.erp.moveCustomer(c.coCli, target, actor.erpUser);
        if (res.outcome === 'success') {
          summary.moved++;
          try {
            appendAudit(deps.db, {
              userId: actor.id, action: 'sweep_revert', target: c.coCli,
              before: { tipCli: meta.tipCli }, after: { tipCli: target },
            });
          } catch (err) {
            console.error(`[sweep] ${c.coCli} moved to ${target} but the audit write failed:`, err);
          }
        } else {
          summary.failed++;
          if (res.message) console.error(`[sweep] move ${c.coCli} -> ${target}: ${res.message}`);
          summary.errors.push(
            res.outcome === 'conflict'
              ? `Cliente ${c.coCli}: conflicto al mover a ${target}`
              : `Cliente ${c.coCli}: error al mover a ${target}`,
          );
        }
      } catch (err) {
        console.error(`[sweep] move ${c.coCli} -> ${target} threw:`, err);
        summary.failed++;
        summary.errors.push(`Cliente ${c.coCli}: error al mover a ${target}`);
      }
    }
  }
  return summary;
}
