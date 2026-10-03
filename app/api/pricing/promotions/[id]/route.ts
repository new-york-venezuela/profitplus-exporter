// app/api/pricing/promotions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { getPromotionDetail, patchPromotion } from '@/lib/pricing/promotions-service';
import { validatePatchPromotionBody } from '@/lib/pricing/promo-validators';
import { actorFrom, buildPromotionsDeps, serviceErrorResponse } from '@/lib/pricing/http';
import { parsePromotionId } from '@/lib/pricing/route-params';
import { todayIso } from '@/lib/pricing/dates';
import { captureEvent, captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

const BAD_ID = 'Identificador de promoción inválido';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth.response;
  const id = parsePromotionId((await params).id);
  if (id === null) return NextResponse.json({ error: BAD_ID }, { status: 400 });
  try {
    return NextResponse.json({ promotion: await getPromotionDetail(await buildPromotionsDeps(), id) });
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing promotion get error:', error);
    captureException(error, auth.session.sub, { promotionId: id });
    return NextResponse.json({ error: 'Error al cargar la promoción' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePricingAccess(request, 'edit');
  if (!auth.ok) return auth.response;
  const id = parsePromotionId((await params).id);
  if (id === null) return NextResponse.json({ error: BAD_ID }, { status: 400 });
  const parsed = validatePatchPromotionBody(await request.json().catch(() => null), todayIso());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const promotion = await patchPromotion(await buildPromotionsDeps(), id, parsed.value, actorFrom(auth.session));
    captureEvent(auth.session.sub, 'pricing_promotion_updated', {
      promotionId: id, action: parsed.value.action, kind: promotion.kind, status: promotion.status,
      itemCount: promotion.itemCount, appliedCount: promotion.appliedCount, hasWarning: promotion.warning !== undefined,
    });
    return NextResponse.json({ promotion });
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing promotion patch error:', error);
    captureException(error, auth.session.sub, { promotionId: id, action: parsed.value.action });
    return NextResponse.json({ error: 'Error al actualizar la promoción' }, { status: 500 });
  }
}
