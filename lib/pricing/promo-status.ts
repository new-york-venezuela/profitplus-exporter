export type PromotionStatus = 'scheduled' | 'active' | 'ended' | 'cancelled';

export function promotionStatus(p: { startsOn: string; endsOn: string; cancelledAt: number | null }, today: string): PromotionStatus {
  if (p.cancelledAt !== null) return 'cancelled';
  if (today < p.startsOn) return 'scheduled';
  if (today <= p.endsOn) return 'active';
  return 'ended';
}

/**
 * Items whose promo row still runs past the promotion's end, up to today or later: a shortening that failed for them.
 * Retry stops them yesterday, even after the promotion ended.
 */
type TrackedItem = { appliedFrom: string | null; appliedTo: string | null; cancelledOn: string | null };

export function strandedItems<T extends TrackedItem>(p: { endsOn: string }, items: T[], today: string): T[] {
  return items.filter(i => i.cancelledOn === null && i.appliedFrom !== null && i.appliedTo !== null
    && i.appliedTo > p.endsOn && i.appliedTo >= today);
}
