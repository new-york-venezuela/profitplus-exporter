export type PromotionStatus = 'scheduled' | 'active' | 'ended' | 'cancelled';

export function promotionStatus(p: { startsOn: string; endsOn: string; cancelledAt: number | null }, today: string): PromotionStatus {
  if (p.cancelledAt !== null) return 'cancelled';
  if (today < p.startsOn) return 'scheduled';
  if (today <= p.endsOn) return 'active';
  return 'ended';
}
