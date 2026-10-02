import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { createSegment, listSegmentDtos } from '@/lib/pricing/segments-service';
import { validateCreateSegmentBody } from '@/lib/pricing/validators';
import { actorFrom, buildDeps, serviceErrorResponse } from '@/lib/pricing/http';
import { todayIso } from '@/lib/pricing/dates';
import { captureEvent, captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ segments: await listSegmentDtos(await buildDeps()) });
  } catch (error) {
    console.error('Pricing segments list error:', error);
    captureException(error, auth.session.sub);
    return NextResponse.json({ error: 'Error al consultar segmentos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'edit');
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null);
  const parsed = validateCreateSegmentBody(body, todayIso());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const result = await createSegment(await buildDeps(), parsed.value, actorFrom(auth.session));
    captureEvent(auth.session.sub, 'pricing_segment_created', { kind: parsed.value.kind, tipCli: result.segment.tipCli });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing segment create error:', error);
    captureException(error, auth.session.sub, { kind: parsed.value.kind });
    return NextResponse.json({ error: 'Error al crear el segmento' }, { status: 500 });
  }
}
