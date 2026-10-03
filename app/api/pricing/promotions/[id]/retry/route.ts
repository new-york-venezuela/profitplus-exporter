// app/api/pricing/promotions/[id]/retry/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { retryPromotion } from '@/lib/pricing/promotions-service';
import { actorFrom, buildPromotionsDeps, serviceErrorResponse } from '@/lib/pricing/http';
import { parsePromotionId } from '@/lib/pricing/route-params';
import { captureEvent, captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePricingAccess(request, 'edit');
  if (!auth.ok) return auth.response;
  const id = parsePromotionId((await params).id);
  if (id === null) return NextResponse.json({ error: 'Identificador de promoción inválido' }, { status: 400 });
  try {
    const promotion = await retryPromotion(await buildPromotionsDeps(), id, actorFrom(auth.session));
    captureEvent(auth.session.sub, 'pricing_promotion_retried', {
      promotionId: id, kind: promotion.kind, status: promotion.status, itemCount: promotion.itemCount,
      appliedCount: promotion.appliedCount, partial: promotion.partial, hasWarning: promotion.warning !== undefined,
    });
    return NextResponse.json({ promotion });
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing promotion retry error:', error);
    captureException(error, auth.session.sub, { promotionId: id });
    return NextResponse.json({ error: 'Error al reintentar la promoción' }, { status: 500 });
  }
}
