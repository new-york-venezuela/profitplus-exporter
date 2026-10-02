// app/api/pricing/lists/[coPrecio]/rates/apply/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { applyRates } from '@/lib/pricing/lists-service';
import { validateApplyRatesBody } from '@/lib/pricing/list-validators';
import { actorFrom, buildListsDeps, serviceErrorResponse } from '@/lib/pricing/http';
import { todayIso } from '@/lib/pricing/dates';
import { captureEvent, captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ coPrecio: string }> }) {
  const auth = await requirePricingAccess(request, 'edit');
  if (!auth.ok) return auth.response;
  const { coPrecio } = await params;
  if (coPrecio.length === 0 || coPrecio.length > 6) return NextResponse.json({ error: 'Código de lista inválido' }, { status: 400 });
  const parsed = validateApplyRatesBody(await request.json().catch(() => null), todayIso());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const results = await applyRates(await buildListsDeps(), coPrecio, parsed.value, actorFrom(auth.session));
    captureEvent(auth.session.sub, 'pricing_rates_applied', {
      coPrecio, changeCount: parsed.value.changes.length, successCount: results.filter(r => r.outcome === 'success').length,
    });
    return NextResponse.json({ results });
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing rates apply error:', error);
    captureException(error, auth.session.sub, { coPrecio });
    return NextResponse.json({ error: 'Error al aplicar los precios' }, { status: 500 });
  }
}
