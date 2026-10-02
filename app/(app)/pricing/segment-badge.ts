import type { SegmentDto } from '@/lib/pricing/client-types';

export type BadgeTone = 'none' | 'ok' | 'warn' | 'expired';

export function segmentBadge(s: Pick<SegmentDto, 'kind' | 'daysLeft'>): { label: string; tone: BadgeTone } {
  if (s.kind !== 'special' || s.daysLeft === null) return { label: '', tone: 'none' };
  if (s.daysLeft < 0) return { label: 'vencida', tone: 'expired' };
  if (s.daysLeft === 0) return { label: '⏳ hoy', tone: 'warn' };
  return { label: `⏳ ${s.daysLeft} d`, tone: s.daysLeft <= 7 ? 'warn' : 'ok' };
}
