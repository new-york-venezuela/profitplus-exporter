// app/api/pricing/promotions/preview/route.ts — read-only, hence `view`.
import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { previewPromotion } from '@/lib/pricing/promotions-service';
import { validateCreatePromotionBody } from '@/lib/pricing/promo-validators';
import { buildPromotionsDeps, serviceErrorResponse } from '@/lib/pricing/http';
import { todayIso } from '@/lib/pricing/dates';
import { captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth.response;
  const parsed = validateCreatePromotionBody(await request.json().catch(() => null), todayIso());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    return NextResponse.json(await previewPromotion(await buildPromotionsDeps(), parsed.value));
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing promotion preview error:', error);
    captureException(error, auth.session.sub, { kind: parsed.value.kind });
    return NextResponse.json({ error: 'Error al previsualizar la promoción' }, { status: 500 });
  }
}
