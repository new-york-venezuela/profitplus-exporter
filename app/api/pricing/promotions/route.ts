// app/api/pricing/promotions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { createPromotion, listPromotionDtos } from '@/lib/pricing/promotions-service';
import { validateCreatePromotionBody } from '@/lib/pricing/promo-validators';
import { actorFrom, buildPromotionsDeps, serviceErrorResponse } from '@/lib/pricing/http';
import { todayIso } from '@/lib/pricing/dates';
import { captureEvent, captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ promotions: await listPromotionDtos(await buildPromotionsDeps()) });
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing promotions list error:', error);
    captureException(error, auth.session.sub, {});
    return NextResponse.json({ error: 'Error al cargar las promociones' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'edit');
  if (!auth.ok) return auth.response;
  const parsed = validateCreatePromotionBody(await request.json().catch(() => null), todayIso());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const promotion = await createPromotion(await buildPromotionsDeps(), parsed.value, actorFrom(auth.session));
    captureEvent(auth.session.sub, 'pricing_promotion_created', {
      promotionId: promotion.id, kind: promotion.kind, status: promotion.status, itemCount: promotion.itemCount,
      appliedCount: promotion.appliedCount, customerCount: promotion.customerCount, hasWarning: promotion.warning !== undefined,
    });
    return NextResponse.json({ promotion }, { status: 201 });
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing promotion create error:', error);
    captureException(error, auth.session.sub, { kind: parsed.value.kind });
    return NextResponse.json({ error: 'Error al crear la promoción' }, { status: 500 });
  }
}
