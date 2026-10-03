import type { PromotionDto } from '@/lib/pricing/client-types';

export type PromoTone = 'ok' | 'warn' | 'expired' | 'muted' | 'info';

export function promoStatusBadge(p: Pick<PromotionDto, 'status' | 'daysLeft' | 'partial'>): { label: string; tone: PromoTone } {
  let label: string;
  let tone: PromoTone;
  switch (p.status) {
    case 'scheduled': label = 'Programada'; tone = 'info'; break;
    case 'active': {
      const d = p.daysLeft;
      label = d === 0 ? 'Activa · termina hoy' : d === null ? 'Activa' : `Activa · ${d} d`;
      tone = d !== null && d <= 7 ? 'warn' : 'ok';
      break;
    }
    case 'ended': label = 'Terminada'; tone = 'muted'; break;
    case 'cancelled': label = 'Cancelada'; tone = 'muted'; break;
  }
  if (p.partial) {
    label += ' · parcial';
    if (p.status !== 'ended' && p.status !== 'cancelled') tone = 'warn';
  }
  return { label, tone };
}
