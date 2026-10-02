// app/api/pricing/lists/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { cloneList, createList } from '@/lib/pricing/lists-service';
import { validateCreateListBody } from '@/lib/pricing/list-validators';
import { actorFrom, buildListsDeps, serviceErrorResponse } from '@/lib/pricing/http';
import { todayIso } from '@/lib/pricing/dates';
import { captureEvent, captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'edit');
  if (!auth.ok) return auth.response;
  const parsed = validateCreateListBody(await request.json().catch(() => null), todayIso());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const deps = await buildListsDeps();
    const actor = actorFrom(auth.session);
    const input = parsed.value;
    const priceList = input.mode === 'create' ? await createList(deps, input, actor) : await cloneList(deps, input, actor);
    if (input.mode === 'create') {
      captureEvent(auth.session.sub, 'pricing_list_created', { coPrecio: priceList.coPrecio, coMone: input.coMone });
    } else {
      captureEvent(auth.session.sub, 'pricing_list_cloned', { coPrecio: priceList.coPrecio, sourceCoPrecio: input.sourceCoPrecio, hasPercent: input.percent !== null });
    }
    return NextResponse.json({ priceList }, { status: 201 });
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing list create error:', error);
    captureException(error, auth.session.sub, { mode: parsed.value.mode });
    return NextResponse.json({ error: 'Error al crear la lista de precios' }, { status: 500 });
  }
}
