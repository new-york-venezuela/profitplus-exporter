// app/api/pricing/lists/[coPrecio]/rates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { getRatesGrid } from '@/lib/pricing/lists-service';
import { buildListsDeps, serviceErrorResponse } from '@/lib/pricing/http';
import { captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ coPrecio: string }> }) {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth.response;
  const { coPrecio } = await params;
  const compareTo = request.nextUrl.searchParams.get('compareTo') || null;
  if (coPrecio.length === 0 || coPrecio.length > 6 || (compareTo !== null && compareTo.length > 6)) {
    return NextResponse.json({ error: 'Código de lista inválido' }, { status: 400 });
  }
  try {
    return NextResponse.json(await getRatesGrid(await buildListsDeps(), coPrecio, compareTo));
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing rates grid error:', error);
    captureException(error, auth.session.sub, { coPrecio });
    return NextResponse.json({ error: 'Error al consultar las tarifas' }, { status: 500 });
  }
}
