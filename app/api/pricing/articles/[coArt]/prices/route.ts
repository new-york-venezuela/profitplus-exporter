// app/api/pricing/articles/[coArt]/prices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { getArticlePrices } from '@/lib/pricing/lists-service';
import { buildListsDeps, serviceErrorResponse } from '@/lib/pricing/http';
import { captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ coArt: string }> }) {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth.response;
  const { coArt } = await params;
  const customer = (request.nextUrl.searchParams.get('customer') ?? '').trim() || null;
  if (coArt.length === 0 || coArt.length > 30 || (customer !== null && customer.length > 30)) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }
  try {
    return NextResponse.json(await getArticlePrices(await buildListsDeps(), coArt, customer));
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing article prices error:', error);
    captureException(error, auth.session.sub, { coArt });
    return NextResponse.json({ error: 'Error al consultar precios del artículo' }, { status: 500 });
  }
}
