import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { loadHealthReport } from '@/lib/pricing/health-loader';
import { buildHealthDeps, serviceErrorResponse } from '@/lib/pricing/http';
import { captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

const ALLOWED_DAYS = [7, 14, 30];

export async function GET(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth.response;
  const requested = Number(request.nextUrl.searchParams.get('days'));
  const days = ALLOWED_DAYS.includes(requested) ? requested : 7;
  try {
    return NextResponse.json({ report: await loadHealthReport(await buildHealthDeps(), days) });
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing health report error:', error);
    captureException(error, auth.session.sub, { days });
    return NextResponse.json({ error: 'Error al cargar los vencimientos' }, { status: 500 });
  }
}
