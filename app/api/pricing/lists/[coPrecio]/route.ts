// app/api/pricing/lists/[coPrecio]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { renameList } from '@/lib/pricing/lists-service';
import { validateRenameListBody } from '@/lib/pricing/list-validators';
import { actorFrom, buildListsDeps, serviceErrorResponse } from '@/lib/pricing/http';
import { captureEvent, captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ coPrecio: string }> }) {
  const auth = await requirePricingAccess(request, 'edit');
  if (!auth.ok) return auth.response;
  const { coPrecio } = await params;
  if (coPrecio.length === 0 || coPrecio.length > 6) return NextResponse.json({ error: 'Código de lista inválido' }, { status: 400 });
  const parsed = validateRenameListBody(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const priceList = await renameList(await buildListsDeps(), coPrecio, parsed.value, actorFrom(auth.session));
    captureEvent(auth.session.sub, 'pricing_list_renamed', { coPrecio });
    return NextResponse.json({ priceList });
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing list rename error:', error);
    captureException(error, auth.session.sub, { coPrecio });
    return NextResponse.json({ error: 'Error al renombrar la lista' }, { status: 500 });
  }
}
