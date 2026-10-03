import type { RateRow } from './rate-planner';
import { daysBetweenIso } from './dates';
import { promotionStatus, strandedItems } from './promo-status';

export interface EndingSoonItem {
  promotionId: number; name: string; kind: 'overlay' | 'segment'; endsOn: string; daysLeft: number; coPrecio: string;
}
export interface UnrevertedItem { tipCli: string; label: string; expiresAt: string; daysOverdue: number; customerCount: number }
export interface LapsedItem { coPrecio: string; coArt: string; coAlma: string; lastHasta: string | null; nextDesde: string | null }
/** An ended or cancelled promotion with items whose promo row still runs past its end (a failed shortening). */
export interface StrandedPromotion { promotionId: number; name: string; endsOn: string; itemCount: number }
export type SweepState = 'never' | 'ok' | 'stale' | 'failed';
export interface SweepStatus { state: SweepState; lastRunAt: number | null; hoursSince: number | null; failed: number; error: string | null }

const STALE_AFTER_HOURS = 36;

export function endingSoon(
  promotions: { id: number; name: string; kind: 'overlay' | 'segment'; coPrecio: string; startsOn: string; endsOn: string; cancelledAt: number | null }[],
  today: string,
  withinDays: number,
): EndingSoonItem[] {
  return promotions
    .filter(p => promotionStatus(p, today) === 'active')
    .map(p => ({
      promotionId: p.id, name: p.name, kind: p.kind, endsOn: p.endsOn, daysLeft: daysBetweenIso(today, p.endsOn), coPrecio: p.coPrecio,
    }))
    .filter(i => i.daysLeft <= withinDays)
    .sort((a, b) => a.endsOn.localeCompare(b.endsOn) || a.name.localeCompare(b.name));
}

export function unrevertedSegments(
  meta: { tipCli: string; kind: 'group' | 'special'; reason: string | null; expiresAt: string | null }[],
  customerCountByTipCli: Record<string, number>,
  today: string,
): UnrevertedItem[] {
  const out: UnrevertedItem[] = [];
  for (const m of meta) {
    if (m.kind !== 'special' || m.expiresAt === null || m.expiresAt >= today) continue;
    const customerCount = customerCountByTipCli[m.tipCli] ?? 0;
    if (customerCount <= 0) continue;
    out.push({
      tipCli: m.tipCli, label: m.reason ?? m.tipCli, expiresAt: m.expiresAt,
      daysOverdue: daysBetweenIso(m.expiresAt, today), customerCount,
    });
  }
  return out.sort((a, b) => b.daysOverdue - a.daysOverdue || a.tipCli.localeCompare(b.tipCli));
}

export function lapsedPrices(rows: RateRow[], listsInUse: string[], today: string): LapsedItem[] {
  const inUse = new Set(listsInUse);
  const groups = new Map<string, RateRow[]>();
  for (const r of rows) {
    if (!inUse.has(r.coPrecio)) continue;
    const key = `${r.coPrecio}\u0000${r.coArt}\u0000${r.coAlma}`;
    const g = groups.get(key);
    if (g) g.push(r); else groups.set(key, [r]);
  }
  const out: LapsedItem[] = [];
  for (const g of groups.values()) {
    if (g.some(r => r.desde <= today && (r.hasta === null || r.hasta >= today))) continue;
    const past = g.map(r => r.hasta).filter((h): h is string => h !== null && h < today).sort();
    const next = g.map(r => r.desde).filter(d => d > today).sort();
    out.push({
      coPrecio: g[0].coPrecio, coArt: g[0].coArt, coAlma: g[0].coAlma,
      lastHasta: past.length ? past[past.length - 1] : null, nextDesde: next.length ? next[0] : null,
    });
  }
  return out.sort((a, b) => a.coPrecio.localeCompare(b.coPrecio) || a.coArt.localeCompare(b.coArt) || a.coAlma.localeCompare(b.coAlma));
}

export function strandedPromotions(
  promotions: { id: number; name: string; startsOn: string; endsOn: string; cancelledAt: number | null }[],
  itemsByPromotion: Record<number, { appliedFrom: string | null; appliedTo: string | null; cancelledOn: string | null }[]>,
  today: string,
): StrandedPromotion[] {
  const out: StrandedPromotion[] = [];
  for (const p of promotions) {
    const status = promotionStatus(p, today);
    if (status !== 'ended' && status !== 'cancelled') continue;
    const itemCount = strandedItems(p, itemsByPromotion[p.id] ?? [], today).length;
    if (itemCount > 0) out.push({ promotionId: p.id, name: p.name, endsOn: p.endsOn, itemCount });
  }
  return out.sort((a, b) => a.endsOn.localeCompare(b.endsOn) || a.promotionId - b.promotionId);
}

export function sweepStatus(
  last: { runAt: number; ok: boolean; failed: number; error: string | null } | undefined,
  nowMs: number,
): SweepStatus {
  if (!last) return { state: 'never', lastRunAt: null, hoursSince: null, failed: 0, error: null };
  const hoursSince = Math.round(((nowMs - last.runAt) / 3_600_000) * 10) / 10;
  const state: SweepState = !last.ok || last.failed > 0 ? 'failed' : hoursSince > STALE_AFTER_HOURS ? 'stale' : 'ok';
  return { state, lastRunAt: last.runAt, hoursSince, failed: last.failed, error: last.error };
}
