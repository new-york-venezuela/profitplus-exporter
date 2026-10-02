import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { patchSegment } from '@/lib/pricing/segments-service';
import { validatePatchSegmentBody } from '@/lib/pricing/validators';
import { actorFrom, buildDeps, serviceErrorResponse } from '@/lib/pricing/http';
import { todayIso } from '@/lib/pricing/dates';
import { captureEvent, captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ tipCli: string }> }) {
  const auth = await requirePricingAccess(request, 'edit');
  if (!auth.ok) return auth.response;
  const { tipCli: rawTipCli } = await params;
  const tipCli = rawTipCli.trim();
  if (tipCli.length < 1 || tipCli.length > 6) return NextResponse.json({ error: 'Código de segmento inválido' }, { status: 400 });
  const body = await request.json().catch(() => null);
  const parsed = validatePatchSegmentBody(body, todayIso());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const segment = await patchSegment(await buildDeps(), tipCli, parsed.value, actorFrom(auth.session));
    captureEvent(auth.session.sub, 'pricing_segment_updated', { tipCli });
    return NextResponse.json({ segment });
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing segment patch error:', error);
    captureException(error, auth.session.sub, { tipCli });
    return NextResponse.json({ error: 'Error al actualizar el segmento' }, { status: 500 });
  }
}
