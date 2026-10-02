// app/api/pricing/articles/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { searchArticles } from '@/lib/pricing/lists-service';
import { buildListsDeps } from '@/lib/pricing/http';
import { captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth.response;
  const search = (request.nextUrl.searchParams.get('search') ?? '').trim();
  if (search.length > 60) return NextResponse.json({ error: 'Búsqueda demasiado larga' }, { status: 400 });
  try {
    return NextResponse.json({ articles: await searchArticles(await buildListsDeps(), search) });
  } catch (error) {
    console.error('Pricing articles search error:', error);
    captureException(error, auth.session.sub);
    return NextResponse.json({ error: 'Error al buscar artículos' }, { status: 500 });
  }
}
